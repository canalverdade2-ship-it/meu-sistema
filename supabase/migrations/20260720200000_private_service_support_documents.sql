-- Private storage for service-order and support attachments.
-- New uploads are stored as opaque references and opened through short-lived signed URLs.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'gsa-private-documents',
  'gsa-private-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS gsa_private_documents_admin_manage ON storage.objects;
DROP POLICY IF EXISTS gsa_private_documents_client_insert ON storage.objects;
DROP POLICY IF EXISTS gsa_private_documents_client_select ON storage.objects;
DROP POLICY IF EXISTS gsa_private_documents_client_delete ON storage.objects;
DROP POLICY IF EXISTS gsa_private_documents_provider_insert ON storage.objects;
DROP POLICY IF EXISTS gsa_private_documents_provider_select ON storage.objects;
DROP POLICY IF EXISTS gsa_private_documents_provider_delete ON storage.objects;
DROP POLICY IF EXISTS gsa_private_documents_provider_assigned_os_select ON storage.objects;

CREATE POLICY gsa_private_documents_admin_manage
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') IN ('admin', 'colaborador')
)
WITH CHECK (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') IN ('admin', 'colaborador')
);

CREATE POLICY gsa_private_documents_client_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') = 'cliente'
  AND (storage.foldername(name))[1] = 'clientes'
  AND (storage.foldername(name))[2] = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  AND (storage.foldername(name))[4] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (
    (
      (storage.foldername(name))[3] = 'ordens-servico'
      AND EXISTS (
        SELECT 1
        FROM public.ordens_servico os
        WHERE os.id = ((storage.foldername(name))[4])::uuid
          AND os.cliente_id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
      )
    )
    OR
    (
      (storage.foldername(name))[3] = 'tickets'
      AND EXISTS (
        SELECT 1
        FROM public.tickets t
        WHERE t.id = ((storage.foldername(name))[4])::uuid
          AND t.cliente_id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
      )
    )
  )
);

CREATE POLICY gsa_private_documents_client_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') = 'cliente'
  AND (storage.foldername(name))[1] = 'clientes'
  AND (storage.foldername(name))[2] = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  AND (storage.foldername(name))[4] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (
    (
      (storage.foldername(name))[3] = 'ordens-servico'
      AND EXISTS (
        SELECT 1
        FROM public.ordens_servico os
        WHERE os.id = ((storage.foldername(name))[4])::uuid
          AND os.cliente_id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
      )
    )
    OR
    (
      (storage.foldername(name))[3] = 'tickets'
      AND EXISTS (
        SELECT 1
        FROM public.tickets t
        WHERE t.id = ((storage.foldername(name))[4])::uuid
          AND t.cliente_id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
      )
    )
  )
);

CREATE POLICY gsa_private_documents_client_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') = 'cliente'
  AND (storage.foldername(name))[1] = 'clientes'
  AND (storage.foldername(name))[2] = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  AND (storage.foldername(name))[3] IN ('ordens-servico', 'tickets')
);

CREATE POLICY gsa_private_documents_provider_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') = 'prestador'
  AND (storage.foldername(name))[1] = 'prestadores'
  AND (storage.foldername(name))[2] = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  AND (storage.foldername(name))[3] = 'tickets'
  AND (storage.foldername(name))[4] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ((storage.foldername(name))[4])::uuid
      AND t.prestador_id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  )
);

CREATE POLICY gsa_private_documents_provider_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') = 'prestador'
  AND (storage.foldername(name))[1] = 'prestadores'
  AND (storage.foldername(name))[2] = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  AND (storage.foldername(name))[3] = 'tickets'
  AND (storage.foldername(name))[4] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ((storage.foldername(name))[4])::uuid
      AND t.prestador_id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  )
);

CREATE POLICY gsa_private_documents_provider_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') = 'prestador'
  AND (storage.foldername(name))[1] = 'prestadores'
  AND (storage.foldername(name))[2] = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  AND (storage.foldername(name))[3] = 'tickets'
);

CREATE POLICY gsa_private_documents_provider_assigned_os_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') = 'prestador'
  AND (storage.foldername(name))[1] = 'clientes'
  AND (storage.foldername(name))[3] = 'ordens-servico'
  AND (storage.foldername(name))[4] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.prestador_demandas pd
    WHERE pd.os_id = ((storage.foldername(name))[4])::uuid
      AND pd.prestador_id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '')
  )
);
