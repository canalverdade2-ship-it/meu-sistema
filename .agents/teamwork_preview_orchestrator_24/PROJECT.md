# Project: System Documentation and Architecture Mapping (GSA HUB)

## Architecture
- **Backend / Database**: Supabase PostgreSQL (`supabase/migrations/`), Row Level Security (RLS) policies, PostgreSQL Triggers and Functions / RPCs (transactions, checkout, wallet balance, points, auth).
- **Frontend**: React (Vite, TypeScript, TailwindCSS), state management, hooks (including Supabase Realtime and query hooks), user modules (`src/components/` and `src/pages/`):
  - Admin (`src/components/admin/`)
  - Cliente (`src/components/client/`)
  - Fornecedor (`src/components/fornecedores/`, `src/pages/Fornecedor/`)
  - Colaborador (`src/components/admin/demandas/`, `src/pages/RestrictedAccessHubPage.tsx`)
  - Afiliado (`src/pages/Afiliado/`, `src/features/affiliates/`)
  - Prestador (`src/components/prestador/`, `src/pages/Prestador/`)
- **API & External Integrations**: Supabase client/auth/storage, WhatsApp/n8n/Evolution API, Webhooks.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Database Schema Mapping | Complete mapping of tables, relationships, columns, keys across migrations | M1 | ORIGINAL_REQUEST §R1 |
| 2 | RLS Policies Audit & Catalog | Row-level security rules for authenticated roles and security isolation | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Core RPCs & Transaction Logic | PostgreSQL functions (checkout, wallet, loyalty points, appeals, refunds) | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Frontend Architecture & Routes | React app structure, router, providers, global state, layout | M2 | ORIGINAL_REQUEST §R2 |
| 5 | User Role Modules Detailed Flow | Admin, Cliente, Fornecedor, Colaborador, Afiliado, Prestador | M2 | ORIGINAL_REQUEST §R2 |
| 6 | API & Integration Layer | Supabase client, Webhooks, External APIs (Evolution, WhatsApp, Fish Audio) | M2 | ORIGINAL_REQUEST §R2 |
| 7 | System Central Documentation | Compilation of DOCUMENTACAO_SISTEMA.md at root (830 lines, deep technical breakdown) | M3 | ORIGINAL_REQUEST §R3 |
| 8 | Quality, Completeness & Gate Review | Review, empirical challenge, and integrity audit of documentation | M4 | ACCEPTANCE_CRITERIA |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Deep Exploration | Map schema, tables, RLS policies, and RPCs | none | DONE |
| M2 | Frontend Deep Exploration | Map architecture, user modules (6 roles), and API integrations | none | DONE |
| M3 | Documentation Compilation | Generate DOCUMENTACAO_SISTEMA.md at project root (830 lines) | M1, M2 | DONE |
| M4 | Gate & Verification | 2 Reviewers (APPROVE), 2 Challengers (APPROVE), 1 Auditor (CLEAN) | M3 | DONE |

## Code Layout
- Root documentation deliverable: `DOCUMENTACAO_SISTEMA.md` (830 lines, 77.3 KB)
- Database sources: `supabase/migrations/`, `server_webhook*.cjs`
- Frontend sources: `src/` (components, hooks, pages, services, utils)
- Metadata: `.agents/teamwork_preview_orchestrator_24/`
