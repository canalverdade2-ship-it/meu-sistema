# Project: Global Marketplace Audit & Concurrency Remediation

## Architecture
- **Frontend Layer**: React 18 / Vite / Tailwind UI. Core modules: `CheckoutPage.tsx`, `ProductPage.tsx`, `CartDrawer.tsx`, `ClientGSAStore.tsx`, `LojaTrocasModule.tsx`.
- **Database Layer**: PostgreSQL (Supabase). Core RPCs & Migrations:
  - `gsa_client_checkout_store` / `gsa_client_checkout_store_base_20260817` (`20260716183010_update_checkout_function.sql`, `20260817120000_product_variations_marketplace.sql`)
  - `gsa_admin_atualizar_solicitacao_loja` (`20260910180000_marketplace_acid_concurrency_remediation.sql`)
  - Row-level lock acquisition using canonical lexicographical sorting (`ORDER BY item_id, variante_id`).
- **Test Infrastructure**: Vitest test suite (`src/tests/marketplace-concurrency-simulation.test.ts`, `marketplace-checkout-concurrency-audit.test.ts`, `marketplace-returns-exchanges-atomicity.test.ts`, `marketplace-checkout-pricing.test.ts`, `marketplace-pricing-integrity.test.ts`).

## Feature Inventory
| # | Feature | Description | Milestone | Status | Source |
|---|---------|-------------|-----------|--------|--------|
| 1 | Checkout Atomic RPC & Immutability | Ensure `v_variant_price` does not mutate catalog `produtos.valor`; row locks prevent overselling | M0 / M2 | DONE | Database Survey & Tests |
| 2 | Post-Sales Atomicity & Idempotency | Dual restock (parent + variant), wallet refund, points clawback, invoice cancellation in `gsa_admin_atualizar_solicitacao_loja` | M0 / M2 | DONE | Database Survey & Tests |
| 3 | Variant Shopping Cart Integrity | Fix variant overwrite in `ProductPage.tsx` so adding variant B does not overwrite variant A | M1 | DONE | Frontend Worker |
| 4 | Variant Stock Pre-Validation & UI Resync | Validate variant stock in `CheckoutPage.tsx` / `CartDrawer.tsx` and resync cart on out-of-stock RPC errors | M1 | DONE | Frontend Worker |
| 5 | Realtime & Pagination Stabilization | Prevent Realtime channel thrashing on keystroke in `LojaTrocasModule.tsx` and wire pagination refetch | M1 | DONE | Frontend Worker |
| 6 | Frontend Dead-Code & Warning Cleanup | Remove unused icons, resolve Rollup dynamic/static import conflict on `AvailableCouponsModal.tsx` | M1 / M4 | DONE | Frontend & Remediation Workers |
| 7 | Coupon Depletion Barrier Stress Test | Concurrent race on limited coupon usages (`limite_usos`) ensuring zero over-redemption (ST-01) | M2 | DONE | Test Worker |
| 8 | Same-Client Wallet Overdraft Test | Concurrent checkouts on same account ensuring wallet balance never goes negative (ST-02) | M2 | DONE | Test Worker |
| 9 | Same-Client Points Double-Spending Test | Concurrent checkouts attempting to double-spend same loyalty points (ST-03) | M2 | DONE | Test Worker |
| 10 | Exchange Substitute Stock Collision Test | Race between exchange approval reserving substitute item and concurrent store checkout (ST-04) | M2 / M4 | DONE | Test & Remediation Workers |
| 11 | Promotional Quota Exhaustion Test | Race on limited promotional discounted quantities (`desconto_quantidade_limite`) (ST-05) | M2 | DONE | Test Worker |
| 12 | Insolvent Referrer Bonus Clawback Test | Return order with bonus clawback from referrer with zero balance (ST-06) | M2 | DONE | Test Worker |
| 13 | Cross-Cart Deadlock Stress Test | Interleaved carts with subsidiary promotional items ensuring 40P01 immunity (ST-07) | M2 | DONE | Test Worker |
| 14 | Independent Verification & Gate Clearance | Multi-angle review, challenger stress validation, and forensic integrity audit | M3 | DONE | Reviewers, Challengers, Auditor |

## Milestones
| # | Name | Scope | Dependencies | Status | Key Outputs |
|---|------|-------|-------------|--------|-------------|
| 0 | Phase 0 Survey | Deep survey of React frontend, PostgreSQL migrations/RPCs, and test suites | None | DONE | 3 Explorer handoff reports |
| 1 | Frontend Remediation & Dead-Code Elimination | Fix variant cart overwrite, add variant stock pre-check, add catch resync in Checkout, stabilize LojaTrocasModule Realtime & pagination, remove dead code/warnings | M0 | DONE | ProductPage, CheckoutPage, CartDrawer, LojaTrocasModule |
| 2 | Test Suite Expansion (ST-01 to ST-07) | Implement 7 stress test scenarios in `marketplace-concurrency-simulation.test.ts` and add coupon lock in simulator | M0 | DONE | 65 tests in simulation test, 136 total |
| 3 | Independent Review, Challenger Stress-Testing & Forensic Gate Audit | 2 Reviewers, 2 Challengers, 1 Forensic Auditor for strict gate pass criteria | M1, M2 | DONE | GATE_STATUS.md PASS, Clean Forensic Audit |
| 4 | Remediation & Final Gate Clearance | Fix TS2345 type parameter in ST-04 and harmonize AvailableCouponsModal imports | M3 | DONE | npx tsc exit 0, npm run build exit 0, 136/136 tests pass |

## Code Layout & Write Ownership
- Milestone 1 (Frontend Worker):
  - `src/components/client/store/ProductPage.tsx`
  - `src/components/client/store/CheckoutPage.tsx`
  - `src/components/client/store/CartDrawer.tsx`
  - `src/components/admin/LojaTrocasModule.tsx`
- Milestone 2 (Test Writer / Worker):
  - `src/tests/marketplace-concurrency-simulation.test.ts`
- Milestone 4 (Remediation Worker):
  - `src/tests/marketplace-concurrency-simulation.test.ts`
  - `src/components/client/ClientGSAStore.tsx`
- Milestone 3 (Reviewers, Challengers, Auditor):
  - Read-only analysis and execution of verification tests.
