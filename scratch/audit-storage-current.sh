sudo -n -u postgres psql -p 5433 -d gsahub -P pager=off <<'SQL'
SELECT id, public FROM storage.buckets ORDER BY id;
SELECT policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (policyname ILIKE '%store%' OR qual LIKE '%store%' OR with_check LIKE '%store%');
SELECT p.oid::regprocedure,has_function_privilege('supabase_admin',p.oid,'EXECUTE') AS owner_can_execute FROM pg_proc p WHERE proname IN ('gsa_create_session_internal','gsa_provision_auth_identity_internal');
SQL
