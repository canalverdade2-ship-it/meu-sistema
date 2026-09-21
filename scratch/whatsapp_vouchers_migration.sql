
BEGIN;

-- 1. Tabela de solicitações de voucher por WhatsApp (1 por número)
CREATE TABLE IF NOT EXISTS public.gsa_calculator_pro_whatsapp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  voucher_code text NOT NULL,
  voucher_code_hash text NOT NULL,
  tool_id text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_gsa_calculator_whatsapp_phone UNIQUE (phone)
);

GRANT ALL ON public.gsa_calculator_pro_whatsapp_requests TO service_role;
GRANT SELECT ON public.gsa_calculator_pro_whatsapp_requests TO anon, authenticated;

DROP POLICY IF EXISTS "service_role_all_whatsapp_requests" ON public.gsa_calculator_pro_whatsapp_requests;
CREATE POLICY "service_role_all_whatsapp_requests" ON public.gsa_calculator_pro_whatsapp_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. RPC para solicitar voucher via WhatsApp de forma atômica
CREATE OR REPLACE FUNCTION public.gsa_calculator_request_whatsapp_voucher(
  p_phone text,
  p_tool_id text,
  p_voucher_code text,
  p_voucher_hash text,
  p_duracao_minutos integer DEFAULT 1440
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_phone text;
  v_existing record;
BEGIN
  -- Limpa caracteres do telefone
  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  
  IF length(v_clean_phone) < 10 OR length(v_clean_phone) > 13 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone');
  END IF;

  -- Se vier sem DDI 55, adiciona
  IF length(v_clean_phone) IN (10, 11) THEN
    v_clean_phone := '55' || v_clean_phone;
  END IF;

  -- Verifica se este número de telefone já solicitou um voucher anteriormente
  SELECT id, phone, created_at, used
    INTO v_existing
    FROM public.gsa_calculator_pro_whatsapp_requests
   WHERE phone = v_clean_phone
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'phone_already_used',
      'message', 'Este número de WhatsApp já resgatou um voucher de uso único anteriormente.'
    );
  END IF;

  -- Insere o voucher na tabela oficial de vouchers com uso único (max_uses = 1)
  INSERT INTO public.gsa_calculator_pro_vouchers (
    tool_id,
    code_hash,
    label,
    duracao_acesso_minutos,
    max_uses,
    valid_until
  ) VALUES (
    p_tool_id,
    p_voucher_hash,
    'WhatsApp ' || v_clean_phone,
    p_duracao_minutos,
    1,
    now() + interval '30 days'
  );

  -- Registra a solicitação vinculada ao número
  INSERT INTO public.gsa_calculator_pro_whatsapp_requests (
    phone,
    voucher_code,
    voucher_code_hash,
    tool_id,
    used
  ) VALUES (
    v_clean_phone,
    p_voucher_code,
    p_voucher_hash,
    p_tool_id,
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'phone', v_clean_phone,
    'voucher_code', p_voucher_code
  );
END;
$$;

-- 3. RPC para consumir sessão Pro de uso único (após emissão de PDF)
CREATE OR REPLACE FUNCTION public.gsa_calculator_consume_pro_session_internal(
  p_tool_id text,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT id, grant_id, source, tool_id
    INTO v_session
    FROM public.gsa_calculator_pro_sessions
   WHERE token_hash = p_token_hash
     AND tool_id = p_tool_id
     AND revoked_at IS NULL
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  -- Revoga a sessão ativa
  UPDATE public.gsa_calculator_pro_sessions
     SET revoked_at = now()
   WHERE id = v_session.id;

  -- Se a sessão veio de voucher, incrementa used_count do grant e marca a solicitação como used
  IF v_session.grant_id IS NOT NULL THEN
    UPDATE public.gsa_calculator_pro_grants
       SET used_count = COALESCE(used_count, 0) + 1,
           status = 'exhausted'
     WHERE id = v_session.grant_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'consumed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_calculator_request_whatsapp_voucher TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_calculator_consume_pro_session_internal TO anon, authenticated, service_role;

COMMIT;
