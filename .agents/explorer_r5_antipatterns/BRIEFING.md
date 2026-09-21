# BRIEFING — 2026-08-28T13:43:00Z

## Mission
Conduct an exhaustive audit for 7 key Supabase Realtime anti-patterns across GSA HUB Realtime codebase, analyzing performance bottlenecks, memory leaks, and subscription lifecycle issues.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_r5_antipatterns
- Original parent: 91d031e2-3f08-418b-be50-7447fa705bdf
- Milestone: Realtime Anti-Pattern & Performance Audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Analyze all 7 key anti-patterns in detail:
  1. Broadcast without filter on large tables
  2. Unstable channel names
  3. Missing cleanup
  4. Double subscription
  5. Unstable onChange callbacks
  6. Masked polling
  7. Realtime in inactive components
- Output structured analysis.md and handoff.md in working directory
- Communicate via send_message to parent (91d031e2-3f08-418b-be50-7447fa705bdf)

## Current Parent
- Conversation ID: 91d031e2-3f08-418b-be50-7447fa705bdf
- Updated: 2026-08-28T13:43:00Z

## Investigation State
- **Explored paths**:
  - `src/hooks/useRealtime.ts`, `src/hooks/useRealtimeTable.ts`, `src/lib/supabaseRealtime.ts`
  - `src/hooks/useClientNotifications.tsx`, `src/hooks/useAdminNotifications.tsx`, `src/hooks/useProviderNotifications.tsx`, `src/hooks/useVipLevels.ts`, `src/hooks/useAutoLogout.ts`
  - All 98 UI target components across Admin Modules, SuperDomains, Client Portal, Provider components, and Store pages
- **Key findings**:
  - 9 Critical (🔴 Crítico) anti-patterns detected (unfiltered broadcasts on `notificacoes`, `saques`, `loja_pedido_itens`; unstable channel names with `Date.now()` in `OrcamentosWorkstation` and `OrdensServicoWorkstation`; deprecated `useRealtimeTable` hook usage).
  - 21 Alert (🟡 Alerta) anti-patterns detected (masked polling, double subscriptions, unstable callbacks in `deps`, missing `enabled: isOpen` in modals).
- **Unexplored areas**: None. 100% of the 481 frontend files and 98 target components audited.

## Key Decisions Made
- Fully documented all 7 anti-pattern categories with verbatim code excerpts and concrete remediation snippets in `analysis.md`.
- Structured complete 5-component handoff report in `handoff.md`.

## Artifact Index
- `DISPATCH.md` — User dispatch logging
- `BRIEFING.md` — Persistent working memory
- `analysis.md` — Exhaustive audit report covering all 7 anti-patterns and 98 components
- `handoff.md` — 5-component handoff report
- `audit_scan.cjs`, `audit_direct_channels.cjs`, `audit_table_filters.cjs`, `audit_deps.cjs`, `audit_intervals.cjs`, `audit_modals.cjs`, `audit_full_98.cjs` — Audit scripts
