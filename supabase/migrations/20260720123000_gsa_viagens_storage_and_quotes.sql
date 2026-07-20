-- Storage privado e ajustes complementares do GSA Viagens.

CREATE INDEX IF NOT EXISTS idx_viagens_orcamentos_pacote
  ON public.viagens_orcamentos(pacote_id);

-- Mantém o pedido de orçamento público possível, sem liberar acesso aos dados enviados.
DROP POLICY IF EXISTS "Cliente insere orcamentos" ON public.viagens_orcamentos;
DROP POLICY IF EXISTS "Cliente ou visitante insere orcamentos" ON public.viagens_orcamentos;
CREATE POLICY "Cliente ou visitante insere orcamentos"
  ON public.viagens_orcamentos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (
      cliente_id IS NULL
      AND NULLIF(trim(nome), '') IS NOT NULL
      AND NULLIF(trim(email), '') IS NOT NULL
      AND NULLIF(trim(telefone), '') IS NOT NULL
    )
    OR (
      public.gsa_jwt_session_is_valid()
      AND public.gsa_jwt_actor_type() = 'cliente'
      AND cliente_id = public.gsa_jwt_actor_id()
    )
  );

-- Buckets privados. Documentos pessoais e vouchers nunca usam URL pública.
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

-- O caminho de documentos segue:
-- <cliente_id>/<passageiro_id>/<arquivo>.
DROP POLICY IF EXISTS "Cliente envia documentos de viagem" ON storage.objects;
CREATE POLICY "Cliente envia documentos de viagem"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'viagens-documentos'
    AND public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND public.gsa_jwt_actor_id()::text = split_part(name, '/', 1)
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      WHERE passageiro.id::text = split_part(name, '/', 2)
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
    )
  );

DROP POLICY IF EXISTS "Cliente le documentos de viagem" ON storage.objects;
CREATE POLICY "Cliente le documentos de viagem"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'viagens-documentos'
    AND public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND public.gsa_jwt_actor_id()::text = split_part(name, '/', 1)
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      WHERE passageiro.id::text = split_part(name, '/', 2)
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
    )
  );

DROP POLICY IF EXISTS "Cliente remove documentos de viagem" ON storage.objects;
CREATE POLICY "Cliente remove documentos de viagem"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'viagens-documentos'
    AND public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND public.gsa_jwt_actor_id()::text = split_part(name, '/', 1)
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      WHERE passageiro.id::text = split_part(name, '/', 2)
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
    )
  );

-- Vouchers seguem <cliente_id>/<transacao_id>/<arquivo>.
DROP POLICY IF EXISTS "Cliente baixa vouchers de viagem" ON storage.objects;
CREATE POLICY "Cliente baixa vouchers de viagem"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'viagens-vouchers'
    AND public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND public.gsa_jwt_actor_id()::text = split_part(name, '/', 1)
    AND EXISTS (
      SELECT 1
      FROM public.viagens_transacoes transacao
      WHERE transacao.id::text = split_part(name, '/', 2)
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
    )
  );

-- Administração e colaboradores operacionais gerenciam os arquivos privados.
DROP POLICY IF EXISTS "Operacao GSA gerencia arquivos de viagem" ON storage.objects;
CREATE POLICY "Operacao GSA gerencia arquivos de viagem"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id IN ('viagens-documentos', 'viagens-vouchers')
    AND public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  )
  WITH CHECK (
    bucket_id IN ('viagens-documentos', 'viagens-vouchers')
    AND public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
  );
