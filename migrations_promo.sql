CREATE TABLE IF NOT EXISTS promocoes_quantidade (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    
    -- Tipo da promoção
    tipo_promocao TEXT CHECK (tipo_promocao IN (
      'unidade_gratis',
      'desconto_proxima',
      'ganhe_outro_produto',
      'combo'
    )) NOT NULL,
    
    -- Escopo do gatilho
    escopo_gatilho TEXT CHECK (escopo_gatilho IN (
      'produto',
      'categoria',
      'geral',
      'valor_minimo',
      'combo'
    )) NOT NULL DEFAULT 'produto',
    
    -- Gatilhos
    produto_gatilho_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
    categoria_gatilho_id UUID REFERENCES loja_categorias(id) ON DELETE CASCADE,
    valor_minimo_compra DECIMAL(12,2) DEFAULT NULL,
    produtos_combo JSONB DEFAULT NULL,
    
    quantidade_minima INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_minima >= 1),
    
    -- Benefícios
    desconto_tipo TEXT CHECK (desconto_tipo IN ('porcentagem', 'valor')),
    desconto_valor DECIMAL(12,2) DEFAULT 0,
    produto_brinde_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
    quantidade_brinde INTEGER DEFAULT 1,
    niveis JSONB DEFAULT NULL,
    
    -- INTEGRAÇÃO VIP
    nivel_minimo_id UUID REFERENCES client_levels(id) ON DELETE SET NULL,
    niveis_vip JSONB DEFAULT NULL,
    
    -- Controle, Urgência e Prioridade
    uso_maximo_por_cliente INTEGER DEFAULT 1,
    prioridade INTEGER DEFAULT 10,
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    data_fim TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('ativa', 'suspensa', 'encerrada')) DEFAULT 'ativa',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Controle de uso
CREATE TABLE IF NOT EXISTS promocoes_quantidade_uso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promocao_id UUID REFERENCES promocoes_quantidade(id) ON DELETE CASCADE NOT NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    orcamento_id UUID REFERENCES orcamentos(id) ON DELETE SET NULL,
    quantidade_usada INTEGER DEFAULT 1,
    nivel_aplicado INTEGER DEFAULT NULL,
    economia_gerada DECIMAL(12,2) DEFAULT 0,
    detalhes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE promocoes_quantidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Full Access" ON promocoes_quantidade FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE promocoes_quantidade_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Full Access" ON promocoes_quantidade_uso FOR ALL USING (true) WITH CHECK (true);

-- Notificações Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE promocoes_quantidade;
ALTER PUBLICATION supabase_realtime ADD TABLE promocoes_quantidade_uso;
