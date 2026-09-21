# Comprehensive Realtime Survey Report: R9, R10, and R12

**Author:** teamwork_preview_explorer_survey_rt_3  
**Target Areas:**  
- **Requirement R9:** Admin Demandas Module (5 components)  
- **Requirement R10:** Regular Admin Operational Modules & Polling Replacements (23 components)  
- **Requirement R12:** Client Portal & Marketplace (28+ components)  
**Date / Timestamp:** 2026-08-26T14:15:00Z  

---

## Executive Summary

This survey provides a line-by-line inspection of all target components across Requirements R9, R10, and R12. We catalog:
1. Exact database tables queried and mutated.
2. Existing data fetching and refresh mechanisms.
3. Identified polling mechanisms (`setInterval`) requiring elimination.
4. Concrete subscription specifications for integration with the shared realtime utility (`useRealtimeSubscription` / `supabase.channel`).

---

## Part 1: Requirement R9 — Admin Demandas Module

| File Path | Tables Queried / RPCs | Data Fetching Trigger | Current RT Status | Required Shared RT Subscription Logic |
|---|---|---|---|---|
| `src/components/admin/DemandasColaboradorModule.tsx` | `prestador_demandas`, `prestador_demandas_historico`, `ordens_servico`, `colaboradores`, `prestadores`, `clientes`<br>RPCs: `gsa_collaborator_list_demands`, `gsa_collaborator_demand_history` | `fetchDemandas()`, `fetchAuxiliares()`, `refreshHistorico()` on mount & tab/user changes | Ad-hoc `supabase.channel` with 300ms debounce | Subscribe to tables `['prestador_demandas', 'prestador_demandas_historico']` on `*`. On event, trigger debounced `fetchDemandas()` and if `selectedDemanda` matches payload, call `refreshHistorico()`. |
| `src/components/admin/demandas/DemandasDashboard.tsx` | `prestador_demandas`, `colaboradores`, `prestadores` | `carregar()` triggered on mount, periodo toggle, and manual refresh | No realtime channel | Subscribe to tables `['prestador_demandas', 'colaboradores']` on `*`. On event, re-run `carregar()`. |
| `src/components/admin/demandas/DemandasComentarios.tsx` | `demanda_comentarios`, `prestador_demandas`<br>RPC: `increment_comentarios` | `fetchComentarios()` / `fetchComentariosLocal()` on mount and message send | Ad-hoc `supabase.channel` on `demanda_comentarios` (`INSERT` only) | Standardize channel with filter `demanda_id=eq.${demandaId}` on `demanda_comentarios` for `*` (INSERT, UPDATE, DELETE) to refresh comment list instantaneously. |
| `src/components/admin/demandas/DemandasDetalhesModal.tsx` | `prestador_demandas`, `os_notas`, `os_suporte_mensagens`, `clientes`, `colaboradores`, `prestadores` | `AdminOSSuporteChat` internal state & parent modal refresh callbacks (`onRefresh`, `onRefreshHistorico`) | Ad-hoc `supabase.channel` in embedded chat on `os_suporte_mensagens` | Standardize `AdminOSSuporteChat` with realtime hook on `os_suporte_mensagens` with filter `os_id=eq.${osId}` for `INSERT`. Parent modal refreshes when parent module receives demand updates. |
| `src/components/admin/demandas/NovaDemandaModal.tsx` | `ordens_servico`, `colaboradores`, `prestadores`, `clientes`, `orcamentos`<br>Mutates: `prestador_demandas`, `prestador_demandas_historico` | `fetchData()` on modal mount | No realtime channel (short-lived modal) | Subscribe to `['ordens_servico', 'colaboradores', 'prestadores']` while modal is open, or rely on mount fetch. |

---

## Part 2: Requirement R10 — Admin Operational Modules & Polling Replacements

### 2.1 Polling Intervals Identified for Immediate Replacement

| File Path | Polling Pattern Identified | Tables to Subscribe via Realtime | Action Required |
|---|---|---|---|
| `src/components/admin/ShopeeOperationsModule.tsx` | `window.setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 15_000);` (line 113) | `shopee_fulfillment_jobs`, `shopee_automation_workers`, `shopee_fulfillment_job_items` | **Remove `setInterval`**. Subscribe to `shopee_fulfillment_jobs` and `shopee_automation_workers` on `*`. Trigger `load(true)` on any change. |
| `src/components/admin/GsaTvModule.tsx` | `const interval = setInterval(fetchMetrics, 2500);` (line 183) | `gsa_tv_media_items`, `gsa_tv_schedule_slots`, `gsa_tv_channels`, `gsa_tv_playlists`, `gsa_tv_jobs`, `gsa_tv_incidents` | **Eliminate/refactor polling**. Connect to broadcast / realtime channel on `gsa_tv_*` tables. |
| `src/components/admin/SystemMonitorModule.tsx` | `const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 15_000);` (line 258) | `colaboradores`, `clientes`, `fornecedores`, `prestadores`, `gsa_afiliados`, `sistema_logs` | **Remove `setInterval`**. Retain and standardize existing realtime subscriptions on `['colaboradores', 'clientes', 'fornecedores', 'prestadores', 'gsa_afiliados']`. |
| `src/components/admin/AcessosModule.tsx` | `const interval = window.setInterval(() => { if (document.visibilityState === 'visible' && isMounted.current) void load(true, isMounted); }, 60_000);` (line 148) | `colaboradores`, `solicitacoes_exclusao`, `funcoes` | **Remove `setInterval`**. Add realtime subscription on `colaboradores`, `solicitacoes_exclusao`. |
| `src/components/admin/AffiliateAdminModule.tsx` | `const interval = window.setInterval(() => void load(true), 30000);` (line 230) | `gsa_afiliados`, `afiliado_programas`, `saques` | **Remove `setInterval`**. Add realtime subscription on `gsa_afiliados`, `saques`. |
| `src/components/admin/CareersAdminModule.tsx` | `const interval = window.setInterval(() => void fetchApplications(true), 20_000);` (line 124) | `career_applications` (or `candidaturas`) | **Remove `setInterval`**. Add realtime subscription on career application tables. |

---

### 2.2 Operational Modules Catalogue

| File Path | Tables Queried / RPCs | Data Fetching Trigger | Current RT Status | Required Shared RT Subscription Logic |
|---|---|---|---|---|
| `src/components/admin/FornecedoresModule.tsx` | `fornecedores`, `fornecedor_produtos`, `ordens_compra`, `produtos`, `produto_fornecedor_config`<br>RPC: `gsa_admin_supplier_snapshot` | `load()` on mount and tab changes | Broadcast notify in `supplierOperations.ts` (`supplier-sync:${id}`) | Subscribe to `fornecedores`, `ordens_compra`, `produtos` on `*`. Trigger `load()` on changes. |
| `src/components/admin/ServicePackagesModule.tsx` | `servicos`, `catalog_services`, `catalog_packages`<br>RPC: `gsa_admin_service_catalog_snapshot` | `load()` on mount | No realtime channel | Subscribe to `servicos` and catalog tables on `*`. Trigger `load()` on mutation. |
| `src/components/admin/OrdensCompraModule.tsx` | `ordens_compra`, `produtos`, `clientes`, `orcamentos`, `faturas`, `pagamentos`, `cupons_loja` | `fetchOrdens()` on mount, search, and filter changes | Ad-hoc `supabase.channel('admin-ordens-compra-updates')` | Standardize channel with shared hook on `ordens_compra` and `faturas` on `*`. Call `fetchOrdens()`. |
| `src/components/admin/OrdensAssinaturaModule.tsx` | `ordens_assinatura`, `assinaturas`, `clientes`, `faturas`, `orcamentos` | `fetchOrdens()` on mount, tab, search, and filters | Ad-hoc `supabase.channel('admin-ordens-assinatura-updates')` | Standardize channel with shared hook on `ordens_assinatura` and `faturas` on `*`. Call `fetchOrdens()`. |
| `src/components/admin/ProdutosModule.tsx` | `produtos`, `loja_categorias`, `loja_estoque_historico`, `produto_variantes`, `produto_fornecedor_config` | `fetchProdutos()` on mount, tab, filters, search | Ad-hoc `supabase.channel('admin-produtos-updates')` | Standardize channel with shared hook on `produtos` and `loja_categorias` on `*`. Call `fetchProdutos()`. |
| `src/components/admin/ServicosModule.tsx` | `servicos`, `loja_categorias` | `fetchServicos()`, `loadCategorias()` | Ad-hoc `supabase.channel('admin-servicos-updates')` | Standardize channel with shared hook on `servicos` and `loja_categorias` on `*`. Call `fetchServicos()`. |
| `src/components/admin/TravelAdminModule.tsx` | `viagens_orcamentos`, `viagens_pacotes`, `viagens_propostas`, `viagens_transacoes`, `clientes`, `viagens_categorias`<br>RPCs: `gsa_admin_travel_list`, etc. | `fetchData()` on mount and page/tab changes | No realtime channel | Subscribe to `['viagens_orcamentos', 'viagens_pacotes', 'viagens_propostas', 'viagens_transacoes']` on `*`. Re-run `fetchData()`. |
| `src/components/admin/ViagensCategoriasModule.tsx` | `viagens_categorias` | `loadData()` on mount | Ad-hoc `supabase.channel('realtime_viagens_categorias')` | Standardize channel with shared hook on `viagens_categorias` on `*`. |
| `src/components/admin/prestadores/AdminPrestadorDocumentos.tsx` | `prestador_documentos` | `fetchDocumentosLocal()` on mount and monthFilter | Ad-hoc `supabase.channel('admin-prestador-documentos')` with filter `prestador_id=eq.${prestadorId}` | Standardize with shared hook on `prestador_documentos` with row-level filter. |
| `src/components/admin/AcessosModule.tsx` | `colaboradores`, `solicitacoes_exclusao`, `funcoes`<br>RPC: `gsa_admin_access_snapshot` | `load()` on mount and interval | Polling interval (60s) | Eliminate polling. Subscribe to `colaboradores` and `solicitacoes_exclusao` on `*`. |
| `src/components/admin/AdvertisingAdminModule.tsx` | `advertising_requests`, `advertising_proposals`, `advertising_campaigns`, `advertising_placements`, `advertising_creatives`, `advertising_payments`<br>RPC: `gsa_admin_advertising_overview` | `load()` on mount | No realtime channel | Subscribe to `['advertising_requests', 'advertising_campaigns', 'advertising_proposals']` on `*`. Call `load()`. |
| `src/components/admin/AffiliateAdminModule.tsx` | `gsa_afiliados`, `afiliado_programas`, `saques`<br>RPC: `gsa_admin_affiliate_snapshot` | `load()` on mount and interval | Polling interval (30s) | Eliminate polling. Subscribe to `['gsa_afiliados', 'saques']` on `*`. Call `load(true)`. |
| `src/components/admin/AssinaturasModule.tsx` | `assinaturas`, `loja_categorias` | `fetchAssinaturas()`, `fetchCats()` | Ad-hoc `supabase.channel('admin-assinaturas-updates')` | Standardize with shared hook on `assinaturas` on `*`. |
| `src/components/admin/CareersAdminModule.tsx` | `career_applications`<br>RPC: `gsa_admin_list_career_applications` | `fetchApplications()` on mount and interval | Polling interval (20s) | Eliminate polling. Subscribe to `career_applications` on `*`. |
| `src/components/admin/ClassifiedsModule.tsx` | `classificados_anuncios`, `classificados_mensagens`, `classificados_transacoes`, `classificados_midias`<br>RPC: `gsa_admin_list_resource` | `load()` on mount and tab/page change | No realtime channel | Subscribe to `['classificados_anuncios', 'classificados_mensagens', 'classificados_transacoes']` on `*`. Call `load()`. |
| `src/components/admin/FiscalModule.tsx` | `ordens_fiscais`<br>RPC: `gsa_admin_list_resource` | `load()` on mount, tab, search | No realtime channel | Subscribe to `ordens_fiscais` on `*`. Call `load()`. |
| `src/components/admin/ProtectionAdminModule.tsx` | `saude_contratos`, `seguros_apolices`, `saude_cotacoes`, `seguros_cotacoes`, `saude_propostas`, `seguros_propostas`<br>RPC: `gsa_admin_list_resource` | `load()` on mount and tab changes | No realtime channel | Subscribe to `['saude_contratos', 'seguros_apolices', 'saude_cotacoes', 'seguros_cotacoes']` on `*`. Call `load()`. |
| `src/components/admin/ScrapingAdminModule.tsx` | `automacao_scraping_configs`, `loja_categorias`, `viagens_categorias`, `system_settings` | `loadData()`, `loadCategorias()`, `loadN8nBaseUrl()` | Ad-hoc `supabase.channel('realtime_automacao_configs')` | Standardize with shared hook on `automacao_scraping_configs` on `*`. |
| `src/components/admin/SiteCampaignAdminModule.tsx` | `site_campaigns`, `site_campaign_history`, `site_campaign_events`<br>RPC: `gsa_admin_site_campaigns_overview` | `load()` on mount | No realtime channel | Subscribe to `site_campaigns` on `*`. Call `load()`. |
| `src/components/admin/VendasModule.tsx` | Container routing to `OrdensCompraModule`, `OrdensAssinaturaModule`, etc. | Context-driven via submodules & `useAdminNotifications` | Bell badge handles RT via hook | Submodules own their subscriptions; `useAdminNotifications` provides live pendencies. |

---

## Part 3: Requirement R12 — Client Portal & Marketplace (28+ Components)

| File Path | Tables Queried / RPCs | Data Fetching Trigger | Current RT Status | Required Shared RT Subscription Logic |
|---|---|---|---|---|
| `src/components/client/ClientProfile.tsx` | `cliente_documentos`, `clientes` | `fetchDocumentos()` on mount and monthFilter | Ad-hoc `supabase.channel('cliente-documentos-${cliente.id}')` | Standardize channel with filter `cliente_id=eq.${cliente.id}` on `cliente_documentos` and `id=eq.${cliente.id}` on `clientes`. |
| `src/components/client/ClientAffiliatePanel.tsx` | `gsa_afiliados`, `afiliado_links`, `afiliado_comissoes`, `saques`<br>RPCs in `features/affiliates/service` | `load()` on mount | No realtime channel | Subscribe to `gsa_afiliados` and `saques` (filter: `cliente_id=eq.${clientId}`) on `*`. Call `load(true)`. |
| `src/components/client/ClientAreaVIP.tsx` | `client_levels`, `level_history`, `clientes` | `fetchLevels()`, `fetchHistory()` | Ad-hoc `supabase.channel('client-vip-changes')` | Standardize channel on `client_levels` (global) and `level_history` (filter: `cliente_id=eq.${cliente.id}`). |
| `src/components/client/ClientAssinaturas.tsx` | `ordens_assinatura`, `assinaturas`, `faturas`, `orcamentos` | `fetchMinhasAssinaturas()` on mount & tab | Ad-hoc `supabase.channel('client-assinaturas-updates')` with filter `cliente_id=eq.${clientId}` | Standardize channel on `ordens_assinatura` with filter `cliente_id=eq.${clientId}` and on `faturas`. |
| `src/components/client/ClientFinanceiro.tsx` | `clientes`, `faturas`, `saques`, `ordens_fiscais`, `transferencias`, `gsa_client_operation_requests`, `system_settings` | `fetchMinSaque()`, `checkFaturas()`, `checkActiveRequest()` | Delegates to child lists & `useClientNotifications` | Embed shared RT subscriptions for `faturas`, `saques`, `transferencias` scoped to `cliente_id=eq.${clientId}`. |
| `src/components/client/ClientFidelidade.tsx` | Container / navigation router for points, vouchers, rewards, VIP, affiliates | Relies on `useClientNotifications` and submodule instances | Submodule-level | Delegated to child components; real-time notifications provide instant badge updates. |
| `src/components/client/ClientIndiqueGanhe.tsx` | `indicacoes`, `clientes`, `system_settings` | `fetchIndicacoes()`, `fetchCliente()`, `fetchSettings()` | Ad-hoc `supabase.channel('indicacoes-updates')` with filter `indicador_id=eq.${clientId}` | Standardize channel on `indicacoes` with filter `indicador_id=eq.${clientId}` on `*`. |
| `src/components/client/ClientMeuCredito.tsx` | `loja_credito_solicitacoes`, `loja_credito_documentos`, `loja_credito_movimentacoes`, `faturas`, `orcamentos` | `loadData()` on mount | No realtime channel | Subscribe to `loja_credito_solicitacoes`, `loja_credito_documentos`, `loja_credito_movimentacoes`, `faturas` with filter `cliente_id=eq.${clientId}`. Call `loadData()`. |
| `src/components/client/ClientOrcamentos.tsx` | `orcamentos`, `loja_avaliacoes`, `loja_solicitacoes`, `faturas`, `ordens_servico`, `ordens_compra` | `fetchOrcamentos()` on mount, tab, search | No realtime channel | Subscribe to `orcamentos` and `faturas` with filter `cliente_id=eq.${clientId}` on `*`. Call `fetchOrcamentos()`. |
| `src/components/client/ClientPontos.tsx` | `clientes`, `pontos_movimentacoes`, `level_history`, `transferencias`, `system_settings` | `fetchData()` on mount | Ad-hoc `supabase.channel('pontos-updates')` on `clientes` and `pontos_movimentacoes` | Standardize channel with shared hook on `clientes` (filter `id=eq.${clienteId}`) and `pontos_movimentacoes` (filter `cliente_id=eq.${clienteId}`). |
| `src/components/client/ClientProdutos.tsx` | `ordens_compra`, `produtos`, `faturas`, `orcamentos` | `fetchMeusProdutos()` on mount & tab | Ad-hoc `supabase.channel('client-produtos-updates')` with filter `cliente_id=eq.${clientId}` | Standardize channel on `ordens_compra` with filter `cliente_id=eq.${clientId}` and `faturas`. |
| `src/components/client/ClientServicos.tsx` | `ordens_servico`, `orcamentos`, `servicos`, `os_suporte_mensagens` | `fetchServicos()` on mount, tab, mobile | Ad-hoc `supabase.channel('client-os-rt-${clientId}')` on `ordens_servico` | Standardize channel on `ordens_servico` (filter `cliente_id=eq.${clientId}`). |
| `src/components/client/ClientSuporte.tsx` | `tickets`, `ticket_mensagens` | `fetchTickets()`, `fetchMessages()` | Ad-hoc `supabase.channel('tickets-updates-${modulo}')` & `supabase.channel('ticket_${selectedTicket.id}')` | Standardize ticket list channel (filter `cliente_id=eq.${clientId}`) and chat messages channel (`ticket_id=eq.${selectedTicket.id}`). |
| `src/components/client/ClientTransferencias.tsx` | `transferencias`, `clientes` | `fetchTransferencias()`, `fetchClienteData()` | Ad-hoc `supabase.channel('client-transferencias-${clientId}')` on `transferencias` | Standardize channel on `transferencias` on `*` and `clientes` (`id=eq.${clientId}`). |
| `src/components/client/ClientVouchers.tsx` | `vouchers`, `extrato_financeiro`, `pagamentos`, `faturas` | `fetchVouchers()` on mount & tab | Ad-hoc `supabase.channel('vouchers-updates')` (filter: `cliente_id=eq.${clientId}`) | Standardize channel on `vouchers` (both `cliente_id=eq.${clientId}` and global `cliente_id=is.null`). |
| `src/components/client/StoreHub.tsx` | `ordens_compra`, `ordens_assinatura`, `loja_pedido_itens`, `orcamentos`, `produtos`, `assinaturas`, `cupons_loja`, `loja_solicitacoes` | `fetchPurchases()`, `fetchCoupons()`, `fetchStoreItems()` | No realtime channel | Subscribe to `['ordens_compra', 'ordens_assinatura', 'loja_solicitacoes', 'cupons_loja']` (filter `cliente_id=eq.${clientId}` when authenticated). |
| `src/components/client/store/EcommerceHeader.tsx` | `loja_carrinhos`, `loja_favoritos` | `updateCount()` on DOM events (`gsa-cart-updated`, `storage`) | DOM-only event listeners | Subscribe to `loja_carrinhos` with filter `cliente_id=eq.${clientId}` so cart badge updates across multiple browser tabs and devices in real-time. |
| `src/components/client/store/EcommerceHome.tsx` | `produtos`, `loja_carrinhos` | Initial fetch on mount & `updateCount()` | DOM-only cart listener | Subscribe to `produtos` (global for store catalog updates) and `loja_carrinhos` (filter `cliente_id=eq.${clientId}`). |
| `src/components/client/store/CheckoutModal.tsx` | `clientes`, `loja_credito_solicitacoes`, `cupons_loja`, `system_settings`, `produtos`, `orcamentos` | `fetchDadosCredito()`, `fetchDiscounts()` on open | No realtime channel | Subscribe to `clientes` (filter `id=eq.${clientId}`) and `cupons_loja` while open. |
| `src/components/client/store/CheckoutPage.tsx` | `loja_carrinhos`, `clientes`, `produtos`, `cupons_loja`, `promocoes_quantidade`, `loja_credito_solicitacoes`, `system_settings` | `loadCart()`, `loadPromos()` on mount | No realtime channel | Subscribe to `loja_carrinhos` (filter `cliente_id=eq.${clientId}`) and `cupons_loja`. |
| `src/components/client/store/PurchasesPage.tsx` | `orcamentos`, `ordens_compra`, `ordens_assinatura`, `loja_pedido_itens`, `faturas`, `pagamentos`, `loja_solicitacoes` | `fetchPurchases()` on mount & clientId | Ad-hoc `supabase.channel('loja-compras-client-${clientId}')` on `orcamentos` | Standardize channel on `orcamentos`, `ordens_compra`, `ordens_assinatura` (filter `cliente_id=eq.${clientId}`). |
| `src/components/client/financeiro/PaymentModal.tsx` | `clientes`, `empresa`, `vouchers`, `faturas`, `pagamentos` | `fetchClientData()`, `fetchAvailableVouchers()` on modal open | No realtime channel | Subscribe to `clientes` (filter `id=eq.${fatura.cliente_id}`) and `faturas` (filter `id=eq.${fatura.id}`). |
| `src/components/client/financeiro/SaquesList.tsx` | `saques` | `fetchSaques()` on mount | Ad-hoc `supabase.channel('client-saques-updates')` with filter `cliente_id=eq.${clientId}` | Standardize channel on `saques` (filter `cliente_id=eq.${clientId}`). |
| `src/components/client/marketplace/classifieds/EditClassifiedListingPage.tsx` | `classificados_anuncios`, `classificados_midias`, `classificados_ajustes` | `load()` on mount & anuncioId | No realtime channel | Subscribe to `classificados_anuncios` and `classificados_ajustes` with filter `id=eq.${anuncioId}` / `anuncio_id=eq.${anuncioId}`. |
| `src/components/client/marketplace/travel/TravelProposalsPage.tsx` | `viagens_propostas`, `viagens_solicitacoes_reserva` | `fetchPropostas()` on mount | No realtime channel | Subscribe to `viagens_propostas` with filter `cliente_id=eq.${clientId}` on `*`. Call `fetchPropostas()`. |
| `src/components/client/marketplace/travel/TravelReservationPage.tsx` | `viagens_transacoes`, `viagens_passageiros`, `viagens_passageiro_documentos`, `viagens_propostas` | `fetchTripDetails()` on mount & transacaoId | No realtime channel | Subscribe to `viagens_transacoes` (filter `id=eq.${transacaoId}`) and `viagens_passageiros` (filter `transacao_id=eq.${transacaoId}`). |
| `src/components/client/marketplace/travel/TravelCancellationsPage.tsx` | `viagens_transacoes`, `viagens_cancelamentos`, `viagens_propostas` | `fetchTrips()` on mount | No realtime channel | Subscribe to `viagens_transacoes` and `viagens_cancelamentos` with filter `cliente_id=eq.${clientId}`. |
| `src/components/client/marketplace/travel/TravelQuoteRequestPage.tsx` | `viagens_pacotes`, `viagens_orcamentos`, `clientes` | Initial load of packages on mount | No realtime channel | Subscribe to `viagens_pacotes` on `*` if displaying active packages. |
| `src/components/common/SupportConversationModal.tsx` | `suporte_mensagens`, `prestador_suporte_demandas` | `fetchMensagensSafe()` on open | Ad-hoc channels `suporte_mensagens_${currentSuporte.id}` and `suporte_status_${currentSuporte.id}` | Standardize channels with shared hook on `suporte_mensagens` (`suporte_id=eq.${currentSuporte.id}`) and `prestador_suporte_demandas` (`id=eq.${currentSuporte.id}`). |
| `src/hooks/usePublicRegistrationSettings.ts` | `system_settings`<br>RPC: `gsa_public_registration_settings` | `refresh()` on mount & enabled | No realtime channel | Subscribe to `system_settings` on `*` so public registration bonus configuration reflects changes in real-time across public pages without page reloads. |

---

## Part 4: Implementation Guidance for Implementation Agents

1. **Shared Hook Utility (`src/hooks/useRealtimeSubscription.ts`):**
   Implement a lightweight hook that encapsulates:
   ```ts
   useRealtimeSubscription({
     channelName: string,
     table: string | string[],
     filter?: string,
     events?: ('INSERT' | 'UPDATE' | 'DELETE')[] | '*',
     onEvent: (payload: RealtimePostgresChangesPayload<any>) => void,
     enabled?: boolean,
   });
   ```
2. **Channel Deduplication & Unsubscribe Safety:**
   - Every subscription must use `supabase.removeChannel(channel)` in its `useEffect` cleanup.
   - For components already having ad-hoc channels, refactor them to use the hook or uniform cleanup pattern to avoid memory leaks.
3. **Polling Replacement:**
   - In `ShopeeOperationsModule.tsx`, `SystemMonitorModule.tsx`, `AcessosModule.tsx`, `AffiliateAdminModule.tsx`, and `CareersAdminModule.tsx`, delete the `setInterval` calls and let the realtime subscriptions drive data freshness.
