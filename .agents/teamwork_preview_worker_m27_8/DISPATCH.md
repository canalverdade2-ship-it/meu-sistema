# Dispatch for Worker M27_8 (Milestone 3: Final Autonomous Pipeline Verification & Compilation)

## Task Description
You are teamwork_preview_worker_m27_8.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_8`

Original request path:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Predecessor progress:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_7\progress.md`

## Context & Current State
- 26 of 27 blocks in the 15/09 schedule are ALREADY validated, probe-tested, and broadcast-ready!
- Only ONE program remains: `GSA Tá na Rede` (`0f2f9292-a83b-462b-aab7-b09cbff27b8a`).
- `GSA Tá na Rede` already has its complete audio WAV (`/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.wav`, 86.68 MB) and manifest.
- The review object in `/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.json` was already updated to `pass: true, violations: []`.
- `autonomous-script.cjs` was already patched to normalize review objects before writing.
- `scratch/patch-existing-progs.sh` was prepared by predecessor M27_7 to ensure `night-production.py` loads all validated 2026-09-15 programs from the database into state.

## Objectives
1. Apply `scratch/patch-existing-progs.sh` on VPS:
   `node scratch/vps-exec.mjs -f scratch/patch-existing-progs.sh`
2. Run `sudo python3 /opt/gsa-tv/bin/night-production.py --force --date 2026-09-15`:
   `node scratch/vps-exec.mjs "sudo python3 /opt/gsa-tv/bin/night-production.py --force --date 2026-09-15"`
   This will assemble the video for `GSA Tá na Rede` (~60s), validate it, link all 27 blocks, and automatically run `compile_ready()`.
3. Check schedule readiness:
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15"`
   Must report `state: 'ready'` with `issues: []`.
4. Verify 24-hour playlist:
   `node scratch/vps-exec.mjs "cat /opt/gsa-tv/playlists/1/2026-09-15.json | head -n 30"`
   `node scratch/vps-exec.mjs "python3 -c \"import json; p=json.load(open('/opt/gsa-tv/playlists/1/2026-09-15.json')); entries=p.get('program',[]); total=sum(float(e['out'])-float(e.get('in',0)) for e in entries); print('Date:', p.get('date'), 'Entries:', len(entries), 'Total duration:', total)\""`
   Must verify that total duration is exactly 86,400 seconds (24 hours) with 0 missing programs.
5. Write handoff report in `.agents/teamwork_preview_worker_m27_8/handoff.md`.

## Execution Mechanism
Execute VPS commands using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <script>` from project root.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables
Write your handoff report to `.agents/teamwork_preview_worker_m27_8/handoff.md` and report back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) via send_message.

## 2026-09-15T15:22:00Z
You are teamwork_preview_worker_m27_8.
Context & Goal:
26 of 27 blocks in the 15/09 grid are ALREADY validated, probe-tested, and broadcast-ready!
Only ONE program remains: GSA Tá na Rede (0f2f9292-a83b-462b-aab7-b09cbff27b8a).
Its audio WAV (86.68 MB) and manifest are already synthesized on VPS at /opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.wav.
The review object in gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.json has already been updated to pass: true, violations: [].

Task:
1. Apply scratch/patch-existing-progs.sh on VPS:
   node scratch/vps-exec.mjs -f scratch/patch-existing-progs.sh
2. Run sudo python3 /opt/gsa-tv/bin/night-production.py --force --date 2026-09-15:
   node scratch/vps-exec.mjs "sudo python3 /opt/gsa-tv/bin/night-production.py --force --date 2026-09-15"
   This will assemble the video for GSA Tá na Rede (~60-90s), validate it, link all 27 blocks, and automatically run compile_ready().
3. Run reconciliation and verify readiness:
   node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15"
   Must output state: 'ready' with issues: [].
4. Verify the 24-hour playlist /opt/gsa-tv/playlists/1/2026-09-15.json:
   node scratch/vps-exec.mjs "python3 -c \"import json; p=json.load(open('/opt/gsa-tv/playlists/1/2026-09-15.json')); entries=p.get('program',[]); total=sum(float(e['out'])-float(e.get('in',0)) for e in entries); print('Date:', p.get('date'), 'Entries:', len(entries), 'Total duration:', total)\""
   Must verify that total duration is exactly 86,400 seconds (24h) with 0 missing programs.
5. Write handoff report in .agents/teamwork_preview_worker_m27_8/handoff.md and report back to parent (1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed) via send_message.
