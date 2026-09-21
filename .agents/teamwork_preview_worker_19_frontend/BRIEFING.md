# BRIEFING — 2026-09-10T20:20:00Z

## Mission
Implement frontend store, checkout, returns, refunds, referral, and pix service fixes to align calculations, atomic RPC calls, coupon validation, variant handling, and discount ordering.

## 🔒 My Identity
- Archetype: teamwork_preview_worker_19_frontend
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_19_frontend
- Original parent: e03228af-bfd7-4634-ad6a-094821d325f4
- Milestone: Store Cart, Checkout, Returns, Refunds, Pix & Referral Fixes

## 🔒 Key Constraints
- Exclusive write ownership:
  - src/components/client/store/CheckoutPage.tsx
  - src/components/client/store/ProductPage.tsx
  - src/components/client/ClientGSAStore.tsx
  - src/components/admin/LojaTrocasModule.tsx
  - src/components/admin/ReembolsosModule.tsx
  - src/lib/pixService.ts
  - src/utils/referral.ts
- DO NOT modify any files in supabase/migrations/
- No fake implementations, hardcoding, or facade logic.
- Run build/tests and report via handoff.md and send_message.

## Current Parent
- Conversation ID: e03228af-bfd7-4634-ad6a-094821d325f4
- Updated: not yet

## Task Summary
- **What to build**:
  1. CheckoutPage.tsx: discount precedence (coupon -> delivery fee -> points -> wallet), PIX discount passed in checkout payload.
  2. pixService.ts: createInfinitePayOrderCheckout charges PIX discounted amount.
  3. ProductPage.tsx: cart items differentiated by variant_id / variante_id.
  4. ClientGSAStore.tsx: limite_usos null/undefined treated as unlimited.
  5. LojaTrocasModule.tsx: invoke secure RPC gsa_admin_atualizar_solicitacao_loja.
  6. ReembolsosModule.tsx: invoke secure RPC gsa_admin_process_store_refund.
  7. referral.ts: atomic wallet update via RPC.
- **Success criteria**: All 7 tasks implemented genuinely, typecheck / tests pass, no regressions.
- **Interface contracts**: PROJECT.md / analysis reports.

## Change Tracker
- **Files modified**: [TBD]
- **Build status**: [TBD]
- **Pending issues**: [TBD]

## Quality Status
- **Build/test result**: [TBD]
- **Lint status**: [TBD]
- **Tests added/modified**: [TBD]

## Loaded Skills
- None requested/applicable.

## Key Decisions Made
- [TBD]

## Artifact Index
- DISPATCH.md — Assignment instructions
- progress.md — Liveness heartbeat and step tracking
- handoff.md — 5-component handoff report
