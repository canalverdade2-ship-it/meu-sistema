# BRIEFING — 2026-09-10T19:48:00-03:00

## Mission
Refactor PostgreSQL returns/refunds migration (20260910180000) and LojaTrocasModule.tsx to fix all P0 concurrency, ACID atomicity, selective restocking, wallet/loyalty refund, and RPC routing issues.

## 🔒 My Identity
- Archetype: Worker / Database Implementation Specialist
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_returns_1
- Original parent: 284ed346-0d14-4cb6-af78-95944f699698
- Milestone: M3 - Post-Sales Returns, Refunds & Faturas Remediation (R2)

## 🔒 Key Constraints
- Exclusive write ownership:
  - `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`
  - `src/components/admin/LojaTrocasModule.tsx`
  - `.agents/worker_returns_1/`
- UTF-8 STRICT encoding
- DO NOT CHEAT: Genuine implementation, maintain real state and behavior
- Never place code or tests in .agents/
- Verification via npm run build and vitest

## Current Parent
- Conversation ID: 284ed346-0d14-4cb6-af78-95944f699698
- Updated: 2026-09-10T19:48:00-03:00

## Task Summary
- **What to build**: Full remediação of `gsa_admin_atualizar_solicitacao_loja` RPC (parameter compatibility, session config trigger bypass, selective inventory restock of produtos and produto_variantes, saldo_carteira with carteira_lancamentos/extrato_financeiro, points round() + tipo 'estorno' + clawback, invoice cancellation for FAT-TROCA-..., external refund tracking via loja_reembolsos, and frontend routing in LojaTrocasModule.tsx).
- **Success criteria**: All 9 dispatch requirements fulfilled, builds pass, tests pass, handoff report created, parent notified.
- **Interface contracts**: PROJECT.md § Post-Sales RPC Contract (`gsa_admin_atualizar_solicitacao_loja`)
- **Code layout**: `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`, `src/components/admin/LojaTrocasModule.tsx`

## Key Decisions Made
- Flexible RPC parameters: accept both `p_token`/`p_status` and `p_session_token`/`p_novo_status` plus optional logistics parameters.
- Idempotency guard: add column `estorno_executado` boolean to `public.loja_solicitacoes` and check before restocking/refunding.
- Deterministic locking on produtos and produto_variantes to prevent deadlocks (40P01).
- Set session configs: `gsa.credit_release` and `gsa.system_override` to 'on'.
- Cancel pending `FAT-TROCA-...` on rejection/cancellation.

## Artifact Index
- `.agents/worker_returns_1/DISPATCH.md` — Assignment
- `.agents/worker_returns_1/BRIEFING.md` — Working memory
- `.agents/worker_returns_1/progress.md` — Liveness and progress
- `.agents/worker_returns_1/handoff.md` — Final handoff report
