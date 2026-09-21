# DISPATCH

## 2026-09-15T03:52:00Z
You are teamwork_preview_worker_remediation_1.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_remediation_1
Project root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP:
Read:
1. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (header ## 2026-09-15T03:25:13Z)
2. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_26\PROJECT.md
3. Remediation Blueprint from Explorers:
   - c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m2_1\handoff.md
   - c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m2_1\apply_remediation.sh
   - c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m2_2\analysis.md (Section 4 SQL script)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

OBJECTIVE:
Execute the remediation actions on the VPS to resolve the permission errors, link the 6 library blocks, approve synthesized media, and patch `night-production.py` validation rules so the 15/09 grid pipeline completes 100% cleanly.

HOW TO EXECUTE ON VPS:
Use scratch/vps-exec.mjs or scratch/ssh2-run.mjs to run commands on Oracle Linux VPS (`147.15.43.141:22`, user `opc`).

EXECUTION STEPS:
1. Fix Autonomous Pipeline Permissions:
   ```bash
   sudo mkdir -p /opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15
   sudo chmod -R 777 /opt/gsa-tv/cache/media/1/production/autonomous
   sudo chown -R opc:gsa-tv /opt/gsa-tv/cache/media/1/production/autonomous
   ```
2. Apply Database Updates for Library Blocks & Approvals:
   Execute the atomic SQL from `.agents/teamwork_preview_explorer_m2_2/analysis.md § 4` and `.agents/teamwork_preview_explorer_m2_1/apply_remediation.sh § 2` via `docker exec -i gsa-tv-control-plane node -e "..."` or `psql` to:
   - Approve all 2026-09-15 masters in `gsa_tv_media_items` (`approval_state='approved'`, `rights_ok=true`).
   - Enrich metadata and link the 6 library blocks in `gsa_tv_program_blocks` (`schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'`).
3. Apply Safe Patch to `/opt/gsa-tv/bin/night-production.py`:
   - Backup the file first: `sudo cp -a /opt/gsa-tv/bin/night-production.py /opt/gsa-tv/bin/night-production.py.bak`
   - Apply the patch described in `.agents/teamwork_preview_explorer_m2_1/apply_remediation.sh § 3`:
     * In `media_issue()`: remove the `underfilled` rejection (let playout compiler pad with Continuidade).
     * In the insert query: ensure newly synthesized media are inserted as `approval_state='approved'` and `rights_ok=true`.
     * Set item state to `validated` instead of `incomplete_duration`.
4. Run Verification Commands:
   ```bash
   python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15
   python3 /opt/gsa-tv/bin/night-production.py --check --date 2026-09-15
   ```
   Check `/opt/gsa-tv/runtime/production/2026-09-15.json` and log to verify that issues are resolved.
   Verify process liveness of `night-production.py`.

OUTPUT REQUIREMENTS:
- Update progress.md in your folder.
- Document exact commands and stdout/stderr in your handoff.md.
- Send a completion message back to the orchestrator.
