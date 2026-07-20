-- Tabela de Categorias da Loja
CREATE TABLE IF NOT EXISTS loja_categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icone TEXT,
  imagem_url TEXT,
  ordem INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas de relacionamento nas tabelas existentes
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES loja_categorias(id);
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES loja_categorias(id);
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES loja_categorias(id);

-- Ativar RLS
ALTER TABLE loja_categorias ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para loja_categorias
DROP POLICY IF EXISTS "Public Full Access" ON loja_categorias;
CREATE POLICY "Public Full Access" ON loja_categorias FOR ALL USING (true) WITH CHECK (true);

-- Adicionar no Realtime
BEGIN;
  DO $$
  BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.loja_categorias';
  EXCEPTION WHEN OTHERS THEN 
      NULL;
  END;
  $$;
COMMIT;
