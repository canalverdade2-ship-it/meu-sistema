# Dispatch for Worker M27_2 (Milestone 2: Library Media SQL Linking)

## Task Description
You are teamwork_preview_worker_m27_2.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_2`

Original request path:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Parent orchestrator context & briefing:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\BRIEFING.md`
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

Detailed Diagnostic and SQL mapping prepared by Explorer m2_2:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m2_2\handoff.md`

## Objective
Execute the SQL updates and inserts into PostgreSQL on the VPS to link the 6 library blocks in the 15/09 active schedule (`schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'`):
1. **GSA Desenhos** (Block `823999aa-010f-4d8e-aaba-07db6bf53b91`): Link to `media-ent-desenhos-sabado` and add `{"program_id":"7c7ef1c5-d4a4-44df-b887-2f2a06891a19","program_slug":"gsa-desenhos"}` to metadata.
2. **Sessão Pipoca** (Block `c25b969e-5c85-471a-b3d7-df1f14e86eb7`): Link to `media-ent-pipoca-sabado` and add `{"program_id":"b8cb754c-7be0-4ef0-af32-7b594be6d328","program_slug":"gsa-sessao-pipoca"}` to metadata.
3. **GSA Em Fé Manhã** (Block `a782f8bb-1585-4eca-93e2-673ffa8211a0`): Link to master `media-library-em-fe-1800s` (`gsa-historias-da-biblia-o-filho-prodigo-30m.mp4`, 1800s) with `approval_state='approved'`, `rights_ok=true`.
4. **GSA Music** (Block `9419f6a4-cbcc-486f-8cac-76503231a6cc`): Link to `media-library-music-1800s` (`doa-1949-classic-noir-1080p.mp4` or approved music master, 1800s) with `approval_state='approved'`, `rights_ok=true`.
5. **GSA Em Fé Noite** (Block `2a8851c9-af05-4e8b-b337-53e5c615bb5d`): Link to `media-auto-ad31636f-c7c7-4aa8-a6ae-8add00139bdc`.
6. **Continuidade GSA TV** (Block `91368035-2657-430a-b148-d0a466e5327a`): Link to `media-gsa-tv-continuity-600`.

Review Section 4 of `.agents/teamwork_preview_explorer_m2_2/handoff.md` for the exact SQL transaction.

## Execution Mechanism
Execute the SQL transaction inside the container `gsa-tv-control-plane` or via PostgreSQL connection on the VPS using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <local_script_path>` from project root.

Verify by running a query on `gsa_tv_program_blocks` for schedule version `896c3e00-05a1-48ad-8d1e-bb12cc6a45ef`:
Confirm that all 6 library blocks now have non-null `media_item_id` and point to existing, approved media items.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Write your handoff report to `.agents/teamwork_preview_worker_m27_2/handoff.md` with:
- Verification SQL queries and outputs
- Status of all 6 blocks
Send completion message back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`).

## 2026-09-15T07:19:24Z
You are teamwork_preview_worker_m27_2.
Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_2

You MUST read ORIGINAL_REQUEST.md before starting:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-15T03:25:13Z.

Also read your dispatch instructions at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_2\DISPATCH.md

And reference the explorer analysis at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_m2_2\handoff.md

Task:
Execute the SQL updates and inserts into PostgreSQL on the VPS to link the 6 library blocks in the 15/09 active schedule (schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'):
- GSA Desenhos -> media-ent-desenhos-sabado
- Sessão Pipoca -> media-ent-pipoca-sabado
- GSA Em Fé Manhã -> media-library-em-fe-1800s (gsa-historias-da-biblia-o-filho-prodigo-30m.mp4)
- GSA Music -> media-library-music-1800s (doa-1949-classic-noir-1080p.mp4 or approved music master)
- GSA Em Fé Noite -> media-auto-ad31636f-c7c7-4aa8-a6ae-8add00139bdc
- Continuidade GSA TV -> media-gsa-tv-continuity-600

Refer to Section 4 of .agents/teamwork_preview_explorer_m2_2/handoff.md for the exact SQL transaction.

Execute on VPS using:
node scratch/vps-exec.mjs "<command>" or via a script executed inside gsa-tv-control-plane.

Verify that all 6 library blocks now have non-null media_item_id and point to valid approved media items.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to .agents/teamwork_preview_worker_m27_2/handoff.md and report back to parent (1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed) via send_message.
