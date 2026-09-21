# Project: GSA TV Sonic Identity Audio Assets & Automation Engine

## Architecture
- **Environment & Dependency Provisioner**: `ensure-dependencies.sh`
  - Detects Oracle Linux 9.8 (aarch64) with `dnf`/`yum` or Debian/Ubuntu with `apt-get`.
  - Non-interactive execution, installs required utilities (`ffmpeg`, `curl`, `file`, `findutils`, `jq`, `coreutils`, `python3`, `node`).
- **Audio Acquisition & Curation Engine**: `acquire_identity_audio.mjs`
  - Incompetech OpenAPI integration (`pieces.json`) for 180 studio-mastered royalty-free music beds (CC-BY 4.0 commercial TV broadcast license):
    - `news`: 45 tracks (tense, corporate, driving news beds)
    - `viral`: 45 tracks (upbeat, pop, comedy effects)
    - `faith`: 45 tracks (cinematic, peaceful, ambient cathedral organ & choir)
    - `lifestyle`: 45 tracks (jazz, acoustic, organic, lounge)
  - Curated CC0 1.0 & Openverse Freesound CDN proxy sound effects for 50 tracks:
    - `sfx`: 50 tracks (transitions, whooshes, sub-bass impacts, news tickers)
  - Total volume: 230 genuine audio files (.mp3 and .wav), perfectly satisfying the ~200-250 requirement.
  - Two-phase staging acquisition (download to `.staging/`, magic byte & size validation >= 4KB, atomic rename `mv`).
  - Generates `ATTRIBUTIONS.md` for commercial TV licensing compliance.
- **Acceptance Gate 1 (Inventory Validation Script)**: `validate-audio-inventory.sh`
  - Confirms existence of all 5 subdirectories inside `/opt/gsa-tv/cache/media/1/identity/audio/`: `news`, `viral`, `faith`, `lifestyle`, `sfx`.
  - Confirms >= 200 total audio files (.mp3, .wav, or .m4a) across the folders.
  - Rejects stub files (< 4KB).
- **Acceptance Gate 2 (Forensic Acoustic Verifier)**: `verify-audio-samples.sh`
  - Stratified random sampling: selects 10 random files across the 5 categories.
  - Inspects files using `file` and `ffprobe` (via native binary or Docker `gsa-tv/control-plane:1.7.2`).
  - Verifies audio stream parameters (valid audio codec, positive duration, sample rate, channels) and executes full `ffmpeg -v error -f null -` decode pass to confirm zero corruption.
- **Remote VPS Execution Runner**: `deploy-and-run-vps.mjs`
  - Connects to Oracle VPS (`147.15.43.141`) via SSH (`opc` with `ssh-key-2026-07-30.key`).
  - Syncs scripts to `~/teamwork_projects/audio_identity_builder`, triggers acquisition, and executes acceptance validation.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dependency & Environment Provisioning | Non-interactive installer (`ensure-dependencies.sh`) handling dnf/yum/apt and system packages on Oracle Linux | M1 | ORIGINAL_REQUEST §R3 |
| 2 | E2E Testing & Acceptance Harness | Validation script (`validate-audio-inventory.sh`) for layout & >= 200 files count, and acoustic verifier (`verify-audio-samples.sh`) for 10-sample ffprobe/file testing | M1 | ORIGINAL_REQUEST §ACCEPTANCE |
| 3 | Audio Acquisition & Curation Engine | Automated downloader (`acquire_identity_audio.mjs`) acquiring 230 tracks across 5 categories with staging & retries | M2 | ORIGINAL_REQUEST §R1, §R2 |
| 4 | VPS Execution & Directory Population | Execution of the pipeline on Oracle VPS (`147.15.43.141`), creating `/opt/gsa-tv/cache/media/1/identity/audio/{news,viral,faith,lifestyle,sfx}` with 230 files | M3 | ORIGINAL_REQUEST §R2, §R3 |
| 5 | E2E Validation, Hardening & Forensic Audit | Verification of all 5 directories, >= 200 files, 10-sample ffprobe validation, adversarial challenger verification, and Forensic Auditor verification | M4 | ORIGINAL_REQUEST §ACCEPTANCE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Test Infrastructure & Verification Harness | Implement `validate-audio-inventory.sh`, `verify-audio-samples.sh`, and test framework in `TEST_INFRA.md` & `TEST_READY.md` | none | DONE |
| 2 | M2: Audio Acquisition Engine & Provisioner | Implement `ensure-dependencies.sh`, `acquire_identity_audio.mjs`, and curation catalog for 230 tracks | none | DONE |
| 3 | M3: VPS Deployment & Asset Execution | Deploy scripts to VPS, run autonomous acquisition, populate `/opt/gsa-tv/cache/media/1/identity/audio/` with 230 audio files | M1, M2 | DONE |
| 4 | M4: E2E Verification & Forensic Integrity Audit | Run acceptance gates, verify 100% pass rate, adversarial challenger verification, and Forensic Auditor (`teamwork_preview_auditor`) check | M3 | DONE |

## Interface Contracts
### Master Runner ↔ Sub-scripts
- `ensure-dependencies.sh` ➔ exit 0 on dependencies satisfied (`ffmpeg`/`ffprobe`, `curl`, `file`, `jq`, `node`).
- `acquire_identity_audio.mjs` ➔ exit 0 on >= 200 tracks downloaded into `/opt/gsa-tv/cache/media/1/identity/audio/`.
- `validate-audio-inventory.sh` ➔ exit 0 when all 5 directories exist and total audio files >= 200.
- `verify-audio-samples.sh` ➔ exit 0 when 10 random samples pass `ffprobe` / `file` validation with zero corruption.

## Code Layout
- `infrastructure/gsa-tv/audio-identity/ensure-dependencies.sh` — Dependency installer.
- `infrastructure/gsa-tv/audio-identity/acquire_identity_audio.mjs` — Acquisition and staging engine.
- `infrastructure/gsa-tv/audio-identity/validate-audio-inventory.sh` — Acceptance Gate 1 validator.
- `infrastructure/gsa-tv/audio-identity/verify-audio-samples.sh` — Acceptance Gate 2 forensic acoustic validator.
- `infrastructure/gsa-tv/audio-identity/run-audio-identity-pipeline.sh` — Master pipeline coordinator.
- `infrastructure/gsa-tv/audio-identity/deploy-and-run-vps.mjs` — Remote SSH deployment and execution runner.
- `infrastructure/gsa-tv/audio-identity/test_audio_identity_e2e.mjs` — Master E2E test suite (24 tests).
- `infrastructure/gsa-tv/audio-identity/test_inventory_boundary_stress.mjs` — Challenger 1 stress harness (25 tests).
- `infrastructure/gsa-tv/audio-identity/acoustic-bitstream-challenger-stress.mjs` — Challenger 2 acoustic harness (30 tracks).
- `infrastructure/gsa-tv/audio-identity/ATTRIBUTIONS.md` — Licensing and broadcast credits documentation.
