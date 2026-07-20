BEGIN;

DROP POLICY IF EXISTS provider_private_files_insert ON storage.objects;
CREATE POLICY provider_private_files_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
);

DROP POLICY IF EXISTS provider_private_files_update ON storage.objects;
CREATE POLICY provider_private_files_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
)
WITH CHECK (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
);

DROP POLICY IF EXISTS provider_private_files_delete ON storage.objects;
CREATE POLICY provider_private_files_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
);

COMMIT;
