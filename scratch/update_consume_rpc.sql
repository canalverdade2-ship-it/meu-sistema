
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

  -- Se a sessão veio de voucher, marca o grant como revoked
  IF v_session.grant_id IS NOT NULL THEN
    UPDATE public.gsa_calculator_pro_grants
       SET status = 'revoked'
     WHERE id = v_session.grant_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'consumed', true);
END;
$$;
