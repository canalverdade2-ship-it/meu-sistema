## 2026-08-21T22:28:04Z
You are a teamwork_preview_worker.
Your working directory is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r5_contracts_1
Project root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`
Authoritative User Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md (READ THIS FIRST).
PROJECT state: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md.
Explorer Diagnostic Report: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_diag_build_test_1\handoff.md.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive Write Ownership:
- src/hooks/useAutoLogout.ts
- src/lib/providerStorage.ts
- src/components/public/PartnersPage.tsx
- src/hooks/useClientNotifications.tsx
- src/components/admin/SystemMonitorModule.tsx
- src/main.tsx
- src/pages/AdminPanel.tsx
- scripts/check-advertising-foundation.ts
- scripts/check-advertising-completion.ts
- src/components/admin/AdvertisingAdminModule.tsx

Your Task:
Implement the contract alignments and fixes identified in explorer_diag_build_test_1/handoff.md §4:
1. src/hooks/useAutoLogout.ts: Add `// evitando duas chamadas concorrentes` and `Promise.resolve(onLogout(reason || undefined));`.
2. src/lib/providerStorage.ts: Add `Math.min(Math.max(expiresInSeconds, 30), 900)` in resolveProviderFileUrl.
3. src/components/public/PartnersPage.tsx: Line 422: change to `ao painel administrativo para análise`.
4. src/hooks/useClientNotifications.tsx: Set `const HEARTBEAT_INTERVAL_MS = 60000; const RECONNECT_DELAY_MS = 3000;`.
5. src/components/admin/SystemMonitorModule.tsx: Ensure card includes label text `Visão somente leitura`.
6. src/main.tsx: Mount `<SiteCampaignBootstrap />` from `./components/campaigns/SiteCampaignBootstrap`.
7. src/pages/AdminPanel.tsx: Ensure `avisos-campanhas` is in MENU_GROUPS and maps to SiteCampaignAdminPage.
8. src/components/admin/AdvertisingAdminModule.tsx & scripts/check-advertising-*.ts: Ensure `gsa-advertiser-admin` contract is satisfied and edge function path matches.

After edits:
Run each contract check:
- npm run test:client-security
- npm run test:provider
- npm run test:home
- npm run test:advertising
- npm run test:advertising-complete
- npm run test:realtime
- npm run test:site-campaigns
- npm run test:admin
- npm run test:integrity:contracts
Verify that `npm run test:integrity:contracts` passes with exit code 0.
Write handoff.md with verification results and send a message to parent.
