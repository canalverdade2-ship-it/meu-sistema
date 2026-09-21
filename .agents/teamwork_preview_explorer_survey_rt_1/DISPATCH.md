## 2026-08-26T14:01:30Z
You are teamwork_preview_explorer_survey_rt_1.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_rt_1
Workspace root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP: Read the user request verbatim in:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (specifically timestamp 2026-08-26T13:52:52Z).

Your Focus: Survey Requirement R1 (Shared Realtime Infrastructure), Requirement R13 (Database Migration for 105 tables), and Baseline Tests/Build.

Tasks:
1. Examine existing Supabase client setup in `src/lib/supabase.ts`, `src/lib/supabaseWrapper.ts`, etc.
2. Examine existing realtime usages across the 17 files listed in ORIGINAL_REQUEST.md that already use `supabase.channel()` to understand established patterns, channel names, and cleanup.
3. Design the canonical shared realtime utility/hook (e.g., `useRealtimeSubscription` / `src/lib/supabaseRealtime.ts` or `src/hooks/useRealtime.ts`):
   - Wrapping `supabase.channel()`
   - Event handling for INSERT, UPDATE, DELETE on postgres_changes with optional table and filter
   - Clean unmount cleanup via `supabase.removeChannel()` (ensuring 0 memory leaks)
   - Connection/error handling
   - Ability to handle multi-table subscriptions or simple single-table callbacks
4. Audit the 105 tables listed in R13 against the database migrations in `supabase/migrations/`:
   - Enumerate all 105 tables
   - Structure an idempotent SQL migration script that runs `ALTER TABLE <tbl> REPLICA IDENTITY FULL;` and adds each table to `supabase_realtime` publication if not already present.
5. Check current baseline test suite and build:
   - Identify existing test setup in `src/tests` (vitest) and verify test files and configuration.
6. Write a comprehensive `analysis.md` and `handoff.md` in your working directory (`.agents/teamwork_preview_explorer_survey_rt_1/`).
7. Send a message to parent when done.
