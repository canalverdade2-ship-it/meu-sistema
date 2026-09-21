sudo -n -u postgres psql -p 5433 -d gsahub -P pager=off <<'SQL'
SELECT p.oid::regprocedure, p.prosecdef, pg_get_userbyid(p.proowner) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.prosrc LIKE '%gsa_create_session_internal(%' OR p.prosrc LIKE '%gsa_provision_auth_identity_internal(%');
SELECT pg_get_functiondef('public.gsa_start_session(text,uuid,text,jsonb)'::regprocedure);
SQL
