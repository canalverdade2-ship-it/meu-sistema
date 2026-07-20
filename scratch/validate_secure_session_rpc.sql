DO $$
DECLARE
  v_session record;
  v_validation record;
  v_active record;
  v_ok boolean;
  v_test_actor uuid := '11111111-1111-1111-1111-111111111111'::uuid;
BEGIN
  SELECT *
  INTO v_session
  FROM public.gsa_start_session('cliente', v_test_actor, 'Teste QA Sessao', '{"source":"rls_validation"}'::jsonb);

  IF v_session.sessao_id IS NULL OR v_session.session_token IS NULL THEN
    RAISE EXCEPTION 'gsa_start_session nao retornou sessao/token';
  END IF;

  SELECT *
  INTO v_validation
  FROM public.gsa_validate_session(v_session.sessao_id, v_session.session_token);

  IF NOT COALESCE(v_validation.is_valid, false) THEN
    RAISE EXCEPTION 'gsa_validate_session nao validou token correto';
  END IF;

  SELECT *
  INTO v_active
  FROM public.gsa_check_active_session(v_test_actor);

  IF v_active.id IS DISTINCT FROM v_session.sessao_id THEN
    RAISE EXCEPTION 'gsa_check_active_session nao retornou a sessao criada';
  END IF;

  SELECT public.gsa_ping_session(v_session.sessao_id, v_session.session_token)
  INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'gsa_ping_session falhou';
  END IF;

  SELECT public.gsa_end_session(v_session.sessao_id, v_session.session_token)
  INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'gsa_end_session falhou';
  END IF;

  SELECT *
  INTO v_validation
  FROM public.gsa_validate_session(v_session.sessao_id, v_session.session_token);

  IF COALESCE(v_validation.is_valid, false) THEN
    RAISE EXCEPTION 'sessao encerrada ainda validou';
  END IF;

  DELETE FROM public.sistema_sessoes
  WHERE id = v_session.sessao_id;
END;
$$;
