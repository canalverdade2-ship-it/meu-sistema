-- Adicionar coluna forma_pagamento na tabela cobranca_acordo_parcelas
ALTER TABLE cobranca_acordo_parcelas 
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT NULL;

-- Comentário para referência
COMMENT ON COLUMN cobranca_acordo_parcelas.forma_pagamento IS 'Forma de pagamento: pix, boleto, transferencia, cartao_credito, cartao_debito, dinheiro, cheque, outro';
