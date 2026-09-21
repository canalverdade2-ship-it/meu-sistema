# DISPATCH — Worker Squad 2: Commerce, Store & Catalog

## Objective
Implement native React Native mobile screens for all 11 modules in Squad 2 under `gsa-admin-mobile/src/screens/commerce/`.

## Exclusive Write Ownership
You exclusively own and write to:
`gsa-admin-mobile/src/screens/commerce/*`
Do NOT edit `App.tsx` or files owned by other squads.

## Modules to Implement
1. `ProdutosModuleScreen.tsx` (Catalogo de produtos, precos, estoque, variacoes)
   - Source: `src/components/admin/ProdutosModule.tsx`
   - Data: `produtos`, `categorias`
2. `ServicosModuleScreen.tsx` (Catalogo de servicos tabelados e precos)
   - Source: `src/components/admin/ServicosModule.tsx`
   - Data: `servicos`
3. `ServicePackagesModuleScreen.tsx` (Combos e pacotes integrados de servicos)
   - Source: `src/components/admin/ServicePackagesModule.tsx`
   - Data: `servicos_pacotes`
4. `LojaCategoriasModuleScreen.tsx` (Departamentos, categorias e taxonomia da loja)
   - Source: `src/components/admin/LojaCategoriasModule.tsx`
   - Data: `loja_categorias`
5. `LojaTrocasModuleScreen.tsx` (Pos-venda, solicitacoes de troca e devolucao)
   - Source: `src/components/admin/LojaTrocasModule.tsx`
   - Data: `loja_trocas`, `pedidos`
6. `CuponsLojaModuleScreen.tsx` (Cupons de desconto, regras de validade e aplicacao)
   - Source: `src/components/admin/CuponsLojaModule.tsx`
   - Data: `loja_cupons`
7. `PromocoesModuleScreen.tsx` (Campanhas promocionais ativas na loja)
   - Source: `src/components/admin/PromocoesModule.tsx`
   - Data: `promocoes`
8. `PromocaoQuantidadeModuleScreen.tsx` (Descontos progressivos por volume de compra)
   - Source: `src/components/admin/PromocaoQuantidadeModule.tsx`
   - Data: `promocoes_quantidade`
9. `PromocaoQuantidadeFormScreen.tsx` (Formulario de criacao/edicao de faixas de desconto)
   - Source: `src/components/admin/PromocaoQuantidadeForm.tsx`
   - Data: `promocoes_quantidade`
10. `PromoAnalyticsScreen.tsx` (Indicadores de conversao, cliques e ROI de campanhas)
   - Source: `src/components/admin/PromoAnalytics.tsx`
   - Data: `promocoes_analytics`, `promocoes`
11. `PromoDetalhesModalScreen.tsx` (Visualizacao detalhada e auditoria de promocao)
   - Source: `src/components/admin/PromoDetalhesModal.tsx`
   - Data: `promocoes`

Also create `index.ts` in `gsa-admin-mobile/src/screens/commerce/` exporting all screens.

## UX Adaptation Rules
- Card-based layout (`FlatList` or `ScrollView`) with search, filter chips, pull-to-refresh (`RefreshControl`).
- Status badges with contextual colors.
- Detail modals or bottom sheets for full record inspection.
- Form inputs with `keyboardType`, touch targets >= 44x44, responsive 100% width.
- NO hardcoded desktop widths (> 420px), NO HTML `<table>` elements.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-19T19:19:09Z
Received dispatch assignment for Worker Squad 2: Commerce, Store & Catalog.
Exclusively own and write to: gsa-admin-mobile/src/screens/commerce/*
11 modules:
1. ProdutosModuleScreen.tsx
2. ServicosModuleScreen.tsx
3. ServicePackagesModuleScreen.tsx
4. LojaCategoriasModuleScreen.tsx
5. LojaTrocasModuleScreen.tsx
6. CuponsLojaModuleScreen.tsx
7. PromocoesModuleScreen.tsx
8. PromocaoQuantidadeModuleScreen.tsx
9. PromocaoQuantidadeFormScreen.tsx
10. PromoAnalyticsScreen.tsx
11. PromoDetalhesModalScreen.tsx
plus index.ts
