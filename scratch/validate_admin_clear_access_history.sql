DO $$
DECLARE
  v_session record;
  v_result record;
  v_test_actor uuid := '22222222-2222-2222-2222-222222222222'::uuid;
BEGIN
  SELECT *
  INTO v_session
  FROM public.gsa_start_session('admin', v_test_actor, 'Teste QA Admin', '{"source":"rls_clear_validation"}'::jsonb);

  IF v_session.sessao_id IS NULL OR v_session.session_token IS NULL THEN
    RAISE EXCEPTION 'sessao admin de teste nao criada';
  END IF;

  SELECT *
  INTO v_result
  FROM public.gsa_admin_clear_access_history(
    v_session.sessao_id,
    v_session.session_token,
    'personalizado',
    '2999-01-01T00:00:00Z'::timestamptz,
    '2999-01-02T00:00:00Z'::timestamptz
  );

  IF v_result.deleted_sessions IS DISTINCT FROM 0 OR v_result.deleted_logs IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'validacao de limpeza futura apagou dados inesperadamente';
  END IF;

  PERFORM public.gsa_end_session(v_session.sessao_id, v_session.session_token);

  DELETE FROM public.sistema_sessoes
  WHERE id = v_session.sessao_id;
END;
$$;
