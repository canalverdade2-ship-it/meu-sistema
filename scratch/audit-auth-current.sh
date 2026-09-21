sudo -n -u postgres psql -p 5433 -d gsahub -P pager=off <<'SQL'
SELECT p.oid::regprocedure AS function, pg_get_userbyid(p.proowner) AS owner, has_function_privilege('anon',p.oid,'EXECUTE') AS anon, has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('gsa_create_session_internal','gsa_provision_auth_identity_internal','gsa_start_session','gsa_force_end_session','gsa_login_admin');
SQL
