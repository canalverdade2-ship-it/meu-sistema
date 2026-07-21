-- Adiciona colunas de resposta do admin e reembolso em viagens_transacoes
ALTER TABLE public.viagens_transacoes
  ADD COLUMN IF NOT EXISTS resposta_admin text,
  ADD COLUMN IF NOT EXISTS valor_reembolsado numeric(10, 2),
  ADD COLUMN IF NOT EXISTS taxa_cancelamento numeric(10, 2);

COMMENT ON COLUMN public.viagens_transacoes.resposta_admin IS 'Parecer e resposta da administração ao cliente sobre a decisão de reembolso';
COMMENT ON COLUMN public.viagens_transacoes.valor_reembolsado IS 'Valor líquido final efetivamente aprovado e reembolsado ao cliente';
COMMENT ON COLUMN public.viagens_transacoes.taxa_cancelamento IS 'Taxas ou retenções de cancelamento descontadas no processo';

NOTIFY pgrst, 'reload schema';
