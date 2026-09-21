# Handoff Report: Milestone 2 & 3 (Presence Choreography R1, Fallback Cascade, Concurrency Micro-Jitter & Batching R3)

**Agent**: `worker_m2_m3` (Implementer / QA / Specialist)  
**Date**: 2026-08-27  
**Scope**: `src/lib/whatsappNotificationService.ts`, `src/hooks/useWhatsAppDocument.ts`, `src/tests/whatsapp-notification-engine.test.ts`.

---

## 1. Observation

1. **Previous Implementation State in `src/lib/whatsappNotificationService.ts`**:
   - Outgoing dispatches through `enviarWhatsAppDireto` fired synchronous requests directly to Evolution API with fixed payload delays (`delay: 500`), without presence indicators (`composing`, `paused`, `available`, `unavailable`), without read receipts (`markMessageAsRead`), without initial random delay (4-12s), and without recipient-level concurrency control.
   - Concurrent requests for different phone numbers could hit port 8080 simultaneously.
   - Multiple notifications for the same recipient created separate dispatches rather than single consolidated batches.
   - Outgoing dispatches did not integrate dynamic variation mechanisms from `src/lib/whatsappVariationService.ts` (greetings/footers Spintax, zero-width space entropy `\u200B`, dynamic URL query params `?t=...&ref=...`, and safe ISO 32000-1 PDF byte variation).
   - The service did not check `whatsappHealthService.isPaused()` or expose queue management methods (`getQueueLength()`, `isPaused()`, `setPaused()`).

2. **Verification & Tool Executions**:
   - `npm run typecheck:strict`:
     ```
     > react-example@0.0.0 typecheck:strict
     > tsc --noEmit -p tsconfig.strict.json
     (exited with code 0)
     ```
   - Vitest Test Suite Execution (`npx vitest run src/tests/whatsapp-*.test.ts src/tests/empirical-stress-partner-whatsapp.test.ts`):
     ```
     Test Files  8 passed (8)
          Tests  238 passed (238)
       Duration  4.31s
     ```

---

## 2. Logic Chain

1. **R1 Presence Choreography Implementation**:
   - Defined `executeBatch` pipeline in `src/lib/whatsappNotificationService.ts`:
     * **Initial Delay**: Generates random delay between 4,000ms and 12,000ms (or respects `options.customInitialDelayMs`). In test mode (`process.env.NODE_ENV === 'test'` or `options.timeScale`), scales delays down by `0.001` (~1ms) so tests execute instantaneously.
     * **Read Receipt**: If `options.isReply` or `options.quotedMessageId` is present, dispatches `POST /chat/markMessageAsRead/GSA_WhatsApp` with `{ readMessages: [{ remoteJid, fromMe: false, id: quotedMessageId }] }`.
     * **Available Presence**: Dispatches `POST /chat/sendPresence/GSA_WhatsApp` with `{ number, presence: 'available' }`.
     * **Typing Indicator Choreography**: Dispatches `presence: 'composing'` (waits 4s scaled) -> `presence: 'paused'` (waits 2s scaled) -> `presence: 'composing'` (waits 3s scaled).
     * **3-Tier Cascade Dispatch**: Traverses Tier 1 (Evolution API port 8080) -> Tier 2 (Supabase Edge Function `vps-api`) -> Tier 3 (n8n webhook port 5678).
     * **Unavailable Presence Cleanup**: Sets `presence: 'unavailable'` after message delivery in all execution branches.
     * **Non-Blocking Resilience**: Every presence API call is wrapped in a `try/catch` block and guarded with `AbortSignal.timeout(2500)` so transient presence network glitches never block message delivery.

2. **R2 Integration (Dynamic Content & Media Variations)**:
   - Imported `applyDynamicGreetingAndFooter`, `randomizeMessageUrls`, `injectZeroWidthEntropy`, and `pdfVariationEngine` from `src/lib/whatsappVariationService.ts`.
   - Before dispatching text, `executeBatch` applies dynamic time-contextual greetings/footers (via `applyDynamicGreetingAndFooter`), tracking parameters (`?t=...&ref=...` via `randomizeMessageUrls`), and invisible zero-width space entropy (`\u200B` via `injectZeroWidthEntropy`).
   - For PDF attachments (`mediaBase64`), `pdfVariationEngine.applyBase64Variation` appends safe ISO 32000-1 comment bytes (`\n% GSA-RND-[timestamp]-[random]\n`) to guarantee unique buffer SHA-256 checksums without corrupting PDF rendering.

3. **R3 Concurrency Control & Grouping**:
   - **Micro-Jitter (Cross-Recipient)**: Maintained `lastDispatchTimestamp`. When processing dispatches to different phone numbers, enforces a micro-jitter delay (300ms to 1200ms scaled) between pipeline starts, preventing burst requests hitting port 8080 in the exact same millisecond.
   - **Same-Number Batching**: Maintained `pendingBatches: Map<string, ActiveBatch>`. When multiple notifications target the same recipient within the initial delay window, they are coalesced into a single batch composite message separated by clean dividers (`\n\n══════════════════════════════\n\n`). When the single composite message is sent, all enqueued promises resolve with `true`.

4. **R5 Integration (Health & Pause Dispatch)**:
   - In `enviarWhatsAppDireto`, checked `whatsappHealthService.isPaused()`. If paused, enqueues the notification in the local queue without sending HTTP requests to Evolution API, safely retaining messages.
   - Exposed `getQueueLength()`, `isPaused()`, and `setPaused()` on `whatsappNotificationService` per interface contracts.

5. **Test Enhancement in `src/tests/whatsapp-notification-engine.test.ts`**:
   - Expanded test suite to 24 tests covering:
     * Phone normalization & Baileys LID JID routing for Master Admin (`38830967099420@lid`).
     * 3-Tier fallback cascade (Tier 1 Evolution -> Tier 2 Edge Function `vps-api` -> Tier 3 n8n webhook).
     * Presence choreography full execution order and `skipPresence` bypass.
     * Non-blocking resilience when presence endpoints fail.
     * Same-number batching and composite message formatting.
     * Micro-jitter delay between distinct recipients.
     * Dynamic variation integration (greetings, footers, URL tracking, zero-width spaces, PDF mutation).
     * Local queue retention when dispatch is paused.
     * Automatic phone resolution from OS codes (`OS102`) and client greeting names.
     * All context template formatting types.

---

## 3. Caveats

- In production environments, full presence delays take ~9 to 21 seconds per message batch. In automated test environments (`NODE_ENV === 'test'` or `options.timeScale`), these delays are automatically scaled to ~1ms to ensure test suites execute within milliseconds.
- `useWhatsAppDocument.ts` passes `enableVariation: true` to ensure all documents sent through the UI benefit from the dynamic variation engine.
- No caveats.

---

## 4. Conclusion

Milestone 2 (Presence Choreography R1, Fallback Cascade) and Milestone 3 (Concurrency Micro-Jitter & Batching R3) are fully implemented and verified. All 238 unit and integration tests across 8 WhatsApp test suites pass with 100% success rate, and strict TypeScript compilation (`tsc --noEmit -p tsconfig.strict.json`) passes with 0 errors.

---

## 5. Verification Method

To independently verify the implementation:

1. **TypeScript Strict Typecheck**:
   ```bash
   npm run typecheck:strict
   ```
   *Expected output*: Exits with code 0 (no errors).

2. **Run Engine Test Suite**:
   ```bash
   npx vitest run src/tests/whatsapp-notification-engine.test.ts
   ```
   *Expected output*: 24 tests passed (100%).

3. **Run All WhatsApp Test Suites**:
   ```bash
   npx vitest run src/tests/whatsapp-notification-engine.test.ts src/tests/whatsapp-e2e-humanization.test.ts src/tests/whatsapp-e2e-variation.test.ts src/tests/whatsapp-e2e-health-queue.test.ts src/tests/whatsapp-health-service.test.ts src/tests/whatsapp-variation-engine.test.ts src/tests/whatsapp-pricing-idempotency-challenger.test.ts src/tests/empirical-stress-partner-whatsapp.test.ts
   ```
   *Expected output*: 8 test files passed, 238 tests passed (100%).
