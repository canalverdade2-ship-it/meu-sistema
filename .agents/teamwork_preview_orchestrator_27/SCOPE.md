# Scope: GSA TV 15/09 Grid Nightly Production Monitoring and Remediation

## Architecture
- Playout Control Plane: container `gsa-tv-control-plane`, PostgreSQL database `gsa_tv_media_items`, `gsa_tv_program_blocks`, `gsa_tv_schedule_versions`.
- Autonomous Nightly Generator: `/opt/gsa-tv/bin/night-production.py`.
- Autonomous Pipeline Directory: `/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15`.
- Masters Directory: `/opt/gsa-tv/cache/media/1/program-masters/`.
- Compilers & Playlists: `/opt/gsa-tv/playlists/1/2026-09-15.json`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Duration Tolerance Patch | Update night-production.py to accept synthesized AI news masters and handle underfilled blocks gracefully via playout padding | M1 | DISPATCH & Explorer m2_1 |
| 2 | Autonomous Permissions | Ensure /opt/gsa-tv/cache/media/1/production/autonomous has full write permissions | M1 | DISPATCH & Explorer m2_1 |
| 3 | Library Media SQL Linking | Link 6 library blocks (GSA Em Fé x2, GSA Desenhos, Sessão Pipoca, GSA Music, Continuidade GSA TV) to existing approved masters | M2 | DISPATCH & Explorer m2_2 |
| 4 | Resume Autonomous Generation | Re-run script generation and video synthesis for 8 blocks stalled by Gemini 429 | M3 | DISPATCH & context.md |
| 5 | Reconcile & Compile Schedule | Run --reconcile and --compile-ready to produce 86,400s (24h) valid playlist | M3 | DISPATCH & context.md |
| 6 | Schedule & Execution QC | Full verification: 100% programs ready, 0 failed, 2026-09-15-execution.log clean | M4 | DISPATCH & ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Patch & Permissions | Apply tolerance patch to night-production.py & fix autonomous directory permissions | none | DONE (Tolerance patch applied, py_compile OK, 777 permissions) |
| 2 | M2: Library SQL Linking | Execute SQL migration/updates linking 6 library blocks with approved media items | none | DONE (100% 6 blocks linked, verified) |
| 3 | M3: Pipeline Resume & Reconcile | Rerun night-production.py for 429-delayed blocks, then reconcile | M1, M2 | DONE (27/27 blocks linked, state: ready, 86,400s playlist compiled) |
| 4 | M4: Final Verification & Audit | Verify playlist duration (86400s), check 0 missing/failed, audit execution logs | M3 | DONE (All 27 blocks verified, state: ready, 86,400s playlist verified) |

## Interface Contracts
- `night-production.py`:
  - `--reconcile --date 2026-09-15`: Matches media items with schedule blocks and records status in `2026-09-15.json`.
  - `--check --date 2026-09-15`: Returns JSON summary `{"state": "ready", "issues": []}`.
  - `--compile-ready --date 2026-09-15`: Compiles `/opt/gsa-tv/playlists/1/2026-09-15.json`.
