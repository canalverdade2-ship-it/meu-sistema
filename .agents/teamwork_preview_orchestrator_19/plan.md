# Operational Plan — Marketplace End-to-End Audit & Concurrency Remediation

## Objective
Audit, stress-test, simulate concurrency, and proactively fix all logic flaws, race conditions, deadlocks, and inconsistencies across:
- Cart & Checkout cycles
- Returns & Exchanges post-sale workflows
- Points system, Coupons, Wallet balance, and Promotion mechanics
- Stock locking, ACID transactions, and Supabase / PostgreSQL RPCs

## Phases

### Phase 1: Exploration & Static Deep Audit Swarm
- **Explorer 1 (`exp_cart_checkout_loyalty`)**: Focus on Cart, Checkout, Coupon stacking, Points deduction/accumulation, Wallet deduction, and Promotion calculations in React components and Supabase queries.
- **Explorer 2 (`exp_returns_exchanges_stock`)**: Focus on Returns, Exchanges, reverse logistics, refund calculations (financial, wallet, points), and stock re-insertion atomicity.
- **Explorer 3 (`exp_db_concurrency_acid`)**: Focus on PostgreSQL RPCs, triggers, transactions, row-level locks (`FOR UPDATE`), read-modify-write (RMW) concurrency hazards, and migration integrity.

### Phase 2: Test Writer & Concurrency Simulation Swarm
- **Test Writer 1 (`test_checkout_concurrency`)**: Build simulation scripts testing concurrent checkouts, overselling / race conditions on low stock, coupon reuse races, and wallet balance overdrafts.
- **Test Writer 2 (`test_returns_reversals`)**: Build test scripts validating returns, atomic refunds, and stock restoration consistency.

### Phase 3: Implementation & Remediation Worker Swarm
- **Worker 1 / 2**: Fix all identified vulnerabilities, race conditions, deadlocks, missing locks, and client/server validation mismatches directly in project files. Run builds and verification suites.

### Phase 4: Adversarial Review & Forensic Gate
- **Reviewer 1 & Reviewer 2**: Independent verification of fixes, code quality, and non-regression.
- **Challenger 1 & Challenger 2**: Empirical stress verification and edge-case execution.
- **Forensic Auditor**: Binary veto integrity verification against cheating, mock façades, or unverified claims.
- **Final Gate & Victory Synthesis**: Consolidate findings, update documentation, and report to parent.
