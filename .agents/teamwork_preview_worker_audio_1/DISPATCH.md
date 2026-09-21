# Dispatch to Implementation Worker (Milestones 2 & 3)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Assignment
Read:
- ORIGINAL_REQUEST.md (specifically ## 2026-09-04T19:28:42Z)
- PROJECT.md at .agents/teamwork_preview_orchestrator_16/PROJECT.md
- Survey reports:
  - .agents/teamwork_preview_explorer_survey_vps_1/survey_vps_report.md
  - .agents/teamwork_preview_explorer_survey_sources_2/audio_sources_report.md
  - .agents/teamwork_preview_explorer_survey_pipeline_3/pipeline_report.md

## Exclusive File Ownership
You own:
- infrastructure/gsa-tv/audio-identity/ensure-dependencies.sh
- infrastructure/gsa-tv/audio-identity/acquire_identity_audio.mjs
- infrastructure/gsa-tv/audio-identity/run-audio-identity-pipeline.sh
- infrastructure/gsa-tv/audio-identity/deploy-and-run-vps.mjs
- infrastructure/gsa-tv/audio-identity/ATTRIBUTIONS.md

## Deliverables & Execution Requirements
1. ensure-dependencies.sh:
   - Non-interactive shell script.
   - Detects package manager (dnf/yum on Oracle Linux, apt-get on Debian/Ubuntu).
   - Installs dependencies (ffmpeg, curl, file, findutils, jq, coreutils, python3, node) safely without interactive prompts.
2. acquire_identity_audio.mjs:
   - High-performance Node.js ESM script.
   - Uses Incompetech OpenAPI (pieces.json) for 180 curated CC-BY 4.0 commercial tracks:
     - news: 45 tracks (tense, corporate, driving)
     - viral: 45 tracks (upbeat, comedy, pop)
     - faith: 45 tracks (cinematic, peaceful, ambient)
     - lifestyle: 45 tracks (jazz, acoustic, lounge)
   - Uses curated CC0 sound effects (from romainsimon/uisfx, Kenney UI audio, and Openverse Freesound CDN proxy) for 50 tracks:
     - sfx: 50 tracks (transitions, whooshes, impacts, tickers)
   - Total tracks: 230 audio files (.mp3 and .wav).
   - Two-phase staging download (.staging/ -> validate file size >= 4KB, magic bytes -> atomic rename mv).
   - Concurrency pool (e.g. 5 concurrent downloads) with exponential backoff and retry.
   - Writes ATTRIBUTIONS.md documenting credits and licenses.
3. run-audio-identity-pipeline.sh:
   - Master shell runner that ensures directories, runs dependencies, runs acquisition into /opt/gsa-tv/cache/media/1/identity/audio/, and invokes acceptance checks.
4. deploy-and-run-vps.mjs:
   - Remote SSH orchestrator to connect to Oracle VPS 147.15.43.141 as opc using key C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key.
   - Transfers the scripts to ~/teamwork_projects/audio_identity_builder on the VPS.
   - Executes the pipeline on the live VPS to download the assets into /opt/gsa-tv/cache/media/1/identity/audio/.
   - Captures logs and execution results.
5. Verify execution on the live VPS: verify that the 5 directories exist and contain >= 200 real audio files.
6. Write your detailed handoff report to .agents/teamwork_preview_worker_audio_1/handoff.md and message the orchestrator.
