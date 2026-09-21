# PostgreSQL Environment & Verification Harness Audit

## 1. Executive Summary

This report delivers a comprehensive audit of the database execution environment, connection parameters, migration runners, and verification tooling for the GSA HUB project. It documents the exact mechanisms for applying new SQL migrations (specifically `CREATE INDEX` performance optimizations) and programmatically verifying them against the live PostgreSQL database via `pg_indexes` and the PostgreSQL query planner (`EXPLAIN`).

### Core Findings
1. **Database Topology**: The system operates on a self-hosted Supabase stack within a Docker container on an Oracle Cloud Linux VPS (`147.15.43.141`). PostgreSQL 15.18 (`PostgreSQL 15.18 on aarch64-unknown-linux-gnu`) is bound locally to port `5433` (`127.0.0.1:5433`) under database `gsahub` and user `supabase_admin`.
2. **Current Port & Firewall State**: Port `5433` is not exposed directly to the public internet (a direct TCP connection to `127.0.0.1:5433` from Windows returns `TcpTestSucceeded: False`). All administrative database operations are conducted either:
   - **Directly via SSH execution** (`C:/Windows/System32/OpenSSH/ssh.exe` or Node `ssh2`), piping SQL directly to `psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub`.
   - **Locally via an SSH tunnel** forwarding local port `5433` to remote `127.0.0.1:5433`, allowing `apply_pg_migration.cjs` and Node `pg.Client` to connect seamlessly.
3. **Deprecated Runner**: `apply_migration.cjs` in the project root has been purposefully disabled for security reasons because it previously attempted to use the public anonymous key (`VITE_SUPABASE_ANON_KEY`) or an insecure `execute_sql` RPC. Migrations must strictly use direct PostgreSQL connections.
4. **Idempotency & Naming Standards**: All index migrations must strictly specify `CREATE INDEX IF NOT EXISTS`, use the canonical naming pattern `idx_<table>_<column(s)>`, and conclude with `NOTIFY pgrst, 'reload schema';` to refresh PostgREST.

---

## 2. Environment Credentials & Architecture

### 2.1 File Inspection

#### `.env` (Project Root)
```ini
VITE_SUPABASE_URL=https://api.147-15-43-141.nip.io
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_R2_WORKER_URL="https://gsa-hub-r2-worker.r2-handler.workers.dev"
VITE_R2_PUBLIC_URL="https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev"
```
*Assessment*: Contains client-side public anon key and API URL. It explicitly does not (and should not) contain administrative database credentials or `SUPABASE_DB_URL`.

#### `.env.example` (Project Root)
Documents expected server environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (format: `postgresql://user:password@host:port/database`)

#### `CREDENCIAIS_SISTEMA_GSA.md` (Project Root — Authoritative Source)
Contains official, immutable production credentials:
- **VPS Host**: `147.15.43.141` (Port: `22`)
- **SSH User**: `opc`
- **SSH Private Key Path**: `C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key` (verified: file exists and permissions allow OpenSSH authentication)
- **Database Host**: `127.0.0.1` (on VPS loopback)
- **Database Port**: `5433`
- **Database Name**: `gsahub`
- **Database User**: `supabase_admin`
- **Database Master Password**: `GSA_SENHA_FORTE_2026`

---

## 3. Package Dependencies & Existing Execution Tooling

### 3.1 `package.json` Dependencies
- `pg`: `^8.22.0` (installed in production dependencies — full native PostgreSQL driver)
- `ssh2`: `^1.17.0` (installed in devDependencies — pure JS SSH client)
- `@supabase/supabase-js`: `^2.98.0`
- `dotenv`: `^17.2.3`
- `tsx`: `^4.21.0`

### 3.2 Root Scripts Audit
- **`apply_migration.cjs`**:
  ```javascript
  // Exits with code 1:
  // "Este executor foi desativado por segurança. Migrações não podem ser aplicadas pela chave pública
  // VITE_SUPABASE_ANON_KEY nem por uma RPC execute_sql. Use: SUPABASE_DB_URL="..." node apply_pg_migration.cjs <arquivo.sql>"
  ```
- **`apply_pg_migration.cjs`**:
  Uses `pg.Client` with `process.env.SUPABASE_DB_URL` and `ssl: { rejectUnauthorized: false }`. Executes the SQL file specified in `process.argv[2]`.
- **`apply_rpc.cjs`**:
  Identical pattern to `apply_pg_migration.cjs`, geared for function definitions.
- **`apply_duplicity_migration.cjs`**:
  Executes DDL statements and explicitly ends with:
  `await client.query("NOTIFY pgrst, 'reload schema'");`
- **`scripts/check-database-inventory.mjs`**:
  Connects using `process.env.SUPABASE_DB_URL || process.env.DATABASE_URL`.
- **`scripts/verify-client-rls-acceptance.mjs`**:
  Validates RLS policies and table state either through direct `pg.Client` or static migration simulation.

### 3.3 Historical Scripts Audit in `scratch/`
Over 40 migration application and verification scripts exist in `scratch/` (e.g., `apply-affiliate-transfer-fix-via-vps.mjs`, `apply-careers-evolution-via-vps.mjs`, `apply-gsa-tv-hardening-via-vps.mjs`). All follow a standardized, rock-solid pattern:
1. Load credentials from `CREDENCIAIS_SISTEMA_GSA.md`.
2. Encode SQL payload to base64.
3. Invoke `C:/Windows/System32/OpenSSH/ssh.exe` targeting `opc@147.15.43.141` using key `C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key`.
4. Stream decoded SQL into `psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1`.
5. Execute verification queries against `pg_indexes`, `pg_proc`, or `information_schema`.

---

## 4. Empirical Baseline: Existing Indexes on Critical Tables

A live probe was executed against the database on 2026-09-11 using the verified SSH harness. The public schema currently holds **733 total indexes**.

For the 5 critical target tables identified in the prompt, the baseline is:

| Table | Existing Indexes | Missing High-Impact Candidate Indexes |
|---|---|---|
| **`saques`** | `saques_pkey` (id)<br>`idx_saques_cliente_id` (cliente_id)<br>`uq_saques_request_id` (request_id WHERE NOT NULL) | `idx_saques_status`<br>`idx_saques_created_at`<br>`idx_saques_cliente_status`<br>`idx_saques_data_solicitacao` |
| **`faturas`** | `faturas_pkey` (id)<br>`faturas_codigo_fatura_key` (codigo_fatura)<br>`faturas_infinitepay_order_nsu_uidx`<br>`faturas_one_per_service_order_uidx`<br>`idx_faturas_cliente_id`<br>`idx_faturas_infinitepay_order_nsu`<br>`idx_faturas_orcamento_id`<br>`idx_faturas_ordem_assinatura_id`<br>`idx_faturas_ordem_compra_id`<br>`idx_faturas_os_id`<br>`idx_faturas_status_cliente_venc`<br>`idx_faturas_viagem_transacao_metadata` | `idx_faturas_status`<br>`idx_faturas_created_at`<br>`idx_faturas_tipo`<br>`idx_faturas_data_vencimento`<br>`idx_faturas_emprestimo_id`<br>`idx_faturas_loja_credito_solicitacao_id` |
| **`tickets`** | `tickets_pkey` (id)<br>`tickets_codigo_ticket_key` (codigo_ticket)<br>`idx_tickets_cliente_id`<br>`idx_tickets_prestador_id` | `idx_tickets_status`<br>`idx_tickets_created_at`<br>`idx_tickets_modulo`<br>`idx_tickets_cliente_status` |
| **`pontos_movimentacoes`** | `pontos_movimentacoes_pkey` (id)<br>`idx_pontos_movimentacoes_cliente_id`<br>`idx_pontos_movimentacoes_fatura_id` | `idx_pontos_movimentacoes_tipo`<br>`idx_pontos_movimentacoes_data_movimentacao`<br>`idx_pontos_movimentacoes_cliente_data` |
| **`vouchers`** | `vouchers_pkey` (id)<br>`vouchers_codigo_voucher_key` (codigo_voucher)<br>`idx_vouchers_cliente_id` | `idx_vouchers_status`<br>`idx_vouchers_validade`<br>`idx_vouchers_created_at`<br>`idx_vouchers_cliente_status` |

---

## 5. Execution Mechanisms for the Migration Script

There are two fully verified paths to execute the performance index migration file (e.g. `supabase/migrations/20260911120000_performance_indexes.sql`).

### Path A: Direct Remote SSH Runner (Recommended & Autonomous)
Does not require maintaining a background SSH port-forwarding tunnel on Windows. The runner reads the local `.sql` file, pipes it over SSH to the VPS, executes it with `ON_ERROR_STOP=1`, and runs `NOTIFY pgrst, 'reload schema'`.

#### Implementation: `scripts/apply-sql-migration-remote.mjs`
```javascript
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export function executeSqlMigration(sqlFilePath) {
  const root = process.cwd();
  const creds = fs.readFileSync(path.join(root, 'CREDENCIAIS_SISTEMA_GSA.md'), 'utf8');
  const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
  const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();

  if (!key || !password) throw new Error('VPS or Database credentials not found in CREDENCIAIS_SISTEMA_GSA.md');

  const absoluteSqlPath = path.resolve(root, sqlFilePath);
  if (!fs.existsSync(absoluteSqlPath)) throw new Error(`Migration file not found: ${absoluteSqlPath}`);

  const sqlContent = fs.readFileSync(absoluteSqlPath, 'utf8');
  const pw64 = Buffer.from(password, 'utf8').toString('base64');
  const sql64 = Buffer.from(sqlContent, 'utf8').toString('base64');

  const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -c "NOTIFY pgrst, 'reload schema';"
`;

  const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=15',
    '-i', key,
    'opc@147.15.43.141',
    'bash', '-s'
  ], { input: remote, encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

  if (ssh.status !== 0) {
    throw new Error(`Migration execution failed (status ${ssh.status}):\n${ssh.stderr || ssh.stdout}`);
  }

  return { stdout: ssh.stdout, stderr: ssh.stderr };
}
```

### Path B: SSH Tunnel + `apply_pg_migration.cjs`
1. Open tunnel in background:
   ```powershell
   ssh -N -L 5433:127.0.0.1:5433 -i "C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key" opc@147.15.43.141
   ```
2. Run standard Node migration script:
   ```powershell
   $env:SUPABASE_DB_URL="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"
   node apply_pg_migration.cjs supabase/migrations/20260911120000_performance_indexes.sql
   ```

---

## 6. Programmatic Verification Harness (`pg_indexes` & `EXPLAIN`)

A verification harness must validate two criteria:
1. **Catalog Registration**: Query `pg_indexes` to ensure each new index is physically present in the `public` schema.
2. **Query Planner Recognition**: Execute `EXPLAIN` with `SET enable_seqscan = off;` on representative queries to prove that the PostgreSQL cost optimizer recognizes and uses the index.

### Verification Harness Implementation (`verify-performance-indexes.mjs`)
```javascript
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export function verifyIndexes(expectedIndexNames) {
  const root = process.cwd();
  const creds = fs.readFileSync(path.join(root, 'CREDENCIAIS_SISTEMA_GSA.md'), 'utf8');
  const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
  const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
  const pw64 = Buffer.from(password, 'utf8').toString('base64');

  // Format index list for SQL IN clause
  const indexInList = expectedIndexNames.map(name => `'${name}'`).join(', ');

  const query = `
-- 1. Check presence in pg_indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (${indexInList})
ORDER BY tablename, indexname;

-- 2. Query Planner Explains with enable_seqscan=off
SET enable_seqscan = off;
EXPLAIN SELECT * FROM public.saques WHERE status = 'pendente';
EXPLAIN SELECT * FROM public.faturas WHERE status = 'paga';
EXPLAIN SELECT * FROM public.tickets WHERE status = 'aberto';
EXPLAIN SELECT * FROM public.pontos_movimentacoes WHERE tipo = 'credito';
EXPLAIN SELECT * FROM public.vouchers WHERE status = 'disponivel';
`;

  const q64 = Buffer.from(query, 'utf8').toString('base64');
  const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${q64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -F '|'
`;

  const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=15',
    '-i', key,
    'opc@147.15.43.141',
    'bash', '-s'
  ], { input: remote, encoding: 'utf8', timeout: 30000 });

  if (ssh.status !== 0) {
    throw new Error(`Verification query failed:\n${ssh.stderr || ssh.stdout}`);
  }

  // Parse output and assert all expectedIndexNames are present
  const output = ssh.stdout;
  const missing = [];
  for (const idx of expectedIndexNames) {
    if (!output.includes(idx)) {
      missing.push(idx);
    }
  }

  return {
    success: missing.length === 0,
    missing,
    rawOutput: output
  };
}
```

---

## 7. Idempotency & SQL Standards

To guarantee non-destructive, repeat-safe application:
1. **Clause**: Every statement MUST begin with `CREATE INDEX IF NOT EXISTS`.
2. **Naming Convention**:
   - Single column: `idx_<table>_<column>` (e.g., `idx_saques_status`, `idx_tickets_status`).
   - Composite columns: `idx_<table>_<col1>_<col2>` (e.g., `idx_saques_cliente_status`).
   - Sorting specifier: Append `_desc` if descending ordering is indexed (e.g., `idx_saques_created_at_desc`).
3. **Transaction Wrapping**:
   - In PostgreSQL, `CREATE INDEX IF NOT EXISTS` can safely execute inside standard `BEGIN; ... COMMIT;` transaction blocks when run without `CONCURRENTLY`.
   - In automated deployment scripts executed via `psql` with `-v ON_ERROR_STOP=1`, wrapping in a transaction ensures that any syntactic or schema conflict rolls back atomically.
4. **PostgREST Schema Reload**:
   - PostgREST caches table foreign keys, columns, and indexes. Every migration MUST end with:
     ```sql
     NOTIFY pgrst, 'reload schema';
     ```
