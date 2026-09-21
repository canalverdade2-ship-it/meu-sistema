# BRIEFING — 2026-08-21T20:15:30Z

## Mission
Build and deliver the Pessoas, RH & Prestadores Super-Domain (`PessoasSuperDomain.tsx` and subcomponents) with high-density Enterprise Light UI, TacticalDataGrids, CommandSlideOvers, and complete Supabase integrations preserving 100% of business logic.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m3_pessoas
- Original parent: 83cdeace-cb64-4434-ba41-b3a80ea30ca5
- Milestone: M3 Pessoas, RH & Prestadores Super-Domain

## 🔒 Key Constraints
- Exclusively own `src/components/admin/super-domains/pessoas/*` and `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx`.
- Enterprise Light design language: #F8FAFC canvas, #FFFFFF card containers, slate-200 borders, tactical typography, status badges, CommandSlideOver drawers, TacticalDataGrid tables with search/filter/pagination/sorting.
- Preserve 100% RPC calls and business logic (`gsa_admin_processar_saque`, `gsa_admin_processar_saque_prestador`, etc.).
- No dummy/facade implementations.
- Verification with `npm run typecheck:strict` and `npm run test:unit`.

## Current Parent
- Conversation ID: 83cdeace-cb64-4434-ba41-b3a80ea30ca5
- Updated: 2026-08-21T20:15:30Z

## Task Summary
- **What to build**: Full Enterprise Light super-domain for Pessoas, RH & Prestadores with tabs/sections:
  1. Prestadores de Serviços (Directory, skills, verification, background checks, rating)
  2. Central de Saques & Repasses com Payout Clearance Drawer (PIX verification, batch approval, receipt upload, `gsa_admin_processar_saque`, `gsa_admin_processar_saque_prestador`)
  3. Fornecedores & Parceiros Comerciais
  4. Trabalhe Conosco & Recrutamento (Candidate pipeline, resume review)
  5. GSA Afiliados & Comissões
  6. Fidelidade, Prêmios, Vouchers, Promoções, Cupons & Trocas
- **Success criteria**: Strict TypeScript check pass (`npm run typecheck:strict`), unit tests pass (`vitest run src/tests/pessoas-super-domain.test.ts`), full feature parity and operational drawer actions.

## Change Tracker
- **Files modified/created**:
  - `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx` — Master SuperDomain component with KPI strip and tab routing
  - `src/components/admin/super-domains/pessoas/PrestadoresSection.tsx` — TacticalDataGrid for service providers with filtering and stats
  - `src/components/admin/super-domains/pessoas/PrestadorDetailDrawer.tsx` — CommandSlideOver dossier with 6 tabs (Perfil, Documentos, Demandas, Carteira, Benefícios, Ações & Reset PIN)
  - `src/components/admin/super-domains/pessoas/NovoPrestadorDrawer.tsx` — CommandSlideOver registration drawer for new providers (CPF/CNPJ)
  - `src/components/admin/super-domains/pessoas/SaquesRepassesSection.tsx` — Unified Central de Saques & Repasses with batch selection and KPI cards
  - `src/components/admin/super-domains/pessoas/PayoutClearanceDrawer.tsx` — High-density clearance desk with PIX key copy, approval/rejection workflows, and notifications
  - `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx` — Suppliers, Purchase Orders, and Commercial Partners with accreditation drawers
  - `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx` — HR Recruitment ATS pipeline with stage progression and resume viewer
  - `src/components/admin/super-domains/pessoas/AfiliadosSection.tsx` — Affiliate directory, commissions, batch release, and balance adjustments
  - `src/components/admin/super-domains/pessoas/FidelidadePromocoesSection.tsx` — Rewards, vouchers, store coupons, return/exchanges, and points adjustment RPC
  - `src/components/admin/super-domains/pessoas/index.ts` — Barrel export for all Super-Domain 3 components
  - `src/tests/pessoas-super-domain.test.ts` — Comprehensive unit test suite for SD3 components and RPC contract integrity
- **Build status**: PASS (`npm run typecheck:strict` code 0, vitest code 0)
- **Pending issues**: none

## Quality Status
- **Build/test result**: PASS (7/7 unit tests passing)
- **Lint status**: Clean strict types
- **Tests added/modified**: `src/tests/pessoas-super-domain.test.ts`
