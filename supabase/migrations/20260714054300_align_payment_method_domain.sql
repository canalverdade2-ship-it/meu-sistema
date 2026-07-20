-- Align the ledger constraint with the payment methods exposed by the product.

ALTER TABLE public.pagamentos
  DROP CONSTRAINT IF EXISTS pagamentos_metodo_check;

ALTER TABLE public.pagamentos
  ADD CONSTRAINT pagamentos_metodo_check
  CHECK (metodo IN (
    'pix',
    'pix_manual',
    'pix_infinitepay',
    'credito',
    'debito',
    'carteira',
    'pontos',
    'voucher',
    'indicacao',
    'dinheiro',
    'transferencia',
    'boleto',
    'boleto_manual',
    'cartao',
    'manual',
    'manual_dashboard'
  ));

