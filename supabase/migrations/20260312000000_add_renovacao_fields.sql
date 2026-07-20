ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS origem_renovacao_id UUID;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS tipo_renovacao TEXT CHECK (tipo_renovacao IN ('comprar_novamente', 'assinar_novamente', 'renovar_assinatura'));

ALTER TABLE ordens_assinatura ADD COLUMN IF NOT EXISTS prazo_meses INTEGER;
ALTER TABLE ordens_assinatura ADD COLUMN IF NOT EXISTS renovacao_automatica BOOLEAN DEFAULT false;
ALTER TABLE ordens_assinatura ADD COLUMN IF NOT EXISTS data_vencimento TIMESTAMP WITH TIME ZONE;
ALTER TABLE ordens_assinatura ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMP WITH TIME ZONE;
ALTER TABLE ordens_assinatura ADD COLUMN IF NOT EXISTS valor_proporcional_cancelamento DECIMAL(10,2);

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS gerada_automaticamente BOOLEAN DEFAULT false;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS mes_referencia VARCHAR(7);
