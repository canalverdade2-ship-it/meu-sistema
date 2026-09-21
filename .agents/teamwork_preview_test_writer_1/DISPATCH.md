# Dispatch to E2E Test Writer (Milestone 1)

## Context & Assignment
Read:
- `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (specifically `## 2026-09-04T19:28:42Z`)
- `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_16\PROJECT.md`
- `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_16\TEST_INFRA.md`
- Reports from Explorers 1 and 3 in `.agents/teamwork_preview_explorer_survey_vps_1/` and `.agents/teamwork_preview_explorer_survey_pipeline_3/`.

## Exclusive File Ownership
You own:
- `infrastructure/gsa-tv/audio-identity/validate-audio-inventory.sh`
- `infrastructure/gsa-tv/audio-identity/verify-audio-samples.sh`
- `infrastructure/gsa-tv/audio-identity/test_audio_identity_e2e.mjs`
- `TEST_READY.md` (publish in project root or orchestrator directory upon completion)

## Deliverables
1. `validate-audio-inventory.sh`: Executable bash script that checks directory layout `/opt/gsa-tv/cache/media/1/identity/audio/{news,viral,faith,lifestyle,sfx}`, validates that total audio files (.mp3, .wav, .m4a) >= 200, rejects files < 4KB, outputs formatted table and supports `--json`.
2. `verify-audio-samples.sh`: Executable bash script that selects 10 random files (stratified across the 5 categories), tests each with `ffprobe` (and/or `file`), verifies audio codec, non-zero duration, sample rate, channels, and checks for bitstream corruption via `ffmpeg -v error -f null -`. Supports running both locally (using Docker `gsa-tv/control-plane:1.7.2` or native tools) and on VPS.
3. `test_audio_identity_e2e.mjs`: Node.js test suite running over SSH to `147.15.43.141` (using key `C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key`), covering Tier 1 (structure & counts), Tier 2 (boundary & corner cases, stub rejection), Tier 3 (category combinations), Tier 4 (audio integrity verification).
4. Run syntax and test validations, document passing results, and publish `TEST_READY.md`.
5. Produce `handoff.md` and message the orchestrator.

## 2026-09-09T19:58:44Z

You are Test Writer 1 for the GSA TV Workflow Simplification project.
Your identity: teamwork_preview_test_writer_1
Your working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_test_writer_1

MANDATORY: Read ORIGINAL_REQUEST.md at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (under header ## 2026-09-09T19:51:10Z)
and your context at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_test_writer_1\context.md
and the project plan at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md

Task:
1. Create a comprehensive automated test suite in `src/tests/gsa-tv-workflow-simplification.test.ts` using Vitest to test the workflow simplifications (R1, R2, R3).
2. The tests must verify:
   - R1: Upload flow does not require mandatory approval fields; media status is set to 'approved'/'ready' without pending approval blockers.
   - R2: Master Control actions (Play/Stop/Take) have 0 `window.confirm` dialogs in `GsaTvLiveConsole.tsx`, `GsaTvMasterControl.tsx`, `GsaTvModule.tsx`, and `GsaTvSettingsTab.tsx`.
   - R2 (Grade): Grade de Programação form reduces required fields by >= 30% (from 3 to 2: Media and Início), and automatically computes end time from media duration.
   - R3: All 6 tabs (`master`, `schedule`, `library`, `ai`, `operations`, `settings`) are present and preserved.
3. Ensure the test suite runs and passes with `npm run test:unit` or `npx vitest run src/tests/gsa-tv-workflow-simplification.test.ts`. Also verify contract compliance `npm run test:gsa-tv`.
4. Create `TEST_INFRA.md` and `TEST_READY.md` at project root.
5. Write your handoff report to `handoff.md` in your working directory.
When finished, send a message to parent summarizing your tests and linking to handoff.md.
