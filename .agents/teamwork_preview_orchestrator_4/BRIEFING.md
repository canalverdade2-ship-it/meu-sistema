# BRIEFING — 2026-08-26T13:55:00Z

## Mission
Implement Supabase Realtime across 100% of GSA HUB (React 18 + Vite + TypeScript + Supabase), replacing all setInterval polling with realtime subscriptions, creating idempotent SQL migration for REPLICA IDENTITY FULL and publication on 105 tables, ensuring 103 tests pass and npm run build succeeds.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_4
- Original parent: e267e5b0-3321-4d0e-9672-86fbca1461a8
- Original parent conversation ID: e267e5b0-3321-4d0e-9672-86fbca1461a8

## 🔒 My Workflow
- **Pattern**: Project Pattern (Dual Track: Implementation + E2E Testing)
- **Scope document**: PROJECT.md
1. **Decompose**: Survey codebase with 3 explorers, define architecture, milestones, interface contracts in PROJECT.md, dispatch implementation and testing tracks.
2. **Dispatch & Execute**:
   - Direct / Delegate (sub-orchestrator per milestone)
   - Iteration Loop: Explorer(s) → Worker → Reviewer(s) + Challenger(s) + Auditor → Gate (pass/fail)
3. **On failure**: Retry → Replace → Skip → Redistribute → Redesign → Escalate
4. **Succession**: Self-succeed at 16 spawns.
- **Work items**:
  0. Survey & Baseline [in-progress]
  1. Shared Realtime Infrastructure & DB Migration (R1, R13) [pending]
  2. Partners & Admin Core / Super-Domains (R2, R3, R4, R5, R6, R7, R8) [pending]
  3. Admin Demandas, Operational Modules & Portals (R9, R10, R11) [pending]
  4. Client Portal Realtime (R12) [pending]
  5. Final E2E Test Suite Pass & Adversarial Hardening [pending]
- **Current phase**: 0 (Survey & Assessment)
- **Current focus**: Surveying codebase across 3 subagents.

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands directly — require workers to do so.
- NEVER explore the codebase at the code level directly — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- All 103 vitest tests must pass.
- npm run build must succeed with code 0 and 0 TS errors.
- Zero setInterval polling remaining in flagged files.
- Every subscribe() must have a removeChannel() cleanup.
- At least 20 component files importing the shared realtime utility.
- Auditor veto is binary and non-negotiable.

## Current Parent
- Conversation ID: e267e5b0-3321-4d0e-9672-86fbca1461a8
- Updated: not yet

## Key Decisions Made
- Selected Project Pattern with parallel Implementation and E2E Testing tracks.
- Spawned 3 Survey Explorers covering Infra/DB, Polling/Super-Domains, and Client Portal/Admin Modules.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_survey_1 | teamwork_preview_explorer | Survey Infra & DB Migration (R1, R13) | running | c4516274-1de1-4d10-a048-06732512b837 |
| explorer_survey_2 | teamwork_preview_explorer | Survey Polling & SuperDomains (R2-R8, R10, R11) | running | 80180e63-4e73-4db8-bb4d-4a0fb3d40d64 |
| explorer_survey_3 | teamwork_preview_explorer | Survey Client Portal & Admin Modules (R9, R10, R12) | running | 75e3fb18-f3d1-43ed-ae8f-203a44ef41dd |

## Succession Status
- Succession required: no
- Spawn count: 3 / 16
- Pending subagents: c4516274-1de1-4d10-a048-06732512b837, 80180e63-4e73-4db8-bb4d-4a0fb3d40d64, 75e3fb18-f3d1-43ed-ae8f-203a44ef41dd
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 9bbcf3d1-3e0a-47dd-9ec8-01e9c3d08333/task-11
- Safety timer: none

## Artifact Index
- `.agents/teamwork_preview_orchestrator_4/BRIEFING.md` — persistent memory index
- `.agents/teamwork_preview_orchestrator_4/progress.md` — heartbeat and workflow tracker
- `.agents/teamwork_preview_orchestrator_4/DISPATCH.md` — user request record
- `PROJECT.md` — project architecture, milestones, and interface contracts (to be created post-survey)
