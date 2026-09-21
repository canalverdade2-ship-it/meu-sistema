# BRIEFING — 2026-08-27T18:49:00Z

## Mission
Implement Presence Choreography (R1), Fallback Cascade Preservation, Dynamic Variation Integration (R2), and Concurrency Micro-Jitter & Batching (R3) in `src/lib/whatsappNotificationService.ts`, `src/hooks/useWhatsAppDocument.ts`, and test suite `src/tests/whatsapp-notification-engine.test.ts`.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2_m3
- Original parent: de46c867-b808-452b-b636-5e41ba5f6f82
- Milestone: M2 & M3

## 🔒 Key Constraints
- Genuine implementation with no hardcoding or facade tricks.
- Preserve 3-Tier Fallback Cascade (Evolution API port 8080 -> Edge Function `vps-api` -> n8n webhook port 5678).
- Presence choreography (initial delay, read receipt, available, composing 4s -> paused 2s -> composing 3s, dispatch, unavailable).
- Micro-jitter (300-1200ms) between distinct recipients; same-recipient batching with dividers.
- R2 dynamic variations (greetings, footers, zero-width spaces, tracking params, PDF safe byte mutation).
- Dynamic timeScale scaling for instantaneous unit/integration tests.
- Pass `npm run typecheck:strict` and vitest test suites.

## Current Parent
- Conversation ID: de46c867-b808-452b-b636-5e41ba5f6f82
- Updated: 2026-08-27T18:49:00Z

## Task Summary
- **What to build**: Full presence choreography pipeline, micro-jitter, same-number grouping/batching, dynamic variation integration, and comprehensive test suite in `src/lib/whatsappNotificationService.ts` and `src/tests/whatsapp-notification-engine.test.ts`.
- **Success criteria**: 100% tests passing in Vitest (238/238 tests in WhatsApp suites), `npm run typecheck:strict` passing with 0 errors.

## Key Decisions Made
- Implemented `pendingBatches` map to coalesce multiple requests targeting the same recipient within the initial delay window, joining texts with `\n\n══════════════════════════════\n\n` and resolving all caller promises upon dispatch.
- Implemented micro-jitter spacing with `lastDispatchTimestamp` and `timeScale` scaling to prevent burst requests hitting port 8080 in the exact same millisecond across different recipients.
- Implemented full presence choreography pipeline (`markMessageAsRead` if reply, `available`, `composing` 4s -> `paused` 2s -> `composing` 3s, 3-tier cascade, `unavailable`) guarded by non-blocking timeouts (2.5s) and `try/catch`.
- Integrated dynamic variation functions (`applyDynamicGreetingAndFooter`, `randomizeMessageUrls`, `injectZeroWidthEntropy`, `pdfVariationEngine`) from `src/lib/whatsappVariationService.ts`.
- Integrated pause dispatch status and queue methods with `whatsappHealthService`.

## Artifact Index
- `src/lib/whatsappNotificationService.ts` — Core notification service with R1, R2, R3, R5 capabilities.
- `src/hooks/useWhatsAppDocument.ts` — React hook for WhatsApp document dispatch with variation support.
- `src/tests/whatsapp-notification-engine.test.ts` — Comprehensive unit and integration test suite covering all requirements.

## Change Tracker
- **Files modified**:
  - `src/lib/whatsappNotificationService.ts`: Added presence choreography, concurrency queue, batching, micro-jitter, variations, and pause dispatch.
  - `src/hooks/useWhatsAppDocument.ts`: Added enableVariation option for document dispatches.
  - `src/tests/whatsapp-notification-engine.test.ts`: Expanded to 24 tests covering presence choreography, micro-jitter, batching, fallback cascade, variations, error handling, and context parsing.
- **Build status**: Pass (`npm run typecheck:strict` and Vitest 238/238 tests passed).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: All 8 WhatsApp test suites passing (238/238 tests).
- **Lint status**: 0 errors.
- **Tests added/modified**: Expanded `whatsapp-notification-engine.test.ts` to 24 comprehensive tests.
