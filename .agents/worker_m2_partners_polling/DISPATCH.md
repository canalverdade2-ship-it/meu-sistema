## 2026-08-26T14:19:14Z

You are worker_m2_partners_polling.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_partners_polling
Workspace root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP: Read the user request verbatim in:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (specifically timestamp 2026-08-26T13:52:52Z) and `PROJECT.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Scope: Milestone 2 — Partners (R2), Admin Bell & Dashboard (R3), and Polling Elimination (R7, R10-polling, R11-polling).
Exclusive File Ownership:
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

Tasks:
- Use canonical `useRealtimeSubscription` / `useRealtime` from `src/hooks/useRealtime.ts` (or `supabase.removeChannel` cleanup).
- For Partners (R2): Ensure `PartnersPage.tsx`, `FornecedoresSection.tsx`, `PartnersAdminModule.tsx` subscribe to `parceiros` and update on insert/update/delete (<2s update time).
- For Admin Bell & Dashboard (R3): Replace `setInterval` in `useAdminNotifications.tsx` and `Dashboard.tsx` with realtime subscriptions on `faturas`, `cobrancas`, `saques`, `tickets`, `orcamentos`, `ordens_servico`, `ordens_fiscais`, `vouchers`, etc. Ensure bell badge updates within 3s. Preserve required tokens from `scripts/check-realtime-contracts.ts`.
- For Polling Elimination: Completely remove `setInterval` polling in `OperacoesSuperDomain.tsx`, `ShopeeOperationsModule.tsx`, `GsaTvModule.tsx`, `SystemMonitorModule.tsx`, `AdvertiserPortal.tsx`, `AfiliadoDashboard.tsx`, `AcessosModule.tsx`, `AffiliateAdminModule.tsx`, `CareersAdminModule.tsx` and replace with realtime subscriptions on their corresponding tables.
- Run `npx vitest run src/tests` and `npm run build` to verify exit code 0 and zero regressions.
- Write `handoff.md` and report back.
