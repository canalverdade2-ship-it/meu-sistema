SELECT section, definition
FROM (
  SELECT
    1 AS sort_order,
    'client_session_actor'::text AS section,
    pg_get_functiondef('public.gsa_client_session_actor(uuid,text)'::regprocedure)
      || E'\n-- RESULT: '
      || pg_get_function_result('public.gsa_client_session_actor(uuid,text)'::regprocedure)
      AS definition

  UNION ALL

  SELECT
    2,
    'jwt_session_is_valid',
    pg_get_functiondef('public.gsa_jwt_session_is_valid()'::regprocedure)
      || E'\n-- RESULT: '
      || pg_get_function_result('public.gsa_jwt_session_is_valid()'::regprocedure)

  UNION ALL

  SELECT
    3,
    'existing_policies',
    COALESCE(
      string_agg(
        format(
          '%I.%I | %I | %s | USING: %s | CHECK: %s',
          schemaname,
          tablename,
          policyname,
          cmd,
          COALESCE(qual, ''),
          COALESCE(with_check, '')
        ),
        E'\n\n'
        ORDER BY tablename, policyname
      ),
      'No matching policies'
    )
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      COALESCE(qual, '') ILIKE '%gsa_jwt_session_is_valid%'
      OR COALESCE(with_check, '') ILIKE '%gsa_jwt_session_is_valid%'
      OR COALESCE(qual, '') ILIKE '%gsa_actor_id%'
      OR COALESCE(with_check, '') ILIKE '%gsa_actor_id%'
    )
) inspected
ORDER BY sort_order;
