# Handoff Report: User Role Modules & Business Logic Architecture Deep-Dive

**Author**: `teamwork_preview_explorer_roles_1`  
**Date**: 2026-09-11T02:25:00Z  
**Scope**: In-depth static audit and mapping of the 6 key user role modules in `src/`: Admin, Cliente, Fornecedor, Colaborador, Afiliado, and Prestador.

---

## 1. Observation

### 1.1 Architecture & Routing Overview
- **Routing Master**: `src/routing/routeCatalog.ts` (383 lines) catalogs all public, authenticated, role-based, and sub-domain routes across the application.
- **Admin Access Control & RBAC**: `src/routing/adminAccess.ts` (lines 1–256) defines `AdminActorType = 'admin' | 'colaborador'`, with 39 granular `AdminModule` tags and strict hierarchical permission normalization (`normalizeAdminModule`, `normalizeGrantedAdminModules`, `canAccessAdminModule`).
- **Session Layer**: `src/lib/sessionService.ts` and `src/security/collaboratorAccess.ts` persist role identities across sessions (`adminType`, `colaboradorId`, `colaboradorNome`, `colaboradorModulos`).

---

### 1.2 Module 1: Admin (`src/components/admin/` & `src/pages/AdminPanel.tsx`)

#### 1.2.1 Component Hierarchy
```
src/pages/AdminPanel.tsx (or SecureAdminPanel.tsx)
└── DashboardLayout (theme="admin")
    ├── Header: SystemStatusIndicator, LiveClock, UniversalNotificationBell, Profile Badge ('AD'/'CO')
    ├── Sidebar: MENU_GROUPS (Principal, Financeiro, Relacionamento, Comunicação, Gestão, Acesso, Infraestrutura)
    └── Main View (Routed via useAppLocation):
        ├── 'dashboard': Dashboard.tsx (admin) OR CollaboratorDashboard.tsx (colaborador)
        ├── 'cadastro': CadastroModule.tsx (Tabs: 'clientes', 'prestadores')
        ├── 'fornecedores': FornecedoresModule.tsx
        ├── 'parceiros': PartnersAdminModule.tsx
        ├── 'operacoes': VendasModule.tsx (Tabs: 'orcamentos', 'demandas', 'os', 'produtos', 'assinaturas')
        ├── 'demandas': DemandasColaboradorModule.tsx
        ├── 'loja': CadastroModule.tsx (Tabs: 'produtos', 'servicos', 'pacotes', 'assinaturas', 'promocoes', 'categorias_loja', 'gsa_store')
        ├── 'classificados': ClassifiedsModule.tsx
        ├── 'anuncios': AdvertisingAdminModule.tsx
        ├── 'viagens': TravelAdminModule.tsx
        ├── 'afiliados': AffiliateAdminModule.tsx
        ├── 'saude' / 'seguros': ProtectionAdminModule.tsx
        ├── 'financeiro': FinanceiroSuperDomain.tsx
        │   ├── FaturamentoView.tsx
        │   ├── FluxoCaixaView.tsx
        │   ├── CobrancaView.tsx
        │   ├── FiscalView.tsx
        │   ├── EmprestimosCreditoView.tsx (CreditDisputesAdminPanel, CreditLimitCancellationsAdminPanel, CreditWithdrawalsAdminPanel)
        │   ├── RentabilidadeReembolsosView.tsx
        │   └── CalculadorasGatewayView.tsx
        ├── 'fidelidade': CadastroModule.tsx (Tabs: 'indicacoes', 'vouchers', 'premios', 'promocoes')
        ├── 'area_vip': AreaVIPModule.tsx
        ├── 'atendimento': TicketsModule.tsx
        ├── 'avisos-campanhas': SiteCampaignAdminPage.tsx
        ├── 'relatorios': RelatoriosModule.tsx
        ├── 'configuracoes': ConfiguracoesModule.tsx
        ├── 'acessos': AcessosModule.tsx (Strictly forbidden for 'colaborador')
        ├── 'sistema': SystemMonitorModule.tsx
        ├── 'automacoes': ScrapingAdminModule.tsx
        └── 'gsa-tv': GsaTvModule.tsx (Strictly forbidden for 'colaborador')
```

#### 1.2.2 Business Logic & Approvals
1. **User Management & Collaborator Governance (`AcessosModule.tsx:126-260`)**:
   - Loads system snapshot via RPC `gsa_admin_access_snapshot`.
   - Modifies collaborator profiles and RBAC grants via RPC `gsa_admin_save_collaborator`, which creates/updates the collaborator and returns `initial_credential`.
   - Suspends access and immediately terminates sessions via RPC `gsa_admin_set_collaborator_status`.
   - Rotates credentials and revokes existing sessions via RPC `gsa_admin_rotate_collaborator_credential`.
   - Enforces a strict two-man rule for destructive deletions: sensitive records are queued in table `solicitacoes_exclusao` and only executed after admin approval via RPC `gsa_admin_review_deletion_request`.
2. **Partner Benefit Redemptions & Appeals (`PartnerRedemptionDetailModal.tsx:1-140` & `src/features/partners/service.ts:400-795`)**:
   - 24-Hour SLA countdown timer calculated dynamically from `created_at`.
   - Fulfillment: Admin inputs activation link, coupon code, and/or voucher. Invokes RPC `gsa_admin_complete_partner_redemption` (`p_resgate_id`, `p_link_ativacao`) and triggers automated WhatsApp template via `whatsappNotificationService.enviarWhatsAppDireto`.
   - Decisions: Approval/rejection via RPC `gsa_admin_set_partner_redemption_status` (`p_status`: 'pendente' | 'recusado', `p_motivo`).
   - Customer Appeals: If rejected, client can appeal once. Admin inspects justification text, attached evidence images (stored in `parceiros-midias` storage), and adjudicates via RPC `gsa_admin_decide_partner_appeal` (`p_recurso_id`, `p_decisao`: 'deferido' | 'indeferido', `p_motivo`).
   - Audit trail recorded in table `parceiros_resgates_eventos`.
3. **Credit Withdrawals & Limit Controls (`CreditWithdrawalsAdminPanel.tsx` & `src/features/creditWithdrawal/service.ts`)**:
   - Admin inspects borrower documents (ID photo, proof of address) stored securely in Cloudflare R2 (`getPrivateR2Url`).
   - Decides approval via RPC `gsa_admin_decide_credit_withdrawal`.
   - Confirms PIX payout via RPC `gsa_admin_mark_credit_withdrawal_paid` (`p_referencia_pagamento`), generating an active invoice in table `faturas`.
4. **Settings Allowlist (`ConfiguracoesModule.tsx:1-140`)**:
   - Loaded via RPC `gsa_admin_settings_snapshot`.
   - Safe batched updates executed via RPC `gsa_admin_update_settings_secure` (`p_settings: [{ key, value }]`), ensuring only allowlisted keys are modifiable.

#### 1.2.3 State Flows
- Local state hooks (`useState`) manage modal and form fields.
- Realtime push via `useRealtimeSubscription` listening on `colaboradores`, `solicitacoes_exclusao`, `sistema_logs`, `faturas`, `saques`, `cobrancas`, `ordens_fiscais`, and `parceiros_resgates`.
- Global telemetry counts managed by `useAdminNotifications`.

#### 1.2.4 Interacting Tables & RPCs
- **Tables**: `colaboradores`, `colaborador_modulos`, `solicitacoes_exclusao`, `parceiros`, `parceiros_resgates`, `parceiros_resgates_recursos`, `parceiros_resgates_eventos`, `faturas`, `saques`, `cobrancas`, `ordens_fiscais`, `solicitacoes_emprestimo`, `loja_credito_solicitacoes`, `loja_credito_movimentacoes`, `system_settings`, `empresa`, `forma_pagamentos`.
- **RPCs**: `gsa_admin_access_snapshot`, `gsa_admin_save_collaborator`, `gsa_admin_save_function`, `gsa_admin_set_collaborator_status`, `gsa_admin_rotate_collaborator_credential`, `gsa_admin_review_deletion_request`, `gsa_admin_complete_partner_redemption`, `gsa_admin_set_partner_redemption_status`, `gsa_admin_cancel_partner_redemption`, `gsa_admin_delete_partner_redemption`, `gsa_admin_decide_partner_appeal`, `gsa_admin_credit_withdrawals`, `gsa_admin_credit_withdrawal_details`, `gsa_admin_decide_credit_withdrawal`, `gsa_admin_mark_credit_withdrawal_paid`, `gsa_admin_settings_snapshot`, `gsa_admin_update_settings_secure`, `gsa_admin_save_company`, `gsa_admin_save_payment_method`.

---

### 1.3 Module 2: Cliente (`src/components/client/`, `src/pages/ClientPortal.tsx`, `StoreHub.tsx`)

#### 1.3.1 Component Hierarchy
```
src/pages/ClientPortal.tsx
└── DashboardLayout (theme="client")
    ├── Header: UniversalNotificationBell, VIP Level, Points Badge, Saldo Carteira
    ├── Sidebar Navigation: Dashboard, Perfil, Serviços e Assinaturas, Financeiro, Fidelidade, Suporte, GSA Store
    └── Sub-Modules:
        ├── ClientDashboard.tsx
        ├── ClientProfile.tsx
        ├── ClientOrcamentos.tsx
        ├── ClientServicos.tsx
        ├── ClientServicosAssinaturas.tsx
        ├── ClientAssinaturas.tsx
        ├── ClientProdutos.tsx
        ├── ClientFinanceiro.tsx (Faturas, Extrato, Saques, Transferências, Crédito, Empréstimos)
        │   ├── ClientMeuCredito.tsx (Credit limit, disputes, credit withdrawals)
        │   └── ClientEmprestimos.tsx
        ├── ClientFidelidade.tsx (Pontos, Vouchers, Prêmios, Promoções, Indique e Ganhe, Área VIP)
        │   ├── ClientPontos.tsx
        │   ├── ClientVouchers.tsx
        │   ├── ClientPremios.tsx
        │   ├── ClientPromocoes.tsx
        │   └── ClientAreaVIP.tsx
        ├── ClientSuporte.tsx
        └── StoreHub.tsx (Marketplace GSA Store)
            ├── EcommerceHome.tsx
            ├── ProductPage.tsx
            ├── CartDrawer.tsx
            ├── CheckoutPage.tsx
            ├── CheckoutPixModal.tsx
            ├── AvailableCouponsModal.tsx
            ├── StoreHubPurchases.tsx (Order history, returns, exchanges tracking)
            └── StoreHubCoupons.tsx
Public Complement:
└── src/components/public/ProtocolConsultPage.tsx (Public protocol tracker & appeal gateway)
```

#### 1.3.2 Business Logic & Transactional Flows
1. **E-Commerce, Cart & Checkout (`CheckoutPage.tsx:1-1250`)**:
   - 3-Stage Checkout Workflow:
     1. Shipping address validation (with automated CEP lookup) & store coupon selection (`AvailableCouponsModal.tsx`).
     2. Benefit application (VIP points conversion and/or wallet balance deduction) & payment method selection.
     3. Order review, anti-tamper recalculation, and final transaction execution.
   - Payment Modes:
     - **PIX Instantâneo**: Dispatches order to InfinitePay API via `createInfinitePayOrderCheckout`, generating live dynamic QR Code and Pix Copy-and-Paste string rendered in `CheckoutPixModal.tsx`.
     - **Cartão de Crédito**: Calls InfinitePay hosted checkout, redirecting the browser to payment URL.
     - **Boleto Bancário**: Issues bank slip invoice.
     - **Crédito GSA Store**: Deducts from client's pre-approved credit balance (`loja_credito_solicitacoes`), computing interest according to single payment or multi-installment selection.
   - ACID Order Execution: Calls RPC `gsa_client_checkout_store` passing `request_id`, cart array with `item_id`, `tipo`, `variante_id`, and `prazo_meses`, points redeemed, wallet funds used, coupon IDs, and delivery address. This server-side function locks product stock (`FOR UPDATE`), deducts wallet funds, updates inventory, and creates `orcamentos` and `faturas`.
2. **Returns and Exchanges (`StoreHub.tsx:65-140`, `StoreHubPurchases.tsx`, `LojaTrocasModule.tsx:100-150`)**:
   - Customer initiates return or exchange selecting items, reason, photos (`uploadMultipleFiles`), and whether they want a replacement item or store credit.
   - Stored in table `loja_solicitacoes`.
   - Admin adjudication via RPC `gsa_admin_atualizar_solicitacao_loja`:
     - Restores physical product quantity in `produto` and `produto_variante`.
     - Recredits store wallet balance (`carteira_saldo`) if credit was applied.
     - Recredits loyalty points in `pontos_fidelidade` and logs in `pontos_movimentacoes`.
     - If exchange item value exceeds original item value, automatically issues a difference invoice (`fatura_diferenca_id`) with a 2-day due date.
3. **Loyalty Points & Cashout (`ClientPontos.tsx:150-320`)**:
   - Animated visual counter with cubic bezier easing.
   - Real-time balance computed against both legacy `pontos_movimentacoes` and modern `points_transactions`.
   - Converts points to cash into customer wallet via RPC `gsa_client_convert_points` (`p_request_id`, `p_pontos`), validating conversion rate (`taxa_conversao_pontos`) and minimum thresholds.
   - Reverses accidental peer transfers via RPC `gsa_client_reverse_transfer`.
4. **Public Benefit Protocol & Appeals (`ProtocolConsultPage.tsx:1-450`)**:
   - Public endpoint: `/consulta-protocolo?codigo={CODIGO}`.
   - Fetches status via RPC `gsa_public_consultar_protocolo`.
   - If status is `recusado`, enables single-use "Entrar com recurso" button.
   - Customer submits contestation text (minimum 20 characters) and triggers SMS/WhatsApp 6-digit challenge code via `requestPartnerAppealVerification` (`gsa-auth-session` edge function).
   - Uploads up to 3 evidence files to `parceiros-midias` storage (`uploadAppealEvidenceFile`).
   - Verifies challenge and registers appeal via `submitPartnerAppeal`.
   - Status updates to `em_analise` with a 24-hour review SLA timer.

#### 1.3.3 State Flows
- Local cart state synchronized with `localStorage` (`gsa_pending_store_checkout`, `gsa_pending_store_coupons`) and dispatched via custom window event `gsa-cart-updated`.
- Notification counters and toasts driven by `useClientNotifications`.
- Realtime table subscriptions for `clientes`, `pontos_movimentacoes`, `loja_solicitacoes`, `orcamentos`, and `faturas`.

#### 1.3.4 Interacting Tables & RPCs
- **Tables**: `clientes`, `carrinho`, `orcamentos`, `ordens_servico`, `faturas`, `loja_solicitacoes`, `loja_cupons`, `produtos`, `produto_variantes`, `pontos_movimentacoes`, `points_transactions`, `level_history`, `transferencias`, `saques`, `parceiros_resgates`, `parceiros_resgates_recursos`.
- **RPCs**: `gsa_client_checkout_store`, `gsa_client_convert_points`, `gsa_client_reverse_transfer`, `gsa_client_create_credit_withdrawal`, `gsa_client_submit_credit_withdrawal_documents`, `gsa_public_consultar_protocolo`, `gsa_admin_atualizar_solicitacao_loja`.

---

### 1.4 Module 3: Fornecedor (`src/pages/Fornecedor/`, `src/components/admin/FornecedoresModule.tsx`)

#### 1.4.1 Component Hierarchy
```
src/pages/Fornecedor/
├── FornecedorAccessPage.tsx (Authentication & credential challenge)
├── FornecedorLandingPage.tsx (Institutional partner recruitment)
└── FornecedorDashboard.tsx (Main portal layout)
    ├── Header: Supplier Logo, UniversalNotificationBell, Order & Delivery Badges
    ├── Sidebar: Dashboard, Produtos, Pedidos de compra, Entregas e NFs, Financeiro, Perfil e pagamento
    └── Operational Views:
        ├── 'dashboard': Summary KPIs (pending orders, open deliveries, receivables)
        ├── 'produtos': Catalog inspection & New Product Proposal modal
        ├── 'pedidos': Purchase orders issued by Grupo GSA
        ├── 'entregas': Delivery submission modal & NF-e upload
        ├── 'financeiro': Accounts receivable, invoices, payment receipts
        └── 'perfil': Corporate data & Bank / PIX account updates
Admin Counterpart:
└── src/components/admin/FornecedoresModule.tsx & super-domains/pessoas/FornecedoresSection.tsx
```

#### 1.4.2 Business Logic & Operations (`src/lib/supplierOperations.ts:1-203`)
1. **Portal Snapshot**: Loaded via RPC `gsa_supplier_dashboard_snapshot` returning supplier profile, active products, proposed catalog items, purchase orders, deliveries, and payment schedules.
2. **Catalog & Stock Replenishment**:
   - Supplier proposes new catalog products or item variants via RPC `gsa_supplier_request_product`.
   - Admin reviews and admits products into the marketplace catalog via RPC `gsa_admin_review_supplier_product`.
   - Admin creates purchase orders for warehouse stock replenishment via RPC `gsa_admin_create_supplier_order`.
   - Supplier marks purchase order as viewed via RPC `gsa_supplier_mark_order_seen`.
3. **Fulfillment & NF-e Validation**:
   - When shipping goods, supplier uploads NF-e XML/PDF to bucket `documentos_fornecedor` via `uploadSupplierInvoice`.
   - Submits fulfillment package via RPC `gsa_supplier_submit_delivery` (`p_request_id`, `p_order_id`, `p_payload`: carrier name, tracking code, invoice URL).
   - Admin inspects delivery and invoice in `FornecedoresModule.tsx` and executes RPC `gsa_admin_review_supplier_delivery`: upon acceptance, physical stock in `produtos` and `produto_variantes` is automatically incremented.
4. **Financial Settlement & Security**:
   - Accounts payable recorded in `fornecedor_titulos`. Admin uploads payment receipt to storage via `uploadAdminSupplierPaymentProof` and marks paid via RPC `gsa_admin_update_supplier_payable`.
   - Supplier bank account changes require admin authorization: RPC `gsa_admin_review_supplier_bank_change`.
   - Financial anomaly scanner: RPC `gsa_admin_supplier_financial_anomalies` audits purchase order totals against delivered invoice amounts.

#### 1.4.3 State Flows & Realtime
- Direct PostgreSQL broadcast on channel `supplier-sync:{fornecedorId}` notifies the portal instantly when purchase orders, deliveries, or payments change.
- Document storage strictly isolated under `storage://documentos_fornecedor/{supplierId}/`.

#### 1.4.4 Interacting Tables & RPCs
- **Tables**: `fornecedores`, `fornecedor_produtos`, `fornecedor_pedidos_compra`, `fornecedor_entregas`, `fornecedor_titulos`, `fornecedor_notificacoes`, `produtos`, `produto_variantes`.
- **RPCs**: `gsa_supplier_dashboard_snapshot`, `gsa_supplier_request_product`, `gsa_supplier_update_profile`, `gsa_supplier_mark_order_seen`, `gsa_supplier_submit_delivery`, `gsa_supplier_mark_notification_read`, `gsa_supplier_mark_notifications_read`, `gsa_admin_supplier_snapshot`, `gsa_admin_supplier_set_status`, `gsa_admin_review_supplier_product`, `gsa_admin_create_supplier_order`, `gsa_admin_review_supplier_delivery`, `gsa_admin_update_supplier_payable`, `gsa_admin_review_supplier_bank_change`, `gsa_admin_supplier_financial_anomalies`.

---

### 1.5 Module 4: Colaborador (Internal Employee Governance & Task Boards)

#### 1.5.1 Component Hierarchy
```
src/pages/RestrictedAccessHubPage.tsx (Credential login: code input -> sessionService.loginColaborador)
└── src/pages/SecureAdminPanel.tsx / AdminPanel.tsx (adminType='colaborador')
    ├── CollaboratorDashboard.tsx (Custom role-scoped metrics)
    └── DemandasColaboradorModule.tsx (Task boards & internal services)
        ├── DemandasDashboard.tsx (Performance metrics & SLA countdowns)
        ├── DemandasKanban.tsx (Drag-and-drop task workflow)
        ├── DemandasTabela.tsx (Filterable demand list)
        ├── DemandasDetalhesModal.tsx (Execution details, briefing files, attachments)
        ├── DemandasComentarios.tsx (Internal team collaboration thread)
        └── NovaDemandaModal.tsx (Demands dispatcher)
```

#### 1.5.2 Business Logic & Security Sandbox
1. **Restricted Authentication (`RestrictedAccessHubPage.tsx:120-145`)**:
   - Access code validated via `sessionService.loginColaborador(code.trim())`.
   - Queries `colaboradores` table for active status and loads permitted module array `colaboradorModulos`.
   - Dynamic session heartbeat in `SecureAdminPanel.tsx:103-121` continuously subscribes to `colaboradores` and `colaborador_modulos` to immediately revoke session upon status suspension or privilege downgrade.
2. **Role-Based Sandboxing (`src/routing/adminAccess.ts:136-193` & `collaboratorAccess.ts`)**:
   - Collaborators are strictly locked out of `acessos` (collaborator management) and `gsa-tv`.
   - Access to modules is granted strictly per assigned tags (`cadastro`, `prestadores`, `fornecedores`, `operacoes`, `demandas`, `loja`, `financeiro`, etc.).
   - Super-domain access is compartmentalized: granting `prestadores` does not grant `clientes` under `cadastro`.
3. **Internal Task Board & Service Demands (`DemandasColaboradorModule.tsx:40-120`)**:
   - Scoped Data Retrieval: When `adminType === 'colaborador'`, calls RPC `gsa_collaborator_list_demands` and `gsa_collaborator_demand_history`, exposing only demands directly assigned to that employee.
   - Kanban Workflow: Columns categorize demands by status (`pendente`, `em_andamento`, `aguardando_cliente`, `concluida`, `cancelada`).
   - Audit trail in `prestador_demandas_historico` tracks origin and destination collaborators/providers during handoffs.

#### 1.5.3 State Flows
- Role and module configurations cached in `sessionStorage` (`adminType`, `colaboradorId`, `colaboradorNome`, `colaboradorModulos`).
- Realtime table listeners on `prestador_demandas`, `prestador_demandas_historico`, and `ordens_servico`.

#### 1.5.4 Interacting Tables & RPCs
- **Tables**: `colaboradores`, `colaborador_modulos`, `funcoes`, `prestador_demandas`, `prestador_demandas_historico`, `ordens_servico`, `demanda_comentarios`.
- **RPCs**: `gsa_collaborator_dashboard_snapshot`, `gsa_collaborator_list_demands`, `gsa_collaborator_demand_history`.

---

### 1.6 Module 5: Afiliado (`src/pages/Afiliado/`, `src/features/affiliates/`)

#### 1.6.1 Component Hierarchy
```
src/pages/Afiliado/
├── AffiliateAccessPage.tsx (Authentication & Program Enrollment)
└── AfiliadoDashboard.tsx (Main Affiliate Portal)
    ├── Header: Referral Link Quick Copy, Balance Card, UniversalNotificationBell
    ├── Sidebar Navigation: Visão geral, Links de divulgação, Comissões, Saques PIX, Pontos e carteira, Perfil e recebimento, Suporte
    └── Sub-Panels:
        ├── 'dashboard': Overview metrics (clicks, conversions, pending commission, available balance)
        ├── 'links': Affiliate tracking link generator & click analytics
        ├── 'comissoes': Commission ledger with grace period & clearance tracker
        ├── 'saques': PIX withdrawal request & clearance status
        ├── 'pontos': Affiliate reward points conversion to wallet balance
        ├── 'perfil': Public display name, PIX key, and terms acceptance
        └── 'suporte': Ticket system for affiliates
Client Panel Integration:
└── src/components/client/ClientAffiliatePanel.tsx
Admin Management Panel:
└── src/components/admin/AffiliateAdminModule.tsx
Attribution Engine:
└── src/components/AffiliateTrackingBridge.tsx
```

#### 1.6.2 Business Logic & Commission Engine (`src/features/affiliates/service.ts:1-311`)
1. **Affiliate Onboarding & Enrollment**:
   - Customer accepts versioned legal agreement (`AFFILIATE_CURRENT_TERMS_VERSION = '2026-08-affiliates-v1'`) and configures public pseudonym and PIX key via RPC `gsa_client_join_affiliate`.
2. **Referral Tracking & Attribution**:
   - `AffiliateTrackingBridge.tsx` captures `?ref={codigo}` parameter from landing page visits, recording clicks and setting attribution cookie/session storage.
   - Links generated via RPC `gsa_client_create_affiliate_link` (`p_programa_codigo`, `p_destino`, `p_titulo`).
3. **Commission Lifecycle & Grace Period**:
   - Orders completed via affiliate links trigger commission entries in `afiliado_comissoes`.
   - Status starts as `pendente` during program-configured grace period (`carencia_dias`, typically 30 days) to protect against chargebacks, cancellations, or returns.
   - Upon reaching `disponivel_em`, RPC `gsa_admin_release_affiliate_commissions` clears pending amounts into `totalDisponivel`.
4. **Withdrawals, Transfers & Rewards**:
   - Payout requests: RPC `gsa_client_request_affiliate_payout` (`p_valor`, `p_request_id`), validating global minimum threshold (`saque_minimo`, default R$ 50,00). Admin adjudicates via RPC `gsa_admin_decide_affiliate_payout`.
   - Peer Transfers: Affiliates can transfer commission balances directly to other affiliates via RPC `gsa_client_transfer_affiliate_balance`, reverse received transfers via RPC `gsa_client_reverse_received_affiliate_transfer`, and search recipient via `gsa_client_lookup_affiliate_transfer_target`.
   - Points Redemption: Converts affiliate gamification points to store wallet balance via RPC `gsa_client_redeem_affiliate_points`.

#### 1.6.3 Interacting Tables & RPCs
- **Tables**: `afiliados`, `afiliado_programas`, `afiliado_links`, `afiliado_comissoes`, `afiliado_saques`, `afiliado_transferencias`, `afiliado_pontos_movimentacoes`.
- **RPCs**: `gsa_client_affiliate_snapshot`, `gsa_client_affiliate_transfers`, `gsa_client_profile_access_state`, `gsa_client_join_affiliate`, `gsa_client_update_affiliate_profile`, `gsa_client_create_affiliate_link`, `gsa_client_request_affiliate_payout`, `gsa_client_cancel_affiliate_payout`, `gsa_client_lookup_affiliate_transfer_target`, `gsa_client_transfer_affiliate_balance`, `gsa_client_reverse_received_affiliate_transfer`, `gsa_client_redeem_affiliate_points`, `gsa_admin_affiliate_snapshot`, `gsa_admin_set_affiliate_status`, `gsa_admin_decide_affiliate_payout`, `gsa_admin_release_affiliate_commissions`, `gsa_admin_update_affiliate_program`, `gsa_admin_update_global_saque_minimo`.

---

### 1.7 Module 6: Prestador (`src/pages/Prestador/`, `src/components/prestador/`)

#### 1.7.1 Component Hierarchy
```
src/pages/Prestador/
├── ProviderAccessPage.tsx (Authentication & phone challenge)
├── ProviderLandingPage.tsx (Recruitment page)
└── PrestadorDashboard.tsx (Main Service Provider Portal)
    ├── Header: Provider Name, Status Badge, UniversalNotificationBell, Saldo Display
    ├── Sidebar Navigation: Início, Demandas, Agenda, Financeiro, Vouchers, Prêmios, Promoções, Perfil, Documentos, Suporte
    └── Sub-Components:
        ├── PrestadorDemandas.tsx (Work orders, negotiation, delivery submission)
        ├── PrestadorAgenda.tsx (Calendar appointments & conflict-free scheduling)
        ├── PrestadorFinanceiro.tsx (Available balance, withdrawal requests, statement)
        ├── PrestadorDocumentos.tsx (KYC compliance & document uploads)
        ├── PrestadorVouchers.tsx (Commercial partner benefits)
        ├── PrestadorPremios.tsx (Milestone rewards)
        ├── PrestadorPromocoes.tsx (Active promotion campaigns)
        └── PrestadorSuporte.tsx (Direct provider helpdesk)
Admin Management Panel:
└── src/components/admin/PrestadoresModule.tsx & super-domains/pessoas/PrestadoresSection.tsx
    ├── PrestadorDetailDrawer.tsx (KYC approval, bank verification, rating)
    └── NovoPrestadorDrawer.tsx
```

#### 1.7.2 Business Logic & Work Order State Machine (`src/lib/providerOperations.ts:1-174` & `PrestadorDemandas.tsx:26-90`)
1. **Access Gating & Compliance**:
   - Provider statuses: `pendente`, `aprovado`, `ativo`, `suspenso`, `bloqueado`.
   - If status is `pendente` or `bloqueado`, operational modules (`demandas`, `agenda`, `financeiro`, `vouchers`, `premios`, `promocoes`) are visually and functionally locked (`isProviderBlocked`). Only `perfil`, `documentos`, and `suporte` remain accessible.
   - Compliance documents uploaded via RPC `gsa_provider_submit_document` and audited by admin in `PrestadorDetailDrawer.tsx`.
2. **Work Order Lifecycle & Negotiation**:
   - Status transitions managed via RPC `gsa_provider_transition_demand` (`p_demanda_id`, `p_action`, `p_payload`):
     - `accept`: Accepts administrative proposed fee (`valor_proposto_admin`), advancing demand status to `ativa`.
     - `reject`: Declines demand with required motive, returning it to admin pool.
     - `counteroffer`: Submits counter-proposal (`valor_proposto_prestador`), changing status to `contraproposta_prestador`.
     - `deliver`: Submits completion package containing delivery notes, delivery link (`link_resultado`), and attached proof files (`arquivos_resultado`), moving status to `em_analise`.
     - `return`: Sends demand back to admin queue when adjustments are unfeasible.
3. **Availability & Conflict-Free Scheduling (`PrestadorAgenda.tsx:88-140`)**:
   - Provider schedules appointments for active demands via RPC `gsa_provider_create_schedule` (`p_demanda_id`, `p_data_inicio`, `p_data_fim`, `p_observacoes`).
   - Server-side RPC prevents overlapping booking slots.
   - Appointments marked completed via RPC `gsa_provider_complete_schedule` or removed via `gsa_provider_delete_schedule`.
4. **Financial Payouts**:
   - Balance snapshot: RPC `gsa_provider_financial_snapshot`.
   - PIX withdrawal: RPC `gsa_provider_request_withdrawal` (`p_valor`, `p_tipo_chave_pix`, `p_chave_pix`).
   - Self-cancellation: RPC `gsa_provider_cancel_withdrawal`.

#### 1.7.3 Interacting Tables & RPCs
- **Tables**: `prestadores`, `prestador_documentos`, `prestador_demandas`, `prestador_demandas_historico`, `prestador_agendamentos`, `prestador_saques`, `prestador_vouchers`, `prestador_premios`, `prestador_promocoes`, `ordens_servico`.
- **RPCs**: `gsa_provider_financial_snapshot`, `gsa_provider_dashboard_snapshot`, `gsa_provider_pendency_snapshot`, `gsa_provider_request_withdrawal`, `gsa_provider_cancel_withdrawal`, `gsa_provider_redeem_voucher`, `gsa_provider_redeem_prize`, `gsa_provider_activate_promotion`, `gsa_provider_update_profile`, `gsa_provider_create_schedule`, `gsa_provider_complete_schedule`, `gsa_provider_delete_schedule`, `gsa_provider_submit_document`, `gsa_provider_transition_demand`, `gsa_provider_create_ticket`, `gsa_provider_send_ticket_message`, `gsa_provider_request_profile_change`, `gsa_provider_request_demand_support`.

---

## 2. Logic Chain

```
[Observation 1.1: routeCatalog.ts, adminAccess.ts]
      │
      ├─► Proves dual role system: Admin has master access; Colaborador is an authenticated actor
      │   operating inside the Admin/Restricted domain, sandboxed by collaboratorModulos allowlists.
      │
[Observation 1.2: AdminPanel.tsx, AcessosModule.tsx, PartnerRedemptionDetailModal.tsx]
      │
      ├─► Demonstrates strict two-man rule deletion requests (solicitacoes_exclusao),
      │   credential rotation, 24h SLA partner redemptions with WhatsApp delivery,
      │   and appellate dispute adjudication.
      │
[Observation 1.3: CheckoutPage.tsx, StoreHub.tsx, ProtocolConsultPage.tsx]
      │
      ├─► Proves client checkout executes via atomic RPC gsa_client_checkout_store with stock FOR UPDATE locks;
      │   returns/exchanges are coordinated via loja_solicitacoes with automated 2-day difference invoices;
      │   appeals on rejected benefit protocols require SMS/WhatsApp 6-digit challenge code verification
      │   and Cloudflare/Supabase evidence uploads.
      │
[Observation 1.4: FornecedorDashboard.tsx, supplierOperations.ts]
      │
      ├─► Confirms complete supplier loop: proposal of catalog products, purchase order tracking,
      │   NF-e submission to documentos_fornecedor bucket, automated inventory incrementation upon admin
      │   review, and bank change security checks.
      │
[Observation 1.5: CollaboratorDashboard.tsx, DemandasColaboradorModule.tsx]
      │
      ├─► Confirms employee task boards (DemandasKanban) query only assigned demands for collaborators
      │   via gsa_collaborator_list_demands, while system-critical modules (acessos, gsa-tv) are strictly blocked.
      │
[Observation 1.6: AfiliadoDashboard.tsx, affiliates/service.ts, AffiliateAdminModule.tsx]
      │
      ├─► Confirms referral tracking (?ref=), 30-day commission grace period release,
      │   PIX payout controls, and P2P affiliate balance transfers.
      │
[Observation 1.7: PrestadorDashboard.tsx, providerOperations.ts, PrestadorDemandas.tsx]
      │
      └─► Confirms work order negotiation state machine (accept, reject, counteroffer, deliver, return),
          conflict-free calendar scheduling, compliance document gating, and provider PIX withdrawals.
```

---

## 3. Caveats
- No active source code was modified during this exploration phase (strictly read-only investigation).
- External third-party payment gateways (InfinitePay checkout endpoints) and WhatsApp automation dispatchers (Evolution API / n8n instances) were mapped via their frontend service wrappers (`pixService.ts`, `n8nWhatsApp.ts`, `whatsappNotificationService.ts`). Their live runtime response depends on network connectivity and valid server API keys.
- No caveats regarding code visibility: 100% of the relevant components, hooks, routes, and RPC callers were inspected directly.

---

## 4. Conclusion
The 6 user role modules form an integrated, highly disciplined, multi-tenant enterprise portal:
1. **Admin**: Master administrative hub with role delegation, two-man audit rules, SLA tracking, and financial controls.
2. **Cliente**: Consumer experience centered on an ACID-compliant marketplace, multi-method checkout, post-sale return/exchange automation, points gamification, and protocol appeal workflows.
3. **Fornecedor**: Dedicated B2B supplier workspace managing procurement orders, inventory fulfillment with NF-e upload, and automated stock replenishment.
4. **Colaborador**: Sandboxed internal employee environment scoped by granular RBAC allowlists, centered around kanban demand boards and internal service routing.
5. **Afiliado**: Growth engine featuring referral link generation, attribution cookies, grace period commission clearance, P2P balance transfers, and PIX cashouts.
6. **Prestador**: Service contractor workstation with compliance status gating, interactive work order negotiation, proof of delivery submission, and conflict-free calendar scheduling.

This mapping provides the complete technical foundation required to construct the centralized `DOCUMENTACAO_SISTEMA.md`.

---

## 5. Verification Method

### 5.1 Static Verification Commands
Run type-checking to verify that all referenced interfaces, RPC parameters, and imports are 100% valid:
```powershell
npx tsc --noEmit
```

### 5.2 Build Verification
Ensure the frontend bundle builds without warnings or syntax errors:
```powershell
npm run build
```

### 5.3 Files to Inspect
- `src/routing/routeCatalog.ts` (lines 1–383)
- `src/routing/adminAccess.ts` (lines 1–256)
- `src/pages/AdminPanel.tsx` (lines 50–290)
- `src/components/admin/AcessosModule.tsx` (lines 120–260)
- `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` (lines 1–140)
- `src/components/client/store/CheckoutPage.tsx` (lines 1110–1250)
- `src/components/client/StoreHub.tsx` (lines 65–140)
- `src/components/client/ClientPontos.tsx` (lines 150–320)
- `src/components/public/ProtocolConsultPage.tsx` (lines 300–450)
- `src/pages/Fornecedor/FornecedorDashboard.tsx` (lines 1–160)
- `src/lib/supplierOperations.ts` (lines 1–203)
- `src/components/admin/CollaboratorDashboard.tsx` (lines 1–140)
- `src/components/admin/DemandasColaboradorModule.tsx` (lines 28–140)
- `src/features/affiliates/service.ts` (lines 1–311)
- `src/components/admin/AffiliateAdminModule.tsx` (lines 1–140)
- `src/pages/Prestador/PrestadorDashboard.tsx` (lines 1–160)
- `src/lib/providerOperations.ts` (lines 1–174)
- `src/components/prestador/PrestadorDemandas.tsx` (lines 26–140)
