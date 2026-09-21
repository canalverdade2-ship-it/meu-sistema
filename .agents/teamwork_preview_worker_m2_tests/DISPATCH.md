# Dispatch for teamwork_preview_worker_m2_tests

## Role: Worker / Test Writer (Concurrency Simulation Test Suite Expansion)
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m2_tests
Project root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Original request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-11T00:26:34Z`
PROJECT document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_22\PROJECT.md
Test Suite Survey Report: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_tests\handoff.md

## Exclusive Write Ownership
You exclusively own and may edit the following file:
- `src/tests/marketplace-concurrency-simulation.test.ts`

Do NOT edit any source code or SQL migration files.

## Objectives & Detailed Tasks
1. Read `ORIGINAL_REQUEST.md` and `handoff.md` from the test suite explorer (especially Section 6: Recommended Additional Stress Test Scenarios).
2. **Update `MarketplaceACIDSimulator` in `src/tests/marketplace-concurrency-simulation.test.ts`**:
   - Include coupon row locking (`cupom_${couponId}`) in the canonical lexicographical lock key acquisition (lines ~312-330) to mirror PostgreSQL's `SELECT ... FROM cupons_loja FOR UPDATE` (`20260716183010_update_checkout_function.sql:530, 605`).
   - Support substitute exchange product inventory reservation in post-sales exchange handling (`novos_produtos`).
3. **Implement the 7 Stress Test Scenarios (ST-01 to ST-07)**:
   - **Scenario ST-01 (Coupon Usage Limit Race)**: 20 concurrent checkouts competing for coupon with `limite_usos: 3`. Exactly 3 succeed with discount, 17 rejected/fallback, final `total_usos === 3`.
   - **Scenario ST-02 (Same-Client Wallet Overdraft Prevention)**: 3 concurrent checkouts requesting R$ 70 each against R$ 100 wallet balance. Exactly 1 succeeds, balance never drops below zero (`saldo_carteira >= 0`).
   - **Scenario ST-03 (Same-Client Points Double-Spending)**: 3 concurrent checkouts requesting 5000 points from 5000 points balance. Exactly 1 succeeds, final `saldo_pontos === 0`.
   - **Scenario ST-04 (Exchange Substitute Stock Collision)**: 1 remaining unit of product, race between admin exchange approval and store checkout. Exactly 1 succeeds, 1 rejects with stock error, final stock is 0.
   - **Scenario ST-05 (Promotional Quota Concurrency)**: Flash sale with `desconto_quantidade_limite: 5`, 20 concurrent buyers. Exactly 5 receive promotional price, 15 pay standard price, quota utilized equals 5.
   - **Scenario ST-06 (Insolvent Referrer Bonus Clawback)**: Order return with referral commission clawback when referrer has already withdrawn (`saldo_carteira = 0`). Transaction succeeds atomically without negative balance drift (`greatest(0, ...)`).
   - **Scenario ST-07 (Cross-Cart Deadlock Stress with Promotional Gifts)**: Interleaved carts with promotional gifts locking intersecting products across 50 concurrent transactions. Proves 40P01 deadlock immunity.
4. **Verification**:
   - Run `npx vitest run src/tests/marketplace-concurrency-simulation.test.ts`
   - Run all marketplace test suites:
     `npx vitest run src/tests/marketplace-concurrency-simulation.test.ts src/tests/marketplace-returns-exchanges-atomicity.test.ts src/tests/marketplace-checkout-concurrency-audit.test.ts src/tests/marketplace-checkout-pricing.test.ts src/tests/marketplace-pricing-integrity.test.ts`
   - All tests (now 65+ in the main simulation file and 136+ total) must pass with 0 failures.
5. Document the test implementations, run commands, and execution metrics in `handoff.md` in your working directory.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
