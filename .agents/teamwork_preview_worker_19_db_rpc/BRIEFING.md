# BRIEFING — 2026-09-10T20:19:37Z

## Mission
Implement production-grade PostgreSQL migration `20260910180000_marketplace_acid_concurrency_remediation.sql` and Edge Function webhook fix `supabase/functions/gsa-payments/index.ts` to remediate ACID, concurrency, stock deduction, variant tracking, pricing, and returns atomicity issues in the marketplace.

## 🔒 My Identity
- Archetype: implementer
- Roles: [implementer, qa, specialist]
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_19_db_rpc
- Original parent: e03228af-bfd7-4634-ad6a-094821d325f4
- Milestone: marketplace_acid_concurrency_remediation

## 🔒 Key Constraints
- Exclusive write ownership:
  - `supabase/migrations/` (specifically `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`)
  - `supabase/functions/gsa-payments/index.ts`
  - `server_webhook_vps_live.cjs` (if applicable)
- DO NOT modify any files in `src/components/` (Worker 2 owns frontend components).
- DO NOT cheat, fake test results, or create dummy facades.

## Current Parent
- Conversation ID: e03228af-bfd7-4634-ad6a-094821d325f4
- Updated: not yet

## Task Summary
- **What to build**: PostgreSQL migration for checkout store ACID concurrency, eliminate temporary `produtos.valor` updates, variant stock reservation, canonical lock ordering, promotional quota updates, coupon hierarchy, PIX discount, auth on `gsa_converter_pontos_carteira`, RLS on `loja_solicitacoes`, cancellations/returns inventory & wallet/refund atomicity, `cupons_usos` ledger; plus idempotent webhook processing and `gsa_finalize_paid_invoice_internal` call in edge function.
- **Success criteria**: Vitest tests and simulation script pass with zero regressions.

## Change Tracker
- **Files modified**: [TBD]
- **Build status**: [TBD]
- **Pending issues**: [TBD]

## Quality Status
- **Build/test result**: [TBD]
- **Lint status**: [TBD]
- **Tests added/modified**: [TBD]

## Loaded Skills
- None required directly, following implementer/qa/specialist instructions.
