-- Adiciona a coluna promocao_id na tabela orcamentos (caso não exista)
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS promocao_id uuid;

-- Se a coluna já existir como text, precisamos convertê-la para uuid
ALTER TABLE orcamentos ALTER COLUMN promocao_id TYPE uuid USING NULLIF(promocao_id, '')::uuid;

-- Adiciona a chave estrangeira para a tabela promocoes
ALTER TABLE orcamentos 
  DROP CONSTRAINT IF EXISTS orcamentos_promocao_id_fkey,
  ADD CONSTRAINT orcamentos_promocao_id_fkey 
  FOREIGN KEY (promocao_id) 
  REFERENCES promocoes(id) 
  ON DELETE SET NULL;
