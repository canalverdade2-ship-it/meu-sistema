-- Migration: GSA Viagens Schema e Políticas de Segurança
-- Criado para a implantação do Hub GSA Viagens

-- 1. Configuracoes
CREATE TABLE IF NOT EXISTS public.viagens_configuracoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_comercial TEXT NOT NULL DEFAULT 'GSA Viagens',
    email_atendimento TEXT,
    telefone_atendimento TEXT,
    whatsapp_atendimento TEXT,
    cadastur_numero TEXT,
    cadastur_validade DATE,
    responsavel_nome TEXT,
    responsavel_documento TEXT,
    termos_servico TEXT,
    politica_privacidade TEXT,
    politica_cancelamento TEXT,
    prazo_padrao_proposta_horas INTEGER DEFAULT 48,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fornecedores (Uso Interno Administrativo Apenas)
CREATE TABLE IF NOT EXISTS public.viagens_fornecedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo TEXT CHECK(tipo IN ('site', 'loja_fisica', 'operadora')),
    nome_interno TEXT NOT NULL,
    url_original TEXT,
    cidade TEXT,
    telefone TEXT,
    contato_nome TEXT,
    autorizacao_revenda BOOLEAN DEFAULT false,
    autorizacao_imagens BOOLEAN DEFAULT false,
    observacoes TEXT,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Pacotes de Viagem
CREATE TABLE IF NOT EXISTS public.viagens_pacotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    categoria TEXT CHECK(categoria IN ('nacional', 'internacional', 'excursao')),
    
    origem TEXT,
    destino TEXT,
    data_ida DATE,
    data_volta DATE,
    dias INTEGER,
    noites INTEGER,
    
    hotel_nome TEXT,
    hotel_categoria TEXT,
    acomodacao_tipo TEXT,
    alimentacao TEXT,
    
    transporte_tipo TEXT,
    companhia_executor TEXT,
    bagagem_inclusa TEXT,
    traslado_incluso BOOLEAN DEFAULT false,
    
    itinerario JSONB,
    inclusoes JSONB,
    exclusoes JSONB,
    regras JSONB,
    documentacao_necessaria JSONB,
    
    fornecedor_id UUID REFERENCES public.viagens_fornecedores(id),
    codigo_oferta_fornecedor TEXT,
    preco_custo NUMERIC(10, 2),
    taxas_fornecedor NUMERIC(10, 2),
    margem_porcentagem NUMERIC(5, 2),
    margem_valor NUMERIC(10, 2),
    
    preco_venda NUMERIC(10, 2) NOT NULL,
    preco_crianca NUMERIC(10, 2),
    preco_bebe NUMERIC(10, 2),
    parcelamento_maximo INTEGER DEFAULT 1,
    
    limite_vendas INTEGER,
    vendas_realizadas INTEGER DEFAULT 0,
    prazo_promocao TIMESTAMPTZ,
    data_ultima_verificacao TIMESTAMPTZ,
    
    status TEXT DEFAULT 'rascunho' CHECK(status IN ('rascunho', 'aguardando_revisao', 'publicado', 'disponibilidade_sob_consulta', 'pausado', 'esgotado', 'expirado', 'cancelado', 'arquivado')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Imagens dos Pacotes
CREATE TABLE IF NOT EXISTS public.viagens_pacote_imagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pacote_id UUID REFERENCES public.viagens_pacotes(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_capa BOOLEAN DEFAULT false,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Orçamentos Recebidos
CREATE TABLE IF NOT EXISTS public.viagens_orcamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id),
    nome TEXT,
    email TEXT,
    telefone TEXT,
    
    origem TEXT,
    destino TEXT,
    aceita_sugestoes BOOLEAN DEFAULT true,
    tipo TEXT,
    data_ida DATE,
    data_volta DATE,
    flexibilidade TEXT,
    
    adultos INTEGER DEFAULT 1,
    criancas INTEGER DEFAULT 0,
    idades_criancas JSONB,
    bebes INTEGER DEFAULT 0,
    dias INTEGER,
    
    preferencia_hospedagem TEXT,
    preferencia_voo TEXT,
    necessidades_acessibilidade TEXT,
    observacoes TEXT,
    
    status TEXT DEFAULT 'recebido' CHECK(status IN ('recebido', 'em_analise', 'buscando_opcoes', 'propostas_disponiveis', 'aguardando_cliente', 'proposta_aceita', 'convertido_em_reserva', 'encerrado', 'cancelado')),
    
    protocolo TEXT UNIQUE NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Reservas de Pacotes (Check de Disponibilidade)
CREATE TABLE IF NOT EXISTS public.viagens_solicitacoes_reserva (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pacote_id UUID REFERENCES public.viagens_pacotes(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
    protocolo TEXT UNIQUE NOT NULL,
    
    adultos INTEGER DEFAULT 1,
    criancas INTEGER DEFAULT 0,
    bebes INTEGER DEFAULT 0,
    
    snapshot_pacote JSONB,
    
    status TEXT DEFAULT 'verificando_disponibilidade',
    observacoes_cliente TEXT,
    observacoes_admin TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Propostas
CREATE TABLE IF NOT EXISTS public.viagens_propostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserva_id UUID REFERENCES public.viagens_solicitacoes_reserva(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
    
    snapshot_completo JSONB NOT NULL,
    
    valor_por_adulto NUMERIC(10, 2),
    valor_por_crianca NUMERIC(10, 2),
    valor_por_bebe NUMERIC(10, 2),
    taxas NUMERIC(10, 2) DEFAULT 0,
    valor_total NUMERIC(10, 2) NOT NULL,
    
    parcelamento_permitido INTEGER DEFAULT 1,
    condicoes TEXT,
    
    prazo_aceitacao TIMESTAMPTZ NOT NULL,
    prazo_pagamento TIMESTAMPTZ NOT NULL,
    
    status TEXT DEFAULT 'rascunho' CHECK(status IN ('rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada', 'substituida', 'cancelada')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    aceito_em TIMESTAMPTZ
);

-- 8. Passageiros
CREATE TABLE IF NOT EXISTS public.viagens_passageiros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposta_id UUID REFERENCES public.viagens_propostas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
    
    nome_completo TEXT NOT NULL,
    data_nascimento DATE NOT NULL,
    nacionalidade TEXT DEFAULT 'Brasileiro',
    cpf TEXT,
    tipo_documento TEXT,
    numero_documento TEXT,
    orgao_emissor TEXT,
    data_emissao DATE,
    data_validade DATE,
    
    passaporte TEXT,
    pais_emissor TEXT,
    visto TEXT,
    
    contato_emergencia TEXT,
    necessidade_assistencia TEXT,
    
    tipo_passageiro TEXT CHECK(tipo_passageiro IN ('adulto', 'crianca', 'bebe')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Documentos de Passageiros
CREATE TABLE IF NOT EXISTS public.viagens_passageiro_documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passageiro_id UUID REFERENCES public.viagens_passageiros(id) ON DELETE CASCADE,
    tipo_documento TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    verificado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Transações e Estado da Viagem
CREATE TABLE IF NOT EXISTS public.viagens_transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposta_id UUID REFERENCES public.viagens_propostas(id) UNIQUE NOT NULL,
    cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
    fatura_id UUID REFERENCES public.faturas(id),
    
    valor_pago NUMERIC(10, 2) NOT NULL,
    
    status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente', 'pagamento_confirmado', 'compra_fornecedor_pendente', 'compra_fornecedor_em_andamento', 'pacote_adquirido', 'emissao_em_andamento', 'documentos_disponiveis', 'viagem_confirmada', 'concluida', 'cancelada', 'reembolso_em_analise', 'reembolsada')),
    
    codigo_reserva_fornecedor TEXT,
    comprovante_compra_storage TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Vouchers (Para download do cliente)
CREATE TABLE IF NOT EXISTS public.viagens_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transacao_id UUID REFERENCES public.viagens_transacoes(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Cancelamentos e Reembolsos
CREATE TABLE IF NOT EXISTS public.viagens_cancelamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transacao_id UUID REFERENCES public.viagens_transacoes(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
    
    motivo TEXT NOT NULL,
    valor_solicitado NUMERIC(10, 2),
    taxas_aplicaveis NUMERIC(10, 2),
    valor_reembolsado NUMERIC(10, 2),
    
    status TEXT DEFAULT 'solicitado' CHECK(status IN ('solicitado', 'em_analise', 'reembolso_aprovado', 'reembolso_negado', 'concluido')),
    resposta_gsa TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_viagens_pacotes_categoria ON public.viagens_pacotes(categoria);
CREATE INDEX IF NOT EXISTS idx_viagens_pacotes_status ON public.viagens_pacotes(status);
CREATE INDEX IF NOT EXISTS idx_viagens_solicitacoes_cliente ON public.viagens_solicitacoes_reserva(cliente_id);
CREATE INDEX IF NOT EXISTS idx_viagens_propostas_cliente ON public.viagens_propostas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_viagens_transacoes_cliente ON public.viagens_transacoes(cliente_id);

-- RLS (ROW LEVEL SECURITY)
ALTER TABLE public.viagens_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_pacote_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_solicitacoes_reserva ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_passageiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_passageiro_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_cancelamentos ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS

-- Configurações e Pacotes (Leitura Pública)
CREATE POLICY "Leitura pública configuracoes" ON public.viagens_configuracoes FOR SELECT USING (true);
CREATE POLICY "Leitura pacotes publicados" ON public.viagens_pacotes FOR SELECT USING (status IN ('publicado', 'disponibilidade_sob_consulta', 'esgotado'));
CREATE POLICY "Leitura imagens pacotes" ON public.viagens_pacote_imagens FOR SELECT USING (true);

-- Dados Privados dos Clientes (Leitura própria)
CREATE POLICY "Cliente ve seus orcamentos" ON public.viagens_orcamentos FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente ve suas reservas" ON public.viagens_solicitacoes_reserva FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente ve suas propostas" ON public.viagens_propostas FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente ve seus passageiros" ON public.viagens_passageiros FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente ve documentos seus passageiros" ON public.viagens_passageiro_documentos FOR SELECT USING (passageiro_id IN (SELECT id FROM public.viagens_passageiros WHERE auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id)));
CREATE POLICY "Cliente ve suas transacoes" ON public.viagens_transacoes FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente ve seus vouchers" ON public.viagens_vouchers FOR SELECT USING (transacao_id IN (SELECT id FROM public.viagens_transacoes WHERE auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id)));
CREATE POLICY "Cliente ve seus cancelamentos" ON public.viagens_cancelamentos FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));

-- Clientes Inserindo Dados (Via Autenticação e RPCs ou Restrito)
CREATE POLICY "Cliente insere orcamentos" ON public.viagens_orcamentos FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id) OR cliente_id IS NULL);
CREATE POLICY "Cliente insere reservas" ON public.viagens_solicitacoes_reserva FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente atualiza reservas" ON public.viagens_solicitacoes_reserva FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente atualiza suas propostas (aceite)" ON public.viagens_propostas FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente insere passageiros" ON public.viagens_passageiros FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente atualiza passageiros" ON public.viagens_passageiros FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente deleta passageiros" ON public.viagens_passageiros FOR DELETE USING (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Cliente insere documentos passageiros" ON public.viagens_passageiro_documentos FOR INSERT WITH CHECK (passageiro_id IN (SELECT id FROM public.viagens_passageiros WHERE auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id)));
CREATE POLICY "Cliente deleta documentos passageiros" ON public.viagens_passageiro_documentos FOR DELETE USING (passageiro_id IN (SELECT id FROM public.viagens_passageiros WHERE auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id)));
CREATE POLICY "Cliente solicita cancelamento" ON public.viagens_cancelamentos FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.clientes WHERE id = cliente_id));
