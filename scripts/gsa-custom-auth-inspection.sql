SELECT
  pg_get_functiondef('public.gsa_client_session_actor(uuid,text)'::regprocedure)
  || E'\n-- RESULT: '
  || pg_get_function_result('public.gsa_client_session_actor(uuid,text)'::regprocedure)
  AS function_definition;
