BEGIN;

ALTER TABLE public.gsa_calculator_pro_payments
  ADD COLUMN IF NOT EXISTS duracao_acesso_minutos integer;

UPDATE public.gsa_calculator_pro_payments payment
   SET duracao_acesso_minutos = COALESCE(
     payment.duracao_acesso_minutos,
     (SELECT product.duracao_acesso_minutos
        FROM public.gsa_calculator_pro_products product
       WHERE product.tool_id = payment.tool_id),
     1440
   )
 WHERE payment.duracao_acesso_minutos IS NULL;

ALTER TABLE public.gsa_calculator_pro_payments
  ALTER COLUMN duracao_acesso_minutos SET DEFAULT 1440,
  ALTER COLUMN duracao_acesso_minutos SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'gsa_calculator_pro_payments_duration_check'
       AND conrelid = 'public.gsa_calculator_pro_payments'::regclass
  ) THEN
    ALTER TABLE public.gsa_calculator_pro_payments
      ADD CONSTRAINT gsa_calculator_pro_payments_duration_check
      CHECK (duracao_acesso_minutos BETWEEN 15 AND 525600);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT transaction_nsu
      FROM public.gsa_calculator_pro_payments
     WHERE transaction_nsu IS NOT NULL
     GROUP BY transaction_nsu
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem transações InfinitePay duplicadas e a migração não pode prosseguir';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gsa_calculator_pro_transaction_unique
  ON public.gsa_calculator_pro_payments(transaction_nsu)
  WHERE transaction_nsu IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gsa_calculator_pro_runtime_config (
  config_key text PRIMARY KEY DEFAULT 'default' CHECK (config_key = 'default'),
  infinitepay_handle text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    infinitepay_handle IS NULL
    OR infinitepay_handle ~ '^[A-Za-z0-9._-]{2,100}$'
  )
);

INSERT INTO public.gsa_calculator_pro_runtime_config(config_key)
VALUES ('default')
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE public.gsa_calculator_pro_runtime_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_calculator_pro_runtime_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_calculator_pro_runtime_config_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_calculator_pro_runtime_config_updated_at
  ON public.gsa_calculator_pro_runtime_config;
CREATE TRIGGER trg_gsa_calculator_pro_runtime_config_updated_at
BEFORE UPDATE ON public.gsa_calculator_pro_runtime_config
FOR EACH ROW EXECUTE FUNCTION public.gsa_calculator_pro_runtime_config_touch();

UPDATE public.gsa_calculator_pro_vouchers
   SET status = 'expired'
 WHERE status = 'active'
   AND expires_at IS NOT NULL
   AND expires_at <= now();

CREATE OR REPLACE FUNCTION public.gsa_admin_calculator_pro_snapshot(
  p_sessao_id uuid,
  p_session_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_products jsonb;
  v_vouchers jsonb;
  v_payments jsonb;
  v_grants jsonb;
  v_runtime_config jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  UPDATE public.gsa_calculator_pro_vouchers
     SET status = 'expired'
   WHERE status = 'active'
     AND expires_at IS NOT NULL
     AND expires_at <= now();

  SELECT COALESCE(jsonb_agg(to_jsonb(product) ORDER BY product.tool_id), '[]'::jsonb)
    INTO v_products
    FROM public.gsa_calculator_pro_products product;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', voucher.id,
    'code_hint', voucher.code_hint,
    'tool_id', voucher.tool_id,
    'status', voucher.status,
    'expires_at', voucher.expires_at,
    'used_at', voucher.used_at,
    'used_by_cliente_id', voucher.used_by_cliente_id,
    'used_by_cliente_nome', client.nome,
    'observacoes', voucher.observacoes,
    'created_at', voucher.created_at
  ) ORDER BY voucher.created_at DESC), '[]'::jsonb)
    INTO v_vouchers
    FROM (
      SELECT *
        FROM public.gsa_calculator_pro_vouchers
       ORDER BY created_at DESC
       LIMIT 200
    ) voucher
    LEFT JOIN public.clientes client ON client.id = voucher.used_by_cliente_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', payment.id,
    'order_nsu', payment.order_nsu,
    'tool_id', payment.tool_id,
    'cliente_id', payment.cliente_id,
    'cliente_nome', client.nome,
    'valor_centavos', payment.valor_centavos,
    'duracao_acesso_minutos', payment.duracao_acesso_minutos,
    'status', payment.status,
    'checkout_url', payment.checkout_url,
    'transaction_nsu', payment.transaction_nsu,
    'invoice_slug', payment.invoice_slug,
    'receipt_url', payment.receipt_url,
    'capture_method', payment.capture_method,
    'paid_amount_centavos', payment.paid_amount_centavos,
    'paid_at', payment.paid_at,
    'expires_at', payment.expires_at,
    'created_at', payment.created_at
  ) ORDER BY payment.created_at DESC), '[]'::jsonb)
    INTO v_payments
    FROM (
      SELECT *
        FROM public.gsa_calculator_pro_payments
       ORDER BY created_at DESC
       LIMIT 200
    ) payment
    LEFT JOIN public.clientes client ON client.id = payment.cliente_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', grant_row.id,
    'tool_id', grant_row.tool_id,
    'source', grant_row.source,
    'cliente_id', grant_row.cliente_id,
    'cliente_nome', client.nome,
    'valid_from', grant_row.valid_from,
    'valid_until', grant_row.valid_until,
    'max_uses', grant_row.max_uses,
    'used_count', grant_row.used_count,
    'status', grant_row.status,
    'observacoes', grant_row.observacoes,
    'created_at', grant_row.created_at
  ) ORDER BY grant_row.created_at DESC), '[]'::jsonb)
    INTO v_grants
    FROM (
      SELECT *
        FROM public.gsa_calculator_pro_grants
       ORDER BY created_at DESC
       LIMIT 200
    ) grant_row
    LEFT JOIN public.clientes client ON client.id = grant_row.cliente_id;

  SELECT jsonb_build_object(
    'infinitepay_handle', config.infinitepay_handle,
    'checkout_ready', config.infinitepay_handle IS NOT NULL,
    'updated_at', config.updated_at
  )
    INTO v_runtime_config
    FROM public.gsa_calculator_pro_runtime_config config
   WHERE config.config_key = 'default';

  RETURN jsonb_build_object(
    'products', v_products,
    'vouchers', v_vouchers,
    'payments', v_payments,
    'grants', v_grants,
    'runtime_config', COALESCE(v_runtime_config, jsonb_build_object(
      'infinitepay_handle', NULL,
      'checkout_ready', false,
      'updated_at', NULL
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_calculator_pro_runtime_config(
  p_sessao_id uuid,
  p_session_token text,
  p_infinitepay_handle text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_handle text;
  v_actor uuid;
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  v_handle := nullif(regexp_replace(btrim(COALESCE(p_infinitepay_handle, '')), '^\$', ''), '');
  IF v_handle IS NOT NULL AND v_handle !~ '^[A-Za-z0-9._-]{2,100}$' THEN
    RAISE EXCEPTION 'InfiniteTag inválida. Informe apenas o nome, sem o símbolo $' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  INSERT INTO public.gsa_calculator_pro_runtime_config(
    config_key,
    infinitepay_handle,
    updated_by
  ) VALUES (
    'default',
    v_handle,
    v_actor
  )
  ON CONFLICT (config_key) DO UPDATE
    SET infinitepay_handle = EXCLUDED.infinitepay_handle,
        updated_by = EXCLUDED.updated_by
  RETURNING jsonb_build_object(
    'success', true,
    'infinitepay_handle', infinitepay_handle,
    'checkout_ready', infinitepay_handle IS NOT NULL,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_actor uuid;
  v_attempt integer;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A validade precisa estar no futuro' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  FOR v_attempt IN 1..5 LOOP
    v_code := 'GSA-PRO-' || upper(encode(gen_random_bytes(10), 'hex'));
    BEGIN
      INSERT INTO public.gsa_calculator_pro_vouchers(
        code_hash,
        code_hint,
        tool_id,
        expires_at,
        observacoes,
        created_by
      ) VALUES (
        encode(digest(upper(v_code), 'sha256'), 'hex'),
        right(v_code, 6),
        p_tool_id,
        p_expires_at,
        nullif(btrim(p_observacoes), ''),
        v_actor
      ) RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'code', v_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(
  p_sessao_id uuid,
  p_session_token text,
  p_voucher_id uuid,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_voucher public.gsa_calculator_pro_vouchers;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF p_status NOT IN ('active','cancelled') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_voucher
    FROM public.gsa_calculator_pro_vouchers
   WHERE id = p_voucher_id
   FOR UPDATE;

  IF v_voucher.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'voucher_not_found');
  END IF;
  IF v_voucher.status IN ('used','expired') THEN
    RETURN jsonb_build_object('success', false, 'error', 'voucher_locked');
  END IF;
  IF p_status = 'active' AND v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at <= now() THEN
    UPDATE public.gsa_calculator_pro_vouchers
       SET status = 'expired'
     WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'voucher_expired');
  END IF;

  UPDATE public.gsa_calculator_pro_vouchers
     SET status = p_status
   WHERE id = v_voucher.id;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_calculator_redeem_voucher_internal(
  p_code_hash text,
  p_tool_id text,
  p_visitor_hash text,
  p_cliente_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_voucher public.gsa_calculator_pro_vouchers;
  v_grant_id uuid;
  v_product_active boolean;
  v_duration integer;
  v_valid_until timestamptz;
BEGIN
  IF p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tool');
  END IF;
  IF p_cliente_id IS NULL AND nullif(btrim(COALESCE(p_visitor_hash, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_identity');
  END IF;

  SELECT product.ativo, product.duracao_acesso_minutos
    INTO v_product_active, v_duration
    FROM public.gsa_calculator_pro_products product
   WHERE product.tool_id = p_tool_id;

  IF NOT FOUND OR NOT COALESCE(v_product_active, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_unavailable');
  END IF;

  SELECT * INTO v_voucher
    FROM public.gsa_calculator_pro_vouchers
   WHERE code_hash = p_code_hash
   FOR UPDATE;

  IF v_voucher.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_voucher');
  END IF;
  IF v_voucher.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'voucher_unavailable');
  END IF;
  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at <= now() THEN
    UPDATE public.gsa_calculator_pro_vouchers
       SET status = 'expired'
     WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'voucher_expired');
  END IF;
  IF v_voucher.tool_id IS NOT NULL AND v_voucher.tool_id <> p_tool_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'voucher_wrong_tool');
  END IF;

  v_valid_until := now() + make_interval(mins => LEAST(525600, GREATEST(15, COALESCE(v_duration, 1440))));

  UPDATE public.gsa_calculator_pro_vouchers
     SET status = 'used',
         used_at = now(),
         used_by_cliente_id = p_cliente_id,
         used_by_visitor_hash = CASE WHEN p_cliente_id IS NULL THEN p_visitor_hash ELSE NULL END
   WHERE id = v_voucher.id;

  INSERT INTO public.gsa_calculator_pro_grants(
    tool_id,
    source,
    cliente_id,
    visitor_token_hash,
    reference_id,
    valid_until,
    max_uses,
    observacoes
  ) VALUES (
    p_tool_id,
    'voucher',
    p_cliente_id,
    CASE WHEN p_cliente_id IS NULL THEN p_visitor_hash ELSE NULL END,
    v_voucher.id,
    v_valid_until,
    1,
    'Voucher de uma utilização'
  ) RETURNING id INTO v_grant_id;

  INSERT INTO public.gsa_calculator_pro_events(
    event_type,
    tool_id,
    grant_id,
    cliente_id,
    visitor_token_hash,
    details
  ) VALUES (
    'voucher_redeemed',
    p_tool_id,
    v_grant_id,
    p_cliente_id,
    CASE WHEN p_cliente_id IS NULL THEN p_visitor_hash ELSE NULL END,
    jsonb_build_object('voucher_id', v_voucher.id, 'valid_until', v_valid_until)
  );

  RETURN jsonb_build_object(
    'success', true,
    'grant_id', v_grant_id,
    'valid_until', v_valid_until,
    'duration_minutes', v_duration
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_calculator_finalize_payment_internal(
  p_order_nsu text,
  p_transaction_nsu text,
  p_invoice_slug text,
  p_receipt_url text,
  p_capture_method text,
  p_paid_amount_centavos integer,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.gsa_calculator_pro_payments;
  v_duration integer;
  v_grant_id uuid;
  v_valid_until timestamptz;
BEGIN
  SELECT * INTO v_payment
    FROM public.gsa_calculator_pro_payments
   WHERE order_nsu = p_order_nsu
   FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'payment_not_found');
  END IF;

  IF v_payment.status = 'paid' THEN
    SELECT grant_row.id INTO v_grant_id
      FROM public.gsa_calculator_pro_grants grant_row
     WHERE grant_row.source = 'payment'
       AND grant_row.reference_id = v_payment.id
     LIMIT 1;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'grant_id', v_grant_id);
  END IF;

  IF nullif(btrim(COALESCE(p_transaction_nsu, '')), '') IS NULL
     OR nullif(btrim(COALESCE(p_invoice_slug, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'payment_identifiers_missing');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.gsa_calculator_pro_payments other_payment
     WHERE other_payment.transaction_nsu = p_transaction_nsu
       AND other_payment.id <> v_payment.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'transaction_already_used');
  END IF;

  IF COALESCE(p_paid_amount_centavos, 0) < v_payment.valor_centavos THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_mismatch');
  END IF;

  v_duration := LEAST(525600, GREATEST(15, COALESCE(v_payment.duracao_acesso_minutos, 1440)));
  v_valid_until := now() + make_interval(mins => v_duration);

  UPDATE public.gsa_calculator_pro_payments
     SET status = 'paid',
         transaction_nsu = p_transaction_nsu,
         invoice_slug = p_invoice_slug,
         receipt_url = p_receipt_url,
         capture_method = p_capture_method,
         paid_amount_centavos = p_paid_amount_centavos,
         paid_at = now(),
         raw_payload = COALESCE(v_payment.raw_payload, '{}'::jsonb)
           || jsonb_build_object('payment_confirmation', COALESCE(p_payload, '{}'::jsonb))
   WHERE id = v_payment.id;

  INSERT INTO public.gsa_calculator_pro_grants(
    tool_id,
    source,
    cliente_id,
    visitor_token_hash,
    reference_id,
    valid_until,
    observacoes
  ) VALUES (
    v_payment.tool_id,
    'payment',
    v_payment.cliente_id,
    CASE WHEN v_payment.cliente_id IS NULL THEN v_payment.visitor_token_hash ELSE NULL END,
    v_payment.id,
    v_valid_until,
    'Pagamento InfinitePay confirmado'
  )
  ON CONFLICT (reference_id) WHERE source = 'payment' AND reference_id IS NOT NULL
  DO UPDATE SET
    status = 'active',
    cliente_id = EXCLUDED.cliente_id,
    visitor_token_hash = EXCLUDED.visitor_token_hash,
    valid_until = EXCLUDED.valid_until
  RETURNING id INTO v_grant_id;

  INSERT INTO public.gsa_calculator_pro_events(
    event_type,
    tool_id,
    payment_id,
    grant_id,
    cliente_id,
    visitor_token_hash,
    details
  ) VALUES (
    'payment_confirmed',
    v_payment.tool_id,
    v_payment.id,
    v_grant_id,
    v_payment.cliente_id,
    CASE WHEN v_payment.cliente_id IS NULL THEN v_payment.visitor_token_hash ELSE NULL END,
    jsonb_build_object(
      'transaction_nsu', p_transaction_nsu,
      'capture_method', p_capture_method,
      'paid_amount_centavos', p_paid_amount_centavos,
      'duration_minutes', v_duration,
      'valid_until', v_valid_until
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'grant_id', v_grant_id,
    'duration_minutes', v_duration,
    'valid_until', v_valid_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_calculator_pro_snapshot(uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_save_calculator_pro_runtime_config(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_calculator_redeem_voucher_internal(text,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_calculator_finalize_payment_internal(text,text,text,text,text,integer,jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_admin_calculator_pro_snapshot(uuid,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_calculator_pro_runtime_config(uuid,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_calculator_redeem_voucher_internal(text,text,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_calculator_finalize_payment_internal(text,text,text,text,text,integer,jsonb)
  TO service_role;

COMMIT;
