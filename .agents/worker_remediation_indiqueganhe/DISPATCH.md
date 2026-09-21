## 2026-08-26T16:03:56Z
Remediation Task:
1. Inspect `src/components/client/ClientIndiqueGanhe.tsx` (specifically around lines 100–117 where raw `supabase.channel('indicacoes-updates')` is used).
2. Refactor `src/components/client/ClientIndiqueGanhe.tsx` to import and use the canonical `useRealtimeSubscription` from `../../hooks/useRealtime`:
   ```tsx
   import { useRealtimeSubscription } from '../../hooks/useRealtime';
   ```
   Subscribe to table `'indicacoes'` (with row-level filter `indicador_id=eq.${clientId}` or general table changes matching client state), calling `loadData()` / `fetchReferrals()` with proper debounce, completely replacing the raw channel.
3. Run `npx vitest run src/tests` and verify that ALL test suites and assertions (specifically `src/tests/realtime-hook.test.ts:358`) pass with 0 failures.
4. Run `npm run build` and verify that the build passes with exit code 0 and 0 errors.
5. Write `handoff.md` and send completion message to parent.
