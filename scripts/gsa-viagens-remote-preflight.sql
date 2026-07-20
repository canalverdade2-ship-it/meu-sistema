SELECT
  expected.table_name,
  to_regclass(format('public.%I', expected.table_name)) IS NOT NULL AS exists
FROM (
  VALUES
    ('clientes'),
    ('faturas'),
    ('viagens_orcamentos'),
    ('viagens_pacotes'),
    ('viagens_propostas'),
    ('viagens_passageiros'),
    ('viagens_transacoes'),
    ('viagens_cancelamentos')
) AS expected(table_name)
ORDER BY expected.table_name;

SELECT
  c.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'viagens_orcamentos',
    'viagens_propostas',
    'viagens_passageiros',
    'viagens_transacoes',
    'viagens_cancelamentos',
    'faturas'
  )
ORDER BY c.relname, con.conname;

SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'clientes',
    'faturas',
    'viagens_orcamentos',
    'viagens_pacotes',
    'viagens_propostas',
    'viagens_passageiros',
    'viagens_transacoes',
    'viagens_cancelamentos'
  )
  AND column_name IN (
    'id',
    'user_id',
    'cliente_id',
    'proposta_id',
    'transacao_id',
    'pacote_id',
    'fatura_id',
    'status',
    'forma_pagamento',
    'prazo_aceitacao',
    'prazo_pagamento',
    'snapshot_completo',
    'valor_total',
    'valor_pago',
    'valor_solicitado',
    'nome',
    'email',
    'telefone'
  )
ORDER BY table_name, ordinal_position;

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('viagens_orcamentos', 'viagens_transacoes')
ORDER BY tablename, indexname;

SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN ('20260720120000', '20260720123000', '20260720130000')
ORDER BY version;
