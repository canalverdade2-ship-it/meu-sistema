-- Criar tabela de promoções se não existir
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

-- Criar tabela de ativações de promoções por cliente se não existir
CREATE TABLE IF NOT EXISTS cliente_promocoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    promocao_id UUID REFERENCES promocoes(id) ON DELETE CASCADE NOT NULL,
    data_ativacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_expiracao TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('ativa', 'usada', 'suspensa', 'cancelado')) DEFAULT 'ativa',
    orcamento_id UUID REFERENCES orcamentos(id) ON DELETE SET NULL,
    data_uso TIMESTAMP WITH TIME ZONE,
    motivo_cancelamento TEXT,
    data_cancelamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir que as colunas existam (caso a tabela já existisse sem elas)
ALTER TABLE cliente_promocoes ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE cliente_promocoes ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMP WITH TIME ZONE;

-- Atualizar constraint de status se necessário
DO $$ 
BEGIN 
    ALTER TABLE cliente_promocoes DROP CONSTRAINT IF EXISTS cliente_promocoes_status_check;
    ALTER TABLE cliente_promocoes ADD CONSTRAINT cliente_promocoes_status_check 
    CHECK (status IN ('ativa', 'usada', 'suspensa', 'cancelado'));
EXCEPTION 
    WHEN undefined_object THEN 
        NULL;
END $$;

-- Função para gerar código de promoção (PR100)
CREATE OR REPLACE FUNCTION generate_promo_code() RETURNS TRIGGER AS $$
DECLARE
    next_val INTEGER;
BEGIN
    IF NEW.codigo_promocao IS NOT NULL AND NEW.codigo_promocao != '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_promocao, 3) AS INTEGER)), 99) + 1 INTO next_val 
    FROM promocoes 
    WHERE codigo_promocao LIKE 'PR%';
    
    NEW.codigo_promocao := 'PR' || next_val;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar código de promoção
DROP TRIGGER IF EXISTS trg_promo_code ON promocoes;
CREATE TRIGGER trg_promo_code BEFORE INSERT ON promocoes FOR EACH ROW EXECUTE FUNCTION generate_promo_code();
