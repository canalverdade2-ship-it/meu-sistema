# Dispatch for Reviewer 1 (Milestone 4: Broadcast Readiness & Schedule Review)

## Task Description
You are teamwork_preview_reviewer_m27_1.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_m27_1`

Original request path (MANDATORY TO READ):
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Scope document:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

Predecessor Worker M27_9 handoff:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_9\handoff.md`

## Review Mission
Independently examine the broadcast readiness, completeness, and robustness of the GSA TV 15/09 grid:
1. Verify reconciliation output:
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15"`
   Must report `state: 'ready'` with `issues: []`.
2. Verify 24-hour playlist `/opt/gsa-tv/playlists/1/2026-09-15.json`:
   - Duration is exactly 86,400 seconds (24h).
   - All 153 playlist entries have valid source files on disk.
   - Zero missing programs.
3. Verify that all acceptance criteria from ORIGINAL_REQUEST ## 2026-09-15T03:25:13Z are satisfied:
   - No programs in the schedule are left missing or failed.
   - Full 24h block generated successfully.

## Execution Mechanism
Execute commands on VPS using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <script>` from project root.

## Verdict Requirement
In your handoff report (`.agents/teamwork_preview_reviewer_m27_1/handoff.md`), provide an unambiguous verdict:
- **APPROVE** if all requirements and criteria are fully met.
- **REQUEST_CHANGES** if any issues, missing programs, or duration discrepancies remain.

Send message back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) with your verdict and handoff path.

## 2026-09-15T16:50:43Z
You are teamwork_preview_reviewer_m27_1.
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_m27_1

You MUST read ORIGINAL_REQUEST.md before starting:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-15T03:25:13Z.

Also read your dispatch instructions at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_m27_1\DISPATCH.md

And reference the predecessor worker handoff at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_9\handoff.md

Review Mission:
Independently examine the broadcast readiness, completeness, and robustness of the GSA TV 15/09 grid:
1. Verify reconciliation output:
   node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15"
   Must report state: 'ready' with issues: [].
2. Verify 24-hour playlist /opt/gsa-tv/playlists/1/2026-09-15.json:
   - Duration is exactly 86,400 seconds (24h).
   - All 153 playlist entries have valid source files on disk.
   - Zero missing programs.
3. Verify that all acceptance criteria from ORIGINAL_REQUEST ## 2026-09-15T03:25:13Z are satisfied.

Execute commands on VPS using:
node scratch/vps-exec.mjs "<command>" or node scratch/vps-exec.mjs -f <script>

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. Report genuine objective review findings.

Provide an unambiguous verdict: APPROVE or REQUEST_CHANGES.
Write your handoff report to .agents/teamwork_preview_reviewer_m27_1/handoff.md and report back to parent (1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed) via send_message.
