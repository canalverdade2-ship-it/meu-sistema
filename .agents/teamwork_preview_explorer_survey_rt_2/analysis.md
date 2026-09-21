# Comprehensive Technical Survey: Realtime Architecture & Polling Elimination

**Author**: `teamwork_preview_explorer_survey_rt_2`  
**Date**: 2026-08-26  
**Scope**: Requirements R2, R3, R4, R5, R6, R7, R8, R10, R11 & Exhaustive Codebase `setInterval` Audit  

---

## 1. Master Inventory of All `setInterval` Occurrences

Across the entire `src/` directory, **34 occurrences of `setInterval` / `window.setInterval`** were identified. Below is the complete classification into **Polling (Must be replaced with Realtime)** vs. **UI Timers (Preserve)**.

| # | File Path | Line | Interval | Function Called / Logic | Tables / RPCs Touched | Classification & Strategy |
|---|---|---|---|---|---|---|
| 1 | `src/components/admin/ShopeeOperationsModule.tsx` | 113 | 15,000 ms (15s) | `load(true)` | RPCs: `gsa_admin_shopee_queue`, `gsa_admin_shopee_workers` (tables: `shopee_fulfillment_jobs`, `shopee_automation_workers`) | **POLLING → REALTIME**: Subscribe to `shopee_fulfillment_jobs` and `shopee_automation_workers`. Remove `setInterval`. |
| 2 | `src/components/admin/GsaTvModule.tsx` | 183 | 2,500 ms (2.5s) | `fetchMetrics()` | Fetch `/api/gsa-tv/metrics` & DB tables (`gsa_tv_channels`, `gsa_tv_media_items`, `gsa_tv_schedule_slots`, `gsa_tv_playlists`, `gsa_tv_incidents`, `gsa_tv_audit_log`, `gsa_tv_jobs`) | **POLLING → REALTIME**: Subscribe to `gsa_tv_*` tables. Remove `setInterval` to satisfy grep acceptance criteria. |
| 3 | `src/components/admin/SystemMonitorModule.tsx` | 258 | 15,000 ms (15s) | `load(true)` | RPC: `gsa_admin_system_snapshot` (tables: `clientes`, `fornecedores`, `prestadores`, `gsa_afiliados`, `colaboradores`) | **POLLING → REALTIME**: Module already has channels for 5 tables; remove redundant 15s `setInterval` polling loop. |
| 4 | `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx` | 114 | 30,000 ms (30s) | `fetchLiveMetrics()` | Tables: `orcamentos`, `ordens_servico`, `prestador_demandas`, `ordens_compra` | **POLLING → REALTIME**: Subscribe to `orcamentos`, `ordens_servico`, `prestador_demandas`, `ordens_compra`. Remove `setInterval`. |
| 5 | `src/pages/AdvertiserPortal.tsx` | 506 | 30,000 ms (30s) | `load(true)` | RPC: `gsa_advertiser_portal_snapshot` (tables: `gsa_advertisers`, `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_contracts`, `gsa_ad_invoices`) | **POLLING → REALTIME**: Subscribe to `gsa_advertisers`, `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`. Remove 30s `setInterval`. |
| 6 | `src/pages/AdvertiserPortal.tsx` | 536 | 1,000 ms (1s) | `setResendSeconds(current - 1)` | N/A (Client state) | **UI TIMER (PRESERVE)**: SMS/OTP 60-second cooldown timer. |
| 7 | `src/pages/Afiliado/AfiliadoDashboard.tsx` | 383 | 30,000 ms (30s) | `load(true)` | RPC: `gsa_client_affiliate_snapshot` + tables `clientes`, `tickets`, `gsa_afiliados`, `indicacoes`, `saques`, `points_transactions` | **POLLING → REALTIME**: Subscribe to `gsa_afiliados`, `indicacoes`, `saques`, `points_transactions`, `clientes`, `tickets`. Remove `setInterval`. |
| 8 | `src/hooks/useAdminNotifications.tsx` | 330 | 60,000 ms (60s) | `refreshAll(false)` | RPCs: `gsa_admin_get_pendency_counts_secure`, `gsa_admin_list_notifications` (aggregates 10+ operational tables) | **POLLING → REALTIME**: Expand channel to all pending tables (`clientes`, `faturas`, `cobrancas`, `saques`, `orcamentos`, `tickets`, `prestador_demandas`, `ordens_servico`, `notificacoes`, `admin_notificacoes`) + debounce via `scheduleRefresh`. Remove 60s `setInterval`. |
| 9 | `src/components/admin/Dashboard.tsx` | 199 | 60,000 ms (60s) | `load(true)` | RPC: `gsa_admin_dashboard_snapshot` (tables: `clientes`, `faturas`, `ordens_compra`, `tickets`, `vouchers`, `prestador_demandas`, `saques`) | **POLLING → REALTIME**: Subscribe to `faturas`, `clientes`, `ordens_compra`, `tickets`, `saques`. Remove 60s `setInterval`. |
| 10 | `src/components/admin/AcessosModule.tsx` | 148 | 60,000 ms (60s) | `load(true, isMounted)` | RPC: `gsa_admin_access_snapshot` (tables: `colaboradores`, `solicitacoes_exclusao`) | **POLLING → REALTIME**: Subscribe to `colaboradores`, `solicitacoes_exclusao`. Remove `setInterval`. |
| 11 | `src/components/admin/AffiliateAdminModule.tsx` | 230 | 30,000 ms (30s) | `load(true)` | RPC: `gsa_admin_affiliate_snapshot` (tables: `gsa_afiliados`, `indicacoes`, `saques`) | **POLLING → REALTIME**: Subscribe to `gsa_afiliados`, `indicacoes`, `saques`. Remove `setInterval`. |
| 12 | `src/components/admin/CareersAdminModule.tsx` | 124 | 20,000 ms (20s) | `fetchApplications(true)` | RPC: `gsa_admin_list_career_applications` (table: `gsa_career_applications`) | **POLLING → REALTIME**: Subscribe to `gsa_career_applications`. Remove `setInterval`. |
| 13 | `src/components/admin/super-domains/governanca/GovernancaAcessosView.tsx` | 114 | 60,000 ms (60s) | `load(true)` | RPC: `gsa_admin_access_snapshot` (tables: `colaboradores`, `solicitacoes_exclusao`) | **POLLING → REALTIME**: Subscribe to `colaboradores`, `solicitacoes_exclusao`. Remove `setInterval`. |
| 14 | `src/components/admin/super-domains/governanca/GovernancaExecutiveDashboard.tsx` | 102 | 45,000 ms (45s) | `load(true)` | RPC: `gsa_admin_dashboard_snapshot` (tables: `clientes`, `faturas`, `ordens_compra`, `tickets`, `vouchers`, `prestador_demandas`, `saques`) | **POLLING → REALTIME**: Subscribe to `faturas`, `clientes`, `ordens_compra`, `tickets`, `saques`. Remove 45s `setInterval`. |
| 15 | `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx` | 153 | 20,000 ms (20s) | `load(true)` | RPC: `gsa_admin_system_snapshot` (tables: `colaboradores`, `clientes`, `fornecedores`, `prestadores`, `gsa_afiliados`) | **POLLING → REALTIME**: Already subscribes to `colaboradores`, expand to all 5 snapshot tables and remove 20s `setInterval`. |
| 16 | `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx` | 88 | 30,000 ms (30s) | `fetchApplications(true)` | RPC: `gsa_admin_list_career_applications` (table: `gsa_career_applications`) | **POLLING → REALTIME**: Subscribe to `gsa_career_applications`. Remove `setInterval`. |
| 17 | `src/components/admin/ScrapingExecutionMonitorModal.tsx` | 60 | 1,000 ms (1s) | `setElapsedSeconds(prev + 1)` | N/A (Client stopwatch) | **UI TIMER (PRESERVE)**: Elapsed runtime counter in modal. |
| 18 | `src/components/admin/ScrapingExecutionMonitorModal.tsx` | 88 | 2,000 ms (2s) | `fetchLogsQuiet()` | Table: `automacao_scraping_logs` | **POLLING → REALTIME**: Already has channel on `automacao_scraping_logs`. Remove fallback 2s `setInterval`. |
| 19 | `src/components/admin/infra/OracleMetricsPanel.tsx` | 25 | 30,000 ms (30s) | `fetchMetrics()` | External VPS API `/api/vps-metrics` | Polling external hardware metrics. |
| 20 | `src/components/admin/infra/WhatsAppQRCodeManager.tsx` | 286 | 3,000 ms (3s) | `poll()` (QR check) | VPS Edge Function `whatsapp-status` | Short-lived QR connection polling (max 60 attempts = 3 min). |
| 21 | `src/components/admin/products/import/MediaImportSource.tsx` | 86 | 1,000 ms (1s) | Media progress bar simulation | N/A | **UI TIMER (PRESERVE)**: Import progress indicator animation. |
| 22 | `src/components/auth/WhatsAppPinVerification.tsx` | 26 | 1,000 ms (1s) | `setTimeLeft(prev - 1)` | N/A | **UI TIMER (PRESERVE)**: 60-second OTP cooldown timer. |
| 23 | `src/components/campaigns/SiteCampaignBootstrap.tsx` | 40 | 30,000 ms (30s) | `refresh()` | Local storage / session / route check | Client routing/session sync. |
| 24 | `src/components/client/store/CheckoutPixModal.tsx` | 141 | 1,000 ms (1s) | PIX expiration countdown timer | N/A | **UI TIMER (PRESERVE)**: 15-minute countdown clock. |
| 25 | `src/components/client/store/CheckoutPixModal.tsx` | 168 | 3,000 ms (3s) | `checkStatusNow()` | Table: `faturas` / `ordens_compra` | Polling for PIX webhook settlement. |
| 26 | `src/components/client/store/EcommerceHome.tsx` | 45 | 1,000 ms (1s) | `setTime(getTimeLeft())` | N/A | **UI TIMER (PRESERVE)**: Flash deal countdown clock. |
| 27 | `src/components/client/store/EcommerceHome.tsx` | 107 | 5,000 ms (5s) | Carousel auto-slide | N/A | **UI TIMER (PRESERVE)**: Banner carousel slider. |
| 28 | `src/components/client/store/OrderSuccessPage.tsx` | 21 | 250 ms | Confetti burst timer | N/A | **UI TIMER (PRESERVE)**: Confetti visual effect. |
| 29 | `src/hooks/useAutoLogout.ts` | 90 | 20,000 ms (20s) | `checkSessionLiveness()` | Session storage check | **INFRA TIMER (PRESERVE)**: Inactivity security checker. |
| 30 | `src/hooks/useClientNotifications.tsx` | 362 | 60,000 ms (60s) | Heartbeat check | `notificacoes`, `faturas` | Heartbeat backup (already has primary Supabase realtime channels). |
| 31 | `src/hooks/useProviderNotifications.tsx` | 249 | 30,000 ms (30s) | `refreshCounts()` | `prestador_demandas`, `prestador_saques` | Heartbeat backup (already has primary Supabase realtime channels). |
| 32 | `src/pages/AdminPanel.tsx` | 163 | 1,000 ms (1s) | `setTime(new Date())` | N/A | **UI TIMER (PRESERVE)**: Topbar digital clock. |
| 33 | `src/pages/Fornecedor/FornecedorDashboard.tsx` | 102 | 30,000 ms (30s) | `load(true)` | Supplier snapshot / orders | Broadcast fallback. Remove 30s interval to rely on `supplier-sync` channel. |
| 34 | `src/pages/SecureAdminPanel.tsx` | 120 | 30,000 ms (30s) | `refreshAccess()` | `colaboradores`, `colaborador_modulos` | Fallback interval (already has `collaborator-access` realtime channel). Remove 30s interval. |

---

## 2. Requirement R2: Partners Subsystem Analysis

### 2.1 File Breakdown & Data Flow

#### A. `src/components/public/PartnersPage.tsx`
- **Current Behavior**:
  - `useEffect` (lines 147–181) triggers on `[reloadKey, selectedSlug]`.
  - When `selectedSlug` is null, calls `listPublicPartners()` (`src/features/partners/service.ts:42`) which queries:
    ```sql
    SELECT * FROM parceiros WHERE status = 'ativo' ORDER BY featured DESC, display_order ASC, name ASC;
    ```
  - When `selectedSlug` is present, calls `getPublicPartner(slug)` (`src/features/partners/service.ts:54`) querying `parceiros WHERE status = 'ativo' AND slug = ?`.
- **Target Realtime Reaction**:
  - Subscribe to table `parceiros` with channel name `public-partners-live`.
  - On any `INSERT`, `UPDATE`, or `DELETE`:
    - If `!selectedSlug`: re-run `listPublicPartners()` and update `partners` state.
    - If `selectedSlug`: re-run `getPublicPartner(selectedSlug)`. If the row's status changed to `inativo` or was deleted, `selectedPartner` becomes null and immediately transitions to the "Parceiro não encontrado" / redirect state.
  - **Latency SLA**: Changes propagate via WebSocket and render in `< 2 seconds` without page reload.

#### B. `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`
- **Current Behavior**:
  - Tab `parceiros` calls `loadPartnerData()` (`FornecedoresSection.tsx:132`) which calls `listAdminPartners()` -> RPC `gsa_admin_partners_snapshot`.
  - Redemptions sub-view calls `loadRedemptions(partnerId)` -> `listPartnerRedemptions(partnerId)`.
- **Target Realtime Reaction**:
  - Subscribe to `parceiros` and `parceiros_resgates`.
  - On `parceiros` change: call `loadPartnerData()`.
  - On `parceiros_resgates` change: call `loadRedemptions(selectedPartner.id)`.

#### C. `src/components/admin/PartnersAdminModule.tsx`
- **Current Behavior**:
  - Calls `load()` (`PartnersAdminModule.tsx:115`) -> `listAdminPartners()` on mount.
- **Target Realtime Reaction**:
  - Subscribe to `parceiros`. On change: invoke `load()`.

---

## 3. Requirement R3: Admin Dashboard & Bell Analysis

### 3.1 `src/components/admin/Dashboard.tsx`
- **Current Data Loading**:
  - Calls `load()` (line 169) -> RPC `gsa_admin_dashboard_snapshot`.
  - Has a 60s `setInterval` polling loop (lines 199–201).
- **Tables Impacting Snapshot**:
  - `clientes`, `faturas`, `ordens_compra`, `tickets`, `vouchers`, `prestador_demandas`, `saques`, `loja_pedidos`.
- **Target Realtime Reaction**:
  - Create channel `admin-dashboard-live`.
  - Listen to `postgres_changes` on `faturas`, `clientes`, `ordens_compra`, `tickets`, `saques`, `prestador_demandas`.
  - On change: debounce 500ms and invoke `load(true)`.
  - Remove `setInterval`.

### 3.2 `src/hooks/useAdminNotifications.tsx`
- **Current Data Loading**:
  - `fetchPendencies()` (line 255) -> RPC `gsa_admin_get_pendency_counts_secure`.
  - `fetchNotifications()` (line 274) -> RPC `gsa_admin_list_notifications`.
  - Subscribes only to `admin_notificacoes` and `notificacoes` (lines 326–327).
  - Uses a 60s `setInterval` polling fallback (line 330).
- **Tables Driving Pendency Counts**:
  - `faturas`, `cobrancas`, `saques`, `transferencias`, `prestador_saques`, `orcamentos`, `prestador_demandas`, `ordens_servico`, `emprestimos`, `loja_credito_solicitacoes`, `tickets`, `solicitacoes_exclusao`, `ordens_fiscais`, `notificacoes`, `admin_notificacoes`.
- **Target Realtime Reaction**:
  - Add subscription listeners for core operational tables (`faturas`, `cobrancas`, `saques`, `transferencias`, `orcamentos`, `tickets`, `prestador_demandas`, `ordens_servico`, `ordens_fiscais`, `solicitacoes_exclusao`).
  - Route all events through existing debounced `scheduleRefresh(notifyOnNew)`.
  - Remove `setInterval`.
  - **Latency SLA**: Notification bell badge updates within `< 3 seconds` of any database change.

---

## 4. Super-Domains Deep Catalogue

### 4.1 Financeiro Super-Domain (`src/components/admin/super-domains/financeiro/`)

| File | Tables Queried | Primary Fetch Functions | Realtime Trigger & Strategy |
|---|---|---|---|
| `FaturamentoView.tsx` | `faturas`, `cobrancas`, `clientes`, `ordens_servico`, `ordens_compra`, `ordens_assinatura` | `fetchFaturas()`, `loadAvailableClients()`, `loadAvailableOrders()` | Subscribe to `faturas`, `cobrancas`, `ordens_servico`, `ordens_compra`. Trigger `fetchFaturas()` instantly on INSERT/UPDATE/DELETE. |
| `CobrancaView.tsx` | `cobrancas`, `faturas`, `clientes`, `cobranca_historico`, `cobranca_acordos`, `cobranca_acordo_parcelas`, `system_settings` | `fetchCobrancas()`, `fetchConfigs()` | Subscribe to `cobrancas`, `cobranca_acordos`, `cobranca_acordo_parcelas`. Trigger `fetchCobrancas()` on any mutation. |
| `FluxoCaixaView.tsx` | `saques`, `transferencias`, `clientes` | `fetchSaques()`, `fetchTransferencias()`, `loadAll()` | Subscribe to `saques` and `transferencias`. Trigger `fetchSaques()` / `fetchTransferencias()` on change. |
| `EmprestimosCreditoView.tsx` | `emprestimos`, `emprestimo_parcelas`, `emprestimo_documentos`, `loja_credito_solicitacoes`, `loja_credito_movimentacoes`, `clientes` | `fetchEmprestimos()`, `fetchCredito()` | Subscribe to `emprestimos`, `emprestimo_parcelas`, `loja_credito_solicitacoes`. Trigger corresponding fetch on change. |
| `FiscalView.tsx` | `ordens_fiscais` (via RPC `gsa_admin_list_resource`) | `loadData()` | Subscribe to `ordens_fiscais`. Trigger `loadData()` on INSERT/UPDATE. |
| `RentabilidadeReembolsosView.tsx` | `loja_reembolsos`, `carteira_lancamentos`, `clientes` | `fetchReembolsos()` | Subscribe to `loja_reembolsos`. Trigger `fetchReembolsos()` on change. |
| `CalculadorasGatewayView.tsx` | `vouchers`, `system_settings` (via RPC `gsa_admin_calculator_pro_snapshot`) | `loadSnapshot()` | Subscribe to `vouchers` and `system_settings`. Trigger `loadSnapshot()` on change. |
| `FinanceiroSuperDomain.tsx` | `faturas`, `saques`, `cobrancas`, `ordens_fiscais` | `fetchTelemetry()` | Subscribe to `faturas`, `saques`, `cobrancas`, `ordens_fiscais`. Trigger `fetchTelemetry()` on change. |

---

### 4.2 Contratos Super-Domain (`src/components/admin/super-domains/contratos/`)

| File | Tables Queried | Primary Fetch Functions | Realtime Trigger & Strategy |
|---|---|---|---|
| `AreaVipView.tsx` | `clientes` (`nivel_id`, `pontos_totais`, `saldo_pontos`) | `fetchMembers()` | Subscribe to `clientes`. Trigger `fetchMembers()` on update to points/tiers. |
| `AtendimentoTicketsView.tsx` | `tickets`, `ticket_mensagens`, `clientes` | `fetchTickets()` | Subscribe to `tickets` and `ticket_mensagens`. Trigger `fetchTickets()` instantly when messages arrive or status changes. |
| `ContratosDocumentosView.tsx` | `contratos`, `documentos_cliente` | `fetchContratos()` | Subscribe to `contratos`. Trigger `fetchContratos()` on INSERT/UPDATE/DELETE. |
| `CrmClientesView.tsx` | `clientes`, `faturas`, `carteira_lancamentos`, `documentos_cliente`, `cliente_documentos` | `fetchClientes()` | Subscribe to `clientes`, `faturas`, `carteira_lancamentos`. Trigger `fetchClientes()` on change. |
| `HubEmpresasView.tsx` | `clientes` (PJ filter: `tipo_pessoa = 'pj' OR cnpj IS NOT NULL`) | `fetchEmpresas()` | Subscribe to `clientes`. Trigger `fetchEmpresas()` on change. |
| `GsaSaudeView.tsx` | `saude_contratos` | `fetchSaude()` | Subscribe to `saude_contratos`. Trigger `fetchSaude()` on change. |
| `GsaSegurosView.tsx` | `seguros_apolices` | `fetchSeguros()` | Subscribe to `seguros_apolices`. Trigger `fetchSeguros()` on change. |
| `ContratosSuperDomain.tsx` | Orchestrates child sub-domains | `handleRefreshAll()` | Delegates realtime listening to dedicated child workstation components. |

---

### 4.3 Governança Super-Domain (`src/components/admin/super-domains/governanca/`)

| File | Tables Queried | Primary Fetch Functions | Realtime Trigger & Strategy |
|---|---|---|---|
| `GovernancaAcessosView.tsx` | `colaboradores`, `solicitacoes_exclusao`, `colaborador_funcoes`, `colaborador_sessoes` (via RPC `gsa_admin_access_snapshot`) | `load(silent)` | Subscribe to `colaboradores`, `solicitacoes_exclusao`, `colaborador_sessoes`. Trigger `load(true)`. Remove 60s `setInterval`. |
| `GovernancaAuditoriaView.tsx` | `sistema_logs`, `system_settings`, `solicitacoes_exclusao` | `fetchAuditLogs()` | Subscribe to `sistema_logs`, `solicitacoes_exclusao`, `system_settings`. Trigger `fetchAuditLogs()` on new log entries. |
| `GovernancaConfiguracoesView.tsx` | `empresa`, `system_settings`, `formas_pagamento` (via RPC `gsa_admin_settings_snapshot`) | `load()` | Subscribe to `system_settings`, `empresa`. Trigger `load()` on change. |
| `GovernancaExecutiveDashboard.tsx` | `clientes`, `faturas`, `ordens_compra`, `tickets`, `saques` (via RPC `gsa_admin_dashboard_snapshot`) | `load(silent)` | Subscribe to `faturas`, `clientes`, `ordens_compra`, `tickets`, `saques`. Trigger `load(true)`. Remove 45s `setInterval`. |
| `GovernancaInfraView.tsx` | `colaboradores`, `clientes`, `fornecedores`, `prestadores`, `gsa_afiliados` (via RPC `gsa_admin_system_snapshot`) | `load(silent)` | Subscribe to all 5 tables. Trigger `load(true)`. Remove 20s `setInterval`. |
| `GovernancaSuperDomain.tsx` | Sub-domain router & container | N/A | Sub-domain container delegating to views. |

---

### 4.4 Operações Super-Domain (`src/components/admin/super-domains/operacoes/`)

| File | Tables Queried | Primary Fetch Functions | Realtime Trigger & Strategy |
|---|---|---|---|
| `OperacoesSuperDomain.tsx` | `orcamentos`, `ordens_servico`, `prestador_demandas`, `ordens_compra` | `fetchLiveMetrics()` | Subscribe to `orcamentos`, `ordens_servico`, `prestador_demandas`, `ordens_compra`. Trigger `fetchLiveMetrics()` on change. Remove 30s `setInterval`. |
| `OrcamentosWorkstation.tsx` | `orcamentos` | Has existing realtime channel `orcamentos-realtime-channel` | **PRESERVE** existing channel. Do NOT modify. |
| `OrdensServicoWorkstation.tsx` | `ordens_servico` | Has existing realtime channel `ordens_servico_changes` | **PRESERVE** existing channel. Do NOT modify. |

---

### 4.5 Pessoas Super-Domain (`src/components/admin/super-domains/pessoas/`)

| File | Tables Queried | Primary Fetch Functions | Realtime Trigger & Strategy |
|---|---|---|---|
| `AfiliadosSection.tsx` | `gsa_afiliados`, `indicacoes`, `saques`, `points_transactions` (via RPC `gsa_admin_affiliate_snapshot`) | `fetchAffiliateSnapshot()` | Subscribe to `gsa_afiliados`, `indicacoes`, `saques`. Trigger `fetchAffiliateSnapshot()` on change. |
| `FidelidadePromocoesSection.tsx` | `cliente_premios`, `vouchers`, `cupons_loja`, `loja_solicitacoes`, `indicacoes`, `clientes` | `fetchPremios()`, `fetchVouchers()`, `fetchCupons()`, `fetchTrocas()`, `fetchIndicacoes()` | Subscribe to `cliente_premios`, `vouchers`, `cupons_loja`, `loja_solicitacoes`, `indicacoes`. Trigger corresponding fetch methods. |
| `NovoPrestadorDrawer.tsx` | `prestadores` (Insert action) | `handleSubmit()` | Action drawer; parent listens to `prestadores` channel. |
| `PayoutClearanceDrawer.tsx` | `saques`, `prestador_saques` (Action drawer) | `handleApprove()`, `handleReject()` | Action drawer; parent views re-fetch on realtime update. |
| `PrestadorDetailDrawer.tsx` | `prestador_demandas`, `prestadores` | `fetchDemandas()` | Subscribe to `prestador_demandas` filtered by `prestador_id`. Trigger `fetchDemandas()` on change. |
| `SaquesRepassesSection.tsx` | `prestador_saques`, `saques`, `prestadores`, `clientes` | `fetchAllSaques()` | Subscribe to `prestador_saques` and `saques`. Trigger `fetchAllSaques()` on change. |
| `TrabalheConoscoSection.tsx` | `gsa_career_applications` (via RPC `gsa_admin_list_career_applications`) | `fetchApplications()` | Subscribe to `gsa_career_applications`. Trigger `fetchApplications(true)`. Remove 30s `setInterval`. |
| `PrestadoresSection.tsx` | `prestadores` | `fetchPrestadores()` | Already has `sd3-prestadores-channel`. **PRESERVE**. |
| `FornecedoresSection.tsx` | `fornecedores`, `parceiros`, `parceiros_resgates` | `loadSupplierData()`, `loadPartnerData()`, `loadRedemptions()` | Subscribe to `fornecedores`, `parceiros`, `parceiros_resgates`. Trigger matching load functions. |
| `PessoasSuperDomain.tsx` | `prestadores`, `prestador_saques`, `saques`, `fornecedores`, `gsa_afiliados` | `fetchDomainMetrics()` | Subscribe to `prestadores`, `prestador_saques`, `saques`, `fornecedores`, `gsa_afiliados`. Trigger `fetchDomainMetrics()`. |

---

## 5. Requirements R10 & R11 Operational Modules & Portals

### 5.1 R10 Modules Polling Analysis
1. **`src/components/admin/ShopeeOperationsModule.tsx`**:
   - `window.setInterval(() => load(true), 15_000)` at line 113.
   - Tables: `shopee_fulfillment_jobs`, `shopee_automation_workers`.
   - Realtime replacement: channel on `shopee_fulfillment_jobs` and `shopee_automation_workers` calling `load(true)`. Remove `setInterval`.
2. **`src/components/admin/GsaTvModule.tsx`**:
   - `setInterval(fetchMetrics, 2500)` at line 183.
   - Tables: `gsa_tv_channels`, `gsa_tv_media_items`, `gsa_tv_schedule_slots`, `gsa_tv_playlists`, `gsa_tv_incidents`, `gsa_tv_audit_log`, `gsa_tv_jobs`.
   - Realtime replacement: channel on `gsa_tv_*` calling `loadRealData()`. Remove `setInterval`.
3. **`src/components/admin/SystemMonitorModule.tsx`**:
   - `window.setInterval(() => void load(true), 15_000)` at line 258.
   - Tables: `colaboradores`, `clientes`, `fornecedores`, `prestadores`, `gsa_afiliados`.
   - Realtime replacement: Module already has channel `system-monitor-realtime-live`; simply remove the 15s `setInterval` polling block.

### 5.2 R11 Portals Polling Analysis
1. **`src/pages/AdvertiserPortal.tsx`**:
   - `window.setInterval(() => void load(true), 30_000)` at line 506.
   - Tables: `gsa_advertisers`, `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`.
   - Realtime replacement: channel on `gsa_advertisers`, `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns` calling `load(true)`. Remove 30s `setInterval`. Keep line 536 SMS cooldown timer intact.
2. **`src/pages/Afiliado/AfiliadoDashboard.tsx`**:
   - `window.setInterval(() => void load(true), 30000)` at line 383.
   - Tables: `gsa_afiliados`, `indicacoes`, `saques`, `points_transactions`, `clientes`, `tickets`.
   - Realtime replacement: channel on `gsa_afiliados`, `indicacoes`, `saques`, `points_transactions`, `clientes`, `tickets` calling `load(true)`. Remove 30s `setInterval`.

---

## 6. Realtime Subscription Lifecycle & Cleanup Architecture

To ensure zero memory leaks, every Supabase Realtime channel subscription must adhere to the following contract:

```typescript
useEffect(() => {
  let isMounted = true;
  void loadData();

  const channel = supabase
    .channel('unique-channel-name')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'target_table' }, (payload) => {
      if (isMounted) {
        void loadData();
      }
    })
    .subscribe();

  return () => {
    isMounted = false;
    supabase.removeChannel(channel).catch(console.error);
  };
}, [loadData]);
```

### Key Architectural Guidelines:
1. **Idempotent channel teardown**: Always return a cleanup function invoking `supabase.removeChannel(channel)`.
2. **Mount guards (`isMounted`)**: Prevent React state updates on unmounted components after asynchronous RPC/Supabase calls.
3. **Debounced batch refreshes**: For components listening to multiple high-velocity tables (e.g. `useAdminNotifications`, `Dashboard`), use a 500ms–700ms debounce timer to prevent cascading RPC queries.
4. **Preservation of Existing Channels**: Strictly avoid duplicate channels or overwriting existing implementations in the 17 pre-configured files.
