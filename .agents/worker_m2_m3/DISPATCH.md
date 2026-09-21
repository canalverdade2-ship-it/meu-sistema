## 2026-08-27T18:40:13Z

You are the Worker for Milestone 2 & 3 (Presence Choreography R1, Fallback Cascade, Concurrency Micro-Jitter & Batching R3).
Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_m3
Scope Document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Survey Analysis: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_1\analysis.md
User Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (see 2026-08-27T18:30:11Z)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You own `src/lib/whatsappNotificationService.ts`, `src/hooks/useWhatsAppDocument.ts`, and test file `src/tests/whatsapp-notification-engine.test.ts`.

Tasks:
1. Refactor `src/lib/whatsappNotificationService.ts` to implement:
   - **R1: Presence Choreography**:
     * Initial random delay (4 to 12 seconds, non-blocking asynchronous).
     * Mark as read receipt (`POST /chat/markMessageAsRead/GSA_WhatsApp` with `{ readMessages: [{ remoteJid: number, fromMe: false, id?: msgId }] }`) if `options?.isReply` or incoming message context exists.
     * Set presence `available` (`POST /chat/sendPresence/GSA_WhatsApp` with `{ number, presence: 'available' }`).
     * Typing sequence: `presence: composing` (wait 4s) -> `presence: paused` (wait 2s) -> `presence: composing` (wait 3s).
     * Send message via 3-Tier Fallback Cascade (Tier 1: Evolution API port 8080 -> Tier 2: Edge function `vps-api` -> Tier 3: n8n webhook port 5678).
     * Set presence `unavailable` (`POST /chat/sendPresence/GSA_WhatsApp` with `{ number, presence: 'unavailable' }`).
     * Guard presence calls with non-blocking timeouts (e.g. 2.5s) and `try/catch` so temporary presence endpoint glitches never block notification delivery.
     * Dynamic `timeScale` support: in test environment (`process.env.NODE_ENV === 'test'` or `options?.skipPresence` or `options?.timeScale`), scale delays to ~1ms so tests execute instantaneously.
   - **R2 Integration**:
     * Apply dynamic content variations (`applyDynamicGreetingAndFooter`, `randomizeMessageUrls`, `injectZeroWidthEntropy`, `pdfVariationEngine`) from `src/lib/whatsappVariationService.ts` to all outgoing text and media dispatches.
   - **R3: Concurrency Control & Grouping**:
     * Micro-Jitter: When concurrent requests target **different numbers**, enforce an asynchronous micro-jitter delay (300ms to 1200ms) between processing pipelines to prevent burst requests hitting port 8080 in the exact same millisecond.
     * Batching / Grouping: When multiple messages target the **same number** within the initial delay window, group them into a single formatted text block with clean dividers (`\n\n══════════════════════════════\n\n`), resolving all enqueued promises when the single batch is sent.
   - **R5 Integration**:
     * Check `whatsappHealthService.isPaused()`. If paused, enqueue notification in local queue and resolve/wait according to queue semantics without discarding messages.
2. Update `src/tests/whatsapp-notification-engine.test.ts` to cover presence choreography sequence, micro-jitter, same-number batching, fallback cascade, and variation integration.
3. Verify with `npx vitest run src/tests/whatsapp-notification-engine.test.ts` and `npm run typecheck:strict`.
4. Document all changes in `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_m3\handoff.md` and report back.
