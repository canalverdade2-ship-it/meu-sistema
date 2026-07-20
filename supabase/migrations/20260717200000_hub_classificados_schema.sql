-- Create Enums
CREATE TYPE classificados_status_anuncio AS ENUM (
    'rascunho', 'aguardando_revisao', 'ajustes_solicitados', 'aprovado', 
    'publicado', 'pausado', 'reservado', 'vendido', 'rejeitado', 'cancelado', 'arquivado'
);

CREATE TYPE classificados_status_proposta AS ENUM (
    'nova', 'em_analise_gsa', 'aguardando_vendedor', 'aguardando_comprador', 
    'contraproposta', 'aceita', 'rejeitada', 'expirada', 'cancelada'
);

CREATE TYPE classificados_status_transacao AS ENUM (
    'criada', 'aguardando_pagamento_ao_vendedor', 'comprovante_enviado', 
    'pagamento_confirmado', 'em_entrega_ou_transferencia', 'aguardando_confirmacao_comprador', 
    'contestada', 'concluida', 'cancelada', 'reembolsada'
);

CREATE TYPE classificados_status_mensagem AS ENUM (
    'pending_moderation', 'approved', 'rejected'
);

CREATE TYPE classificados_status_comissao AS ENUM (
    'nao_gerada', 'pendente', 'paga', 'vencida', 'contestada', 'ajustada', 'cancelada'
);

-- 1. Configuracoes Globais
CREATE TABLE public.classificados_configuracoes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    modulo_ativo BOOLEAN DEFAULT true,
    imoveis_habilitado BOOLEAN DEFAULT false,
    imoveis_responsavel_tecnico VARCHAR,
    imoveis_numero_registro VARCHAR,
    imoveis_regiao VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize Config
INSERT INTO public.classificados_configuracoes (modulo_ativo) VALUES (true);

-- 2. Configuracoes de Comissão por Categoria
CREATE TABLE public.classificados_comissoes_config (
    categoria VARCHAR PRIMARY KEY, -- 'imoveis', 'veiculos', 'geral'
    percentual DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.classificados_comissoes_config (categoria, percentual) VALUES 
    ('imoveis', 6.00), 
    ('veiculos', 5.00), 
    ('geral', 10.00);

-- 3. Anúncios
CREATE TABLE public.classificados_anuncios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    categoria VARCHAR NOT NULL, -- 'imoveis', 'veiculos', 'geral'
    slug VARCHAR NOT NULL UNIQUE,
    titulo VARCHAR NOT NULL,
    descricao TEXT NOT NULL,
    preco DECIMAL(15,2) NOT NULL,
    cidade VARCHAR NOT NULL,
    estado VARCHAR(2) NOT NULL,
    bairro VARCHAR,
    detalhes JSONB DEFAULT '{}'::jsonb, -- Store specific properties (rooms, km, year, etc)
    status classificados_status_anuncio DEFAULT 'rascunho',
    comissao_aceita_percentual DECIMAL(5,2), -- Snapshot
    motivo_rejeicao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_classificados_anuncios_cliente ON public.classificados_anuncios(cliente_id);
CREATE INDEX idx_classificados_anuncios_status ON public.classificados_anuncios(status);
CREATE INDEX idx_classificados_anuncios_categoria ON public.classificados_anuncios(categoria);

-- 4. Mídias dos Anúncios
CREATE TABLE public.classificados_anuncio_midias (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    anuncio_id UUID REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE NOT NULL,
    url VARCHAR NOT NULL,
    tipo VARCHAR NOT NULL, -- 'image', 'document'
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Propostas
CREATE TABLE public.classificados_propostas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    anuncio_id UUID REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE NOT NULL,
    comprador_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    vendedor_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    valor_proposta DECIMAL(15,2) NOT NULL,
    mensagem_inicial TEXT,
    status classificados_status_proposta DEFAULT 'nova',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_classificados_propostas_comprador ON public.classificados_propostas(comprador_id);
CREATE INDEX idx_classificados_propostas_vendedor ON public.classificados_propostas(vendedor_id);
CREATE INDEX idx_classificados_propostas_anuncio ON public.classificados_propostas(anuncio_id);

-- 6. Transações
CREATE TABLE public.classificados_transacoes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    proposta_id UUID REFERENCES public.classificados_propostas(id) ON DELETE CASCADE NOT NULL,
    anuncio_id UUID REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE NOT NULL,
    comprador_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    vendedor_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    valor_final DECIMAL(15,2) NOT NULL,
    status classificados_status_transacao DEFAULT 'criada',
    instrucoes_pagamento_vendedor TEXT, -- Dados bancários, oculto publicamente
    comissao_snapshot_percentual DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Comprovantes
CREATE TABLE public.classificados_comprovantes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transacao_id UUID REFERENCES public.classificados_transacoes(id) ON DELETE CASCADE NOT NULL,
    enviado_por UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    url VARCHAR NOT NULL,
    analisado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Mensagens (Chat Moderado)
CREATE TABLE public.classificados_mensagens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    proposta_id UUID REFERENCES public.classificados_propostas(id) ON DELETE CASCADE NOT NULL,
    remetente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    destinatario_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    conteudo TEXT NOT NULL,
    status classificados_status_mensagem DEFAULT 'pending_moderation',
    motivo_rejeicao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    moderated_at TIMESTAMPTZ
);

-- 9. Comissões
CREATE TABLE public.classificados_comissoes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transacao_id UUID REFERENCES public.classificados_transacoes(id) ON DELETE CASCADE NOT NULL,
    vendedor_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    valor_comissao DECIMAL(15,2) NOT NULL,
    status classificados_status_comissao DEFAULT 'pendente',
    fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL, -- Link to existing fatura system
    data_vencimento TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.classificados_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_comissoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_anuncio_midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_comprovantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_comissoes ENABLE ROW LEVEL SECURITY;

-- Configurações e Comissões Config (Public Read, Admin Write)
CREATE POLICY "Public read classificados config" ON public.classificados_configuracoes FOR SELECT USING (true);
CREATE POLICY "Public read classificados comissoes config" ON public.classificados_comissoes_config FOR SELECT USING (true);

-- Anúncios
-- Visitantes podem ver anúncios aprovados/publicados.
CREATE POLICY "Public read active ads" ON public.classificados_anuncios FOR SELECT USING (
    status IN ('publicado', 'reservado', 'vendido')
);
-- Vendedor pode ver seus próprios anúncios sempre.
CREATE POLICY "Seller read own ads" ON public.classificados_anuncios FOR SELECT USING (
    cliente_id = auth.uid()
);
-- Admin vê tudo. (Assuming typical GSA role check bypass via service role or admin functions)

-- Mídias
CREATE POLICY "Public read ad media" ON public.classificados_anuncio_midias FOR SELECT USING (true);

-- Propostas (Comprador e Vendedor vêem as suas)
CREATE POLICY "Participants read own proposals" ON public.classificados_propostas FOR SELECT USING (
    comprador_id = auth.uid() OR vendedor_id = auth.uid()
);

-- Transações (Comprador e Vendedor vêem as suas)
CREATE POLICY "Participants read own transactions" ON public.classificados_transacoes FOR SELECT USING (
    comprador_id = auth.uid() OR vendedor_id = auth.uid()
);

-- Comprovantes
CREATE POLICY "Participants read own receipts" ON public.classificados_comprovantes FOR SELECT USING (
    transacao_id IN (
        SELECT id FROM public.classificados_transacoes WHERE comprador_id = auth.uid() OR vendedor_id = auth.uid()
    )
);

-- Mensagens (Moderado)
-- Remetente sempre vê a sua (mesmo pendente/rejeitada). 
-- Destinatário só vê se aprovada.
CREATE POLICY "Users read chat messages" ON public.classificados_mensagens FOR SELECT USING (
    remetente_id = auth.uid() OR (destinatario_id = auth.uid() AND status = 'approved')
);

-- Comissões (Vendedor)
CREATE POLICY "Seller read own commissions" ON public.classificados_comissoes FOR SELECT USING (
    vendedor_id = auth.uid()
);
