# Arquitetura & Estratégia de Migração: Web Admin -> GSA Admin Mobile
**Documento Técnico Centralizado e Laudo de Engenharia de Migração**
*Autor: Architecture & Verification Explorer*
*Data: 2026-09-19*
*Status: Aprovado para Orquestração*

---

## 1. Sumário Executivo & Baseline do Inventário

O objetivo desta missão é estruturar a migração nativa e completa de todos os módulos administrativos do ERP Web GSA (localizados em `src/components/admin/`) para o aplicativo móvel (`gsa-admin-mobile`), assegurando:
1. **100% de paridade funcional e de roteamento** verificável via script automatizado.
2. **Adaptação ergonômica nativa Mobile UX** (eliminando tabelas rígidas de desktop e formulários monolíticos, em estrita conformidade com o rubric Agent-as-Judge).
3. **Estabilidade de compilação TypeScript** (`npx tsc --noEmit` com código de saída 0).
4. **Execução paralela desacoplada** dividida em 6 Esquadrões de Domínio (Domain Squads).

### 1.1. Baseline do Web Admin (`src/components/admin`)
- **Total de Componentes TSX Diretos (Módulos Raiz):** 68 arquivos `.tsx`.
- **Total de Componentes TSX Recursivos (Incluindo Subdomínios e Views):** 176 arquivos `.tsx`.
- **Volume de Código:** 47.970+ linhas de código TypeScript/React nos módulos administrativos raiz.
- **Top 5 Maiores Módulos Web:**
  1. `FinanceiroModule.tsx`: 3.289 linhas
  2. `ClientesModule.tsx`: 3.195 linhas
  3. `ProdutosModule.tsx`: 2.954 linhas
  4. `OrcamentosModule.tsx`: 2.740 linhas
  5. `TravelAdminModule.tsx`: 2.406 linhas
- **Subdiretórios Especializados:**
  - `super-domains/` (51 arquivos): Consolidação de 5 Super-Domínios (`operacoes`, `financeiro`, `pessoas`, `contratos`, `governanca` e `shared`).
  - `relatorios/` (15 arquivos): Relatórios setoriais especializados.
  - `gsa-tv/` (10 arquivos): Módulos do estúdio, grade, acervo e Master Control da GSA TV.
  - `products/` (8 arquivos): Modais de importação em massa, leitor de código de barras e seleção de fontes.
  - `prestadores/` (7 arquivos): Vouchers, prêmios, promoções, demandas e financeiro do prestador.
  - `demandas/` (6 arquivos): Kanban, tabela de demandas, comentários e modais.
  - `infra/` (4 arquivos): Terminais VPS, métricas Oracle Cloud, Cloudflare e QR Code do WhatsApp.
  - `ui/` (4 arquivos): Command Palette, Activity Feed, WhatsApp floating e Domain Cards.
  - `ecommerce/` (2 arquivos): Painel de precificação e analytics de loja.
  - `clientes/` (1 arquivo): Gestão documental de clientes.

### 1.2. Baseline do Mobile (`gsa-admin-mobile`)
- **Framework & Runtime:** React Native 0.86.3, Expo 57.0.24, React 19.2.3, TypeScript 6.0.3 (`strict: true`).
- **Persistência & Conectividade:** `@supabase/supabase-js` v2.116.0, `@react-native-async-storage/async-storage` 2.2.0, `react-native-url-polyfill` 4.0.0.
- **Estado Atual da UI:** Arquivo monolítico provisório `src/Screens.tsx` (678 linhas) com 12 telas básicas/protótipo.
- **Auditoria de Compilação TypeScript Inicial:**
  - Execução de `npx tsc --noEmit` falha atualmente com código de erro 1:
    - `src/Screens.tsx(115,27): error TS7006: Parameter 'val' implicitly has an 'any' type.`
    - `src/Screens.tsx(146,27): error TS7006: Parameter 'val' implicitly has an 'any' type.`
  - **Causa Raiz:** O callback do método `Alert.prompt` omite a anotação explícita de tipo `(val: string | undefined)`.
  - **Ação Imediata da Fase 1:** Corrigir os parâmetros para tipagem explícita e modularizar as telas em arquivos dedicados dentro de `src/screens/`.

---

## 2. Comparativo de Arquitetura: Web Admin vs Mobile App

| Dimensão | ERP Web Admin (`src/components/admin`) | Mobile App (`gsa-admin-mobile`) | Estratégia de Migração / Adaptação |
| :--- | :--- | :--- | :--- |
| **Navegação & Roteamento** | Navegação orientada a URL/Query Params (`useAppLocation`, `?module=X&tab=Y`), `navigate()`, histórico do browser. | Navegação por máquina de estado e menu overlay em `App.tsx` (`currentScreen` state) ou Stack nativo. | Mapear cada módulo para um ID único de tela em `App.tsx` e registrar no seletor de módulos `menuModules`. |
| **Layout & Grid** | Telas Widescreen Desktop (1920x1080), grids Tailwind de 12 colunas, sidebars fixas com `min-w-[240px]`. | Telas Mobile verticais (360x800 a 430x932), orientação retrato estrita, Safe Areas nativas (`SafeAreaView`). | Layout fluido 100% largura (`flex: 1`), margens horizontais de 16pt, eliminação de colunas fixas maiores que a tela. |
| **Apresentação de Dados** | Tabelas HTML densas (`<table>`, `<thead>`, `<tbody>`) com 8 a 14 colunas de dados, ordenação e paginação. | `FlatList` nativo com `renderItem` em formato de **Cards Resumidos** com badge de status e linhas de metadados. | Substituição obrigatória de `<table>` por `FlatList` com `Card` interativo; toque no card abre modal/bottom sheet com dados completos. |
| **Entrada de Dados & Forms** | Formulários monolíticos com dezenas de inputs, uploaders de arrastar e soltar (drag & drop), tabelas inline. | Formulários verticais segmentados em seções colapsáveis, `ScrollView`, `KeyboardAvoidingView` e inputs nativos. | Segmentação em seções colapsáveis (Accordions), `TextInput` com `keyboardType` apropriado (`numeric`, `email-address`, etc). |
| **Autenticação & Sessão** | Tokens em Cookies/SessionStorage, integração direta com Auth do Supabase ou RBAC de colaborador. | Sessão serializada em `AsyncStorage` (`@gsa_admin_session`), login via PIN de 6 dígitos pela Edge Function `gsa-auth-session`. | Reutilizar `currentSession` existente no mobile para autenticar chamadas RPC e chamadas RLS do Supabase. |
| **Estilização** | Tailwind CSS (`className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200"`). | React Native `StyleSheet.create({ card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 } })`. | Transpor os tokens semânticos do Tailwind (cores neutras, azuis corporativos #17345f) para `StyleSheet` nativo. |
| **Ícones** | `lucide-react` (SVG para web). | Vetores nativos ou Emojis consistentes / ícones React Native. | Utilizar iconografia consistente e padronizada (emojis ou bibliotecas nativas como expo-symbols / vector-icons). |

---

## 3. Divisão em 6 Esquadrões de Domínio (Domain Squads)

Para migrar todos os 68 módulos administrativos sem concorrência ou conflitos de mesclagem, dividimos o escopo em **6 Domain Squads** paralelos, perfeitamente balanceados por afinidade de negócio, tabelas e volume de código:

```
                               ┌─────────────────────────────────────────┐
                               │       GSA ADMIN MOBILE APP ROOT         │
                               │      (App.tsx + verify-parity.js)       │
                               └────────────────────┬────────────────────┘
                                                    │
       ┌────────────────────┬───────────────────────┼───────────────────────┬────────────────────┐
       │                    │                       │                       │                    │
┌──────┴───────┐     ┌──────┴───────┐        ┌──────┴───────┐        ┌──────┴───────┐     ┌──────┴───────┐     ┌──────────────┐
│   SQUAD 1    │     │   SQUAD 2    │        │   SQUAD 3    │        │   SQUAD 4    │     │   SQUAD 5    │     │   SQUAD 6    │
│  Operações   │     │  Comércio &  │        │ Financeiro,  │        │  CRM, Apoio  │     │ Crescimento, │     │ Governança,  │
│  & Demandas  │     │    Loja      │        │  Cobrança &  │        │  & Proteção  │     │ Afiliados &  │     │   Infra &    │
│  (8 módulos) │     │ (11 módulos) │        │   Crédito    │        │ (8 módulos)  │     │    Mídia     │     │  Relatórios  │
│              │     │              │        │ (10 módulos) │        │              │     │ (14 módulos) │     │ (17 módulos) │
└──────────────┘     └──────────────┘        └──────────────┘        └──────────────┘     └──────────────┘     └──────────────┘
```

### Squad 1: Core Operations & Demandas (Workstations & Field Services)
- **Diretório Alvo Mobile:** `gsa-admin-mobile/src/screens/operations/`
- **Módulos Principais (8 módulos):**
  1. `OrcamentosModule.tsx` (Orçamentos, propostas, itens de orçamento, conversão em OS)
  2. `OrdensServicoModule.tsx` (Ordens de serviço, status de execução, garantias)
  3. `OrdensAssinaturaModule.tsx` (Contratos recorrentes de serviço)
  4. `OrdensCompraModule.tsx` (Pedidos de suprimentos e materiais de serviço)
  5. `DemandasColaboradorModule.tsx` (Fila de despacho de demandas para colaboradores)
  6. `PrestadoresModule.tsx` (Cadastro, aprovação e checklist de prestadores de serviço)
  7. `PartnersAdminModule.tsx` (Gestão de parceiros operacionais homologados)
  8. `VendasModule.tsx` (Visão operacional de conversão de orçamentos em vendas)
- **Subcomponentes e Views Vinculados:**
  - `src/components/admin/demandas/*` (6 arquivos: `DemandasKanban`, `DemandasTabela`, `DemandasDetalhesModal`, etc.)
  - `src/components/admin/prestadores/*` (7 arquivos: `PrestadoresCadastro`, `PrestadoresDemandas`, `PrestadoresFinanceiro`, etc.)
  - `src/components/admin/super-domains/operacoes/*` (`OrcamentosWorkstation`, `OrdensServicoWorkstation`, `DemandasWorkstation`)

### Squad 2: Commerce, Store & Catalog (GSA Store, Products & Promotions)
- **Diretório Alvo Mobile:** `gsa-admin-mobile/src/screens/commerce/`
- **Módulos Principais (11 módulos):**
  1. `ProdutosModule.tsx` (Catálogo de produtos físicos e digitais, estoque, variações)
  2. `ServicosModule.tsx` (Catálogo de serviços tabelados)
  3. `ServicePackagesModule.tsx` (Combos e pacotes de serviços integrados)
  4. `LojaCategoriasModule.tsx` (Taxonomia, departamentos e categorias do marketplace)
  5. `LojaTrocasModule.tsx` (Fluxo de pós-venda, devoluções, trocas e reinserção de estoque)
  6. `CuponsLojaModule.tsx` (Motor de cupons de desconto, regras de uso e validade)
  7. `PromocoesModule.tsx` (Regras promocionais ativas da loja)
  8. `PromocaoQuantidadeModule.tsx` (Descontos progressivos por quantidade atacado/varejo)
  9. `PromocaoQuantidadeForm.tsx` (Formulário de configuração de faixas de desconto)
  10. `PromoAnalytics.tsx` (Indicadores de conversão e ROI de promoções)
  11. `PromoDetalhesModal.tsx` (Inspeção aprofundada de campanha promocional)
- **Subcomponentes e Views Vinculados:**
  - `src/components/admin/products/*` (8 arquivos: modais de importação, leitores de código)
  - `src/components/admin/ecommerce/*` (2 arquivos: `EcommerceAnalytics`, `PricingPanel`)
  - `src/components/admin/super-domains/operacoes/CatalogoSubDomain.tsx`

### Squad 3: Financial, Credit & Billing (Finanças, Cobrança & Faturamento)
- **Diretório Alvo Mobile:** `gsa-admin-mobile/src/screens/financial/`
- **Módulos Principais (10 módulos):**
  1. `FinanceiroModule.tsx` (Livro-caixa, contas a pagar/receber, conciliação bancária)
  2. `CobrancaModule.tsx` (Régua de cobrança de inadimplentes, protestos, notificações)
  3. `FiscalModule.tsx` (Emissão e controle de Notas Fiscais de Serviço/Produto)
  4. `CreditoModule.tsx` (Crédito consignado/loja, análise de limite de crédito)
  5. `EmprestimosModule.tsx` (Simulação e gestão de contratos de empréstimo)
  6. `PainelRentabilidade.tsx` (DRE operacional, margem de contribuição por serviço)
  7. `ReembolsosModule.tsx` (Aprovação de reembolsos e devolução de valores)
  8. `CalculatorProAdminPanel.tsx` (Precificação de taxas de gateway e maquininhas)
  9. `CalculatorProPaymentConfiguration.tsx` (Parâmetros de juros e parcelamento)
  10. `ShopeeOperationsModule.tsx` (Conciliação financeira de repasses Shopee/Marketplace)
- **Subcomponentes e Views Vinculados:**
  - `src/components/admin/super-domains/financeiro/*` (11 arquivos: `FaturamentoView`, `FluxoCaixaView`, `CobrancaView`, `FiscalView`, etc.)

### Squad 4: CRM, VIP, Support & Protection (Clientes, Benefícios & Saúde)
- **Diretório Alvo Mobile:** `gsa-admin-mobile/src/screens/crm/`
- **Módulos Principais (8 módulos):**
  1. `ClientesModule.tsx` (CRM 360º de clientes PF e PJ, histórico completo)
  2. `CadastroModule.tsx` (Central de novos cadastros unificados)
  3. `AreaVIPModule.tsx` (Gestão de membros VIP, benefícios e status de anuidade)
  4. `TicketsModule.tsx` (Helpdesk, chamados de suporte, atendimento e SLA)
  5. `ProtectionAdminModule.tsx` (Gestão de planos GSA Saúde e GSA Seguros)
  6. `EmpresaModule.tsx` (Hub de contas corporativas e convênios PJ)
  7. `IndicacoesModule.tsx` (Programa 'Indique e Ganhe', rastreamento de leads)
  8. `ClassifiedsModule.tsx` (Moderação de anúncios classificados da comunidade)
- **Subcomponentes e Views Vinculados:**
  - `src/components/admin/clientes/AdminClienteDocumentos.tsx`
  - `src/components/admin/super-domains/contratos/*` (8 arquivos: `AreaVipView`, `CrmClientesView`, `GsaSaudeView`, `GsaSegurosView`, etc.)

### Squad 5: Growth, Affiliates, Loyalty & Media (Parcerias, Mídia & GSA TV)
- **Diretório Alvo Mobile:** `gsa-admin-mobile/src/screens/growth/`
- **Módulos Principais (14 módulos):**
  1. `AffiliateAdminModule.tsx` (Rede de afiliados, comissões, links de indicação)
  2. `PremiosModule.tsx` (Catálogo de prêmios por pontuação de fidelidade)
  3. `VouchersModule.tsx` (Emissão, validação e resgate de vouchers digitais)
  4. `AdvertisingAdminModule.tsx` (Campanhas de banners e patrocínios)
  5. `TravelAdminModule.tsx` (GSA Viagens: pacotes turísticos, passagens, reservas)
  6. `ViagensCategoriasModule.tsx` (Categorias e destinos turísticos cadastrados)
  7. `CareersAdminModule.tsx` (Candidaturas e processos seletivos do GSA Carreiras)
  8. `CareerVacanciesManager.tsx` (Abertura e edição de vagas de emprego)
  9. `GsaTvModule.tsx` (Painel central da emissora GSA TV)
  10. `GsaTvControlRoom.tsx` (Sala de controle da transmissão ao vivo)
  11. `GsaTvLiveConsole.tsx` (Console de telemetria da transmissão em tempo real)
  12. `GsaTvLiveSources.tsx` (Gestão de fluxos RTMP, SRT e câmeras de estúdio)
  13. `GsaTvGraphics.tsx` (GCs, lower thirds e vinhetas dinâmicas)
  14. `GsaTvRights.tsx` (Contratos de direitos de transmissão e acervo musical)
- **Subcomponentes e Views Vinculados:**
  - `src/components/admin/gsa-tv/*` (10 arquivos: `GsaTvMasterControl`, `GsaTvAiStudioTab`, `GsaTvLibraryTab`, etc.)
  - `src/components/admin/super-domains/pessoas/AfiliadosSection.tsx`

### Squad 6: Governance, Platform Infrastructure & Reports (Governança, Infra & Relatórios)
- **Diretório Alvo Mobile:** `gsa-admin-mobile/src/screens/governance/`
- **Módulos Principais (17 módulos):**
  1. `Dashboard.tsx` (Cockpit executivo geral da diretoria)
  2. `CollaboratorDashboard.tsx` (Painel resumido de métricas do colaborador)
  3. `ConfiguracoesModule.tsx` (Parâmetros globais, chaves de API, webhooks)
  4. `AcessosModule.tsx` (Matriz de permissões RBAC, gestão de logins administrativos)
  5. `RelatoriosModule.tsx` (Gerador consolidado de relatórios analíticos)
  6. `SystemMonitorModule.tsx` (Monitoramento de CPU, memória, latência e VPS)
  7. `SystemStatusIndicator.tsx` (Indicador de integridade dos serviços em tempo real)
  8. `WhatsAppHealthMonitor.tsx` (Monitor de conexão da Evolution API e instâncias WhatsApp)
  9. `AdminNavigation.tsx` (Configurador de menus e taxonomia administrativa)
  10. `FornecedoresModule.tsx` (Homologação, pedidos de compra e histórico de fornecedores)
  11. `AssinaturasModule.tsx` (Gestão de planos recorrentes do sistema)
  12. `ScrapingAdminModule.tsx` (Agendamento e logs de robôs de automação/scraping)
  13. `ScrapingExecutionMonitorModal.tsx` (Monitor ao vivo da execução de scrapers)
  14. `SiteCampaignAdminModule.tsx` (Campanhas de banners e avisos no portal público)
  15. `SiteCampaignAdminPage.tsx` (Página de administração de campanhas de site)
  16. `SiteCampaignDeletionPanel.tsx` (Painel de exclusão segura e auditoria de banners)
  17. `SiteCampaignPermissionMatrix.tsx` (Permissões de edição de campanhas)
- **Subcomponentes e Views Vinculados:**
  - `src/components/admin/relatorios/*` (15 arquivos de relatórios setoriais)
  - `src/components/admin/infra/*` (4 arquivos de terminal VPS e Cloudflare)
  - `src/components/admin/super-domains/governanca/*` (8 arquivos)

---

## 4. Diretrizes de Adaptação Mobile UX & Rubric Agent-as-Judge

Para assegurar nota máxima no critério **UX Adaptation (Agent-as-Judge)** da Acceptance Criteria, todos os esquadrões devem seguir estritamente as regras de conversão abaixo.

### 4.1. Regra de Ouro: Proibição de Elementos Rígidos de Desktop
- **PROIBIDO:** Usar larguras fixas maiores que 100% ou maiores que 420px (ex: `width: 800`, `width: 1200`, `minWidth: 900`).
- **PROIBIDO:** Renderizar tabelas HTML ou simular colunas fixas em linha que forcem scroll horizontal acidental ou quebrem o layout na horizontal.
- **OBRIGATÓRIO:** Todo container deve utilizar `flex: 1`, `width: '100%'`, ou margens horizontais percentuais/dinâmicas.

### 4.2. Padrão de Conversão "Table-to-Card" (Lista de Cards Responsivos)
Qualquer tabela de dados do desktop (ex: listagem de clientes, faturas ou pedidos) deve ser convertida na estrutura canônica de Card Mobile:

```tsx
// Exemplo canônico de Card Mobile aprovado:
<TouchableOpacity style={styles.card} onPress={() => handleOpenDetails(item)}>
  {/* Linha Superior: Título/Identificador + Badge de Status */}
  <View style={styles.cardHeader}>
    <Text style={styles.cardTitle} numberOfLines={1}>{item.nome || item.titulo}</Text>
    <View style={[styles.badge, { backgroundColor: getStatusColor(item.status).bg }]}>
      <Text style={[styles.badgeText, { color: getStatusColor(item.status).text }]}>
        {item.status.toUpperCase()}
      </Text>
    </View>
  </View>

  {/* Corpo: 2 a 3 linhas de metadados chave */}
  <View style={styles.cardBody}>
    <Text style={styles.cardMetaText}>📅 Data: {formatDate(item.created_at)}</Text>
    <Text style={styles.cardMetaText}>💰 Valor: R$ {formatCurrency(item.valor_total)}</Text>
  </View>

  {/* Rodapé do Card: Ações Rápidas com Touch Targets >= 44x44 */}
  <View style={styles.cardFooter}>
    <TouchableOpacity style={styles.secondaryButton} onPress={() => handleAction(item)}>
      <Text style={styles.secondaryButtonText}>Ações</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.primaryButton} onPress={() => handleOpenDetails(item)}>
      <Text style={styles.primaryButtonText}>Ver Detalhes →</Text>
    </TouchableOpacity>
  </View>
</TouchableOpacity>
```

### 4.3. Padrão de Formulários e Modais Mobile
1. **Formulários Longos:** Divididos em seções colapsáveis (`Accordion` ou abas superiores navegáveis com chips horizontais).
2. **Keyboard Management:** Obrigatório envolver formulários em `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>` e `<ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">`.
3. **Touch Targets (Apple HIG & Material Standard):**
   - Todo botão, input ou elemento clicável deve possuir área mínima de toque de **44 x 44 pontos**.
   - Espaçamento vertical mínimo de **8 pontos** entre campos para evitar toques acidentais.
4. **Modais & Drawers:**
   - Usar `<Modal animationType="slide" transparent={true}>` com backdrop escurecido (`backgroundColor: 'rgba(0,0,0,0.5)'`).
   - O conteúdo do modal deve ser ancorado no rodapé (Bottom Sheet) ou em tela cheia com barra superior de fechamento fácil (`✕ Fechar`).

### 4.4. Filtros e Pesquisa em Tela Pequena
- Campo de busca textual fixo no topo com botão rápido de limpar (`✕`).
- Carrossel horizontal de filtros rápidos com chips clicáveis:
  `[ Todos ] [ Pendentes ] [ Aprovados ] [ Vencidos ]`
- Botão "Filtros Avançados ⚙️" que abre um Bottom Sheet com filtros de data, categoria e status para não poluir a tela principal.

### 4.5. Matriz de Avaliação do Agent-as-Judge (Rubric de 100 Pontos)

| Critério | Peso | Verificação Automatizável / Inspeção | Desqualificador Fatal (Eliminação) |
| :--- | :---: | :--- | :--- |
| **C1. Ausência de Larguras Fixas de Desktop** | 25 pts | Nenhum elemento com `width > 450` ou `minWidth > 450`. | Presença de elemento com largura fixa > 600px = **0 pts**. |
| **C2. Adaptação Table-to-Card** | 25 pts | 100% das listagens utilizam `FlatList` ou `ScrollView` com Cards estilizados e legíveis. | Presença de tag `<table>` ou colunas esmagadas sem quebra = **0 pts**. |
| **C3. Touch Targets & Ergonomia (>= 44x44)** | 20 pts | Botões e ícones clicáveis possuem `minHeight: 44`, `minWidth: 44` ou padding suficiente. | Botões minúsculos (< 24px) inacessíveis ao toque = **-15 pts**. |
| **C4. Gestão de Teclado & Formulários** | 15 pts | Uso de `KeyboardAvoidingView` e `ScrollView` em formulários de inserção/edição. | Input coberto pelo teclado sem possibilidade de scroll = **-10 pts**. |
| **C5. Estados de Carregamento e Vazio** | 15 pts | Presença de `ActivityIndicator` em requisições e `ListEmptyComponent` em listas sem dados. | Tela travada em branco sem feedback visual = **-10 pts**. |

**Nota de Corte:** Mínimo de **85 pontos** em todos os módulos para aprovação final pelo Agent-as-Judge.

---

## 5. Design e Implementação do Script de Verificação Automatizada

Para cumprir a Acceptance Criteria:
> *"Programmatic script confirms that for every `.tsx` component found in the web `src/components/admin/` folder, a corresponding React Native screen exists and is correctly routed in `App.tsx`."*

Desenvolvemos e validamos a ferramenta `verify-parity.js`. O script realiza parsing estático robusto tanto da estrutura de arquivos quanto do código de `App.tsx`.

### 5.1. Lógica Exata do Script
1. **Descoberta do Diretório Web:** Varre `src/components/admin/` e localiza todos os 68 arquivos `.tsx` de módulos administrativos (ignorando arquivos de backup `.bak`).
2. **Descoberta das Telas Mobile:** Varre recursivamente `gsa-admin-mobile/src/screens/` localizando todos os arquivos `.tsx`.
3. **Mapeamento Flexível e Canônico:** Para cada componente web `<Nome>.tsx`, valida a existência de um arquivo equivalente no mobile aceitando:
   - `<Nome>.tsx`
   - `<Nome>Screen.tsx`
   - `<NomeSemModule>Screen.tsx`
4. **Auditoria de Importação em `App.tsx`:** Lê o arquivo `App.tsx` e verifica se o identificador correspondente da tela foi devidamente importado (`import { ... } from './src/screens'`).
5. **Auditoria de Roteamento em `App.tsx`:** Verifica se o componente da tela está associado a uma rota ou renderização condicional (ex: `<NomeScreen ... />` ou `currentScreen === '...'`).
6. **Relatório & Exit Code:**
   - Gera uma tabela ASCII detalhada de status de cada componente.
   - Apresenta o percentual de paridade total.
   - Retorna código de saída **0** somente se houver 100% de paridade (68/68 componentes mapeados, importados e roteados); caso contrário, retorna código **1** bloqueando o encerramento da tarefa.

### 5.2. Código do Script Canônico (`gsa-admin-mobile/scripts/verify-parity.js`)

```javascript
/**
 * Automated Parity Verification Script
 * Validates that 100% of Web Admin components in src/components/admin/
 * have corresponding mobile screens in gsa-admin-mobile/src/screens/
 * and are imported and routed in gsa-admin-mobile/App.tsx.
 */

const fs = require('fs');
const path = require('path');

let repoRoot = process.cwd();
if (fs.existsSync(path.join(repoRoot, 'src', 'components', 'admin'))) {
  // Executado na raiz do repositório
} else if (fs.existsSync(path.join(repoRoot, '..', 'src', 'components', 'admin'))) {
  // Executado dentro de gsa-admin-mobile
  repoRoot = path.resolve(repoRoot, '..');
} else {
  console.error('Erro fatal: Raiz do projeto não encontrada.');
  process.exit(1);
}

const webAdminDir = path.join(repoRoot, 'src', 'components', 'admin');
const mobileDir = path.join(repoRoot, 'gsa-admin-mobile');
const mobileScreensDir = path.join(mobileDir, 'src', 'screens');
const appTsxPath = path.join(mobileDir, 'App.tsx');

if (!fs.existsSync(webAdminDir)) {
  console.error(`Diretório Web Admin não encontrado: ${webAdminDir}`);
  process.exit(1);
}

if (!fs.existsSync(appTsxPath)) {
  console.error(`App.tsx não encontrado: ${appTsxPath}`);
  process.exit(1);
}

function getFilesRecursively(dir, ext = '.tsx') {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, ext));
    } else if (file.endsWith(ext) && !file.includes('.bak')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Coleta os componentes raiz do Web Admin
const rootWebComponents = fs.readdirSync(webAdminDir)
  .filter(f => f.endsWith('.tsx') && !f.includes('.bak'))
  .sort();

// 2. Coleta telas do mobile
const mobileScreenFiles = fs.existsSync(mobileScreensDir)
  ? getFilesRecursively(mobileScreensDir, '.tsx')
  : [];

// 3. Lê App.tsx
const appTsxContent = fs.readFileSync(appTsxPath, 'utf8');

console.log('='.repeat(85));
console.log('       RELATÓRIO DE PARIDADE AUTOMATIZADA: GSA WEB ERP -> ADMIN MOBILE');
console.log('='.repeat(85));
console.log(`Diretório Web Admin:   ${webAdminDir}`);
console.log(`Diretório Telas Mobile: ${mobileScreensDir}`);
console.log(`Arquivo App.tsx Mobile: ${appTsxPath}`);
console.log(`Total Módulos Web:      ${rootWebComponents.length}`);
console.log(`Telas Mobile Encontradas: ${mobileScreenFiles.length}`);
console.log('-'.repeat(85));

let passCount = 0;
let failCount = 0;
const results = [];

for (const comp of rootWebComponents) {
  const baseName = comp.replace(/\.tsx$/, '');

  const candidateFileNames = [
    `${baseName}.tsx`,
    `${baseName}Screen.tsx`,
    `${baseName.replace(/Module$/, '')}Screen.tsx`,
    `${baseName.replace(/AdminPanel$/, '')}Screen.tsx`,
    `${baseName.replace(/Page$/, '')}Screen.tsx`
  ];

  const candidateIdentifiers = [
    baseName,
    `${baseName}Screen`,
    `${baseName.replace(/Module$/, '')}Screen`,
    `${baseName.replace(/AdminPanel$/, '')}Screen`,
    `${baseName.replace(/Page$/, '')}Screen`
  ];

  // A. Verifica se o arquivo da tela existe em src/screens/
  let screenFileFound = null;
  for (const mFile of mobileScreenFiles) {
    const filename = path.basename(mFile);
    if (candidateFileNames.includes(filename)) {
      screenFileFound = path.relative(mobileDir, mFile);
      break;
    }
  }

  // B. Verifica se está importado em App.tsx
  let isImported = false;
  let matchedIdentifier = null;
  for (const ident of candidateIdentifiers) {
    const importRegex = new RegExp(`\\b${ident}\\b`);
    if (importRegex.test(appTsxContent)) {
      isImported = true;
      matchedIdentifier = ident;
      break;
    }
  }

  // C. Verifica se está roteado em App.tsx
  let isRouted = false;
  if (matchedIdentifier) {
    const jsxRegex = new RegExp(`<${matchedIdentifier}\\b`);
    const compPropRegex = new RegExp(`component=\\{?\\s*${matchedIdentifier}\\s*\\}?`);
    if (jsxRegex.test(appTsxContent) || compPropRegex.test(appTsxContent)) {
      isRouted = true;
    }
  }

  const isComplete = Boolean(screenFileFound && isImported && isRouted);
  if (isComplete) {
    passCount++;
  } else {
    failCount++;
  }

  results.push({
    webComponent: comp,
    screenFile: screenFileFound || 'MISSING',
    imported: isImported ? 'SIM' : 'NÃO',
    routed: isRouted ? 'SIM' : 'NÃO',
    status: isComplete ? 'PASS' : 'FAIL'
  });
}

// Imprime tabela de resultados
console.log(
  'Componente Web Admin'.padEnd(38) +
  'Arquivo Mobile'.padEnd(25) +
  'Import'.padEnd(8) +
  'Rota'.padEnd(8) +
  'Status'
);
console.log('-'.repeat(85));

for (const res of results) {
  const line =
    res.webComponent.padEnd(38) +
    (res.screenFile.length > 23 ? res.screenFile.substring(0, 20) + '...' : res.screenFile).padEnd(25) +
    res.imported.padEnd(8) +
    res.routed.padEnd(8) +
    (res.status === 'PASS' ? '✅ PASS' : '❌ FAIL');
  console.log(line);
}

console.log('='.repeat(85));
console.log(`TOTAL DE MÓDULOS WEB:   ${rootWebComponents.length}`);
console.log(`MÓDULOS MIGRADOS (PASS): ${passCount}`);
console.log(`PENDENTES / FALHAS:     ${failCount}`);
console.log(`TAXA DE PARIDADE:       ${((passCount / rootWebComponents.length) * 100).toFixed(1)}%`);
console.log('='.repeat(85));

if (failCount > 0) {
  console.log('\n❌ VERIFICAÇÃO REPROVADA: Existem componentes web sem tela correspondente ou sem rota em App.tsx.');
  if (!process.argv.includes('--allow-fail')) {
    process.exit(1);
  }
} else {
  console.log('\n✅ VERIFICAÇÃO APROVADA: 100% de paridade alcançada com sucesso!');
  process.exit(0);
}
```

---

## 6. Estratégia de Compilação TypeScript & Estabilidade

### 6.1. Diagnóstico do Baseline
Ao executar `npx tsc --noEmit` em `gsa-admin-mobile`, o compilador detectou dois erros de tipagem implícita:
```
src/Screens.tsx(115,27): error TS7006: Parameter 'val' implicitly has an 'any' type.
src/Screens.tsx(146,27): error TS7006: Parameter 'val' implicitly has an 'any' type.
```
No arquivo `src/Screens.tsx`, o handler `Alert.prompt` recebe uma função de callback com parâmetro sem tipo:
```typescript
// Antes (Erro TS7006):
onPress: async (val) => { ... }

// Correção Obrigatória:
onPress: async (val?: string) => { ... }
```

### 6.2. Regras de Rigor TypeScript para os Esquadrões
1. O arquivo `gsa-admin-mobile/tsconfig.json` possui `"strict": true`. Portanto, não é permitido `any` implícito.
2. Todas as props de componentes de tela devem possuir interfaces ou types explícitos (ex: `interface ScreenProps { session: any; onBack?: () => void; }`).
3. Chamadas Supabase devem tratar erros e retornos nulos de forma segura (`data || []`).
4. Ao término de cada tela migrada, o desenvolvedor deve rodar `npx tsc --noEmit` para garantir que o código compila perfeitamente sem quebrar a suíte.

---

## 7. Estrutura de Diretórios Recomendada no Mobile

Para organizar de forma limpa as 68 telas e evitar arquivos gigantescos, adote a seguinte estrutura dentro de `gsa-admin-mobile/src/`:

```
gsa-admin-mobile/
├── App.tsx
├── supabase.ts
├── scripts/
│   └── verify-parity.js             <-- Script de verificação automatizada
└── src/
    ├── components/                  <-- Componentes compartilhados de UI Mobile
    │   ├── MobileCard.tsx
    │   ├── MobileHeader.tsx
    │   ├── MobileFilterChips.tsx
    │   ├── MobileBottomSheet.tsx
    │   └── StatusBadge.tsx
    └── screens/
        ├── index.ts                 <-- Barrel export consolidado de todas as telas
        ├── operations/              <-- Squad 1 (8 telas + subcomponentes)
        │   ├── OrcamentosModuleScreen.tsx
        │   ├── OrdensServicoModuleScreen.tsx
        │   ├── OrdensAssinaturaModuleScreen.tsx
        │   ├── OrdensCompraModuleScreen.tsx
        │   ├── DemandasColaboradorModuleScreen.tsx
        │   ├── PrestadoresModuleScreen.tsx
        │   ├── PartnersAdminModuleScreen.tsx
        │   └── VendasModuleScreen.tsx
        ├── commerce/                <-- Squad 2 (11 telas)
        │   ├── ProdutosModuleScreen.tsx
        │   ├── ServicosModuleScreen.tsx
        │   ├── ServicePackagesModuleScreen.tsx
        │   ├── LojaCategoriasModuleScreen.tsx
        │   ├── LojaTrocasModuleScreen.tsx
        │   ├── CuponsLojaModuleScreen.tsx
        │   ├── PromocoesModuleScreen.tsx
        │   ├── PromocaoQuantidadeModuleScreen.tsx
        │   ├── PromocaoQuantidadeFormScreen.tsx
        │   ├── PromoAnalyticsScreen.tsx
        │   └── PromoDetalhesModalScreen.tsx
        ├── financial/               <-- Squad 3 (10 telas)
        │   ├── FinanceiroModuleScreen.tsx
        │   ├── CobrancaModuleScreen.tsx
        │   ├── FiscalModuleScreen.tsx
        │   ├── CreditoModuleScreen.tsx
        │   ├── EmprestimosModuleScreen.tsx
        │   ├── PainelRentabilidadeScreen.tsx
        │   ├── ReembolsosModuleScreen.tsx
        │   ├── CalculatorProAdminPanelScreen.tsx
        │   ├── CalculatorProPaymentConfigurationScreen.tsx
        │   └── ShopeeOperationsModuleScreen.tsx
        ├── crm/                     <-- Squad 4 (8 telas)
        │   ├── ClientesModuleScreen.tsx
        │   ├── CadastroModuleScreen.tsx
        │   ├── AreaVIPModuleScreen.tsx
        │   ├── TicketsModuleScreen.tsx
        │   ├── ProtectionAdminModuleScreen.tsx
        │   ├── EmpresaModuleScreen.tsx
        │   ├── IndicacoesModuleScreen.tsx
        │   └── ClassifiedsModuleScreen.tsx
        ├── growth/                  <-- Squad 5 (14 telas)
        │   ├── AffiliateAdminModuleScreen.tsx
        │   ├── PremiosModuleScreen.tsx
        │   ├── VouchersModuleScreen.tsx
        │   ├── AdvertisingAdminModuleScreen.tsx
        │   ├── TravelAdminModuleScreen.tsx
        │   ├── ViagensCategoriasModuleScreen.tsx
        │   ├── CareersAdminModuleScreen.tsx
        │   ├── CareerVacanciesManagerScreen.tsx
        │   ├── GsaTvModuleScreen.tsx
        │   ├── GsaTvControlRoomScreen.tsx
        │   ├── GsaTvLiveConsoleScreen.tsx
        │   ├── GsaTvLiveSourcesScreen.tsx
        │   ├── GsaTvGraphicsScreen.tsx
        │   └── GsaTvRightsScreen.tsx
        └── governance/              <-- Squad 6 (17 telas)
            ├── DashboardScreen.tsx
            ├── CollaboratorDashboardScreen.tsx
            ├── ConfiguracoesModuleScreen.tsx
            ├── AcessosModuleScreen.tsx
            ├── RelatoriosModuleScreen.tsx
            ├── SystemMonitorModuleScreen.tsx
            ├── SystemStatusIndicatorScreen.tsx
            ├── WhatsAppHealthMonitorScreen.tsx
            ├── AdminNavigationScreen.tsx
            ├── FornecedoresModuleScreen.tsx
            ├── AssinaturasModuleScreen.tsx
            ├── ScrapingAdminModuleScreen.tsx
            ├── ScrapingExecutionMonitorModalScreen.tsx
            ├── SiteCampaignAdminModuleScreen.tsx
            ├── SiteCampaignAdminPageScreen.tsx
            ├── SiteCampaignDeletionPanelScreen.tsx
            └── SiteCampaignPermissionMatrixScreen.tsx
```

### 7.1. O Arquivo Barrel `src/screens/index.ts`
Todas as telas são reexportadas a partir de `src/screens/index.ts`:
```typescript
export * from './operations/OrcamentosModuleScreen';
export * from './operations/OrdensServicoModuleScreen';
// ... todas as 68 telas reexportadas
```
Isso permite que em `App.tsx` a importação seja consolidada e limpa:
```typescript
import {
  OrcamentosModuleScreen,
  ClientesModuleScreen,
  FinanceiroModuleScreen,
  // ...
} from './src/screens';
```

---

## 8. Plano de Ação & Roteiro de Orquestração

Para o Agente Orquestrador / Equipe de Execução:

1. **Fase 1: Preparação da Fundação (Sprint 0)**
   - Corrigir os dois erros TS7006 em `gsa-admin-mobile/src/Screens.tsx`.
   - Criar os diretórios `gsa-admin-mobile/src/screens/{operations,commerce,financial,crm,growth,governance,shared}` e `gsa-admin-mobile/scripts/`.
   - Instalar e testar o script `gsa-admin-mobile/scripts/verify-parity.js`.

2. **Fase 2: Execução Paralela dos 6 Esquadrões (Sprint 1)**
   - Despachar os 6 Esquadrões em paralelo, cada um com sua lista de módulos atribuída.
   - Cada squad implementa telas nativas com componentes `View`, `Text`, `FlatList`, `TouchableOpacity` e `StyleSheet`.
   - Aplicação estrita das diretrizes Mobile UX (Cards, touch targets >= 44x44, sem larguras fixas > 450px).

3. **Fase 3: Consolidação e Roteamento (Sprint 2)**
   - Criar o arquivo `src/screens/index.ts` com todos os exports.
   - Atualizar o menu lateral e o `switch` de roteamento de `App.tsx` para cobrir todas as 68 telas.

4. **Fase 4: Verificação Automatizada e Compilação (Sprint 3)**
   - Executar `node scripts/verify-parity.js` -> Deve reportar 100% de paridade (68/68 PASS) com código de saída 0.
   - Executar `npx tsc --noEmit` -> Deve compilar com código de saída 0 sem warnings ou erros de tipo.

5. **Fase 5: Avaliação Agent-as-Judge UX**
   - Agente revisor independente executa inspeção estética baseada no Rubric de 100 pontos para assegurar ausência de tabelas rígidas de desktop.
