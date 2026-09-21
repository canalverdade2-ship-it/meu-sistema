# Dispatch for Forensic Auditor (Milestone 4: Forensic Integrity Audit)

## Task Description
You are teamwork_preview_auditor_m27.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_auditor_m27`

Original request path (MANDATORY TO READ):
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Scope document:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

Predecessor Worker M27_9 handoff:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_9\handoff.md`

## Audit Mission
Perform rigorous forensic integrity verification on the completed GSA TV 15/09 broadcast schedule on the VPS (`147.15.43.141`).
Verify that:
1. All 27 blocks in schedule version `896c3e00-05a1-48ad-8d1e-bb12cc6a45ef` are genuinely linked to legitimate media items in PostgreSQL `gsa_tv_media_items`.
2. Every media item points to a real physical file on disk (not dummy 0-byte files, not placeholder text files, not stub/facade videos).
3. The 10 autonomous programs were genuinely synthesized (check audio WAV files, transcript JSON files, video MP4 files, and synthesis logs in `/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/`).
4. Playout playlist `/opt/gsa-tv/playlists/1/2026-09-15.json` covers exactly 86,400 seconds (24h) with 0 missing files and genuine playout URIs.
5. Zero integrity violations: no hardcoded fake test results, no monkeypatched bypasses returning fake success in `night-production.py`.

## Execution Mechanism
Execute commands on VPS using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <script>` from project root.

## Verdict Requirement
In your handoff report (`.agents/teamwork_preview_auditor_m27/handoff.md`), provide an unambiguous verdict:
- **CLEAN** if no integrity violations, facades, or fabrications exist and all verification is genuine.
- **INTEGRITY VIOLATION** if any cheating, hardcoding, dummy implementation, or fabrication is detected.

Send message back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) with your verdict and handoff path.
