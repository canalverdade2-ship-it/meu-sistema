-- ====================================================================================
-- MASTER SUPABASE SCHEMA - ERP + CRM + FINTECH + AREA PRESTADOR
-- ====================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================================
-- 1. CONFIGURAÇÕES E ESTOQUE
-- ====================================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    must_change_code BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empresa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    razao_social TEXT,
    cnpj TEXT UNIQUE,
    telefone TEXT,
    responsavel TEXT,
    taxa_conversao_pontos DECIMAL(10,4) DEFAULT 0.01,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 2. CLIENTES E GAMIFICAÇÃO
-- ====================================================================================

CREATE TABLE IF NOT EXISTS client_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_nivel TEXT UNIQUE NOT NULL,
    pontos_minimos INTEGER NOT NULL,
    pontos_por_real DECIMAL(10,2) NOT NULL,
    cor TEXT,
    taxa_saque_transferencia DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_cliente TEXT UNIQUE,
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    cpf TEXT UNIQUE,
    cnpj TEXT UNIQUE,
    tipo_pessoa TEXT CHECK (tipo_pessoa IN ('pf', 'pj')) NOT NULL DEFAULT 'pf',
    telefone TEXT,
    data_nascimento DATE,
    cep TEXT,
    endereco TEXT,
    numero TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    observacoes TEXT,
    status TEXT CHECK (status IN ('ativo', 'inativo', 'pendente')) DEFAULT 'ativo',
    saldo_carteira DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    saldo_pontos INTEGER DEFAULT 0 NOT NULL,
    pontos_totais INTEGER DEFAULT 0 NOT NULL,
    carteira_bloqueada BOOLEAN DEFAULT false,
    pontos_bloqueados BOOLEAN DEFAULT false,
    cadastro_aprovado BOOLEAN DEFAULT true,
    bonus_boas_vindas_pendente BOOLEAN DEFAULT false,
    saque_liberado_manual BOOLEAN DEFAULT false,
    indicacao_origem_id UUID,
    nivel_id UUID REFERENCES client_levels(id),
    nivel_manual_id UUID REFERENCES client_levels(id),
    nivel_manual_info TEXT,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS level_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    nivel_anterior_id UUID REFERENCES client_levels(id),
    nivel_novo_id UUID REFERENCES client_levels(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 3. CATÁLOGO E PROMOÇÕES
-- ====================================================================================

CREATE TABLE IF NOT EXISTS servicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_servico TEXT UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_produto TEXT UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor DECIMAL(12,2) NOT NULL,
    estoque INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_assinatura TEXT UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promocoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_promocao TEXT UNIQUE,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('servico', 'produto', 'assinatura', 'geral')) NOT NULL,
    data_inicio_divulgacao TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim_divulgacao TIMESTAMP WITH TIME ZONE NOT NULL,
    prazo_validade_meses INTEGER NOT NULL,
    status TEXT CHECK (status IN ('ativa', 'suspensa', 'encerrada', 'usada')) DEFAULT 'ativa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_voucher TEXT UNIQUE,
    nome TEXT,
    tipo TEXT CHECK (tipo IN ('fixo', 'porcentagem', 'valor')) NOT NULL DEFAULT 'valor',
    valor DECIMAL(12,2) NOT NULL,
    cliente_id UUID REFERENCES clientes(id),
    prestador_id UUID REFERENCES prestadores(id),
    ordem_servico_id UUID REFERENCES ordens_servico(id),
    validade DATE,
    usage_limit INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('ativo', 'usado', 'expirado', 'cancelado')) DEFAULT 'ativo',
    categoria TEXT CHECK (categoria IN ('desconto', 'saque')),
    data_uso TIMESTAMP WITH TIME ZONE,
    tipo_uso TEXT,
    motivo_cancelamento TEXT,
    data_cancelamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cliente_promocoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    promocao_id UUID REFERENCES promocoes(id) ON DELETE CASCADE NOT NULL,
    orcamento_id UUID, -- Referência circular tratada depois
    data_ativacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_expiracao TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('ativa', 'usada', 'suspensa', 'cancelado')) DEFAULT 'ativa',
    data_uso TIMESTAMP WITH TIME ZONE,
    motivo_cancelamento TEXT,
    data_cancelamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cliente_premios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    pontos_custo INTEGER NOT NULL,
    status TEXT CHECK (status IN ('disponivel', 'resgatado', 'cancelado')) DEFAULT 'disponivel',
    data_resgate TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 4. VENDAS E OPERAÇÕES
-- ====================================================================================

CREATE TABLE IF NOT EXISTS orcamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_orcamento TEXT UNIQUE,
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    servico_id UUID REFERENCES servicos(id),
    produto_id UUID REFERENCES produtos(id),
    assinatura_id UUID REFERENCES assinaturas(id),
    promocao_id UUID REFERENCES promocoes(id),
    categoria TEXT CHECK (categoria IN ('servico', 'produto', 'assinatura')),
    valor_servico DECIMAL(12,2) DEFAULT 0.00,
    valor_produto DECIMAL(12,2) DEFAULT 0.00,
    valor_assinatura DECIMAL(12,2) DEFAULT 0.00,
    valor_adicional DECIMAL(12,2) DEFAULT 0.00,
    descricao_adicional TEXT,
    acrescimo DECIMAL(12,2) DEFAULT 0.00,
    desconto DECIMAL(12,2) DEFAULT 0.00,
    promocao_desconto_manual DECIMAL(12,2) DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('aberto', 'aprovado', 'cancelado', 'em revisão', 'negociação')) DEFAULT 'aberto',
    fase_negociacao TEXT CHECK (fase_negociacao IN ('cliente', 'admin')),
    quantidade INTEGER DEFAULT 1,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar FK faltante em cliente_promocoes
ALTER TABLE cliente_promocoes ADD CONSTRAINT fk_cliente_promocoes_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS ordens_servico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_os TEXT UNIQUE,
    orcamento_id UUID REFERENCES orcamentos(id),
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    status TEXT CHECK (status IN ('andamento', 'concluido', 'cancelado')) DEFAULT 'andamento',
    data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_fim TIMESTAMP WITH TIME ZONE,
    tipo_entrega TEXT CHECK (tipo_entrega IN ('whatsapp', 'online')),
    link_documento TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS os_notas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    os_id UUID REFERENCES ordens_servico(id) ON DELETE CASCADE,
    nota TEXT NOT NULL,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordens_compra (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_ordem TEXT UNIQUE,
    produto_id UUID REFERENCES produtos(id),
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    status TEXT CHECK (status IN ('em_analise', 'aprovado', 'concluido', 'cancelado')) DEFAULT 'em_analise',
    quantidade INTEGER DEFAULT 1,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordens_assinatura (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_ordem TEXT UNIQUE,
    assinatura_id UUID REFERENCES assinaturas(id),
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    status TEXT CHECK (status IN ('em_analise', 'aprovado', 'concluido', 'cancelado', 'em_cancelamento')) DEFAULT 'em_analise',
    quantidade INTEGER DEFAULT 1,
    prazo_meses INTEGER,
    renovacao_automatica BOOLEAN DEFAULT true,
    data_vencimento TIMESTAMP WITH TIME ZONE,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 5. FINANCEIRO
-- ====================================================================================

CREATE TABLE IF NOT EXISTS faturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_fatura TEXT UNIQUE,
    os_id UUID REFERENCES ordens_servico(id),
    ordem_compra_id UUID REFERENCES ordens_compra(id),
    ordem_assinatura_id UUID REFERENCES ordens_assinatura(id),
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    valor_total DECIMAL(12,2) NOT NULL,
    valor_pago DECIMAL(12,2) DEFAULT 0.00,
    valor_final_pendente DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'pago', 'cancelado', 'revisada', 'vencida', 'aguardando_link', 'pendente_pagamento')) DEFAULT 'pendente',
    tipo TEXT CHECK (tipo IN ('servico', 'produto', 'assinatura', 'pacote_nivel')),
    data_vencimento DATE NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE,
    forma_pagamento_escolhida TEXT,
    mes_referencia TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fatura_id UUID REFERENCES faturas(id) ON DELETE CASCADE,
    voucher_id UUID REFERENCES vouchers(id),
    metodo TEXT CHECK (metodo IN ('pix', 'credito', 'debito', 'carteira', 'pontos', 'voucher', 'indicacao', 'dinheiro')) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS formas_pagamento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT true,
    instrucoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carteira_lancamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    tipo TEXT CHECK (tipo IN ('credito', 'debito')) NOT NULL,
    descricao TEXT,
    data_lancamento TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS extrato_financeiro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    tipo TEXT CHECK (tipo IN ('entrada', 'saida')) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    saldo_resultante DECIMAL(12,2) NOT NULL,
    descricao TEXT,
    data TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saques (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    taxa_aplicada DECIMAL(12,2) DEFAULT 0,
    valor_liquido DECIMAL(12,2) DEFAULT 0,
    tipo_chave_pix TEXT,
    chave_pix TEXT NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'aprovado', 'recusado', 'pago', 'cancelado')) DEFAULT 'pendente',
    data_solicitacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_vencimento TIMESTAMP WITH TIME ZONE,
    data_pagamento TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS transferencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_origem_id UUID REFERENCES clientes(id) NOT NULL,
    cliente_destino_id UUID REFERENCES clientes(id) NOT NULL,
    tipo TEXT CHECK (tipo IN ('saldo', 'pontos')) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    taxa_aplicada DECIMAL(12,2) DEFAULT 0,
    valor_liquido DECIMAL(12,2) DEFAULT 0,
    status TEXT CHECK (status IN ('em_analise', 'aprovado', 'recusado', 'reprovado', 'concluido', 'estornado', 'cancelado')) DEFAULT 'em_analise',
    motivo TEXT,
    data_solicitacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pontos_movimentacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) NOT NULL,
    fatura_id UUID REFERENCES faturas(id),
    tipo TEXT CHECK (tipo IN ('geracao_fatura', 'conversao_dinheiro', 'uso_fatura', 'ajuste_manual', 'estorno', 'bonus_boas_vindas', 'indicacao', 'bonus', 'resgate')) NOT NULL,
    pontos INTEGER NOT NULL,
    saldo_apos INTEGER NOT NULL,
    descricao TEXT,
    valor_convertido DECIMAL(12,2),
    data_movimentacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    pontos INTEGER NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 6. COLABORADORES E PERMISSÕES
-- ====================================================================================

CREATE TABLE IF NOT EXISTS funcoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colaboradores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    telefone TEXT,
    credencial_acesso TEXT UNIQUE NOT NULL,
    funcao_id UUID REFERENCES funcoes(id),
    status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colaborador_modulos (
    colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
    modulo_id TEXT NOT NULL,
    PRIMARY KEY (colaborador_id, modulo_id)
);

CREATE TABLE IF NOT EXISTS solicitacoes_exclusao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colaborador_id UUID REFERENCES colaboradores(id),
    tabela TEXT NOT NULL,
    registro_id UUID NOT NULL,
    motivo TEXT NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'aprovado', 'recusado')) DEFAULT 'pendente',
    data_decisao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 7. ÁREA DO PRESTADOR
-- ====================================================================================

CREATE TABLE IF NOT EXISTS prestadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID,
    tipo_cadastro TEXT CHECK (tipo_cadastro IN ('cpf', 'cnpj')) NOT NULL,
    nome_razao TEXT NOT NULL,
    documento TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    cep TEXT,
    area_servico TEXT,
    credencial_acesso TEXT UNIQUE,
    status TEXT CHECK (status IN ('pendente', 'em_analise', 'ativo', 'suspenso', 'desligado', 'reprovado')) DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_demandas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    os_id UUID REFERENCES ordens_servico(id),
    titulo TEXT NOT NULL,
    descricao TEXT,
    detalhes TEXT,
    valor_proposto_admin DECIMAL(12,2),
    valor_proposto_prestador DECIMAL(12,2),
    valor_final DECIMAL(12,2),
    status TEXT CHECK (status IN ('aberta', 'em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final', 'ativa', 'em_analise', 'concluida', 'recusada', 'cancelada')) DEFAULT 'aberta',
    data_inicio TIMESTAMP WITH TIME ZONE,
    data_conclusao TIMESTAMP WITH TIME ZONE,
    prazo_entrega DATE,
    link_entrega TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_faturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    demanda_id UUID REFERENCES prestador_demandas(id),
    valor DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'aprovado', 'pago', 'cancelado')) DEFAULT 'pendente',
    data_vencimento DATE,
    data_pagamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_saques (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    valor DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('em_analise', 'aprovado', 'recusado', 'pago')) DEFAULT 'em_analise',
    dados_bancarios JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    demanda_id UUID REFERENCES prestador_demandas(id),
    tipo TEXT CHECK (tipo IN ('credito', 'debito')) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    descricao TEXT,
    status TEXT CHECK (status IN ('concluido', 'pendente', 'cancelado')) DEFAULT 'concluido',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    demanda_id UUID REFERENCES prestador_demandas(id),
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('agendado', 'concluido')) DEFAULT 'agendado',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'aprovado', 'rejeitado')) DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_historico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    acao TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestador_suporte_demandas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    demanda_id UUID REFERENCES prestador_demandas(id) ON DELETE CASCADE,
    prestador_id UUID REFERENCES prestadores(id),
    mensagem TEXT NOT NULL,
    resposta_admin TEXT,
    status TEXT CHECK (status IN ('aberta', 'respondido', 'fechado')) DEFAULT 'aberta',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 8. COMUNICAÇÃO E SUPORTE
-- ====================================================================================

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id),
    prestador_id UUID REFERENCES prestadores(id),
    assunto TEXT NOT NULL,
    descricao TEXT NOT NULL,
    status TEXT CHECK (status IN ('aberto', 'em andamento', 'concluido')) DEFAULT 'aberto',
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_fechamento TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ticket_mensagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    autor_id TEXT NOT NULL,
    autor_nome TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('cliente', 'admin', 'prestador')) NOT NULL,
    data_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    modulo TEXT,
    tab TEXT,
    item_id TEXT,
    lida BOOLEAN DEFAULT false,
    tipo TEXT DEFAULT 'sistema',
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indicacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_indicacao TEXT UNIQUE,
    indicador_id UUID REFERENCES clientes(id) NOT NULL,
    indicado_nome TEXT NOT NULL,
    whatsapp_indicado TEXT NOT NULL,
    data_indicacao DATE DEFAULT CURRENT_DATE,
    voucher_id UUID REFERENCES vouchers(id),
    status TEXT CHECK (status IN ('aberta', 'concluída', 'cancelada')) DEFAULT 'aberta',
    data_cadastro_indicado TIMESTAMP WITH TIME ZONE,
    data_conclusao TIMESTAMP WITH TIME ZONE,
    bonus_indicador DECIMAL(12,2) DEFAULT 20.00,
    bonus_indicado DECIMAL(12,2) DEFAULT 10.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 9. GERAÇÃO AUTOMÁTICA DE CÓDIGOS (TRIGGER)
-- ====================================================================================

CREATE OR REPLACE FUNCTION generate_system_code()
RETURNS TRIGGER AS $$
DECLARE
    v_prefix TEXT;
    v_count INTEGER;
BEGIN
    -- Definir prefixo baseado na tabela
    CASE TG_TABLE_NAME
        WHEN 'clientes' THEN v_prefix := 'CL';
        WHEN 'servicos' THEN v_prefix := 'SV';
        WHEN 'produtos' THEN v_prefix := 'PR';
        WHEN 'assinaturas' THEN v_prefix := 'AS';
        WHEN 'promocoes' THEN v_prefix := 'PRO';
        WHEN 'vouchers' THEN v_prefix := 'VO';
        WHEN 'orcamentos' THEN v_prefix := 'OR';
        WHEN 'ordens_servico' THEN v_prefix := 'OS';
        WHEN 'ordens_compra' THEN v_prefix := 'OC';
        WHEN 'ordens_assinatura' THEN v_prefix := 'OA';
        WHEN 'faturas' THEN v_prefix := 'FA';
        WHEN 'indicacoes' THEN v_prefix := 'IND';
        ELSE v_prefix := 'COD';
    END CASE;

    -- Contar registros existentes para gerar o próximo número
    EXECUTE format('SELECT count(*) FROM %I', TG_TABLE_NAME) INTO v_count;
    
    -- Atribuir o código formatado
    CASE TG_TABLE_NAME
        WHEN 'clientes' THEN NEW.codigo_cliente := v_prefix || (100 + v_count + 1);
        WHEN 'servicos' THEN NEW.codigo_servico := v_prefix || (100 + v_count + 1);
        WHEN 'produtos' THEN NEW.codigo_produto := v_prefix || (100 + v_count + 1);
        WHEN 'assinaturas' THEN NEW.codigo_assinatura := v_prefix || (100 + v_count + 1);
        WHEN 'promocoes' THEN NEW.codigo_promocao := v_prefix || (100 + v_count + 1);
        WHEN 'vouchers' THEN NEW.codigo_voucher := v_prefix || (100 + v_count + 1);
        WHEN 'orcamentos' THEN NEW.codigo_orcamento := v_prefix || (1000 + v_count + 1);
        WHEN 'ordens_servico' THEN NEW.codigo_os := v_prefix || (1000 + v_count + 1);
        WHEN 'ordens_compra' THEN NEW.codigo_ordem := v_prefix || (1000 + v_count + 1);
        WHEN 'ordens_assinatura' THEN NEW.codigo_ordem := v_prefix || (1000 + v_count + 1);
        WHEN 'faturas' THEN NEW.codigo_fatura := v_prefix || (1000 + v_count + 1);
        WHEN 'indicacoes' THEN NEW.codigo_indicacao := v_prefix || (100 + v_count + 1);
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de Trigger
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['clientes', 'servicos', 'produtos', 'assinaturas', 'promocoes', 'vouchers', 'orcamentos', 'ordens_servico', 'ordens_compra', 'ordens_assinatura', 'faturas'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_generate_code_%I ON %I', t, t);
        EXECUTE format('CREATE TRIGGER trg_generate_code_%I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION generate_system_code()', t, t);
    END LOOP;
END $$;

-- ====================================================================================
-- 10. REALTIME E RLS
-- ====================================================================================

-- Habilitar RLS em todas as tabelas (Breve resumo)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON public.%I', r.tablename);
        EXECUTE format('CREATE POLICY "Public Full Access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', r.tablename);
    END LOOP;
END $$;

-- Ativar Realtime para todas as tabelas
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', r.tablename);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;


-- ==========================================
-- PROMOÇÕES INTELIGENTES (GSA Store)
-- ==========================================
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

-- Migration para Segurança de Gamificação (Remoção de Autoridade do Cliente)

CREATE OR REPLACE FUNCTION secure_add_gamification_points(
    p_cliente_id UUID,
    p_pontos_gerados NUMERIC,
    p_descricao TEXT,
    p_tipo TEXT,
    p_fatura_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_saldo_atual NUMERIC;
    v_pontos_totais NUMERIC;
    v_nivel_atual UUID;
    v_nivel_manual UUID;
    
    v_novo_saldo NUMERIC;
    v_novos_totais NUMERIC;
    v_novo_nivel UUID;
    v_nome_novo_nivel TEXT;
    v_pontos_por_real NUMERIC;
    
    v_resultado JSONB;
BEGIN
    -- Obter os dados atuais do cliente com bloqueio FOR UPDATE (Evita Race Conditions)
    SELECT saldo_pontos, pontos_totais, nivel_id, nivel_manual_id 
    INTO v_saldo_atual, v_pontos_totais, v_nivel_atual, v_nivel_manual
    FROM clientes 
    WHERE id = p_cliente_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente não encontrado';
    END IF;

    -- Cálculos
    v_novo_saldo := GREATEST(0, COALESCE(v_saldo_atual, 0) + p_pontos_gerados);
    v_novos_totais := GREATEST(0, COALESCE(v_pontos_totais, 0) + p_pontos_gerados);
    v_novo_nivel := v_nivel_atual;
    v_nome_novo_nivel := NULL;

    -- Atualizar cliente
    UPDATE clientes 
    SET saldo_pontos = v_novo_saldo,
        pontos_totais = v_novos_totais
    WHERE id = p_cliente_id;

    -- Gravar movimentações financeiras
    INSERT INTO pontos_movimentacoes (cliente_id, fatura_id, tipo, pontos, saldo_apos, descricao)
    VALUES (p_cliente_id, p_fatura_id, p_tipo, p_pontos_gerados, v_novo_saldo, p_descricao);

    INSERT INTO points_transactions (cliente_id, fatura_id, tipo, pontos, descricao)
    VALUES (p_cliente_id, p_fatura_id, p_tipo, p_pontos_gerados, p_descricao);

    -- Verificar Level Up (se não for manual)
    IF v_nivel_manual IS NULL AND p_pontos_gerados > 0 THEN
        SELECT id, nome_nivel, pontos_por_real 
        INTO v_novo_nivel, v_nome_novo_nivel, v_pontos_por_real
        FROM client_levels 
        WHERE pontos_minimos <= v_novos_totais 
        ORDER BY pontos_minimos DESC 
        LIMIT 1;

        IF v_novo_nivel IS NOT NULL AND v_novo_nivel != v_nivel_atual THEN
            UPDATE clientes SET nivel_id = v_novo_nivel WHERE id = p_cliente_id;
            
            INSERT INTO level_history (cliente_id, nivel_anterior_id, nivel_novo_id)
            VALUES (p_cliente_id, v_nivel_atual, v_novo_nivel);
            
            -- Não enviamos a notificação aqui para manter a camada de apresentação desacoplada,
            -- mas retornamos a flag para o frontend exibir
        END IF;
    END IF;

    -- Retornar o resultado para o frontend
    v_resultado := jsonb_build_object(
        'success', true,
        'novo_saldo', v_novo_saldo,
        'level_up', (v_novo_nivel != v_nivel_atual),
        'novo_nivel_nome', v_nome_novo_nivel,
        'pontos_por_real', v_pontos_por_real
    );

    RETURN v_resultado;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
