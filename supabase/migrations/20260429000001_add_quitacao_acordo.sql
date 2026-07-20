ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS valor_quitacao_acordo numeric;

-- Atualizar o CHECK constraint de status
ALTER TABLE emprestimos DROP CONSTRAINT IF EXISTS emprestimos_status_check;
ALTER TABLE emprestimos ADD CONSTRAINT emprestimos_status_check CHECK (status = ANY (ARRAY[
  'analise_inicial'::text, 
  'proposta_enviada'::text, 
  'proposta_expirada'::text, 
  'aguardando_dados_bancarios'::text, 
  'analise_final'::text, 
  'pendencia_assinatura'::text, 
  'analise_contrato'::text, 
  'pendencia_documentos'::text, 
  'aprovado'::text, 
  'ativo'::text, 
  'analise_quitacao'::text, 
  'aguardando_pagamento_quitacao'::text, 
  'quitado'::text, 
  'cancelado'::text
]));
