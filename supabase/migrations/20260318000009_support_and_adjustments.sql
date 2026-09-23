-- Migration for Support Conversation and Adjustment Requests

-- 1. Create suporte_mensagens table for conversational support
CREATE TABLE IF NOT EXISTS suporte_mensagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    suporte_id UUID REFERENCES prestador_suporte_demandas(id) ON DELETE CASCADE NOT NULL,
    autor_id UUID NOT NULL, -- Can be prestador_id or admin_id
    autor_tipo TEXT CHECK (autor_tipo IN ('prestador', 'admin')) NOT NULL,
    mensagem TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add adjustment request columns to prestador_demandas
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS ajuste_solicitado TEXT;
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS prazo_ajuste TIMESTAMP WITH TIME ZONE;
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS status_ajuste TEXT CHECK (status_ajuste IN ('nenhum', 'solicitado', 'pendente_ajuste', 'ajustado'));

-- 3. Update prestador_suporte_demandas to support conversation
-- We will keep the original table but use suporte_mensagens for the conversation history.
-- We might need to update the status check to include 'concluido'
ALTER TABLE prestador_suporte_demandas DROP CONSTRAINT IF EXISTS prestador_suporte_demandas_status_check;
ALTER TABLE prestador_suporte_demandas ADD CONSTRAINT prestador_suporte_demandas_status_check 
CHECK (status IN ('aberto', 'respondido', 'fechado', 'concluido'));

-- 4. Enable RLS
ALTER TABLE suporte_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total suporte_mensagens" ON suporte_mensagens FOR ALL USING (true) WITH CHECK (true);
