BEGIN;

-- Os wrappers administrativos são recriados nas migrations de permissões.
-- PostgreSQL concede EXECUTE a PUBLIC por padrão em funções novas; por isso
-- todas as fronteiras administrativas são novamente fechadas de forma explícita.
REVOKE ALL ON FUNCTION public.gsa_admin_site_campaigns_overview(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_upsert_site_campaign(uuid,jsonb,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_site_campaign_status(uuid,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_duplicate_site_campaign(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_delete_site_campaign(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_site_campaign_permission_overview(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_site_campaign_permissions(uuid,boolean,text[],uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_site_campaign_my_permissions(uuid,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaigns_overview(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_upsert_site_campaign(uuid,jsonb,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_site_campaign_status(uuid,text,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_duplicate_site_campaign(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_site_campaign(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaign_permission_overview(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_site_campaign_permissions(uuid,boolean,text[],uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaign_my_permissions(uuid,text) TO authenticated, service_role;

-- As versões internas nunca devem ser executadas pelo navegador, nem mesmo
-- por um usuário autenticado; somente service_role pode alcançá-las diretamente.
REVOKE ALL ON FUNCTION public.gsa_admin_site_campaigns_overview_internal(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_upsert_site_campaign_internal(uuid,jsonb,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_set_site_campaign_status_internal(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_duplicate_site_campaign_internal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_delete_site_campaign_internal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaigns_overview_internal(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_upsert_site_campaign_internal(uuid,jsonb,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_site_campaign_status_internal(uuid,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_duplicate_site_campaign_internal(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_site_campaign_internal(uuid,uuid,text) TO service_role;

-- Auxiliares de autorização usados pelas policies e wrappers.
REVOKE ALL ON FUNCTION public.gsa_site_campaign_has_action(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_site_campaign_assert_action(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_site_campaign_has_action(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_site_campaign_assert_action(text) TO authenticated, service_role;

COMMIT;
