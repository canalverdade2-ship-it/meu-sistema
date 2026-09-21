# Gate 2 Empirical Challenge Report — Affiliate Commissions, Payouts, Points Conversion & PIX EMV Processing

**Date**: 2026-08-27T00:38:00Z  
**Agent**: `teamwork_preview_challenger_gate_2`  
**Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Test Suite Execution Results
Ran Vitest across all target domain test suites and the new empirical challenger gate 2 stress harness:

```bash
npx vitest run src/tests/affiliates-attribution-payout.test.ts src/tests/affiliate-commissions-edge-cases.test.ts src/tests/marketplace-checkout-pricing.test.ts src/tests/whatsapp-pricing-idempotency-challenger.test.ts src/tests/empirical-challenger-gate-2.test.ts
```

**Output**:
```
 ✓ src/tests/whatsapp-pricing-idempotency-challenger.test.ts (62 tests) 528ms
 ✓ src/tests/affiliate-commissions-edge-cases.test.ts (17 tests) 110ms
 ✓ src/tests/empirical-challenger-gate-2.test.ts (21 tests) 115ms
 ✓ src/tests/affiliates-attribution-payout.test.ts (17 tests) 151ms
 ✓ src/tests/marketplace-checkout-pricing.test.ts (20 tests) 46ms

 Test Files  5 passed (5)
      Tests  137 passed (137)
   Duration  25.46s
```

### 1.2 TypeScript Compilation & Type Integrity
Ran full project type check:
```bash
npx tsc --noEmit
```
**Output**: Exited with code 0 (no type errors).

### 1.3 Target Domains Inspected & Verified
- **Affiliate Attribution & Parameter Sanitization**:
  - `src/features/affiliates/attribution.ts` (lines 6-9, 34-40, 94-106, 108-141, 144-169)
  - `LINK_CODE_PATTERN = /^[A-Za-z0-9_-]{6,96}$/` strictly validates referral codes before storage or network calls.
  - `sanitizeLandingPath` strips `ref` parameter from URL while preserving path, parameters (`utm_*`, etc.) and anchors (`#hash`).
  - Session storage strictly bounds pending clicks to `MAX_PENDING_CLICKS = 8` and purges expired entries (`expiresAt <= now`).
  - Concurrent invocations of `processCapturedAffiliateReferral()` and `bindPendingAffiliateClicks()` are protected by in-flight promise latches (`processingReferral`, `bindingClicks`), preventing duplicate network calls.
- **Affiliate Service & Payouts**:
  - `src/features/affiliates/service.ts` (lines 132-157, 192-211)
  - Normalization safely provides defaults for missing summary fields (`saqueMinimo = 50`, `pontosTaxa = 0.01`, `pontosMinimo = 100`, `pontosAtivo = true`).
  - `requestAffiliatePayout` transmits client UUID `p_request_id` for backend idempotency.
  - `redeemAffiliatePoints` dispatches points redemption with exact conversion rate math.
- **Database Schema & RPC Concurrency Constraints**:
  - `supabase/migrations/20260729110000_fix_affiliate_all_issues.sql`:
    - `gsa_client_request_affiliate_payout` (lines 105-232): uses `SELECT ... FOR UPDATE` locks on `gsa_afiliados` and `gsa_afiliado_saques`. Strict idempotency check on `request_id` returns existing payout payload without creating duplicates. Checks `v_value < v_minimum` and `v_value > v_available` before creating a payout.
    - `gsa_client_join_affiliate` (lines 21-101): validates string lengths (`p_nome_divulgacao` 3..120 chars, `p_pix_chave` 3..180 chars, `p_termos_versao` 1..40 chars) and uses atomic `ON CONFLICT (cliente_id) DO UPDATE`.
    - `gsa_client_affiliate_snapshot` (lines 236-423): aggregates available balance as `sum(disponivel) + wallet - requested - approved >= 0`.
- **PIX Payment Engine & EMV CRC16-CCITT Standards Compliance**:
  - `src/lib/pixService.ts` (lines 6-22, 27-30, 44-103):
    - `crc16()` implements CCITT standard polynomial `0x1021` with init `0xFFFF`, returning a 4-character uppercase hex string padded with zeros.
    - `generatePixCopiaECola()` strips accents (`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`), converts to ASCII uppercase, truncates receiver name to 25 chars and city to 15 chars, formats EMV tags (`00`, `01`, `26`, `52`, `53`, `54`, `58`, `59`, `60`, `62`, `63`), and appends valid CRC16 checksum.
    - When `valor === 0`, sets Tag `01` to `11` (static PIX) and omits Tag `54` (amount).
    - When `valor > 0`, sets Tag `01` to `12` (dynamic PIX) and includes Tag `54` with 2 decimal places.
    - `createInfinitePayOrderCheckout` gracefully bypasses gateway for R$ 0,00 orders fully covered by points/wallet.

---

## 2. Logic Chain

1. **Edge Case Handling (Zero & Negative Amounts)**:
   - In `productPricing.ts` and `affiliate-commissions-edge-cases.test.ts` / `empirical-challenger-gate-2.test.ts`, negative and zero gross order values are bounded via `Math.max(0, valor)`, preventing negative commission calculations or NaN outputs.
   - In `pixService.ts`, `createInfinitePayOrderCheckout` checks `valorFinal < 0.01` and returns `{ success: true }` without creating dummy gateway charges.
   - In `gsa_client_request_affiliate_payout` RPC, `v_value <= 0` throws an exception, and `v_value < v_minimum` enforces the program threshold.

2. **Concurrency & Idempotency**:
   - In `attribution.ts`, concurrent calls to `processCapturedAffiliateReferral` or `bindPendingAffiliateClicks` latch to a single promise instance.
   - In `gsa_client_request_affiliate_payout`, the backend utilizes row-level locking (`FOR UPDATE`) on the affiliate profile and evaluates the unique `request_id` in `gsa_afiliado_saques`. Duplicate incoming requests return the existing record with `idempotent: true`.

3. **Input Sanitization & Injection Defense**:
   - `captureAffiliateReferralFromLocation()` applies `LINK_CODE_PATTERN` (`^[A-Za-z0-9_-]{6,96}$`). Any string with spaces, HTML tags (`<script>`), SQL syntax, quotes, or lengths `< 6` or `> 96` is immediately discarded before touching `sessionStorage` or invoking backend RPCs.
   - `sanitizeLandingPath()` extracts the path, clears the `ref` query param, and retains all other search parameters and hashes without escaping defects.

4. **PIX EMV & CRC16-CCITT Standards Conformance**:
   - The implementation of `crc16` was tested against standard BACEN test vectors and generated BR Code payloads.
   - The checksum consistently matches the EMV payload specification and produces valid 4-character hex digests.

---

## 3. Caveats

- **External Gateway Live API**: Tests mock the HTTP fetch to `https://api.checkout.infinitepay.io/links` and Evolution API endpoints, which is standard for offline unit/integration test harnesses. The client gracefully handles network errors (HTTP 500, timeouts, offline mode) via fallback cascades and local storage retry queues.
- No other caveats.

---

## 4. Conclusion

**Verdict: APPROVE**

All 5 test suites (137 tests total) passed with 100% success rate:
- Commission calculation correctly handles varying tier rates, sub-cent values, zero values, and negative amounts.
- Payout requests enforce minimum thresholds, available balance checks, and idempotent latching.
- Points conversion accurately computes wallet credits with exact decimal precision.
- Referral capture sanitizes query parameters and protects against XSS/injection payloads.
- PIX EMV BR Code generation and CRC16-CCITT calculation comply with BACEN standards.
- Full TypeScript compilation passes without errors (`tsc --noEmit` code 0).

---

## 5. Verification Method

To independently verify all findings and test suites:

```bash
# Run all Gate 2 test suites
npx vitest run src/tests/affiliates-attribution-payout.test.ts src/tests/affiliate-commissions-edge-cases.test.ts src/tests/marketplace-checkout-pricing.test.ts src/tests/whatsapp-pricing-idempotency-challenger.test.ts src/tests/empirical-challenger-gate-2.test.ts

# Run TypeScript compilation check
npx tsc --noEmit
```
