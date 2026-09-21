# DISPATCH — Worker Squad 6: Governance, Platform Infrastructure & Reports

## Objective
Implement native React Native mobile screens for all 17 modules in Squad 6 under `gsa-admin-mobile/src/screens/governance/`.

## Exclusive Write Ownership
You exclusively own and write to:
`gsa-admin-mobile/src/screens/governance/*`
Do NOT edit `App.tsx` or files owned by other squads.

## Modules to Implement
1. `DashboardScreen.tsx` (Cockpit executivo geral da diretoria com KPIs e atalhos)
   - Source: `src/components/admin/Dashboard.tsx`
2. `CollaboratorDashboardScreen.tsx` (Painel resumido de metricas operacionais do colaborador)
   - Source: `src/components/admin/CollaboratorDashboard.tsx`
3. `ConfiguracoesModuleScreen.tsx` (Parametros globais, chaves de API, webhooks e integracoes)
   - Source: `src/components/admin/ConfiguracoesModule.tsx`
4. `AcessosModuleScreen.tsx` (Matriz RBAC, colaboradores e permissoes de logins administrativos)
   - Source: `src/components/admin/AcessosModule.tsx`
5. `RelatoriosModuleScreen.tsx` (Gerador consolidado de relatorios analiticos operacionais)
   - Source: `src/components/admin/RelatoriosModule.tsx`
6. `SystemMonitorModuleScreen.tsx` (Monitoramento de CPU, memoria, latencia e status da VPS)
   - Source: `src/components/admin/SystemMonitorModule.tsx`
7. `SystemStatusIndicatorScreen.tsx` (Indicador de saude dos servicos e conectividade em tempo real)
   - Source: `src/components/admin/SystemStatusIndicator.tsx`
8. `WhatsAppHealthMonitorScreen.tsx` (Monitor de conexao da Evolution API e status das instancias WhatsApp)
   - Source: `src/components/admin/WhatsAppHealthMonitor.tsx`
9. `AdminNavigationScreen.tsx` (Gestor da taxonomia, categorias e menus administrativos)
   - Source: `src/components/admin/AdminNavigation.tsx`
10. `FornecedoresModuleScreen.tsx` (Homologacao, pedidos de compra e historico de fornecedores)
    - Source: `src/components/admin/FornecedoresModule.tsx`
11. `AssinaturasModuleScreen.tsx` (Gestao de planos e assinaturas recorrentes de clientes)
    - Source: `src/components/admin/AssinaturasModule.tsx`
12. `ScrapingAdminModuleScreen.tsx` (Agendamento, status e logs de robos de automacao/scraping)
    - Source: `src/components/admin/ScrapingAdminModule.tsx`
13. `ScrapingExecutionMonitorModalScreen.tsx` (Monitor em tempo real de execucoes ativas de scraping)
    - Source: `src/components/admin/ScrapingExecutionMonitorModal.tsx`
14. `SiteCampaignAdminModuleScreen.tsx` (Gestao de banners e campanhas informativas do portal publico)
    - Source: `src/components/admin/SiteCampaignAdminModule.tsx`
15. `SiteCampaignAdminPageScreen.tsx` (Pagina de edicao e configuracao de campanhas do portal)
    - Source: `src/components/admin/SiteCampaignAdminPage.tsx`
16. `SiteCampaignDeletionPanelScreen.tsx` (Painel de exclusao segura e auditoria de banners)
    - Source: `src/components/admin/SiteCampaignDeletionPanel.tsx`
17. `SiteCampaignPermissionMatrixScreen.tsx` (Matriz de permissoes de edicao e publicacao de campanhas)
    - Source: `src/components/admin/SiteCampaignPermissionMatrix.tsx`

Also create `index.ts` in `gsa-admin-mobile/src/screens/governance/` exporting all screens.

## UX Adaptation Rules
- Card-based layout (`FlatList` or `ScrollView`) with search, filter chips, pull-to-refresh (`RefreshControl`).
- Status badges with contextual colors.
- Detail modals or bottom sheets for full record inspection.
- Form inputs with `keyboardType`, touch targets >= 44x44, responsive 100% width.
- NO hardcoded desktop widths (> 420px), NO HTML `<table>` elements.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-19T19:19:11Z
You are Worker Squad 6: Governance, Platform Infrastructure & Reports.
Implement all 17 native mobile screens for Squad 6 under gsa-admin-mobile/src/screens/governance/* plus index.ts.

