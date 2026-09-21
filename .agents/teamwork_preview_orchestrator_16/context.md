# Context Briefing for teamwork_preview_orchestrator_16

## Original User Request
Refer to `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` under header `## 2026-09-04T19:28:42Z`.

## Task Summary
Build an automation system to search, curate, and download a massive package of ~200-250 royalty-free background music tracks and sound effects. The assets must be organized into specific categorized folders (News, Viral, Faith, Lifestyle, SFX) on the GSA TV VPS to establish the network's official Sonic Identity.

### Requirements:
- R1. Audio Acquisition: Autonomous finding and downloading of high-quality, royalty-free audio files (music beds and SFX) suitable for television broadcasting.
- R2. Categorization and Storage: Organized into 5 subdirectories: `news`, `viral`, `faith`, `lifestyle`, `sfx` inside `/opt/gsa-tv/cache/media/1/identity/audio/`.
- R3. Environment: Runs on Oracle VPS running Linux. Logic and dependencies installed autonomously without manual intervention.

### Acceptance Criteria:
- Directories `news`, `viral`, `faith`, `lifestyle`, and `sfx` exist at the specified path.
- Validation script confirms >= 200 total audio files (.mp3, .wav, or .m4a) across folders.
- Verification script runs `ffprobe` or `file` on a sample of 10 random files confirming valid, non-corrupt audio.

## Working Directory
`.agents/teamwork_preview_orchestrator_16`
