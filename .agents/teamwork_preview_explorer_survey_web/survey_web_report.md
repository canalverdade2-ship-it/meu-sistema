# Relatório Técnico de Mapeamento e Auditoria dos Módulos Web Admin (ERP GSA)

> **Data do Levantamento**: 2026-09-19  
> **Escopo da Análise**: `src/components/admin/**` (100% dos componentes `.tsx`)  
> **Finalidade**: Subsidiar a Migração Nativa Completa do ERP Web para Aplicativo Móvel (React Native / Expo) com Paridade Funcional de 100%  

---

## 1. Sumário Executivo & Métricas Consolidadas

Foi realizada uma varredura exaustiva, automatizada e minuciosa em **todos os arquivos TypeScript React (`.tsx`)** localizados no diretório `src/components/admin/` e seus respectivos subdiretórios (`super-domains`, `clientes`, `demandas`, `ecommerce`, `gsa-tv`, `infra`, `prestadores`, `products`, `relatorios`, `ui`).

### Tabela Geral de Métricas

| Métrica | Quantitativo Absoluto |
| :--- | :--- |
| **Total de Componentes .tsx Catalogados** | **176 arquivos** |
| **Total de Linhas de Código Analisadas** | **102.457 linhas** |
| **Tabelas Supabase Acessadas Diretamente** | **129 tabelas únicas** |
| **Funções RPC (Remote Procedure Calls) Chamadas** | **147 RPCs únicas** |
| **Edge Functions / Microserviços Invocados** | **3 endpoints** |
| **Esquadrões de Domínio (Squads) Definidos** | **9 squads especializados** |

### Distribuição por Esquadrões de Domínio (Squads)

| ID | Esquadrão / Domínio Funcional | Componentes | Linhas Totais | Complexidade Média | Principais Entidades |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **SQ-01** | **Squad 1 — Core, Governança & Infraestrutura** | 29 | 11.978 | 8 Alta / 13 Média / 8 Baixa | colaboradores, sistema_logs, solicitacoes_exclusao, system_settings |
| **SQ-02** | **Squad 2 — Financeiro, Cobrança & Fiscal** | 20 | 17.529 | 11 Alta / 9 Média / 0 Baixa | cobranca_acordo_parcelas, cobranca_historico, cobrancas, faturas |
| **SQ-03** | **Squad 3 — Contratos, Jurídico & Grandes Contas** | 8 | 5.087 | 3 Alta / 4 Média / 1 Baixa | clientes, ticket_mensagens, tickets, contratos |
| **SQ-04** | **Squad 4 — Pessoas, CRM, Cadastros & Parceiros** | 27 | 23.579 | 12 Alta / 14 Média / 1 Baixa | gsa_afiliado_comissoes, gsa_afiliado_links, gsa_afiliado_programas, gsa_afiliado_saques |
| **SQ-05** | **Squad 5 — Operações, Demandas & Atendimento** | 23 | 13.445 | 7 Alta / 9 Média / 7 Baixa | colaboradores, demanda_comentarios, os_notas, os_suporte_mensagens |
| **SQ-06** | **Squad 6 — E-commerce, Catálogo, Loja & Fidelidade** | 27 | 15.034 | 6 Alta / 15 Média / 6 Baixa | client_levels, clientes, level_history, system_settings |
| **SQ-07** | **Squad 7 — Mídia, GSA TV & Publicidade** | 23 | 10.004 | 8 Alta / 7 Média / 8 Baixa | gsa_ad_campaigns, gsa_ad_creatives, gsa_ad_payments, gsa_ad_placements |
| **SQ-08** | **Squad 8 — Benefícios, Seguros & Viagens** | 3 | 3.048 | 2 Alta / 1 Média / 0 Baixa | clientes, viagens_categorias, viagens_orcamentos, viagens_pacote_imagens |
| **SQ-09** | **Squad 9 — BI, Relatórios & Analytics** | 16 | 2.753 | 1 Alta / 11 Média / 4 Baixa | client_levels, clientes, faturas, cobrancas |

---

## 2. Topologia Arquitetural de `src/components/admin/`

A estrutura do painel administrativo do ERP GSA divide-se em quatro grandes camadas estruturais:

1. **Raiz (`src/components/admin/*.tsx` - 68 componentes)**:
   - Módulos canônicos de alto nível integrados ao roteador (`AdminPanel.tsx`, `CadastroModule.tsx`, `VendasModule.tsx`, `FinanceiroModule.tsx`, `TicketsModule.tsx`, `AcessosModule.tsx`, `GsaTvModule.tsx`).
   - Controles de dashboard, status e atalhos rápidos de navegação.
2. **Super-Domínios (`src/components/admin/super-domains/**` - 51 componentes)**:
   - Arquitetura corporativa em "Super Domains" introduzida para descentralizar operações complexas:
     - `financeiro/` (11 componentes): Cockpit financeiro, faturamento, DRE/fluxo de caixa, conciliação e disputas.
     - `pessoas/` (11 componentes): Gestão unificada de clientes, prestadores, fornecedores, parceiros e afiliados.
     - `operacoes/` (9 componentes): Workstations dedicadas para Demandas, Orçamentos, OS, Compras e Viagens.
     - `governanca/` (8 componentes): Dashboards executivos, auditoria de transações, logs de segurança e políticas.
     - `contratos/` (8 componentes): CRM 360º, minutas contratuais, ZapSign, B2B e contratos setoriais.
     - `shared/` (4 componentes): Componentes táticos transversais (TacticalDataGrid, SplitScreenLayout, CommandSlideOver, StatusBadge).
3. **Subdiretórios Especializados (53 componentes)**:
   - `relatorios/` (15 componentes): Relatórios analíticos e operacionais segmentados por verticais de negócio.
   - `gsa-tv/` (10 componentes): Suíte broadcast, estúdio de grade, acervo de mídia e automação por IA.
   - `products/` (8 componentes): Importação multi-formato, wizard de fornecedores e leitura de código de barras.
   - `prestadores/` (7 componentes): Gestão cadastral profunda, prêmios, vouchers e auditoria documental de prestadores.
   - `demandas/` (6 componentes): Quadro Kanban, modal de despacho, histórico e time tracking de chamados.
   - `infra/` (4 componentes): Gerenciamento Cloudflare R2/DNS, métricas Oracle Cloud VPS e terminal WebSockets SSH.
   - `ecommerce/` (2 componentes): Inteligência de vendas da loja virtual e precificação dinâmica.
   - `clientes/` (1 componente): Gaveta de detalhes completos e histórico 360 do cliente.
4. **Componentes Táticos de UI (`src/components/admin/ui/*.tsx` - 4 componentes)**:
   - Feed de atividades administrativas, paleta de comandos (`Ctrl+K`), cartões de domínio e botão institucional WhatsApp.

---

## 3. Catálogo Exaustivo dos Componentes por Esquadrão (Squad)

### Squad 1 — Core, Governança & Infraestrutura

- **Total de Componentes**: 29
- **Volume de Código**: 11.978 linhas
- **Diretórios Base**: AcessosModule.tsx, AdminNavigation.tsx, CollaboratorDashboard.tsx, ConfiguracoesModule.tsx, Dashboard.tsx, EmpresaModule.tsx, SystemMonitorModule.tsx, SystemStatusIndicator.tsx, WhatsAppHealthMonitor.tsx, infra, super-domains, ui

#### Inventário Detalhado dos Componentes

##### 1.1. `AcessosModule`

- **Arquivo**: `src/components/admin/AcessosModule.tsx`
- **Linhas de Código**: 428 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{collaborator.nome}"
- **Tabelas Supabase Acessadas**:
  - `colaboradores [realtime/query]`
  - `solicitacoes_exclusao [realtime/query]`
  - `sistema_logs [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_access_snapshot`
  - RPC: `gsa_admin_review_deletion_request`
  - RPC: `gsa_admin_rotate_collaborator_credential`
  - RPC: `gsa_admin_save_collaborator`
  - RPC: `gsa_admin_save_function`
  - RPC: `gsa_admin_set_collaborator_status`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 1.2. `AdminSuperDomainSwitcher`

- **Arquivo**: `src/components/admin/AdminNavigation.tsx`
- **Linhas de Código**: 188 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 1.3. `CollaboratorDashboard`

- **Arquivo**: `src/components/admin/CollaboratorDashboard.tsx`
- **Linhas de Código**: 167 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Olá, {colaboradorNome || 'Colaborador'}!"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_collaborator_dashboard_snapshot`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.4. `ConfiguracoesModule`

- **Arquivo**: `src/components/admin/ConfiguracoesModule.tsx`
- **Linhas de Código**: 313 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{method.nome}"
- **Tabelas Supabase Acessadas**:
  - `system_settings [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_save_company`
  - RPC: `gsa_admin_save_payment_method`
  - RPC: `gsa_admin_settings_snapshot`
  - RPC: `gsa_admin_update_settings_secure`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 1.5. `Dashboard`

- **Arquivo**: `src/components/admin/Dashboard.tsx`
- **Linhas de Código**: 531 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{title}"
- **Tabelas Supabase Acessadas**:
  - `faturas [realtime/query]`
  - `cobrancas [realtime/query]`
  - `saques [realtime/query]`
  - `emprestimos [realtime/query]`
  - `orcamentos [realtime/query]`
  - `ordens_servico [realtime/query]`
  - `ordens_fiscais [realtime/query]`
  - `tickets [realtime/query]`
  - `clientes [realtime/query]`
  - `ordens_compra [realtime/query]`
  - `vouchers [realtime/query]`
  - `prestador_demandas [realtime/query]`
  - `promocoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_baixar_fatura`
  - RPC: `gsa_admin_dashboard_snapshot`
  - RPC: `gsa_admin_processar_saque`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 1.6. `EmpresaModule`

- **Arquivo**: `src/components/admin/EmpresaModule.tsx`
- **Linhas de Código**: 199 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Dados da Empresa"
- **Tabelas Supabase Acessadas**:
  - `empresa [select, select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSave`
- **Campos e Formulários Detectados**: Razão Social, CNPJ, Telefone, Responsável
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 1.7. `SystemMonitorModule`

- **Arquivo**: `src/components/admin/SystemMonitorModule.tsx`
- **Linhas de Código**: 657 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Banco de Dados PostgreSQL"
- **Tabelas Supabase Acessadas**:
  - `colaboradores [select, realtime/query]`
  - `clientes [select, realtime/query]`
  - `prestadores [select, realtime/query]`
  - `gsa_afiliados [select, realtime/query]`
  - `fornecedores [realtime/query]`
  - `sistema_logs [realtime/query]`
  - `system_settings [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_supplier_snapshot`
  - RPC: `gsa_admin_system_snapshot`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSendTestAlert`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 1.8. `SystemStatusIndicator`

- **Arquivo**: `src/components/admin/SystemStatusIndicator.tsx`
- **Linhas de Código**: 170 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{config.label}"
- **Tabelas Supabase Acessadas**:
  - `clientes [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleToggle`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.9. `WhatsAppHealthMonitor`

- **Arquivo**: `src/components/admin/WhatsAppHealthMonitor.tsx`
- **Linhas de Código**: 528 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "WhatsApp Evolution API"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleManualCheck`, `handleTogglePause`, `handleClearQueue`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.10. `CloudflareManager`

- **Arquivo**: `src/components/admin/infra/CloudflareManager.tsx`
- **Linhas de Código**: 691 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Gerenciamento de DNS"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleDeleteFile`, `handleOpenFile`, `handleDevMode`, `handleUnderAttackMode`, `handlePurgeCache`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.11. `OracleMetricsPanel`

- **Arquivo**: `src/components/admin/infra/OracleMetricsPanel.tsx`
- **Linhas de Código**: 123 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handlePower`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 1.12. `VPSTerminal`

- **Arquivo**: `src/components/admin/infra/VPSTerminal.tsx`
- **Linhas de Código**: 133 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleResize`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 1.13. `WhatsAppQRCodeManager`

- **Arquivo**: `src/components/admin/infra/WhatsAppQRCodeManager.tsx`
- **Linhas de Código**: 1168 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Atualizar Status"
- **Tabelas Supabase Acessadas**:
  - `system_settings [select/query]`
  - `gsa_whatsapp_ramais [select/query, update, insert, delete]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_whatsapp_mutation`
  - Edge Function: `vps-api`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleDragStart`, `handleDragOver`, `handleDrop`, `handleSaveDevice`, `handleRemoveDevice`, `handleOpenNovoRamalModal`, `handleSaveRamal`, `handleToggleRamalAtivo`
- **Campos e Formulários Detectados**: Número do WhatsApp (com DDD), Nome do Setor com Sequência
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 1.14. `GovernancaAcessosView`

- **Arquivo**: `src/components/admin/super-domains/governanca/GovernancaAcessosView.tsx`
- **Linhas de Código**: 963 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Informações de Identificação"
- **Tabelas Supabase Acessadas**:
  - `colaboradores [realtime/query]`
  - `funcoes [realtime/query]`
  - `solicitacoes_exclusao [realtime/query]`
  - `admin_sessoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_access_snapshot`
  - RPC: `gsa_admin_review_deletion_request`
  - RPC: `gsa_admin_rotate_collaborator_credential`
  - RPC: `gsa_admin_save_collaborator`
  - RPC: `gsa_admin_save_function`
  - RPC: `gsa_admin_set_collaborator_status`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSaveCollaborator`, `handleSaveFunction`, `handleToggleStatus`, `handleRotateCredential`, `handleReviewDeletion`
- **Campos e Formulários Detectados**: Nome Completo, Função Organizacional, E-mail Corporativo, Telefone / WhatsApp, Nome do Cargo / Função, Descrição das Atribuições
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 1.15. `GovernancaAuditoriaView`

- **Arquivo**: `src/components/admin/super-domains/governanca/GovernancaAuditoriaView.tsx`
- **Linhas de Código**: 364 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Trilha de Auditoria & Imutabilidade"
- **Tabelas Supabase Acessadas**:
  - `sistema_logs [select, realtime/query]`
  - `system_settings [select, realtime/query]`
  - `audit_trail [realtime/query]`
  - `solicitacoes_exclusao [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_access_snapshot`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.16. `GovernancaCollaboratorDashboard`

- **Arquivo**: `src/components/admin/super-domains/governanca/GovernancaCollaboratorDashboard.tsx`
- **Linhas de Código**: 449 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Olá, {colaboradorNome || 'Colaborador GSA'}!"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_collaborator_dashboard_snapshot`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.17. `GovernancaConfiguracoesView`

- **Arquivo**: `src/components/admin/super-domains/governanca/GovernancaConfiguracoesView.tsx`
- **Linhas de Código**: 1243 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Dados Oficiais da Empresa"
- **Tabelas Supabase Acessadas**:
  - `system_settings [realtime/query]`
  - `payment_methods [realtime/query]`
  - `configuracoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_save_company`
  - RPC: `gsa_admin_save_payment_method`
  - RPC: `gsa_admin_settings_snapshot`
  - RPC: `gsa_admin_update_settings_secure`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: Razão Social, CNPJ, Telefone Principal, Responsável Legal, Status do Código Padrão, Código de Boas-Vindas, Tipo de Recompensa, Valor do Bônus, Tipo da taxa, Desconto PIX Ativo
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 1.18. `GovernancaExecutiveDashboard`

- **Arquivo**: `src/components/admin/super-domains/governanca/GovernancaExecutiveDashboard.tsx`
- **Linhas de Código**: 519 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Olá, {adminType === 'admin' ? 'Administrador Master' : colaboradorNome || 'Colaborador'}"
- **Tabelas Supabase Acessadas**:
  - `clientes [realtime/query]`
  - `faturas [realtime/query]`
  - `saques [realtime/query]`
  - `prestador_demandas [realtime/query]`
  - `ordens_servico [realtime/query]`
  - `colaboradores [realtime/query]`
  - `sistema_logs [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_baixar_fatura`
  - RPC: `gsa_admin_dashboard_snapshot`
  - RPC: `gsa_admin_processar_saque`
- **Capacidades Interativas & Padrões de UI**:
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 1.19. `GovernancaInfraView`

- **Arquivo**: `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx`
- **Linhas de Código**: 556 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Banco de Dados PostgreSQL"
- **Tabelas Supabase Acessadas**:
  - `colaboradores [select, realtime/query]`
  - `clientes [select, realtime/query]`
  - `system_settings [realtime/query]`
  - `gsa_whatsapp_ramais [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_system_snapshot`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSendTestAlert`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.20. `GovernancaRelatoriosView`

- **Arquivo**: `src/components/admin/super-domains/governanca/GovernancaRelatoriosView.tsx`
- **Linhas de Código**: 312 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Catálogo de Relatórios"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: Data de Início, Data de Fim
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.21. `GovernancaSuperDomain`

- **Arquivo**: `src/components/admin/super-domains/governanca/GovernancaSuperDomain.tsx`
- **Linhas de Código**: 223 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Governança, Auditoria & Configurações"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.22. `CommandSlideOver`

- **Arquivo**: `src/components/admin/super-domains/shared/CommandSlideOver.tsx`
- **Linhas de Código**: 297 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{title}"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleRequestClose`, `handleKeyDown`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.23. `SplitScreenLayout`

- **Arquivo**: `src/components/admin/super-domains/shared/SplitScreenLayout.tsx`
- **Linhas de Código**: 263 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "{detailTitle || 'Detalhes do Registro'}"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 1.24. `getStatusBadgeVariant`

- **Arquivo**: `src/components/admin/super-domains/shared/StatusBadge.tsx`
- **Linhas de Código**: 309 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.25. `TacticalDataGrid`

- **Arquivo**: `src/components/admin/super-domains/shared/TacticalDataGrid.tsx`
- **Linhas de Código**: 575 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Densidade Compacta (32px)"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSort`, `handleExportCsv`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 1.26. `AdminActivityFeed`

- **Arquivo**: `src/components/admin/ui/AdminActivityFeed.tsx`
- **Linhas de Código**: 90 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Timeline da Operação"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleItemClick`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 1.27. `AdminCommandPalette`

- **Arquivo**: `src/components/admin/ui/AdminCommandPalette.tsx`
- **Linhas de Código**: 195 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleKeyDown`, `handleExecute`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 1.28. `AdminDomainCard`

- **Arquivo**: `src/components/admin/ui/AdminDomainCard.tsx`
- **Linhas de Código**: 54 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "{title}"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 1.29. `AdminWhatsAppButton`

- **Arquivo**: `src/components/admin/ui/AdminWhatsAppButton.tsx`
- **Linhas de Código**: 270 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleAction`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

---

### Squad 2 — Financeiro, Cobrança & Fiscal

- **Total de Componentes**: 20
- **Volume de Código**: 17.529 linhas
- **Diretórios Base**: CalculatorProAdminPanel.tsx, CalculatorProPaymentConfiguration.tsx, CobrancaModule.tsx, CreditoModule.tsx, EmprestimosModule.tsx, FinanceiroModule.tsx, FiscalModule.tsx, PainelRentabilidade.tsx, ReembolsosModule.tsx, super-domains

#### Inventário Detalhado dos Componentes

##### 2.1. `CalculatorProAdminPanel`

- **Arquivo**: `src/components/admin/CalculatorProAdminPanel.tsx`
- **Linhas de Código**: 689 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{TOOL_LABELS[product.tool_id]}"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_create_calculator_pro_voucher`
  - RPC: `gsa_admin_ensure_calculator_pro_products`
  - RPC: `gsa_admin_save_calculator_pro_product`
  - RPC: `gsa_admin_set_calculator_pro_voucher_status`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: Regra de Bloqueio Pro
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.2. `CalculatorProPaymentConfiguration`

- **Arquivo**: `src/components/admin/CalculatorProPaymentConfiguration.tsx`
- **Linhas de Código**: 134 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Checkout InfinitePay"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_calculator_pro_snapshot`
  - RPC: `gsa_admin_save_calculator_pro_runtime_config`
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 2.3. `CobrancaModule`

- **Arquivo**: `src/components/admin/CobrancaModule.tsx`
- **Linhas de Código**: 1985 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Histórico de contatos e ações"
- **Tabelas Supabase Acessadas**:
  - `system_settings [select]`
  - `cobrancas [select/query, select, realtime/query]`
  - `faturas [select/query]`
  - `cobranca_historico [realtime/query]`
  - `cobranca_acordo_parcelas [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_baixar_cobranca_manual`
  - RPC: `gsa_admin_baixar_parcela_cobranca`
  - RPC: `gsa_admin_cancelar_acordo_cobranca`
  - RPC: `gsa_admin_criar_cobranca_fatura`
  - RPC: `gsa_admin_excluir_cobranca`
  - RPC: `gsa_admin_gerar_acordo_cobranca`
  - RPC: `gsa_admin_mudar_status_cobranca`
  - RPC: `gsa_admin_protestar_cobranca`
  - RPC: `gsa_admin_registrar_cobranca_historico`
  - RPC: `gsa_admin_upsert_settings`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleGerarCobrancasEmLote`, `handleGerarCobrancaFatura`, `handleEnviarWhatsAppDireto`, `handleMudarStatusCobranca`, `handleProtestoLote`, `handleCancelarAcordo`, `handleExcluirAcordo`
- **Campos e Formulários Detectados**: Multa Pós-Vencimento (%), Juros Mensal (%), Tipo de Aplicação de Juros, Promessa Pgt?, Desconto Concedido, Tipo, Qtd. Parcelas, 1º Vencimento, Observações do Acordo, Data do Pagamento
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.4. `CreditoModule`

- **Arquivo**: `src/components/admin/CreditoModule.tsx`
- **Linhas de Código**: 2208 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Análise da Solicitação de Crédito"
- **Tabelas Supabase Acessadas**:
  - `loja_credito_solicitacoes [select/query, realtime/query]`
  - `system_settings [select/query]`
  - `clientes [select/query, realtime/query]`
  - `loja_credito_movimentacoes [select/query, realtime/query]`
  - `loja_credito_documentos [select/query, realtime/query]`
  - `faturas [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_ajustar_limite_credito_cliente`
  - RPC: `gsa_admin_aprovar_aumento_credito`
  - RPC: `gsa_admin_atualizar_documento_credito`
  - RPC: `gsa_admin_definir_parcelamento_credito`
  - RPC: `gsa_admin_enviar_oferta_quitacao_credito`
  - RPC: `gsa_admin_liberar_credito_contrato`
  - RPC: `gsa_admin_preaprovar_credito`
  - RPC: `gsa_admin_recusar_credito`
  - RPC: `gsa_admin_rejeitar_contrato_credito`
  - RPC: `gsa_admin_solicitar_documento_credito`
  - RPC: `gsa_admin_upsert_settings`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleSaveSettings`, `handleOpenRequest`, `handlePreAprovar`, `handleAprovarAumentoDireto`, `handleRecusar`, `handleSolicitarDocumento`, `handleDocumentoStatus`, `handleRejeitarContrato`
- **Campos e Formulários Detectados**: Juros À Vista (30 dias) (%), Juros por Parcela adicional (%), Nome do Documento, Instrução / Observação, Novo Limite Total Aprovado (R$), Valor do Limite Aprovado (R$), Número máximo de parcelas, Justificativa da Recusa, Novo Limite Total (R$), Motivo do Ajuste / Histórico
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.5. `EmprestimosModule`

- **Arquivo**: `src/components/admin/EmprestimosModule.tsx`
- **Linhas de Código**: 1176 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Gestão de Empréstimos"
- **Tabelas Supabase Acessadas**:
  - `emprestimos [select, realtime/query]`
  - `emprestimo_historico [select, realtime/query]`
  - `emprestimo_comentarios [select, realtime/query]`
  - `emprestimo_parcelas [select, realtime/query]`
  - `emprestimo_documentos [select, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_emprestimo_aprovar`
  - RPC: `gsa_admin_emprestimo_atualizar_documento`
  - RPC: `gsa_admin_emprestimo_atualizar_status`
  - RPC: `gsa_admin_emprestimo_enviar_comentario`
  - RPC: `gsa_admin_emprestimo_enviar_contrato`
  - RPC: `gsa_admin_emprestimo_enviar_oferta_quitacao`
  - RPC: `gsa_admin_emprestimo_enviar_proposta`
  - RPC: `gsa_admin_emprestimo_salvar_observacao`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Campos e Formulários Detectados**: Valor Aprovado (R$), Juros (%), Máx Parcelas, Taxa de Serviço (R$), Valor da Oferta de Quitação (R$), Registrar Pendência, Observações Administrativas
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.6. `FinanceiroModule`

- **Arquivo**: `src/components/admin/FinanceiroModule.tsx`
- **Linhas de Código**: 3289 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Financeiro"
- **Tabelas Supabase Acessadas**:
  - `faturas [select/query, realtime/query]`
  - `saques [select/query, realtime/query]`
  - `transferencias [select/query, realtime/query]`
  - `clientes [select]`
  - `ordens_servico [select/query]`
  - `ordens_compra [select/query]`
  - `ordens_assinatura [select/query]`
  - `ordens_fiscais [insert]`
  - `fatura_contestacoes [select/query]`
  - `prestador_saques [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `fn_marcar_faturas_vencidas`
  - RPC: `gsa_admin_aplicar_ajuste_fatura`
  - RPC: `gsa_admin_baixar_fatura`
  - RPC: `gsa_admin_cancelar_fatura`
  - RPC: `gsa_admin_criar_fatura_manual`
  - RPC: `gsa_admin_enviar_fatura_cobranca`
  - RPC: `gsa_admin_processar_saque`
  - RPC: `gsa_admin_processar_transferencia`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleMainTabClick`, `handleSubTabClick`, `handleAprovarSaque`, `handleRejeitarSaque`, `handleAprovarTransferencia`, `handleRejeitarTransferencia`, `handleEstornarTransferencia`, `handleManualPayment`
- **Campos e Formulários Detectados**: Motivo do Cancelamento, Data do Pagamento, Motivo da Rejeição, Motivo do Estorno, Natureza da Fatura, Resposta ao cliente (obrigatório), Forma de Pgto., Data / Hora, Observações, Desconto (R$)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.7. `FiscalModule`

- **Arquivo**: `src/components/admin/FiscalModule.tsx`
- **Linhas de Código**: 206 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{item.codigo_fiscal || `Ordem ${String(item.id).slice(0, 8)}`}"
- **Tabelas Supabase Acessadas**:
  - `ordens_fiscais [realtime/query]`
  - `faturas [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_fiscal_update`
  - RPC: `gsa_admin_list_resource`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 2.8. `PainelRentabilidade`

- **Arquivo**: `src/components/admin/PainelRentabilidade.tsx`
- **Linhas de Código**: 406 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Tabelas Supabase Acessadas**:
  - `faturas [select/query, realtime/query]`
  - `ordens_servico [select/query, realtime/query]`
  - `prestador_demandas [select/query, realtime/query]`
  - `orcamentos [select/query, realtime/query]`
  - `clientes [select/query]`
  - `indicacoes [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.9. `ReembolsosModule`

- **Arquivo**: `src/components/admin/ReembolsosModule.tsx`
- **Linhas de Código**: 830 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{formatCurrency(refund.valor_reembolso)}"
- **Tabelas Supabase Acessadas**:
  - `faturas [select/query]`
  - `loja_reembolsos [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleConfirmPayment`, `handleCancelRefund`
- **Campos e Formulários Detectados**: Data e Hora do Pagamento, Observações Internas (Opcional), Justificativa do Cancelamento
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.10. `CalculadorasGatewayView`

- **Arquivo**: `src/components/admin/super-domains/financeiro/CalculadorasGatewayView.tsx`
- **Linhas de Código**: 566 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Integração InfinitePay"
- **Tabelas Supabase Acessadas**:
  - `vouchers [realtime/query]`
  - `system_settings [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_calculator_pro_snapshot`
  - RPC: `gsa_admin_create_calculator_pro_voucher`
  - RPC: `gsa_admin_save_calculator_pro_product`
  - RPC: `gsa_admin_save_calculator_pro_runtime_config`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSaveProduct`, `handleCreateVoucher`, `handleSaveGateway`
- **Campos e Formulários Detectados**: Nome de Exibição, Duração do Acesso (Minutos), Ferramenta, Validade (Dias)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.11. `CobrancaView`

- **Arquivo**: `src/components/admin/super-domains/financeiro/CobrancaView.tsx`
- **Linhas de Código**: 1100 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Gerar Acordo / Parcelamento"
- **Tabelas Supabase Acessadas**:
  - `system_settings [select]`
  - `cobrancas [select/query, realtime/query]`
  - `cobranca_historico [realtime/query]`
  - `cobranca_acordo_parcelas [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_baixar_cobranca_manual`
  - RPC: `gsa_admin_baixar_parcela_cobranca`
  - RPC: `gsa_admin_cancelar_acordo_cobranca`
  - RPC: `gsa_admin_gerar_acordo_cobranca`
  - RPC: `gsa_admin_protestar_cobranca`
  - RPC: `gsa_admin_registrar_cobranca_historico`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleGerarAcordo`, `handleBaixarParcela`, `handleBaixarCobrancaManual`, `handleRegistrarProtesto`, `handleSalvarHistorico`, `handleCancelarAcordo`
- **Campos e Formulários Detectados**: Quantidade de Parcelas, 1º Vencimento, Desconto Concedido no Acordo (R$), Observações / Termos do Acordo, Data do Pagamento, Forma de Pagamento, Valor Efetivamente Pago (R$), Nome do Cartório / Tabelionato, Data do Registro do Protesto, Tipo de Contato
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.12. `CreditDisputesAdminPanel`

- **Arquivo**: `src/components/admin/super-domains/financeiro/CreditDisputesAdminPanel.tsx`
- **Linhas de Código**: 226 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Fila de Contestações"
- **Tabelas Supabase Acessadas**:
  - `notificacoes [realtime/query]`
  - `loja_credito_movimentacoes [realtime/query]`
  - `faturas [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleStartReview`, `handleRequestDocuments`, `handleDecision`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 2.13. `CreditLimitCancellationsAdminPanel`

- **Arquivo**: `src/components/admin/super-domains/financeiro/CreditLimitCancellationsAdminPanel.tsx`
- **Linhas de Código**: 141 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Solicitações de Cancelamento"
- **Tabelas Supabase Acessadas**:
  - `notificacoes [realtime/query]`
  - `clientes [realtime/query]`
  - `loja_credito_movimentacoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleReview`, `handleDecision`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 2.14. `CreditWithdrawalsAdminPanel`

- **Arquivo**: `src/components/admin/super-domains/financeiro/CreditWithdrawalsAdminPanel.tsx`
- **Linhas de Código**: 222 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Solicitações de Saque do Crédito"
- **Tabelas Supabase Acessadas**:
  - `notificacoes [realtime/query]`
  - `clientes [realtime/query]`
  - `faturas [realtime/query]`
  - `loja_credito_movimentacoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleDecision`, `handleConfirmPix`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 2.15. `EmprestimosCreditoView`

- **Arquivo**: `src/components/admin/super-domains/financeiro/EmprestimosCreditoView.tsx`
- **Linhas de Código**: 872 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Montar Proposta de Empréstimo"
- **Tabelas Supabase Acessadas**:
  - `emprestimos [select/query, realtime/query]`
  - `loja_credito_solicitacoes [select/query, realtime/query]`
  - `emprestimo_parcelas [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_approve_preapproved_credit_100`
  - RPC: `gsa_admin_emprestimo_aprovar`
  - RPC: `gsa_admin_emprestimo_enviar_oferta_quitacao`
  - RPC: `gsa_admin_emprestimo_enviar_proposta`
  - RPC: `gsa_admin_preaprovar_credito`
  - RPC: `gsa_admin_recusar_credito`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleEnviarProposta`, `handleAprovarEmprestimoDireto`, `handleEnviarOfertaQuitacao`, `handlePreAprovarCredito`, `handleRecusarCredito`
- **Campos e Formulários Detectados**: Valor Aprovado (R$), Taxa de Juros Mensal (%), Prazo em Meses, Taxa de Abertura / TAC (R$), Mensagem Formal da Proposta, Limite Aprovado (R$)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.16. `FaturamentoView`

- **Arquivo**: `src/components/admin/super-domains/financeiro/FaturamentoView.tsx`
- **Linhas de Código**: 1351 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Baixa Administrativa Rápida"
- **Tabelas Supabase Acessadas**:
  - `faturas [select/query, realtime/query]`
  - `ordens_fiscais [insert, realtime/query]`
  - `clientes [select/query]`
  - `ordens_servico [select]`
  - `ordens_compra [select]`
  - `ordens_assinatura [select]`
  - `cobrancas [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `fn_marcar_faturas_vencidas`
  - RPC: `gsa_admin_baixar_fatura`
  - RPC: `gsa_admin_cancelar_fatura`
  - RPC: `gsa_admin_criar_fatura_manual`
  - RPC: `gsa_admin_enviar_fatura_cobranca`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleConfirmSettlement`, `handleEnviarParaCobranca`, `handleGerarOrdemFiscal`, `handleConfirmCancel`, `handleClientSelected`, `handleConfirmCreate`
- **Campos e Formulários Detectados**: Forma de Pagamento Confirmada, Data e Horário do Pagamento, Observações da Baixa / Comprovante, Cliente / Sacado, Categoria do Faturamento, Valor Total (R$), Data de Emissão, Data de Vencimento, Descrição / Histórico do Título, Motivo do Cancelamento
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 2.17. `FinanceiroSuperDomain`

- **Arquivo**: `src/components/admin/super-domains/financeiro/FinanceiroSuperDomain.tsx`
- **Linhas de Código**: 351 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Tabelas Supabase Acessadas**:
  - `faturas [select, realtime/query]`
  - `saques [select, realtime/query]`
  - `cobrancas [select, realtime/query]`
  - `ordens_fiscais [select, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 2.18. `FiscalView`

- **Arquivo**: `src/components/admin/super-domains/financeiro/FiscalView.tsx`
- **Linhas de Código**: 538 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Anexar Nota Fiscal"
- **Tabelas Supabase Acessadas**:
  - `ordens_fiscais [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_fiscal_update`
  - RPC: `gsa_admin_list_resource`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Campos e Formulários Detectados**: Arquivo XML da Nota Fiscal, Novo Status Fiscal, Justificativa / Observações
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 2.19. `FluxoCaixaView`

- **Arquivo**: `src/components/admin/super-domains/financeiro/FluxoCaixaView.tsx`
- **Linhas de Código**: 800 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Aprovar Saque e Baixar"
- **Tabelas Supabase Acessadas**:
  - `saques [select/query, realtime/query]`
  - `transferencias [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_processar_saque`
  - RPC: `gsa_admin_processar_transferencia`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: Data Efetiva do Pagamento, Motivo da Recusa, Motivo / Justificativa
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 2.20. `RentabilidadeReembolsosView`

- **Arquivo**: `src/components/admin/super-domains/financeiro/RentabilidadeReembolsosView.tsx`
- **Linhas de Código**: 439 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Resultado do Yield & Margem Líquida"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_list_store_refunds`
  - RPC: `gsa_admin_process_store_refund`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleConfirmRefundPayment`
- **Campos e Formulários Detectados**: Receita Bruta do Serviço (R$), Descontos (R$), Acréscimos (R$), Método do Reembolso, Referência do Estorno, Observações / Comprovante
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

---

### Squad 3 — Contratos, Jurídico & Grandes Contas

- **Total de Componentes**: 8
- **Volume de Código**: 5.087 linhas
- **Diretórios Base**: super-domains

#### Inventário Detalhado dos Componentes

##### 3.1. `AreaVipView`

- **Arquivo**: `src/components/admin/super-domains/contratos/AreaVipView.tsx`
- **Linhas de Código**: 479 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Quadro de Membros VIP & Fidelização Prime"
- **Tabelas Supabase Acessadas**:
  - `clientes [select/query, update, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleOpenMember`, `handleUpgradeTier`, `handleGrantVoucher`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 3.2. `AtendimentoTicketsView`

- **Arquivo**: `src/components/admin/super-domains/contratos/AtendimentoTicketsView.tsx`
- **Linhas de Código**: 524 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Fila Omnichannel de Suporte (SAC)"
- **Tabelas Supabase Acessadas**:
  - `tickets [select/query, update, realtime/query]`
  - `clientes [select/query]`
  - `ticket_mensagens [select/query, insert, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSendMessage`, `handleResolveTicket`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 3.3. `ContratosDocumentosView`

- **Arquivo**: `src/components/admin/super-domains/contratos/ContratosDocumentosView.tsx`
- **Linhas de Código**: 860 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Gerador de Novo Contrato"
- **Tabelas Supabase Acessadas**:
  - `contratos [select/query, update, insert, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleOpenContract`, `handleResendSignature`, `handleSignManually`, `handleCreateContract`
- **Campos e Formulários Detectados**: Título do Contrato, Modelo de Contrato, Nome do Contratante, CPF ou CNPJ do Contratante, Valor Mensal (R$), Início da Vigência, Fim da Vigência, Resumo das Cláusulas / Objeto
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 3.4. `ContratosSuperDomain`

- **Arquivo**: `src/components/admin/super-domains/contratos/ContratosSuperDomain.tsx`
- **Linhas de Código**: 233 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Contratos, Clientes & Jurídico"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleRefreshAll`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 3.5. `CrmClientesView`

- **Arquivo**: `src/components/admin/super-domains/contratos/CrmClientesView.tsx`
- **Linhas de Código**: 1574 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Novo Cadastro de Cliente"
- **Tabelas Supabase Acessadas**:
  - `clientes [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_ajustar_saldo_cliente`
  - RPC: `gsa_admin_alterar_status_cliente`
  - RPC: `gsa_admin_create_crm_client`
  - RPC: `gsa_admin_desbloquear_pin_cliente`
  - RPC: `gsa_admin_reset_actor_pin`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleOpenDossier`, `handleToggleStatus`, `handleAjustarSaldo`, `handleResetPin`, `handleDesbloquearPin`, `handleDeleteClient`, `handleBatchDeleteClients`, `handleCepLookup`
- **Campos e Formulários Detectados**: Operação, Valor (R$), Justificativa / Motivo do Ajuste, Tipo de Cadastro, Telefone / WhatsApp, E-mail, CEP, Número, Logradouro / Endereço
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 3.6. `GsaSaudeView`

- **Arquivo**: `src/components/admin/super-domains/contratos/GsaSaudeView.tsx`
- **Linhas de Código**: 392 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "GSA Saúde & Convênios Médicos"
- **Tabelas Supabase Acessadas**:
  - `saude_contratos [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleOpenSaude`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 3.7. `GsaSegurosView`

- **Arquivo**: `src/components/admin/super-domains/contratos/GsaSegurosView.tsx`
- **Linhas de Código**: 390 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "GSA Seguros & Regulação de Sinistros"
- **Tabelas Supabase Acessadas**:
  - `seguros_apolices [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleOpenSeguro`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 3.8. `HubEmpresasView`

- **Arquivo**: `src/components/admin/super-domains/contratos/HubEmpresasView.tsx`
- **Linhas de Código**: 635 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Cadastro de Empresa B2B Corporate"
- **Tabelas Supabase Acessadas**:
  - `clientes [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_criar_cliente`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleOpenEmpresa`, `handleCreateEmpresa`
- **Campos e Formulários Detectados**: Razão Social, Nome Fantasia, CNPJ, Responsável Legal, Telefone Corporativo, Condição de Pagamento, Limite de Crédito (R$)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

---

### Squad 4 — Pessoas, CRM, Cadastros & Parceiros

- **Total de Componentes**: 27
- **Volume de Código**: 23.579 linhas
- **Diretórios Base**: AffiliateAdminModule.tsx, CadastroModule.tsx, CareerVacanciesManager.tsx, CareersAdminModule.tsx, ClientesModule.tsx, FornecedoresModule.tsx, PartnersAdminModule.tsx, PrestadoresModule.tsx, clientes, prestadores, super-domains

#### Inventário Detalhado dos Componentes

##### 4.1. `AffiliateAdminModule`

- **Arquivo**: `src/components/admin/AffiliateAdminModule.tsx`
- **Linhas de Código**: 1671 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Programa de Afiliados GSA"
- **Tabelas Supabase Acessadas**:
  - `gsa_afiliados [realtime/query]`
  - `gsa_afiliado_programas [realtime/query]`
  - `gsa_afiliado_comissoes [realtime/query]`
  - `gsa_afiliado_saques [realtime/query]`
  - `gsa_afiliado_links [realtime/query]`
  - `indicacoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_adjust_affiliate_balance`
  - RPC: `gsa_admin_affiliate_snapshot`
  - RPC: `gsa_admin_decide_affiliate_payout`
  - RPC: `gsa_admin_release_affiliate_commissions`
  - RPC: `gsa_admin_set_affiliate_status`
  - RPC: `gsa_admin_update_affiliate_details`
  - RPC: `gsa_admin_update_affiliate_points_settings`
  - RPC: `gsa_admin_update_affiliate_program`
  - RPC: `gsa_admin_update_global_saque_minimo`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleReleaseCarencia`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.2. `CadastroModule`

- **Arquivo**: `src/components/admin/CadastroModule.tsx`
- **Linhas de Código**: 396 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{title}"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Navegação em Abas internas
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleTabClick`, `handleSubTabClick`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.3. `CareerVacanciesManager`

- **Arquivo**: `src/components/admin/CareerVacanciesManager.tsx`
- **Linhas de Código**: 117 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Publicação de oportunidades"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_list_career_vacancies`
  - RPC: `gsa_admin_upsert_career_vacancy`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.4. `CareersAdminModule`

- **Arquivo**: `src/components/admin/CareersAdminModule.tsx`
- **Linhas de Código**: 450 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Gestão de Candidaturas"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_get_career_application`
  - RPC: `gsa_admin_get_career_resume_reference`
  - RPC: `gsa_admin_list_career_applications`
  - RPC: `gsa_admin_update_career_application`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleUpdateStatus`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.5. `ClientesModule`

- **Arquivo**: `src/components/admin/ClientesModule.tsx`
- **Linhas de Código**: 3195 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{cliente.nome}"
- **Tabelas Supabase Acessadas**:
  - `clientes [select/query, delete, realtime/query]`
  - `faturas [select/query, delete, realtime/query]`
  - `orcamentos [select/query, select, delete]`
  - `saques [select/query, delete]`
  - `emprestimos [select/query, select, delete]`
  - `tickets [select/query, select, delete]`
  - `classificados_anuncios [select/query, delete]`
  - `loja_credito_solicitacoes [select/query, delete]`
  - `ticket_mensagens [delete]`
  - `orcamento_timeline [delete]`
  - `emprestimo_parcelas [delete]`
  - `ordens_servico [select, delete, select/query, realtime/query]`
  - `cliente_documentos [select, delete]`
  - `ordens_fiscais [select]`
  - `prestador_demandas [select]`
  - `notificacoes [delete]`
  - `indicacoes [select/query]`
  - `ordens_compra [select/query, realtime/query]`
  - `ordens_assinatura [select/query, realtime/query]`
  - `extrato_financeiro [select/query, realtime/query]`
  - `pontos_movimentacoes [select/query, realtime/query]`
  - `points_transactions [select/query, realtime/query]`
  - `cliente_notas_admin [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `delete_client_cascade`
  - RPC: `gsa_admin_ajustar_saldo_cliente`
  - RPC: `gsa_admin_alterar_status_cliente`
  - RPC: `gsa_admin_atualizar_dados_cliente`
  - RPC: `gsa_admin_atualizar_status_cliente`
  - RPC: `gsa_admin_baixar_fatura`
  - RPC: `gsa_admin_criar_cliente`
  - RPC: `gsa_admin_desbloquear_pin_cliente`
  - RPC: `gsa_admin_enviar_fatura_cobranca`
  - RPC: `gsa_admin_reset_actor_pin`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCreate`, `handleToggleStatus`, `handleDeletePendency`, `handleResolvePendency`, `handleDelete`, `handleManualPaymentFatura`, `handleEnviarParaCobrancaFatura`, `handleSaveNotaAdmin`
- **Campos e Formulários Detectados**: E-mail, Telefone, Data Cadastro, Observações, Nome / Razão Social, CPF / CNPJ, CEP, Logradouro, Número, Bairro
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.6. `FornecedoresModule`

- **Arquivo**: `src/components/admin/FornecedoresModule.tsx`
- **Linhas de Código**: 853 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Fornecedores e abastecimento"
- **Tabelas Supabase Acessadas**:
  - `fornecedores [realtime/query]`
  - `ordens_compra [realtime/query]`
  - `produto_fornecedor_config [realtime/query]`
  - `produtos [realtime/query]`
  - `fornecedor_produtos [realtime/query]`
  - `fornecedor_pedidos [realtime/query]`
  - `fornecedor_entregas [realtime/query]`
  - `fornecedor_documentos [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.7. `PartnersAdminModule`

- **Arquivo**: `src/components/admin/PartnersAdminModule.tsx`
- **Linhas de Código**: 455 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Parceiros"
- **Tabelas Supabase Acessadas**:
  - `parceiros [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.8. `PrestadoresModule`

- **Arquivo**: `src/components/admin/PrestadoresModule.tsx`
- **Linhas de Código**: 142 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Rede de Prestadores"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Navegação em Abas internas
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleMainTabClick`, `handleSubTabClick`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 4.9. `AdminClienteDocumentos`

- **Arquivo**: `src/components/admin/clientes/AdminClienteDocumentos.tsx`
- **Linhas de Código**: 587 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Aprovar"
- **Tabelas Supabase Acessadas**:
  - `cliente_documentos [select/query, insert, delete, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_registrar_pendencia_whatsapp`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleRequestDocument`, `handleAdminUpload`, `handleDelete`
- **Campos e Formulários Detectados**: Nome / Rótulo, Arquivos (Até 5), Motivo da Reprovação
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.10. `AdminPrestadorDocumentos`

- **Arquivo**: `src/components/admin/prestadores/AdminPrestadorDocumentos.tsx`
- **Linhas de Código**: 463 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Aprovar"
- **Tabelas Supabase Acessadas**:
  - `prestador_documentos [select/query, insert, update, delete, realtime/query]`
  - `documentos_prestador [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleRequestDocument`, `handleAdminUpload`, `handleDelete`
- **Campos e Formulários Detectados**: Nome/Rótulo, Categoria, Nome da Categoria Customizada, Arquivos (Até 5), Motivo da Reprovação
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.11. `AdminPrestadorPremios`

- **Arquivo**: `src/components/admin/prestadores/AdminPrestadorPremios.tsx`
- **Linhas de Código**: 248 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Excluir"
- **Tabelas Supabase Acessadas**:
  - `prestador_premios [select, insert, delete, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCreate`, `handleDelete`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.12. `AdminPrestadorPromocoes`

- **Arquivo**: `src/components/admin/prestadores/AdminPrestadorPromocoes.tsx`
- **Linhas de Código**: 387 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Excluir"
- **Tabelas Supabase Acessadas**:
  - `prestador_promocoes [select/query, insert, delete, realtime/query]`
  - `prestador_promocoes_ativacoes [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCreate`, `handleDelete`
- **Campos e Formulários Detectados**: Título da Campanha, Descrição, Regras e Termos, Data de Encerramento (Opcional)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.13. `AdminPrestadorVouchers`

- **Arquivo**: `src/components/admin/prestadores/AdminPrestadorVouchers.tsx`
- **Linhas de Código**: 241 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Confirmar Pagamento"
- **Tabelas Supabase Acessadas**:
  - `prestador_vouchers [select, insert, delete, update, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCreate`, `handleDelete`, `handlePagar`
- **Campos e Formulários Detectados**: Valor (R$), Motivo / Descrição
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.14. `PrestadoresCadastro`

- **Arquivo**: `src/components/admin/prestadores/PrestadoresCadastro.tsx`
- **Linhas de Código**: 1624 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Gestão de Prestadores"
- **Tabelas Supabase Acessadas**:
  - `prestadores [select/query, insert, realtime/query]`
  - `prestador_historico [insert]`
  - `prestador_demandas [select/query]`
  - `prestador_transacoes [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_reset_actor_pin`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleStatusChange`, `handleRegisterPrestador`, `handleUpdatePrestador`, `handleLancar`
- **Campos e Formulários Detectados**: Nome Fantasia / Razão Social, Documento (CPF/CNPJ), Nome do Responsável, E-mail, Telefone, CEP, Número, Área de Serviço, Observações, E-mail de Trabalho
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.15. `PrestadoresDemandas`

- **Arquivo**: `src/components/admin/prestadores/PrestadoresDemandas.tsx`
- **Linhas de Código**: 3015 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Gestão de Demandas"
- **Tabelas Supabase Acessadas**:
  - `clientes [select/query]`
  - `ordens_fiscais [insert]`
  - `ordens_servico [select/query, select, realtime/query]`
  - `prestador_suporte_demandas [select/query, realtime/query]`
  - `prestador_demandas [select/query, update, realtime/query]`
  - `prestadores [select/query, realtime/query]`
  - `colaboradores [select/query]`
  - `prestador_demandas_historico [select/query]`
  - `os_notas [insert]`
  - `faturas [select/query]`
  - `prestador_transacoes [select/query]`
  - `os_suporte_mensagens [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_cancelar_demanda`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleCreateDemanda`, `handleAssignPrestador`, `handleSendCounterProposal`, `handleAcceptCounterProposal`, `handleFinalizeDemanda`, `handleTransferDemanda`, `handleCancelDemanda`, `handleCancelDemandaWithReason`
- **Campos e Formulários Detectados**: Valor Proposto (R$), Motivo / Observação, Prestador de Serviço Selecionado, Prazo para Entrega, Título da Demanda, Descrição, Motivo do Cancelamento, Novo Prestador, Selecionar Colaborador
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.16. `PrestadoresFinanceiro`

- **Arquivo**: `src/components/admin/prestadores/PrestadoresFinanceiro.tsx`
- **Linhas de Código**: 701 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Solicitação de Saque"
- **Tabelas Supabase Acessadas**:
  - `prestador_saques [select/query, realtime/query]`
  - `prestadores [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_processar_saque_prestador`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleAprovarSaque`, `handleRejeitarSaque`
- **Campos e Formulários Detectados**: Data do Pagamento, Motivo da recusa
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.17. `AfiliadosSection`

- **Arquivo**: `src/components/admin/super-domains/pessoas/AfiliadosSection.tsx`
- **Linhas de Código**: 699 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Atualizar dados"
- **Tabelas Supabase Acessadas**:
  - `gsa_afiliados [realtime/query]`
  - `gsa_afiliado_cliques [realtime/query]`
  - `gsa_afiliado_conversoes [realtime/query]`
  - `gsa_afiliado_comissoes [realtime/query]`
  - `gsa_afiliado_saques [realtime/query]`
  - `gsa_afiliado_transferencias [realtime/query]`
  - `gsa_afiliado_pontos_eventos [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_adjust_affiliate_balance`
  - RPC: `gsa_admin_affiliate_snapshot`
  - RPC: `gsa_admin_decide_affiliate_payout`
  - RPC: `gsa_admin_release_affiliate_commissions`
  - RPC: `gsa_admin_set_affiliate_status`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleToggleAffiliateStatus`, `handleReleaseCommissions`, `handleDecidePayout`, `handleAdjustBalance`
- **Campos e Formulários Detectados**: Motivo / Justificativa do Ajuste
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.18. `FidelidadePromocoesSection`

- **Arquivo**: `src/components/admin/super-domains/pessoas/FidelidadePromocoesSection.tsx`
- **Linhas de Código**: 1578 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Copiar código"
- **Tabelas Supabase Acessadas**:
  - `cliente_premios [select/query, realtime/query]`
  - `vouchers [select/query, update, insert, delete, realtime/query]`
  - `cupons_loja [select/query, realtime/query]`
  - `loja_solicitacoes [select/query, realtime/query]`
  - `indicacoes [select/query, realtime/query]`
  - `clientes [select]`
  - `pontos_movimentacoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_adjust_points`
  - RPC: `gsa_admin_delete_store_coupon`
  - RPC: `gsa_admin_save_store_coupon`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCopy`, `handleOpenNewVoucher`, `handleOpenEditVoucher`, `handleSaveVoucher`, `handleToggleVoucherStatus`, `handleDeleteVoucher`, `handleOpenNewCoupon`, `handleOpenEditCoupon`
- **Campos e Formulários Detectados**: Nome / Identificação do Voucher, Data de Validade (opcional), Categoria, Status, Nome do Cupom, Categoria do Cupom, Tipo de Desconto, Tipo de Entrega, Limite de Usos Totais, Valor Mínimo Compra (R$)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.19. `FornecedoresSection`

- **Arquivo**: `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`
- **Linhas de Código**: 2052 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Atualizar dados"
- **Tabelas Supabase Acessadas**:
  - `parceiros [realtime/query]`
  - `parceiros_resgates [realtime/query]`
  - `fornecedores [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleOpenActivationForm`, `handleSaveActivationLink`, `handleResendActivationWhatsApp`, `handleExportRedemptionsCsv`, `handleCopyRedemptionCode`, `handleOpenSupplier`, `handleUpdateSupplierStatus`, `handleOpenNewPartner`
- **Campos e Formulários Detectados**: Categoria, WhatsApp de Atendimento, Status do Parceiro, CEP, Cidade / UF, Descrição Comercial, Código Fixo (opcional)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.20. `NovoPrestadorDrawer`

- **Arquivo**: `src/components/admin/super-domains/pessoas/NovoPrestadorDrawer.tsx`
- **Linhas de Código**: 326 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Credenciar Novo Prestador"
- **Tabelas Supabase Acessadas**:
  - `prestadores [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_create_provider`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: Tipo de Cadastro, E-mail Principal, Especialidade / Área de Serviço, CEP, Número / Complemento, Observações Administrativas
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.21. `PartnerRedemptionDetailModal`

- **Arquivo**: `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`
- **Linhas de Código**: 1414 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{resgate.nome_completo}"
- **Tabelas Supabase Acessadas**:
  - `parceiros_resgates_eventos [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCopy`, `handleApprove`, `handleReject`, `handleAdministrativeCancel`, `handleAdministrativeDelete`, `handleAppealDecision`, `handleSaveActivation`, `handleResendWhatsApp`
- **Campos e Formulários Detectados**: Fundamentação da decisão
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.22. `PayoutClearanceDrawer`

- **Arquivo**: `src/components/admin/super-domains/pessoas/PayoutClearanceDrawer.tsx`
- **Linhas de Código**: 597 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Mesa de Liquidação de Repasses"
- **Tabelas Supabase Acessadas**:
  - `prestador_saques [realtime/query]`
  - `saques [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_processar_saque`
  - RPC: `gsa_admin_processar_saque_prestador`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleCopyPix`, `handleExecuteApproval`, `handleExecuteRejection`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.23. `PessoasSuperDomain`

- **Arquivo**: `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx`
- **Linhas de Código**: 310 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Pessoas, RH & Prestadores"
- **Tabelas Supabase Acessadas**:
  - `prestadores [select/query, realtime/query]`
  - `prestador_saques [select/query, realtime/query]`
  - `saques [select/query, realtime/query]`
  - `gsa_afiliados [select/query, realtime/query]`
  - `fornecedores [realtime/query]`
  - `gsa_careers_applications [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 4.24. `PrestadorDetailDrawer`

- **Arquivo**: `src/components/admin/super-domains/pessoas/PrestadorDetailDrawer.tsx`
- **Linhas de Código**: 701 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Tabelas Supabase Acessadas**:
  - `prestador_demandas [select/query, realtime/query]`
  - `prestadores [select/query, realtime/query]`
  - `prestador_historico [insert]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_reset_actor_pin`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSaveProfile`, `handleChangeStatus`, `handleResetPin`, `handleDeletePrestador`
- **Campos e Formulários Detectados**: Nome / Razão Social, Nome do Responsável, E-mail, Telefone, Área de Atuação, CEP, Observações
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.25. `PrestadoresSection`

- **Arquivo**: `src/components/admin/super-domains/pessoas/PrestadoresSection.tsx`
- **Linhas de Código**: 276 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Prestador Homologado"
- **Tabelas Supabase Acessadas**:
  - `prestadores [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleRowClick`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.26. `SaquesRepassesSection`

- **Arquivo**: `src/components/admin/super-domains/pessoas/SaquesRepassesSection.tsx`
- **Linhas de Código**: 510 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Copiar chave PIX"
- **Tabelas Supabase Acessadas**:
  - `prestador_saques [select/query, realtime/query]`
  - `saques [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_processar_saque`
  - RPC: `gsa_admin_processar_saque_prestador`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCopyPix`, `handleRowClick`, `handleBatchApprove`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 4.27. `TrabalheConoscoSection`

- **Arquivo**: `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx`
- **Linhas de Código**: 571 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Atualizar candidaturas"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_get_career_application`
  - RPC: `gsa_admin_get_career_resume_reference`
  - RPC: `gsa_admin_list_career_applications`
  - RPC: `gsa_admin_update_career_application`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleOpenApplication`, `handleUpdateStatus`, `handleDownloadResume`
- **Campos e Formulários Detectados**: Notas Internas da Avaliação, Data & Horário da Entrevista, Local ou Link da Videochamada
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

---

### Squad 5 — Operações, Demandas & Atendimento

- **Total de Componentes**: 23
- **Volume de Código**: 13.445 linhas
- **Diretórios Base**: DemandasColaboradorModule.tsx, OrcamentosModule.tsx, OrdensAssinaturaModule.tsx, OrdensCompraModule.tsx, OrdensServicoModule.tsx, ShopeeOperationsModule.tsx, TicketsModule.tsx, VendasModule.tsx, demandas, super-domains

#### Inventário Detalhado dos Componentes

##### 5.1. `DemandasColaboradorModule`

- **Arquivo**: `src/components/admin/DemandasColaboradorModule.tsx`
- **Linhas de Código**: 303 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Gestão Interna de Demandas"
- **Tabelas Supabase Acessadas**:
  - `prestador_demandas [select/query, realtime/query]`
  - `colaboradores [select, realtime/query]`
  - `prestadores [select, realtime/query]`
  - `prestador_demandas_historico [select/query, realtime/query]`
  - `demanda_comentarios [realtime/query]`
  - `os_notas [realtime/query]`
  - `os_suporte_mensagens [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_collaborator_demand_history`
  - RPC: `gsa_collaborator_list_demands`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 5.2. `OrcamentosModule`

- **Arquivo**: `src/components/admin/OrcamentosModule.tsx`
- **Linhas de Código**: 2740 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Etapa 1: Cliente"
- **Tabelas Supabase Acessadas**:
  - `orcamentos [select/query, insert, realtime/query]`
  - `clientes [select/query, select]`
  - `indicacoes [select/query]`
  - `system_settings [select/query]`
  - `cliente_promocoes [select/query]`
  - `servicos [select]`
  - `emprestimos [insert]`
  - `promocoes [select]`
  - `produtos [select]`
  - `assinaturas [select]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_approve_budget`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleApproveNegotiation`, `handleRenegotiate`, `handleApprove`, `handleRequestDocuments`, `handleUpdateStatus`, `handleUpdateDeliveryStatus`, `handleSaveRevision`, `handleCancel`
- **Campos e Formulários Detectados**: Documentos Necessários, Desconto Máximo Final (%), Selecione o Cliente, Data de Emissão, Categoria, Observações, Código Promoção, Desconto da Promoção (Valor), Quantidade, Valor Adicional
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 5.3. `OrdensAssinaturaModule`

- **Arquivo**: `src/components/admin/OrdensAssinaturaModule.tsx`
- **Linhas de Código**: 786 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{ordem.nome_assinatura_contratada ?? ordem.assinaturas?.nome}"
- **Tabelas Supabase Acessadas**:
  - `ordens_assinatura [select/query, realtime/query]`
  - `assinaturas [realtime/query]`
  - `faturas [realtime/query]`
  - `orcamentos [realtime/query]`
  - `clientes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_cancel_subscription`
  - RPC: `gsa_admin_extend_subscription`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleDeleteAssinaturaCascade`, `handleUpdateStatus`, `handleProrrogarAssinatura`, `handleCancelarAssinatura`
- **Campos e Formulários Detectados**: Meses, Data de Cancelamento, Motivo da Exclusão (Auditoria)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.4. `OrdensCompraModule`

- **Arquivo**: `src/components/admin/OrdensCompraModule.tsx`
- **Linhas de Código**: 1169 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{ordem.produtos?.nome || 'Produto da Loja'}"
- **Tabelas Supabase Acessadas**:
  - `ordens_compra [select, select/query, realtime/query]`
  - `produtos [select, realtime/query]`
  - `faturas [select/query, realtime/query]`
  - `cupons_loja [select, realtime/query]`
  - `ordens_assinatura [select/query]`
  - `points_transactions [select/query]`
  - `pontos_movimentacoes [select/query]`
  - `extrato_financeiro [select/query]`
  - `orcamentos [realtime/query]`
  - `clientes [realtime/query]`
  - `pagamentos [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_update_store_order_notes`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleUpdateStatus`, `handleCancelAndRefundConfirm`, `handleSaveObservacoes`, `handleProductClick`
- **Campos e Formulários Detectados**: Motivo do Cancelamento, Mudar Status de Entrega do Cliente
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 5.5. `OrdensServicoModule`

- **Arquivo**: `src/components/admin/OrdensServicoModule.tsx`
- **Linhas de Código**: 1058 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{(os as any).clientes?.nome}"
- **Tabelas Supabase Acessadas**:
  - `ordens_servico [select/query, realtime/query]`
  - `prestador_demandas [select/query]`
  - `clientes [select]`
  - `os_notas [select, delete]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_finalize_service_order`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleCancelClick`, `handleAddNota`, `handleDeleteNota`, `handleRequestDocumentsOS`
- **Campos e Formulários Detectados**: Motivo do Cancelamento, Contratante, Escopo Contratado, Detalhamento Técnico, Documentos / Entregáveis
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 5.6. `ShopeeOperationsModule`

- **Arquivo**: `src/components/admin/ShopeeOperationsModule.tsx`
- **Linhas de Código**: 305 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Central Shopee"
- **Tabelas Supabase Acessadas**:
  - `shopee_fulfillment_jobs [realtime/query]`
  - `shopee_automation_workers [realtime/query]`
  - `ordens_compra [realtime/query]`
  - `orcamentos [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `onlineWorkers`, `online`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.7. `TicketsModule`

- **Arquivo**: `src/components/admin/TicketsModule.tsx`
- **Linhas de Código**: 793 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Central de Atendimento"
- **Tabelas Supabase Acessadas**:
  - `clientes [select/query]`
  - `prestadores [select/query]`
  - `ticket_mensagens [select/query, insert, realtime/query]`
  - `tickets [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleSendMessage`, `handleUpdateStatus`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.8. `VendasModule`

- **Arquivo**: `src/components/admin/VendasModule.tsx`
- **Linhas de Código**: 355 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{title}"
- **Tabelas Supabase Acessadas**:
  - `orcamentos [realtime/query]`
  - `ordens_servico [realtime/query]`
  - `ordens_compra [realtime/query]`
  - `ordens_assinatura [realtime/query]`
  - `prestador_demandas [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleTabClick`, `handleSubTabClick`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.9. `DemandasComentarios`

- **Arquivo**: `src/components/admin/demandas/DemandasComentarios.tsx`
- **Linhas de Código**: 250 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Tabelas Supabase Acessadas**:
  - `demanda_comentarios [select/query, realtime/query]`
  - `prestador_demandas [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_add_demand_comment`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.10. `DemandasDashboard`

- **Arquivo**: `src/components/admin/demandas/DemandasDashboard.tsx`
- **Linhas de Código**: 192 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "📊 Performance da Equipe"
- **Tabelas Supabase Acessadas**:
  - `prestador_demandas [select, realtime/query]`
  - `colaboradores [select, realtime/query]`
  - `prestadores [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.11. `DemandasDetalhesModal`

- **Arquivo**: `src/components/admin/demandas/DemandasDetalhesModal.tsx`
- **Linhas de Código**: 1690 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{demanda.titulo || demanda.descricao?.slice(0, 60) || `#${demanda.id.slice(0, 8).toUpperCase()}`}"
- **Tabelas Supabase Acessadas**:
  - `prestador_demandas [select/query, realtime/query]`
  - `os_suporte_mensagens [select/query, realtime/query]`
  - `prestador_demandas_historico [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_add_os_note`
  - RPC: `gsa_admin_cancelar_demanda`
  - RPC: `gsa_admin_send_os_support_message`
  - RPC: `gsa_admin_transition_provider_demand`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleStartService`, `handleAceitarDemanda`, `handleRecusarDemanda`, `handleAssumeAndStart`, `handleAceitarProposta`, `handleContrapropostaAdmin`, `handleRecusarContrapropostaAdmin`, `handleCancelDemanda`
- **Campos e Formulários Detectados**: Novo Valor (R$), Justificativa (Opcional), 💰 Valor Proposto (R$), ⏳ Prazo de Entrega
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 5.12. `DemandasKanban`

- **Arquivo**: `src/components/admin/demandas/DemandasKanban.tsx`
- **Linhas de Código**: 146 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 5.13. `DemandasTabela`

- **Arquivo**: `src/components/admin/demandas/DemandasTabela.tsx`
- **Linhas de Código**: 332 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.14. `NovaDemandaModal`

- **Arquivo**: `src/components/admin/demandas/NovaDemandaModal.tsx`
- **Linhas de Código**: 490 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Nova Demanda Interna"
- **Tabelas Supabase Acessadas**:
  - `ordens_servico [select, realtime/query]`
  - `colaboradores [select, realtime/query]`
  - `prestadores [select, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_create_provider_demand`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Campos e Formulários Detectados**: Título da Demanda, Descrição / Briefing, Instruções Detalhadas, OS Vinculada (Opcional), Prioridade, Prazo Limite, Atribuir Para, Selecionar Colaborador, Selecionar Prestador, Valor Proposto (R$)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.15. `AutomacaoOperacoesSubDomain`

- **Arquivo**: `src/components/admin/super-domains/operacoes/AutomacaoOperacoesSubDomain.tsx`
- **Linhas de Código**: 58 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 5.16. `CatalogoSubDomain`

- **Arquivo**: `src/components/admin/super-domains/operacoes/CatalogoSubDomain.tsx`
- **Linhas de Código**: 138 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 5.17. `ComprasAssinaturasWorkstation`

- **Arquivo**: `src/components/admin/super-domains/operacoes/ComprasAssinaturasWorkstation.tsx`
- **Linhas de Código**: 73 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 5.18. `DemandasWorkstation`

- **Arquivo**: `src/components/admin/super-domains/operacoes/DemandasWorkstation.tsx`
- **Linhas de Código**: 33 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 5.19. `MidiaOperacoesSubDomain`

- **Arquivo**: `src/components/admin/super-domains/operacoes/MidiaOperacoesSubDomain.tsx`
- **Linhas de Código**: 107 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 5.20. `OperacoesSuperDomain`

- **Arquivo**: `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx`
- **Linhas de Código**: 345 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{title}"
- **Tabelas Supabase Acessadas**:
  - `orcamentos [select, realtime/query]`
  - `ordens_servico [select, realtime/query]`
  - `prestador_demandas [select, realtime/query]`
  - `ordens_compra [select, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 5.21. `OrcamentosWorkstation`

- **Arquivo**: `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx`
- **Linhas de Código**: 1165 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Orçamentos"
- **Tabelas Supabase Acessadas**:
  - `orcamentos [select/query, realtime/query]`
  - `ordens_servico [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_approve_budget`
  - RPC: `gsa_admin_patch_marketplace_budget`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleApproveStandard`, `handleApproveNegotiation`, `handleRenegotiateSubmit`, `handlePrintPDF`, `handleDeleteBudget`, `handleBatchDelete`
- **Campos e Formulários Detectados**: Desconto Ofertado (%), Motivo da Exclusão (Auditoria)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 5.22. `OrdensServicoWorkstation`

- **Arquivo**: `src/components/admin/super-domains/operacoes/OrdensServicoWorkstation.tsx`
- **Linhas de Código**: 900 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Ordens de Serviço"
- **Tabelas Supabase Acessadas**:
  - `ordens_servico [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_cancelar_os`
  - RPC: `gsa_admin_concluir_os_e_faturar`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleFinalizeOS`, `handleCancelOS`, `handleDeleteOS`, `handleBatchDeleteOS`, `handlePrintPDF`
- **Campos e Formulários Detectados**: Motivo da Exclusão (Auditoria)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 5.23. `ViagensSubDomain`

- **Arquivo**: `src/components/admin/super-domains/operacoes/ViagensSubDomain.tsx`
- **Linhas de Código**: 17 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

---

### Squad 6 — E-commerce, Catálogo, Loja & Fidelidade

- **Total de Componentes**: 27
- **Volume de Código**: 15.034 linhas
- **Diretórios Base**: AreaVIPModule.tsx, AssinaturasModule.tsx, ClassifiedsModule.tsx, CuponsLojaModule.tsx, IndicacoesModule.tsx, LojaCategoriasModule.tsx, LojaTrocasModule.tsx, PremiosModule.tsx, ProdutosModule.tsx, PromoAnalytics.tsx, PromoDetalhesModal.tsx, PromocaoQuantidadeForm.tsx, PromocaoQuantidadeModule.tsx, PromocoesModule.tsx, ServicePackagesModule.tsx, ServicosModule.tsx, VouchersModule.tsx, ecommerce, products

#### Inventário Detalhado dos Componentes

##### 6.1. `AreaVIPModule`

- **Arquivo**: `src/components/admin/AreaVIPModule.tsx`
- **Linhas de Código**: 1337 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Ecossistema VIP"
- **Tabelas Supabase Acessadas**:
  - `system_settings [select/query, realtime/query]`
  - `client_levels [select/query, realtime/query]`
  - `clientes [select/query, select, realtime/query]`
  - `level_history [insert]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_upsert_settings`
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleToggleAtivo`, `handleToggleOculto`, `handleManualLevelUpdate`, `handleSaveLevel`
- **Campos e Formulários Detectados**: Nome do Nível, Pontos Necessários para Alcance, Mult. Pontos, Taxa Fin. (Saque/Transf %), Desconto VIP Loja/Serviços (%), Valor da Compra do Nível (R$), Cor do Nível, Cor do Texto, Estilo Visual
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 6.2. `AssinaturasModule`

- **Arquivo**: `src/components/admin/AssinaturasModule.tsx`
- **Linhas de Código**: 891 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{assinatura.nome}"
- **Tabelas Supabase Acessadas**:
  - `loja_categorias [select, realtime/query]`
  - `assinaturas [select/query, update, realtime/query]`
  - `ordens_assinatura [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleImageUpload`, `handleCreate`, `handleUpdate`, `handleGalleryUpload`
- **Campos e Formulários Detectados**: Tipo de Cliente, Categoria, Nome da Assinatura, Valor (R$), Descrição
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 6.3. `ClassifiedsModule`

- **Arquivo**: `src/components/admin/ClassifiedsModule.tsx`
- **Linhas de Código**: 358 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Gestão de Classificados"
- **Tabelas Supabase Acessadas**:
  - `classificados_midias [select/query, realtime/query]`
  - `classificados_anuncios [realtime/query]`
  - `classificados_propostas [realtime/query]`
  - `classificados_mensagens [realtime/query]`
  - `classificados_transacoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_classified_action`
  - RPC: `gsa_admin_list_resource`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.4. `CuponsLojaModule`

- **Arquivo**: `src/components/admin/CuponsLojaModule.tsx`
- **Linhas de Código**: 752 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{cupom.nome_cupom}"
- **Tabelas Supabase Acessadas**:
  - `clientes [select]`
  - `produtos [select]`
  - `cupons_loja [select, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_delete_store_coupon`
  - RPC: `gsa_admin_save_store_coupon`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSaveCupom`, `handleCreate`, `handleInativar`, `handleReativar`, `handleDelete`
- **Campos e Formulários Detectados**: Nome do Cupom, Código, Categoria, Tipo de Benefício de Entrega, Valor Mínimo da Compra (R$), Taxa de Entrega Fixa (R$), Limite de Usos Globais, Usos por Cliente, Data de Validade (Opcional), Restringir a Cliente Específico
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.5. `IndicacoesModule`

- **Arquivo**: `src/components/admin/IndicacoesModule.tsx`
- **Linhas de Código**: 641 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{ind.indicado_nome || ind.whatsapp_indicado}"
- **Tabelas Supabase Acessadas**:
  - `clientes [select]`
  - `indicacoes [select/query, insert, realtime/query]`
  - `vouchers [insert]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCreateIndicacao`, `handleUpdateStatus`
- **Campos e Formulários Detectados**: Quem está indicando?, Nome do Amigo (Indicado), WhatsApp do Amigo, Data da Indicação
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.6. `LojaCategoriasModule`

- **Arquivo**: `src/components/admin/LojaCategoriasModule.tsx`
- **Linhas de Código**: 312 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Nenhuma categoria encontrada"
- **Tabelas Supabase Acessadas**:
  - `loja_categorias [select/query, delete, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleNomeChange`, `handleDelete`
- **Campos e Formulários Detectados**: Nome da Categoria, Tipo de Item, Status
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.7. `LojaTrocasModule`

- **Arquivo**: `src/components/admin/LojaTrocasModule.tsx`
- **Linhas de Código**: 795 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{solicitacao.tipo}"
- **Tabelas Supabase Acessadas**:
  - `loja_solicitacoes [select, update, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_atualizar_solicitacao_loja`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleUpdateStatus`, `handleUpdateAdvancedStatus`
- **Campos e Formulários Detectados**: Notas de Resolução, Endereço de Recebimento, Data & Hora do Agendamento, Código de Rastreio do Novo Produto
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.8. `PremiosModule`

- **Arquivo**: `src/components/admin/PremiosModule.tsx`
- **Linhas de Código**: 865 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Nenhum prêmio encontrado"
- **Tabelas Supabase Acessadas**:
  - `cliente_premios [select/query, realtime/query]`
  - `clientes [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleCreatePremio`, `handleCancelPremio`, `handleEnviarInstrucoes`
- **Campos e Formulários Detectados**: Modalidade de Entrega, Instruções Passo a Passo, Selecionar Cliente Beneficiário, Título do Prêmio, Categoria do Benefício, Descrição do Prêmio, Prazo de Validade para Resgate, Justificativa do Cancelamento
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 6.9. `ProdutosModule`

- **Arquivo**: `src/components/admin/ProdutosModule.tsx`
- **Linhas de Código**: 2954 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{produto.nome}"
- **Tabelas Supabase Acessadas**:
  - `loja_categorias [select, realtime/query]`
  - `produtos [select/query, realtime/query]`
  - `loja_estoque_historico [select/query, realtime/query]`
  - `produto_fornecedor_config [realtime/query]`
  - `produto_variantes [realtime/query]`
  - `produto_variacao_grupos [realtime/query]`
  - `produto_variacao_opcoes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_check_product_barcode`
  - RPC: `gsa_admin_delete_products_by_filter`
  - RPC: `gsa_admin_patch_marketplace_product`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleSelectAll`, `handleImageUpload`, `handleCreate`, `handleUpdate`, `handleBulkDelete`, `handleBarcodeChange`, `handleAnalyzeUrl`, `handleApplyImport`
- **Campos e Formulários Detectados**: Data Final da Promoção, Unidades com desconto, Tipo de Cliente, Categoria, Nome do Produto, Código de Barras, Origem do produto, Nome do fornecedor ou site, Link do produto no fornecedor, Telefone / WhatsApp (Opcional)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 6.10. `PromoAnalytics`

- **Arquivo**: `src/components/admin/PromoAnalytics.tsx`
- **Linhas de Código**: 157 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "{formatCurrency(stats.totalEconomia)}"
- **Tabelas Supabase Acessadas**:
  - `promocoes_quantidade_uso [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 6.11. `PromoDetalhesModal`

- **Arquivo**: `src/components/admin/PromoDetalhesModal.tsx`
- **Linhas de Código**: 316 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{promo.titulo}"
- **Tabelas Supabase Acessadas**:
  - `cliente_promocoes [select/query]`
  - `orcamentos [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.12. `PromocaoQuantidadeForm`

- **Arquivo**: `src/components/admin/PromocaoQuantidadeForm.tsx`
- **Linhas de Código**: 470 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "1. Dados Básicos"
- **Tabelas Supabase Acessadas**:
  - `produtos [select]`
  - `loja_categorias [select]`
  - `promocoes_quantidade [update, insert]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleToggleStatus`
- **Campos e Formulários Detectados**: Nome da Promoção, Descrição Interna / Regras, Escopo do Gatilho, Quantidade Mínima, Selecione o Produto Gatilho, Selecione a Categoria Gatilho, Tipo de Recompensa, Quantidade do Brinde, Selecione o Produto Brinde, Tipo de Desconto
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.13. `PromocaoQuantidadeModule`

- **Arquivo**: `src/components/admin/PromocaoQuantidadeModule.tsx`
- **Linhas de Código**: 191 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{promo.nome}"
- **Tabelas Supabase Acessadas**:
  - `promocoes_quantidade [delete, select, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleDeletePromo`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.14. `PromocoesModule`

- **Arquivo**: `src/components/admin/PromocoesModule.tsx`
- **Linhas de Código**: 563 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{promo.titulo}"
- **Tabelas Supabase Acessadas**:
  - `promocoes [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSuspender`, `handleDelete`
- **Campos e Formulários Detectados**: Título da Promoção, Tipo de Promoção, Descrição, Oferece desconto automático?, Início da Divulgação, Fim da Divulgação, Prazo de Validade
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.15. `ServicePackagesModule`

- **Arquivo**: `src/components/admin/ServicePackagesModule.tsx`
- **Linhas de Código**: 258 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Nenhum pacote {status === 'ativo' ? 'ativo' : 'inativo'}"
- **Tabelas Supabase Acessadas**:
  - `servicos [realtime/query]`
  - `servicos_pacotes [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.16. `ServicosModule`

- **Arquivo**: `src/components/admin/ServicosModule.tsx`
- **Linhas de Código**: 910 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{servico.nome}"
- **Tabelas Supabase Acessadas**:
  - `loja_categorias [select, realtime/query]`
  - `servicos [select/query, realtime/query]`
  - `catalog_services [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_service_mutation`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleImageUpload`, `handleCreate`, `handleUpdate`, `handleGalleryUpload`
- **Campos e Formulários Detectados**: Tipo de Cliente, Nome do Serviço, Valor (R$), Descrição, Subtítulo no catálogo, Ordem, Categoria
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 6.17. `VouchersModule`

- **Arquivo**: `src/components/admin/VouchersModule.tsx`
- **Linhas de Código**: 805 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{voucher.tipo === 'porcentagem' ? `${voucher.valor}% OFF` : formatCurrency(voucher.valor)}"
- **Tabelas Supabase Acessadas**:
  - `pagamentos [select/query]`
  - `extrato_financeiro [select/query]`
  - `vouchers [select/query, insert, delete, realtime/query]`
  - `clientes [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleOpenDetails`, `handleCreate`, `handleDeleteVoucher`, `handleCancelClick`
- **Campos e Formulários Detectados**: Motivo do Cancelamento, Nome do Voucher, Categoria do Voucher, Alcance do Voucher, Tipo de Desconto, Selecionar Cliente, Limite de Usos, Validade (Opcional)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 6.18. `EcommerceAnalytics`

- **Arquivo**: `src/components/admin/ecommerce/EcommerceAnalytics.tsx`
- **Linhas de Código**: 123 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Desempenho de Vendas vs Cliques"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 6.19. `PricingPanel`

- **Arquivo**: `src/components/admin/ecommerce/PricingPanel.tsx`
- **Linhas de Código**: 240 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Tabelas Supabase Acessadas**:
  - `pricing_configs [select, upsert]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleConfigChange`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.20. `BarcodeScannerModal`

- **Arquivo**: `src/components/admin/products/BarcodeScannerModal.tsx`
- **Linhas de Código**: 561 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Conexão Insegura"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleValidDetection`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.21. `BulkProductImportModal`

- **Arquivo**: `src/components/admin/products/BulkProductImportModal.tsx`
- **Linhas de Código**: 593 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Analisando Produtos..."
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_import_products_batch_v2`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleSourceSelected`, `handleUrlAnalyze`, `handleCandidatesReady`, `handleSupplierConfigConfirm`, `handleToggleSelectAll`, `handleToggleSelect`, `handleContinueFromSelection`, `handleUpdateCandidate`
- **Campos e Formulários Detectados**: Categoria Padrão, Público, Margem de Lucro Padrão (%), Visível na vitrine da loja, Ativar Controle de Estoque, Qtd. Inicial, Custo Base ({c.moeda}), Margem (%), Valor Final, Categoria
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.22. `ExcelImportSource`

- **Arquivo**: `src/components/admin/products/import/ExcelImportSource.tsx`
- **Linhas de Código**: 235 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Mapeamento de Colunas"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleFileChange`, `handleProcess`
- **Campos e Formulários Detectados**: Selecionar Arquivo, Planilha, Linha de Cabeçalho (1-indexado)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.23. `ImportSourceSelector`

- **Arquivo**: `src/components/admin/products/import/ImportSourceSelector.tsx`
- **Linhas de Código**: 87 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Escolha a origem dos produtos"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 6.24. `ImportSupplierMode`

- **Arquivo**: `src/components/admin/products/import/ImportSupplierMode.tsx`
- **Linhas de Código**: 151 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Como estes produtos serão fornecidos?"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleConfirm`
- **Campos e Formulários Detectados**: Nome do Fornecedor, Nome da Loja, Cidade, Telefone
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 6.25. `MediaImportSource`

- **Arquivo**: `src/components/admin/products/import/MediaImportSource.tsx`
- **Linhas de Código**: 271 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - Edge Function: `gsa-product-import`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleFileChange`
- **Campos e Formulários Detectados**: Selecionar {type.toUpperCase()}
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 6.26. `TextImportSource`

- **Arquivo**: `src/components/admin/products/import/TextImportSource.tsx`
- **Linhas de Código**: 89 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleFileChange`
- **Campos e Formulários Detectados**: Selecionar Arquivo de Texto
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 6.27. `UrlImportSource`

- **Arquivo**: `src/components/admin/products/import/UrlImportSource.tsx`
- **Linhas de Código**: 109 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: URL da Página/Lista de Produtos, Nome do Fornecedor, Telefone, Observações
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

---

### Squad 7 — Mídia, GSA TV & Publicidade

- **Total de Componentes**: 23
- **Volume de Código**: 10.004 linhas
- **Diretórios Base**: AdvertisingAdminModule.tsx, GsaTvControlRoom.tsx, GsaTvGraphics.tsx, GsaTvLiveConsole.tsx, GsaTvLiveSources.tsx, GsaTvModule.tsx, GsaTvRights.tsx, ScrapingAdminModule.tsx, ScrapingExecutionMonitorModal.tsx, SiteCampaignAdminModule.tsx, SiteCampaignAdminPage.tsx, SiteCampaignDeletionPanel.tsx, SiteCampaignPermissionMatrix.tsx, gsa-tv

#### Inventário Detalhado dos Componentes

##### 7.1. `AdvertisingAdminModule`

- **Arquivo**: `src/components/admin/AdvertisingAdminModule.tsx`
- **Linhas de Código**: 380 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "GSA Anúncios"
- **Tabelas Supabase Acessadas**:
  - `gsa_ad_requests [realtime/query]`
  - `gsa_ad_proposals [realtime/query]`
  - `gsa_ad_campaigns [realtime/query]`
  - `gsa_ad_creatives [realtime/query]`
  - `gsa_ad_payments [realtime/query]`
  - `gsa_ad_placements [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_advertising_overview`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 7.2. `GsaTvControlRoom`

- **Arquivo**: `src/components/admin/GsaTvControlRoom.tsx`
- **Linhas de Código**: 90 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "As-run recente"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `onAir`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 7.3. `GsaTvGraphics`

- **Arquivo**: `src/components/admin/GsaTvGraphics.tsx`
- **Linhas de Código**: 27 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Tela de emergência"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 7.4. `GsaTvLiveConsole`

- **Arquivo**: `src/components/admin/GsaTvLiveConsole.tsx`
- **Linhas de Código**: 254 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Controle mestre da GSA TV"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: Mídia aprovada, Fonte conectada
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 7.5. `GsaTvLiveSources`

- **Arquivo**: `src/components/admin/GsaTvLiveSources.tsx`
- **Linhas de Código**: 23 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Fontes cadastradas"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 7.6. `GsaTvModule`

- **Arquivo**: `src/components/admin/GsaTvModule.tsx`
- **Linhas de Código**: 433 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "GSA TV — Central Operacional"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_gsa_tv_mutate`
  - RPC: `gsa_admin_gsa_tv_snapshot`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Navegação em Abas internas
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `onAir`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 7.7. `GsaTvRights`

- **Arquivo**: `src/components/admin/GsaTvRights.tsx`
- **Linhas de Código**: 227 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Dossiês de direitos"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 7.8. `ScrapingAdminModule`

- **Arquivo**: `src/components/admin/ScrapingAdminModule.tsx`
- **Linhas de Código**: 998 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Automações N8N (Scraping)"
- **Tabelas Supabase Acessadas**:
  - `system_settings [select/query]`
  - `automacao_scraping_configs [select, select/query, delete, realtime/query]`
  - `loja_categorias [select]`
  - `viagens_categorias [select]`
  - `automacao_scraping_logs [insert]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_save_scraping_config`
  - RPC: `gsa_admin_trigger_scraping_now`
  - Edge Function: `gsa-trigger-webhook`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: Nome da Automação, Módulo Destino, Margem de Lucro (%), URL Alvo (Feed ou Fornecedor), Modo de Categoria, Categoria Destino, Modo de Limite, Quantidade Máxima de Produtos, 💰 Preço Mínimo (R$), 💰 Preço Máximo (R$)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 7.9. `ScrapingExecutionMonitorModal`

- **Arquivo**: `src/components/admin/ScrapingExecutionMonitorModal.tsx`
- **Linhas de Código**: 353 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "{automacao.nome}"
- **Tabelas Supabase Acessadas**:
  - `automacao_scraping_logs [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 7.10. `SiteCampaignAdminModule`

- **Arquivo**: `src/components/admin/SiteCampaignAdminModule.tsx`
- **Linhas de Código**: 247 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{value.title || 'Título da campanha'}"
- **Tabelas Supabase Acessadas**:
  - `system_settings [realtime/query]`
  - `site_campaigns [realtime/query]`
  - `site_campaign_events [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_delete_site_campaign`
  - RPC: `gsa_admin_duplicate_site_campaign`
  - RPC: `gsa_admin_set_site_campaign_status`
  - RPC: `gsa_admin_site_campaign_my_permissions`
  - RPC: `gsa_admin_site_campaigns_overview`
  - RPC: `gsa_admin_upsert_site_campaign`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 7.11. `SiteCampaignAdminPage`

- **Arquivo**: `src/components/admin/SiteCampaignAdminPage.tsx`
- **Linhas de Código**: 17 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 7.12. `SiteCampaignDeletionPanel`

- **Arquivo**: `src/components/admin/SiteCampaignDeletionPanel.tsx`
- **Linhas de Código**: 111 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Rascunhos e campanhas arquivadas"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_delete_site_campaign`
  - RPC: `gsa_admin_site_campaign_my_permissions`
  - RPC: `gsa_admin_site_campaigns_overview`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 7.13. `SiteCampaignPermissionMatrix`

- **Arquivo**: `src/components/admin/SiteCampaignPermissionMatrix.tsx`
- **Linhas de Código**: 154 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Permissões por ação"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_set_site_campaign_permissions`
  - RPC: `gsa_admin_site_campaign_permission_overview`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 7.14. `GsaTvAdvertisingStudio`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvAdvertisingStudio.tsx`
- **Linhas de Código**: 36 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Gestão de campanhas"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_gsa_tv_advertising_mutate`
  - RPC: `gsa_admin_gsa_tv_advertising_snapshot`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 7.15. `GsaTvAiLab`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvAiLab.tsx`
- **Linhas de Código**: 950 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Laboratório de IA"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_gsa_tv_domain_mutate`
  - RPC: `gsa_admin_gsa_tv_domain_snapshot`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 7.16. `GsaTvAiStudioTab`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvAiStudioTab.tsx`
- **Linhas de Código**: 758 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "ESTÚDIO IA • GOOGLE FLOW &amp; GOOGLE VIDS"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_tv_get_job_progress`
  - RPC: `gsa_tv_get_recent_ai_jobs`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleTriggerProduction`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 7.17. `GsaTvLibraryTab`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvLibraryTab.tsx`
- **Linhas de Código**: 1038 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "BIBLIOTECA DE MÍDIA"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleOpenPreview`, `handleClosePreview`, `handleSubmitUpload`, `handleEnhanceMedia`, `handleDelete`
- **Campos e Formulários Detectados**: Título do Conteúdo (Opcional), Finalidade do Vídeo, Arquivo de Vídeo (MP4/WebM), Link Direto do Arquivo, Escolha o nível de aprimoramento
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 7.18. `GsaTvMasterControl`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvMasterControl.tsx`
- **Linhas de Código**: 2811 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "GSA TV • MESA MASTER DE CONTROLE"
- **Tabelas Supabase Acessadas**:
  - `gsa_tv_graphics [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleToggleLiveBadge`, `onAir`, `handleEndBreak`, `handleDirectBreakTake`, `handleSpotFileUpload`, `handleSelectSpotFromLibrary`, `handleAddSpot`, `handleToggleSpot`
- **Campos e Formulários Detectados**: Link da Transmissão ou Vídeo, Título da Transmissão (Opcional), Tipo do Sinal, 2. Escolha o Tipo de Transição, Título da Peça / Campanha, Anunciante / Patrocinador, Categoria da Peça, Duração (Segundos), Origem do Vídeo da Peça Comercial, 2. Duração do Intervalo
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 7.19. `GsaTvOperations`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvOperations.tsx`
- **Linhas de Código**: 31 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Operações e continuidade"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 7.20. `GsaTvProductionStatus`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvProductionStatus.tsx`
- **Linhas de Código**: 41 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 7.21. `GsaTvProgrammingStudio`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvProgrammingStudio.tsx`
- **Linhas de Código**: 39 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Planejamento editorial"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_gsa_tv_domain_mutate`
  - RPC: `gsa_admin_gsa_tv_domain_snapshot`
  - RPC: `gsa_admin_gsa_tv_schedule_mutate`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 7.22. `GsaTvScheduleTab`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvScheduleTab.tsx`
- **Linhas de Código**: 500 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "GRADE & PROGRAMAÇÃO"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `handleSaveSlot`, `handleApplyMasterGrade`
- **Campos e Formulários Detectados**: Selecione a Mídia Pronta, Início, Fim (Opcional - Automático), Tipo do Bloco, Título Personalizado (Opcional)
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 7.23. `GsaTvSettingsTab`

- **Arquivo**: `src/components/admin/gsa-tv/GsaTvSettingsTab.tsx`
- **Linhas de Código**: 486 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "AVANÇADO & TÉCNICO"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `onAir`
- **Campos e Formulários Detectados**: Nome do Canal, Perfil de Qualidade, Servidor RTMP, Chave de Transmissão
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

---

### Squad 8 — Benefícios, Seguros & Viagens

- **Total de Componentes**: 3
- **Volume de Código**: 3.048 linhas
- **Diretórios Base**: ProtectionAdminModule.tsx, TravelAdminModule.tsx, ViagensCategoriasModule.tsx

#### Inventário Detalhado dos Componentes

##### 8.1. `ProtectionAdminModule`

- **Arquivo**: `src/components/admin/ProtectionAdminModule.tsx`
- **Linhas de Código**: 366 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{tab === 'contratos' ? (domain === 'saude' ? 'Contratações' : 'Apólices') : labels[tab]}"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_create_protection_proposal`
  - RPC: `gsa_admin_list_resource`
  - RPC: `gsa_admin_save_protection_entity`
  - RPC: `gsa_admin_update_resource_status`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 8.2. `TravelAdminModule`

- **Arquivo**: `src/components/admin/TravelAdminModule.tsx`
- **Linhas de Código**: 2406 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "{title}"
- **Tabelas Supabase Acessadas**:
  - `clientes [select/query, select, realtime/query]`
  - `viagens_pacotes [select/query, realtime/query]`
  - `viagens_pacote_imagens [select/query, insert, realtime/query]`
  - `viagens_propostas [select/query, realtime/query]`
  - `viagens_transacoes [realtime/query]`
  - `viagens_orcamentos [realtime/query]`
  - `viagens_categorias [realtime/query]`
  - `viagens_passageiros [realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_process_travel_refund`
  - RPC: `gsa_admin_search_clients`
  - RPC: `gsa_admin_travel_create_package`
  - RPC: `gsa_admin_travel_create_proposal`
  - RPC: `gsa_admin_travel_link_lead`
  - RPC: `gsa_admin_travel_list`
  - RPC: `gsa_admin_travel_update_status`
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Navegação em Abas internas
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
  - Upload de Arquivos / Comprovantes
- **Ações e Handlers Principais**: `handleImageUpload`, `handleReactivate`, `handleCancelProposal`, `handleApproveRefund`, `handleProcessRefundPayment`, `handleDenyRefund`
- **Campos e Formulários Detectados**: URL do Fornecedor (Oculto), Imagens do Pacote (Até 5 Fotos), Taxas / Retenções (R$), Observações / Resposta ao Cliente
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 8.3. `ViagensCategoriasModule`

- **Arquivo**: `src/components/admin/ViagensCategoriasModule.tsx`
- **Linhas de Código**: 276 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Categorias de Viagens"
- **Tabelas Supabase Acessadas**:
  - `viagens_categorias [select/query, realtime/query]`
- **RPCs / Edge Functions Chamadas**:
  - RPC: `gsa_admin_delete_travel_category`
  - RPC: `gsa_admin_save_travel_category`
- **Capacidades Interativas & Padrões de UI**:
  - Formulários interativos
  - Barra de Busca e Filtros
  - Modais / Drawers contextuais
  - Assinatura Supabase Realtime
  - Exportação de Dados / Relatórios
- **Campos e Formulários Detectados**: Nome da Categoria, Slug (URL), Ordem, Status
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

---

### Squad 9 — BI, Relatórios & Analytics

- **Total de Componentes**: 16
- **Volume de Código**: 2.753 linhas
- **Diretórios Base**: RelatoriosModule.tsx, relatorios

#### Inventário Detalhado dos Componentes

##### 9.1. `RelatoriosModule`

- **Arquivo**: `src/components/admin/RelatoriosModule.tsx`
- **Linhas de Código**: 141 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "{activeReport?.label}"
- **Tabelas Supabase Acessadas**:
  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 9.2. `RelatorioClientes`

- **Arquivo**: `src/components/admin/relatorios/RelatorioClientes.tsx`
- **Linhas de Código**: 166 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Relatório de Clientes"
- **Tabelas Supabase Acessadas**:
  - `clientes [select]`
  - `client_levels [select]`
  - `faturas [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.3. `RelatorioCobranca`

- **Arquivo**: `src/components/admin/relatorios/RelatorioCobranca.tsx`
- **Linhas de Código**: 148 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Relatório de Cobrança"
- **Tabelas Supabase Acessadas**:
  - `cobrancas [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 9.4. `RelatorioCredito`

- **Arquivo**: `src/components/admin/relatorios/RelatorioCredito.tsx`
- **Linhas de Código**: 175 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Relatório de Crédito da Loja"
- **Tabelas Supabase Acessadas**:
  - `clientes [select]`
  - `loja_credito_solicitacoes [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.5. `RelatorioEmprestimos`

- **Arquivo**: `src/components/admin/relatorios/RelatorioEmprestimos.tsx`
- **Linhas de Código**: 174 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Relatório de Empréstimos"
- **Tabelas Supabase Acessadas**:
  - `emprestimos [select]`
  - `emprestimo_parcelas [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 9.6. `RelatorioExecutivo`

- **Arquivo**: `src/components/admin/relatorios/RelatorioExecutivo.tsx`
- **Linhas de Código**: 194 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Visão Executiva"
- **Tabelas Supabase Acessadas**:
  - `faturas [select]`
  - `clientes [select]`
  - `ordens_servico [select]`
  - `saques [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.7. `RelatorioFinanceiro`

- **Arquivo**: `src/components/admin/relatorios/RelatorioFinanceiro.tsx`
- **Linhas de Código**: 211 linhas
- **Complexidade de Migração Mobile**: **Alta**
- **Título / Rótulo de Interface**: "Relatório Financeiro"
- **Tabelas Supabase Acessadas**:
  - `faturas [select]`
  - `pagamentos [select]`
  - `saques [select]`
  - `transferencias [select]`
  - `clientes [select]`
  - `ordens_assinatura [select]`
  - `assinaturas [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com `Stack.Navigator` e `BottomTab`. Substituir tabelas largas por cartões verticais virtuais (`FlashList`), formulários em passos (`FormWizard`), e gavetas laterais por `BottomSheetModal` (@gorhom/bottom-sheet).

##### 9.8. `RelatorioFiscal`

- **Arquivo**: `src/components/admin/relatorios/RelatorioFiscal.tsx`
- **Linhas de Código**: 169 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Relatório Fiscal"
- **Tabelas Supabase Acessadas**:
  - `ordens_fiscais [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.9. `RelatorioGamificacao`

- **Arquivo**: `src/components/admin/relatorios/RelatorioGamificacao.tsx`
- **Linhas de Código**: 154 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Gamificação & Pontos"
- **Tabelas Supabase Acessadas**:
  - `pontos_movimentacoes [select]`
  - `clientes [select]`
  - `client_levels [select]`
  - `cliente_premios [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.10. `RelatorioLoja`

- **Arquivo**: `src/components/admin/relatorios/RelatorioLoja.tsx`
- **Linhas de Código**: 164 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Relatório da Loja"
- **Tabelas Supabase Acessadas**:
  - `faturas [select]`
  - `produtos [select]`
  - `loja_solicitacoes [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.11. `RelatorioMarketing`

- **Arquivo**: `src/components/admin/relatorios/RelatorioMarketing.tsx`
- **Linhas de Código**: 139 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Marketing & Promoções"
- **Tabelas Supabase Acessadas**:
  - `vouchers [select]`
  - `indicacoes [select]`
  - `promocoes [select]`
  - `cliente_promocoes [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.12. `RelatorioOS`

- **Arquivo**: `src/components/admin/relatorios/RelatorioOS.tsx`
- **Linhas de Código**: 152 linhas
- **Complexidade de Migração Mobile**: **Baixa**
- **Título / Rótulo de Interface**: "Relatório de OS & Orçamentos"
- **Tabelas Supabase Acessadas**:
  - `ordens_servico [select]`
  - `orcamentos [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Ações e Handlers Principais**: `online`
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (`View`, `Text`, `Pressable`, `Switch`).

##### 9.13. `RelatorioOperacional`

- **Arquivo**: `src/components/admin/relatorios/RelatorioOperacional.tsx`
- **Linhas de Código**: 149 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Relatório Operacional"
- **Tabelas Supabase Acessadas**:
  - `colaboradores [select]`
  - `solicitacoes_exclusao [select]`
  - `ordens_assinatura [select]`
  - `ordens_compra [select]`
  - `assinaturas [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.14. `RelatorioPrestadores`

- **Arquivo**: `src/components/admin/relatorios/RelatorioPrestadores.tsx`
- **Linhas de Código**: 154 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Relatório de Prestadores"
- **Tabelas Supabase Acessadas**:
  - `prestadores [select]`
  - `prestador_demandas [select]`
  - `prestador_faturas [select]`
  - `prestador_saques [select]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.15. `RelatorioRentabilidade`

- **Arquivo**: `src/components/admin/relatorios/RelatorioRentabilidade.tsx`
- **Linhas de Código**: 328 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Contratos Finalizados"
- **Tabelas Supabase Acessadas**:
  - `emprestimos [select/query]`
  - `faturas [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

##### 9.16. `RelatorioSuporte`

- **Arquivo**: `src/components/admin/relatorios/RelatorioSuporte.tsx`
- **Linhas de Código**: 135 linhas
- **Complexidade de Migração Mobile**: **Média**
- **Título / Rótulo de Interface**: "Relatório de Suporte & Tickets"
- **Tabelas Supabase Acessadas**:
  - `tickets [select/query]`
- **RPCs / Edge Functions Chamadas**:
  - *Nenhuma RPC ou Edge Function direta*
- **Capacidades Interativas & Padrões de UI**:
  - Listagem em Tabela/Grid
  - Barra de Busca e Filtros
  - Exportação de Dados / Relatórios
- **Diretriz de Adaptação Mobile (React Native)**:
  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (`ScrollView` horizontal). Modais de edição convertidos em `Modal` nativo ou tela dedicada.

---

## 4. Matrizes de Dependências Cross-Cutting

### 4.1. Matriz de Acesso a Tabelas Supabase

Abaixo estão listadas todas as tabelas do Supabase referenciadas pelos componentes administrativos, com a indicação de quais componentes realizam operações nelas:

| Tabela | Ocorrências | Componentes que Acessam |
| :--- | :---: | :--- |
| `admin_sessoes` | 1 | `GovernancaAcessosView` |
| `assinaturas` | 5 | `AssinaturasModule`, `OrcamentosModule`, `OrdensAssinaturaModule`, `RelatorioFinanceiro`, `RelatorioOperacional` |
| `audit_trail` | 1 | `GovernancaAuditoriaView` |
| `automacao_scraping_configs` | 1 | `ScrapingAdminModule` |
| `automacao_scraping_logs` | 2 | `ScrapingAdminModule`, `ScrapingExecutionMonitorModal` |
| `catalog_services` | 1 | `ServicosModule` |
| `classificados_anuncios` | 2 | `ClassifiedsModule`, `ClientesModule` |
| `classificados_mensagens` | 1 | `ClassifiedsModule` |
| `classificados_midias` | 1 | `ClassifiedsModule` |
| `classificados_propostas` | 1 | `ClassifiedsModule` |
| `classificados_transacoes` | 1 | `ClassifiedsModule` |
| `client_levels` | 3 | `AreaVIPModule`, `RelatorioClientes`, `RelatorioGamificacao` |
| `cliente_documentos` | 2 | `ClientesModule`, `AdminClienteDocumentos` |
| `cliente_notas_admin` | 1 | `ClientesModule` |
| `cliente_premios` | 3 | `PremiosModule`, `RelatorioGamificacao`, `FidelidadePromocoesSection` |
| `cliente_promocoes` | 3 | `OrcamentosModule`, `PromoDetalhesModal`, `RelatorioMarketing` |
| `clientes` | 34 | `AreaVIPModule`, `ClientesModule`, `CreditoModule`, `CuponsLojaModule`, `Dashboard`, `FinanceiroModule` e mais 28... |
| `cobranca_acordo_parcelas` | 2 | `CobrancaModule`, `CobrancaView` |
| `cobranca_historico` | 2 | `CobrancaModule`, `CobrancaView` |
| `cobrancas` | 6 | `CobrancaModule`, `Dashboard`, `RelatorioCobranca`, `CobrancaView`, `FaturamentoView`, `FinanceiroSuperDomain` |
| `colaboradores` | 10 | `AcessosModule`, `DemandasColaboradorModule`, `SystemMonitorModule`, `DemandasDashboard`, `NovaDemandaModal`, `PrestadoresDemandas` e mais 4... |
| `configuracoes` | 1 | `GovernancaConfiguracoesView` |
| `contratos` | 1 | `ContratosDocumentosView` |
| `cupons_loja` | 3 | `CuponsLojaModule`, `OrdensCompraModule`, `FidelidadePromocoesSection` |
| `demanda_comentarios` | 2 | `DemandasColaboradorModule`, `DemandasComentarios` |
| `documentos_prestador` | 1 | `AdminPrestadorDocumentos` |
| `empresa` | 1 | `EmpresaModule` |
| `emprestimo_comentarios` | 1 | `EmprestimosModule` |
| `emprestimo_documentos` | 1 | `EmprestimosModule` |
| `emprestimo_historico` | 1 | `EmprestimosModule` |
| `emprestimo_parcelas` | 4 | `ClientesModule`, `EmprestimosModule`, `RelatorioEmprestimos`, `EmprestimosCreditoView` |
| `emprestimos` | 7 | `ClientesModule`, `Dashboard`, `EmprestimosModule`, `OrcamentosModule`, `RelatorioEmprestimos`, `RelatorioRentabilidade` e mais 1... |
| `extrato_financeiro` | 3 | `ClientesModule`, `OrdensCompraModule`, `VouchersModule` |
| `fatura_contestacoes` | 1 | `FinanceiroModule` |
| `faturas` | 21 | `ClientesModule`, `CobrancaModule`, `CreditoModule`, `Dashboard`, `FinanceiroModule`, `FiscalModule` e mais 15... |
| `fornecedor_documentos` | 1 | `FornecedoresModule` |
| `fornecedor_entregas` | 1 | `FornecedoresModule` |
| `fornecedor_pedidos` | 1 | `FornecedoresModule` |
| `fornecedor_produtos` | 1 | `FornecedoresModule` |
| `fornecedores` | 4 | `FornecedoresModule`, `SystemMonitorModule`, `FornecedoresSection`, `PessoasSuperDomain` |
| `funcoes` | 1 | `GovernancaAcessosView` |
| `gsa_ad_campaigns` | 1 | `AdvertisingAdminModule` |
| `gsa_ad_creatives` | 1 | `AdvertisingAdminModule` |
| `gsa_ad_payments` | 1 | `AdvertisingAdminModule` |
| `gsa_ad_placements` | 1 | `AdvertisingAdminModule` |
| `gsa_ad_proposals` | 1 | `AdvertisingAdminModule` |
| `gsa_ad_requests` | 1 | `AdvertisingAdminModule` |
| `gsa_afiliado_cliques` | 1 | `AfiliadosSection` |
| `gsa_afiliado_comissoes` | 2 | `AffiliateAdminModule`, `AfiliadosSection` |
| `gsa_afiliado_conversoes` | 1 | `AfiliadosSection` |
| `gsa_afiliado_links` | 1 | `AffiliateAdminModule` |
| `gsa_afiliado_pontos_eventos` | 1 | `AfiliadosSection` |
| `gsa_afiliado_programas` | 1 | `AffiliateAdminModule` |
| `gsa_afiliado_saques` | 2 | `AffiliateAdminModule`, `AfiliadosSection` |
| `gsa_afiliado_transferencias` | 1 | `AfiliadosSection` |
| `gsa_afiliados` | 4 | `AffiliateAdminModule`, `SystemMonitorModule`, `AfiliadosSection`, `PessoasSuperDomain` |
| `gsa_careers_applications` | 1 | `PessoasSuperDomain` |
| `gsa_tv_graphics` | 1 | `GsaTvMasterControl` |
| `gsa_whatsapp_ramais` | 2 | `WhatsAppQRCodeManager`, `GovernancaInfraView` |
| `indicacoes` | 7 | `AffiliateAdminModule`, `ClientesModule`, `IndicacoesModule`, `OrcamentosModule`, `PainelRentabilidade`, `RelatorioMarketing` e mais 1... |
| `level_history` | 1 | `AreaVIPModule` |
| `loja_categorias` | 6 | `AssinaturasModule`, `LojaCategoriasModule`, `ProdutosModule`, `PromocaoQuantidadeForm`, `ScrapingAdminModule`, `ServicosModule` |
| `loja_credito_documentos` | 1 | `CreditoModule` |
| `loja_credito_movimentacoes` | 4 | `CreditoModule`, `CreditDisputesAdminPanel`, `CreditLimitCancellationsAdminPanel`, `CreditWithdrawalsAdminPanel` |
| `loja_credito_solicitacoes` | 4 | `ClientesModule`, `CreditoModule`, `RelatorioCredito`, `EmprestimosCreditoView` |
| `loja_estoque_historico` | 1 | `ProdutosModule` |
| `loja_reembolsos` | 1 | `ReembolsosModule` |
| `loja_solicitacoes` | 3 | `LojaTrocasModule`, `RelatorioLoja`, `FidelidadePromocoesSection` |
| `notificacoes` | 4 | `ClientesModule`, `CreditDisputesAdminPanel`, `CreditLimitCancellationsAdminPanel`, `CreditWithdrawalsAdminPanel` |
| `orcamento_timeline` | 1 | `ClientesModule` |
| `orcamentos` | 12 | `ClientesModule`, `Dashboard`, `OrcamentosModule`, `OrdensAssinaturaModule`, `OrdensCompraModule`, `PainelRentabilidade` e mais 6... |
| `ordens_assinatura` | 9 | `AssinaturasModule`, `ClientesModule`, `FinanceiroModule`, `OrdensAssinaturaModule`, `OrdensCompraModule`, `VendasModule` e mais 3... |
| `ordens_compra` | 10 | `ClientesModule`, `Dashboard`, `FinanceiroModule`, `FornecedoresModule`, `OrdensCompraModule`, `ShopeeOperationsModule` e mais 4... |
| `ordens_fiscais` | 9 | `ClientesModule`, `Dashboard`, `FinanceiroModule`, `FiscalModule`, `PrestadoresDemandas`, `RelatorioFiscal` e mais 3... |
| `ordens_servico` | 15 | `ClientesModule`, `Dashboard`, `FinanceiroModule`, `OrdensServicoModule`, `PainelRentabilidade`, `VendasModule` e mais 9... |
| `os_notas` | 3 | `DemandasColaboradorModule`, `OrdensServicoModule`, `PrestadoresDemandas` |
| `os_suporte_mensagens` | 3 | `DemandasColaboradorModule`, `DemandasDetalhesModal`, `PrestadoresDemandas` |
| `pagamentos` | 3 | `OrdensCompraModule`, `VouchersModule`, `RelatorioFinanceiro` |
| `parceiros` | 2 | `PartnersAdminModule`, `FornecedoresSection` |
| `parceiros_resgates` | 1 | `FornecedoresSection` |
| `parceiros_resgates_eventos` | 1 | `PartnerRedemptionDetailModal` |
| `payment_methods` | 1 | `GovernancaConfiguracoesView` |
| `points_transactions` | 2 | `ClientesModule`, `OrdensCompraModule` |
| `pontos_movimentacoes` | 4 | `ClientesModule`, `OrdensCompraModule`, `RelatorioGamificacao`, `FidelidadePromocoesSection` |
| `prestador_demandas` | 15 | `ClientesModule`, `Dashboard`, `DemandasColaboradorModule`, `OrdensServicoModule`, `PainelRentabilidade`, `VendasModule` e mais 9... |
| `prestador_demandas_historico` | 3 | `DemandasColaboradorModule`, `DemandasDetalhesModal`, `PrestadoresDemandas` |
| `prestador_documentos` | 1 | `AdminPrestadorDocumentos` |
| `prestador_faturas` | 1 | `RelatorioPrestadores` |
| `prestador_historico` | 2 | `PrestadoresCadastro`, `PrestadorDetailDrawer` |
| `prestador_premios` | 1 | `AdminPrestadorPremios` |
| `prestador_promocoes` | 1 | `AdminPrestadorPromocoes` |
| `prestador_promocoes_ativacoes` | 1 | `AdminPrestadorPromocoes` |
| `prestador_saques` | 6 | `FinanceiroModule`, `PrestadoresFinanceiro`, `RelatorioPrestadores`, `PayoutClearanceDrawer`, `PessoasSuperDomain`, `SaquesRepassesSection` |
| `prestador_suporte_demandas` | 1 | `PrestadoresDemandas` |
| `prestador_transacoes` | 2 | `PrestadoresCadastro`, `PrestadoresDemandas` |
| `prestador_vouchers` | 1 | `AdminPrestadorVouchers` |
| `prestadores` | 13 | `DemandasColaboradorModule`, `SystemMonitorModule`, `TicketsModule`, `DemandasDashboard`, `NovaDemandaModal`, `PrestadoresCadastro` e mais 7... |
| `pricing_configs` | 1 | `PricingPanel` |
| `produto_fornecedor_config` | 2 | `FornecedoresModule`, `ProdutosModule` |
| `produto_variacao_grupos` | 1 | `ProdutosModule` |
| `produto_variacao_opcoes` | 1 | `ProdutosModule` |
| `produto_variantes` | 1 | `ProdutosModule` |
| `produtos` | 7 | `CuponsLojaModule`, `FornecedoresModule`, `OrcamentosModule`, `OrdensCompraModule`, `ProdutosModule`, `PromocaoQuantidadeForm` e mais 1... |
| `promocoes` | 4 | `Dashboard`, `OrcamentosModule`, `PromocoesModule`, `RelatorioMarketing` |
| `promocoes_quantidade` | 2 | `PromocaoQuantidadeForm`, `PromocaoQuantidadeModule` |
| `promocoes_quantidade_uso` | 1 | `PromoAnalytics` |
| `saques` | 11 | `ClientesModule`, `Dashboard`, `FinanceiroModule`, `RelatorioExecutivo`, `RelatorioFinanceiro`, `FinanceiroSuperDomain` e mais 5... |
| `saude_contratos` | 1 | `GsaSaudeView` |
| `seguros_apolices` | 1 | `GsaSegurosView` |
| `servicos` | 3 | `OrcamentosModule`, `ServicePackagesModule`, `ServicosModule` |
| `servicos_pacotes` | 1 | `ServicePackagesModule` |
| `shopee_automation_workers` | 1 | `ShopeeOperationsModule` |
| `shopee_fulfillment_jobs` | 1 | `ShopeeOperationsModule` |
| `sistema_logs` | 4 | `AcessosModule`, `SystemMonitorModule`, `GovernancaAuditoriaView`, `GovernancaExecutiveDashboard` |
| `site_campaign_events` | 1 | `SiteCampaignAdminModule` |
| `site_campaigns` | 1 | `SiteCampaignAdminModule` |
| `solicitacoes_exclusao` | 4 | `AcessosModule`, `RelatorioOperacional`, `GovernancaAcessosView`, `GovernancaAuditoriaView` |
| `system_settings` | 14 | `AreaVIPModule`, `CobrancaModule`, `ConfiguracoesModule`, `CreditoModule`, `OrcamentosModule`, `ScrapingAdminModule` e mais 8... |
| `ticket_mensagens` | 3 | `ClientesModule`, `TicketsModule`, `AtendimentoTicketsView` |
| `tickets` | 5 | `ClientesModule`, `Dashboard`, `TicketsModule`, `RelatorioSuporte`, `AtendimentoTicketsView` |
| `transferencias` | 3 | `FinanceiroModule`, `RelatorioFinanceiro`, `FluxoCaixaView` |
| `viagens_categorias` | 3 | `ScrapingAdminModule`, `TravelAdminModule`, `ViagensCategoriasModule` |
| `viagens_orcamentos` | 1 | `TravelAdminModule` |
| `viagens_pacote_imagens` | 1 | `TravelAdminModule` |
| `viagens_pacotes` | 1 | `TravelAdminModule` |
| `viagens_passageiros` | 1 | `TravelAdminModule` |
| `viagens_propostas` | 1 | `TravelAdminModule` |
| `viagens_transacoes` | 1 | `TravelAdminModule` |
| `vouchers` | 6 | `Dashboard`, `IndicacoesModule`, `VouchersModule`, `RelatorioMarketing`, `CalculadorasGatewayView`, `FidelidadePromocoesSection` |

### 4.2. Registro de Funções RPC (Remote Procedure Calls)

| Função RPC | Chamadores |
| :--- | :--- |
| `delete_client_cascade` | `ClientesModule` |
| `fn_marcar_faturas_vencidas` | `FinanceiroModule`, `FaturamentoView` |
| `gsa_admin_access_snapshot` | `AcessosModule`, `GovernancaAcessosView`, `GovernancaAuditoriaView` |
| `gsa_admin_add_demand_comment` | `DemandasComentarios` |
| `gsa_admin_add_os_note` | `DemandasDetalhesModal` |
| `gsa_admin_adjust_affiliate_balance` | `AffiliateAdminModule`, `AfiliadosSection` |
| `gsa_admin_adjust_points` | `FidelidadePromocoesSection` |
| `gsa_admin_advertising_overview` | `AdvertisingAdminModule` |
| `gsa_admin_affiliate_snapshot` | `AffiliateAdminModule`, `AfiliadosSection` |
| `gsa_admin_ajustar_limite_credito_cliente` | `CreditoModule` |
| `gsa_admin_ajustar_saldo_cliente` | `ClientesModule`, `CrmClientesView` |
| `gsa_admin_alterar_status_cliente` | `ClientesModule`, `CrmClientesView` |
| `gsa_admin_aplicar_ajuste_fatura` | `FinanceiroModule` |
| `gsa_admin_approve_budget` | `OrcamentosModule`, `OrcamentosWorkstation` |
| `gsa_admin_approve_preapproved_credit_100` | `EmprestimosCreditoView` |
| `gsa_admin_aprovar_aumento_credito` | `CreditoModule` |
| `gsa_admin_atualizar_dados_cliente` | `ClientesModule` |
| `gsa_admin_atualizar_documento_credito` | `CreditoModule` |
| `gsa_admin_atualizar_solicitacao_loja` | `LojaTrocasModule` |
| `gsa_admin_atualizar_status_cliente` | `ClientesModule` |
| `gsa_admin_baixar_cobranca_manual` | `CobrancaModule`, `CobrancaView` |
| `gsa_admin_baixar_fatura` | `ClientesModule`, `Dashboard`, `FinanceiroModule`, `FaturamentoView`, `GovernancaExecutiveDashboard` |
| `gsa_admin_baixar_parcela_cobranca` | `CobrancaModule`, `CobrancaView` |
| `gsa_admin_calculator_pro_snapshot` | `CalculatorProPaymentConfiguration`, `CalculadorasGatewayView` |
| `gsa_admin_cancel_subscription` | `OrdensAssinaturaModule` |
| `gsa_admin_cancelar_acordo_cobranca` | `CobrancaModule`, `CobrancaView` |
| `gsa_admin_cancelar_demanda` | `DemandasDetalhesModal`, `PrestadoresDemandas` |
| `gsa_admin_cancelar_fatura` | `FinanceiroModule`, `FaturamentoView` |
| `gsa_admin_cancelar_os` | `OrdensServicoWorkstation` |
| `gsa_admin_check_product_barcode` | `ProdutosModule` |
| `gsa_admin_classified_action` | `ClassifiedsModule` |
| `gsa_admin_concluir_os_e_faturar` | `OrdensServicoWorkstation` |
| `gsa_admin_create_calculator_pro_voucher` | `CalculatorProAdminPanel`, `CalculadorasGatewayView` |
| `gsa_admin_create_crm_client` | `CrmClientesView` |
| `gsa_admin_create_protection_proposal` | `ProtectionAdminModule` |
| `gsa_admin_create_provider` | `NovoPrestadorDrawer` |
| `gsa_admin_create_provider_demand` | `NovaDemandaModal` |
| `gsa_admin_criar_cliente` | `ClientesModule`, `HubEmpresasView` |
| `gsa_admin_criar_cobranca_fatura` | `CobrancaModule` |
| `gsa_admin_criar_fatura_manual` | `FinanceiroModule`, `FaturamentoView` |
| `gsa_admin_dashboard_snapshot` | `Dashboard`, `GovernancaExecutiveDashboard` |
| `gsa_admin_decide_affiliate_payout` | `AffiliateAdminModule`, `AfiliadosSection` |
| `gsa_admin_definir_parcelamento_credito` | `CreditoModule` |
| `gsa_admin_delete_products_by_filter` | `ProdutosModule` |
| `gsa_admin_delete_site_campaign` | `SiteCampaignAdminModule`, `SiteCampaignDeletionPanel` |
| `gsa_admin_delete_store_coupon` | `CuponsLojaModule`, `FidelidadePromocoesSection` |
| `gsa_admin_delete_travel_category` | `ViagensCategoriasModule` |
| `gsa_admin_desbloquear_pin_cliente` | `ClientesModule`, `CrmClientesView` |
| `gsa_admin_duplicate_site_campaign` | `SiteCampaignAdminModule` |
| `gsa_admin_emprestimo_aprovar` | `EmprestimosModule`, `EmprestimosCreditoView` |
| `gsa_admin_emprestimo_atualizar_documento` | `EmprestimosModule` |
| `gsa_admin_emprestimo_atualizar_status` | `EmprestimosModule` |
| `gsa_admin_emprestimo_enviar_comentario` | `EmprestimosModule` |
| `gsa_admin_emprestimo_enviar_contrato` | `EmprestimosModule` |
| `gsa_admin_emprestimo_enviar_oferta_quitacao` | `EmprestimosModule`, `EmprestimosCreditoView` |
| `gsa_admin_emprestimo_enviar_proposta` | `EmprestimosModule`, `EmprestimosCreditoView` |
| `gsa_admin_emprestimo_salvar_observacao` | `EmprestimosModule` |
| `gsa_admin_ensure_calculator_pro_products` | `CalculatorProAdminPanel` |
| `gsa_admin_enviar_fatura_cobranca` | `ClientesModule`, `FinanceiroModule`, `FaturamentoView` |
| `gsa_admin_enviar_oferta_quitacao_credito` | `CreditoModule` |
| `gsa_admin_excluir_cobranca` | `CobrancaModule` |
| `gsa_admin_extend_subscription` | `OrdensAssinaturaModule` |
| `gsa_admin_finalize_service_order` | `OrdensServicoModule` |
| `gsa_admin_fiscal_update` | `FiscalModule`, `FiscalView` |
| `gsa_admin_gerar_acordo_cobranca` | `CobrancaModule`, `CobrancaView` |
| `gsa_admin_get_career_application` | `CareersAdminModule`, `TrabalheConoscoSection` |
| `gsa_admin_get_career_resume_reference` | `CareersAdminModule`, `TrabalheConoscoSection` |
| `gsa_admin_gsa_tv_advertising_mutate` | `GsaTvAdvertisingStudio` |
| `gsa_admin_gsa_tv_advertising_snapshot` | `GsaTvAdvertisingStudio` |
| `gsa_admin_gsa_tv_domain_mutate` | `GsaTvAiLab`, `GsaTvProgrammingStudio` |
| `gsa_admin_gsa_tv_domain_snapshot` | `GsaTvAiLab`, `GsaTvProgrammingStudio` |
| `gsa_admin_gsa_tv_mutate` | `GsaTvModule` |
| `gsa_admin_gsa_tv_schedule_mutate` | `GsaTvProgrammingStudio` |
| `gsa_admin_gsa_tv_snapshot` | `GsaTvModule` |
| `gsa_admin_import_products_batch_v2` | `BulkProductImportModal` |
| `gsa_admin_liberar_credito_contrato` | `CreditoModule` |
| `gsa_admin_list_career_applications` | `CareersAdminModule`, `TrabalheConoscoSection` |
| `gsa_admin_list_career_vacancies` | `CareerVacanciesManager` |
| `gsa_admin_list_resource` | `ClassifiedsModule`, `FiscalModule`, `ProtectionAdminModule`, `FiscalView` |
| `gsa_admin_list_store_refunds` | `RentabilidadeReembolsosView` |
| `gsa_admin_mudar_status_cobranca` | `CobrancaModule` |
| `gsa_admin_patch_marketplace_budget` | `OrcamentosWorkstation` |
| `gsa_admin_patch_marketplace_product` | `ProdutosModule` |
| `gsa_admin_preaprovar_credito` | `CreditoModule`, `EmprestimosCreditoView` |
| `gsa_admin_process_store_refund` | `RentabilidadeReembolsosView` |
| `gsa_admin_process_travel_refund` | `TravelAdminModule` |
| `gsa_admin_processar_saque` | `Dashboard`, `FinanceiroModule`, `FluxoCaixaView`, `GovernancaExecutiveDashboard`, `PayoutClearanceDrawer`, `SaquesRepassesSection` |
| `gsa_admin_processar_saque_prestador` | `PrestadoresFinanceiro`, `PayoutClearanceDrawer`, `SaquesRepassesSection` |
| `gsa_admin_processar_transferencia` | `FinanceiroModule`, `FluxoCaixaView` |
| `gsa_admin_protestar_cobranca` | `CobrancaModule`, `CobrancaView` |
| `gsa_admin_recusar_credito` | `CreditoModule`, `EmprestimosCreditoView` |
| `gsa_admin_registrar_cobranca_historico` | `CobrancaModule`, `CobrancaView` |
| `gsa_admin_rejeitar_contrato_credito` | `CreditoModule` |
| `gsa_admin_release_affiliate_commissions` | `AffiliateAdminModule`, `AfiliadosSection` |
| `gsa_admin_reset_actor_pin` | `ClientesModule`, `PrestadoresCadastro`, `CrmClientesView`, `PrestadorDetailDrawer` |
| `gsa_admin_review_deletion_request` | `AcessosModule`, `GovernancaAcessosView` |
| `gsa_admin_rotate_collaborator_credential` | `AcessosModule`, `GovernancaAcessosView` |
| `gsa_admin_save_calculator_pro_product` | `CalculatorProAdminPanel`, `CalculadorasGatewayView` |
| `gsa_admin_save_calculator_pro_runtime_config` | `CalculatorProPaymentConfiguration`, `CalculadorasGatewayView` |
| `gsa_admin_save_collaborator` | `AcessosModule`, `GovernancaAcessosView` |
| `gsa_admin_save_company` | `ConfiguracoesModule`, `GovernancaConfiguracoesView` |
| `gsa_admin_save_function` | `AcessosModule`, `GovernancaAcessosView` |
| `gsa_admin_save_payment_method` | `ConfiguracoesModule`, `GovernancaConfiguracoesView` |
| `gsa_admin_save_protection_entity` | `ProtectionAdminModule` |
| `gsa_admin_save_scraping_config` | `ScrapingAdminModule` |
| `gsa_admin_save_store_coupon` | `CuponsLojaModule`, `FidelidadePromocoesSection` |
| `gsa_admin_save_travel_category` | `ViagensCategoriasModule` |
| `gsa_admin_search_clients` | `TravelAdminModule` |
| `gsa_admin_send_os_support_message` | `DemandasDetalhesModal` |
| `gsa_admin_service_mutation` | `ServicosModule` |
| `gsa_admin_set_affiliate_status` | `AffiliateAdminModule`, `AfiliadosSection` |
| `gsa_admin_set_calculator_pro_voucher_status` | `CalculatorProAdminPanel` |
| `gsa_admin_set_collaborator_status` | `AcessosModule`, `GovernancaAcessosView` |
| `gsa_admin_set_site_campaign_permissions` | `SiteCampaignPermissionMatrix` |
| `gsa_admin_set_site_campaign_status` | `SiteCampaignAdminModule` |
| `gsa_admin_settings_snapshot` | `ConfiguracoesModule`, `GovernancaConfiguracoesView` |
| `gsa_admin_site_campaign_my_permissions` | `SiteCampaignAdminModule`, `SiteCampaignDeletionPanel` |
| `gsa_admin_site_campaign_permission_overview` | `SiteCampaignPermissionMatrix` |
| `gsa_admin_site_campaigns_overview` | `SiteCampaignAdminModule`, `SiteCampaignDeletionPanel` |
| `gsa_admin_solicitar_documento_credito` | `CreditoModule` |
| `gsa_admin_supplier_snapshot` | `SystemMonitorModule` |
| `gsa_admin_system_snapshot` | `SystemMonitorModule`, `GovernancaInfraView` |
| `gsa_admin_transition_provider_demand` | `DemandasDetalhesModal` |
| `gsa_admin_travel_create_package` | `TravelAdminModule` |
| `gsa_admin_travel_create_proposal` | `TravelAdminModule` |
| `gsa_admin_travel_link_lead` | `TravelAdminModule` |
| `gsa_admin_travel_list` | `TravelAdminModule` |
| `gsa_admin_travel_update_status` | `TravelAdminModule` |
| `gsa_admin_trigger_scraping_now` | `ScrapingAdminModule` |
| `gsa_admin_update_affiliate_details` | `AffiliateAdminModule` |
| `gsa_admin_update_affiliate_points_settings` | `AffiliateAdminModule` |
| `gsa_admin_update_affiliate_program` | `AffiliateAdminModule` |
| `gsa_admin_update_career_application` | `CareersAdminModule`, `TrabalheConoscoSection` |
| `gsa_admin_update_global_saque_minimo` | `AffiliateAdminModule` |
| `gsa_admin_update_resource_status` | `ProtectionAdminModule` |
| `gsa_admin_update_settings_secure` | `ConfiguracoesModule`, `GovernancaConfiguracoesView` |
| `gsa_admin_update_store_order_notes` | `OrdensCompraModule` |
| `gsa_admin_upsert_career_vacancy` | `CareerVacanciesManager` |
| `gsa_admin_upsert_settings` | `AreaVIPModule`, `CobrancaModule`, `CreditoModule` |
| `gsa_admin_upsert_site_campaign` | `SiteCampaignAdminModule` |
| `gsa_admin_whatsapp_mutation` | `WhatsAppQRCodeManager` |
| `gsa_collaborator_dashboard_snapshot` | `CollaboratorDashboard`, `GovernancaCollaboratorDashboard` |
| `gsa_collaborator_demand_history` | `DemandasColaboradorModule` |
| `gsa_collaborator_list_demands` | `DemandasColaboradorModule` |
| `gsa_registrar_pendencia_whatsapp` | `AdminClienteDocumentos` |
| `gsa_tv_get_job_progress` | `GsaTvAiStudioTab` |
| `gsa_tv_get_recent_ai_jobs` | `GsaTvAiStudioTab` |

### 4.3. Microserviços, Edge Functions & APIs de Infraestrutura

O ecossistema administrativo integra-se com microserviços em nuvem para automação crítica:

1. **VPS Oracle Cloud (Linux `147.15.43.141`)**:
   - `vps-api/metrics`: Coleta de telemetria em tempo real (CPU, memória RAM, disco e rede) via `OracleMetricsPanel.tsx`.
   - `vps-api/power`: Comandos de ciclo de energia (start, stop, reboot) do servidor.
   - `ssh-proxy`: Ponte WebSocket para emulação de terminal interativo xterm no navegador (`VPSTerminal.tsx`).
2. **Cloudflare Gateway & R2 Object Storage**:
   - `cloudflare-api/analytics`: Métricas de tráfego, cache hit ratio e segurança DDoS.
   - `cloudflare-api/r2-files`: Gestão do bucket de arquivos e mídias privadas/públicas.
   - `cloudflare-api/purge-cache`, `dev-mode`, `under-attack`: Controles de borda da CDN.
3. **Evolution API & WhatsApp Gateway**:
   - `WhatsAppQRCodeManager.tsx` e `WhatsAppHealthMonitor.tsx`: Emparelhamento multi-dispositivo de ramais de atendimento e monitoramento de fila de disparos.
4. **Supabase Realtime Engine**:
   - Sincronização reativa de notificações, orçamentos, demandas, faturas e auditoria de colaboradores.

---

## 5. Recomendações e Diretrizes para o Time de Migração Mobile

1. **Abstração da Camada de Dados**:
   - Reutilizar a camada de `adminRpc.ts` e queries Supabase encapsuladas em hooks customizados do TanStack Query (`@tanstack/react-query`), garantindo cache e invalidação determinística no React Native.
2. **Substituição de Tabelas Desktop por Listas Virtuais**:
   - Nunca renderizar `<table>` HTML ou layouts com largura fixa de 1000px+ no mobile. Utilizar `@shopify/flash-list` com renderização de cartões táteis contendo dados principais e expansão sob demanda (`Accordion` ou toque para detalhes).
3. **Tratamento de Modais e Drawers**:
   - Substituir gavetas laterais de desktop (`CommandSlideOver`, `Drawer`) por `BottomSheetModal` de alto desempenho nativo no Android e iOS.
4. **Estratégia de Roteamento por Esquadrões**:
   - Organizar a navegação mobile espelhando os 9 esquadrões catalogados, permitindo que cada squad desenvolva e teste suas telas de forma desacoplada e isolada.

