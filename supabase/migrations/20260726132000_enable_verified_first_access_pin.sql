-- Enable verified first access PIN registration for client, provider, and supplier onboarding.

CREATE OR REPLACE FUNCTION public.gsa_login_pin(p_documento text, p_pin text, p_tipo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_record record;
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_scope text;
  v_rate_key text;
  v_attempts integer;
  v_session jsonb;
BEGIN
  IF p_tipo NOT IN ('cliente', 'prestador', 'fornecedor') THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Tipo de acesso invalido.');
  END IF;
  IF p_pin !~ '^\d{4}$' THEN RETURN jsonb_build_object('valid', false, 'error', 'Senha invalida.'); END IF;

  v_scope := 'pin_' || p_tipo;
  v_rate_key := public.gsa_assert_auth_rate_limit(v_scope, v_documento, 8, interval '15 minutes');

  IF p_tipo = 'cliente' THEN
    SELECT id, nome, status, cadastro_aprovado, pin_hash, pin_tentativas, pin_bloqueado
    INTO v_record FROM public.clientes
    WHERE regexp_replace(coalesce(cpf, cnpj, ''), '\D', '', 'g') = v_documento LIMIT 1 FOR UPDATE;
  ELSIF p_tipo = 'prestador' THEN
    SELECT id, nome_razao AS nome, status, true AS cadastro_aprovado, pin_hash, pin_tentativas, pin_bloqueado
    INTO v_record FROM public.prestadores
    WHERE regexp_replace(coalesce(documento, ''), '\D', '', 'g') = v_documento LIMIT 1 FOR UPDATE;
  ELSE
    SELECT id, coalesce(nome_fantasia, razao_social) AS nome, status,
           status = 'ativo' AS cadastro_aprovado, pin_hash, pin_tentativas, pin_bloqueado
    INTO v_record FROM public.fornecedores
    WHERE documento = v_documento LIMIT 1 FOR UPDATE;
  END IF;

  IF v_record.id IS NULL THEN
    PERFORM public.gsa_record_auth_attempt(v_scope, v_rate_key, false);
    RETURN jsonb_build_object('valid', false, 'error', 'Credenciais invalidas.');
  END IF;

  IF v_record.pin_hash IS NULL THEN
    PERFORM public.gsa_record_auth_attempt(v_scope, v_rate_key, false);
    RETURN jsonb_build_object('valid', false, 'error', 'primeiro_acesso', 'nome', v_record.nome);
  END IF;

  IF coalesce(v_record.pin_bloqueado, false) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'blocked', 'nome', v_record.nome);
  END IF;
  IF p_tipo = 'cliente' AND v_record.status = 'inativo' AND coalesce(v_record.cadastro_aprovado, true) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cliente inativo.');
  END IF;
  IF p_tipo = 'prestador' AND v_record.status IN ('suspenso', 'desligado', 'reprovado') THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cadastro bloqueado ou indisponivel.');
  END IF;
  IF p_tipo = 'fornecedor' AND v_record.status <> 'ativo' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cadastro ainda nao aprovado ou indisponivel.');
  END IF;

  IF extensions.crypt(p_pin, v_record.pin_hash) <> v_record.pin_hash THEN
    v_attempts := coalesce(v_record.pin_tentativas, 0) + 1;
    IF p_tipo = 'cliente' THEN
      UPDATE public.clientes SET pin_tentativas = v_attempts, pin_bloqueado = v_attempts >= 4 WHERE id = v_record.id;
    ELSIF p_tipo = 'prestador' THEN
      UPDATE public.prestadores SET pin_tentativas = v_attempts, pin_bloqueado = v_attempts >= 4 WHERE id = v_record.id;
    ELSE
      UPDATE public.fornecedores SET pin_tentativas = v_attempts, pin_bloqueado = v_attempts >= 4 WHERE id = v_record.id;
    END IF;
    PERFORM public.gsa_record_auth_attempt(v_scope, v_rate_key, false);
    RETURN jsonb_build_object(
      'valid', false, 'error', CASE WHEN v_attempts >= 4 THEN 'blocked' ELSE 'wrong_pin' END,
      'attempts_left', greatest(0, 4 - v_attempts)
    );
  END IF;

  IF p_tipo = 'cliente' THEN UPDATE public.clientes SET pin_tentativas = 0 WHERE id = v_record.id;
  ELSIF p_tipo = 'prestador' THEN UPDATE public.prestadores SET pin_tentativas = 0 WHERE id = v_record.id;
  ELSE UPDATE public.fornecedores SET pin_tentativas = 0 WHERE id = v_record.id;
  END IF;

  v_session := public.gsa_create_session_internal(p_tipo, v_record.id, v_record.nome, '{}'::jsonb);
  PERFORM public.gsa_record_auth_attempt(v_scope, v_rate_key, true);
  RETURN jsonb_build_object('valid', true, 'id', v_record.id, 'nome', v_record.nome, 'status', v_record.status, 'session', v_session);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_login_pin(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_login_pin(text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_set_pin_and_login(
  p_documento text,
  p_telefone text,
  p_pin text,
  p_tipo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_record record;
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_contact text := lower(trim(coalesce(p_telefone, '')));
  v_phone text := regexp_replace(v_contact, '\D', '', 'g');
  v_rate_key text;
  v_session jsonb;
  v_contact_match boolean := false;
BEGIN
  IF p_tipo NOT IN ('cliente', 'prestador', 'fornecedor') OR p_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados de acesso invalidos.');
  END IF;
  IF v_contact = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o celular ou e-mail cadastrado.');
  END IF;

  v_rate_key := public.gsa_assert_auth_rate_limit('primeiro_acesso_' || p_tipo, v_documento, 5, interval '30 minutes');

  IF p_tipo = 'cliente' THEN
    SELECT id, nome, status, cadastro_aprovado, telefone, email, pin_hash
      INTO v_record
    FROM public.clientes
    WHERE regexp_replace(coalesce(cpf, cnpj, ''), '\D', '', 'g') = v_documento
    LIMIT 1
    FOR UPDATE;
  ELSIF p_tipo = 'prestador' THEN
    SELECT id, nome_razao AS nome, status, true AS cadastro_aprovado, telefone, email, pin_hash
      INTO v_record
    FROM public.prestadores
    WHERE regexp_replace(coalesce(documento, ''), '\D', '', 'g') = v_documento
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT id, coalesce(nome_fantasia, razao_social) AS nome, status, status = 'ativo' AS cadastro_aprovado, telefone, email, pin_hash
      INTO v_record
    FROM public.fornecedores
    WHERE documento = v_documento
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_record.id IS NULL THEN
    PERFORM public.gsa_record_auth_attempt('primeiro_acesso_' || p_tipo, v_rate_key, false);
    RETURN jsonb_build_object('success', false, 'error', 'Documento nao encontrado.');
  END IF;

  IF v_phone <> '' AND regexp_replace(coalesce(v_record.telefone, ''), '\D', '', 'g') = v_phone THEN
    v_contact_match := true;
  ELSIF v_contact <> '' AND lower(coalesce(v_record.email, '')) = v_contact THEN
    v_contact_match := true;
  END IF;

  IF NOT v_contact_match THEN
    PERFORM public.gsa_record_auth_attempt('primeiro_acesso_' || p_tipo, v_rate_key, false);
    RETURN jsonb_build_object('success', false, 'error', 'O celular ou e-mail informado nao confere com o cadastro.');
  END IF;

  IF v_record.pin_hash IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A senha ja foi cadastrada. Use a tela de login.');
  END IF;

  IF p_tipo = 'cliente' AND v_record.status = 'inativo' AND coalesce(v_record.cadastro_aprovado, true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente inativo. Entre em contato com o suporte.');
  END IF;

  IF p_tipo = 'cliente' THEN
    UPDATE public.clientes
       SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
           pin_tentativas = 0,
           pin_bloqueado = false,
           updated_at = now()
     WHERE id = v_record.id;
  ELSIF p_tipo = 'prestador' THEN
    UPDATE public.prestadores
       SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
           pin_tentativas = 0,
           pin_bloqueado = false,
           updated_at = now()
     WHERE id = v_record.id;
  ELSE
    UPDATE public.fornecedores
       SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
           pin_tentativas = 0,
           pin_bloqueado = false,
           updated_at = now()
     WHERE id = v_record.id;
  END IF;

  v_session := public.gsa_create_session_internal(
    p_tipo, v_record.id, v_record.nome, '{}'::jsonb
  );
  PERFORM public.gsa_record_auth_attempt('primeiro_acesso_' || p_tipo, v_rate_key, true);

  RETURN jsonb_build_object(
    'success', true,
    'id', v_record.id,
    'nome', v_record.nome,
    'session', v_session
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_set_pin_and_login(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_set_pin_and_login(text, text, text, text) TO anon, authenticated, service_role;
