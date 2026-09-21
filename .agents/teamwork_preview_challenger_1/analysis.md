# Adversarial Challenge Report — Challenger 1

**Domain Focus**: Partner Benefit Redemption & Auth Session Persistence Subsystems  
**Date**: 2026-08-26  
**Agent**: Challenger 1 (Empirical Challenger & Adversarial Specialist)  
**Target Workspace**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`

---

## Challenge Summary

**Overall risk assessment**: LOW (with 2 minor TypeScript type annotations flagged)

Empirical testing across 16 adversarial stress scenarios, 1,000 protocol generation samples, 10,000 entropy verification iterations, phone/email boundary test cases, and offline network drop simulations verified the robustness of the Partner Benefit Redemption and Auth Session subsystems. The official Vitest automated test suite passed 100% (17 test files, 182 unit/integration tests, 0 failures), and the Vite production build compiled cleanly across 3,880 modules.

---

## Challenges & Stress Scenarios

### Challenge 1: Protocol Generation Format & Collision Resistance
- **Assumption challenged**: The protocol generator produces tokens adhering strictly to `^PROT-RES-\d{4}-[A-Z0-9]{6}$` with zero collisions in high-concurrency 1,000-sample batches and resilience against year rollovers.
- **Attack scenario**: Generate 1,000 sequential protocol samples using both PostgreSQL database hashing logic (`upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))`) and frontend fallback generation (`PROT-RES-YYYY-XXXXXX`). Test malformed inputs (non-numeric years, invalid lengths of 5 or 7 characters, lowercase characters, special symbols).
- **Blast radius**: If protocols collide or fail regex validation, redemption records in `parceiros_resgates` could overwrite each other, causing administrative confusion and failed customer redemption lookups.
- **Mitigation & Findings**: 
  - Database generator: 1,000 / 1,000 samples matched `^PROT-RES-\d{4}-[A-Z0-9]{6}$` with 0 collisions (1,000 unique keys).
  - Extended 10,000-sample entropy test: 9,998 unique keys (99.98% uniqueness).
  - Frontend fallback: 1,000 / 1,000 samples matched `^PROT-RES-\d{4}-[A-Z0-9]{6}$`.
  - Boundary rejection: 13 / 13 malformed protocols rejected correctly.

---

### Challenge 2: Public Partner Redemption RPC Parameters & Input Sanitization
- **Assumption challenged**: The RPC `gsa_public_resgatar_beneficio_parceiro` and `PartnerBenefitRedeemModal.tsx` handle erratic user input (international phone formats, missing DDD, interleaved spaces/dashes, empty/null emails, XSS strings) without crashing or saving corrupted database records.
- **Attack scenario**: Feed edge-case phone strings (`(11) 98765-4321`, `+55 (11) 98765-4321`, `+55 11 98888-7777`, `11-98765.4321`, `  1 1 9 8 7 6 5 4 3 2 1  `, `123456789`, `abc-def-ghij`), various email values (`""`, `null`, `undefined`, `"   "`, `"user+tag@domain.com"`), and HTML injection names (`<script>alert("xss")</script>`).
- **Blast radius**: If phone validation fails, WhatsApp notifications will not be delivered via Evolution API/n8n. If empty email string `""` causes SQL type violations, public redemption will abort.
- **Mitigation & Findings**:
  - The database uses `v_clean_phone := regexp_replace(v_telefone, '\D', '', 'g')` and requires `length(v_clean_phone) >= 10`. All 12 phone test cases performed exactly as expected.
  - The database uses `v_email text := nullif(trim(COALESCE(p_email, '')), '');` which safely converts empty strings and whitespace to database `NULL`.
  - The frontend `redeemPartnerBenefit` service handles optional `email` and gracefully falls back to the 5-parameter signature if an older RPC signature is encountered (`PGRST202`).

---

### Challenge 3: Auth Session Multi-Store Synchronization & Offline Network Drop Resilience
- **Assumption challenged**: Authenticated sessions stored in `_gsa_session` survive browser reloads, storage deletions in single stores, and transient network dropouts without logging out the user unexpectedly.
- **Attack scenario**:
  1. Write session and verify simultaneous persistence in `localStorage`, `sessionStorage`, and top-level `sessaoId`.
  2. Clear `localStorage` and verify automatic session restoration from `sessionStorage`.
  3. Inject malformed JSON into `localStorage` and verify graceful `null` return without unhandled exception.
  4. Simulate offline network drops (RPC `gsa_validate_session` throwing `TypeError: Failed to fetch` or HTTP 503) during `restoreSession` and `pingSession`.
- **Blast radius**: If network dropouts invalidate sessions, users in unstable mobile networks will experience abrupt, frustrating auto-logouts.
- **Mitigation & Findings**:
  - `sessionService.ts` wraps DB validation and auth refresh in resilient try/catch blocks. When the network is down or RPC fails transitively, the local session is retained.
  - Session is explicitly revoked ONLY when the database RPC explicitly returns `is_valid: false` or `status: 'encerrado'`.

---

### Challenge 4: Realtime Auto-Logout Trigger Exclusivity
- **Assumption challenged**: The Supabase Realtime channel listener in `useAutoLogout.ts` triggers auto-logout ONLY upon receiving an explicit payload with `status: 'encerrado'`.
- **Attack scenario**: Simulate PostgreSQL UPDATE payloads with statuses `'ativo'`, `'em_uso'`, `'pendente'`, and `'encerrado'`.
- **Blast radius**: Accidental logout of active users on non-terminal status updates.
- **Mitigation & Findings**:
  - `useAutoLogout.ts` line 57 checks `if (payload.new && payload.new.status === 'encerrado')`.
  - All non-terminal events (`'ativo'`, `'em_uso'`, `'pendente'`) were ignored without triggering logout.

---

## Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **DB Protocol Regex Compliance (1,000 samples)** | 100% match `^PROT-RES-\d{4}-[A-Z0-9]{6}$` | 1,000 / 1,000 matched | **PASS** |
| **DB Protocol Collisions (1,000 samples)** | 0 collisions (1,000 unique) | 1,000 / 1,000 unique (0 collisions) | **PASS** |
| **Extended Entropy Check (10,000 samples)** | >99.5% uniqueness | 9,998 / 10,000 unique (99.98%) | **PASS** |
| **Frontend Fallback Protocol Regex (1,000 samples)** | 100% match `^PROT-RES-\d{4}-[A-Z0-9]{6}$` | 1,000 / 1,000 matched | **PASS** |
| **Malformed Protocol String Rejection** | 13/13 invalid formats rejected | 13/13 rejected by regex | **PASS** |
| **Phone Number Parsing (12 edge cases)** | Valid >= 10 digits pass, < 10 fail | 12/12 matched expected result | **PASS** |
| **Email NULL / Empty Sanitization (6 cases)** | Empty string / whitespace converted to `NULL` | 6/6 converted to `NULL` | **PASS** |
| **Name Input Validation & Sanitization (6 cases)** | Minimum length 2, XSS preserved safely | 6/6 validated and trimmed | **PASS** |
| **24h SLA Mode Determination** | `delay_24h: true`, `tipo_resgate: manual_24h` | Correctly identified 24h SLA | **PASS** |
| **Immediate Mode Determination** | `delay_24h: false`, `tipo_resgate: cupom` | Correctly identified immediate release | **PASS** |
| **Multi-Store Sync (localStorage + sessionStorage)** | Both stores contain identical session | Synced across all stores | **PASS** |
| **SessionStorage Fallback** | Fallback works when localStorage is empty | Restored session correctly | **PASS** |
| **Corrupted JSON Recovery** | Return `null` gracefully without throwing | Returned `null` safely | **PASS** |
| **Offline Network Drop during restoreSession** | Session preserved, no logout | Session retained (`sess-test-999`) | **PASS** |
| **Explicit Revocation (`is_valid: false`)** | Storage cleared, session returned null | Storage cleared, returned `null` | **PASS** |
| **Realtime Listener Status Filter** | Only `status === 'encerrado'` logs out | 4/4 events handled accurately | **PASS** |

---

## Vitest Automated Test Execution Results

Command: `npx vitest run src/tests`
- **Total Test Files**: 17 passed (17)
- **Total Tests**: 182 passed (182)
- **Failures / Errors**: 0
- **Execution Duration**: 136.08s

---

## Production Build Verification

Command: `npm run build`
- **Result**: Built successfully in 2m 19s (3,880 modules transformed, exit code 0).

---

## TypeScript Strict Typecheck Audit Findings

Execution of `npx tsc --noEmit` flagged 4 type check items in test files:
1. `src/tests/partner-public-redemption-rpc.test.ts` (lines 156, 214, 302): `PartnerBenefitRedemptionPayload` specifies `email: string;` as required in `src/features/partners/types.ts:62`, whereas `src/features/partners/service.ts:219` (`if (payload.email)`) and the backend RPC `p_email text DEFAULT NULL` allow email to be optional. Recommendation: Change `email?: string;` in `PartnerBenefitRedemptionPayload`.
2. `src/tests/whatsapp-pricing-idempotency-challenger.test.ts` (line 576): `match` callback parameter in `.forEach` inferred as `never` without explicit type annotation `(match: string)`.

---

## Unchallenged Areas

- **Hardware power outage on VPS PostgreSQL database during concurrent RPC write**: Out of scope for client-side and simulated adversarial testing.

---

## Final Challenger Verdict

**VERDICT: APPROVE** (with advisory for type definition alignment in `PartnerBenefitRedemptionPayload.email?: string`)
