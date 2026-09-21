## 2026-08-28T13:43:21Z
You are Worker Tool Developer & Verifier.

Read the authoritative requirements at:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md`

Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_script_verifier`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
1. Develop the programmatic audit verification tool: `scripts/check-realtime-audit.ts`
   The script must programmatically scan `src/` and validate:
   - Legacy hook absence/presence: Scans for any usage of `useRealtimeTable` across all files, flags them, and outputs exact files and line numbers.
   - Canonical hook compliance: Validates that all realtime subscriptions use `useRealtimeSubscription`, `useRealtime`, or `subscribeToTable`.
   - Ad-hoc channel scan: Detects direct `supabase.channel(...)` calls and verifies if they have appropriate cleanup or should be migrated to canonical hooks.
   - Outputs a clear, beautiful colored terminal summary with Pass/Fail metrics, severity counts, and file-by-file detail.
2. Execute the verification script via terminal command:
   `npx ts-node scripts/check-realtime-audit.ts`
   (or `npm run` / node runner compatible with project ts-node configuration).
3. Document the execution command and full terminal output in your `analysis.md` and `handoff.md`.
4. Send a message to parent when complete.
