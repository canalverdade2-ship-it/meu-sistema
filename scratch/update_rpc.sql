
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
  v_code_hint text;
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

  v_code_hint := left(p_voucher_code, 11) || '...' || right(p_voucher_code, 3);

  -- Insere o voucher na tabela oficial de vouchers
  INSERT INTO public.gsa_calculator_pro_vouchers (
    tool_id,
    code_hash,
    code_hint,
    status,
    observacoes,
    expires_at
  ) VALUES (
    p_tool_id,
    p_voucher_hash,
    v_code_hint,
    'active',
    'Solicitado via WhatsApp: ' || v_clean_phone,
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
