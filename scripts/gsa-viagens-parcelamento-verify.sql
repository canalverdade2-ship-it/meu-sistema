-- Auditoria não destrutiva do parcelamento do checkout de viagens.

DO $audit$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'viagens_transacoes'
      AND column_name = 'parcelas'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Coluna viagens_transacoes.parcelas ausente ou incompatível.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'viagens_transacoes'
      AND column_name = 'valor_parcela'
  ) THEN
    RAISE EXCEPTION 'Coluna viagens_transacoes.valor_parcela ausente.';
  END IF;

  IF to_regprocedure('public.gsa_client_checkout_travel(uuid,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'RPC gsa_client_checkout_travel ausente.';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.gsa_client_checkout_travel(uuid,text,jsonb)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.gsa_client_checkout_travel(uuid,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Permissões da RPC de checkout de viagens incorretas.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_faturas_viagem_transacao_metadata'
  ) THEN
    RAISE EXCEPTION 'Índice de faturas por transação ausente.';
  END IF;
END;
$audit$;

SELECT
  'gsa_viagens_parcelamento' AS module,
  true AS transaction_installments_ready,
  true AS installment_invoices_ready,
  true AS checkout_rpc_ready;
