## 2026-08-28T14:36:10Z
You are Reviewer 1 (Frontend Realtime: R1, R2, R3) for Realtime P0 Critical Remediation.
Your working directory is: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\reviewer_frontend`
Original request: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`
Project master: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md`

Your Mission:
Review the frontend deliverables for R1, R2, and R3:
1. `src/hooks/useRealtime.ts` and `src/hooks/useRealtimeTable.ts`
2. R2 Modules: `ProdutosModule.tsx`, `OrdensAssinaturaModule.tsx`, `OrdensCompraModule.tsx`, `AdvertisingAdminModule.tsx`, `ServicePackagesModule.tsx`, `TrabalheConoscoSection.tsx`, `CareersAdminModule.tsx`, `PessoasSuperDomain.tsx`
3. R3 Modules: `ConfiguracoesModule.tsx`, `OrcamentosWorkstation.tsx`, `useClientNotifications.tsx`, `AfiliadoDashboard.tsx`, `PurchasesPage.tsx`, `CouponsPage.tsx`, `PrestadorDetailDrawer.tsx`

Review Criteria:
- Stale closures and index alignment under `enabled: false`.
- React Hook Rules (no hooks inside async functions, loops, or conditionals).
- Ghost table replacement with actual tables.
- Row-level security filters (`filter: 'coluna=eq.{id}'`) and `enabled: Boolean(id)` guards.
- Execute validation: `npx vitest run src/tests/realtime-hook.test.ts`, `npx tsx scripts/check-realtime-audit.ts`, and `npm run build`.

Write your full review and final verdict (APPROVE or REQUEST_CHANGES) to `.agents/reviewer_frontend/handoff.md` and send a summary message.
