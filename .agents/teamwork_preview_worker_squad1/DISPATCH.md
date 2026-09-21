# DISPATCH — Worker Squad 1: Operations & Demandas

## Objective
Implement native React Native mobile screens for all 8 modules in Squad 1 under `gsa-admin-mobile/src/screens/operations/`.

## Exclusive Write Ownership
You exclusively own and write to:
`gsa-admin-mobile/src/screens/operations/*`
Do NOT edit `App.tsx` or files owned by other squads.

## Modules to Implement
1. `OrcamentosModuleScreen.tsx` (Orcamentos, propostas, itens de orcamento, status de orcamento, conversao em OS)
   - Source: `src/components/admin/OrcamentosModule.tsx`
   - Data: `orcamentos`, `orcamento_itens`, `clientes`
2. `OrdensServicoModuleScreen.tsx` (Ordens de servico, status de execucao, tecnicos, garantias)
   - Source: `src/components/admin/OrdensServicoModule.tsx`
   - Data: `ordens_servico`, `os_historico`, `clientes`
3. `OrdensAssinaturaModuleScreen.tsx` (Contratos recorrentes de assinatura e servicos)
   - Source: `src/components/admin/OrdensAssinaturaModule.tsx`
   - Data: `ordens_assinatura`, `assinaturas`
4. `OrdensCompraModuleScreen.tsx` (Pedidos de compra e suprimentos operacionais)
   - Source: `src/components/admin/OrdensCompraModule.tsx`
   - Data: `pedidos_compra`, `fornecedores`
5. `DemandasColaboradorModuleScreen.tsx` (Fila de despacho de demandas e tarefas)
   - Source: `src/components/admin/DemandasColaboradorModule.tsx`
   - Data: `prestador_demandas`, `colaboradores`
6. `PrestadoresModuleScreen.tsx` (Cadastro, homologacao e gestao de prestadores de servico)
   - Source: `src/components/admin/PrestadoresModule.tsx`
   - Data: `prestadores`, `prestador_documentos`
7. `PartnersAdminModuleScreen.tsx` (Gestao de parceiros operacionais homologados)
   - Source: `src/components/admin/PartnersAdminModule.tsx`
   - Data: `parceiros`, `parceiros_resgates`
8. `VendasModuleScreen.tsx` (Visao operacional de conversao de orcamentos em vendas e checkout)
   - Source: `src/components/admin/VendasModule.tsx`
   - Data: `vendas`, `orcamentos`, `clientes`

Also create `index.ts` in `gsa-admin-mobile/src/screens/operations/` exporting all screens.

## UX Adaptation Rules
- Card-based layout (`FlatList` or `ScrollView`) with search, filter chips, pull-to-refresh (`RefreshControl`).
- Status badges with contextual colors.
- Detail modals or bottom sheets for full record inspection.
- Form inputs with `keyboardType`, touch targets >= 44x44, responsive 100% width.
- NO hardcoded desktop widths (> 420px), NO HTML `<table>` elements.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-19T19:19:08Z
You are Worker Squad 1: Operations & Demandas.
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_squad1

Read the user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md (under header ## 2026-09-19T19:10:56Z)
and your dispatch instructions at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_squad1\DISPATCH.md

You exclusively own and write to:
gsa-admin-mobile/src/screens/operations/*

Implement all 8 native mobile screens for Squad 1:
1. OrcamentosModuleScreen.tsx
2. OrdensServicoModuleScreen.tsx
3. OrdensAssinaturaModuleScreen.tsx
4. OrdensCompraModuleScreen.tsx
5. DemandasColaboradorModuleScreen.tsx
6. PrestadoresModuleScreen.tsx
7. PartnersAdminModuleScreen.tsx
8. VendasModuleScreen.tsx
plus index.ts exporting all 8 screens.

