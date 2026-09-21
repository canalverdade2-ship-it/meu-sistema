# Dispatch for Worker M27_7 (Milestone 3: Final Autonomous Pipeline Verification & Compilation)

## Task Description
You are teamwork_preview_worker_m27_7.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_7`

Original request path:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Predecessor progress:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_5\progress.md`

## Context
Worker M27_5 launched `sudo python3 /opt/gsa-tv/bin/night-production.py --force --date 2026-09-15` on VPS (`147.15.43.141`).
Prior to that, 6 of the 10 autonomous programs were already completely synthesized, rendered, validated, and registered in PostgreSQL (`gsa-bem-viver`, `gsa-sabor`, `gsa-destinos`, `gsa-mundo`, `gsa-hora-da-palavra`, `gsa-motor`).
Only 4 programs remained (`gsa-ta-na-rede`, `gsa-esportes`, `gsa-cinema`, `gsa-misterios`).
The background process has now been running for over 1 hour on the VPS.

## Objectives
1. Check current production state on VPS:
   `node scratch/vps-exec.mjs "cat /opt/gsa-tv/runtime/production/2026-09-15.json"`
   `node scratch/vps-exec.mjs "ps aux | grep night-production | grep -v grep || echo 'NOT RUNNING'"`
2. If `night-production.py` is finished, run reconciliation and verify readiness:
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15"`
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --check --date 2026-09-15"`
3. Compile the 24h playlist:
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --compile-ready --date 2026-09-15"`
4. Verify `/opt/gsa-tv/playlists/1/2026-09-15.json`:
   - Must cover exactly 86,400 seconds (24 hours).
   - 0 missing programs.
5. Write handoff report in `.agents/teamwork_preview_worker_m27_7/handoff.md`.

## Execution Mechanism
Execute VPS commands using:
`node scratch/vps-exec.mjs "<command>"` from project root.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Write your handoff report to `.agents/teamwork_preview_worker_m27_7/handoff.md` and report back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) via send_message.

## 2026-09-15T13:00:47Z
Check production status on VPS, run reconciliation, compile 24h playlist, verify /opt/gsa-tv/playlists/1/2026-09-15.json covers 86400s with 0 missing programs.
