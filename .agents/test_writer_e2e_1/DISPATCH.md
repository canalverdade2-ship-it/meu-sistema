# DISPATCH for test_writer_e2e_1

## 2026-09-10T22:38:31Z

- **Milestone**: M1 - E2E Concurrency Simulation & Stress Testing Suite
- **Role**: Test Writer
- **Exclusive Write Ownership**:
  - `src/tests/marketplace-concurrency-simulation.test.ts` (or `src/tests/concurrency/`)
  - `TEST_INFRA.md` (at project root)
  - `TEST_READY.md` (at project root)
  - `.agents/test_writer_e2e_1/`

- **Task**:
  Design and implement a comprehensive, opaque-box, extreme concurrency simulation test suite (Tiers 1 to 4) validating the ACID properties, pricing isolation, and stock integrity of the GSA Marketplace:
  - **Tier 1 (Feature Coverage, >=5 per feature)**: Base product checkout, variant checkout, discount calculation, return approval, stock restitution.
  - **Tier 2 (Boundary & Corner Cases, >=5 per feature)**: Zero stock purchase attempt, 1-millisecond concurrent purchase race on last available item, zero-balance checkout, partial returns.
  - **Tier 3 (Cross-Feature Combinations)**: Checkout with variant + coupon + wallet + loyalty points + simultaneous concurrent return request.
  - **Tier 4 (Real-World Extreme Workload)**: 50-100 simultaneous concurrent transactions firing in the exact same millisecond against the same product/variant, proving mathematically and empirically that:
    1. Zero overselling occurs.
    2. Catalog price (`produtos.valor`) is never corrupted.
    3. Exactly the purchased quantity is decremented.
    4. Exact stock, points, and wallet balance are restored upon return without phantom inflation or infinite points arbitrage.

- **Verification**:
  Run the test suite using `npx vitest run src/tests/marketplace-concurrency-simulation.test.ts` (or `npm test`) and ensure it compiles and executes. Document the results in `TEST_READY.md` and handoff report.

- **Mandatory Warning**:
  DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
