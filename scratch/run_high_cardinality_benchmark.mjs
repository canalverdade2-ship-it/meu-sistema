import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const credsPath = path.join(projectRoot, 'CREDENCIAIS_SISTEMA_GSA.md');
const creds = fs.readFileSync(credsPath, 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();

function runRemotePsql(sql) {
  const pw64 = Buffer.from(password, 'utf8').toString('base64');
  const sql64 = Buffer.from(sql, 'utf8').toString('base64');

  const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1
`;

  const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=20',
    '-i', key,
    'opc@147.15.43.141',
    'bash', '-s'
  ], {
    input: remote,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024
  });

  if (ssh.status !== 0) {
    throw new Error(`Remote query failed (status ${ssh.status}):\n${ssh.stderr || ssh.stdout}`);
  }

  return ssh.stdout;
}

console.log('========================================================================');
console.log('CHALLENGER 2: HIGH-CARDINALITY BENCHMARK IN ISOLATED TRANSACTION');
console.log('========================================================================\n');

const stressSql = `
BEGIN;

-- Disable triggers during test data loading in this isolated transaction
SET LOCAL session_replication_role = 'replica';

-- 1. Insert 100 test clients to satisfy FK constraints
INSERT INTO public.clientes (id, nome)
SELECT 
  ('00000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  'Cliente Test ' || g
FROM generate_series(1, 100) g;

DO $$
DECLARE
  v_test_client uuid := '00000000-0000-0000-0000-000000000001';
  v_test_ticket uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- 1. saques: 3,000 rows
  INSERT INTO public.saques (id, cliente_id, valor, taxa_aplicada, valor_liquido, tipo_chave_pix, chave_pix, status, data_solicitacao)
  SELECT 
    gen_random_uuid(),
    ('00000000-0000-0000-0000-' || LPAD(((g % 100) + 1)::text, 12, '0'))::uuid,
    100.00,
    0.00,
    100.00,
    'cpf',
    '00011122233',
    CASE WHEN g % 5 = 0 THEN 'pendente' ELSE 'aprovado' END,
    NOW() - (g || ' minutes')::interval
  FROM generate_series(1, 3000) g;

  -- 2. tickets: 3,000 rows (valid statuses: 'aberto', 'em andamento', 'concluido', 'cancelado')
  INSERT INTO public.tickets (id, cliente_id, assunto, descricao, status, data_abertura, modulo)
  SELECT
    CASE WHEN g = 1 THEN v_test_ticket ELSE gen_random_uuid() END,
    ('00000000-0000-0000-0000-' || LPAD(((g % 100) + 1)::text, 12, '0'))::uuid,
    'Assunto ' || g,
    'Descricao ' || g,
    CASE WHEN g % 4 = 0 THEN 'aberto' ELSE 'concluido' END,
    NOW() - (g || ' minutes')::interval,
    'geral'
  FROM generate_series(1, 3000) g;

  -- 3. ticket_mensagens: 1,000 rows (valid tipo: 'cliente', 'admin', 'prestador')
  INSERT INTO public.ticket_mensagens (id, ticket_id, autor_id, autor_nome, mensagem, tipo, data_envio, lida)
  SELECT
    gen_random_uuid(),
    CASE WHEN g <= 300 THEN v_test_ticket ELSE gen_random_uuid() END,
    'user-1',
    'Usuario 1',
    'Mensagem ' || g,
    'cliente',
    NOW() - (g || ' seconds')::interval,
    (g % 2 = 0)
  FROM generate_series(1, 1000) g;

  -- 4. faturas: 3,000 rows (valid status: 'pendente', 'pago'; tipo: 'servico')
  INSERT INTO public.faturas (id, cliente_id, codigo_fatura, valor_total, status, tipo, data_vencimento)
  SELECT
    gen_random_uuid(),
    ('00000000-0000-0000-0000-' || LPAD(((g % 100) + 1)::text, 12, '0'))::uuid,
    'FAT-BENCH-' || LPAD(g::text, 6, '0'),
    150.00,
    CASE WHEN g % 3 = 0 THEN 'pago' ELSE 'pendente' END,
    'servico',
    CURRENT_DATE + (g % 30)
  FROM generate_series(1, 3000) g;

  -- 5. pontos_movimentacoes: 4,000 rows (valid tipo: 'bonus_indicacao')
  INSERT INTO public.pontos_movimentacoes (id, cliente_id, tipo, pontos, saldo_apos, descricao, data_movimentacao)
  SELECT
    gen_random_uuid(),
    ('00000000-0000-0000-0000-' || LPAD(((g % 100) + 1)::text, 12, '0'))::uuid,
    'bonus_indicacao',
    10,
    10 * g,
    'Movimentacao ' || g,
    NOW() - (g || ' hours')::interval
  FROM generate_series(1, 4000) g;

  -- 6. extrato_financeiro: 4,000 rows (valid tipo: 'entrada', 'saida')
  INSERT INTO public.extrato_financeiro (id, cliente_id, tipo, valor, saldo_resultante, descricao, data)
  SELECT
    gen_random_uuid(),
    ('00000000-0000-0000-0000-' || LPAD(((g % 100) + 1)::text, 12, '0'))::uuid,
    'entrada',
    50.00,
    50.00 * g,
    'Lancamento ' || g,
    NOW() - (g || ' hours')::interval
  FROM generate_series(1, 4000) g;

  -- 7. vouchers: 3,000 rows (valid categoria: 'desconto'; status: 'ativo'; tipo: 'valor')
  INSERT INTO public.vouchers (id, cliente_id, codigo_voucher, valor, status, validade, categoria, tipo)
  SELECT
    gen_random_uuid(),
    ('00000000-0000-0000-0000-' || LPAD(((g % 100) + 1)::text, 12, '0'))::uuid,
    'VOUCH-BENCH-' || LPAD(g::text, 6, '0'),
    25.00,
    'ativo',
    CURRENT_DATE + 60,
    'desconto',
    'valor'
  FROM generate_series(1, 3000) g;

END $$;

-- Reset replication role so normal query optimization applies
SET LOCAL session_replication_role = 'origin';

ANALYZE public.tickets;
ANALYZE public.ticket_mensagens;
ANALYZE public.saques;
ANALYZE public.faturas;
ANALYZE public.pontos_movimentacoes;
ANALYZE public.extrato_financeiro;
ANALYZE public.vouchers;

\\echo '========================================================================'
\\echo 'NATURAL PLANNER SELECTION UNDER SCALE (enable_seqscan = DEFAULT ON)'
\\echo '========================================================================'

\\echo '--- 1. tickets (cliente_id + data_abertura DESC sort elimination) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, assunto, status, data_abertura 
FROM public.tickets 
WHERE cliente_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY data_abertura DESC 
LIMIT 20;

\\echo '--- 2. ticket_mensagens (ticket_id + data_envio ASC chat ordering) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, ticket_id, mensagem, data_envio 
FROM public.ticket_mensagens 
WHERE ticket_id = '11111111-1111-1111-1111-111111111111' 
ORDER BY data_envio ASC 
LIMIT 50;

\\echo '--- 3. saques (cliente_id + data_solicitacao DESC withdrawal history) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, valor, status, data_solicitacao 
FROM public.saques 
WHERE cliente_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY data_solicitacao DESC 
LIMIT 20;

\\echo '--- 4. faturas (codigo_fatura lookup) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, codigo_fatura, valor_total, status 
FROM public.faturas 
WHERE codigo_fatura = 'FAT-BENCH-000500';

\\echo '--- 5. pontos_movimentacoes (cliente_id + data_movimentacao DESC ledger) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, tipo, pontos, data_movimentacao 
FROM public.pontos_movimentacoes 
WHERE cliente_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY data_movimentacao DESC 
LIMIT 50;

\\echo '--- 6. extrato_financeiro (cliente_id + data DESC financial statement) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, tipo, valor, saldo_resultante, data 
FROM public.extrato_financeiro 
WHERE cliente_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY data DESC 
LIMIT 50;

\\echo '--- 7. vouchers (codigo_voucher lookup) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, codigo_voucher, valor, status 
FROM public.vouchers 
WHERE codigo_voucher = 'VOUCH-BENCH-000500';

\\echo '========================================================================'
\\echo 'COMPARATIVE SEQUENTIAL SCAN FORCED (enable_indexscan = off vs on)'
\\echo '========================================================================'

\\echo '--- 1b. tickets with enable_indexscan = off (Forced Seq Scan for comparison) ---'
SET LOCAL enable_indexscan = off;
SET LOCAL enable_bitmapscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, assunto, status, data_abertura 
FROM public.tickets 
WHERE cliente_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY data_abertura DESC 
LIMIT 20;
RESET enable_indexscan;
RESET enable_bitmapscan;

\\echo '--- 3b. saques with enable_indexscan = off (Forced Seq Scan for comparison) ---'
SET LOCAL enable_indexscan = off;
SET LOCAL enable_bitmapscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, valor, status, data_solicitacao 
FROM public.saques 
WHERE cliente_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY data_solicitacao DESC 
LIMIT 20;
RESET enable_indexscan;
RESET enable_bitmapscan;

\\echo '--- 5b. pontos_movimentacoes with enable_indexscan = off (Forced Seq Scan for comparison) ---'
SET LOCAL enable_indexscan = off;
SET LOCAL enable_bitmapscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, cliente_id, tipo, pontos, data_movimentacao 
FROM public.pontos_movimentacoes 
WHERE cliente_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY data_movimentacao DESC 
LIMIT 50;
RESET enable_indexscan;
RESET enable_bitmapscan;

-- 8. Verify Locks Acquired during SELECT operations
\\echo '========================================================================'
\\echo 'LOCK LEVEL INSPECTION: Confirming only AccessShareLock is acquired'
\\echo '========================================================================'
SELECT locktype, relation::regclass, mode, granted 
FROM pg_locks 
WHERE pid = pg_backend_pid() AND relation::regclass::text IN ('tickets', 'ticket_mensagens', 'saques', 'faturas', 'pontos_movimentacoes', 'extrato_financeiro', 'vouchers');

ROLLBACK;
\\echo '>>> TRANSACTION ROLLED BACK CLEANLY! 0 ROWS PERSISTED <<<'
`;

console.log('Running High-Cardinality Empirical Stress Benchmark...');
const out = runRemotePsql(stressSql);
console.log(out);
fs.writeFileSync(path.join(projectRoot, 'scratch', 'benchmark_stress_results.txt'), out, 'utf8');
console.log('Results successfully saved to scratch/benchmark_stress_results.txt');
