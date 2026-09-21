# BRIEFING — 2026-08-26T14:20:00Z

## Mission
Implement Supabase Realtime subscriptions across all Admin Super-Domain views in Milestone 3 (Financeiro R4, Contratos R5, Governança R6, Pessoas R8), eliminate all setInterval polling, and verify 0 errors / 0 regressions.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m3_superdomains
- Original parent: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Milestone: Milestone 3 — Admin Super-Domains (Financeiro, Contratos, Governança, Pessoas)

## 🔒 Key Constraints
- Use canonical `useRealtimeSubscription` / `useRealtime` from `src/hooks/useRealtime.ts` across all 28 views/components in scope.
- Remove any remaining `setInterval` in `GovernancaAcessosView.tsx`, `GovernancaExecutiveDashboard.tsx`, `GovernancaInfraView.tsx`, and `TrabalheConoscoSection.tsx`.
- Guaranteed unmount cleanup via hook.
- Run `npx vitest run src/tests` and `npm run build` to verify exit code 0 and zero regressions.
- No hardcoded fake data or facade implementations.
- Write handoff.md following 5-component handoff report.

## Current Parent
- Conversation ID: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Updated: not yet

## Task Summary
- **What to build**: Realtime subscriptions across 28 files in Financeiro, Contratos, Governança, Pessoas super-domains + setInterval elimination.
- **Success criteria**: 0 setInterval in target files, all target views subscribe to relevant DB tables via `useRealtime`/`useRealtimeSubscription`, `npm run build` exits 0, `npx vitest run src/tests` passes (all tests).
- **Interface contracts**: `src/hooks/useRealtime.ts`
- **Code layout**: `src/components/admin/super-domains/`

## Key Decisions Made
- Inspect all 28 files individually to identify their data-fetching functions, state, and queried tables.
- Wire `useRealtimeSubscription` to refresh data on table mutations (`faturas`, `cobrancas`, `transferencias`, `saques`, `emprestimos`, `clientes`, `tickets`, `contratos`, `colaboradores`, `sistema_logs`, `system_settings`, `prestadores`, `indicacoes`, `vouchers`, `gsa_afiliados`, `career_applications`, etc.).

## Change Tracker
- **Files modified**: [TBD]
- **Build status**: [TBD]
- **Pending issues**: [TBD]

## Quality Status
- **Build/test result**: [TBD]
- **Lint status**: [TBD]
- **Tests added/modified**: [TBD]

## Loaded Skills
- None loaded.

## Artifact Index
- `.agents/worker_m3_superdomains/DISPATCH.md` — Assignment dispatch
- `.agents/worker_m3_superdomains/progress.md` — Progress tracker
- `.agents/worker_m3_superdomains/handoff.md` — Final handoff report
