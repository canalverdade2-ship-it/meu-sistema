# BRIEFING — 2026-08-28T14:20:00Z

## Mission
Implement P0 critical remediation for Supabase Realtime base infrastructure in `src/hooks/useRealtime.ts` and `src/hooks/useRealtimeTable.ts`.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r1
- Original parent: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Milestone: M1 (R1: Base Infrastructure & Hook Remediation)

## 🔒 Key Constraints
- Exclusive file ownership: `src/hooks/useRealtime.ts`, `src/hooks/useRealtimeTable.ts`
- No hardcoded test results or mock shortcuts
- Genuine implementation of callback ref synchronization, index preservation, race condition protection, and dependency forwarding
- Fully pass Vitest suite `src/tests/realtime-hook.test.ts` and `npm run test:realtime` + `npx tsc --noEmit`

## Current Parent
- Conversation ID: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Updated: 2026-08-28T14:20:00Z

## Task Summary
- **What to build**: Refactor `src/hooks/useRealtime.ts` to fix stale callback closures, index desync under `enabled: false`, channel status race condition, dependency array forwarding, and channelName memoization. Refactor `src/hooks/useRealtimeTable.ts` to be a backward-compatibility shim around `useRealtimeSubscription`.
- **Success criteria**: 0 stale closure issues, 0 index desync issues, vitest tests and contract checks passing 100%.
- **Interface contracts**: `PROJECT.md` & `ORIGINAL_REQUEST.md`

## Key Decisions Made
- `callbacksRef.current` populated directly from fresh incoming `options` on every render pass to prevent stale closures.
- `enabledConfigsWithIdx` maps `{ config, originalIdx }` to decouple active listeners from raw config array indices, preventing wrong callback/debounce executions when tables are disabled.
- Status subscription callback checks `channelRef.current === channel` to eliminate async race conditions during rapid remounts.
- `useRealtime` overload extracts dependencies from either `onChangeOrDeps` or `optionsOrDeps` and forwards to `useRealtimeSubscription`.
- `useRealtimeTable` delegates directly to `useRealtimeSubscription` with 300ms default debounce and channel name formatting.

## Change Tracker
- **Files modified**:
  - `src/hooks/useRealtime.ts`: Fixed stale closures, index desync, race conditions, dependency forwarding, and channel name memoization.
  - `src/hooks/useRealtimeTable.ts`: Refactored to backward-compatibility shim around `useRealtimeSubscription`.
  - `src/tests/realtime-hook.test.ts`: Expanded unit test coverage for `useRealtimeTable`, index preservation, and hook overloads (15/15 passing).
- **Build status**: PASS (`vitest run src/tests/realtime-hook.test.ts` passed with 15/15 tests, `npm run test:realtime` passed)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (15/15 tests passing in `realtime-hook.test.ts`)
- **Lint status**: Clean for owned files
- **Tests added/modified**: Added tests for `useRealtimeTable` callable interface, `useRealtime` overload handling, and `enabledConfigsWithIdx` index preservation.

## Artifact Index
- `.agents/worker_r1/DISPATCH.md` — Initial assignment log
- `.agents/worker_r1/BRIEFING.md` — Working memory
- `.agents/worker_r1/progress.md` — Progress tracker
- `.agents/worker_r1/handoff.md` — Final handoff report
