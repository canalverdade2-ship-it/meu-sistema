BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_ads_list_orphan_creative_paths()
RETURNS TABLE(storage_path text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT object_row.name::text AS storage_path
    FROM storage.objects object_row
    LEFT JOIN public.gsa_ad_creatives creative
      ON creative.storage_path = object_row.name
   WHERE object_row.bucket_id = 'gsa-ad-creatives'
     AND creative.id IS NULL
     AND object_row.created_at < now() - interval '1 hour'
   ORDER BY object_row.created_at
   LIMIT 250;
$$;

REVOKE ALL ON FUNCTION public.gsa_ads_list_orphan_creative_paths() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_ads_list_orphan_creative_paths() TO service_role;

COMMIT;
