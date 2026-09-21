# Master Execution Plan: GSA HUB Production Audit & Fix

## Mission Objective
Execute a full, end-to-end production audit and repair across database structure (PostgreSQL on VPS), frontend code (React/TypeScript/Vite), critical modules (Auth, Partners/Redemptions, WhatsApp, Marketplace, Affiliates, Suppliers, Financial), Vitest test suite (117+ tests passing), and clean build.

## Phase 0: Survey & Discovery (Parallel Explorers)
1. **Explorer 1 (DB/VPS Specialist)**: Inspect migrations in `supabase/migrations/`, examine VPS database configuration, list all RPCs, RLS policies, tables, and columns required by frontend. Identify missing columns or RPC signatures.
2. **Explorer 2 (Frontend & Critical Modules Specialist)**: Scan all `.tsx` and `.ts` files in `src/`. Map all `supabase.from` and `supabase.rpc` calls. Audit Auth session persistence, Partner redemption flow (`gsa_public_resgatar_beneficio_parceiro`), WhatsApp dispatch, Store checkout, Affiliates, Suppliers, Financial.
3. **Explorer 3 (QA, Test & Build Specialist)**: Analyze test suites in `src/tests/`, run TypeScript diagnostics / test runner to identify failing tests, type errors, build issues, and coverage gaps.

## Phase 1: Synthesis & PROJECT.md
- Merge findings from all 3 Explorers.
- Establish Feature Inventory, Milestones, and Interface Contracts in `PROJECT.md`.

## Phase 2: Implementation & Dual-Track Execution
- **Database Track**: Deploy idempotent SQL migrations via Worker to VPS PostgreSQL / local migrations to ensure all tables, columns, RPCs, and RLS policies match requirements.
- **Frontend Track**: Workers implement surgical fixes for frontend components, hooks, services, state management, auth persistence, and RPC alignments.
- **Testing Track**: Test writers and QA Workers ensure all 117+ tests pass and write new tests covering newly identified edge cases.

## Phase 3: Review, Challenger Stress-Testing & Forensic Audit
- Independent Reviewers verify code quality and interface conformance.
- Challengers empirically stress-test RPCs, flows, and edge cases.
- Forensic Auditor verifies integrity and ensures no cheating or facades.

## Phase 4: Final Gate & Delivery Report
- 100% tests passing, clean Vite build (`npm run build`), comprehensive human-facing report.
