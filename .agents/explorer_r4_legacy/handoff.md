# Handoff Report — Explorer R4: Legacy Hook `useRealtimeTable` Audit & Migration Plans

**Agent**: Explorer R4  
**Working Directory**: `.agents/explorer_r4_legacy`  
**Timestamp**: 2026-08-28T13:40:00Z  
**Type**: Hard Handoff (Task Complete)

---

## 1. Observation

### 1.1 Complete Codebase Inventory
A total search across 844 TypeScript/React files in the GSA HUB repository was executed.

- **Direct consumers of `useRealtimeTable`**:
  1. `src/components/admin/ConfiguracoesModule.tsx`:
     - Line 4: `import { useRealtimeTable } from '../../hooks/useRealtimeTable';`
     - Line 26: `const [, setRtRefreshKey] = useState(0);`
     - Line 27: `useRealtimeTable('system_settings', () => setRtRefreshKey(k => k + 1));`
  2. `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx`:
     - Line 8: `import { useRealtimeTable } from '../../../../hooks/useRealtimeTable';`
     - Line 47: `const [, setRtRefreshKey] = useState(0);`
     - Line 48: `useRealtimeTable(['orcamentos', 'ordens_servico'], () => setRtRefreshKey(k => k + 1));`
     - Lines 152–172: Concurrent ad-hoc `useEffect` manual `supabase.channel` subscribing to `orcamentos`.

- **Legacy Hook Definition**:
  - `src/hooks/useRealtimeTable.ts` (21 lines)

- **Test References**:
  - `src/tests/realtime-hook.test.ts`:
    - Lines 351–364: Assertion `should confirm all target client portal files exist and use canonical realtime hooks without deprecated useRealtimeTable`.

### 1.2 Verification Command Run
- Command: `npx vitest run src/tests/realtime-hook.test.ts`
- Result: 13 passed (13 total), 0 failures.

---

## 2. Logic Chain

1. **Deficiency Analysis of `useRealtimeTable.ts`**:
   - `useRealtimeTable` lacks row-level filtering (`filter`), causing unconstrained broadcasts on entire database tables across all tenants.
   - Lacks event debouncing (`debounceMs`), creating request storm vulnerabilities on rapid mutations.
   - Returns `void`, completely hiding channel connection status (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`) and omitting manual `unsubscribe()`.
   - Exposes no payload (`onPayload`), preventing optimistic UI state updates.
   - Uses unstable `Date.now()` naming inside `useEffect`.

2. **Analysis of `ConfiguracoesModule.tsx`**:
   - `useRealtimeTable` updates state `setRtRefreshKey(k => k + 1)`.
   - `load` function is inside `useEffect(() => { void load(); }, [load])`.
   - Because `rtRefreshKey` is NOT in the dependency array of `load` or `useEffect`, the database change triggers a component re-render without executing `load()`.
   - **Deduction**: Migrating to `useRealtimeSubscription({ table: 'system_settings', debounceMs: 300, onChange: () => { void load(); } })` fixes the latent data-refresh bug while adhering to canonical standards.

3. **Analysis of `OrcamentosWorkstation.tsx`**:
   - Contains two conflicting realtime mechanisms: an unused `useRealtimeTable` (which increments unused `rtRefreshKey`) and an ad-hoc `useEffect` with `supabase.channel(`admin-orcamentos-sd1-${Date.now()}`)` on `[statusFilter]`.
   - **Deduction**: Migrating both to a single `useRealtimeSubscription` on `['orcamentos', 'ordens_servico']` with 400ms debounce eliminates double subscriptions, fixes channel churn on filter change, and provides full multi-table coverage.

4. **Deprecation Path**:
   - Since only 2 files consume `useRealtimeTable`, migrating these 2 files allows `src/hooks/useRealtimeTable.ts` to be safely deprecated or removed without breaking any other module in GSA HUB.

---

## 3. Caveats

- **No caveats**. All 844 files were verified. No dynamic imports or hidden string evaluations of `useRealtimeTable` exist.

---

## 4. Conclusion

- The migration of the 2 lingering legacy consumers (`ConfiguracoesModule.tsx` and `OrcamentosWorkstation.tsx`) to `useRealtimeSubscription` will achieve **100.0% canonical realtime adoption** across GSA HUB.
- Full blueprints with before/after diffs are documented in `.agents/explorer_r4_legacy/analysis.md`.
- `src/hooks/useRealtimeTable.ts` can be safely deleted or replaced by a deprecation shim upon migration of these 2 files.

---

## 5. Verification Method

1. **Grep verification across the codebase**:
   ```powershell
   git grep -n "useRealtimeTable"
   ```
   Or via `grep_search` on `src/`.
2. **Run Realtime Test Suite**:
   ```powershell
   npx vitest run src/tests/realtime-hook.test.ts
   ```
3. **Inspect Analysis Report**:
   - View `.agents/explorer_r4_legacy/analysis.md`
