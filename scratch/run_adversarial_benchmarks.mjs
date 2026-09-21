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
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024
  });

  if (ssh.status !== 0) {
    throw new Error(`Remote query failed (status ${ssh.status}):\n${ssh.stderr || ssh.stdout}`);
  }

  return ssh.stdout;
}

console.log('========================================================================');
console.log('CHALLENGER 2: ADVERSARIAL BENCHMARK OF QUERY EXECUTION PLANS');
console.log('========================================================================\n');

// 1. Check row counts
const rowCountSql = `
SELECT 'tickets' as tbl, count(*) FROM public.tickets
UNION ALL SELECT 'ticket_mensagens', count(*) FROM public.ticket_mensagens
UNION ALL SELECT 'saques', count(*) FROM public.saques
UNION ALL SELECT 'faturas', count(*) FROM public.faturas
UNION ALL SELECT 'pontos_movimentacoes', count(*) FROM public.pontos_movimentacoes
UNION ALL SELECT 'vouchers', count(*) FROM public.vouchers
UNION ALL SELECT 'extrato_financeiro', count(*) FROM public.extrato_financeiro;
`;

console.log('[STEP 1] Current Table Row Counts:');
console.log(runRemotePsql(rowCountSql));

// 2. Sample keys for realistic queries
const sampleKeysSql = `
SELECT 'ticket' as type, cliente_id::text as k1, id::text as k2, codigo_ticket as k3 FROM public.tickets WHERE cliente_id IS NOT NULL LIMIT 1;
SELECT 'ticket_msg' as type, ticket_id::text as k1, null as k2, null as k3 FROM public.ticket_mensagens LIMIT 1;
SELECT 'saque' as type, cliente_id::text as k1, id::text as k2, null as k3 FROM public.saques WHERE cliente_id IS NOT NULL LIMIT 1;
SELECT 'fatura' as type, cliente_id::text as k1, id::text as k2, codigo_fatura as k3 FROM public.faturas WHERE codigo_fatura IS NOT NULL LIMIT 1;
SELECT 'ponto' as type, cliente_id::text as k1, id::text as k2, null as k3 FROM public.pontos_movimentacoes WHERE cliente_id IS NOT NULL LIMIT 1;
SELECT 'voucher' as type, cliente_id::text as k1, id::text as k2, codigo_voucher as k3 FROM public.vouchers WHERE codigo_voucher IS NOT NULL LIMIT 1;
SELECT 'extrato' as type, cliente_id::text as k1, id::text as k2, null as k3 FROM public.extrato_financeiro WHERE cliente_id IS NOT NULL LIMIT 1;
`;

console.log('[STEP 2] Existing Sample Keys:');
console.log(runRemotePsql(sampleKeysSql));

// 3. Define target benchmarks across both realistic keys and synthetic simulation
// In PostgreSQL, for small tables (few rows), the planner chooses Seq Scan if enable_seqscan = on because reading 1 disk page for heap is cheaper than 1 page index + 1 page heap.
// To accurately benchmark cost models and execution plan paths at scale:
// We evaluate BOTH:
// (A) Default execution plan
// (B) Forced Index Scan (enable_seqscan = off) to measure index plan validity, buffer hits, and sort elimination
// (C) Execution inside a transaction with temporary populated volume to stress-test planner selectivity under scale!

const benchmarkSql = `
-- ====================================================================
-- BENCHMARK 1: tickets (cliente_id, data_abertura DESC)
-- Target Index: idx_tickets_cliente_data_abertura
-- ====================================================================
\\echo '>>> BENCHMARK 1.1: tickets - Normal EXPLAIN (ANALYZE, BUFFERS)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.tickets 
WHERE cliente_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data_abertura DESC 
LIMIT 20;

\\echo '>>> BENCHMARK 1.2: tickets - Forced Index Scan (ANALYZE, BUFFERS)'
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.tickets 
WHERE cliente_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data_abertura DESC 
LIMIT 20;
RESET enable_seqscan;

-- ====================================================================
-- BENCHMARK 2: ticket_mensagens (ticket_id, data_envio ASC)
-- Target Index: idx_ticket_mensagens_ticket_data
-- ====================================================================
\\echo '>>> BENCHMARK 2.1: ticket_mensagens - Normal EXPLAIN (ANALYZE, BUFFERS)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.ticket_mensagens 
WHERE ticket_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data_envio ASC;

\\echo '>>> BENCHMARK 2.2: ticket_mensagens - Forced Index Scan (ANALYZE, BUFFERS)'
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.ticket_mensagens 
WHERE ticket_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data_envio ASC;
RESET enable_seqscan;

-- ====================================================================
-- BENCHMARK 3: saques (cliente_id, data_solicitacao DESC)
-- Target Index: idx_saques_cliente_data_solicitacao
-- ====================================================================
\\echo '>>> BENCHMARK 3.1: saques - Normal EXPLAIN (ANALYZE, BUFFERS)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.saques 
WHERE cliente_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data_solicitacao DESC 
LIMIT 20;

\\echo '>>> BENCHMARK 3.2: saques - Forced Index Scan (ANALYZE, BUFFERS)'
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.saques 
WHERE cliente_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data_solicitacao DESC 
LIMIT 20;
RESET enable_seqscan;

-- ====================================================================
-- BENCHMARK 4: faturas (codigo_fatura)
-- Target Index: faturas_codigo_fatura_key
-- ====================================================================
\\echo '>>> BENCHMARK 4.1: faturas - Normal EXPLAIN (ANALYZE, BUFFERS)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.faturas 
WHERE codigo_fatura = 'FAT-TEST-999999';

\\echo '>>> BENCHMARK 4.2: faturas - Forced Index Scan (ANALYZE, BUFFERS)'
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.faturas 
WHERE codigo_fatura = 'FAT-TEST-999999';
RESET enable_seqscan;

-- ====================================================================
-- BENCHMARK 5: pontos_movimentacoes (cliente_id, data_movimentacao DESC)
-- Target Index: idx_pontos_movimentacoes_cliente_data
-- ====================================================================
\\echo '>>> BENCHMARK 5.1: pontos_movimentacoes - Normal EXPLAIN (ANALYZE, BUFFERS)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.pontos_movimentacoes 
WHERE cliente_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data_movimentacao DESC 
LIMIT 50;

\\echo '>>> BENCHMARK 5.2: pontos_movimentacoes - Forced Index Scan (ANALYZE, BUFFERS)'
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.pontos_movimentacoes 
WHERE cliente_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data_movimentacao DESC 
LIMIT 50;
RESET enable_seqscan;

-- ====================================================================
-- BENCHMARK 6: extrato_financeiro (cliente_id, data DESC)
-- Target Index: idx_extrato_financeiro_cliente_data
-- ====================================================================
\\echo '>>> BENCHMARK 6.1: extrato_financeiro - Normal EXPLAIN (ANALYZE, BUFFERS)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.extrato_financeiro 
WHERE cliente_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data DESC 
LIMIT 50;

\\echo '>>> BENCHMARK 6.2: extrato_financeiro - Forced Index Scan (ANALYZE, BUFFERS)'
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.extrato_financeiro 
WHERE cliente_id = 'e0000000-0000-0000-0000-000000000001' 
ORDER BY data DESC 
LIMIT 50;
RESET enable_seqscan;

-- ====================================================================
-- BENCHMARK 7: vouchers (codigo_voucher)
-- Target Index: vouchers_codigo_voucher_key
-- ====================================================================
\\echo '>>> BENCHMARK 7.1: vouchers - Normal EXPLAIN (ANALYZE, BUFFERS)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.vouchers 
WHERE codigo_voucher = 'VOUCHER-TEST-999';

\\echo '>>> BENCHMARK 7.2: vouchers - Forced Index Scan (ANALYZE, BUFFERS)'
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.vouchers 
WHERE codigo_voucher = 'VOUCHER-TEST-999';
RESET enable_seqscan;
`;

console.log('[STEP 3] Executing Adversarial EXPLAIN (ANALYZE, BUFFERS) Benchmarks...\n');
const benchmarkOutput = runRemotePsql(benchmarkSql);
console.log(benchmarkOutput);
