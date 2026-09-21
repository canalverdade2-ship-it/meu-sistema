# Handoff Report: GSA-TV Sonic Identity Pipeline Design & Acceptance Harness

**Agent:** teamwork_preview_explorer_survey_pipeline_3  
**Date:** 2026-09-04T19:33:00Z  
**Type:** Hard Handoff (Task Complete)  
**Deliverable File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_pipeline_3\pipeline_report.md`

---

## 1. Observation

1. **User Request Specifications (`.agents/ORIGINAL_REQUEST.md`, lines 114–149)**:
   - Header `## 2026-09-04T19:28:42Z`:
     > "Build an automation system to search, curate, and download a massive package of ~200-250 royalty-free background music tracks and sound effects. The assets must be organized into specific categorized folders (News, Viral, Faith, Lifestyle, SFX) on the GSA TV VPS to establish the network's official Sonic Identity." (lines 122–124)
   - Category layout requirement:
     > "The downloaded files must be organized into exactly these 5 subdirectories inside `/opt/gsa-tv/cache/media/1/identity/audio/`: `news`, `viral`, `faith`, `lifestyle`, `sfx`" (lines 132–139)
   - Acceptance Criteria:
     > "- [ ] The directories `news`, `viral`, `faith`, `lifestyle`, and `sfx` exist at the specified path." (line 146)  
     > "- [ ] A validation script (e.g., using `find` and `wc -l`) confirms there are at least 200 total audio files (.mp3, .wav, or .m4a) across the folders." (line 147)  
     > "- [ ] A verification script (using `ffprobe` or `file`) runs on a sample of 10 random files and confirms they are valid, non-corrupt audio files." (line 148)
   - Execution environment:
     > "The system will run on an Oracle VPS running Linux. You must write the logic and ensure dependencies are installed (e.g., via npm, pip, or apt) without manual user intervention." (line 141)

2. **Existing Storage Architecture (`docs/arquitetura-atual-gsa-tv.md`, lines 41–49 & `infrastructure/gsa-tv/scripts/setup-directories.sh`, lines 22–34)**:
   - Root storage path: `/opt/gsa-tv/cache/media/1/` with existing identity directory: `/opt/gsa-tv/cache/media/identity` (or `/opt/gsa-tv/cache/media/1/identity/`).
   - Ownership and permissions: standard user `gsa-tv:gsa-tv` with directory modes `0750` / `0755` and file mode `0644`.

3. **Existing Media Validation Conventions (`infrastructure/gsa-tv/scripts/preset-validate.sh`, lines 17–27 & `infrastructure/gsa-tv/services/playout-api/src/app.js`, lines 1752–1762)**:
   - `ffprobe -v error -print_format json -show_format -show_streams "$FILE"`
   - Extraction of `streams` where `codec_type == 'audio'` (`codec_name`, `sample_rate`, `channels`, `duration`).
   - Bitstream verification against corrupted files using `ffmpeg` null output (`-f null -`).

4. **Peer Explorer Division of Responsibilities (`.agents/teamwork_preview_orchestrator_16/BRIEFING.md`, lines 54–60)**:
   - `explorer_vps_1`: VPS environment, SSH, host configuration.
   - `explorer_sources_2`: Public domain / CC-BY audio APIs, licensing, candidate URLs.
   - `explorer_pipeline_3` (Current Agent): Pipeline architecture, directory layout, dependency automation, validation gate, forensic verification gate.

---

## 2. Logic Chain

1. **Premise 1 (Layout & Integrity)**: The prompt strictly requires the directory tree `/opt/gsa-tv/cache/media/1/identity/audio/{news,viral,faith,lifestyle,sfx}` and >= 200 valid `.mp3`, `.wav`, or `.m4a` files.
2. **Premise 2 (Zero Manual Intervention)**: The Oracle Linux VPS runs non-interactively; interactive prompts (like debconf or sudo password prompts) will cause automated pipelines to hang indefinitely. Therefore, the provisioning script (`ensure-dependencies.sh`) must detect whether `apt-get` or `dnf`/`yum` is present, export `DEBIAN_FRONTEND=noninteractive`, and check tool availability (`ffmpeg`, `curl`, `file`, `python3`) before executing package manager commands.
3. **Premise 3 (Network & Acquisition Resilience)**: Downloading 200+ media files across external CDNs frequently encounters network timeouts, rate limiting (HTTP 429), or HTML error pages disguised as audio files. Writing downloads directly into production folders risks polluting the inventory with corrupt or incomplete files.
4. **Inference 1 (Two-Phase Commit Architecture)**: An intermediate `.staging/` directory with a 3x exponential backoff download loop, MIME type header verification (`audio/*`), magic byte checking (ID3/RIFF), and atomic file moves (`mv`) guarantees that only 100% complete and valid audio files enter the 5 production folders.
5. **Inference 2 (Dual Acceptance Gates)**:
   - **Gate 1 (Inventory Validation Gate - `validate-audio-inventory.sh`)**: Performs structural traversal, checks base and category folders, tallies audio file counts per category, rejects files `< 4096 bytes` (anti-stub check), and enforces `TOTAL >= 200`.
   - **Gate 2 (Forensic Acoustic Gate - `verify-audio-samples.sh`)**: Performs stratified random sampling (2 files from each of the 5 categories = 10 files), parses audio stream parameters with `ffprobe` JSON (valid codec, positive duration, valid sample rate, valid channels), and executes an `ffmpeg -v error -i ... -f null -` full decode pass to guarantee zero bitstream corruption.
6. **Inference 3 (Master Orchestrator)**: Packaging these components into a single runner `run-audio-identity-pipeline.sh` enables Workers to execute the full pipeline end-to-end with deterministic exit codes (`0` on complete success, `1` on gate failure).

---

## 3. Caveats

1. **VPS Network Restrictions**: If the target Oracle VPS has strict egress firewall rules or lacks public internet access, audio downloads will require a proxy or pre-bundled archive. This depends on `explorer_vps_1`'s survey of network connectivity.
2. **Source Availability**: The exact source URLs and API endpoints are being surveyed by `explorer_sources_2`. The pipeline architecture designed here accepts any source format as long as it delivers valid audio payloads.
3. **Hardware Acceleration**: The pipeline relies purely on CPU decoding for `ffprobe` and `ffmpeg -f null -`, which requires negligible CPU overhead for 10 audio files (typically < 1.5 seconds total runtime).

---

## 4. Conclusion

The pipeline design and dual acceptance harness specifications are complete, robust, and fully documented in `.agents/teamwork_preview_explorer_survey_pipeline_3/pipeline_report.md`.

The deliverable includes:
1. Complete layout specifications and category sonic profiles for `/opt/gsa-tv/cache/media/1/identity/audio/{news,viral,faith,lifestyle,sfx}`.
2. Autonomous, non-interactive dependency installer script (`ensure-dependencies.sh`) compatible with both Debian/Ubuntu and Oracle Linux/RHEL.
3. Resilient acquisition engine design with two-phase staging, exponential backoff retries, magic byte validation, and SHA-256 deduplication.
4. Full executable source code for **Acceptance Gate 1 (`validate-audio-inventory.sh`)** verifying layout and enforcing `>= 200` valid audio files.
5. Full executable source code for **Acceptance Gate 2 (`verify-audio-samples.sh`)** performing deep forensic `ffprobe` acoustic analysis and `ffmpeg` bitstream corruption checks on 10 stratified samples.
6. Master pipeline runner (`run-audio-identity-pipeline.sh`) providing end-to-end coordination.

---

## 5. Verification Method

To independently verify the designs and scripts provided in `pipeline_report.md`:

1. **Inspect Artifact File**:
   View the complete specification report:
   ```bash
   view_file .agents/teamwork_preview_explorer_survey_pipeline_3/pipeline_report.md
   ```
2. **Syntax and Logic Inspection**:
   - Verify `validate-audio-inventory.sh` correctly checks all 5 categories (`news`, `viral`, `faith`, `lifestyle`, `sfx`), counts `.mp3`, `.wav`, `.m4a`, rejects `< 4KB` files, and exits with code `0` only when total `>= 200`.
   - Verify `verify-audio-samples.sh` invokes `ffprobe -v error -show_streams -show_format -of json`, decodes audio streams, checks `duration > 0.0`, `sample_rate`, `channels`, and runs `ffmpeg -v error -i ... -f null -`.
3. **Invalidation Conditions**:
   - The design would be invalidated if the acceptance threshold were allowed to pass with `< 200` audio files.
   - The design would be invalidated if corrupt or 0-byte stub files could bypass the validation gate.
   - The design would be invalidated if dependency installation required interactive user prompts on Linux VPS.
