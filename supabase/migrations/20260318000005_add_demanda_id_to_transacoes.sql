-- Add demanda_id to prestador_transacoes
ALTER TABLE prestador_transacoes ADD COLUMN IF NOT EXISTS demanda_id UUID REFERENCES prestador_demandas(id) ON DELETE SET NULL;
