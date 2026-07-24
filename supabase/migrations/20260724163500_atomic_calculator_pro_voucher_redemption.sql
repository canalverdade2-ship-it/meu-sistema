BEGIN;

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
  IF p_tool_id NOT IN ('termination','retirement','vacation') THEN
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

  v_effective_visitor_hash := CASE WHEN p_cliente_id IS NULL THEN p_visitor_hash ELSE NULL END;
  v_duration := LEAST(525600, GREATEST(15, COALESCE(v_duration, 1440)));
  v_valid_until := now() + make_interval(mins => v_duration);

  UPDATE public.gsa_calculator_pro_vouchers
     SET status = 'used',
         used_at = now(),
         used_by_cliente_id = p_cliente_id,
         used_by_visitor_hash = v_effective_visitor_hash
   WHERE id = v_voucher.id;

  INSERT INTO public.gsa_calculator_pro_grants(
    tool_id,
    source,
    cliente_id,
    visitor_token_hash,
    reference_id,
    valid_until,
    max_uses,
    used_count,
    observacoes
  ) VALUES (
    p_tool_id,
    'voucher',
    p_cliente_id,
    v_effective_visitor_hash,
    v_voucher.id,
    v_valid_until,
    1,
    1,
    'Voucher de uma utilização'
  ) RETURNING id INTO v_grant_id;

  INSERT INTO public.gsa_calculator_pro_sessions(
    token_hash,
    tool_id,
    source,
    grant_id,
    cliente_id,
    visitor_token_hash,
    expires_at
  ) VALUES (
    p_token_hash,
    p_tool_id,
    'voucher',
    v_grant_id,
    p_cliente_id,
    v_effective_visitor_hash,
    v_valid_until
  ) RETURNING id INTO v_session_id;

  INSERT INTO public.gsa_calculator_pro_events(
    event_type,
    tool_id,
    grant_id,
    cliente_id,
    visitor_token_hash,
    details
  ) VALUES
  (
    'voucher_redeemed',
    p_tool_id,
    v_grant_id,
    p_cliente_id,
    v_effective_visitor_hash,
    jsonb_build_object(
      'voucher_id', v_voucher.id,
      'duration_minutes', v_duration,
      'valid_until', v_valid_until
    )
  ),
  (
    'pro_session_started',
    p_tool_id,
    v_grant_id,
    p_cliente_id,
    v_effective_visitor_hash,
    jsonb_build_object(
      'source', 'voucher',
      'session_id', v_session_id,
      'expires_at', v_valid_until
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'grant_id', v_grant_id,
    'session_id', v_session_id,
    'expires_at', v_valid_until,
    'duration_minutes', v_duration
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_calculator_redeem_voucher_internal(text,text,text,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.gsa_calculator_redeem_voucher_and_create_session_internal(text,text,text,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_calculator_redeem_voucher_and_create_session_internal(text,text,text,uuid,text)
  TO service_role;

COMMIT;
