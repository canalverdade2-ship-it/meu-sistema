# DISPATCH — Worker 1 (Migration Author & Database Executor)

## Mission
Author the unified PostgreSQL performance optimization migration, apply it to the PostgreSQL database, and programmatically verify the application and planner recognition.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Key Inputs & References
- `ORIGINAL_REQUEST.md`: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
- Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
- Explorer 1 Report: `.agents/teamwork_preview_explorer_m1_1/handoff.md` and `analysis.md`
- Explorer 2 Report: `.agents/teamwork_preview_explorer_m1_2/handoff.md` and `analysis.md`
- Explorer 3 Report: `.agents/teamwork_preview_explorer_m1_3/handoff.md` and `analysis.md`
- Database Credentials & VPS: `CREDENCIAIS_SISTEMA_GSA.md` and SSH key `C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key`
- Your Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m1_1

## Deliverables
1. Migration SQL File:
   `supabase/migrations/20260911040000_postgresql_performance_optimization_indexes.sql`
   - Must use `CREATE INDEX IF NOT EXISTS` or `CREATE UNIQUE INDEX IF NOT EXISTS`.
   - Must cover all critical missing indexes identified by Explorers 1 & 2 (`tickets`, `ticket_mensagens`, `saques`, `prestador_saques`, `faturas`, `pontos_movimentacoes`, `extrato_financeiro`, `carteira_lancamentos`, `vouchers`, `cupons_loja`, `ordens_assinatura`, `ordens_compra`, and critical FKs).
   - End with `NOTIFY pgrst, 'reload schema';`.
2. Database Execution:
   - Apply the migration to the PostgreSQL database (VPS `147.15.43.141:5433`) using the verified execution method from Explorer 3.
3. Verification Script:
   - Create and run `scratch/verify_postgresql_performance_indexes.mjs` to prove:
     a) All new indexes exist in `pg_indexes`.
     b) `SET enable_seqscan = off; EXPLAIN ...` confirms the query planner uses the indexes.
4. Reports:
   - Write `changes.md` and `handoff.md` in your working directory with execution logs, command outputs, and verification evidence.

## 2026-09-11T11:39:19Z
You are Worker 1 (Database Migration Implementer). Read your DISPATCH file at: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m1_1\DISPATCH.md.
Read ORIGINAL_REQUEST.md at c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m1_1.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Review reports from Explorer 1 (.agents/teamwork_preview_explorer_m1_1/analysis.md), Explorer 2 (.agents/teamwork_preview_explorer_m1_2/analysis.md), and Explorer 3 (.agents/teamwork_preview_explorer_m1_3/analysis.md).
2. Create migration file supabase/migrations/20260911040000_postgresql_performance_optimization_indexes.sql containing all missing indexes with IF NOT EXISTS and ending with NOTIFY pgrst, 'reload schema';.
3. Apply the migration to the PostgreSQL database on VPS (147.15.43.141:5433).
4. Create and run scratch/verify_postgresql_performance_indexes.mjs to programmatically verify that all indexes exist in pg_indexes and query planner recognizes them via EXPLAIN.
5. Write changes.md and handoff.md and notify orchestrator via send_message.
