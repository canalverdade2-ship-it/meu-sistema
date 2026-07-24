BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gsa_calculator_pro_products (
  tool_id text PRIMARY KEY CHECK (tool_id IN ('termination','retirement','vacation')),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  preco_centavos integer NOT NULL DEFAULT 990 CHECK (preco_centavos >= 0),
  duracao_acesso_minutos integer NOT NULL DEFAULT 1440 CHECK (duracao_acesso_minutos BETWEEN 15 AND 525600),
  liberar_cliente_com_fatura_paga boolean NOT NULL DEFAULT true,
  gratuito_inicio timestamptz,
  gratuito_fim timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gratuito_fim IS NULL OR gratuito_inicio IS NULL OR gratuito_fim > gratuito_inicio)
);

INSERT INTO public.gsa_calculator_pro_products (
  tool_id, nome, ativo, preco_centavos, duracao_acesso_minutos, liberar_cliente_com_fatura_paga
) VALUES
  ('termination', 'Rescisão trabalhista Pro', true, 990, 1440, true),
  ('retirement', 'Aposentadoria INSS Pro', true, 990, 1440, true),
  ('vacation', 'Cálculo de férias Pro', true, 990, 1440, true)
ON CONFLICT (tool_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.gsa_calculator_pro_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_nsu text NOT NULL UNIQUE,
  tool_id text NOT NULL REFERENCES public.gsa_calculator_pro_products(tool_id),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  visitor_token_hash text,
  valor_centavos integer NOT NULL CHECK (valor_centavos >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','cancelled','refunded')),
  checkout_url text,
  transaction_nsu text,
  invoice_slug text,
  receipt_url text,
  capture_method text,
  paid_amount_centavos integer,
  paid_at timestamptz,
  expires_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cliente_id IS NOT NULL OR visitor_token_hash IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_gsa_calculator_pro_payments_status
  ON public.gsa_calculator_pro_payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_calculator_pro_payments_client
  ON public.gsa_calculator_pro_payments(cliente_id, tool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_calculator_pro_payments_visitor
  ON public.gsa_calculator_pro_payments(visitor_token_hash, tool_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gsa_calculator_pro_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  code_hint text NOT NULL,
  tool_id text REFERENCES public.gsa_calculator_pro_products(tool_id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','cancelled','expired')),
  expires_at timestamptz,
  used_at timestamptz,
  used_by_cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  used_by_visitor_hash text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsa_calculator_pro_vouchers_status
  ON public.gsa_calculator_pro_vouchers(status, expires_at);

CREATE TABLE IF NOT EXISTS public.gsa_calculator_pro_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id text NOT NULL REFERENCES public.gsa_calculator_pro_products(tool_id),
  source text NOT NULL CHECK (source IN ('payment','voucher','manual','client_paid_invoice','free_period')),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  visitor_token_hash text,
  reference_id uuid,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cliente_id IS NOT NULL OR visitor_token_hash IS NOT NULL),
  CHECK (max_uses IS NULL OR used_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_gsa_calculator_pro_grants_client
  ON public.gsa_calculator_pro_grants(cliente_id, tool_id, status, valid_until);
CREATE INDEX IF NOT EXISTS idx_gsa_calculator_pro_grants_visitor
  ON public.gsa_calculator_pro_grants(visitor_token_hash, tool_id, status, valid_until);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gsa_calculator_pro_payment_grant_unique
  ON public.gsa_calculator_pro_grants(reference_id)
  WHERE source = 'payment' AND reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gsa_calculator_pro_voucher_grant_unique
  ON public.gsa_calculator_pro_grants(reference_id)
  WHERE source = 'voucher' AND reference_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gsa_calculator_pro_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  tool_id text NOT NULL REFERENCES public.gsa_calculator_pro_products(tool_id),
  source text NOT NULL,
  grant_id uuid REFERENCES public.gsa_calculator_pro_grants(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  visitor_token_hash text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cliente_id IS NOT NULL OR visitor_token_hash IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_gsa_calculator_pro_sessions_access
  ON public.gsa_calculator_pro_sessions(tool_id, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS public.gsa_calculator_pro_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  tool_id text,
  payment_id uuid REFERENCES public.gsa_calculator_pro_payments(id) ON DELETE SET NULL,
  grant_id uuid REFERENCES public.gsa_calculator_pro_grants(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  visitor_token_hash text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gsa_calculator_pro_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_calculator_pro_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_calculator_pro_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_calculator_pro_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_calculator_pro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_calculator_pro_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gsa_calculator_pro_products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gsa_calculator_pro_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gsa_calculator_pro_vouchers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gsa_calculator_pro_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gsa_calculator_pro_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gsa_calculator_pro_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_calculator_pro_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_calculator_pro_products_updated_at ON public.gsa_calculator_pro_products;
CREATE TRIGGER trg_gsa_calculator_pro_products_updated_at
BEFORE UPDATE ON public.gsa_calculator_pro_products
FOR EACH ROW EXECUTE FUNCTION public.gsa_calculator_pro_touch_updated_at();

DROP TRIGGER IF EXISTS trg_gsa_calculator_pro_payments_updated_at ON public.gsa_calculator_pro_payments;
CREATE TRIGGER trg_gsa_calculator_pro_payments_updated_at
BEFORE UPDATE ON public.gsa_calculator_pro_payments
FOR EACH ROW EXECUTE FUNCTION public.gsa_calculator_pro_touch_updated_at();

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
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.tool_id), '[]'::jsonb)
    INTO v_products
    FROM public.gsa_calculator_pro_products p;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'code_hint', v.code_hint,
    'tool_id', v.tool_id,
    'status', v.status,
    'expires_at', v.expires_at,
    'used_at', v.used_at,
    'used_by_cliente_id', v.used_by_cliente_id,
    'used_by_cliente_nome', c.nome,
    'observacoes', v.observacoes,
    'created_at', v.created_at
  ) ORDER BY v.created_at DESC), '[]'::jsonb)
    INTO v_vouchers
    FROM (
      SELECT * FROM public.gsa_calculator_pro_vouchers ORDER BY created_at DESC LIMIT 200
    ) v
    LEFT JOIN public.clientes c ON c.id = v.used_by_cliente_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'order_nsu', p.order_nsu,
    'tool_id', p.tool_id,
    'cliente_id', p.cliente_id,
    'cliente_nome', c.nome,
    'valor_centavos', p.valor_centavos,
    'status', p.status,
    'capture_method', p.capture_method,
    'paid_at', p.paid_at,
    'created_at', p.created_at
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO v_payments
    FROM (
      SELECT * FROM public.gsa_calculator_pro_payments ORDER BY created_at DESC LIMIT 200
    ) p
    LEFT JOIN public.clientes c ON c.id = p.cliente_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'tool_id', g.tool_id,
    'source', g.source,
    'cliente_id', g.cliente_id,
    'cliente_nome', c.nome,
    'valid_from', g.valid_from,
    'valid_until', g.valid_until,
    'max_uses', g.max_uses,
    'used_count', g.used_count,
    'status', g.status,
    'observacoes', g.observacoes,
    'created_at', g.created_at
  ) ORDER BY g.created_at DESC), '[]'::jsonb)
    INTO v_grants
    FROM (
      SELECT * FROM public.gsa_calculator_pro_grants ORDER BY created_at DESC LIMIT 200
    ) g
    LEFT JOIN public.clientes c ON c.id = g.cliente_id;

  RETURN jsonb_build_object(
    'products', v_products,
    'vouchers', v_vouchers,
    'payments', v_payments,
    'grants', v_grants
  );
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
  IF p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.gsa_calculator_pro_products
     SET ativo = COALESCE((p_payload->>'ativo')::boolean, ativo),
         preco_centavos = GREATEST(0, COALESCE((p_payload->>'preco_centavos')::integer, preco_centavos)),
         duracao_acesso_minutos = LEAST(525600, GREATEST(15, COALESCE((p_payload->>'duracao_acesso_minutos')::integer, duracao_acesso_minutos))),
         liberar_cliente_com_fatura_paga = COALESCE((p_payload->>'liberar_cliente_com_fatura_paga')::boolean, liberar_cliente_com_fatura_paga),
         gratuito_inicio = nullif(p_payload->>'gratuito_inicio','')::timestamptz,
         gratuito_fim = nullif(p_payload->>'gratuito_fim','')::timestamptz
   WHERE tool_id = p_tool_id
   RETURNING to_jsonb(gsa_calculator_pro_products.*) INTO v_result;

  IF v_result IS NULL THEN RAISE EXCEPTION 'Configuração não encontrada' USING ERRCODE = 'P0002'; END IF;
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
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A validade precisa estar no futuro' USING ERRCODE = '22023';
  END IF;

  v_code := 'GSA-PRO-' || upper(encode(gen_random_bytes(5), 'hex'));
  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  INSERT INTO public.gsa_calculator_pro_vouchers (
    code_hash, code_hint, tool_id, expires_at, observacoes, created_by
  ) VALUES (
    encode(digest(upper(v_code), 'sha256'), 'hex'),
    right(v_code, 6),
    p_tool_id,
    p_expires_at,
    nullif(btrim(p_observacoes), ''),
    v_actor
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'code', v_code);
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
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_status NOT IN ('active','cancelled') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gsa_calculator_pro_vouchers
     SET status = p_status
   WHERE id = p_voucher_id AND status NOT IN ('used','expired');
  RETURN jsonb_build_object('success', FOUND);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_search_calculator_pro_clients(
  p_sessao_id uuid,
  p_session_token text,
  p_query text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query text := '%' || lower(regexp_replace(COALESCE(p_query,''), '[^a-zA-Z0-9À-ÿ ]', '', 'g')) || '%';
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'codigo_cliente', c.codigo_cliente,
    'nome', c.nome,
    'cpf', c.cpf,
    'cnpj', c.cnpj,
    'status', c.status,
    'has_paid_invoice', EXISTS (
      SELECT 1 FROM public.faturas f WHERE f.cliente_id = c.id AND f.status = 'pago'
    )
  ) ORDER BY c.nome), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT * FROM public.clientes c0
       WHERE lower(COALESCE(c0.nome,'')) LIKE v_query
          OR lower(COALESCE(c0.codigo_cliente,'')) LIKE v_query
          OR regexp_replace(COALESCE(c0.cpf,''), '\D', '', 'g') LIKE '%' || regexp_replace(COALESCE(p_query,''), '\D', '', 'g') || '%'
          OR regexp_replace(COALESCE(c0.cnpj,''), '\D', '', 'g') LIKE '%' || regexp_replace(COALESCE(p_query,''), '\D', '', 'g') || '%'
       ORDER BY c0.nome
       LIMIT 25
    ) c;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_grant_calculator_pro(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_tool_id text,
  p_valid_until timestamptz,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id NOT IN ('termination','retirement','vacation') THEN RAISE EXCEPTION 'Calculadora inválida'; END IF;
  IF p_valid_until IS NULL OR p_valid_until <= now() THEN RAISE EXCEPTION 'A validade precisa estar no futuro'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  BEGIN SELECT public.gsa_current_actor_id() INTO v_actor; EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;

  INSERT INTO public.gsa_calculator_pro_grants (
    tool_id, source, cliente_id, valid_until, observacoes, created_by
  ) VALUES (
    p_tool_id, 'manual', p_cliente_id, p_valid_until, nullif(btrim(p_observacoes), ''), v_actor
  ) RETURNING id INTO v_id;

  INSERT INTO public.gsa_calculator_pro_events(event_type, tool_id, grant_id, cliente_id, details)
  VALUES ('manual_grant_created', p_tool_id, v_id, p_cliente_id, jsonb_build_object('valid_until', p_valid_until));

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_revoke_calculator_pro_grant(
  p_sessao_id uuid,
  p_session_token text,
  p_grant_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grant public.gsa_calculator_pro_grants;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  UPDATE public.gsa_calculator_pro_grants
     SET status = 'revoked', observacoes = concat_ws(' | ', observacoes, nullif(btrim(p_reason), ''))
   WHERE id = p_grant_id AND status = 'active'
   RETURNING * INTO v_grant;
  IF v_grant.id IS NOT NULL THEN
    UPDATE public.gsa_calculator_pro_sessions SET revoked_at = now() WHERE grant_id = v_grant.id AND revoked_at IS NULL;
    INSERT INTO public.gsa_calculator_pro_events(event_type, tool_id, grant_id, cliente_id, visitor_token_hash, details)
    VALUES ('grant_revoked', v_grant.tool_id, v_grant.id, v_grant.cliente_id, v_grant.visitor_token_hash, jsonb_build_object('reason', p_reason));
  END IF;
  RETURN jsonb_build_object('success', v_grant.id IS NOT NULL);
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
BEGIN
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

  UPDATE public.gsa_calculator_pro_vouchers
     SET status = 'used', used_at = now(), used_by_cliente_id = p_cliente_id, used_by_visitor_hash = p_visitor_hash
   WHERE id = v_voucher.id;

  INSERT INTO public.gsa_calculator_pro_grants (
    tool_id, source, cliente_id, visitor_token_hash, reference_id,
    valid_until, max_uses, observacoes
  ) VALUES (
    p_tool_id, 'voucher', p_cliente_id, p_visitor_hash, v_voucher.id,
    now() + interval '2 hours', 1, 'Voucher de uma utilização'
  ) RETURNING id INTO v_grant_id;

  INSERT INTO public.gsa_calculator_pro_events(event_type, tool_id, grant_id, cliente_id, visitor_token_hash, details)
  VALUES ('voucher_redeemed', p_tool_id, v_grant_id, p_cliente_id, p_visitor_hash, jsonb_build_object('voucher_id', v_voucher.id));

  RETURN jsonb_build_object('success', true, 'grant_id', v_grant_id, 'valid_until', now() + interval '2 hours');
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
BEGIN
  SELECT * INTO v_payment
    FROM public.gsa_calculator_pro_payments
   WHERE order_nsu = p_order_nsu
   FOR UPDATE;

  IF v_payment.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'payment_not_found'); END IF;
  IF v_payment.status = 'paid' THEN
    SELECT id INTO v_grant_id FROM public.gsa_calculator_pro_grants WHERE source='payment' AND reference_id=v_payment.id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'grant_id', v_grant_id);
  END IF;
  IF COALESCE(p_paid_amount_centavos, 0) < v_payment.valor_centavos THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_mismatch');
  END IF;

  SELECT duracao_acesso_minutos INTO v_duration
    FROM public.gsa_calculator_pro_products WHERE tool_id = v_payment.tool_id;

  UPDATE public.gsa_calculator_pro_payments
     SET status = 'paid', transaction_nsu = p_transaction_nsu, invoice_slug = p_invoice_slug,
         receipt_url = p_receipt_url, capture_method = p_capture_method,
         paid_amount_centavos = p_paid_amount_centavos, paid_at = now(), raw_payload = COALESCE(p_payload, '{}'::jsonb)
   WHERE id = v_payment.id;

  INSERT INTO public.gsa_calculator_pro_grants (
    tool_id, source, cliente_id, visitor_token_hash, reference_id, valid_until, observacoes
  ) VALUES (
    v_payment.tool_id, 'payment', v_payment.cliente_id, v_payment.visitor_token_hash,
    v_payment.id, now() + make_interval(mins => COALESCE(v_duration, 1440)), 'Pagamento InfinitePay confirmado'
  )
  ON CONFLICT (reference_id) WHERE source = 'payment' AND reference_id IS NOT NULL
  DO UPDATE SET status='active', valid_until=EXCLUDED.valid_until
  RETURNING id INTO v_grant_id;

  INSERT INTO public.gsa_calculator_pro_events(event_type, tool_id, payment_id, grant_id, cliente_id, visitor_token_hash, details)
  VALUES ('payment_confirmed', v_payment.tool_id, v_payment.id, v_grant_id, v_payment.cliente_id, v_payment.visitor_token_hash,
    jsonb_build_object('transaction_nsu', p_transaction_nsu, 'capture_method', p_capture_method, 'paid_amount_centavos', p_paid_amount_centavos));

  RETURN jsonb_build_object('success', true, 'grant_id', v_grant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_calculator_create_session_internal(
  p_tool_id text,
  p_visitor_hash text,
  p_cliente_id uuid,
  p_source text,
  p_grant_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grant public.gsa_calculator_pro_grants;
  v_session_id uuid;
BEGIN
  IF p_grant_id IS NOT NULL THEN
    SELECT * INTO v_grant FROM public.gsa_calculator_pro_grants WHERE id = p_grant_id FOR UPDATE;
    IF v_grant.id IS NULL OR v_grant.status <> 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'grant_unavailable'); END IF;
    IF v_grant.valid_from > now() OR (v_grant.valid_until IS NOT NULL AND v_grant.valid_until <= now()) THEN RETURN jsonb_build_object('success', false, 'error', 'grant_expired'); END IF;
    IF v_grant.tool_id <> p_tool_id THEN RETURN jsonb_build_object('success', false, 'error', 'grant_wrong_tool'); END IF;
    IF v_grant.cliente_id IS NOT NULL AND v_grant.cliente_id IS DISTINCT FROM p_cliente_id THEN RETURN jsonb_build_object('success', false, 'error', 'grant_identity_mismatch'); END IF;
    IF v_grant.visitor_token_hash IS NOT NULL AND v_grant.visitor_token_hash IS DISTINCT FROM p_visitor_hash THEN RETURN jsonb_build_object('success', false, 'error', 'grant_identity_mismatch'); END IF;
    IF v_grant.max_uses IS NOT NULL AND v_grant.used_count >= v_grant.max_uses THEN RETURN jsonb_build_object('success', false, 'error', 'grant_usage_exhausted'); END IF;
    IF v_grant.max_uses IS NOT NULL THEN
      UPDATE public.gsa_calculator_pro_grants SET used_count = used_count + 1 WHERE id = v_grant.id;
    END IF;
  END IF;

  INSERT INTO public.gsa_calculator_pro_sessions (
    token_hash, tool_id, source, grant_id, cliente_id, visitor_token_hash, expires_at
  ) VALUES (
    p_token_hash, p_tool_id, p_source, p_grant_id, p_cliente_id, p_visitor_hash, p_expires_at
  ) RETURNING id INTO v_session_id;

  INSERT INTO public.gsa_calculator_pro_events(event_type, tool_id, grant_id, cliente_id, visitor_token_hash, details)
  VALUES ('pro_session_started', p_tool_id, p_grant_id, p_cliente_id, p_visitor_hash,
    jsonb_build_object('source', p_source, 'session_id', v_session_id, 'expires_at', p_expires_at));

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id, 'expires_at', p_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_calculator_pro_snapshot(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_search_calculator_pro_clients(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_grant_calculator_pro(uuid,text,uuid,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_revoke_calculator_pro_grant(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_calculator_redeem_voucher_internal(text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_calculator_finalize_payment_internal(text,text,text,text,text,integer,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_calculator_create_session_internal(text,text,uuid,text,uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_admin_calculator_pro_snapshot(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid,text,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_search_calculator_pro_clients(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_grant_calculator_pro(uuid,text,uuid,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_revoke_calculator_pro_grant(uuid,text,uuid,text) TO authenticated;

COMMIT;
