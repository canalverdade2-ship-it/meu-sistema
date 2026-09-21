# E2E Test Infra: GSA HUB Production Mass Audit

## Test Philosophy
- Opaque-box, requirement-driven testing covering Frontend, Database RPCs, Payments, Affiliates, Commercial Partners, WhatsApp, and Super-domains.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinations + Real-World Workload Testing.

## Feature Inventory & Test Coverage
| # | Feature | Source | Tier 1 (Happy) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workloads) |
|---|---------|--------|:--------------:|:-----------------:|:-----------------:|:------------------:|
| 1 | Partner Benefit Redemptions | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 2 | Affiliate Attribution & Payouts | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 3 | Payment Gateway & EMV PIX | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 4 | WhatsApp 3-Tier Fallback | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 5 | Database Schema & Column Verification | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 6 | Super-domains & Admin Workflows | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |

## Test Architecture
- Test runner: Vitest (`npx vitest run src/tests`) & Schema Verifier Script (`node scripts/validate-db-schema.cjs`).
- Test case directory: `src/tests/` (244+ tests across 18+ suites).
- Pass/Fail semantics: 100% pass rate, 0 skipped/failed, zero TypeScript compile errors (`npx tsc --noEmit`).

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | End-to-End Partner Redemption with 24h SLA | Form capture -> RPC -> DB persistence -> Admin dashboard -> WhatsApp notification | High |
| 2 | Multi-Tier Affiliate Conversion & Settlement | Referral click capture -> conversion binding -> commission calculation -> maturation -> payout approval | High |
| 3 | PIX Checkout with Dynamic Promotional Discount | Cart calculation -> BACEN EMV PIX generation -> invoice persistence -> webhook settlement | High |
| 4 | Resilient Messaging Under Network Blackout | Evolution API timeout -> Edge function failure -> n8n webhook recovery with Baileys LID delivery | High |
