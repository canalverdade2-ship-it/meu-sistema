# BRIEFING — 2026-08-26T14:19:15Z

## Mission
Implement canonical Realtime subscriptions across Admin Demandas (R9) and Operational Modules (R10) with proper cleanup and verify zero regressions.

## 🔒 My Identity
- Archetype: worker_m4_demandas_ops
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m4_demandas_ops
- Original parent: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Milestone: Milestone 4 — Admin Demandas Module (R9) & Regular Admin Operational Modules (R10)

## 🔒 Key Constraints
- Use canonical useRealtimeSubscription / useRealtime from src/hooks/useRealtime.ts.
- In Demandas: Subscribe to prestador_demandas, prestador_demandas_historico, demanda_comentarios, os_notas, os_suporte_mensagens.
- In Operational Modules: Subscribe to corresponding tables (ornecedores, catalog_packages, ordens_compra, ordens_assinatura, produtos, servicos, iagens_pacotes, iagens_categorias, prestador_documentos, classificados_anuncios, etc.) with proper channel unmount cleanup.
- Run 
px vitest run src/tests and 
pm run build to verify exit code 0 and zero regressions.
- No shortcuts or fake mocks in source code. Genuine subscriptions and state management.

## Current Parent
- Conversation ID: ff3b7a73-adea-4d23-b7cf-9167deb8404d
- Updated: not yet

## Task Summary
- **What to build**: Add Realtime subscriptions across 22 admin components (Demandas + Operational Modules) using canonical hooks.
- **Success criteria**: All 22 files properly subscribe to their respective tables, tests pass (
px vitest run src/tests), build succeeds (
pm run build).
- **Interface contracts**: PROJECT.md, src/hooks/useRealtime.ts
- **Code layout**: src/components/admin/

## Key Decisions Made
- [TBD]

## Artifact Index
- .agents/worker_m4_demandas_ops/DISPATCH.md — Dispatch assignment
- .agents/worker_m4_demandas_ops/BRIEFING.md — Persistent situational memory
- .agents/worker_m4_demandas_ops/progress.md — Progress tracker

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Pending
- **Tests added/modified**: Pending

## Loaded Skills
- None
