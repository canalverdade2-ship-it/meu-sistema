# Project: PostgreSQL Database Performance Optimization

## Architecture
- Target Database: Supabase PostgreSQL 15.18 (Oracle Cloud VPS 147.15.43.141:5433)
- Target Migration Directory: `supabase/migrations/`
- Migration File: `supabase/migrations/20260911040000_postgresql_performance_optimization_indexes.sql`
- Runner & Verification: Remote OpenSSH streaming SQL to `psql` or SSH tunnel + Node script.

## Feature Inventory
| # | Feature / Target | Description | Milestone | Source |
|---|------------------|-------------|-----------|--------|
| 1 | Tickets & Chat Indexes | B-Tree indexes on `tickets` and `ticket_mensagens` (FKs, status, timestamps) | M1 | Explorers 1 & 2 |
| 2 | Saques Performance Indexes | Composite `(cliente_id, data_solicitacao DESC)`, `(cliente_id, status)` on `saques` & `prestador_saques` | M1 | Explorers 1 & 2 |
| 3 | Faturas Performance Indexes | `codigo_fatura` unique index, FKs `ordem_compra_id`, `ordem_assinatura_id`, composite status/dates | M1 | Explorers 1 & 2 |
| 4 | Pontos & Extrato Indexes | Composite `(cliente_id, data_movimentacao DESC)`, `extrato_financeiro(cliente_id, data DESC)`, FK `fatura_id` | M1 | Explorers 1 & 2 |
| 5 | Vouchers & Cupons Indexes | `codigo_voucher`, `codigo_cupom`, `gsa_voucher_resgates`, `cupons_ativados` | M1 | Explorers 1 & 2 |
| 6 | Ordens de Assinatura & Demais FKs | `ordens_assinatura(cliente_id, assinatura_id, status)`, `prestador_faturas`, `parceiros_resgates` FKs | M1 | Explorers 1 & 2 |
| 7 | RPC Optimization | Refactor `gerar_faturas_assinaturas_diario()` or optimize execution plan where applicable | M1 | Explorer 2 |
| 8 | Programmatic Database Validation | Apply migration via psql/runner and run dual-check (pg_indexes + EXPLAIN index scans) | M1 | Explorer 3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| 0 | Survey & Audit | 3 parallel Explorers audit tables, queries, and execution tooling | none | DONE |
| 1 | Migration Authoring & Database Execution | Worker writes migration SQL, applies to PostgreSQL, and validates with automated test | M0 | DONE |
| 2 | Review & Challenge | 2 Reviewers + 2 Challengers verify query plans, idempotency, safety | M1 | DONE |
| 3 | Forensic Integrity Audit | 1 Forensic Auditor verifies authentic implementation and zero cheating | M2 | DONE |

## Code Layout
- Migration: `supabase/migrations/20260911040000_postgresql_performance_optimization_indexes.sql`
- Validation script: `scratch/verify_postgresql_performance_indexes.mjs`
