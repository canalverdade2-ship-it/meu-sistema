DO $$
DECLARE
  v_session record;
  v_log_id uuid;
  v_test_actor uuid := '33333333-3333-3333-3333-333333333333'::uuid;
BEGIN
  SELECT *
  INTO v_session
  FROM public.gsa_start_session('admin', v_test_actor, 'Teste QA Log', '{"source":"rls_log_validation"}'::jsonb);

  SELECT public.gsa_log_action(
    v_session.sessao_id,
    v_session.session_token,
    'admin',
    v_test_actor::text,
    'Teste QA Log',
    'VALIDACAO_LOG_SEGURO',
    'Registro temporario de validacao da RPC gsa_log_action'
  )
  INTO v_log_id;

  IF v_log_id IS NULL THEN
    RAISE EXCEPTION 'gsa_log_action nao retornou id';
  END IF;

  DELETE FROM public.sistema_logs
  WHERE id = v_log_id;

  PERFORM public.gsa_end_session(v_session.sessao_id, v_session.session_token);

  DELETE FROM public.sistema_sessoes
  WHERE id = v_session.sessao_id;
END;
$$;
