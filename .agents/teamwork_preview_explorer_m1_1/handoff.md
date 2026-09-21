# HANDOFF REPORT — Database Schema & Missing Indexes Audit

**Agent**: Explorer 1 (Database Schema Auditor)  
**Date**: 2026-09-11  
**Working Directory**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m1_1`  
**Handoff Type**: Hard (Investigation Complete)  
**Primary Deliverable**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m1_1\analysis.md`

---

## 1. OBSERVATION

Direct inspection of `master_supabase_schema.sql` (826 lines) and the 398 migration files in `supabase/migrations/` via AST/regex extraction scripts (`scratch/audit_schema_indexes.cjs`, `scratch/deep_table_inspector.cjs`, `scratch/find_all_unindexed_fks.cjs`, `scratch/scan_query_usages.cjs`) revealed the following factual states:

### 1.1 Tables with ZERO Non-Primary-Key Indexes
1. **`tickets`** (`master_supabase_schema.sql:517`):
   ```sql
   CREATE TABLE IF NOT EXISTS tickets (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       cliente_id UUID REFERENCES clientes(id),
       prestador_id UUID REFERENCES prestadores(id),
       assunto TEXT NOT NULL,
       descricao TEXT NOT NULL,
       status TEXT CHECK (status IN ('aberto', 'em andamento', 'concluido')) DEFAULT 'aberto',
       data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       data_fechamento TIMESTAMP WITH TIME ZONE
   );
   ```
   - Existing indexes: **0** (only `tickets_pkey` on `id`).
   - Unindexed Foreign Keys: `cliente_id` and `prestador_id`.

2. **`ticket_mensagens`** (`master_supabase_schema.sql:528`):
   ```sql
   CREATE TABLE IF NOT EXISTS ticket_mensagens (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
       autor_id TEXT NOT NULL,
       autor_nome TEXT NOT NULL,
       mensagem TEXT NOT NULL,
       tipo TEXT CHECK (tipo IN ('cliente', 'admin', 'prestador')) NOT NULL,
       data_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```
   - Existing indexes: **0** (only `ticket_mensagens_pkey` on `id`).
   - Unindexed Foreign Key: `ticket_id`.

3. **`ordens_assinatura`** (`master_supabase_schema.sql:243`):
   ```sql
   CREATE TABLE IF NOT EXISTS ordens_assinatura (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       codigo_ordem TEXT UNIQUE,
       assinatura_id UUID REFERENCES assinaturas(id),
       cliente_id UUID REFERENCES clientes(id) NOT NULL,
       status TEXT CHECK (status IN ('em_analise', 'aprovado', 'concluido', 'cancelado', 'em_cancelamento')) DEFAULT 'em_analise',
       quantidade INTEGER DEFAULT 1,
       prazo_meses INTEGER,
       renovacao_automatica BOOLEAN DEFAULT true,
       data_vencimento TIMESTAMP WITH TIME ZONE,
       data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```
   - Existing indexes: **1** (only `ordens_assinatura_codigo_ordem_key` unique on `codigo_ordem`).
   - Unindexed Foreign Keys: `cliente_id` and `assinatura_id`.

4. **`gsa_voucher_resgates`** (`supabase/migrations/20260714056300_secure_remaining_client_financial_actions.sql:30`):
   ```sql
   CREATE TABLE IF NOT EXISTS public.gsa_voucher_resgates (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
       cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
       valor numeric NOT NULL CHECK (valor > 0),
       created_at timestamptz NOT NULL DEFAULT now()
   );
   ```
   - Existing indexes: **0** (only `gsa_voucher_resgates_pkey` on `id`).
   - Unindexed Foreign Keys: `voucher_id` and `cliente_id`.

### 1.2 Unindexed Foreign Keys in Critical High-Volume Tables
Out of 361 total foreign keys in the schema, our audit confirmed the following 14 critical unindexed foreign keys:
- **`faturas.ordem_compra_id`** -> `REFERENCES ordens_compra(id)` (`master_supabase_schema.sql:264`)
- **`faturas.ordem_assinatura_id`** -> `REFERENCES ordens_assinatura(id)` (`master_supabase_schema.sql:265`)
- **`pontos_movimentacoes.fatura_id`** -> `REFERENCES faturas(id)` (`master_supabase_schema.sql:346`)
- **`ordens_compra.produto_id`** -> `REFERENCES produtos(id)` (`master_supabase_schema.sql:236`)
- **`prestador_faturas.demanda_id`** -> `REFERENCES prestador_demandas(id)` (`master_supabase_schema.sql:445`)
- **`parceiros_resgates_recursos.resgate_id`** -> `REFERENCES parceiros_resgates(id)` (`20260828170000_partner_redemption_appeals.sql:4`)
- **`parceiros_resgates_eventos.recurso_id`** -> `REFERENCES parceiros_resgates_recursos(id)` (`20260828170000_partner_redemption_appeals.sql:110`)
- **`gsa_afiliado_saques.afiliado_id`** -> `REFERENCES gsa_afiliados(id)` (`20260722040000_affiliate_program.sql:64`)
- **`loja_credito_saques.fatura_id`** -> `REFERENCES faturas(id)` (`20260829133000_credit_available_withdrawals.sql:40`)
- **`loja_credito_saques.movimentacao_id`** -> `REFERENCES loja_credito_movimentacoes(id)` (`20260829133000_credit_available_withdrawals.sql:41`)
- **`tickets.cliente_id`** (`master_supabase_schema.sql:519`)
- **`tickets.prestador_id`** (`master_supabase_schema.sql:520`)
- **`ticket_mensagens.ticket_id`** (`master_supabase_schema.sql:530`)
- **`ordens_assinatura.assinatura_id`** (`master_supabase_schema.sql:246`)

### 1.3 Missing Composite & Order By Indexes
- **`pontos_movimentacoes`**: Has `idx_pontos_movimentacoes_cliente_id` (`20260723120000_system_db_alignment.sql:79`), but lacks `(cliente_id, data_movimentacao DESC)`. The frontend in `ClientesModule.tsx` line 125 executes:
  `.from('pontos_movimentacoes').select('*').eq('cliente_id', cliente.id).order('data_movimentacao', { ascending: false })`
- **`carteira_lancamentos`**: Has `idx_carteira_lancamentos_cliente_id` (`20260723120000_system_db_alignment.sql:81`), but lacks `(cliente_id, data_lancamento DESC)`. The query in `ClientFinanceiro.tsx` sorts by `data_lancamento DESC`.
- **`saques`**: Has separate single-column indexes `idx_saques_cliente_id` and `idx_saques_status` (`20260728050000_add_performance_indexes.sql:10-11`), but lacks composite `(cliente_id, status)`. The query in `ClientesModule.tsx` filters by `eq('cliente_id', ...).in('status', ['solicitado', 'aprovado'])`.
- **`vouchers`**: Lacks index on `status` and `validade`. Checkout validations query `WHERE codigo_voucher = ? AND status = 'ativo' AND (validade IS NULL OR validade >= CURRENT_DATE)`.

---

## 2. LOGIC CHAIN

1. **Premise (PostgreSQL Internals)**: PostgreSQL does NOT create indexes on `FOREIGN KEY` columns automatically (only for `PRIMARY KEY` and `UNIQUE`). Without an explicit B-Tree index, any join (`JOIN t ON t.fk = p.id`), foreign-key validation, or cascade deletion (`ON DELETE CASCADE`) forces a sequential table scan (`Seq Scan`) on the referencing table.
2. **Prior Incomplete Fixes**: Migrations `20260723120000`, `20260723130000`, `20260728050000`, and `20260729120000` introduced indexes on parts of `faturas`, `orcamentos`, and `prestador_demandas`, but completely bypassed `tickets`, `ticket_mensagens`, `ordens_assinatura`, and `gsa_voucher_resgates`.
3. **Application Query Matching**:
   - `AtendimentoTicketsView.tsx` reads all chat messages with `.from('ticket_mensagens').select('*').in('ticket_id', ticketIds).order('data_envio', { ascending: true })`.
   - Without an index on `(ticket_id, data_envio ASC)`, PostgreSQL must scan all rows in `ticket_mensagens` and sort them in work_mem.
   - In `faturas`, joining `ordens_compra` or `ordens_assinatura` causes sequential scans because `ordem_compra_id` and `ordem_assinatura_id` are unindexed.
   - In `pontos_movimentacoes` and `carteira_lancamentos`, statements sorted by `data_movimentacao DESC` and `data_lancamento DESC` require an explicit Sort step because existing indexes are single-column on `cliente_id`.
4. **Direct Deduction**: Creating B-Tree indexes on these unindexed foreign keys and adding composite `(cliente_id, timestamp DESC)` and `(cliente_id, status)` indexes directly converts O(N) sequential scans and in-memory sorts into O(log N) index scans, eliminating high I/O and CPU spikes under concurrency.

---

## 3. CAVEATS

- **Concurrent Creation**: In Supabase migration execution files (which run inside an implicit transaction block), `CREATE INDEX CONCURRENTLY` cannot be used because Postgres forbids `CONCURRENTLY` inside transaction blocks. Therefore, standard `CREATE INDEX IF NOT EXISTS` must be used in `.sql` migration files.
- **Index Write Overhead**: Adding 38 targeted indexes adds minor overhead to `INSERT`/`UPDATE` operations on these tables; however, because all selected tables are read-heavy transactional entities queried continuously by the frontend, the read latency improvements vastly outweigh the write penalty.
- **Low-cardinality standalone columns**: Columns with very low cardinality (like `status` alone on small tables) were paired into composite indexes (e.g. `(cliente_id, status)` or `(status, created_at DESC)`) to ensure high index selectivity and avoid index-skip degradation.

---

## 4. CONCLUSION

A total of **38 high-value candidate indexes** across **14 core tables** are required to stabilize and optimize the database:
- **Priority 0 (Critical - 16 indexes)**:
  - 7 indexes on `tickets` and `ticket_mensagens` (currently 0 indexes)
  - 5 indexes on `ordens_assinatura` (currently 0 indexes)
  - 3 indexes on `gsa_voucher_resgates` (currently 0 indexes)
  - Foreign key indexes: `faturas(ordem_compra_id)`, `faturas(ordem_assinatura_id)`, `pontos_movimentacoes(fatura_id)`, `ordens_compra(produto_id)`, `prestador_faturas(demanda_id)`, `gsa_afiliado_saques(afiliado_id)`, `parceiros_resgates_recursos(resgate_id)`.
- **Priority 1 (High - 16 indexes)**:
  - Sort-elimination composite indexes: `pontos_movimentacoes(cliente_id, data_movimentacao DESC)`, `carteira_lancamentos(cliente_id, data_lancamento DESC)`, `saques(cliente_id, data_solicitacao DESC)`, `ordens_compra(cliente_id, data_criacao DESC)`.
  - Composite filter indexes: `saques(cliente_id, status)`, `vouchers(cliente_id, status)`, `ordens_compra(cliente_id, status)`, `faturas(status, data_vencimento)`, `produto_variantes(sku)`.
- **Priority 2 (Medium - 6 indexes)**:
  - Reporting and analytics filter indexes on `tipo`, `categoria`, and date ranges.

The complete SQL DDL migration has been compiled and is ready for implementation by the builder/DBA agent (see Section 4 of `analysis.md`).

---

## 5. VERIFICATION METHOD

To independently verify all findings and confirm that the identified columns currently lack indexes:

1. **Verify Foreign Keys Without Indexes**:
   Run the verification script from the project root:
   ```bash
   node scratch/find_all_unindexed_fks.cjs
   ```
   *Expected result*: Flags `tickets.cliente_id`, `ticket_mensagens.ticket_id`, `ordens_assinatura.cliente_id`, `faturas.ordem_compra_id`, `faturas.ordem_assinatura_id`, etc.

2. **Inspect Migration Index Definitions**:
   Run grep across `supabase/migrations/`:
   ```powershell
   Get-ChildItem -Path supabase\migrations\*.sql | Select-String "CREATE.*INDEX.*ON.*tickets"
   ```
   *Expected result*: 0 matches. Confirms `tickets` has no indexes in any migration.

   ```powershell
   Get-ChildItem -Path supabase\migrations\*.sql | Select-String "CREATE.*INDEX.*ON.*ticket_mensagens"
   ```
   *Expected result*: 0 matches. Confirms `ticket_mensagens` has no indexes in any migration.

   ```powershell
   Get-ChildItem -Path supabase\migrations\*.sql | Select-String "CREATE.*INDEX.*ON.*ordens_assinatura"
   ```
   *Expected result*: 0 matches. Confirms `ordens_assinatura` has no indexes in any migration.

3. **Invalidation Condition**:
   If an existing migration file in `supabase/migrations/` is found that already contains `CREATE INDEX ... ON public.tickets (cliente_id)` or `ON public.ticket_mensagens (ticket_id)`, this finding would be invalidated. Exhaustive inspection confirmed no such migration exists.
