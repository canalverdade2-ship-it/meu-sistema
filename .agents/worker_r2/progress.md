# Progress — Worker R2

Last visited: 2026-08-28T14:23:00Z
Status: Complete

## Steps:
- [x] Workspace & metadata initialized
- [x] Inspect and understand Hook Rules Violations in `ProdutosModule.tsx`, `OrdensAssinaturaModule.tsx`, `OrdensCompraModule.tsx`
- [x] Implement Hook Rules fixes (move `useEffect` and `useRealtimeSubscription` to component top-level, wrap fetch functions with `useCallback`)
- [x] Inspect and understand Ghost Tables in `AdvertisingAdminModule.tsx`, `ServicePackagesModule.tsx`, `TrabalheConoscoSection.tsx`, `CareersAdminModule.tsx`, `PessoasSuperDomain.tsx`
- [x] Implement Ghost Tables fixes (replace non-existent table strings with exact PostgreSQL table schemas: `gsa_ad_*`, `servicos_pacotes`, `gsa_careers_applications`)
- [x] Run verification tests and contract scripts (`npm run test:realtime`, `npm run test:careers`, `npm run test:advertising`, `npm run test:products-subscriptions`, `npx vitest run src/tests/realtime-hook.test.ts`, `npx tsx scripts/check-realtime-audit.ts`)
- [x] Document in `handoff.md` and report to orchestrator
