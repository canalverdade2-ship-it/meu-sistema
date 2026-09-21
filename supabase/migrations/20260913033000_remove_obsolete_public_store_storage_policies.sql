-- Store media moved to VPS/R2. These broad legacy permissions must not
-- become active again if a bucket with the old name is recreated.
BEGIN;
DROP POLICY IF EXISTS "Permitir inserção pública gsa-store-returns" ON storage.objects;
DROP POLICY IF EXISTS "Devoluções visíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Permitir inserção pública gsa-store-images" ON storage.objects;
DROP POLICY IF EXISTS "Imagens visíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualização pública gsa-store-images" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualização pública gsa-store-returns" ON storage.objects;
DROP POLICY IF EXISTS "Permitir deleção pública gsa-store-images" ON storage.objects;
DROP POLICY IF EXISTS "Permitir deleção pública gsa-store-returns" ON storage.objects;
COMMIT;
