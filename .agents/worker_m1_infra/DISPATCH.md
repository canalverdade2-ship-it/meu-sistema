## 2026-08-26T14:11:35Z
You are worker_m1_infra.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m1_infra
Workspace root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP: Read the user request verbatim in:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (specifically timestamp 2026-08-26T13:52:52Z) and `PROJECT.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Scope: Milestone 1 — Shared Realtime Infrastructure (R1) & 105-Table Database Migration (R13).

Tasks to Implement:
1. Create `src/hooks/useRealtime.ts` (and re-export from `src/lib/supabaseRealtime.ts` if appropriate) with canonical hooks:
   - `useRealtimeSubscription` and `useRealtime`
   - Accepts single subscription config or array of configs
   - Config options: `table: string`, `schema?: string`, `filter?: string`, `event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'`, `debounceMs?: number`, `channelName?: string`, `onPayload?: (payload: any) => void`, `onChange?: () => void | Promise<void>`, `enabled?: boolean`
   - Manages channel creation, subscription, deduplication, error logging, and STRICT unmount cleanup calling `supabase.removeChannel(channel)`
   - Robust TypeScript typings
2. Create idempotent SQL migration file: `supabase/migrations/20260826140000_enable_realtime_full_replica_identity_105_tables.sql`:
   - Covers all 105 tables listed in ORIGINAL_REQUEST.md R13
   - Uses idempotent PL/pgSQL block checking `information_schema.tables` and `pg_publication_tables`
   - Sets `REPLICA IDENTITY FULL` on each table and adds it to `supabase_realtime` publication without duplicate errors
3. Create unit test suite `src/tests/realtime-hook.test.ts` testing the hook functionality (subscribe, callback, debounce, unmount cleanup).
4. Run verification commands:
   - `npx vitest run src/tests` (verify all existing 103 tests + new tests pass)
   - `npm run typecheck:strict` (verify exit code 0)
   - `npm run build` (verify exit code 0)
5. Write detailed `handoff.md` and `progress.md` in `.agents/worker_m1_infra/` and send a message to parent when done.
