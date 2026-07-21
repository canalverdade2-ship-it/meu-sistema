-- Storage de produção para imagens dos anúncios classificados.
-- Bucket público para exibição dos anúncios, com escrita restrita ao cliente autenticado
-- e ao diretório correspondente ao actor_id presente no JWT GSA.

BEGIN;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'classificados-midias',
  'classificados-midias',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- storage.objects pertence ao papel interno do Supabase Storage.
-- A troca de papel fica limitada a esta transação e apenas ao DDL das políticas.
SET LOCAL ROLE supabase_storage_admin;

DROP POLICY IF EXISTS classificados_midias_leitura_publica ON storage.objects;
DROP POLICY IF EXISTS classificados_midias_inserir_proprio_diretorio ON storage.objects;
DROP POLICY IF EXISTS classificados_midias_atualizar_proprio_diretorio ON storage.objects;
DROP POLICY IF EXISTS classificados_midias_excluir_proprio_diretorio ON storage.objects;

CREATE POLICY classificados_midias_leitura_publica
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'classificados-midias');

CREATE POLICY classificados_midias_inserir_proprio_diretorio
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'classificados-midias'
  AND public.gsa_jwt_session_is_valid()
  AND public.gsa_jwt_actor_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.gsa_jwt_actor_id()::text
  AND array_length(storage.foldername(name), 1) >= 2
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp']::text[])
);

CREATE POLICY classificados_midias_atualizar_proprio_diretorio
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'classificados-midias'
  AND public.gsa_jwt_session_is_valid()
  AND public.gsa_jwt_actor_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.gsa_jwt_actor_id()::text
)
WITH CHECK (
  bucket_id = 'classificados-midias'
  AND public.gsa_jwt_session_is_valid()
  AND public.gsa_jwt_actor_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.gsa_jwt_actor_id()::text
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp']::text[])
);

CREATE POLICY classificados_midias_excluir_proprio_diretorio
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'classificados-midias'
  AND public.gsa_jwt_session_is_valid()
  AND public.gsa_jwt_actor_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.gsa_jwt_actor_id()::text
);

COMMENT ON POLICY classificados_midias_leitura_publica ON storage.objects
IS 'Permite a exibição pública das imagens dos anúncios classificados.';

COMMENT ON POLICY classificados_midias_inserir_proprio_diretorio ON storage.objects
IS 'Permite upload somente no diretório do cliente autenticado pela sessão GSA.';

RESET ROLE;

COMMIT;
