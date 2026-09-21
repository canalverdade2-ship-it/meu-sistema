# BRIEFING — 2026-08-21T20:09:00Z

## Mission
Build and verify the unified Financeiro & Faturamento Super-Domain (M2) in Enterprise Light style with TacticalDataGrids and CommandSlideOvers, preserving 100% of business logic and Supabase RPCs.

## ?? My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_financeiro
- Original parent: 83cdeace-cb64-4434-ba41-b3a80ea30ca5
- Milestone: M2 (Super-Domain 2: Gestão Financeira & Faturamento)

## ?? Key Constraints
- Exclusively own src/components/admin/super-domains/financeiro/*
- Preserve 100% business rules and Supabase RPC calls: gsa_admin_baixar_fatura, gsa_admin_cancelar_fatura, gsa_admin_criar_fatura_manual, gsa_admin_enviar_fatura_cobranca, gsa_admin_processar_saque, gsa_admin_processar_transferencia, gsa_admin_criar_cobranca_fatura, gsa_admin_gerar_acordo_cobranca, gsa_admin_baixar_parcela_cobranca, gsa_admin_baixar_cobranca_manual, gsa_admin_protestar_cobranca, gsa_admin_cancelar_acordo_cobranca, gsa_admin_fiscal_update, gsa_admin_emprestimo_*, gsa_admin_preaprovar_credito, gsa_admin_calculator_pro_*
- Adhere to Enterprise Light design system with TacticalDataGrid, CommandSlideOver, StatusBadge.
- Ensure strict TypeScript compilation (npm run typecheck:strict) and unit tests passing.

## Current Parent
- Conversation ID: 83cdeace-cb64-4434-ba41-b3a80ea30ca5
- Updated: 2026-08-21T20:09:00Z

## Task Summary
- **What to build**: FinanceiroSuperDomain.tsx and modular subviews for Faturamento, Fluxo de Caixa, Cobrança, Fiscal, Empréstimos & Crédito, Rentabilidade & Reembolsos, Calculadoras & Gateway.
- **Success criteria**: Zero TypeScript errors in strict mode, 100% RPC preservation, seamless user workflows.
- **Interface contracts**: PROJECT.md

## Change Tracker
- **Files created/modified**:
  - src/components/admin/super-domains/financeiro/FinanceiroSuperDomain.tsx (TBD)
  - src/components/admin/super-domains/financeiro/FaturamentoView.tsx (TBD)
  - src/components/admin/super-domains/financeiro/FluxoCaixaView.tsx (TBD)
  - src/components/admin/super-domains/financeiro/CobrancaView.tsx (TBD)
  - src/components/admin/super-domains/financeiro/FiscalView.tsx (TBD)
  - src/components/admin/super-domains/financeiro/EmprestimosCreditoView.tsx (TBD)
  - src/components/admin/super-domains/financeiro/RentabilidadeReembolsosView.tsx (TBD)
  - src/components/admin/super-domains/financeiro/CalculadorasGatewayView.tsx (TBD)
  - src/components/admin/super-domains/financeiro/index.ts (TBD)
- **Build status**: strict typecheck passes
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (vitest 4/4 suites pass, 24/24 tests pass)
- **Lint status**: Clean
- **Tests added/modified**: Will add unit tests for Financeiro SuperDomain and RPC bindings
