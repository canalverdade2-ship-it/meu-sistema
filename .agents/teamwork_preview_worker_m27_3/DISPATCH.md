# Dispatch for Worker M27_3 (Milestone 3: Pipeline Resume & Reconcile)

## Task Description
You are teamwork_preview_worker_m27_3.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_3`

Original request path:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Parent orchestrator context & briefing:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\BRIEFING.md`
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

Previous Milestones Completed:
- Milestone 1 completed: `/opt/gsa-tv/bin/night-production.py` is patched with duration tolerance & auto-approval, autonomous folder `/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15` has 777 permissions.
- Milestone 2 completed: All 6 library blocks are linked in PostgreSQL to approved masters.

## Objectives
1. Check current running processes and production status on VPS:
   - Check if any `night-production.py` process is currently running (`ps aux | grep night-production`).
   - Read `/opt/gsa-tv/runtime/production/2026-09-15.json` to identify which blocks are still unfulfilled or marked failed from earlier runs.
2. Resume or execute `night-production.py` for date `2026-09-15`:
   - Inspect CLI flags of `night-production.py` (e.g. `python3 /opt/gsa-tv/bin/night-production.py --help` or inspecting main block).
   - If previous run stopped or was waiting, trigger the autonomous production for the remaining blocks (such as `GSA Destinos`, `GSA Mundo`, `GSA Hora da Palavra`, `GSA Motor`, `GSA Tá na Rede`, `GSA Esportes`, `GSA Cinema`, `GSA Mistérios`, `GSA Bem Viver`, `GSA Tech`, `GSA Sabor`, etc.).
   - If any individual autonomous script or video needs triggering, ensure it completes successfully now that the quota window has reset and folder permissions are fixed.
3. Run Reconciliation:
   - Execute `python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15`.
   - Run `python3 /opt/gsa-tv/bin/night-production.py --check --date 2026-09-15`.
4. Compile the 24h Playlist:
   - Run `python3 /opt/gsa-tv/bin/night-production.py --compile-ready --date 2026-09-15`.
   - Verify that `/opt/gsa-tv/playlists/1/2026-09-15.json` exists and covers exactly 86,400 seconds (24 hours).
5. Document all commands, terminal outputs, and status in `handoff.md`.

## Execution Mechanism
Execute VPS commands using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <local_script_path>` from project root.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Write your handoff report to `.agents/teamwork_preview_worker_m27_3/handoff.md` and report back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) via send_message.

## 2026-09-15T07:29:10Z
Tasks:
1. Check current status and processes on VPS:
   - Check if night-production.py is running or stopped (ps aux | grep night-production).
   - Inspect /opt/gsa-tv/runtime/production/2026-09-15.json.
2. Resume / trigger production of remaining blocks:
   - Inspect night-production.py CLI options and execute production for 2026-09-15.
   - For blocks that had hit Gemini 429 quota window or permission issues earlier (e.g. GSA Destinos, GSA Mundo, GSA Hora da Palavra, GSA Motor, GSA Tá na Rede, GSA Esportes, GSA Cinema, GSA Mistérios, GSA Bem Viver, GSA Tech, GSA Sabor), execute their autonomous generation and ensure masters are synthesized and registered.
3. Reconcile and check:
   - Run python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15
   - Run python3 /opt/gsa-tv/bin/night-production.py --check --date 2026-09-15
4. Compile playlist:
   - Run python3 /opt/gsa-tv/bin/night-production.py --compile-ready --date 2026-09-15
   - Verify /opt/gsa-tv/playlists/1/2026-09-15.json has exactly 86400s (24h) and 0 missing programs.
