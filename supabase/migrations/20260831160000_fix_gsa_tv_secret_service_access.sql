-- The self-hosted service_role does not bypass RLS in this installation.
-- Permit only the internal backend role to manage the encrypted TV secret row.
DROP POLICY IF EXISTS gsa_tv_channel_secrets_service_role_access
  ON public.gsa_tv_channel_secrets;

CREATE POLICY gsa_tv_channel_secrets_service_role_access
  ON public.gsa_tv_channel_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
