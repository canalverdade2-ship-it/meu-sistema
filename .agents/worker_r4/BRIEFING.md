# BRIEFING — 2026-08-28T14:22:00Z

## Mission
Implement VPS webhook concurrency control (SessionMutex), SERVICE_ROLE_JWT fallback, and atomic points conversion database migration & webhook handler integration.

## 🔒 My Identity
- Archetype: worker_r4
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r4
- Original parent: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Milestone: Realtime P0 Critical Remediation

## 🔒 Key Constraints
- Exclusive file ownership: `server_webhook_vps_live.cjs`, `server_webhook.cjs`, `supabase/migrations/20260828120000_atomic_points_conversion.sql`
- Minimal change principle
- Genuine implementation with no mock/hardcoded shortcuts
- Validate with `node --check`

## Current Parent
- Conversation ID: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Updated: 2026-08-28T14:22:00Z

## Task Summary
- **What to build**: Atomic points conversion SQL RPC migration (`gsa_converter_pontos_carteira`), fix `SERVICE_ROLE_JWT` fallback, implement per-phone `SessionMutex` in VPS webhook handlers, replace in-memory points conversion RMW with atomic RPC call in `LOYALTY_ACTIONS` state handler.
- **Success criteria**: Migration file exists with correct SQL logic; `server_webhook_vps_live.cjs` & `server_webhook.cjs` have working `SessionMutex`, correct JWT fallback, and call the RPC atomically; `node --check` passes; 9/9 verification tests pass.
- **Interface contracts**: Section 3 of Explorer 3 report
- **Code layout**: Root directory & `supabase/migrations/`

## Key Decisions Made
- Implemented `SessionMutex` as a FIFO async task serializer per phone number that automatically deletes cleaned queue entries to avoid memory leaks.
- Used `FOR UPDATE` row lock in `gsa_converter_pontos_carteira` to guarantee ACID isolation and prevent double-conversion race conditions.
- Updated session in-memory state in bot only from verified return values of `gsa_converter_pontos_carteira`.

## Artifact Index
- `supabase/migrations/20260828120000_atomic_points_conversion.sql` — Atomic points conversion PostgreSQL RPC migration.
- `server_webhook_vps_live.cjs` — Live VPS webhook server with SessionMutex, JWT fallback, atomic points conversion.
- `server_webhook.cjs` — Canonical webhook server matching VPS live implementation.
- `.agents/worker_r4/test_webhook_concurrency.cjs` — Automated 9-point verification test suite.

## Change Tracker
- **Files modified**:
  - `supabase/migrations/20260828120000_atomic_points_conversion.sql`: Created atomic points RPC migration with row locking and ledger entries.
  - `server_webhook_vps_live.cjs`: Added SessionMutex class and instance, fixed SERVICE_ROLE_JWT fallback, converted LOYALTY_ACTIONS to use supabaseRpc, wrapped webhook processMessage with sessionMutex.runExclusive, exported SessionMutex & sessionMutex.
  - `server_webhook.cjs`: Parity update with SessionMutex, JWT fallback, atomic RPC points conversion, exclusive webhook run, and exports.
- **Build status**: `node --check` passed on both files. 9/9 verification tests passed.
- **Pending issues**: None.

## Quality Status
- **Build/test result**: Pass (syntax verified, 9 unit tests passed).
- **Lint status**: Clean.
- **Tests added/modified**: `.agents/worker_r4/test_webhook_concurrency.cjs` covering FIFO serialization, concurrency, error resilience, queue cleanup, JWT fallback, RPC invocation, and migration structure.

## Loaded Skills
- None
