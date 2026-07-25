BEGIN;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gsa-site-campaigns',
  'gsa-site-campaigns',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS gsa_site_campaign_assets_public_read ON storage.objects;
CREATE POLICY gsa_site_campaign_assets_public_read
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gsa-site-campaigns');

DROP POLICY IF EXISTS gsa_site_campaign_assets_admin_insert ON storage.objects;
CREATE POLICY gsa_site_campaign_assets_admin_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gsa-site-campaigns'
  AND public.gsa_admin_has_module('avisos-campanhas')
  AND name LIKE 'campaigns/%'
);

DROP POLICY IF EXISTS gsa_site_campaign_assets_admin_update ON storage.objects;
CREATE POLICY gsa_site_campaign_assets_admin_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gsa-site-campaigns'
  AND public.gsa_admin_has_module('avisos-campanhas')
)
WITH CHECK (
  bucket_id = 'gsa-site-campaigns'
  AND public.gsa_admin_has_module('avisos-campanhas')
  AND name LIKE 'campaigns/%'
);

DROP POLICY IF EXISTS gsa_site_campaign_assets_admin_delete ON storage.objects;
CREATE POLICY gsa_site_campaign_assets_admin_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gsa-site-campaigns'
  AND public.gsa_admin_has_module('avisos-campanhas')
);

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_cleanup_events(p_keep_days integer DEFAULT 400)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(p_keep_days, 400), 90), 1825);
  v_deleted bigint;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Operação restrita' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.gsa_site_campaign_events
  WHERE created_at < now() - make_interval(days => v_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'deleted', v_deleted, 'keep_days', v_days);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_site_campaign_safe_url(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_site_campaign_page_matches(text[],text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_site_campaign_cleanup_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_site_campaign_safe_url(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_site_campaign_page_matches(text[],text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_site_campaign_cleanup_events(integer) TO service_role;

COMMENT ON TABLE public.gsa_site_campaigns IS 'Campanhas e avisos exibidos nas páginas públicas do GSA HUB.';
COMMENT ON TABLE public.gsa_site_campaign_events IS 'Eventos pseudonimizados de exibição, clique e fechamento das campanhas.';
COMMENT ON TABLE public.gsa_site_campaign_history IS 'Auditoria imutável das ações administrativas e automáticas da Central de Avisos.';
COMMENT ON FUNCTION public.gsa_public_site_campaigns(text,text,text,text,text,text) IS 'Entrega somente campanhas elegíveis, registra a impressão e aplica frequência sob lock transacional.';
COMMENT ON FUNCTION public.gsa_public_site_campaign_event(uuid,text,text,text,text,text,text,text,jsonb) IS 'Registra clique ou fechamento somente após uma impressão válida da mesma sessão.';

COMMIT;
