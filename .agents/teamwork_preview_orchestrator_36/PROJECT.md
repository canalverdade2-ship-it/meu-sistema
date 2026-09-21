# Project: GSA Web ERP to Native Mobile Migration (React Native / Expo)

## Architecture
- **Source Workspace**: `src/components/admin/` (68 root `.tsx` modules, 176 total `.tsx` components, 102k+ LOC).
- **Target Workspace**: `gsa-admin-mobile/` (React Native 0.86, Expo SDK ~57, React 19, TypeScript strict mode).
- **Target Screens Directory**: `gsa-admin-mobile/src/screens/`
  - `operations/`: Core Operations & Demandas (8 modules)
  - `commerce/`: Commerce, Store & Catalog (11 modules)
  - `financial/`: Financial, Credit & Billing (10 modules)
  - `crm/`: CRM, VIP, Support & Protection (8 modules)
  - `growth/`: Growth, Affiliates, Loyalty & Media / GSA TV (14 modules)
  - `governance/`: Governance, Platform Infrastructure & Reports (17 modules)
- **Navigation & Routing**: `gsa-admin-mobile/App.tsx` using native state-based view switching (`currentScreen`), complete module drawer, and status header with back button.
- **Backend & Data Access**: Direct Supabase client (`gsa-admin-mobile/supabase.ts`) connected to VPS Supabase (`https://api.147-15-43-141.nip.io`). Replicates real-time queries, inserts, updates, and RPC calls.
- **Mobile UX Paradigm**: Table-to-Card transformation pattern (responsive touch cards, status badges, expandable detail modals, collapsible form sections, touch targets >= 44x44, zero hardcoded 1000px desktop tables).

## Feature Inventory & Module Mapping
| # | Feature / Component | Description | Milestone / Squad | Source |
|---|---------------------|-------------|-------------------|--------|
| 1 | OrcamentosModule | Workstation de orçamentos, propostas e conversão em OS | Squad 1 - Operations | src/components/admin/OrcamentosModule.tsx |
| 2 | OrdensServicoModule | Ordens de serviço, status de execução, garantias | Squad 1 - Operations | src/components/admin/OrdensServicoModule.tsx |
| 3 | OrdensAssinaturaModule | Gestão de contratos recorrentes de assinatura e serviços | Squad 1 - Operations | src/components/admin/OrdensAssinaturaModule.tsx |
| 4 | OrdensCompraModule | Pedidos de compra e suprimentos operacionais | Squad 1 - Operations | src/components/admin/OrdensCompraModule.tsx |
| 5 | DemandasColaboradorModule | Fila de despacho e tarefas de colaboradores | Squad 1 - Operations | src/components/admin/DemandasColaboradorModule.tsx |
| 6 | PrestadoresModule | Cadastro, homologação e gestão de prestadores | Squad 1 - Operations | src/components/admin/PrestadoresModule.tsx |
| 7 | PartnersAdminModule | Gestão de parceiros operacionais homologados | Squad 1 - Operations | src/components/admin/PartnersAdminModule.tsx |
| 8 | VendasModule | Conversão de orçamentos em vendas e checkout | Squad 1 - Operations | src/components/admin/VendasModule.tsx |
| 9 | ProdutosModule | Catálogo de produtos físicos e digitais, estoque | Squad 2 - Commerce | src/components/admin/ProdutosModule.tsx |
| 10 | ServicosModule | Catálogo de serviços tabelados | Squad 2 - Commerce | src/components/admin/ServicosModule.tsx |
| 11 | ServicePackagesModule | Combos e pacotes de serviços integrados | Squad 2 - Commerce | src/components/admin/ServicePackagesModule.tsx |
| 12 | LojaCategoriasModule | Taxonomia e categorias do marketplace | Squad 2 - Commerce | src/components/admin/LojaCategoriasModule.tsx |
| 13 | LojaTrocasModule | Fluxo de trocas, devoluções e pós-venda | Squad 2 - Commerce | src/components/admin/LojaTrocasModule.tsx |
| 14 | CuponsLojaModule | Gestão de cupons de desconto e regras | Squad 2 - Commerce | src/components/admin/CuponsLojaModule.tsx |
| 15 | PromocoesModule | Campanhas promocionais ativas da loja | Squad 2 - Commerce | src/components/admin/PromocoesModule.tsx |
| 16 | PromocaoQuantidadeModule | Descontos progressivos por quantidade | Squad 2 - Commerce | src/components/admin/PromocaoQuantidadeModule.tsx |
| 17 | PromocaoQuantidadeForm | Formulário de faixas de quantidade | Squad 2 - Commerce | src/components/admin/PromocaoQuantidadeForm.tsx |
| 18 | PromoAnalytics | Indicadores de conversão e ROI de promoções | Squad 2 - Commerce | src/components/admin/PromoAnalytics.tsx |
| 19 | PromoDetalhesModal | Detalhes e métricas de campanhas promocionais | Squad 2 - Commerce | src/components/admin/PromoDetalhesModal.tsx |
| 20 | FinanceiroModule | Livro-caixa, contas a pagar/receber, conciliação | Squad 3 - Financial | src/components/admin/FinanceiroModule.tsx |
| 21 | CobrancaModule | Régua de cobrança, acordos e inadimplência | Squad 3 - Financial | src/components/admin/CobrancaModule.tsx |
| 22 | FiscalModule | Notas fiscais de serviço e produtos (NF-e/NFS-e) | Squad 3 - Financial | src/components/admin/FiscalModule.tsx |
| 23 | CreditoModule | Análise de crédito, limites e esteira | Squad 3 - Financial | src/components/admin/CreditoModule.tsx |
| 24 | EmprestimosModule | Gestão de contratos de empréstimos e parcelas | Squad 3 - Financial | src/components/admin/EmprestimosModule.tsx |
| 25 | PainelRentabilidade | DRE operacional, margens e rentabilidade | Squad 3 - Financial | src/components/admin/PainelRentabilidade.tsx |
| 26 | ReembolsosModule | Aprovação e processamento de reembolsos | Squad 3 - Financial | src/components/admin/ReembolsosModule.tsx |
| 27 | CalculatorProAdminPanel | Precificação de taxas de gateway e maquininhas | Squad 3 - Financial | src/components/admin/CalculatorProAdminPanel.tsx |
| 28 | CalculatorProPaymentConfiguration | Parâmetros de juros e parcelamento | Squad 3 - Financial | src/components/admin/CalculatorProPaymentConfiguration.tsx |
| 29 | ShopeeOperationsModule | Conciliação e repasses Shopee/Marketplace | Squad 3 - Financial | src/components/admin/ShopeeOperationsModule.tsx |
| 30 | ClientesModule | CRM 360º de clientes PF e PJ, histórico | Squad 4 - CRM | src/components/admin/ClientesModule.tsx |
| 31 | CadastroModule | Central de novos cadastros unificados | Squad 4 - CRM | src/components/admin/CadastroModule.tsx |
| 32 | AreaVIPModule | Gestão de membros VIP e benefícios | Squad 4 - CRM | src/components/admin/AreaVIPModule.tsx |
| 33 | TicketsModule | Helpdesk, chamados de suporte e SLA | Squad 4 - CRM | src/components/admin/TicketsModule.tsx |
| 34 | ProtectionAdminModule | Gestão de planos GSA Saúde e Seguros | Squad 4 - CRM | src/components/admin/ProtectionAdminModule.tsx |
| 35 | EmpresaModule | Hub corporativo e convênios PJ | Squad 4 - CRM | src/components/admin/EmpresaModule.tsx |
| 36 | IndicacoesModule | Programa Indique e Ganhe e afiliados | Squad 4 - CRM | src/components/admin/IndicacoesModule.tsx |
| 37 | ClassifiedsModule | Moderação de anúncios classificados | Squad 4 - CRM | src/components/admin/ClassifiedsModule.tsx |
| 38 | AffiliateAdminModule | Rede de afiliados, comissões e links | Squad 5 - Growth | src/components/admin/AffiliateAdminModule.tsx |
| 39 | PremiosModule | Catálogo de prêmios do programa fidelidade | Squad 5 - Growth | src/components/admin/PremiosModule.tsx |
| 40 | VouchersModule | Emissão, validação e resgate de vouchers | Squad 5 - Growth | src/components/admin/VouchersModule.tsx |
| 41 | AdvertisingAdminModule | Campanhas publicitárias e banners | Squad 5 - Growth | src/components/admin/AdvertisingAdminModule.tsx |
| 42 | TravelAdminModule | GSA Viagens: pacotes e reservas | Squad 5 - Growth | src/components/admin/TravelAdminModule.tsx |
| 43 | ViagensCategoriasModule | Categorias e destinos de viagens | Squad 5 - Growth | src/components/admin/ViagensCategoriasModule.tsx |
| 44 | CareersAdminModule | Processos seletivos e candidaturas | Squad 5 - Growth | src/components/admin/CareersAdminModule.tsx |
| 45 | CareerVacanciesManager | Gestão de vagas de emprego | Squad 5 - Growth | src/components/admin/CareerVacanciesManager.tsx |
| 46 | GsaTvModule | Painel central da emissora GSA TV | Squad 5 - Growth | src/components/admin/GsaTvModule.tsx |
| 47 | GsaTvControlRoom | Sala de controle da transmissão ao vivo | Squad 5 - Growth | src/components/admin/GsaTvControlRoom.tsx |
| 48 | GsaTvLiveConsole | Console de telemetria da transmissão | Squad 5 - Growth | src/components/admin/GsaTvLiveConsole.tsx |
| 49 | GsaTvLiveSources | Gestão de fluxos RTMP/SRT e câmeras | Squad 5 - Growth | src/components/admin/GsaTvLiveSources.tsx |
| 50 | GsaTvGraphics | Gerador de caracteres e grafismos da TV | Squad 5 - Growth | src/components/admin/GsaTvGraphics.tsx |
| 51 | GsaTvRights | Gestão de direitos e acervo da TV | Squad 5 - Growth | src/components/admin/GsaTvRights.tsx |
| 52 | Dashboard | Cockpit executivo geral da diretoria | Squad 6 - Governance | src/components/admin/Dashboard.tsx |
| 53 | CollaboratorDashboard | Painel de métricas operacionais do colaborador | Squad 6 - Governance | src/components/admin/CollaboratorDashboard.tsx |
| 54 | ConfiguracoesModule | Parâmetros globais, chaves de API, webhooks | Squad 6 - Governance | src/components/admin/ConfiguracoesModule.tsx |
| 55 | AcessosModule | Matriz RBAC e usuários administrativos | Squad 6 - Governance | src/components/admin/AcessosModule.tsx |
| 56 | RelatoriosModule | Gerador consolidado de relatórios analíticos | Squad 6 - Governance | src/components/admin/RelatoriosModule.tsx |
| 57 | SystemMonitorModule | Monitoramento de VPS, CPU, memória e status | Squad 6 - Governance | src/components/admin/SystemMonitorModule.tsx |
| 58 | SystemStatusIndicator | Indicador de saúde dos serviços em tempo real | Squad 6 - Governance | src/components/admin/SystemStatusIndicator.tsx |
| 59 | WhatsAppHealthMonitor | Monitor de saúde da Evolution API / WhatsApp | Squad 6 - Governance | src/components/admin/WhatsAppHealthMonitor.tsx |
| 60 | AdminNavigation | Gestor da taxonomia e menus administrativos | Squad 6 - Governance | src/components/admin/AdminNavigation.tsx |
| 61 | FornecedoresModule | Gestão de compras e fornecedores homologados | Squad 6 - Governance | src/components/admin/FornecedoresModule.tsx |
| 62 | AssinaturasModule | Gestão de planos e assinaturas de clientes | Squad 6 - Governance | src/components/admin/AssinaturasModule.tsx |
| 63 | ScrapingAdminModule | Monitor de robôs de scraping e automações | Squad 6 - Governance | src/components/admin/ScrapingAdminModule.tsx |
| 64 | ScrapingExecutionMonitorModal | Monitor em tempo real de execuções de scraping | Squad 6 - Governance | src/components/admin/ScrapingExecutionMonitorModal.tsx |
| 65 | SiteCampaignAdminModule | Gestão de banners e avisos do portal público | Squad 6 - Governance | src/components/admin/SiteCampaignAdminModule.tsx |
| 66 | SiteCampaignAdminPage | Página administrativa de campanhas do portal | Squad 6 - Governance | src/components/admin/SiteCampaignAdminPage.tsx |
| 67 | SiteCampaignDeletionPanel | Auditoria e exclusão segura de campanhas | Squad 6 - Governance | src/components/admin/SiteCampaignDeletionPanel.tsx |
| 68 | SiteCampaignPermissionMatrix | Matriz de permissões de campanhas do site | Squad 6 - Governance | src/components/admin/SiteCampaignPermissionMatrix.tsx |

## Milestones & Execution Plan
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Architecture | Catalog web modules, audit mobile app, design verification script | none | DONE |
| M1 | Squad 1: Operations & Demandas | Implement 8 mobile screens in `src/screens/operations/` | M0 | IN_PROGRESS |
| M2 | Squad 2: Commerce & Catalog | Implement 11 mobile screens in `src/screens/commerce/` | M0 | IN_PROGRESS |
| M3 | Squad 3: Financial & Billing | Implement 10 mobile screens in `src/screens/financial/` | M0 | IN_PROGRESS |
| M4 | Squad 4: CRM & Support | Implement 8 mobile screens in `src/screens/crm/` | M0 | IN_PROGRESS |
| M5 | Squad 5: Growth, Media & GSA TV | Implement 14 mobile screens in `src/screens/growth/` | M0 | IN_PROGRESS |
| M6 | Squad 6: Governance, Infra & Reports | Implement 17 mobile screens in `src/screens/governance/` | M0 | IN_PROGRESS |
| M7 | App Routing & Navigation | Wire all 68 screens into `App.tsx` drawer and routing | M1-M6 | PLANNED |
| M8 | Parity Verification & Typecheck | Run `verify-parity.js` (100% pass) and `npx tsc --noEmit` (exit 0) | M7 | PLANNED |
| M9 | UX Adaptation Review & Audit | Independent review against UX rubric and forensic audit | M8 | PLANNED |

## Interface Contracts
- Screen Components Props: `{ onNavigate?: (screenId: string) => void; session?: any }`
- Supabase Client: Import from `../../supabase` or `../supabase`
- UI Components: Standard React Native primitives (`View`, `Text`, `TouchableOpacity`, `FlatList`, `ScrollView`, `TextInput`, `Modal`, `StyleSheet`)
- Design Tokens: Primary `#17345f`, Secondary `#2563eb`, Background `#f0f2f5`, Surface `#ffffff`, Text `#1e293b`, Border `#e2e8f0`
- Touch Targets: Min 44x44pt
- Responsive Rule: Width 100%, flex 1, no fixed desktop dimensions > 420px

## Code Layout
- `gsa-admin-mobile/src/screens/operations/`: Operations screens
- `gsa-admin-mobile/src/screens/commerce/`: Commerce screens
- `gsa-admin-mobile/src/screens/financial/`: Financial screens
- `gsa-admin-mobile/src/screens/crm/`: CRM screens
- `gsa-admin-mobile/src/screens/growth/`: Growth & TV screens
- `gsa-admin-mobile/src/screens/governance/`: Governance screens
- `gsa-admin-mobile/App.tsx`: Central router and drawer navigation
- `gsa-admin-mobile/scripts/verify-parity.js`: Automated parity verification script
