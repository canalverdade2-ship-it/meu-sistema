-- Storage privado e ajustes complementares do GSA Viagens.

CREATE INDEX IF NOT EXISTS idx_viagens_orcamentos_pacote
  ON public.viagens_orcamentos(pacote_id);

-- Mantém o pedido de orçamento público possível, sem liberar acesso aos dados enviados.
DROP POLICY IF EXISTS "Cliente insere orcamentos" ON public.viagens_orcamentos;
CREATE POLICY "Cliente ou visitante insere orcamentos"
  ON public.viagens_orcamentos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (cliente_id IS NULL AND nome IS NOT NULL AND email IS NOT NULL AND telefone IS NOT NULL)
    OR auth.uid() IN (
      SELECT user_id
      FROM public.clientes
      WHERE id = cliente_id
    )
  );

-- Buckets privados. Documentos pessoais e vouchers nunca devem usar URL pública.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'viagens-documentos',
  'viagens-documentos',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'viagens-vouchers',
  'viagens-vouchers',
  false,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- O primeiro segmento do caminho é sempre o cliente_id.
-- Exemplo: <cliente_id>/<passageiro_id>/<arquivo>.
DROP POLICY IF EXISTS "Cliente envia documentos de viagem" ON storage.objects;
CREATE POLICY "Cliente envia documentos de viagem"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'viagens-documentos'
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.user_id = auth.uid()
        AND c.id::text = split_part(name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "Cliente le documentos de viagem" ON storage.objects;
CREATE POLICY "Cliente le documentos de viagem"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'viagens-documentos'
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.user_id = auth.uid()
        AND c.id::text = split_part(name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "Cliente remove documentos de viagem" ON storage.objects;
CREATE POLICY "Cliente remove documentos de viagem"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'viagens-documentos'
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.user_id = auth.uid()
        AND c.id::text = split_part(name, '/', 1)
    )
  );

-- Vouchers são gravados pela operação administrativa e lidos pelo titular.
-- O caminho administrativo deve seguir <cliente_id>/<transacao_id>/<arquivo>.
DROP POLICY IF EXISTS "Cliente baixa vouchers de viagem" ON storage.objects;
CREATE POLICY "Cliente baixa vouchers de viagem"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'viagens-vouchers'
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.user_id = auth.uid()
        AND c.id::text = split_part(name, '/', 1)
    )
  );
