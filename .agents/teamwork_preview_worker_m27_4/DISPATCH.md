# Dispatch for Worker M27_4 (Milestone 3 Replacement: Pipeline Resume & Reconcile)

## Task Description
You are teamwork_preview_worker_m27_4, replacing Worker M27_3 which stopped due to a model capacity error.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_4`

Original request path:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Parent orchestrator context & briefing:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\BRIEFING.md`
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

Interruption State from Worker M27_3:
- Explorer m2_1 & m2_2 diagnostics completed and verified.
- Milestone 1 (night-production.py patch & 777 permissions) completed.
- Milestone 2 (all 6 library blocks linked in PostgreSQL) completed.
- Worker M27_3 already prepared:
  - Integration of Fish Audio TTS into `autonomous-script.cjs` with decrypted vault in container.
  - Patch script `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_3\patch_bumper.sh` to fix container path resolution for vinheta bumper in `/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py`.

## Objectives
1. Apply `patch_bumper.sh` on VPS:
   `node scratch/vps-exec.mjs -f .agents/teamwork_preview_worker_m27_3/patch_bumper.sh`
   Confirm it outputs `PATCHED_SUCCESSFULLY` or verify that the container path `/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4` is checked.
2. Check which blocks in the 15/09 schedule (`896c3e00-05a1-48ad-8d1e-bb12cc6a45ef`) are still unlinked:
   - Run query or check `2026-09-15.json`.
3. Resume/Trigger production for the remaining blocks:
   - Test or run autonomous generation for the unlinked programs.
   - Once rendered and registered, each program will have an approved media item in `gsa_tv_media_items`.
4. Reconcile and check:
   - Run `python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15`
   - Run `python3 /opt/gsa-tv/bin/night-production.py --check --date 2026-09-15`
   Ensure no missing or failed programs remain.
5. Compile playlist:
   - Run `python3 /opt/gsa-tv/bin/night-production.py --compile-ready --date 2026-09-15`
   - Verify `/opt/gsa-tv/playlists/1/2026-09-15.json` exists and covers exactly 86,400s (24h).
6. Document findings and write handoff report in `.agents/teamwork_preview_worker_m27_4/handoff.md`.

## Execution Mechanism
Execute VPS commands using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <local_script_path>` from project root.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Write your handoff report to `.agents/teamwork_preview_worker_m27_4/handoff.md` and report back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) via send_message.
