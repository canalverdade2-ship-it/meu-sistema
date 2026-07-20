-- Adiciona a coluna promocao_desconto_manual na tabela orcamentos
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS promocao_desconto_manual numeric DEFAULT 0;
