## 2026-08-28T14:17:04Z
You are Worker R1 (Infrastructure & Base Hook Remediation) for Realtime P0 Critical Remediation.
Your working directory is: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r1`
Original request: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`
Project master: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md`
Explorer Handoff: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_survey_1\handoff.md`

Your Exclusive File Ownership:
- `src/hooks/useRealtime.ts`
- `src/hooks/useRealtimeTable.ts`

Your Tasks:
1. Implement the complete refactoring of `src/hooks/useRealtime.ts` based on Section 4.1 of the Explorer 1 handoff report:
   - Fix stale closures in `callbacksRef.current` by populating from fresh incoming configs on every render pass.
   - Fix index desynchronization when `enabled: false` by tracking original indices `{ config, originalIdx }` for callbacks and debounce timers.
   - Fix status race condition by checking `channelRef.current === channel` on subscribe callback.
   - Fix dependency array forwarding in `useRealtime` single-table overload.
   - Include `channelName` in memoization serialization.
2. Update `src/hooks/useRealtimeTable.ts` with the backward-compatibility shim wrapping `useRealtimeSubscription` as specified in Section 4.3 of Explorer 2 report.
3. Verify changes by running vitest suite `npx vitest run src/tests/realtime-hook.test.ts` and `npm run test:realtime` (or `npx tsc --noEmit`).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your report to `.agents/worker_r1/handoff.md` and send a summary message when done.
