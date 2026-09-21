# DISPATCH — Worker Squad 3: Financial, Credit & Billing

## Objective
Implement native React Native mobile screens for all 10 modules in Squad 3 under `gsa-admin-mobile/src/screens/financial/`.

## Exclusive Write Ownership
You exclusively own and write to:
`gsa-admin-mobile/src/screens/financial/*`
Do NOT edit `App.tsx` or files owned by other squads.

## Modules to Implement
1. `FinanceiroModuleScreen.tsx` (Livro-caixa, contas a pagar/receber, fluxo de caixa)
   - Source: `src/components/admin/FinanceiroModule.tsx`
   - Data: `faturas`, `transacoes_financeiras`, `contas_bancarias`
2. `CobrancaModuleScreen.tsx` (Regua de cobranca de inadimplentes, protestos, acordos)
   - Source: `src/components/admin/CobrancaModule.tsx`
   - Data: `cobrancas`, `cobranca_historico`, `faturas`
3. `FiscalModuleScreen.tsx` (Emissao e controle de Notas Fiscais NF-e / NFS-e)
   - Source: `src/components/admin/FiscalModule.tsx`
   - Data: `notas_fiscais`, `faturas`
4. `CreditoModuleScreen.tsx` (Analise de credito consignado e limites de clientes)
   - Source: `src/components/admin/CreditoModule.tsx`
   - Data: `credito_solicitacoes`, `clientes`
5. `EmprestimosModuleScreen.tsx` (Simulacao e gestao de contratos de emprestimo)
   - Source: `src/components/admin/EmprestimosModule.tsx`
   - Data: `emprestimos`, `emprestimo_parcelas`
6. `PainelRentabilidadeScreen.tsx` (DRE operacional, margens de contribuicao e custos)
   - Source: `src/components/admin/PainelRentabilidade.tsx`
   - Data: `faturas`, `produtos`, `servicos`
7. `ReembolsosModuleScreen.tsx` (Aprovacao e processamento de solicitacoes de reembolso)
   - Source: `src/components/admin/ReembolsosModule.tsx`
   - Data: `reembolsos`, `clientes`
8. `CalculatorProAdminPanelScreen.tsx` (Painel de taxas de gateway e maquininhas)
   - Source: `src/components/admin/CalculatorProAdminPanel.tsx`
   - Data: `gateway_taxas`, `calculator_settings`
9. `CalculatorProPaymentConfigurationScreen.tsx` (Configuracao de parcelamento e juros)
   - Source: `src/components/admin/CalculatorProPaymentConfiguration.tsx`
   - Data: `calculator_payment_configs`
10. `ShopeeOperationsModuleScreen.tsx` (Conciliacao e repasses Shopee/Marketplace)
   - Source: `src/components/admin/ShopeeOperationsModule.tsx`
   - Data: `shopee_pedidos`, `shopee_repasses`

Also create `index.ts` in `gsa-admin-mobile/src/screens/financial/` exporting all screens.

## UX Adaptation Rules
- Card-based layout (`FlatList` or `ScrollView`) with search, filter chips, pull-to-refresh (`RefreshControl`).
- Status badges with contextual colors.
- Detail modals or bottom sheets for full record inspection.
- Form inputs with `keyboardType`, touch targets >= 44x44, responsive 100% width.
- NO hardcoded desktop widths (> 420px), NO HTML `<table>` elements.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-19T19:19:09Z
You are Worker Squad 3: Financial, Credit & Billing.
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_squad3

Read the user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md (under header ## 2026-09-19T19:10:56Z)
and your dispatch instructions at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_squad3\DISPATCH.md

You exclusively own and write to:
gsa-admin-mobile/src/screens/financial/*

Implement all 10 native mobile screens for Squad 3:
1. FinanceiroModuleScreen.tsx
2. CobrancaModuleScreen.tsx
3. FiscalModuleScreen.tsx
4. CreditoModuleScreen.tsx
5. EmprestimosModuleScreen.tsx
6. PainelRentabilidadeScreen.tsx
7. ReembolsosModuleScreen.tsx
8. CalculatorProAdminPanelScreen.tsx
9. CalculatorProPaymentConfigurationScreen.tsx
10. ShopeeOperationsModuleScreen.tsx
plus index.ts exporting all 10 screens.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Follow Mobile UX patterns (Table-to-Card, touch targets >= 44x44, responsive 100% width, no 1000px fixed tables). Wire Supabase queries/actions using the Supabase client.
When done, create your handoff.md and send a message back to parent.
