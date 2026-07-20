-- Schema for Prestadores (Service Providers)

CREATE TABLE IF NOT EXISTS prestadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_cadastro TEXT CHECK (tipo_cadastro IN ('cpf', 'cnpj')) NOT NULL,
    nome_razao TEXT NOT NULL,
    nome_responsavel TEXT,
    documento TEXT UNIQUE NOT NULL, -- CPF or CNPJ
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    cep TEXT,
    area_servico TEXT,
    observacoes TEXT,
    status TEXT CHECK (status IN ('pendente', 'em_analise', 'ativo', 'suspenso', 'desligado', 'reprovado')) DEFAULT 'pendente',
    credencial_acesso TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_demandas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE NOT NULL,
    os_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    valor_proposto_admin DECIMAL(12,2),
    valor_proposto_prestador DECIMAL(12,2),
    valor_final DECIMAL(12,2),
    status TEXT CHECK (status IN ('aberta', 'em_negociacao', 'ativa', 'concluida', 'recusada', 'cancelada')) DEFAULT 'aberta',
    data_inicio TIMESTAMP WITH TIME ZONE,
    data_conclusao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_faturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE NOT NULL,
    demanda_id UUID REFERENCES prestador_demandas(id) ON DELETE SET NULL,
    valor DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'aprovado', 'pago', 'cancelado')) DEFAULT 'pendente',
    data_vencimento DATE,
    data_pagamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'aprovado', 'rejeitado')) DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_historico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE NOT NULL,
    acao TEXT NOT NULL,
    descricao TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update tickets table to support prestadores
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE;

-- RLS Policies
ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestador_demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestador_faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestador_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestador_historico ENABLE ROW LEVEL SECURITY;

-- Allow all for now (Admin/Frontend handles logic)
DROP POLICY IF EXISTS "Acesso total prestadores" ON prestadores;
CREATE POLICY "Acesso total prestadores" ON prestadores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total prestador_demandas" ON prestador_demandas;
CREATE POLICY "Acesso total prestador_demandas" ON prestador_demandas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total prestador_faturas" ON prestador_faturas;
CREATE POLICY "Acesso total prestador_faturas" ON prestador_faturas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total prestador_documentos" ON prestador_documentos;
CREATE POLICY "Acesso total prestador_documentos" ON prestador_documentos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total prestador_historico" ON prestador_historico;
CREATE POLICY "Acesso total prestador_historico" ON prestador_historico FOR ALL USING (true) WITH CHECK (true);

-- Add to realtime
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'prestadores', 'prestador_demandas', 'prestador_faturas', 'prestador_documentos', 'prestador_historico'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        WHEN undefined_object THEN
            CREATE PUBLICATION supabase_realtime;
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
        END;
    END LOOP;
END $$;
