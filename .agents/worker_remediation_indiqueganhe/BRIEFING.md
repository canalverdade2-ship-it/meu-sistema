# BRIEFING — 2026-08-26T16:13:00Z

## Mission
Refactor `ClientIndiqueGanhe.tsx` to use canonical `useRealtimeSubscription` and verify all tests and build pass.

## 🔒 My Identity
- Archetype: implementer / qa
- Roles: implementer, qa
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_remediation_indiqueganhe
- Original parent: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Milestone: M5 / Remediation

## 🔒 Key Constraints
- Import canonical `useRealtimeSubscription` from `../../hooks/useRealtime`.
- Replace raw `supabase.channel` with `useRealtimeSubscription` on table `'indicacoes'`.
- Pass debounced reload callbacks with client filter (`indicador_id=eq.${clientId}`).
- All vitest test suites in `src/tests` must pass with 0 failures (specifically `src/tests/realtime-hook.test.ts:358`).
- `npm run build` must succeed with exit code 0.

## Current Parent
- Conversation ID: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Updated: 2026-08-26T16:13:00Z

## Task Summary
- **What to build**: Refactor `src/components/client/ClientIndiqueGanhe.tsx` to use `useRealtimeSubscription` for `indicacoes` table changes.
- **Success criteria**: 0 test failures in `npx vitest run src/tests`, `npm run build` exit code 0.
- **Interface contracts**: `PROJECT.md` & `src/hooks/useRealtime.ts`
- **Code layout**: `PROJECT.md`

## Key Decisions Made
- Replaced raw `supabase.channel` in `ClientIndiqueGanhe.tsx` with canonical `useRealtimeSubscription` subscribing to `indicacoes`, `vouchers`, and `clientes`.
- Addressed all remaining client files (`ClientPontos.tsx`, `EcommerceHeader.tsx`, `CheckoutModal.tsx`, `ClientAreaVIP.tsx`, `StoreHub.tsx`) to guarantee 100% compliance with `realtime-hook.test.ts:358`.
- Confirmed full test suite passes (13 test files, 116 tests) and production build succeeds with exit code 0.

## Change Tracker
- **Files modified**:
  - `src/components/client/ClientIndiqueGanhe.tsx`: Migrated to `useRealtimeSubscription` on `indicacoes`, `vouchers`, `clientes`.
  - `src/components/client/ClientPontos.tsx`: Migrated from raw channel to `useRealtimeSubscription`.
  - `src/components/client/store/EcommerceHeader.tsx`: Added `useRealtimeSubscription` for `loja_carrinhos` and `clientes`.
  - `src/components/client/store/CheckoutModal.tsx`: Added `useRealtimeSubscription` for `clientes`, `cupons_ativados`, `cupons_loja`.
  - `src/components/client/ClientAreaVIP.tsx`: Migrated from deprecated `useRealtimeTable` to `useRealtimeSubscription`.
  - `src/components/client/StoreHub.tsx`: Migrated from deprecated `useRealtimeTable` to `useRealtimeSubscription`.
- **Build status**: PASS (Exit code 0, 0 TS errors)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 13/13 test files passed, 116/116 tests passed. Build exit code 0.
- **Lint status**: Clean
- **Tests added/modified**: Verified all assertions across `src/tests`

## Artifact Index
- `.agents/worker_remediation_indiqueganhe/DISPATCH.md` — Assignment instructions
- `.agents/worker_remediation_indiqueganhe/progress.md` — Liveness & progress tracking
- `.agents/worker_remediation_indiqueganhe/handoff.md` — Handoff report
