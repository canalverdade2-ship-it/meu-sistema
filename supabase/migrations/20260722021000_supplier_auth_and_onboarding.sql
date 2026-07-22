-- Autenticacao, pre-cadastro e armazenamento privado do fornecedor.

BEGIN;

-- Inclui o novo ator nas restricoes centrais sem depender do nome historico
-- gerado para cada CHECK constraint.
DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.gsa_auth_identities'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%ator_tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.gsa_auth_identities DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;

  ALTER TABLE public.gsa_auth_identities
    ADD CONSTRAINT gsa_auth_identities_ator_tipo_check
    CHECK (ator_tipo IN ('admin', 'colaborador', 'cliente', 'prestador', 'fornecedor'));

  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.sistema_sessoes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%ator_tipo%'
  LOOP
    EXECUTE format('ALTER TABLE public.sistema_sessoes DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;

  ALTER TABLE public.sistema_sessoes
    ADD CONSTRAINT sistema_sessoes_ator_tipo_check
    CHECK (ator_tipo IN ('admin', 'colaborador', 'cliente', 'prestador', 'fornecedor'));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provision_auth_identity_internal(
  p_ator_tipo text,
  p_ator_id uuid,
  p_ator_nome text,
  p_sessao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_identity public.gsa_auth_identities%rowtype;
  v_password text;
  v_app_metadata jsonb;
  v_user_metadata jsonb;
BEGIN
  IF p_ator_tipo NOT IN ('admin', 'colaborador', 'cliente', 'prestador', 'fornecedor')
     OR p_ator_id IS NULL OR p_sessao_id IS NULL THEN
    RAISE EXCEPTION 'Identidade GSA invalida.';
  END IF;

  INSERT INTO public.gsa_auth_identities(ator_tipo, ator_id, auth_email)
  VALUES (p_ator_tipo, p_ator_id, lower(p_ator_tipo || '-' || replace(p_ator_id::text, '-', '') || '@auth.gsa.local'))
  ON CONFLICT (ator_tipo, ator_id) DO UPDATE SET atualizado_em = now()
  RETURNING * INTO v_identity;

  v_password := encode(extensions.gen_random_bytes(32), 'hex') || 'aA1!';
  v_app_metadata := jsonb_build_object(
    'provider', 'email', 'providers', jsonb_build_array('email'),
    'gsa_actor_type', p_ator_tipo, 'gsa_actor_id', p_ator_id::text,
    'gsa_session_id', p_sessao_id::text
  );
  v_user_metadata := jsonb_build_object('name', coalesce(nullif(trim(p_ator_nome), ''), 'Usuario GSA'));

  DELETE FROM auth.refresh_tokens WHERE user_id = v_identity.auth_user_id::text;
  DELETE FROM auth.sessions WHERE user_id = v_identity.auth_user_id;

  INSERT INTO auth.users(
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, reauthentication_token, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, v_identity.auth_user_id,
    'authenticated', 'authenticated', v_identity.auth_email,
    extensions.crypt(v_password, extensions.gen_salt('bf', 12)), now(),
    v_app_metadata, v_user_metadata, now(), now(), '', '', '', '', '', '', false, false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now(), banned_until = NULL, deleted_at = NULL,
    is_sso_user = false, is_anonymous = false;

  INSERT INTO auth.identities(provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_identity.auth_user_id::text, v_identity.auth_user_id,
    jsonb_build_object('sub', v_identity.auth_user_id::text, 'email', v_identity.auth_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE SET
    user_id = excluded.user_id, identity_data = excluded.identity_data,
    last_sign_in_at = now(), updated_at = now();

  RETURN jsonb_build_object('user_id', v_identity.auth_user_id, 'email', v_identity.auth_email, 'password', v_password);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_provision_auth_identity_internal(text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_create_session_internal(
  p_ator_tipo text,
  p_ator_id uuid,
  p_ator_nome text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_token text;
  v_sessao_id uuid;
  v_auth jsonb;
BEGIN
  IF p_ator_tipo NOT IN ('admin', 'colaborador', 'cliente', 'prestador', 'fornecedor') THEN
    RAISE EXCEPTION 'Tipo de ator invalido.';
  END IF;
  IF p_ator_id IS NULL THEN RAISE EXCEPTION 'Ator obrigatorio.'; END IF;

  UPDATE public.sistema_sessoes
  SET status = 'encerrado', encerrado_em = coalesce(encerrado_em, now())
  WHERE ator_id = p_ator_id AND ator_tipo = p_ator_tipo AND status = 'ativo';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.sistema_sessoes(ator_tipo, ator_id, ator_nome, status, token_hash, token_hint, origem, metadata)
  VALUES (
    p_ator_tipo, p_ator_id, coalesce(nullif(trim(p_ator_nome), ''), 'Usuario'), 'ativo',
    public.gsa_hash_session_token(v_token), left(v_token, 8),
    'login_atomico_supabase_auth', coalesce(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_sessao_id;

  v_auth := public.gsa_provision_auth_identity_internal(p_ator_tipo, p_ator_id, p_ator_nome, v_sessao_id);
  RETURN jsonb_build_object(
    'sessao_id', v_sessao_id, 'session_token', v_token,
    'ator_tipo', p_ator_tipo, 'ator_id', p_ator_id,
    'ator_nome', coalesce(nullif(trim(p_ator_nome), ''), 'Usuario'),
    'metadata', coalesce(p_metadata, '{}'::jsonb), 'auth', v_auth
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_create_session_internal(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Login por PIN ampliado para fornecedor. A Edge Function continua sendo o
-- gateway de rate limit; o RPC tambem conserva o bloqueio por tentativas.
CREATE OR REPLACE FUNCTION public.gsa_login_pin(p_documento text, p_pin text, p_tipo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  IF v_record.id IS NULL OR v_record.pin_hash IS NULL THEN
    PERFORM public.gsa_record_auth_attempt(v_scope, v_rate_key, false);
    RETURN jsonb_build_object('valid', false, 'error', 'Credenciais invalidas.');
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

CREATE OR REPLACE FUNCTION public.gsa_public_register_supplier(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_type text := lower(trim(coalesce(v_payload->>'tipo_pessoa', '')));
  v_document text := regexp_replace(coalesce(v_payload->>'documento', ''), '\D', '', 'g');
  v_name text := trim(coalesce(v_payload->>'razao_social', ''));
  v_responsible text := trim(coalesce(v_payload->>'responsavel_nome', ''));
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_zip text := regexp_replace(coalesce(v_payload->>'cep', ''), '\D', '', 'g');
  v_id uuid;
BEGIN
  IF pg_column_size(v_payload) > 24576 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  PERFORM public.gsa_assert_public_rate_limit('cadastro_fornecedor_ip', 'cadastro', 5, interval '1 hour');
  PERFORM public.gsa_assert_public_rate_limit('cadastro_fornecedor_documento', v_document, 3, interval '1 hour');

  IF v_type NOT IN ('pf', 'pj') THEN RAISE EXCEPTION 'Tipo de pessoa invalido.'; END IF;
  IF v_type = 'pf' AND NOT public.gsa_is_valid_cpf(v_document) THEN RAISE EXCEPTION 'CPF invalido.'; END IF;
  IF v_type = 'pj' AND NOT public.gsa_is_valid_cnpj(v_document) THEN RAISE EXCEPTION 'CNPJ invalido.'; END IF;
  IF length(v_name) < 3 OR length(v_name) > 180 THEN RAISE EXCEPTION 'Informe o nome ou razao social.'; END IF;
  IF length(v_responsible) < 3 OR length(v_responsible) > 180 THEN RAISE EXCEPTION 'Informe o responsavel.'; END IF;
  IF length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail invalido.'; END IF;
  IF length(v_phone) NOT IN (10, 11) THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF v_zip <> '' AND length(v_zip) <> 8 THEN RAISE EXCEPTION 'CEP invalido.'; END IF;
  IF EXISTS (SELECT 1 FROM public.fornecedores WHERE documento = v_document) THEN RAISE EXCEPTION 'Este documento ja esta cadastrado.'; END IF;

  INSERT INTO public.fornecedores(
    tipo_pessoa, documento, razao_social, nome_fantasia, inscricao_estadual,
    responsavel_nome, email, telefone, cep, endereco, numero, complemento,
    bairro, cidade, estado, observacoes, status
  ) VALUES (
    v_type, v_document, v_name, nullif(trim(v_payload->>'nome_fantasia'), ''),
    nullif(trim(v_payload->>'inscricao_estadual'), ''), v_responsible, v_email, v_phone,
    nullif(v_zip, ''), nullif(trim(v_payload->>'endereco'), ''), nullif(trim(v_payload->>'numero'), ''),
    nullif(trim(v_payload->>'complemento'), ''), nullif(trim(v_payload->>'bairro'), ''),
    nullif(trim(v_payload->>'cidade'), ''), nullif(upper(trim(v_payload->>'estado')), ''),
    nullif(trim(v_payload->>'observacoes'), ''), 'pendente'
  ) RETURNING id INTO v_id;

  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, acao, entidade, entidade_id, detalhes)
  VALUES (v_id, 'publico', 'PRE_CADASTRO', 'fornecedores', v_id, jsonb_build_object('documento_final', right(v_document, 4)));

  INSERT INTO public.notificacoes(titulo, mensagem, modulo, tab, item_id, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES (
    'Novo fornecedor aguardando analise', v_name || ' enviou um pre-cadastro.',
    'fornecedores', 'cadastros', v_id::text, 'sistema', 'admin', 'alta',
    'cadastro_fornecedor', jsonb_build_object('fornecedor_id', v_id)
  );

  RETURN jsonb_build_object('success', true, 'fornecedor_id', v_id, 'status', 'pendente');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_register_supplier(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_register_supplier(jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_assert_current_supplier()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_supplier_id uuid;
BEGIN
  IF public.gsa_current_actor_type() <> 'fornecedor' OR NOT public.gsa_jwt_session_is_valid() THEN
    RAISE EXCEPTION 'Sessao do fornecedor invalida ou expirada.';
  END IF;
  v_supplier_id := public.gsa_current_actor_id();
  IF v_supplier_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.fornecedores WHERE id = v_supplier_id AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Fornecedor sem acesso ativo.';
  END IF;
  RETURN v_supplier_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_assert_current_supplier() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_supplier_session_access_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
  v_supplier public.fornecedores%rowtype;
BEGIN
  SELECT * INTO v_supplier FROM public.fornecedores WHERE id = v_id;
  RETURN jsonb_build_object(
    'success', true, 'supplier_id', v_supplier.id,
    'supplier_name', coalesce(v_supplier.nome_fantasia, v_supplier.razao_social),
    'status', v_supplier.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_supplier_session_access_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_session_access_state() TO authenticated;

-- Politicas do bucket: fornecedor somente em sua propria pasta; equipe com
-- permissao do modulo pode ler os documentos para conferencia.
CREATE OR REPLACE FUNCTION public.gsa_supplier_document_allowed(p_name text, p_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_owner text := split_part(coalesce(p_name, ''), '/', 1);
  v_type text := public.gsa_current_actor_type();
BEGIN
  IF v_type = 'fornecedor' THEN
    RETURN public.gsa_jwt_session_is_valid()
      AND v_owner = public.gsa_current_actor_id()::text
      AND EXISTS (SELECT 1 FROM public.fornecedores WHERE id = public.gsa_current_actor_id() AND status = 'ativo');
  END IF;
  IF v_type = 'admin' THEN PERFORM public.gsa_admin_context(); RETURN true; END IF;
  IF v_type = 'colaborador' THEN RETURN public.gsa_admin_has_module('fornecedores'); END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_supplier_document_allowed(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_document_allowed(text, boolean) TO authenticated, service_role;

DROP POLICY IF EXISTS supplier_documents_select ON storage.objects;
CREATE POLICY supplier_documents_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos_fornecedor' AND public.gsa_supplier_document_allowed(name, false));

DROP POLICY IF EXISTS supplier_documents_insert ON storage.objects;
CREATE POLICY supplier_documents_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos_fornecedor' AND public.gsa_supplier_document_allowed(name, true));

DROP POLICY IF EXISTS supplier_documents_update ON storage.objects;
CREATE POLICY supplier_documents_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos_fornecedor' AND public.gsa_supplier_document_allowed(name, true))
WITH CHECK (bucket_id = 'documentos_fornecedor' AND public.gsa_supplier_document_allowed(name, true));

DROP POLICY IF EXISTS supplier_documents_delete ON storage.objects;
CREATE POLICY supplier_documents_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos_fornecedor' AND public.gsa_supplier_document_allowed(name, true));

COMMIT;
