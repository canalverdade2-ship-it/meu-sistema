
-- Adicionar prazo_meses na tabela loja_carrinhos
ALTER TABLE loja_carrinhos ADD COLUMN IF NOT EXISTS prazo_meses integer;

-- A tabela ordens_assinatura já possui prazo_meses?
-- Vamos garantir
ALTER TABLE ordens_assinatura ADD COLUMN IF NOT EXISTS prazo_meses integer;
