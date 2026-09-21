# Relatório de Auditoria R3: Limpeza Estrutural e Inventário de Código Morto

**Auditor:** `explorer_diag_cleanup_1`  
**Data:** 2026-08-21T22:16:00Z  
**Escopo:** Auditoria R3 (Limpeza Estrutural) — `src/components/admin/` e diretórios complementares em `src/`  
**Status da Auditoria:** Concluída com Sucesso  

---

## 1. Observation (Observações Diretas)

### 1.1 Inventário do Grafo de Dependências
Executamos uma varredura exaustiva e transitiva do grafo de importações a partir de todos os pontos de entrada da aplicação (`src/main.tsx`, `src/App.tsx`, `src/pages/*`, `src/routing/*`):
- **Total de arquivos em `src/`:** 495 arquivos
- **Total de arquivos em `src/components/admin/`:** 166 arquivos
- **Arquivos alcançáveis em `src/components/admin/` no runtime:** 125 arquivos
- **Arquivos inalcançáveis / mortos em `src/components/admin/` no runtime:** 41 arquivos (**36.543 linhas de código**)
- **Arquivos inalcançáveis / órfãos em outros diretórios de `src/`:** 20 arquivos UI/hooks/utils (**4.215 linhas de código**)

---

### 1.2 Mapeamento dos 27 Componentes Ativos em `src/components/admin/`
Os seguintes 27 arquivos na raiz de `src/components/admin/` **permanecem em uso ativo** porque são importados diretamente pelos novos Super-Domínios (`src/components/admin/super-domains/`) ou pelo shell de navegação (`AdminPanel.tsx`):

| Arquivo | Importado Por (Consumidor Ativo) | Motivo de Preservação |
|---|---|---|
| `AdminNavigation.tsx` | `AdminPanel.tsx`, `super-domains-adversarial-challenger.test.ts`, `super-domains-e2e.test.ts` | Barra de navegação e switcher de super-domínios |
| `AdvertisingAdminModule.tsx` | `operacoes/MidiaOperacoesSubDomain.tsx` | Submódulo de gestão de publicidade |
| `AssinaturasModule.tsx` | `operacoes/CatalogoSubDomain.tsx` | Submódulo de gestão de planos de assinatura |
| `CalculatorProAdminPanel.tsx` | `governanca/GovernancaConfiguracoesView.tsx` | Painel de configuração das calculadoras CLT/PJ |
| `CalculatorProPaymentConfiguration.tsx` | `governanca/GovernancaConfiguracoesView.tsx` | Configurações de gateway das calculadoras |
| `ClassifiedsModule.tsx` | `operacoes/MidiaOperacoesSubDomain.tsx` | Submódulo de classificados |
| `CollaboratorDashboard.tsx` | `AdminPanel.tsx` | Dashboard isolado para perfil restrito de colaborador |
| `DemandasColaboradorModule.tsx` | `operacoes/DemandasWorkstation.tsx`, `AdminPanel.tsx` | Painel operacional e isolado de demandas |
| `FornecedoresModule.tsx` | `TravelAdminModule.tsx` | Fornecedores vinculados a viagens/logística |
| `GsaTvModule.tsx` | `operacoes/MidiaOperacoesSubDomain.tsx` | Mídia e transmissões corporativas |
| `LojaCategoriasModule.tsx` | `operacoes/CatalogoSubDomain.tsx` | Categorização da GSA Store |
| `OrdensAssinaturaModule.tsx` | `operacoes/ComprasAssinaturasWorkstation.tsx` | Workstation de ordens de assinatura |
| `OrdensCompraModule.tsx` | `operacoes/ComprasAssinaturasWorkstation.tsx` | Workstation de pedidos de compra |
| `PainelRentabilidade.tsx` | `financeiro/RentabilidadeReembolsosView.tsx`, `operacoes/OrcamentosWorkstation.tsx`, `operacoes/OrdensServicoWorkstation.tsx` | Cálculo tático de rentabilidade operacional |
| `ProdutosModule.tsx` | `operacoes/CatalogoSubDomain.tsx` | Catálogo de produtos da loja |
| `ScrapingAdminModule.tsx` | `operacoes/AutomacaoOperacoesSubDomain.tsx` | Painel de scraping e integrações de dados |
| `ScrapingExecutionMonitorModal.tsx` | `ScrapingAdminModule.tsx` | Modal de monitoramento de scraping |
| `ServicePackagesModule.tsx` | `operacoes/CatalogoSubDomain.tsx` | Pacotes de serviços consolidados |
| `ServicosModule.tsx` | `operacoes/CatalogoSubDomain.tsx` | Catálogo base de serviços |
| `ShopeeOperationsModule.tsx` | `operacoes/AutomacaoOperacoesSubDomain.tsx` | Automação e operações Shopee |
| `SiteCampaignAdminModule.tsx` | `SiteCampaignAdminPage.tsx` | Gestão de campanhas e banners |
| `SiteCampaignAdminPage.tsx` | `operacoes/MidiaOperacoesSubDomain.tsx` | Página de campanhas dentro do SD1 |
| `SiteCampaignDeletionPanel.tsx` | `SiteCampaignAdminPage.tsx` | Painel de expurgo seguro de campanhas |
| `SiteCampaignPermissionMatrix.tsx` | `SiteCampaignAdminPage.tsx` | Matriz de permissões de campanhas |
| `SystemStatusIndicator.tsx` | `AdminPanel.tsx` | Indicador de saúde no header global |
| `TravelAdminModule.tsx` | `operacoes/ViagensSubDomain.tsx` | Operações e pacotes de viagens |
| `ViagensCategoriasModule.tsx` | `TravelAdminModule.tsx` | Categorias de pacotes de viagem |

---

### 1.3 Categorização dos 41 Arquivos Inalcançáveis em `src/components/admin/`

#### **Categoria 1: Órfãos Puros (0 referências no projeto inteiro — 6 arquivos / 3.224 linhas)**
Arquivos que não são importados em nenhum lugar de `src/`, não são referenciados em `scripts/` e não são usados em nenhum teste.
1. `src/components/admin/AreaVIPModule.tsx` (1.332 linhas) — Substituído por `contratos/AreaVipView.tsx`
2. `src/components/admin/EmpresaModule.tsx` (196 linhas) — Substituído por `contratos/HubEmpresasView.tsx`
3. `src/components/admin/PrestadoresModule.tsx` (142 linhas) — Substituído por `pessoas/PrestadoresSection.tsx`
4. `src/components/admin/PromocoesModule.tsx` (561 linhas) — Substituído por `pessoas/FidelidadePromocoesSection.tsx`
5. `src/components/admin/TicketsModule.tsx` (793 linhas) — Substituído por `contratos/AtendimentoTicketsView.tsx`
6. `src/components/admin/products/ProductVariationsEditor.tsx` (200 linhas) — Substituído por modal interno em `ProdutosModule.tsx`

#### **Categoria 2: Subárvores Legadas Mortas (Importados apenas por outros arquivos mortos — 23 arquivos / 27.646 linhas)**
Estes arquivos só eram importados pelos orquestradores legados monolíticos (`CadastroModule`, `FinanceiroModule`, `VendasModule`, etc.) que não são mais carregados no runtime. Não possuem qualquer menção em `scripts/` ou `tests/`.
1. `src/components/admin/ClientesModule.tsx` (3.165 linhas) — Substituído por `contratos/CrmClientesView.tsx`
2. `src/components/admin/CobrancaModule.tsx` (1.980 linhas) — Substituído por `financeiro/CobrancaView.tsx`
3. `src/components/admin/CreditoModule.tsx` (2.203 linhas) — Substituído por `financeiro/EmprestimosCreditoView.tsx`
4. `src/components/admin/CuponsLojaModule.tsx` (742 linhas) — Substituído por `pessoas/FidelidadePromocoesSection.tsx`
5. `src/components/admin/EmprestimosModule.tsx` (1.173 linhas) — Substituído por `financeiro/EmprestimosCreditoView.tsx`
6. `src/components/admin/FinanceiroModule.tsx` (3.287 linhas) — Substituído por `financeiro/FaturamentoView.tsx` e `FluxoCaixaView.tsx`
7. `src/components/admin/IndicacoesModule.tsx` (640 linhas) — Substituído por `pessoas/AfiliadosSection.tsx`
8. `src/components/admin/LojaTrocasModule.tsx` (777 linhas) — Substituído por `operacoes/ComprasAssinaturasWorkstation.tsx`
9. `src/components/admin/OrcamentosModule.tsx` (2.729 linhas) — Substituído por `operacoes/OrcamentosWorkstation.tsx`
10. `src/components/admin/OrdensServicoModule.tsx` (1.052 linhas) — Substituído por `operacoes/OrdensServicoWorkstation.tsx`
11. `src/components/admin/PremiosModule.tsx` (864 linhas) — Substituído por `pessoas/FidelidadePromocoesSection.tsx`
12. `src/components/admin/PromoAnalytics.tsx` (157 linhas) — Substituído por `pessoas/FidelidadePromocoesSection.tsx`
13. `src/components/admin/PromocaoQuantidadeForm.tsx` (466 linhas) — Substituído por `pessoas/FidelidadePromocoesSection.tsx`
14. `src/components/admin/PromocaoQuantidadeModule.tsx` (191 linhas) — Substituído por `pessoas/FidelidadePromocoesSection.tsx`
15. `src/components/admin/PromoDetalhesModal.tsx` (316 linhas) — Substituído por `pessoas/FidelidadePromocoesSection.tsx`
16. `src/components/admin/ReembolsosModule.tsx` (830 linhas) — Substituído por `financeiro/RentabilidadeReembolsosView.tsx`
17. `src/components/admin/VouchersModule.tsx` (803 linhas) — Substituído por `pessoas/FidelidadePromocoesSection.tsx`
18. `src/components/admin/clientes/AdminClienteDocumentos.tsx` (587 linhas) — Substituído por `contratos/ContratosDocumentosView.tsx`
19. `src/components/admin/ecommerce/EcommerceAnalytics.tsx` (123 linhas) — Substituído por `governanca/GovernancaExecutiveDashboard.tsx`
20. `src/components/admin/ecommerce/PricingPanel.tsx` (237 linhas) — Substituído por `financeiro/CalculadorasGatewayView.tsx`
21. `src/components/admin/prestadores/PrestadoresCadastro.tsx` (1.621 linhas) — Substituído por `pessoas/PrestadoresSection.tsx`
22. `src/components/admin/prestadores/PrestadoresDemandas.tsx` (3.012 linhas) — Substituído por `operacoes/DemandasWorkstation.tsx`
23. `src/components/admin/prestadores/PrestadoresFinanceiro.tsx` (691 linhas) — Substituído por `pessoas/SaquesRepassesSection.tsx`

#### **Categoria 3: Arquivos Inativos Presos por Testes de Contrato em `scripts/` (11 arquivos / 5.226 linhas)**
Estes arquivos foram integralmente substituídos pelos Super-Domínios e **não são executados no runtime**, mas ainda possuem asserções diretas de strings em scripts como `scripts/check-admin-panel-contracts.ts`:
1. `src/components/admin/AcessosModule.tsx` (426 linhas) — Verificado por `check-admin-panel-contracts.ts` (L152) e `check-provider-portal-security-contracts.ts` (L169). Substituído por `governanca/GovernancaAcessosView.tsx`.
2. `src/components/admin/AffiliateAdminModule.tsx` (1.648 linhas) — Verificado por `check-affiliate-contracts.ts` (L103). Substituído por `pessoas/AfiliadosSection.tsx`.
3. `src/components/admin/CadastroModule.tsx` (390 linhas) — Verificado por `check-admin-panel-contracts.ts` (L242). Substituído por `contratos/ContratosSuperDomain.tsx`.
4. `src/components/admin/CareersAdminModule.tsx` (442 linhas) — Verificado por `check-careers-contracts.ts` (L13). Substituído por `pessoas/TrabalheConoscoSection.tsx`.
5. `src/components/admin/ConfiguracoesModule.tsx` (293 linhas) — Verificado por `check-admin-panel-contracts.ts` (L190). Substituído por `governanca/GovernancaConfiguracoesView.tsx`.
6. `src/components/admin/FiscalModule.tsx` (200 linhas) — Verificado por `check-admin-panel-contracts.ts` (L178). Substituído por `financeiro/FiscalView.tsx`.
7. `src/components/admin/PartnersAdminModule.tsx` (322 linhas) — Verificado por `check-partners-contracts.ts` (L101). Substituído por `pessoas/FornecedoresSection.tsx`.
8. `src/components/admin/ProtectionAdminModule.tsx` (347 linhas) — Verificado por `check-admin-panel-contracts.ts` (L172) e `check-protection-direct-quote-contracts.ts` (L14). Substituído por `contratos/GsaSegurosView.tsx` e `GsaSaudeView.tsx`.
9. `src/components/admin/RelatoriosModule.tsx` (141 linhas) — Verificado por `check-admin-panel-contracts.ts` (L202). Substituído por `governanca/GovernancaRelatoriosView.tsx`.
10. `src/components/admin/SystemMonitorModule.tsx` (671 linhas) — Verificado por `check-admin-panel-contracts.ts` (L197). Substituído por `governanca/GovernancaInfraView.tsx`. *(Nota: este contrato está falhando atualmente por divergência textual na string 'Visão somente leitura')*.
11. `src/components/admin/VendasModule.tsx` (346 linhas) — Verificado por `check-admin-panel-contracts.ts` (L246). Substituído por `operacoes/OperacoesSuperDomain.tsx`.

#### **Categoria 4: Referenciado por Importações em Testes Unitários (1 arquivo / 447 linhas)**
- `src/components/admin/Dashboard.tsx` (447 linhas) — Não é renderizado pelo `AdminPanel.tsx`, mas seus tipos/mocks são importados por `src/tests/governanca-super-domain.test.ts` e `src/tests/super-domains-e2e.test.ts`.

---

### 1.4 Arquivos Órfãos em Outros Diretórios de `src/` (20 arquivos / 4.215 linhas)
Arquivos fora de `admin/` sem consumidores ativos no app:
1. `src/components/AppClientShell.tsx` (31 linhas)
2. `src/components/client/marketplace/MarketplaceModuleCard.tsx` (87 linhas)
3. `src/components/client/marketplace/TravelPackagesPage.tsx` (296 linhas)
4. `src/components/client/store/HeroBannerCarousel.tsx` (191 linhas)
5. `src/components/client/store/StoreHubCancelOrder.tsx` (100 linhas)
6. `src/components/client/store/StoreHubExchanges.tsx` (952 linhas)
7. `src/components/client/store/StoreHubRefunds.tsx` (195 linhas)
8. `src/components/client/store/StoreHubVipPromos.tsx` (88 linhas)
9. `src/components/public/BrandPortfolioDialog.tsx` (570 linhas)
10. `src/components/public/FreeToolsCalculatorDialog.tsx` (643 linhas)
11. `src/data/publicProjectTypes.ts` (20 linhas)
12. `src/hooks/use-mobile.tsx` (20 linhas)
13. `src/hooks/useStoreCart.ts` (95 linhas)
14. `src/hooks/useStoreOrders.ts` (36 linhas)
15. `src/hooks/useStoreProducts.ts` (110 linhas)
16. `src/lib/error-capture.ts` (82 linhas)
17. `src/lib/lovable-error-reporting.ts` (59 linhas)
18. `src/routing/adminNavigation.ts` (294 linhas) — Menus antigos redundantes substituídos por `MENU_GROUPS` em `AdminPanel.tsx`
19. `src/utils/paymentPropagation.ts` (261 linhas)
20. `src/utils/vipStyles.ts` (85 linhas)

---

### 1.5 Re-exports Essenciais de Retrocompatibilidade
Verificamos os seguintes arquivos que parecem pequenos mas são **estritamente essenciais**:
- `src/components/ui/CommandSlideOver.tsx`: re-exporta `src/components/admin/super-domains/shared/CommandSlideOver`
- `src/components/ui/TacticalDataGrid.tsx`: re-exporta `src/components/admin/super-domains/shared/TacticalDataGrid`
**Veredito:** DEVEM SER PRESERVADOS.

---

## 2. Logic Chain (Cadeia de Raciocínio Lógico)

1. **Premissa de Transição:** O `src/pages/AdminPanel.tsx` foi migrado para invocar diretamente os 5 Super-Domínios (`OperacoesSuperDomain`, `FinanceiroSuperDomain`, `PessoasSuperDomain`, `ContratosSuperDomain`, `GovernancaSuperDomain`) e apenas dois submódulos isolados de colaborador (`CollaboratorDashboard`, `DemandasColaboradorModule`).
2. **Desacoplamento Comprovado:** Os 29 arquivos das Categorias 1 e 2 em `src/components/admin/` (totalizando 30.870 linhas) não são importados por nenhum dos Super-Domínios, nem por nenhuma página ativa, nem por testes ou scripts. Sua exclusão imediata tem impacto nulo no runtime e não quebra compilação nem testes.
3. **Bloqueio por Contratos Legados:** Os 11 arquivos da Categoria 3 contêm regras que já foram portadas para os Super-Domínios, mas scripts de validação estática em `scripts/check-*.ts` abrem esses arquivos legados pelo caminho antigo (`readFile('src/components/admin/...')`). Portanto, uma remoção segura exige atualizar os caminhos de checagem nesses scripts para apontarem para as Views correspondentes em `src/components/admin/super-domains/`.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Arquivos de Declaração Global:** Arquivos `.d.ts` em `src/types/` e `src/vite-env.d.ts` aparecem como não importados porque atuam em nível de compilação global do TypeScript; não devem ser excluídos.
2. **Scripts de Validação em `src/validation/`:** Arquivos como `step6_subscriptions.ts` são scripts executados diretamente via `tsx` (definidos no `package.json`), portanto não possuem importadores em `src/`. Devem ser mantidos.
3. **Falha Pré-existente no Contrato `test:admin`:** `scripts/check-admin-panel-contracts.ts` (linha 197) busca `'Visão somente leitura'` dentro de `src/components/admin/SystemMonitorModule.tsx`, string que não está presente no arquivo. Isso deve ser corrigido/migrado para a view oficial `GovernancaInfraView.tsx`.

---

## 4. Conclusion (Conclusão e Plano de Ação Recomendado)

### 4.1 Lista de Exclusão Imediata e Segura (49 arquivos — 35.085 linhas eliminadas)
Estes arquivos podem ser deletados **sem necessidade de alterar nenhum contrato ou teste**:
- **29 arquivos em `src/components/admin/` (Categorias 1 e 2):**
  - `src/components/admin/AreaVIPModule.tsx`
  - `src/components/admin/EmpresaModule.tsx`
  - `src/components/admin/PrestadoresModule.tsx`
  - `src/components/admin/PromocoesModule.tsx`
  - `src/components/admin/TicketsModule.tsx`
  - `src/components/admin/products/ProductVariationsEditor.tsx`
  - `src/components/admin/ClientesModule.tsx`
  - `src/components/admin/CobrancaModule.tsx`
  - `src/components/admin/CreditoModule.tsx`
  - `src/components/admin/CuponsLojaModule.tsx`
  - `src/components/admin/EmprestimosModule.tsx`
  - `src/components/admin/FinanceiroModule.tsx`
  - `src/components/admin/IndicacoesModule.tsx`
  - `src/components/admin/LojaTrocasModule.tsx`
  - `src/components/admin/OrcamentosModule.tsx`
  - `src/components/admin/OrdensServicoModule.tsx`
  - `src/components/admin/PremiosModule.tsx`
  - `src/components/admin/PromoAnalytics.tsx`
  - `src/components/admin/PromocaoQuantidadeForm.tsx`
  - `src/components/admin/PromocaoQuantidadeModule.tsx`
  - `src/components/admin/PromoDetalhesModal.tsx`
  - `src/components/admin/ReembolsosModule.tsx`
  - `src/components/admin/VouchersModule.tsx`
  - `src/components/admin/clientes/AdminClienteDocumentos.tsx`
  - `src/components/admin/ecommerce/EcommerceAnalytics.tsx`
  - `src/components/admin/ecommerce/PricingPanel.tsx`
  - `src/components/admin/prestadores/PrestadoresCadastro.tsx`
  - `src/components/admin/prestadores/PrestadoresDemandas.tsx`
  - `src/components/admin/prestadores/PrestadoresFinanceiro.tsx`
- **20 arquivos em outros diretórios de `src/`:**
  - `src/components/AppClientShell.tsx`
  - `src/components/client/marketplace/MarketplaceModuleCard.tsx`
  - `src/components/client/marketplace/TravelPackagesPage.tsx`
  - `src/components/client/store/HeroBannerCarousel.tsx`
  - `src/components/client/store/StoreHubCancelOrder.tsx`
  - `src/components/client/store/StoreHubExchanges.tsx`
  - `src/components/client/store/StoreHubRefunds.tsx`
  - `src/components/client/store/StoreHubVipPromos.tsx`
  - `src/components/public/BrandPortfolioDialog.tsx`
  - `src/components/public/FreeToolsCalculatorDialog.tsx`
  - `src/data/publicProjectTypes.ts`
  - `src/hooks/use-mobile.tsx`
  - `src/hooks/useStoreCart.ts`
  - `src/hooks/useStoreOrders.ts`
  - `src/hooks/useStoreProducts.ts`
  - `src/lib/error-capture.ts`
  - `src/lib/lovable-error-reporting.ts`
  - `src/routing/adminNavigation.ts`
  - `src/utils/paymentPropagation.ts`
  - `src/utils/vipStyles.ts`

### 4.2 Lista de Limpeza Faseada (12 arquivos — 5.673 linhas)
Para remover os 12 arquivos restantes (`AcessosModule`, `AffiliateAdminModule`, `CadastroModule`, `CareersAdminModule`, `ConfiguracoesModule`, `FiscalModule`, `PartnersAdminModule`, `ProtectionAdminModule`, `RelatoriosModule`, `SystemMonitorModule`, `VendasModule`, `Dashboard.tsx`):
1. Atualizar referências em `scripts/check-admin-panel-contracts.ts`, `scripts/check-affiliate-contracts.ts`, `scripts/check-careers-contracts.ts`, `scripts/check-partners-contracts.ts`, `scripts/check-protection-direct-quote-contracts.ts` para verificar os arquivos equivalentes em `src/components/admin/super-domains/`.
2. Atualizar imports de tipos em `src/tests/governanca-super-domain.test.ts` de `Dashboard.tsx` para `GovernancaExecutiveDashboard.tsx`.
3. Executar a exclusão final dos 12 arquivos legados.

---

## 5. Verification Method (Método de Verificação Independente)

Para reproduzir e auditar independentemente os resultados:

1. **Auditoria Automatizada do Grafo:**
   ```powershell
   node .agents/explorer_diag_cleanup_1/analyze_dependency_graph.cjs
   node .agents/explorer_diag_cleanup_1/categorize.cjs
   ```
2. **Validação de Compilação TypeScript:**
   ```powershell
   npx tsc --noEmit
   ```
3. **Validação de Testes Unitários:**
   ```powershell
   npm run test:unit
   ```
4. **Validação de Contratos do Painel Admin:**
   ```powershell
   npm run test:admin
   ```
5. **Condição de Invalidação:** Se algum dos 49 arquivos da lista de exclusão imediata for importado por qualquer arquivo alcançado a partir de `src/main.tsx` ou quebrar `npx tsc --noEmit`, esta auditoria estará invalidada.
