-- Atualiza constraint do status em viagens_transacoes para incluir reembolso_aprovado e reembolso_negado
ALTER TABLE public.viagens_transacoes DROP CONSTRAINT IF EXISTS viagens_transacoes_status_check;

ALTER TABLE public.viagens_transacoes
  ADD CONSTRAINT viagens_transacoes_status_check
  CHECK (status IN (
    'pendente',
    'pagamento_confirmado',
    'compra_fornecedor_pendente',
    'compra_fornecedor_em_andamento',
    'pacote_adquirido',
    'emissao_em_andamento',
    'documentos_disponiveis',
    'viagem_confirmada',
    'concluida',
    'cancelada',
    'reembolso_em_analise',
    'reembolso_solicitado',
    'reembolso_aprovado',
    'reembolsada',
    'reembolso_negado'
  ));

NOTIFY pgrst, 'reload schema';
