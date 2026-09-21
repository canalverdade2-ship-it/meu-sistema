# Dispatch to E25: 
## 2026-09-04T19:37:19Z
You are teamwork_preview_test_writer_audio_1. Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_test_writer_audio_1

Read DISPATCH.md in your working directory.
Your task is to implement the E2E Test Suite and Verification Harness for the Audio Identity Builder:
1. Review ORIGINAL_REQUEST.md (2026-09-04T19:28:42Z), .agents/teamwork_preview_orchestrator_16/PROJECT.md, and .agents/teamwork_preview_orchestrator_16/TEST_INFRA.md.
2. Implement:
   - `infrastructure/gsa-tv/audio-identity/validate-audio-inventory.sh` (confirms directories, rejects stub files < 4KB, confirms >= 200 total audio files across news, viral, faith, lifestyle, sfx).
   - `infrastructure/gsa-tv/audio-identity/verify-audio-samples.sh` (draws 10 stratified random samples across the 5 categories, inspects with ffprobe and file, decodes bitstream via ffmpeg to confirm zero corruption).
   - `infrastructure/gsa-tv/audio-identity/test_audio_identity_e2e.mjs` (comprehensive multi-tier E2E runner validating SSH connectivity, directory layout, boundary conditions, inventory counts, and audio forensic checks).
3. Verify the scripts (syntax check and test runs).
4. Publish `TEST_READY.md` at `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_16\TEST_READY.md`.
5. Write your handoff report to `.agents/teamwork_preview_test_writer_audio_1/handoff.md` and message the orchestrator.

# Dispatch to E2E Test Writer (Milestone 1)

## Context & Assignment
Read:
- `ORIGINAL_REQUEST.md` (specifically `## 2026-09-04T19:28:42Z`)
- `PROJECT.md` at `.agents/teamwork_preview_orchestrator_16/PROJECT.md`
- `TEST_INFRA.md` at `.agents/teamwork_preview_orchestrator_16/TEST_INFRA.md`
- Survey reports:
  - `.agents/teamwork_preview_explorer_survey_vps_1/survey_vps_report.md`
  - `.agents/teamwork_preview_explorer_survey_pipeline_3/pipeline_report.md`

## Exclusive File Ownership
You own:
- `infrastructure/gsa-tv/audio-identity/validate-audio-inventory.sh`
- `infrastructure/gsa-tv/audio-identity/verify-audio-samples.sh`
- `infrastructure/gsa-tv/audio-identity/test_audio_identity_e2e.mjs`
- `TEST_READY.md` (write to `.agents/teamwork_preview_orchestrator_16/TEST_READY.md`)

## Deliverables
1. `validate-audio-inventory.sh`: Executable bash script that checks directory layout `/opt/gsa-tv/cache/media/1/identity/audio/{news,viral,faith,lifestyle,sfx}`, validates that total audio files (.mp3, .wav, .m4a) >= 200, rejects files < 4KB, outputs formatted table and supports `--json`.
2. `verify-audio-samples.sh`: Executable bash script that selects 10 random files (stratified across the 5 categories), tests each with `ffprobe` (and/or `file`), verifies audio codec, non-zero duration, sample rate, channels, and checks for bitstream corruption via `ffmpeg -v error -f null -`. Supports running both locally and on VPS.
3. `test_audio_identity_e2e.mjs`: Node.js test suite running over SSH to `147.15.43.141` (using key `C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key`), covering Tier 1 (structure & counts), Tier 2 (boundary & corner cases, stub rejection), Tier 3 (category combinations), Tier 4 (audio integrity verification).
4. Run syntax and test validations, document passing results, and publish `TEST_READY.md`.
5. Produce `handoff.md` in `.agents/teamwork_preview_test_writer_audio_1/handoff.md` and message the orchestrator.
