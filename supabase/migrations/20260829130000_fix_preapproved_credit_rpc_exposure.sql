BEGIN;

GRANT EXECUTE ON FUNCTION public.gsa_client_request_preapproved_credit_100(uuid,text)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.gsa_admin_approve_preapproved_credit_100(uuid,text,uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
