sudo -n -u postgres psql -v ON_ERROR_STOP=1 -p 5433 -d gsahub <<'SQL'
-- Restore the internal-only boundary originally established in July.
-- Public login RPCs retain their grants and execute as their existing owner.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.gsa_create_session_internal(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gsa_provision_auth_identity_internal(text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gsa_start_session(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gsa_force_end_session(uuid) FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

SQL

