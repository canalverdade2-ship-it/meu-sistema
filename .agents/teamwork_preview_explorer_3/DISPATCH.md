# DISPATCH — Explorer 3

## Mission
Design the Comprehensive Test & Verification Strategy for the Anti-Ban Shield:
- Investigate how testing can be performed programmatically via a standalone mock test runner (`test_antiban_queue.js`).
- Specify exact test cases and assertions required by Acceptance Criteria:
  1. Queue Delays: 3 rapid calls to the same user execute sequentially with randomized intervals (2-6s) and appropriate presence delays.
  2. Multi-user isolation: Queues for user A and user B execute independently without blocking each other.
  3. Realistic Presence: Mock Evolution API presence endpoint captures `composing` / `recording` with duration proportional to message length.
  4. Spintax / Text Variation: Verify `{A|B|C}` resolves correctly to one of the choices and greetings vary over 100 iterations.
  5. Resilience / Exponential Backoff: Simulate HTTP 500, network timeouts, and verify retry sequence with backoff before final success or safe failure.
  6. Business Logic Invariance: Verify sending PDFs (boletos), invoice links, and transactional flows are preserved cleanly.
- Write your comprehensive findings to `.agents/teamwork_preview_explorer_3/handoff.md` and `analysis.md`.

## 2026-08-21T23:40:37-03:00
Investigate the testing and validation requirements for the Anti-Ban Shield:
1. Examine existing tests in the repository (e.g. `src/tests/`, `package.json` test scripts, test runners like Vitest or Node.js scripts) to understand existing test conventions.
2. Design a standalone automated mock test suite `test_antiban_queue.js` (or in a dedicated test location) that will test:
   - Queue Serialization: When 3 messages are enqueued rapidly for user X, they are sent one by one with appropriate delays (2-6s + presence delay), while messages for user Y are processed concurrently.
   - Presence Emulation: Mocking Evolution API endpoints to verify that `composing` / `recording` presence requests are dispatched prior to message sending, and the simulated delay scales with text length.
   - Spintax & Variation: Unit tests verifying `{A|B|C}` returns varied outputs across multiple iterations, and greeting randomizer produces distinct greetings.
   - Resilience & Exponential Backoff: Simulate 500 server error on attempt 1 and 2, verify retry with delay, and verify success on attempt 3. Simulate permanent failure handling.
   - Transactional & Media Integrity: Verify that PDF/boleto sending payloads and attachments are sent without data corruption or infinite queue stalling.
3. Detail the exact assertions, timing checks, and test runner structure.
