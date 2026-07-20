-- Update prestador_demandas table
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS detalhes TEXT;
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS prazo_entrega DATE;
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS link_entrega TEXT;
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS data_entrega_prestador TIMESTAMP WITH TIME ZONE;
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS observacao_entrega TEXT;
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS motivo_negociacao TEXT;
ALTER TABLE prestador_demandas ADD COLUMN IF NOT EXISTS is_contraproposta_final BOOLEAN DEFAULT false;

-- Update status check constraint (drop and recreate)
ALTER TABLE prestador_demandas DROP CONSTRAINT IF EXISTS prestador_demandas_status_check;
ALTER TABLE prestador_demandas ADD CONSTRAINT prestador_demandas_status_check 
CHECK (status IN ('aberta', 'em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final', 'ativa', 'em_analise', 'concluida', 'recusada', 'cancelada'));

-- Create support table
CREATE TABLE IF NOT EXISTS prestador_suporte_demandas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    demanda_id UUID REFERENCES prestador_demandas(id) ON DELETE CASCADE,
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    mensagem TEXT NOT NULL,
    resposta_admin TEXT,
    status TEXT CHECK (status IN ('aberto', 'respondido', 'fechado')) DEFAULT 'aberto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create finance tables
CREATE TABLE IF NOT EXISTS prestador_transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    tipo TEXT CHECK (tipo IN ('credito', 'debito')) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    descricao TEXT NOT NULL,
    status TEXT CHECK (status IN ('concluido', 'pendente', 'cancelado')) DEFAULT 'concluido',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_saques (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    valor DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('em_analise', 'aprovado', 'recusado')) DEFAULT 'em_analise',
    dados_bancarios JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE prestador_suporte_demandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total prestador_suporte_demandas" ON prestador_suporte_demandas FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE prestador_transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total prestador_transacoes" ON prestador_transacoes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE prestador_saques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total prestador_saques" ON prestador_saques FOR ALL USING (true) WITH CHECK (true);
