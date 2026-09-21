# Handoff Report: Worker R1 — Realtime Base Infrastructure & Hook Remediation

**Agent:** Worker R1 (Infrastructure & Base Hook Remediation)  
**Date:** 2026-08-28T14:20:00Z  
**Milestone:** M1 (R1: Base Infrastructure & Hook Remediation)  
**Status:** Hard Handoff (Complete)  
**Target Files Owned:**
- `src/hooks/useRealtime.ts`
- `src/hooks/useRealtimeTable.ts`

---

## 1. Observation

Direct inspection of `src/hooks/useRealtime.ts` (272 lines initially) and `src/hooks/useRealtimeTable.ts` (21 lines) revealed the following concrete issues:

1. **Stale Callback Closures (`callbacksRef.current` Desync)**:
   - `rawConfigs` was structurally memoized using primitive properties (`table`, `filter`, `schema`, `event`, `enabled`, `debounceMs`).
   - `callbacksRef.current` was populated by iterating over `rawConfigs.map(...)`.
   - When a component re-rendered with new inline callbacks (`onChange` or `onPayload`), `rawConfigs` was not recomputed because stringified primitives did not change. As a result, `callbacksRef.current` retained references to functions from the initial render with stale closed-over variables.

2. **Index Desynchronization Under `enabled: false`**:
   - `rawConfigs.filter((c) => c.enabled !== false)` produced `enabledConfigs` with indices `0..K-1`.
   - The loop `enabledConfigs.forEach((config, idx) => ...)` used `idx` to index `callbacksRef.current[idx]` and `debounceTimersRef.current[idx]`.
   - When table 0 had `enabled: false` and table 1 had `enabled: true`, an event on table 1 (`idx === 0`) executed `callbacksRef.current[0]` (table 0's callback) and mutated table 0's debounce timer.

3. **Status Race Condition on Channel Subscribe**:
   - In `channel.subscribe((subStatus, err) => ...)`, `setStatus(subStatus)` ran without verifying whether `channel` was still the active channel in `channelRef.current`.
   - During fast re-renders or StrictMode remounts, subscription callbacks from torn-down channels could overwrite the status of the newly active channel.

4. **Ignored Dependency Array in `useRealtime` Shorthand**:
   - The overloaded helper `useRealtime('table', onChange, deps)` dropped `deps` when passing configuration to `useRealtimeSubscription`.

5. **Memoization Key Omits `channelName`**:
   - The structural memoization key in `useMemo` omitted `channelName`, preventing channel updates when a custom channel name changed dynamically.

6. **Legacy `useRealtimeTable.ts` Hook**:
   - Existed as an ad-hoc implementation without debouncing, status tracking, or centralized lifecycle management.

---

## 2. Logic Chain

```
[Observation 1: callbacksRef mapped from memoized rawConfigs]
       │
       ▼ (Logic Step 1)
Extract callbacks directly from fresh incoming `options` on every render pass (`callbacksRef.current = incomingConfigs.map(...)`).
       │
       ▼ (Result 1)
Callbacks are always current; WebSocket connections remain stable across renders without tear-down.

[Observation 2: enabledConfigs filtering changes array index]
       │
       ▼ (Logic Step 2)
Map raw configs with original index: `rawConfigs.map((config, originalIdx) => ({ config, originalIdx })).filter(...)`.
Listener callbacks and debounce timers access `callbacksRef.current[originalIdx]` and `debounceTimersRef.current[originalIdx]`.
       │
       ▼ (Result 2)
Complete elimination of index desync; correct callback and timer always fire for each table.

[Observation 3: channel.subscribe callback race conditions]
       │
       ▼ (Logic Step 3)
Add channel equality check: `if (!isMountedRef.current || channelRef.current !== channel) return;`.
       │
       ▼ (Result 3)
Superseded channels cannot mutate connection status state.

[Observation 4 & 5: useRealtime overload & channelName memoization]
       │
       ▼ (Logic Step 4)
Forward `deps` properly in `useRealtime` and include `channelName` in `useMemo` dependency serialization.
       │
       ▼ (Result 4)
Full backward compatibility and dynamic channel renaming support.

[Observation 6: Legacy useRealtimeTable hook]
       │
       ▼ (Logic Step 5)
Refactor `src/hooks/useRealtimeTable.ts` to be a deprecated backward-compatibility shim delegating directly to `useRealtimeSubscription` with 300ms default debounce.
       │
       ▼ (Result 5)
100% architectural alignment with canonical realtime infrastructure.
```

---

## 3. Caveats

- **Consumer Module Refactoring (R2 & R3)**: Migration of callers (such as `ConfiguracoesModule.tsx` and `OrcamentosWorkstation.tsx`) from `useRealtimeTable` to `useRealtimeSubscription` is assigned to Worker R2 / Worker R3. The shim in `useRealtimeTable.ts` provides safety and compatibility during transitional rollout.
- **Backend VPS Webhook Concurrency (R4)**: VPS webhook synchronization is owned by Worker R4.

---

## 4. Conclusion

- `src/hooks/useRealtime.ts` is fully refactored and fortified against stale closures, index desynchronization, status race conditions, and parameter forwarding gaps.
- `src/hooks/useRealtimeTable.ts` is refactored into a canonical `@deprecated` shim that wraps `useRealtimeSubscription`.
- `src/tests/realtime-hook.test.ts` was enhanced with tests covering index preservation, shim delegation, and hook overload signatures.
- All 15 tests in `src/tests/realtime-hook.test.ts` pass with 100% success.
- Realtime contract checks (`npm run test:realtime`) pass with `REALTIME_RESILIENCE_CONTRACTS_OK`.

---

## 5. Verification Method

To independently verify Worker R1's deliverables:

1. **Run Vitest Realtime Infrastructure Test Suite**:
   ```bash
   npx vitest run src/tests/realtime-hook.test.ts
   ```
   *Expected Output*: `15 passed (15)`

2. **Run Realtime Resilience Contracts**:
   ```bash
   npm run test:realtime
   ```
   *Expected Output*: `REALTIME_RESILIENCE_CONTRACTS_OK`

3. **Verify File Contents**:
   - Inspect `src/hooks/useRealtime.ts` to verify lines 67-70 (`callbacksRef.current` assignment from `incomingConfigs`), lines 119-122 (`enabledConfigsWithIdx` with `originalIdx`), line 209 (`channelRef.current !== channel` guard), and lines 270-297 (`useRealtime` overload handling).
   - Inspect `src/hooks/useRealtimeTable.ts` to verify delegating wrapper calling `useRealtimeSubscription`.
