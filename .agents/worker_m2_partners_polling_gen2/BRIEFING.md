# BRIEFING — 2026-08-26T14:41:00Z

## Mission
Milestone 2 — Partners Realtime (R2), Admin Bell & Dashboard Realtime (R3), and Polling Elimination (R7, R10-polling, R11-polling).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_partners_polling_gen2
- Original parent: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Milestone: M2 - Partners, Admin Bell & Polling Elimination

## 🔒 Key Constraints
- Use `useRealtimeSubscription` / `useRealtime` from `src/hooks/useRealtime.ts` or strict `supabase.removeChannel` cleanup.
- Partners (R2): `PartnersPage.tsx`, `FornecedoresSection.tsx`, `PartnersAdminModule.tsx` subscribe to `parceiros`.
- Admin Bell & Dashboard (R3): Replace `setInterval` in `useAdminNotifications.tsx` and `Dashboard.tsx` with realtime subscriptions on `faturas`, `cobrancas`, `saques`, `tickets`, `orcamentos`, `ordens_servico`, `ordens_fiscais`, `vouchers`, etc. Preserve required contract tokens from `scripts/check-realtime-contracts.ts`.
- Polling Elimination: Completely remove `setInterval` polling in `OperacoesSuperDomain.tsx`, `ShopeeOperationsModule.tsx`, `GsaTvModule.tsx`, `SystemMonitorModule.tsx`, `AdvertiserPortal.tsx`, `AfiliadoDashboard.tsx`, `AcessosModule.tsx`, `AffiliateAdminModule.tsx`, `CareersAdminModule.tsx` and replace with realtime subscriptions.
- Verification: `npx vitest run src/tests` and `npm run build` must succeed with exit code 0.

## Current Parent
- Conversation ID: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Updated: not yet

## Task Summary
- **What to build**: Realtime subscriptions and complete elimination of polling intervals in 14 target files.
- **Success criteria**: All 14 files have proper realtime hooks / subscriptions; no polling intervals; vitest tests and build pass; contract checks pass.
- **Interface contracts**: `src/hooks/useRealtime.ts`, `scripts/check-realtime-contracts.ts`

## Key Decisions Made
- Use `useRealtime` / `useRealtimeSubscription` consistently across components.
- Preserve specific markers required by `scripts/check-realtime-contracts.ts` in `src/hooks/useAdminNotifications.tsx`.

## Change Tracker
- **Files modified**: TBD
- **Build status**: Initializing
- **Pending issues**: None

## Quality Status
- **Build/test result**: Not yet run
- **Lint status**: Clean
- **Tests added/modified**: TBD

## Loaded Skills
- None
