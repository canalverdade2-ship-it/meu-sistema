# Handoff Report: Realtime Survey & Polling Elimination (R2–R8, R10, R11)

**Agent**: `teamwork_preview_explorer_survey_rt_2`  
**Parent**: `ff3b7a73-adea-4d23-b7cf-9167deb8404d`  
**Working Directory**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_rt_2`  
**Workspace Root**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`  
**Type**: Hard Handoff (Investigation Complete)

---

## 1. Observation

### 1.1 All `setInterval` Occurrences in Codebase (34 Total)
A full grep search (`grep -r "setInterval" src`) identified 34 instances across 23 distinct files:
- `src/components/admin/ShopeeOperationsModule.tsx:113` — `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 15_000);`
- `src/components/admin/GsaTvModule.tsx:183` — `const interval = setInterval(fetchMetrics, 2500);`
- `src/components/admin/SystemMonitorModule.tsx:258` — `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 15_000);`
- `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx:114` — `const interval = setInterval(fetchLiveMetrics, 30000);`
- `src/pages/AdvertiserPortal.tsx:506` — `const interval = window.setInterval(() => void load(true), 30_000);`
- `src/pages/AdvertiserPortal.tsx:536` — `const timer = window.setInterval(() => setResendSeconds((current) => Math.max(0, current - 1)), 1000);`
- `src/pages/Afiliado/AfiliadoDashboard.tsx:383` — `const interval = window.setInterval(() => void load(true), 30000);`
- `src/hooks/useAdminNotifications.tsx:330` — `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshAll(false); }, 60_000);`
- `src/components/admin/Dashboard.tsx:199` — `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 60_000);`
- `src/components/admin/AcessosModule.tsx:148` — `const interval = window.setInterval(() => { ... void load(true, isMounted); }, 60_000);`
- `src/components/admin/AffiliateAdminModule.tsx:230` — `const interval = window.setInterval(() => void load(true), 30000);`
- `src/components/admin/CareersAdminModule.tsx:124` — `const interval = window.setInterval(() => void fetchApplications(true), 20_000);`
- `src/components/admin/super-domains/governanca/GovernancaAcessosView.tsx:114` — `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 60_000);`
- `src/components/admin/super-domains/governanca/GovernancaExecutiveDashboard.tsx:102` — `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 45_000);`
- `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx:153` — `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 20_000);`
- `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx:88` — `const interval = window.setInterval(() => fetchApplications(true), 30_000);`
- `src/components/admin/ScrapingExecutionMonitorModal.tsx:60` (1s stopwatch timer) & `Line 88` (2s log fetch fallback)
- `src/components/admin/infra/OracleMetricsPanel.tsx:25` — `const interval = setInterval(fetchMetrics, 30000);`
- `src/components/admin/infra/WhatsAppQRCodeManager.tsx:286` — `const poll = setInterval(async () => { ... }, 3000);` (3-minute QR scan wait)
- `src/components/admin/products/import/MediaImportSource.tsx:86` — `intervalRef.current = setInterval(() => { ... }, 1000);`
- `src/components/auth/WhatsAppPinVerification.tsx:26` — `timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);`
- `src/components/campaigns/SiteCampaignBootstrap.tsx:40` — `const interval = window.setInterval(refresh, 30_000);`
- `src/components/client/store/CheckoutPixModal.tsx:141` (1s countdown) & `Line 168` (3s PIX status check)
- `src/components/client/store/EcommerceHome.tsx:45` (1s deal countdown) & `Line 107` (5s carousel)
- `src/components/client/store/OrderSuccessPage.tsx:21` — `const interval = setInterval(..., 250);` (confetti animation)
- `src/hooks/useAutoLogout.ts:90` — `const pingInterval = setInterval(checkSessionLiveness, 20_000);`
- `src/hooks/useClientNotifications.tsx:362` — `const heartbeatInterval = setInterval(() => { ... }, 60_000);`
- `src/hooks/useProviderNotifications.tsx:249` — `const heartbeat = window.setInterval(() => void refreshCounts(), HEARTBEAT_INTERVAL_MS);`
- `src/pages/AdminPanel.tsx:163` — `const timer = window.setInterval(() => setTime(new Date()), 1000);`
- `src/pages/Fornecedor/FornecedorDashboard.tsx:102` — `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 30_000);`
- `src/pages/SecureAdminPanel.tsx:120` — `const interval = window.setInterval(refresh, 30_000);`

### 1.2 Target Subsystem File Inspections
1. **R2 Partners**:
   - `src/components/public/PartnersPage.tsx`: Loads via `listPublicPartners()` and `getPublicPartner()`. Currently lacks realtime subscription to table `parceiros`.
   - `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`: Loads via `listAdminPartners()` and `listPartnerRedemptions()`.
   - `src/components/admin/PartnersAdminModule.tsx`: Loads via `listAdminPartners()`.
2. **R3 Admin Dashboard & Bell**:
   - `src/components/admin/Dashboard.tsx`: Loads via RPC `gsa_admin_dashboard_snapshot`. Currently polls every 60s.
   - `src/hooks/useAdminNotifications.tsx`: Loads via RPCs `gsa_admin_get_pendency_counts_secure` and `gsa_admin_list_notifications`. Only subscribes to `admin_notificacoes` and `notificacoes`; polls every 60s.
3. **R4 Financeiro Super-Domain (8 files)**:
   - `FaturamentoView.tsx`, `CobrancaView.tsx`, `FluxoCaixaView.tsx`, `EmprestimosCreditoView.tsx`, `FiscalView.tsx`, `RentabilidadeReembolsosView.tsx`, `CalculadorasGatewayView.tsx`, `FinanceiroSuperDomain.tsx`.
   - All have direct query or RPC loaders but lack Postgres changes event listeners.
4. **R5 Contratos Super-Domain (5 files + subviews)**:
   - `AreaVipView.tsx`, `AtendimentoTicketsView.tsx`, `ContratosDocumentosView.tsx`, `CrmClientesView.tsx`, `HubEmpresasView.tsx`, `GsaSaudeView.tsx`, `GsaSegurosView.tsx`, `ContratosSuperDomain.tsx`.
5. **R6 Governança Super-Domain (5 files)**:
   - `GovernancaAcessosView.tsx`, `GovernancaAuditoriaView.tsx`, `GovernancaConfiguracoesView.tsx`, `GovernancaExecutiveDashboard.tsx`, `GovernancaInfraView.tsx`.
6. **R7 Operações Super-Domain**:
   - `OperacoesSuperDomain.tsx`: Has 30s `setInterval(fetchLiveMetrics, 30000)` on line 114.
7. **R8 Pessoas Super-Domain (7 files)**:
   - `AfiliadosSection.tsx`, `FidelidadePromocoesSection.tsx`, `NovoPrestadorDrawer.tsx`, `PayoutClearanceDrawer.tsx`, `PrestadorDetailDrawer.tsx`, `SaquesRepassesSection.tsx`, `TrabalheConoscoSection.tsx`.
8. **R10 Polling Files**:
   - `ShopeeOperationsModule.tsx:113` (15s polling)
   - `GsaTvModule.tsx:183` (2.5s polling)
   - `SystemMonitorModule.tsx:258` (15s polling)
9. **R11 Portals Polling**:
   - `AdvertiserPortal.tsx:506` (30s polling)
   - `AfiliadoDashboard.tsx:383` (30s polling)

---

## 2. Logic Chain

1. **Premise 1 (Acceptance Criteria on Polling)**: The acceptance criteria explicitly state that `grep -r "setInterval" src --include="*.tsx"` must not match `ShopeeOperationsModule`, `GsaTvModule`, `SystemMonitorModule`, `OperacoesSuperDomain`, `AdvertiserPortal`, `AfiliadoDashboard`.
2. **Premise 2 (Event-Driven State Updates)**: In all audited modules, the current polling loops exist solely as a fallback because Postgres CDC events are not wired to trigger component re-fetch.
3. **Inference 1**: By introducing Supabase Realtime subscriptions (`postgres_changes` on relevant table names) with standard `useEffect` mount/unmount cleanup (`supabase.removeChannel`), the polling loops can be completely removed without losing data freshness.
4. **Inference 2 (Cross-Session Instantaneous Reflection for Partners R2)**: Subscribing `PartnersPage.tsx`, `FornecedoresSection.tsx`, and `PartnersAdminModule.tsx` to `parceiros` ensures that status transitions (`ativo` <-> `inativo`) trigger immediate component re-fetch in < 2 seconds across all open tabs and sessions.
5. **Inference 3 (Debounced Notification Bell R3)**: Expanding `useAdminNotifications.tsx` realtime listeners to the core operational tables (`faturas`, `cobrancas`, `saques`, `tickets`, `orcamentos`, `ordens_servico`, `ordens_fiscais`) through the existing debounced `scheduleRefresh` fulfills the `< 3 seconds` bell badge update requirement while preventing network congestion.

---

## 3. Caveats

1. **External System Metrics Polling**: `OracleMetricsPanel.tsx` (line 25) polls external VPS hardware metrics via an external endpoint (`/api/vps-metrics`), and `WhatsAppQRCodeManager.tsx` polls a 3-minute temporary QR connection state via an Edge function. These do not query database tables and are operational device connections.
2. **Client UI Animation Timers**: Several client files (`EcommerceHome.tsx`, `CheckoutPixModal.tsx`, `OrderSuccessPage.tsx`, `AdminPanel.tsx` clock, `AdvertiserPortal.tsx:536` OTP timer) use `setInterval` purely for visual stopwatch/countdown/animation ticks without making database calls.
3. **Existing Realtime Channels**: 17 files identified in `ORIGINAL_REQUEST.md` (e.g. `OrcamentosWorkstation.tsx`, `OrdensServicoWorkstation.tsx`, `PainelRentabilidade.tsx`, `PrestadoresSection.tsx`, `FornecedorDashboard.tsx`) already have native realtime channels and must remain undisturbed.

---

## 4. Conclusion

1. The codebase is thoroughly mapped for all Super-Domains (Financeiro, Contratos, Governança, Operações, Pessoas), Partners, Admin Notifications, Portals, and Operational Modules.
2. The exact 6 primary polling targets (`ShopeeOperationsModule`, `GsaTvModule`, `SystemMonitorModule`, `OperacoesSuperDomain`, `AdvertiserPortal`, `AfiliadoDashboard`) plus the secondary admin modules (`GovernancaAcessosView`, `GovernancaExecutiveDashboard`, `GovernancaInfraView`, `TrabalheConoscoSection`, `AcessosModule`, `AffiliateAdminModule`, `CareersAdminModule`, `Dashboard.tsx`, `useAdminNotifications.tsx`) have verified table dependencies and clear realtime conversion paths.
3. Full implementation blueprints, table mappings, and code references have been documented in `.agents/teamwork_preview_explorer_survey_rt_2/analysis.md`.

---

## 5. Verification Method

To independently verify the survey observations:
1. **Verify `setInterval` grep locations**:
   ```bash
   grep -rn "setInterval" src
   ```
2. **Verify target file lines**:
   - Inspect `src/components/admin/ShopeeOperationsModule.tsx` line 113
   - Inspect `src/components/admin/GsaTvModule.tsx` line 183
   - Inspect `src/components/admin/SystemMonitorModule.tsx` line 258
   - Inspect `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx` line 114
   - Inspect `src/pages/AdvertiserPortal.tsx` line 506
   - Inspect `src/pages/Afiliado/AfiliadoDashboard.tsx` line 383
   - Inspect `src/hooks/useAdminNotifications.tsx` line 330
3. **Verify Partners & Super-Domains mapping**:
   - Inspect `src/components/public/PartnersPage.tsx` lines 147–181
   - Inspect `src/components/admin/super-domains/financeiro/FaturamentoView.tsx` lines 87–110
   - Inspect `src/components/admin/super-domains/contratos/AtendimentoTicketsView.tsx` lines 47–90
   - Inspect `src/components/admin/super-domains/governanca/GovernancaAcessosView.tsx` lines 95–118
   - Inspect `src/components/admin/super-domains/pessoas/SaquesRepassesSection.tsx` lines 35–120
