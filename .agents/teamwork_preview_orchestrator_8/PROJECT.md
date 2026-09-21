# Project: GSA HUB Production Mass Audit & System Hardening

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui.
  - Multi-portal architecture: Public Landing, Client Portals (PF/PJ), Supplier Portal, Admin Super-domains (Pessoas, Operações, Governança, Financeiro, Contratos, etc.), Marketplace (GSA Store), Affiliate Portal.
- **Backend & Database**:
  - PostgreSQL 15.18 on VPS (`147.15.43.141:5433`), database `gsahub`.
  - PostgREST 3001 / Supabase self-hosted with 239 tables, 624 RPC functions, 466 RLS policies, 59 `system_settings` keys.
  - Authentication: Supabase Auth with double-layer persistent storage (`localStorage` + `sessionStorage`).
- **External Integrations**:
  - Payment Gateways: InfinitePay (`getsemani-gsa`), BACEN PIX Copia e Cola EMV engine with CRC16-CCITT polynomial.
  - Messaging & WhatsApp: 3-tier cascade (Tier 1: Evolution API port 8080 -> Tier 2: Edge Function `vps-api` -> Tier 3: n8n webhook port 5678) with Master Admin Baileys LID auto-routing.

## Code Layout
- `src/components/`: React UI components (admin, client, supplier, public, shared).
- `src/features/`: Domain-specific business logic (affiliates, partners, store, contracts, etc.).
- `src/hooks/`: React custom hooks (realtime, auth, notifications, pricing).
- `src/lib/`: Services and utilities (supabase client, adminRpc, pixService, whatsappNotificationService, supplierOperations).
- `src/tests/`: Automated Vitest test suites (24 test files, 343 tests passing 100%).
- `scripts/`: Verification and schema validation scripts (`scripts/validate-db-schema.cjs`).
- `supabase/migrations/`: Canonical idempotent SQL migrations.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | TypeScript Compilation Zero-Error | Zero compile errors on `npx tsc --noEmit` across all types and test suites | M1 | Survey / FeExplorer | DONE |
| 2 | Frontend UI/UX Integrity | Robust buttons, modal dialogs, loading guards, double-click protection (`isSubmittingRef`), error boundaries | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 3 | Database Schema & Column Parity | All frontend-queried tables and columns exist in PostgreSQL on VPS (239 tables, 3105 columns) | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 4 | RPC Signatures & Permissions | All 132 frontend RPCs exist with exact signatures and proper EXECUTE permissions (`anon`/`authenticated`) | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 5 | Automated Schema Validation Script | Programmatic script validating live PostgreSQL schema and RPCs against TypeScript types | M2 | ORIGINAL_REQUEST §Acceptance Criteria | DONE |
| 6 | Commercial Partners & 24h SLA Redemptions | Public redemption form (Name, Email, Phone), protocol generation (`PROT-RES-YYYY-XXXXXX`), 24h delay branching, customer/admin WhatsApp notifications | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 7 | Affiliate Commissions & Attributions | Click capture (`?ref=<code>`), server tokenization, conversion binding, carência maturation, payout clearance | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 8 | Payment Gateway & EMV PIX Logic | InfinitePay checkout, BACEN-compliant EMV PIX payload with CRC16-CCITT, invoice itemization (`faturas`), zero-cost bypass | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 9 | WhatsApp Notification 3-Tier Cascade | Evolution API -> Edge Function -> n8n webhook fallback with Master Admin LID routing | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 10 | Vitest Test Suite Expansion & 100% Pass | 100% pass on all Vitest test suites with comprehensive happy & edge cases for redemptions, commissions, payments (343 tests) | M3 / E2E | ORIGINAL_REQUEST §R4 | DONE |
| 11 | Production Build Cleanliness | `npm run build` cleanly generates production bundle with 0 errors | M1 / E2E | ORIGINAL_REQUEST §Acceptance Criteria | DONE |
| 12 | Tier 5 Adversarial Coverage Hardening | White-box stress-testing, idempotency verification, split payment tests, concurrent redemption race checks | Final Milestone | Project Pattern Tier 5 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Frontend Type & TS Compilation Fixes | Fix isolated TypeScript type definition errors in `src/features/partners/types.ts` and test casts; verify clean `npx tsc --noEmit` and clean `npm run build`. | none | DONE |
| M2 | Database Integrity & Schema Verifier | Verify VPS database schema, create automated script (`scripts/validate-db-schema.cjs` or TS) validating PostgreSQL schema and RPCs against TypeScript definitions. | none | DONE |
| M3 | Business Logic Test Expansion | Implement automated Vitest test suites covering partner redemption happy & edge cases, affiliate commission workflows, payment idempotency, and WhatsApp cascade fallback. | M1 | DONE |
| M-E2E | E2E Testing Track | Design & verify 4-Tier test suite, publish `TEST_READY.md`, validate 100% pass. | M1, M2, M3 | DONE |
| M-FINAL | Final Verification & Tier 5 Adversarial Hardening | Pass 100% of test suites, run 2 Challengers for adversarial stress-testing (Tier 5), run Forensic Auditor. | M-E2E | DONE |

## Interface Contracts
### `gsa_public_resgatar_beneficio_parceiro`
- **Arguments**: `p_parceiro_slug text`, `p_nome_completo text`, `p_telefone text`, `p_email text`, `p_cliente_id uuid DEFAULT NULL`
- **Returns**: `jsonb` with keys `{ success: boolean, protocolo: string, delay_24h: boolean, email: string, cupom?: string, link?: string }`
- **Role Permission**: `GRANT EXECUTE ON FUNCTION gsa_public_resgatar_beneficio_parceiro TO anon, authenticated, service_role`

### `gsa_public_track_affiliate_click`
- **Arguments**: `p_affiliate_code text`, `p_metadata jsonb DEFAULT '{}'`
- **Returns**: `jsonb` with keys `{ success: boolean, click_token: string }`
- **Role Permission**: `GRANT EXECUTE ON FUNCTION gsa_public_track_affiliate_click TO anon, authenticated, service_role`

### `gsa_client_bind_affiliate_click`
- **Arguments**: `p_click_token text`, `p_cliente_id uuid`
- **Returns**: `jsonb` with keys `{ success: boolean }`
- **Role Permission**: `GRANT EXECUTE ON FUNCTION gsa_client_bind_affiliate_click TO authenticated, service_role`
