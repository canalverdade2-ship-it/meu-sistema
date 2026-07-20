-- Add columns to clientes table
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cadastro_aprovado BOOLEAN DEFAULT true;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bonus_boas_vindas_pendente BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS carteira_bloqueada BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS pontos_bloqueados BOOLEAN DEFAULT false;

-- Add default settings to system_settings
INSERT INTO system_settings (key, value) VALUES
('codigo_cadastro_padrao_ativo', 'false'),
('codigo_cadastro_padrao', 'BEMVINDO'),
('bonus_cadastro_tipo', 'pontos'),
('bonus_cadastro_valor', '100')
ON CONFLICT (key) DO NOTHING;
