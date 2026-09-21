# Dispatch for Reviewer 2 (Milestone 4: Database & Media Metadata Audit)

## Task Description
You are teamwork_preview_reviewer_m27_2.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_m27_2`

Original request path (MANDATORY TO READ):
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Scope document:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

Predecessor Worker M27_9 handoff:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_9\handoff.md`

## Review Mission
Independently audit the database records and media metadata for schedule version `896c3e00-05a1-48ad-8d1e-bb12cc6a45ef`:
1. Query `gsa_tv_program_blocks` for schedule version `896c3e00-05a1-48ad-8d1e-bb12cc6a45ef`:
   - Confirm exactly 27 blocks exist.
   - Confirm 0 blocks have `media_item_id IS NULL`.
2. Query `gsa_tv_media_items` for the linked media IDs:
   - Confirm all 27 media items have `state = 'ready'`.
   - Confirm all 27 media items have `rights_ok = true` and `approval_state = 'approved'`.
   - Confirm file durations match database `duration_s` within the 2s tolerance threshold.
3. Verify that schedule signature is consistent and that playout continuity fillers seamlessly connect all scheduled blocks.

## Execution Mechanism
Execute commands on VPS using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <script>` from project root.

## Verdict Requirement
In your handoff report (`.agents/teamwork_preview_reviewer_m27_2/handoff.md`), provide an unambiguous verdict:
- **APPROVE** if database state, media links, and metadata integrity are 100% compliant.
- **REQUEST_CHANGES** if any database desync, unlinked block, or invalid approval/rights status is detected.

Send message back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) with your verdict and handoff path.
