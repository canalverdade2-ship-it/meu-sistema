# BRIEFING — 2026-09-16T11:18:00Z

## Mission
Executar uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_28
- Original parent: parent (sentinel)
- Original parent conversation ID: e8e2a0a9-dc31-4cd6-8bf6-aae5cf2e52e5

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_28\PROJECT.md
1. **Decompose**: Decompose full system technical audit into 4 milestones:
   - M1: Architecture Mapping & Traceability Matrix (Function -> UI -> API -> DB) and dependency graph.
   - M2: Local Test Infrastructure, UI Exhaustive Testing & E2E Validation (Playwright/Vitest, forms, buttons).
   - M3: API, Backend CRUD & Database Schema / Failure Scenarios Audit (HTTP errors, timeouts, race conditions).
   - M4: Root Cause Investigation, Regression Testing, Safe Remediation & Formal Validation Reports.
2. **Dispatch & Execute**:
   - **Survey / Mapping**: Dispatch 3 Explorers (frontend routes/portals, backend APIs/RPCs/DB schema, and integrations/webhooks).
   - **Parallel Tracks**: Test Writers + Workers + Reviewers + Challengers + Forensic Auditor.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent
4. **Succession**: Self-succeed at 16 spawns: write handoff.md, cancel crons, spawn successor.
- **Work items**:
  1. M1: Architecture & Traceability Mapping [in-progress]
  2. M2: Local UI & E2E Test Automation [pending]
  3. M3: API CRUD & DB Fault Injection Testing [pending]
  4. M4: Root Cause Remediation & Final Traceability Gate [pending]
- **Current phase**: 1 - Survey & Architecture Mapping
- **Current focus**: Milestone 1 (Survey & Traceability Matrix)

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- Never run build/test commands yourself — require workers to do so.
- Never investigate code directly — dispatch Explorers for technical exploration.
- Use file-editing tools ONLY for metadata/state files (.md) in .agents/.
- Never reuse a subagent after it has delivered its handoff.
- Binary veto on Forensic Auditor violations.

## Current Parent
- Conversation ID: e8e2a0a9-dc31-4cd6-8bf6-aae5cf2e52e5
- Updated: 2026-09-16T11:07:35Z

## Key Decisions Made
- Selected Project Pattern with 4 milestones aligned with user requirements R1, R2, R3, R4.
- Phase 0 Survey / Milestone 1 dispatch: Spawn 3 Explorers in parallel to inspect:
  1. Frontend applications, routes, components, user portals (Admin, Cliente, Fornecedor, Colaborador, Afiliado, Prestador).
  2. Backend APIs, Supabase Edge Functions, Webhooks, and DB Schema / RPCs.
  3. Integration points, external services (Evolution API, n8n), and dependency graphs.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_frontend_1 | teamwork_preview_explorer | Survey Frontend routes, pages, UI elements | pending | [TBD] |
| explorer_backend_1 | teamwork_preview_explorer | Survey Backend APIs, DB schema, RPCs | pending | [TBD] |
| explorer_integrations_1 | teamwork_preview_explorer | Survey Integrations, Deps & Test infra | pending | [TBD] |

## Succession Status
- Succession required: no
- Spawn count: 0 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-11 (*/10 * * * *)
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- .agents/teamwork_preview_orchestrator_28/PROJECT.md — Global architecture, milestones, traceability schema
- .agents/teamwork_preview_orchestrator_28/progress.md — Liveness heartbeat and milestone checklist
- .agents/teamwork_preview_orchestrator_28/GATE_STATUS.md — Milestone gate evaluation records
- .agents/teamwork_preview_orchestrator_28/DEAD_ENDS.md — Append-only record of failed approaches
