# Handoff Report: Base Realtime Infrastructure Audit (R1)

**Agent**: Explorer R1  
**Target Path**: `.agents/explorer_r1_infra/`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

### Audited Core Files:
1. `src/hooks/useRealtime.ts` (272 lines)
   - Lines 59–61: `rawConfigs` is memoized with a serialized dependency key.
   - Lines 69–72: `callbacksRef.current = rawConfigs.map(c => ({ onPayload: c.onPayload, onChange: c.onChange }))` reads callbacks from memoized `rawConfigs` instead of the fresh incoming `options` argument.
   - Line 104: `enabledConfigs = rawConfigs.filter(c => c.enabled !== false)`.
   - Lines 120–184: `enabledConfigs.forEach((config, idx) => ...)` indexes `callbacksRef.current[idx]` and `debounceTimersRef.current[idx]` using the filtered index `idx` (0..N-1), which desynchronizes from `rawConfigs` whenever any prior config has `enabled: false`.
   - Lines 188–202: `channel.subscribe((subStatus, err) => { if (!isMountedRef.current) return; ... })` does not verify `channelRef.current === channel`, risking race conditions on fast remounts.
   - Lines 246–271: Overload function `useRealtime` drops the `deps` argument when the first argument is a `string` and `deps` is passed as the 3rd argument.
   - Lines 204–220 & 77–92: Teardown uses `supabase.removeChannel(chan)` correctly with `.catch(...)`.

2. `src/hooks/useRealtimeTable.ts` (21 lines)
   - Lines 13–15: Subscribes to `event: '*', schema: 'public', table` with no filter support and no debounce.
   - Lines 4 & 16: Returns `void` without status tracking or manual unsubscribe.
   - Found 2 remaining consumers in the active codebase:
     - `src/components/admin/ConfiguracoesModule.tsx` (Line 27)
     - `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx` (Line 48)

3. `src/lib/supabaseRealtime.ts` (69 lines)
   - Lines 52–61: `subscribeToTable` calls `.subscribe()` without an error or status callback.
   - Lines 63–67: Teardown correctly invokes `supabase.removeChannel(channel)`.

4. Supabase Client Configuration & Tests:
   - `src/lib/supabase.ts` (Lines 333–343): Realtime exponential backoff is configured (`eventsPerSecond: 5`, `timeout: 30000`, `reconnectAfterMs: Math.min(1000 * Math.pow(2, tries), 30000)`).
   - `src/tests/realtime-hook.test.ts` (516 lines): 13 tests verify canonical hooks, 105-table migration assertions, and client portal subscriptions. Test run passed with 13/13 passing.

---

## 2. Logic Chain

1. **Stale Callback Closure Chain**:
   - `rawConfigs` is memoized by `useMemo` on static properties (`table`, `filter`, etc.).
   - When a parent component re-renders with a new `onChange` function closing over updated state, `useMemo` does not recompute `rawConfigs`.
   - `callbacksRef.current` iterates over `rawConfigs` (the stale object reference from mount).
   - Therefore, `callbacksRef.current` stores the initial render's callback and never receives the updated callback, leading to silent stale closures.
   - **Fix**: Update `callbacksRef.current` by mapping over the raw incoming `options` directly on every render.

2. **Multi-Table Index Desynchronization Chain**:
   - `rawConfigs` and `callbacksRef.current` have length $N$ (indices $0 \dots N-1$).
   - `enabledConfigs` filters out configs where `enabled === false`, producing length $M \le N$.
   - Inside `enabledConfigs.forEach((config, idx) => ...)`, `idx` spans $0 \dots M-1$.
   - If config 0 is disabled, config 1 receives `idx = 0` in `enabledConfigs`.
   - Event handlers accessing `callbacksRef.current[idx]` will execute config 0's callback when an event arrives for config 1!
   - **Fix**: Map `rawConfigs` with original indices (`{ config, originalIdx }`) before filtering, and use `originalIdx` in callbacks and debounce timers.

3. **Legacy Hook Deprecation Chain**:
   - `useRealtimeTable` lacks filtering and debouncing.
   - Only 2 active files use `useRealtimeTable` in the entire codebase (`ConfiguracoesModule.tsx` and `OrcamentosWorkstation.tsx`).
   - Migrating these 2 components to `useRealtimeSubscription` eliminates legacy debt and allows deprecating or stubbing `useRealtimeTable`.

---

## 3. Caveats

- **External WebSocket Latency**: Server-side CDC message timing depends on PostgreSQL WAL replication lag and Supabase Realtime cluster load.
- **RLS Restrictions**: Supabase Realtime v2 requires `supabase_realtime` publication inclusion (verified in migration `20260826140000_enable_realtime_full_replica_identity_105_tables.sql`) and appropriate PostgreSQL Row-Level Security policies.
- **Scope Boundary**: This audit focused strictly on the core base infrastructure (`src/hooks/useRealtime.ts`, `src/hooks/useRealtimeTable.ts`, `src/lib/supabaseRealtime.ts`, `src/lib/supabase.ts`). Individual audit of the 94 application components is performed by peer domain explorers.

---

## 4. Conclusion

- The core architecture is fundamentally solid: channels are uniquely named, debounce timers are cleared, and channels are properly unregistered from the Supabase client registry via `supabase.removeChannel` to avoid memory leaks.
- However, 2 critical bugs in `src/hooks/useRealtime.ts` (Stale Callback Closures and Index Desynchronization under `enabled: false`) must be patched to ensure reliable data flow and prevent cross-table callback misrouting.
- Full drop-in replacement implementations for all 3 files have been produced and documented in `analysis.md`.

---

## 5. Verification Method

To verify these findings independently:
1. **Inspect Audit Analysis**:
   - Review `.agents/explorer_r1_infra/analysis.md` for full code diffs and line-by-line analyses.
2. **Execute Unit & Contract Tests**:
   - `npx vitest run src/tests/realtime-hook.test.ts`
   - `npx ts-node scripts/check-realtime-contracts.ts`
3. **Verify Legacy References**:
   - Search for `useRealtimeTable` usages across `src/` to confirm only `ConfiguracoesModule.tsx` and `OrcamentosWorkstation.tsx` remain.
