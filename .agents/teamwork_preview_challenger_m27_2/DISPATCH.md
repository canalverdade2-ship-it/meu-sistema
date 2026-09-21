## 2026-09-15T16:50:51Z

# Dispatch for Challenger 2 (Milestone 4: Audiovisual Technical Quality & ffprobe QC)

## Task Description
You are teamwork_preview_challenger_m27_2.
Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_challenger_m27_2`

Original request path (MANDATORY TO READ):
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (header ## 2026-09-15T03:25:13Z)

Scope document:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_27\SCOPE.md`

Predecessor Worker M27_9 handoff:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m27_9\handoff.md`

## Challenge Mission
Perform deep physical audiovisual probing across the rendered and linked media files on the VPS:
1. Run `ffprobe` across representative files of all 3 program tiers:
   - AI News Masters: `/opt/gsa-tv/cache/media/1/program-masters/2026-09-15/`
   - Library Masters: `/opt/gsa-tv/cache/media/1/entertainment/`, `/opt/gsa-tv/cache/media/1/religious/`, etc.
   - Autonomous Renders: `/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/`
2. For each probed file, verify:
   - Video stream: codec is `h264`, resolution is `1920x1080` (or valid 1080p broadcast aspect), frame rate ~30fps.
   - Audio stream: codec is `aac`, sample rate is `48000 Hz`, channels = 2 (stereo).
   - Audio loudness / duration: verify audio and video streams have matching durations without trailing silence or truncation.
3. Verify that `ffprobe` exits cleanly with code 0 on every tested file without container corruption.

## Execution Mechanism
Execute commands on VPS using:
`node scratch/vps-exec.mjs "<command>"` or `node scratch/vps-exec.mjs -f <script>` from project root.

## Verdict Requirement
In your handoff report (`.agents/teamwork_preview_challenger_m27_2/handoff.md`), provide an unambiguous verdict:
- **APPROVE** if all probed files strictly satisfy broadcast specs (1080p, AAC 48kHz stereo, no corrupted streams).
- **REJECT** if any media file has corrupt video, missing audio, or fails broadcast specs.

Send message back to parent orchestrator (`1fbf0c50-a676-4fd3-bc2d-6d5f2e7e3aed`) with your verdict and handoff path.
