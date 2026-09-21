# Dispatch for Worker M27_5 (Milestone 3: Pipeline Resume & Reconcile)

## Task Description
You are teamwork_preview_worker_m27_5.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_5`

Original request path:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Parent orchestrator context & briefing:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\BRIEFING.md`
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

## Objectives
1. Apply `patch_bumper.sh` on VPS:
   `node scratch/vps-exec.mjs -f .agents/teamwork_preview_worker_m27_3/patch_bumper.sh`
2. Check schedule status and run reconciliation on VPS:
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15"`
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --check --date 2026-09-15"`
3. If any autonomous programs need synthesis, execute them using the tools in `/media/1/production/autonomous/tools/`.
4. Compile the 24h playlist:
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --compile-ready --date 2026-09-15"`
5. Verify `/opt/gsa-tv/playlists/1/2026-09-15.json`:
   - Must cover exactly 86,400 seconds (24 hours).
   - 0 missing programs.
6. Write handoff report in `.agents/teamwork_preview_worker_m27_5/handoff.md`.

## Execution Mechanism
Execute VPS commands using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <local_script_path>` from project root.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Write your handoff report to `.agents/teamwork_preview_worker_m27_5/handoff.md` and report back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) via send_message.
