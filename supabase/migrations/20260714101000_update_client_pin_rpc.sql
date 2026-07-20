CREATE OR REPLACE FUNCTION public.gsa_update_client_pin(
  p_sessao_id uuid,
  p_session_token text,
  p_new_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session record;
  v_cliente_id uuid;
  v_hash text;
BEGIN
  -- Validar a sessão
  SELECT * INTO v_session 
  FROM public.login_sessions
  WHERE id = p_sessao_id AND token = p_session_token AND status = 'ativa';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida ou expirada.');
  END IF;

  IF v_session.ator_tipo != 'cliente' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ação não permitida para este tipo de usuário.');
  END IF;

  v_cliente_id := v_session.ator_id;

  -- Gerar hash do novo PIN
  v_hash := extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10));

  -- Atualizar o PIN e resetar flags do cliente
  UPDATE public.clientes
  SET 
    pin_hash = v_hash,
    failed_login_attempts = 0,
    bloqueado = false,
    updated_at = now()
  WHERE id = v_cliente_id;

  RETURN jsonb_build_object('success', true, 'mensagem', 'PIN atualizado com sucesso.');
END;
$$;
