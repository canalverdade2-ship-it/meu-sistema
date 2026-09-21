# Dispatch for Worker M27_9 (Milestone 3: Final Autonomous Pipeline Verification & Compilation)

## Task Description
You are teamwork_preview_worker_m27_9.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_9`

Original request path:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Predecessor progress:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_8\progress.md`

## Context & Current State
- 26 of 27 blocks in the 15/09 schedule are ALREADY validated, probe-tested, and broadcast-ready!
- Predecessor Worker M27_8 completed all prerequisite troubleshooting on VPS:
  1. Symlinked `/usr/local/bin/ffprobe` and `/usr/local/bin/ffmpeg` to `/usr/bin/` so `probe()` works cleanly under `sudo`.
  2. The script JSON (`/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.json`) is 100% complete with `review: {pass: true, violations: []}`.
  3. The audio WAV (`/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.wav`, 84.9 MB) is 100% synthesized across all 3 parts.
  4. Predecessor executed `scratch/clean-ta-and-run.sh` on VPS: cleaned stale MP4 files, reset `media_item_id = null` for block `0f2f9292-a83b-462b-aab7-b09cbff27b8a`, deleted stale DB row `media-auto-ac56ae82-85dd-4ea2-98ef-6751bd3a9daf`, and removed `gsa-ta-na-rede` from `/opt/gsa-tv/runtime/production/2026-09-15.json`.

## Steps to Execute
1. Run `night-production.py` to render the video for GSA Tá na Rede and compile the playlist:
   `node scratch/vps-exec.mjs -f scratch/run-night-production.sh`
   (or `node scratch/vps-exec.mjs "sudo python3 /opt/gsa-tv/bin/night-production.py --force --date 2026-09-15"`)
   Because the audio WAV and script JSON already exist, it will immediately execute video assembly (`render-generic-program.py`, ~60-90s), validate QC, register the media item into `gsa_tv_media_items`, link block `0f2f9292`, link all eligible blocks, and automatically call `compile_ready()`.
2. Check schedule readiness:
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --reconcile --date 2026-09-15"`
   Must report `state: 'ready'` with `issues: []`.
   If not yet ready or if `compile_ready` needs manual call:
   `node scratch/vps-exec.mjs "python3 /opt/gsa-tv/bin/night-production.py --compile-ready --date 2026-09-15"`
3. Verify 24-hour playlist:
   `node scratch/vps-exec.mjs "python3 -c \"import json; p=json.load(open('/opt/gsa-tv/playlists/1/2026-09-15.json')); entries=p.get('program',[]); total=sum(float(e['out'])-float(e.get('in',0)) for e in entries); print('Date:', p.get('date'), 'Entries:', len(entries), 'Total duration:', total)\""`
   Must verify that total duration is exactly 86,400 seconds (24 hours) with 0 missing programs.
4. Write handoff report in `.agents/teamwork_preview_worker_m27_9/handoff.md`.

## Execution Mechanism
Execute VPS commands using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <script>` from project root.
Remember: Avoid nested quotes in PowerShell; writing a small `.sh` file and passing `-f` is always 100% reliable.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables

## 2026-09-15T16:14:00Z
Task assigned from user/parent:
Run night-production on VPS to render video for GSA Tá na Rede, reconcile schedule readiness, compile playlist, and verify 86400s coverage.

## 2026-09-15T16:22:28Z
Guidance from parent:
Update gsa_tv_media_items.duration_s for media-ent-desenhos-sabado to match ffprobe actual duration, then run sudo python3 /opt/gsa-tv/bin/night-production.py --force --date 2026-09-15.

## 2026-09-15T16:26:25Z
Parent note:
Use round(dur) for duration_s because column is integer.
