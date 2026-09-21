# Dispatch for Worker M27_1 (Milestone 1: Patch & Permissions)

## Task Description
You are teamwork_preview_worker_m27_1.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_1`

Original request path:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Parent orchestrator context & briefing:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\BRIEFING.md`
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

Detailed Diagnostic and Remediation scripts prepared by Explorer m2_1:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m2_1\handoff.md`
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m2_1\apply_remediation.sh`
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m2_1\proposed_night-production.patch`

## Objective
1. Ensure the autonomous production directory exists and has 777 permissions:
   `sudo mkdir -p /opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15`
   `sudo chmod -R 777 /opt/gsa-tv/cache/media/1/production/autonomous`
   `sudo chown -R opc:gsa-tv /opt/gsa-tv/cache/media/1/production/autonomous`
2. Apply the duration tolerance and approval patch to `/opt/gsa-tv/bin/night-production.py`:
   - Accept synthesized masters (e.g. `gsa-meio-dia-news`, `gsa-mercado`, `gsa-planeta-terra`, `gsa-news-noite`) without flagging `incomplete_duration` when duration is shorter than the block, since the playout compiler automatically pads underfilled slots with Continuidade filler.
   - Register synthesized masters with `approval_state='approved'` and `rights_ok=true` so `link_eligible()` can bind them.
   - Make a backup of `/opt/gsa-tv/bin/night-production.py` before patching.
3. Update existing 2026-09-15 masters in `gsa_tv_media_items` to `approval_state='approved'` and `rights_ok=true`.
4. Verify by running syntax check on `/opt/gsa-tv/bin/night-production.py` (`python3 -m py_compile /opt/gsa-tv/bin/night-production.py`).

## Execution Mechanism
Execute commands on the VPS using the existing Node SSH runner:
`node scratch/vps-exec.mjs "<remote command>"` or `node scratch/vps-exec.mjs -f <local_script_path>` from project root `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Write your handoff report to `.agents/teamwork_preview_worker_m27_1/handoff.md` with:
- Verification commands and outputs
- Status of `/opt/gsa-tv/bin/night-production.py`
- Status of autonomous directory permissions
- Status of media approval updates
Send completion message back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`).

## 2026-09-15T07:19:24Z
You are teamwork_preview_worker_m27_1.
Task:
1. Ensure the autonomous production directory exists and has 777 permissions on VPS:
   sudo mkdir -p /opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15
   sudo chmod -R 777 /opt/gsa-tv/cache/media/1/production/autonomous
   sudo chown -R opc:gsa-tv /opt/gsa-tv/cache/media/1/production/autonomous
2. Apply duration tolerance patch to /opt/gsa-tv/bin/night-production.py to accept synthesized masters for news programs without incomplete_duration error (playout compiler pads underfilled slots with Continuidade filler). Also ensure synthesized masters are inserted as approved and rights_ok=true.
3. Update existing 2026-09-15 media items in PostgreSQL to approved and rights_ok=true.
4. Verify python syntax on night-production.py.
Execute VPS commands using:
node scratch/vps-exec.mjs "<command>"

