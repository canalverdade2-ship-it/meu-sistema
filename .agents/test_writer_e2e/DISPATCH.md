## 2026-08-27T18:35:33Z

You are the E2E Test Writer for the WhatsApp Evolution API Stability & Humanization Project.
Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\test_writer_e2e
Scope Document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
User Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (see 2026-08-27T18:30:11Z)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Create `TEST_INFRA.md` at project root documenting testing methodology, feature inventory coverage matrix (all 17 features from PROJECT.md), and test architecture.
2. Design and implement comprehensive, requirement-driven opaque-box E2E test suites in `src/tests/`:
   - `src/tests/whatsapp-e2e-variation.test.ts` (Tier 1 & Tier 2 for R2: greetings, footers, zero-width space entropy, URL dynamic parameters with queries/hashes, PDF safe byte mutation with buffer SHA-256 checks).
   - `src/tests/whatsapp-e2e-humanization.test.ts` (Tier 1, Tier 2, Tier 3 for R1 & R3: presence choreography order: read receipt -> available -> composing (4s) -> paused (2s) -> composing (3s) -> send -> unavailable; micro-jitter between distinct numbers; same-number message grouping; 3-tier fallback cascade preservation).
   - `src/tests/whatsapp-e2e-health-queue.test.ts` (Tier 1, Tier 2, Tier 3, Tier 4 for R4 & R5: keep-alive periodic polling, adaptive tab visibility, latency telemetry, pause dispatch queue retention and unpause FIFO flush).
3. Ensure the test suites follow the 4-Tier methodology:
   - Tier 1: Feature Coverage (>=5 tests per feature)
   - Tier 2: Boundary & Corner Cases (empty strings, malformed URLs, corrupt PDFs, network timeouts, offline recovery)
   - Tier 3: Cross-Feature Interactions
   - Tier 4: Real-World Scenarios
4. Execute tests via `npx vitest run src/tests/whatsapp-e2e-*.test.ts` and verify types via `npm run typecheck:strict`.
5. Once the tests are written and verified, create `TEST_READY.md` at project root.
6. Write a comprehensive report in `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\test_writer_e2e\handoff.md` and notify parent.
