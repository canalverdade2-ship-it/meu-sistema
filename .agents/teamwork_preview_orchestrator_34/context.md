# Context: Remediação de Cobertura da Auditoria

## Workspace Root
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`

## Objectives & Baseline
1. Read `ORIGINAL_REQUEST.md` (section `## 2026-09-16T16:21:01Z`).
2. Current State:
   - Root documentation & inventory: `INVENTARIO_COMPLETO.md` (1,377 items), `GRAFO_CONEXOES.md` (80 edges), `MATRIZ_RASTREABILIDADE.md`.
   - The system needs local isolated infrastructure (Supabase local, deterministic seed SQL with all personas, local Edge Functions and webhook).
   - Dynamic execution of all 6 E2E journeys (E2E-01 to E2E-06) and all 80 connection edges without touching production DB.
   - Strict unified taxonomy and proper classification of bugs (`BUG DA SUÍTE DE TESTE` vs `BUG DO SISTEMA`).
   - Generation / update of the 9 required artifacts with perfect mathematical reconciliation.

## Operational Protocol
- You are a pure orchestrator. Formulate a clear plan in your directory (`plan.md`).
- Dispatch specialists (e.g. `teamwork_preview_worker` or `worker`, `teamwork_preview_explorer` or `explorer`, `teamwork_preview_reviewer` or `reviewer`, `teamwork_preview_challenger` or `challenger`) into dedicated `.agents/` subdirectories.
- Track progress in `progress.md` and `BRIEFING.md`.
- Communicate back to Sentinel upon completion for independent Victory Audit.
