BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Preserva a implementação existente, responsável por criar a sessão e a
-- identidade Supabase, mas remove seu acesso público. O novo ponto de entrada
-- valida exclusivamente o hash da credencial apresentada.
DO $rename_legacy$
BEGIN
  IF to_regprocedure('public.gsa_login_colaborador_legacy(text)') IS NULL
     AND to_regprocedure('public.gsa_login_colaborador(text)') IS NOT NULL THEN
    ALTER FUNCTION public.gsa_login_colaborador(text)
      RENAME TO gsa_login_colaborador_legacy;
  END IF;
END;
$rename_legacy$;

DO $legacy_required$
BEGIN
  IF to_regprocedure('public.gsa_login_colaborador_legacy(text)') IS NULL THEN
    RAISE EXCEPTION 'A função legada gsa_login_colaborador(text) não foi encontrada. A migration foi interrompida para não quebrar o login.';
  END IF;
END;
$legacy_required$;

REVOKE ALL ON FUNCTION public.gsa_login_colaborador_legacy(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_generate_internal_collaborator_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_attempt integer := 0;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    v_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.colaboradores c WHERE c.credencial_acesso = v_code
    );
    IF v_attempt >= 100 THEN
      RAISE EXCEPTION 'Não foi possível gerar um código interno único.';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_generate_internal_collaborator_code() FROM PUBLIC, anon, authenticated, service_role;

-- Migração sem interrupção: a credencial que o usuário já conhece é
-- transformada em hash e o campo legado recebe um código interno diferente.
DO $migrate_credentials$
DECLARE
  v_row record;
  v_user_credential text;
  v_internal_code text;
BEGIN
  FOR v_row IN
    SELECT id, credencial_acesso, credencial_hash
      FROM public.colaboradores
     WHERE nullif(trim(COALESCE(credencial_acesso, '')), '') IS NOT NULL
  LOOP
    v_user_credential := v_row.credencial_acesso;
    v_internal_code := public.gsa_generate_internal_collaborator_code();

    UPDATE public.colaboradores
       SET credencial_hash = COALESCE(
             v_row.credencial_hash,
             crypt(v_user_credential, gen_salt('bf', 12))
           ),
           credencial_acesso = v_internal_code
     WHERE id = v_row.id;
  END LOOP;
END;
$migrate_credentials$;

CREATE OR REPLACE FUNCTION public.gsa_login_colaborador(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := trim(COALESCE(p_code, ''));
  v_collaborator_id uuid;
  v_internal_code text;
  v_status text;
  v_result jsonb;
BEGIN
  IF length(v_code) < 6 OR length(v_code) > 128 THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'invalid_credentials');
  END IF;

  SELECT c.id, c.credencial_acesso, lower(COALESCE(c.status, 'ativo'))
    INTO v_collaborator_id, v_internal_code, v_status
    FROM public.colaboradores c
   WHERE c.credencial_hash IS NOT NULL
     AND crypt(v_code, c.credencial_hash) = c.credencial_hash
   LIMIT 1;

  IF v_collaborator_id IS NULL
     OR v_status IN ('suspenso', 'bloqueado', 'inativo', 'excluido', 'excluído', 'cancelado') THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'invalid_credentials');
  END IF;

  EXECUTE 'SELECT public.gsa_login_colaborador_legacy($1)::jsonb'
     INTO v_result
     USING v_internal_code;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'authentication_failed');
  END IF;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Falha no login seguro do colaborador %: %', v_collaborator_id, SQLERRM;
  RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'authentication_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_login_colaborador(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_login_colaborador(text) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_collaborator(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_modules text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := p_id;
  v_is_new boolean := p_id IS NULL;
  v_name text := trim(COALESCE(p_payload ->> 'nome', ''));
  v_email text := lower(nullif(trim(COALESCE(p_payload ->> 'email', '')), ''));
  v_phone text := regexp_replace(COALESCE(p_payload ->> 'telefone', ''), '\D', '', 'g');
  v_function_id uuid;
  v_user_credential text;
  v_internal_code text;
  v_module text;
  v_allowed_modules constant text[] := ARRAY[
    'dashboard','cadastro','catalogo','operacoes','loja','classificados','viagens','saude','seguros',
    'fidelidade','atendimento','financeiro','cobranca','fiscal','emprestimos','credito_loja',
    'relatorios','configuracoes','acessos','demandas','sistema','promocoes','area_vip'
  ];
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');

  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Informe o nome do colaborador.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_function_id := nullif(p_payload ->> 'funcao_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Função inválida.' USING ERRCODE = '22023';
  END;

  FOREACH v_module IN ARRAY COALESCE(p_modules, ARRAY[]::text[]) LOOP
    IF NOT lower(trim(v_module)) = ANY(v_allowed_modules) THEN
      RAISE EXCEPTION 'Módulo administrativo inválido: %.', v_module USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF v_is_new THEN
    v_user_credential := upper(encode(gen_random_bytes(12), 'hex'));
    v_internal_code := public.gsa_generate_internal_collaborator_code();

    INSERT INTO public.colaboradores (
      nome, email, telefone, funcao_id, status, credencial_acesso, credencial_hash
    ) VALUES (
      v_name, v_email, nullif(v_phone, ''), v_function_id, 'ativo',
      v_internal_code, crypt(v_user_credential, gen_salt('bf', 12))
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.colaboradores
       SET nome = v_name,
           email = v_email,
           telefone = nullif(v_phone, ''),
           funcao_id = v_function_id
     WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.colaborador_modulos WHERE colaborador_id = v_id;
  INSERT INTO public.colaborador_modulos (colaborador_id, modulo_id)
  SELECT v_id, module_name
    FROM (
      SELECT DISTINCT lower(trim(value)) AS module_name
        FROM unnest(COALESCE(p_modules, ARRAY[]::text[])) AS value
    ) normalized
   WHERE module_name <> '';

  PERFORM public.gsa_sync_colaborador_modules(v_id);
  PERFORM public.gsa_admin_write_audit(
    'acessos',
    CASE WHEN v_is_new THEN 'CRIAR_COLABORADOR' ELSE 'EDITAR_COLABORADOR' END,
    'colaboradores',
    v_id,
    jsonb_build_object('nome', v_name, 'modules', to_jsonb(COALESCE(p_modules, ARRAY[]::text[])))
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'initial_credential', CASE WHEN v_is_new THEN v_user_credential ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_rotate_collaborator_credential(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_colaborador_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_credential text := upper(encode(gen_random_bytes(12), 'hex'));
  v_internal_code text := public.gsa_generate_internal_collaborator_code();
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');

  UPDATE public.colaboradores
     SET credencial_acesso = v_internal_code,
         credencial_hash = crypt(v_user_credential, gen_salt('bf', 12))
   WHERE id = p_colaborador_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'sistema_sessoes' AND column_name = 'ator_id'
  ) THEN
    EXECUTE 'UPDATE public.sistema_sessoes SET status = ''encerrado'' WHERE ator_id = $1 AND status IN (''ativo'', ''ativa'', ''active'')'
      USING p_colaborador_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'sistema_sessoes' AND column_name = 'usuario_id'
  ) THEN
    EXECUTE 'UPDATE public.sistema_sessoes SET status = ''encerrado'' WHERE usuario_id = $1 AND status IN (''ativo'', ''ativa'', ''active'')'
      USING p_colaborador_id;
  END IF;

  PERFORM public.gsa_admin_write_audit('acessos', 'ROTACIONAR_CREDENCIAL', 'colaboradores', p_colaborador_id, '{}'::jsonb);
  RETURN jsonb_build_object('success', true, 'initial_credential', v_user_credential);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_save_collaborator(uuid, text, uuid, jsonb, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_rotate_collaborator_credential(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_collaborator(uuid, text, uuid, jsonb, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_rotate_collaborator_credential(uuid, text, uuid) TO authenticated, service_role;

COMMIT;
