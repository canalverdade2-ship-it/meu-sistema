# Realtime Layer Master Audit Plan

## Objective
Execute a comprehensive, exhaustive, file-by-file audit of the entire GSA HUB Realtime layer across all 6 core requirements (R1 - R6), producing `scripts/audit_realtime_report.md` and `scripts/check-realtime-audit.ts` with complete verification.

## Team Architecture & Decomposition

### Track 1: Specialized Explorers (Parallel Investigation)
1. **Explorer R1 — Base Infrastructure**:
   - `src/hooks/useRealtime.ts`
   - `src/hooks/useRealtimeTable.ts`
   - `src/lib/supabaseRealtime.ts`
   - Lifecycle, leaks, race conditions, error handling, typing, debounce, `removeChannel` vs `unsubscribe`, memoization.
2. **Explorer R2-B1 — Component Audit Batch 1 (1 to 24)**:
   - AcessosModule.tsx, AdminPrestadorDocumentos.tsx, AdvertiserPortal.tsx, AdvertisingAdminModule.tsx, AffiliateAdminModule.tsx, AfiliadoDashboard.tsx, AfiliadosSection.tsx, AreaVipView.tsx, AssinaturasModule.tsx, AtendimentoTicketsView.tsx, CalculadorasGatewayView.tsx, CareersAdminModule.tsx, CheckoutModal.tsx, CheckoutPage.tsx, ClassifiedsModule.tsx, ClientAffiliatePanel.tsx, ClientAreaVIP.tsx, ClientAssinaturas.tsx, ClientFidelidade.tsx, ClientFinanceiro.tsx, ClientIndiqueGanhe.tsx, ClientMeuCredito.tsx, ClientOrcamentos.tsx, ClientPontos.tsx
3. **Explorer R2-B2 — Component Audit Batch 2 (25 to 48)**:
   - ClientProdutos.tsx, ClientProfile.tsx, ClientServicos.tsx, ClientSuporte.tsx, ClientTransferencias.tsx, ClientVouchers.tsx, CobrancaView.tsx, ConfiguracoesModule.tsx, ContratosDocumentosView.tsx, CreateListingWizard.tsx, CrmClientesView.tsx, Dashboard.tsx, DemandasColaboradorModule.tsx, DemandasComentarios.tsx, DemandasDashboard.tsx, DemandasDetalhesModal.tsx, EcommerceHeader.tsx, EcommerceHome.tsx, EditClassifiedListingPage.tsx, EmprestimosCreditoView.tsx, FaturamentoView.tsx, FidelidadePromocoesSection.tsx, FinanceiroSuperDomain.tsx, FiscalModule.tsx
4. **Explorer R2-B3 — Component Audit Batch 3 (49 to 72)**:
   - FiscalView.tsx, FluxoCaixaView.tsx, FornecedoresModule.tsx, FornecedoresSection.tsx, GovernancaAcessosView.tsx, GovernancaAuditoriaView.tsx, GovernancaConfiguracoesView.tsx, GovernancaExecutiveDashboard.tsx, GovernancaInfraView.tsx, GsaSaudeView.tsx, GsaSegurosView.tsx, GsaTvModule.tsx, HubEmpresasView.tsx, NovaDemandaModal.tsx, NovoPrestadorDrawer.tsx, OperacoesSuperDomain.tsx, OrcamentosWorkstation.tsx, OrdensAssinaturaModule.tsx, OrdensCompraModule.tsx, PartnersAdminModule.tsx, PartnersPage.tsx, PaymentModal.tsx, PayoutClearanceDrawer.tsx, PessoasSuperDomain.tsx
5. **Explorer R2-B4 — Component Audit Batch 4 (73 to 98)**:
   - PrestadorDetailDrawer.tsx, PrestadoresSection.tsx, ProdutosModule.tsx, ProtectionAdminModule.tsx, ProtocolConsultPage.tsx, PurchasesPage.tsx, RentabilidadeReembolsosView.tsx, SaquesList.tsx, SaquesRepassesSection.tsx, ScrapingAdminModule.tsx, ServicePackagesModule.tsx, ServicosModule.tsx, ShopeeOperationsModule.tsx, SiteCampaignAdminModule.tsx, StoreHub.tsx, SupportConversationModal.tsx, SystemMonitorModule.tsx, TrabalheConoscoSection.tsx, TravelAdminModule.tsx, TravelCancellationsPage.tsx, TravelProposalsPage.tsx, TravelQuoteRequestPage.tsx, TravelReservationPage.tsx, usePublicRegistrationSettings.ts, VendasModule.tsx, ViagensCategoriasModule.tsx
6. **Explorer R3 — System-Wide Coverage Gap Scan**:
   - Scan all frontend files for stateful/mutable data views missing realtime (orders, tickets, payments, logs, etc.).
7. **Explorer R4 — Legacy Hook Usage & Migration Plans**:
   - Map all `useRealtimeTable` references, design 1-to-1 migration plans to `useRealtimeSubscription`.
8. **Explorer R5 — Performance, Leaks & Anti-Patterns**:
   - Broadcast without filter on large tables, unstable channel names, missing cleanup, double subscriptions, unstable onChange callbacks, masked polling (`setInterval`), realtime in inactive/closed tabs or modals.
9. **Explorer R6 — VPS Webhook & WhatsApp Bot**:
   - `server_webhook_vps_live.cjs`, `server_webhook.cjs`, `lib/antiBanEngine.cjs` - REST vs Realtime, server-side channel opportunities, race conditions.

### Track 2: Synthesis & Deliverables (Workers)
- **Worker Report Synthesizer**: Generates `scripts/audit_realtime_report.md` merging all findings with severity ratings (🔴 Crítico, 🟡 Alerta, 🟢 OK), prioritization (P0/P1/P2), and executive summary.
- **Worker Tool Developer & Verifier**: Implements `scripts/check-realtime-audit.ts`, executes it via `npx ts-node`, and validates the output.

### Track 3: Verification & Integrity Gate (Reviewers + Forensic Auditor)
- **Reviewer 1 & 2**: High-reliability independent review of the audit report and verification script.
- **Forensic Auditor**: Verification of authentic analysis, absence of hardcoded bypasses, and validation that all 98 files are covered with genuine per-component analysis.
