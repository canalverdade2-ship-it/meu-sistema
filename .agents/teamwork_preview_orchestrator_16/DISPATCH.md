# Dispatch Log

## 2026-09-04T19:29:36Z

Project Mission:
Build an automation system to search, curate, and download a massive package of ~200-250 royalty-free background music tracks and sound effects. The assets must be organized into specific categorized folders (News, Viral, Faith, Lifestyle, SFX) on the GSA TV VPS to establish the network's official Sonic Identity.

Requirements:
1. Audio Acquisition: Autonomous finding and downloading of high-quality, royalty-free audio files (music beds and sound effects) suitable for professional television broadcasting.
2. Categorization and Storage: Organize downloaded files into exactly 5 subdirectories inside `/opt/gsa-tv/cache/media/1/identity/audio/`:
   - news (tense, corporate, hard news beds)
   - viral (upbeat, pop, comedy effects)
   - faith (cinematic, peaceful, ambient)
   - lifestyle (jazz, acoustic, organic)
   - sfx (transitions, whooshes, impacts, tickers)
3. Environment: Runs on Oracle VPS running Linux. Autonomous installation of dependencies (npm, pip, or apt).
4. Acceptance criteria:
   - Directories news, viral, faith, lifestyle, and sfx exist at specified path.
   - Validation script confirms >= 200 total audio files (.mp3, .wav, or .m4a) across the folders.
   - Verification script runs on a sample of 10 random files and confirms they are valid, non-corrupt audio files via ffprobe/file.
