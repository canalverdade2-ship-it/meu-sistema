# BRIEFING — 2026-08-26T15:20:00Z

## Mission
Milestone 2: Implemented Realtime and eliminated polling across Partners (R2), Admin Bell & Dashboard (R3), and Operations/Modules (R7, R10-polling, R11-polling) according to the project specifications and check-realtime-contracts.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_partners_polling_gen3
- Original parent: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Milestone: Milestone 2 — Partners, Admin Bell & Dashboard, Polling Elimination

## 🔒 Key Constraints
- Use canonical `useRealtimeSubscription` / `useRealtime` from `src/hooks/useRealtime.ts` (or strict `supabase.removeChannel` cleanup).
- For Partners (R2): Ensure `PartnersPage.tsx`, `FornecedoresSection.tsx`, `PartnersAdminModule.tsx` subscribe to `parceiros` and update on insert/update/delete (<2s update time).
- For Admin Bell & Dashboard (R3): Replace `setInterval` in `useAdminNotifications.tsx` and `Dashboard.tsx` with realtime subscriptions on `faturas`, `cobrancas`, `saques`, `tickets`, `orcamentos`, `ordens_servico`, `ordens_fiscais`, `vouchers`, etc. Ensure bell badge updates within 3s. Preserve required contract tokens from `scripts/check-realtime-contracts.ts`.
- For Polling Elimination: Completely remove `setInterval` polling in `OperacoesSuperDomain.tsx`, `ShopeeOperationsModule.tsx`, `GsaTvModule.tsx`, `SystemMonitorModule.tsx`, `AdvertiserPortal.tsx`, `AfiliadoDashboard.tsx`, `AcessosModule.tsx`, `AffiliateAdminModule.tsx`, `CareersAdminModule.tsx` and replace with realtime subscriptions on their corresponding tables.
- Verification: `npx vitest run src/tests` and `npm run build` must succeed with exit code 0.
- Exclusive file ownership:
  1. `src/components/public/PartnersPage.tsx`
  2. `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`
  3. `src/components/admin/PartnersAdminModule.tsx`
  4. `src/components/admin/Dashboard.tsx`
  5. `src/hooks/useAdminNotifications.tsx`
  6. `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx`
  7. `src/components/admin/ShopeeOperationsModule.tsx`
  8. `src/components/admin/GsaTvModule.tsx`
  9. `src/components/admin/SystemMonitorModule.tsx`
  10. `src/pages/AdvertiserPortal.tsx`
  11. `src/pages/Afiliado/AfiliadoDashboard.tsx`
  12. `src/components/admin/AcessosModule.tsx`
  13. `src/components/admin/AffiliateAdminModule.tsx`
  14. `src/components/admin/CareersAdminModule.tsx`

## Current Parent
- Conversation ID: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Updated: 2026-08-26T15:20:00Z

## Task Summary
- **What to build**: Realtime subscription integration and setInterval polling elimination in 14 target files.
- **Success criteria**: All polling removed, realtime updates active on correct supabase tables, `check-realtime-contracts.ts` satisfied, vitest test suite passes (110/110 tests passed).
- **Interface contracts**: `scripts/check-realtime-contracts.ts` and `src/hooks/useRealtime.ts`
- **Code layout**: `PROJECT.md`

## Key Decisions Made
- Replaced polling interval in `CareersAdminModule.tsx` with `useRealtimeSubscription` on `gsa_careers_applications` and `trabalhe_conosco`.
- Refactored `SystemMonitorModule.tsx` to use canonical `useRealtimeSubscription` on `colaboradores`, `clientes`, `fornecedores`, `prestadores`, `gsa_afiliados`, `sistema_logs`, `system_settings`.
- Enriched `Dashboard.tsx` realtime tables with `ordens_servico` and `ordens_fiscais`.
- Maintained exact contract requirements for `useAdminNotifications.tsx` passing `scripts/check-realtime-contracts.ts`.

## Artifact Index
- `.agents/worker_m2_partners_polling_gen3/DISPATCH.md` — Assignment
- `.agents/worker_m2_partners_polling_gen3/BRIEFING.md` — Working memory
- `.agents/worker_m2_partners_polling_gen3/progress.md` — Progress tracker and heartbeat
- `.agents/worker_m2_partners_polling_gen3/handoff.md` — Handoff report

## Change Tracker
- **Files modified**:
  - `src/components/admin/CareersAdminModule.tsx` — eliminated 20s polling interval and connected realtime on `gsa_careers_applications` and `trabalhe_conosco`.
  - `src/components/admin/SystemMonitorModule.tsx` — removed duplicate useRealtimeTable, implemented canonical `useRealtimeSubscription` across 7 tables.
  - `src/components/admin/Dashboard.tsx` — added `ordens_servico` and `ordens_fiscais` to `useRealtimeSubscription`.
- **Build status**: Vitest test suite passing (110 passed across 13 suites). Realtime contract check passing (`REALTIME_RESILIENCE_CONTRACTS_OK`).
- **Pending issues**: none in Milestone 2.

## Quality Status
- **Build/test result**: `npx vitest run src/tests` -> 13 passed, 110 tests passing. `npx tsx scripts/check-realtime-contracts.ts` -> OK.
- **Lint status**: 0 violations in owned files.
- **Tests added/modified**: Existing test suites verified and passing.

## Loaded Skills
- None requested
