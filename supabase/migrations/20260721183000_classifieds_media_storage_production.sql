-- Storage de produção para imagens dos anúncios classificados.
-- O bucket é público somente para leitura das imagens exibidas nos anúncios.
-- Inclusões e exclusões são executadas exclusivamente pela Edge Function
-- gsa-classified-media com service role, após validação da sessão GSA.

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

COMMIT;
