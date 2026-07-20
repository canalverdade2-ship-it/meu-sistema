ALTER TABLE faturas ADD COLUMN IF NOT EXISTS pacote_nivel_id TEXT;
COMMENT ON COLUMN faturas.pacote_nivel_id IS 'ID do nível VIP comprado';

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS itens_faturados JSONB;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS historico_pagamentos JSONB;
