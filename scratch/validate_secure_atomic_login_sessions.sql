BEGIN;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.gsa_start_session(text,uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'gsa_start_session continua executavel por anon';
  END IF;
  IF has_function_privilege('anon', 'public.gsa_force_end_session(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'gsa_force_end_session continua executavel por anon';
  END IF;
  IF has_function_privilege('anon', 'public.gsa_check_active_session(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'gsa_check_active_session continua executavel por anon';
  END IF;
  IF has_function_privilege('anon', 'public.verify_pin(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify_pin legado continua executavel por anon';
  END IF;
  IF has_function_privilege('anon', 'public.set_pin(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'set_pin legado continua executavel por anon';
  END IF;
  IF has_function_privilege('anon', 'public.gsa_create_session_internal(text,uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'helper interno de sessao esta exposto';
  END IF;

  IF NOT has_function_privilege('anon', 'public.gsa_login_pin(text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.gsa_login_admin(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.gsa_login_colaborador(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.gsa_set_pin_and_login(text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Uma ou mais funcoes atomicas de login nao estao liberadas';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.system_settings
     WHERE key = 'admin_access_code' AND value_hash IS NULL
  ) THEN
    RAISE EXCEPTION 'Hash da credencial administrativa nao foi preenchido';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.colaboradores
     WHERE nullif(credencial_acesso, '') IS NOT NULL AND credencial_hash IS NULL
  ) THEN
    RAISE EXCEPTION 'Existe colaborador com credencial sem hash';
  END IF;
END;
$$;

SET LOCAL ROLE anon;

DO $$
DECLARE
  v_result jsonb;
  v_before bigint;
  v_after bigint;
BEGIN
  SELECT count(*) INTO v_before FROM public.sistema_sessoes;

  v_result := public.gsa_login_admin('__codigo_invalido_de_validacao__');
  IF coalesce((v_result ->> 'valid')::boolean, false) THEN
    RAISE EXCEPTION 'Login administrativo aceitou codigo invalido';
  END IF;

  v_result := public.gsa_login_pin('00000000000', '0000', 'cliente');
  IF coalesce((v_result ->> 'valid')::boolean, false) THEN
    RAISE EXCEPTION 'Login de cliente aceitou credenciais inexistentes';
  END IF;

  v_result := public.gsa_set_pin_and_login('00000000000', '11999999999', '0000', 'cliente');
  IF coalesce((v_result ->> 'success')::boolean, false) THEN
    RAISE EXCEPTION 'Primeiro acesso aceitou cadastro inexistente';
  END IF;

  SELECT count(*) INTO v_after FROM public.sistema_sessoes;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'Tentativas invalidas criaram sessao';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;

