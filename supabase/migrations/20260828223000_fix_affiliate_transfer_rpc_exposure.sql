BEGIN;

GRANT EXECUTE ON FUNCTION public.gsa_client_lookup_affiliate_transfer_target(uuid,text,text)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.gsa_client_transfer_affiliate_balance(uuid,text,uuid,uuid,numeric,text)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.gsa_client_affiliate_transfers(uuid,text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
