-- Atualização da tabela de vouchers para suportar a categoria de Saque
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'desconto',
ADD COLUMN IF NOT EXISTS data_uso TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tipo_uso TEXT;

-- Comentário para documentação
COMMENT ON COLUMN vouchers.categoria IS 'Define se o voucher é de desconto em fatura ou resgate para carteira (saque)';
COMMENT ON COLUMN vouchers.data_uso IS 'Data em que o voucher foi utilizado ou resgatado';
COMMENT ON COLUMN vouchers.tipo_uso IS 'Descrição do tipo de uso (ex: Resgate para Carteira, Desconto na Fatura X)';
