-- Conceder permissão de execução das RPCs do portal do anunciante para os papéis anon, authenticated e service_role
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_counter_proposal(uuid,numeric,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_reject_proposal(uuid,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_accept_proposal(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_save_creative TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_submit_creative(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_portal_snapshot TO anon, authenticated, service_role;
