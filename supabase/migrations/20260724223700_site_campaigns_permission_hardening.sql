BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_has_action(p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id text := v_context ->> 'actor_id';
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  IF v_actor_type = 'admin' THEN
    RETURN true;
  END IF;
  IF v_actor_type <> 'colaborador'
     OR v_actor_id IS NULL
     OR v_actor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR NOT public.gsa_admin_has_module('avisos-campanhas') THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.gsa_site_campaign_permissions p
    WHERE p.collaborator_id = v_actor_id::uuid
      AND v_action = ANY(p.allowed_actions)
  );
END;
$$;

DROP POLICY IF EXISTS gsa_site_campaign_assets_admin_insert ON storage.objects;
CREATE POLICY gsa_site_campaign_assets_admin_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gsa-site-campaigns'
  AND name LIKE 'campaigns/%'
  AND (
    public.gsa_site_campaign_has_action('create')
    OR public.gsa_site_campaign_has_action('edit')
  )
);

DROP POLICY IF EXISTS gsa_site_campaign_assets_admin_update ON storage.objects;
CREATE POLICY gsa_site_campaign_assets_admin_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gsa-site-campaigns'
  AND (
    public.gsa_site_campaign_has_action('create')
    OR public.gsa_site_campaign_has_action('edit')
  )
)
WITH CHECK (
  bucket_id = 'gsa-site-campaigns'
  AND name LIKE 'campaigns/%'
  AND (
    public.gsa_site_campaign_has_action('create')
    OR public.gsa_site_campaign_has_action('edit')
  )
);

DROP POLICY IF EXISTS gsa_site_campaign_assets_admin_delete ON storage.objects;
CREATE POLICY gsa_site_campaign_assets_admin_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gsa-site-campaigns'
  AND public.gsa_site_campaign_has_action('delete')
);

COMMIT;
