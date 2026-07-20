-- Update gsa_recuperar_senha_cliente to act as a login
CREATE OR REPLACE FUNCTION public.gsa_recuperar_senha_cliente(
  p_documento text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_record record;
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_email text := trim(lower(coalesce(p_email, '')));
  v_session jsonb;
BEGIN
  IF length(v_documento) < 11 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Documento inválido.');
  END IF;

  IF length(v_email) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail inválido.');
  END IF;

  -- Verify client exists and email matches
  SELECT id, nome, email, status
    INTO v_record
  FROM public.clientes
  WHERE regexp_replace(coalesce(cpf, cnpj, ''), '\D', '', 'g') = v_documento
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado.');
  END IF;

  IF trim(lower(coalesce(v_record.email, ''))) <> v_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail não corresponde ao cadastro.');
  END IF;

  -- Generate session with "precisa_trocar_senha" flag
  v_session := public.gsa_create_session_internal(
    'cliente', v_record.id, v_record.nome, '{"precisa_trocar_senha": true}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 
    'id', v_record.id,
    'nome', v_record.nome,
    'session', v_session
  );
END;
$$;

-- Create gsa_update_client_pin function
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
  v_actor record;
BEGIN
  -- Authenticate session
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF p_new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O PIN deve conter exatamente 4 dígitos.');
  END IF;

  -- Update PIN
  UPDATE public.clientes
     SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
         pin_tentativas = 0,
         pin_bloqueado = false,
         updated_at = now()
   WHERE id = v_actor.cliente_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Ensure permissions
REVOKE ALL ON FUNCTION public.gsa_update_client_pin(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_update_client_pin(uuid, text, text) TO anon, authenticated;
