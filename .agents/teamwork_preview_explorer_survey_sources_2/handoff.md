# Handoff Report — Audio Sources Survey for GSA TV Sonic Identity

**Agent**: teamwork_preview_explorer_survey_sources_2  
**Date**: 2026-09-04  
**Type**: Hard Handoff (Task Complete)  
**Destination**: `.agents/teamwork_preview_explorer_survey_sources_2/handoff.md`  
**Reference Document**: `.agents/teamwork_preview_explorer_survey_sources_2/audio_sources_report.md`

---

## 1. Observation

1. **Prompt Requirements**:
   - `ORIGINAL_REQUEST.md` (lines 122–148): Acquire 200–250 total audio tracks (~40–50 per category) organized into 5 subdirectories inside `/opt/gsa-tv/cache/media/1/identity/audio/`: `news`, `viral`, `faith`, `lifestyle`, and `sfx`. Formats: `.mp3`, `.wav`, or `.m4a`. System will run on an Oracle Linux VPS.
2. **Incompetech Catalog API**:
   - Endpoint `https://incompetech.com/music/royalty-free/pieces.json` returned a JSON array of 1,442 curated studio music pieces by Kevin MacLeod.
   - OpenAPI 3.0 specification at `https://incompetech.com/.well-known/openapi.yaml` confirms:
     `"An API for accessing Kevin MacLeod's music catalog, metadata, and licensing information. This documentation is designed for autonomous agents and AI tools."`
   - Direct download endpoint pattern `https://incompetech.com/music/royalty-free/mp3-royaltyfree/{filename}` tested with 15 random items from `pieces.json`: 15/15 returned `HTTP 200 OK`, `Content-Type: application/octet-stream`, byte size 2.5MB to 12.2MB.
   - Classification filter empirical test: Identified 466 News tracks, 366 Viral tracks, 99 Faith tracks, and 254 Lifestyle tracks. Sampling 45 tracks per category yielded 180 distinct studio-mastered tracks with zero collision.
3. **Openverse Audio API**:
   - Endpoint `https://api.openverse.org/v1/audio/?q={term}&license_type=commercial&format=json` was queried for `whoosh`, `impact`, `transition`, and `ticker`.
   - Returned HTTP 200 with direct streaming CDN URLs (e.g. `https://cdn.freesound.org/previews/351/351256_2247456-hq.mp3`). Direct HEAD request confirmed HTTP 200, `Content-Type: audio/mpeg`, byte length 69,196.
4. **Curated GitHub CC0 Audio Packs**:
   - Repository `romainsimon/uisfx`: Contains 936 procedural UI/cinematic sound effects in `packages/uisfx/sounds/`. `LICENSE-AUDIO` explicitly dedicates all audio files to CC0 1.0 Universal (Public Domain). Direct download test of `achievement.mp3` succeeded (12,581 bytes, HTTP 200).
   - Repository `Calinou/kenney-ui-audio`: Contains 50+ uncompressed WAV interface clicks and switches in `addons/kenney_ui_audio/` under CC0 1.0 Universal. Direct download test of `click1.wav` succeeded (18,254 bytes, HTTP 200).
5. **Defunct / Incompatible Platforms**:
   - FreePD.com: Web search confirmed the service has permanently closed.
   - Native Freesound API (`freesound.org/apiv2`): Returned `HTTP 401 Unauthorized: Authentication credentials were not provided.` (Openverse proxy avoids this completely).
   - Archive.org: The Free Music Archive mirror and Netlabels collection are predominantly licensed under `by-nc-nd` (NonCommercial NoDerivatives), creating legal infringement hazards for commercial broadcast television.
   - Musopen: Web interface enforces a 5-track daily download quota for free users.

---

## 2. Logic Chain

1. **Broadcast Television Licensing Constraint**:
   - Commercial TV networks (GSA TV) generate advertising and sponsorship revenues. Under international copyright law, broadcast transmission of Creative Commons material tagged `NC` (Non-Commercial) constitutes commercial infringement. Furthermore, audio beds must be edited, ducked, and looped behind voiceovers, which violates `ND` (No-Derivatives).
   - *Therefore*, all selected audio must be exclusively licensed under CC0 1.0 (Public Domain) or CC-BY 3.0/4.0 (Attribution allowed commercially with adaptations).

2. **Autonomous Execution Constraint**:
   - The acquisition script will run unattended on an Oracle Linux VPS.
   - *Therefore*, sources requiring OAuth, interactive logins, CAPTCHAs, or developer portal API keys (such as native Freesound, Spotify, or Jamendo dev tokens) must be rejected in favor of zero-auth open APIs (Incompetech OpenAPI, Openverse REST, and GitHub raw endpoints).

3. **Category and Volume Distribution**:
   - To achieve the required 200–250 total tracks across the 5 target categories (~40–50 each):
     - `news`: 45 tracks from Incompetech (`feel` = intense, suspenseful, driving, action).
     - `viral`: 45 tracks from Incompetech (`feel` = humorous, bouncy, bright pop).
     - `faith`: 45 tracks from Incompetech (`feel` = calm, mystical, serene choir/organ).
     - `lifestyle`: 45 tracks from Incompetech (`feel` = relaxed jazz, acoustic, lounge).
     - `sfx`: 50 tracks combining `uisfx` (20 cinematic/riser/whoosh MP3s), `Kenney UI Audio` (15 broadcast WAV clicks/tickers), and Openverse/Freesound CDN (15 whooshes/impacts/tickers).
   - *Total*: 180 music beds + 50 sound effects = 230 audio files. This precisely fulfills the 200–250 asset requirement.

---

## 3. Caveats

1. **Attribution Requirement for Incompetech**:
   - Kevin MacLeod's music is royalty-free and 100% legal for commercial TV broadcast, but requires attribution under CC-BY 4.0. The downstream script must generate an `ATTRIBUTIONS.md` ledger and include the standard credit line (`"Music by Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License"`).
2. **Local Bandwidth & Storage Footprint on VPS**:
   - 180 MP3 music tracks (~4–6 MB each) plus 50 SFX files (~0.1–1 MB each) will total approximately 900 MB – 1.1 GB of disk space. Ensure `/opt/gsa-tv/cache/media/` has at least 2 GB of free disk space.
3. **Download Throttling & Concurrency**:
   - When downloading 230 files from Incompetech and GitHub, the acquisition script should use a modest concurrency pool (e.g. 5 concurrent connections with a 100ms jitter delay) to avoid triggering Apache server rate limits or GitHub CDN throttling.

---

## 4. Conclusion

1. **Survey Complete**: The optimal, dependable, zero-auth audio acquisition architecture has been identified and empirically validated.
2. **Recommended Pipeline**:
   - Music beds (180 tracks): Incompetech OpenAPI catalog (`pieces.json`) filtered across `news` (45), `viral` (45), `faith` (45), and `lifestyle` (45).
   - Sound effects (50 tracks): UI SFX (`romainsimon/uisfx`), Kenney UI Audio (`Calinou/kenney-ui-audio`), and Openverse CDN proxy for `sfx` (50).
3. **Execution Ready**: Downstream builders can implement an autonomous script (`acquire_identity_audio.mjs` or `.py`) on Oracle Linux to download all 230 files into `/opt/gsa-tv/cache/media/1/identity/audio/` in under 3 minutes with zero human intervention.

---

## 5. Verification Method

To independently reproduce and verify these findings:

1. **Verify Incompetech Catalog & File Availability**:
   ```bash
   node -e "
   const https = require('https');
   https.get('https://incompetech.com/music/royalty-free/pieces.json', { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
     let d = ''; res.on('data', c => d += c);
     res.on('end', () => {
       const list = JSON.parse(d);
       console.log('Incompetech tracks available:', list.length);
     });
   });
   "
   # Output: 1442
   ```

2. **Verify Direct MP3 Download**:
   ```bash
   curl -s -I -H "User-Agent: Mozilla/5.0" "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Decisions.mp3" | grep -E "HTTP|content-length|content-type"
   # Output: HTTP/1.1 200 OK, content-length: 3544412
   ```

3. **Verify CC0 SFX Raw GitHub Download**:
   ```bash
   curl -s -I "https://raw.githubusercontent.com/romainsimon/uisfx/main/packages/uisfx/sounds/cinematic/achievement.mp3" | grep -E "HTTP|content-length"
   # Output: HTTP/2 200, content-length: 12581
   ```

4. **Verify Openverse Commercial SFX Query**:
   ```bash
   curl -s "https://api.openverse.org/v1/audio/?q=whoosh&license_type=commercial&page_size=1" | grep -o '"url":"[^"]*"'
   # Output: Direct Freesound CDN MP3 URL
   ```

5. **Report Inspection**:
   - Inspect full technical report at `.agents/teamwork_preview_explorer_survey_sources_2/audio_sources_report.md`.
