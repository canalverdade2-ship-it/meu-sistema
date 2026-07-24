BEGIN;

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.gsa_calculator_pro_products'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%tool_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.gsa_calculator_pro_products DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.gsa_calculator_pro_products
  ADD CONSTRAINT gsa_calculator_pro_products_tool_id_check
  CHECK (tool_id IN ('termination','retirement','vacation','thirteenth','benefits','bpc'));

INSERT INTO public.gsa_calculator_pro_products(
  tool_id,
  nome,
  ativo,
  preco_centavos,
  duracao_acesso_minutos,
  liberar_cliente_com_fatura_paga
) VALUES
  ('thirteenth', '13º salário Pro', true, 990, 1440, true),
  ('benefits', 'Benefícios do INSS Pro', true, 990, 1440, true),
  ('bpc', 'BPC / LOAS Pro', true, 990, 1440, true)
ON CONFLICT (tool_id) DO UPDATE
SET nome = EXCLUDED.nome,
    ativo = true,
    liberar_cliente_com_fatura_paga = true;

CREATE OR REPLACE FUNCTION public.gsa_admin_ensure_calculator_pro_products(
  p_sessao_id uuid,
  p_session_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  INSERT INTO public.gsa_calculator_pro_products(
    tool_id,
    nome,
    ativo,
    preco_centavos,
    duracao_acesso_minutos,
    liberar_cliente_com_fatura_paga
  ) VALUES
    ('termination', 'Rescisão trabalhista Pro', true, 990, 1440, true),
    ('retirement', 'Aposentadoria INSS Pro', true, 990, 1440, true),
    ('vacation', 'Cálculo de férias Pro', true, 990, 1440, true),
    ('thirteenth', '13º salário Pro', true, 990, 1440, true),
    ('benefits', 'Benefícios do INSS Pro', true, 990, 1440, true),
    ('bpc', 'BPC / LOAS Pro', true, 990, 1440, true)
  ON CONFLICT (tool_id) DO NOTHING;

  SELECT count(*)::integer
    INTO v_count
    FROM public.gsa_calculator_pro_products
   WHERE tool_id IN ('termination','retirement','vacation','thirteenth','benefits','bpc');

  RETURN jsonb_build_object('success', v_count = 6, 'count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_calculator_pro_product(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id NOT IN ('termination','retirement','vacation','thirteenth','benefits','bpc') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.gsa_calculator_pro_products
     SET ativo = COALESCE((p_payload->>'ativo')::boolean, ativo),
         preco_centavos = GREATEST(0, COALESCE((p_payload->>'preco_centavos')::integer, preco_centavos)),
         duracao_acesso_minutos = LEAST(525600, GREATEST(15, COALESCE((p_payload->>'duracao_acesso_minutos')::integer, duracao_acesso_minutos))),
         liberar_cliente_com_fatura_paga = true,
         gratuito_inicio = nullif(p_payload->>'gratuito_inicio','')::timestamptz,
         gratuito_fim = nullif(p_payload->>'gratuito_fim','')::timestamptz
   WHERE tool_id = p_tool_id
   RETURNING to_jsonb(gsa_calculator_pro_products.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Configuração não encontrada' USING ERRCODE = 'P0002';
  END IF;
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
  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation','thirteenth','benefits','bpc') THEN
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
        code_hash, code_hint, tool_id, expires_at, observacoes, created_by
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
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'code', v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_calculator_redeem_voucher_and_create_session_internal(
  p_code_hash text,
  p_tool_id text,
  p_visitor_hash text,
  p_cliente_id uuid,
  p_token_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_voucher public.gsa_calculator_pro_vouchers;
  v_product_active boolean;
  v_duration integer;
  v_valid_until timestamptz;
  v_grant_id uuid;
  v_session_id uuid;
  v_effective_visitor_hash text;
BEGIN
  IF p_tool_id NOT IN ('termination','retirement','vacation','thirteenth','benefits','bpc') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tool');
  END IF;
  IF nullif(btrim(COALESCE(p_token_hash, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_session_token');
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

  IF v_voucher.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_voucher'); END IF;
  IF v_voucher.status <> 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'voucher_unavailable'); END IF;
  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at <= now() THEN
    UPDATE public.gsa_calculator_pro_vouchers SET status = 'expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'voucher_expired');
  END IF;
  IF v_voucher.tool_id IS NOT NULL AND v_voucher.tool_id <> p_tool_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'voucher_wrong_tool');
  END IF;

  v_effective_visitor_hash := CASE WHEN p_cliente_id IS NULL THEN p_visitor_hash ELSE NULL END;
  v_duration := LEAST(525600, GREATEST(15, COALESCE(v_duration, 1440)));
  v_valid_until := now() + make_interval(mins => v_duration);

  UPDATE public.gsa_calculator_pro_vouchers
     SET status = 'used', used_at = now(), used_by_cliente_id = p_cliente_id, used_by_visitor_hash = v_effective_visitor_hash
   WHERE id = v_voucher.id;

  INSERT INTO public.gsa_calculator_pro_grants(
    tool_id, source, cliente_id, visitor_token_hash, reference_id,
    valid_until, max_uses, used_count, observacoes
  ) VALUES (
    p_tool_id, 'voucher', p_cliente_id, v_effective_visitor_hash, v_voucher.id,
    v_valid_until, 1, 1, 'Voucher de uma utilização'
  ) RETURNING id INTO v_grant_id;

  INSERT INTO public.gsa_calculator_pro_sessions(
    token_hash, tool_id, source, grant_id, cliente_id, visitor_token_hash, expires_at
  ) VALUES (
    p_token_hash, p_tool_id, 'voucher', v_grant_id, p_cliente_id, v_effective_visitor_hash, v_valid_until
  ) RETURNING id INTO v_session_id;

  INSERT INTO public.gsa_calculator_pro_events(
    event_type, tool_id, grant_id, cliente_id, visitor_token_hash, details
  ) VALUES
  ('voucher_redeemed', p_tool_id, v_grant_id, p_cliente_id, v_effective_visitor_hash, jsonb_build_object('voucher_id', v_voucher.id, 'duration_minutes', v_duration, 'valid_until', v_valid_until)),
  ('pro_session_started', p_tool_id, v_grant_id, p_cliente_id, v_effective_visitor_hash, jsonb_build_object('source', 'voucher', 'session_id', v_session_id, 'expires_at', v_valid_until));

  RETURN jsonb_build_object('success', true, 'grant_id', v_grant_id, 'session_id', v_session_id, 'expires_at', v_valid_until, 'duration_minutes', v_duration);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_ensure_calculator_pro_products(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_calculator_redeem_voucher_and_create_session_internal(text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_admin_ensure_calculator_pro_products(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_calculator_redeem_voucher_and_create_session_internal(text,text,text,uuid,text) TO service_role;

COMMIT;
