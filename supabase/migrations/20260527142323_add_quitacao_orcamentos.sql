ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS status_quitacao_credito text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS valor_quitacao_acordo numeric;
