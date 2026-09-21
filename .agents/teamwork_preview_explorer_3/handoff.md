# HANDOFF REPORT — Explorer 3: WhatsApp Anti-Ban Shield Test Suite Architecture

**Agent**: Explorer 3  
**Role**: Investigation & Test Architecture  
**Target Milestone**: WhatsApp Anti-Ban Shield Testing & Validation Strategy  
**Output Files**: `analysis.md`, `handoff.md`, `BRIEFING.md`, `progress.md`

---

## 1. Observation

Direct code observations from the repository:

1. **Monolithic Webhook Servers**:
   - `server_webhook_vps_live.cjs` (7,880 lines, 395KB) and `server_webhook.cjs` (8,142 lines, 409KB).
   - In both files, outbound message dispatch is handled by:
     - `sendWhatsAppReply(to, messageText, retryCount)` at `server_webhook_vps_live.cjs:2485`. Dispatches directly to `POST http://127.0.0.1:8080/message/sendText/GSA_WhatsApp` with `{ number, text }`.
     - `sendWhatsAppMedia(to, cleanMedia, fileName, caption, mediaType)` at `server_webhook_vps_live.cjs:2870`. Dispatches directly to `POST http://127.0.0.1:8080/message/sendMedia/GSA_WhatsApp` with `{ number, mediatype, mimetype, media, fileName, caption }`.
   - Ad-hoc delays exist in multiple places (e.g. `server_webhook_vps_live.cjs:1505` `setTimeout(() => sendWhatsAppReply(...), 900)` and `server_webhook.cjs:1250`), showing brittle hardcoded timeouts rather than a managed queue.

2. **Absence of Anti-Ban Shield Infrastructure**:
   - Zero per-user queue management: Multiple messages triggered simultaneously (e.g. order confirmation + PIX copy-paste code + satisfaction survey at lines 2254–2262) hit the Evolution API concurrently within milliseconds.
   - Zero typing/recording presence emulation: No calls to `/chat/sendPresence` or `/message/sendPresence` exist prior to message delivery.
   - Zero Spintax variation: Greeting templates and recurring responses are static strings.
   - Naive retry: Fixed 2-second retry without backoff progression or jitter (lines 2522–2526).

3. **Existing Testing Conventions**:
   - `src/tests/*.test.ts`: Vitest test files for frontend / utility math (`npm run test:unit`).
   - `scripts/*.cjs`, `scripts/*.mjs`, `scratch/*.cjs`: Standalone Node.js scripts executed directly (`node scripts/...` or `tsx scripts/...`) that run assertion checks and exit with code 0 or 1.
   - Requirement from `ORIGINAL_REQUEST.md` specifies a standalone local mock test runner `test_antiban_queue.js` runnable locally with zero external service dependencies.

---

## 2. Logic Chain

1. **From Immediate Dispatch Vulnerability to Per-User Queue (R1)**:
   - **Premise**: Meta flags bot accounts when multiple messages to the same recipient arrive with sub-second intervals.
   - **Reasoning**: A per-phone FIFO queue ensures sequential processing where message $N+1$ only begins after message $N$ has finished sending PLUS a randomized inter-message jitter interval (2,000ms – 6,000ms).
   - **Concurrency Requirement**: To prevent head-of-line blocking for other users, queues must be keyed by recipient phone number (`Map<string, Queue>`), running concurrently across different recipients.

2. **From Missing Presence to Dynamic Typing Emulation (R2)**:
   - **Premise**: Humans take time to type messages proportional to text length and show a "typing..." / "recording..." indicator in WhatsApp.
   - **Reasoning**: Before dispatching text or documents, the system must emit `composing` presence to Evolution API and wait a dynamically computed delay:
     $$\text{delay} = \text{clamp}(1500\text{ms}, \text{base} + \text{length} \times 35\text{ms}, 8000\text{ms})$$
     For audio payloads, the system emits `recording` presence.

3. **From Repetitive Text to Spintax Variation (R3)**:
   - **Premise**: Meta spam filters flag identical repeated message strings across chats.
   - **Reasoning**: A Spintax engine resolves `{Option A|Option B|Option C}` (supporting nested groups) on outbound text templates while preserving dynamic template variables (`{nome}`, `{link}`, `{valor}`).

4. **From Naive 2s Retries to Exponential Backoff (R4)**:
   - **Premise**: When Evolution API or VPS network drops, immediate or fixed 2s retries risk cascading server overload.
   - **Reasoning**: Exponential backoff ($\text{base} \times 2^{\text{attempt}} + \text{jitter}$) spreads retry attempts. If max retries (3) are exceeded, the failure is logged gracefully, and the user queue proceeds without hanging indefinitely.

5. **From Theoretical Requirements to Standalone Mock Suite (`test_antiban_queue.js`)**:
   - **Premise**: Testing cannot rely on live WhatsApp numbers or remote VPS instances.
   - **Reasoning**: An embedded HTTP server mocking Evolution API endpoints allows capturing request orders, measuring inter-message deltas, injecting faults (500 errors, latency), and verifying byte-for-byte base64 PDF integrity in a self-contained executable.

---

## 3. Caveats

1. **Evolution API Version Endpoints**:
   - Evolution API v1 and v2 use `POST /chat/sendPresence/:instance` and `POST /message/sendText/:instance`. The mock server supports these canonical endpoints. Configurable baseUrl / paths should be supported.
2. **Virtual / Scaled Time vs Real-Time Execution**:
   - Running full real-time delays (e.g. 3 messages $\times$ ~5s delay = 15s per test) is essential for absolute 1:1 validation, but can take ~45s for the whole suite.
   - The test harness is designed with an optional `TIME_SCALE` environment variable (e.g. `TIME_SCALE=0.1`) that scales all delays by 10x for ultra-fast CI runs while maintaining identical logic paths and proportional assertions.
3. **Port Conflicts**:
   - The mock test runner defaults to port `8085` (or reads `MOCK_EVOLUTION_PORT`) so it never collides with production services running on port 8080 or 5680.

---

## 4. Conclusion

The testing and validation architecture for the Anti-Ban Shield is fully specified in `analysis.md`.

The standalone test suite `test_antiban_queue.js` will rigorously validate 7 core test dimensions:
1. **Per-User Queue Serialization**: 3 rapid calls execute strictly in FIFO sequence with randomized 2–6s intervals.
2. **Multi-User Concurrency**: User B's messages complete without waiting on User A's queue.
3. **Presence Emulation & Scaling**: `composing` / `recording` is emitted prior to message delivery, with typing duration scaling proportionally with character count (clamped 1.5s – 8.0s).
4. **Spintax & Variation Resolution**: `{A|B|C}` resolves cleanly, nested groups resolve, template variables are preserved, and greetings vary across 100+ runs.
5. **Resilience & Exponential Backoff**: HTTP 500 triggers exponential retry backoff, succeeding on attempt 3.
6. **Permanent Failure Resilience**: 3 consecutive errors do not crash the process or stall the queue.
7. **Transactional & Media Integrity**: PDF base64 payloads and PIX QR images are sent without byte corruption or memory leaks.

---

## 5. Verification Method

### Test Execution Commands:
```bash
# 1. Standard Real-Time Validation (Full 1:1 Production Timing Check):
node test_antiban_queue.js

# 2. Fast Scaled CI Validation (10x Speed Scaling):
TIME_SCALE=0.1 node test_antiban_queue.js
```

### Invalidation Conditions:
- Exit code $\neq 0$.
- Any message sent without a preceding `sendPresence` call.
- Any message $N+1$ starting before message $N$ completes + minimum inter-message delay.
- User B message blocked behind User A's queue.
- Spintax output containing unparsed braces `{` or `}`.
- PDF base64 hash mismatch after transmission.
