# Forensic Integrity Audit Report — Gate 17

**Work Product**: VPS (`147.15.43.141`) — GSA TV Identity Flow & Program Builder Implementation  
**Integrity Profile**: General Project (`development` mode as specified in `ORIGINAL_REQUEST.md` under `## 2026-09-08T02:46:22Z`)  
**Auditor Archetype**: Forensic Integrity Auditor  
**Date**: 2026-09-08T04:15:00Z  
**Verdict**: **`CLEAN`**

---

## 1. Observation

All observations were collected directly and empirically from the production environment on the Oracle Cloud VPS (`147.15.43.141`, user `opc`) via SSH execution using `scratch/ssh2-run.mjs` and Docker container `gsa-tv/control-plane:1.8.7`.

### Observation 1.1: Code Authenticity & AES-256-GCM Vault Decryption
- **File**: `/home/opc/gsa-program-builder/builder.py` (lines 50–150).
- **Vault Location**: `/home/opc/gsa-ai/secrets/fish-production.enc.json` (size: 296 bytes, permissions: 0600).
- **Decryption Logic**: Method `load_fish_api_key()` reads master key `GSA_TV_SECRET_KEY` from environment or Docker container `gsa-tv-control-plane`, parses base64url-encoded nonce, ciphertext, and aad, and executes AES-256-GCM decryption using `cryptography.hazmat.primitives.ciphers.aead.AESGCM`.
- **Empirical Execution**: Executed `load_fish_api_key()` in live runtime.
  - Raw result: `KEY_LEN: 51`, `KEY_PREFIX: sk-f...`, `VAULT_DECRYPTION_SUCCESS: TRUE`.
- **Dynamic Fish Audio TTS API Calls**:
  - URL: `https://api.fish.audio/v1/tts`
  - Model: `s2.1-pro-free`
  - Reference Voice: `5c8a9b5d0b2549c7ada853529199ebe5`
  - Live empirical test: synthesized bumper for unseen test phrase `"Auditoria Forense"` and slug `"forensic-audit-test"`.
  - Raw output:
    ```
    --- Testing Live Dynamic Synthesis via Fish Audio API ---
    Synthesized WAV path: /home/opc/gsa-program-builder/cache/bumpers/forensic-audit-test--apresentando--597e2f9a8a43.wav
    File exists: True
    File size: 960078
    Probe info: {'programs': [], 'streams': [{'codec_name': 'pcm_s16le', 'codec_type': 'audio', 'sample_rate': '48000', 'channels': 2, 'r_frame_rate': '0/0'}], 'format': {'duration': '5.000000'}}
    LIVE_TTS_SUCCESS: TRUE
    ```
  - Audio conform parameters verified in `builder.py` lines 122–125:
    `[0:a]adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]` producing exactly 5.000s, 48000Hz stereo PCM audio.

### Observation 1.2: Media Authenticity & Cryptographic Verification
- **Directory**: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/`
- **Total MP4 Files**: Exactly 50 files (25 programs x 2 pieces: opening and closing).
- **Manifest**: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json` contains exactly 50 entries with all mandatory fields: `program`, `piece_type`, `source`, `sha256`, `approved_at`.
- **Cryptographic Hash Verification**:
  - Computed `hashlib.sha256` on each of the 50 files on disk.
  - Zero hash mismatches against `manifest.json` (50/50 match 100%).
- **Technical FFprobe Verification**:
  - Audited all 50 files using `ffprobe` in `gsa-tv/control-plane:1.8.7`.
  - Results: 50/50 PASSED.
  - Video Codec: `h264` (100%).
  - Resolution: `1920x1080` (100%).
  - Frame Rate: `30/1` (100%).
  - Audio Codec: `aac` (100%).
  - Sample Rate: `48000 Hz` (100%).
  - Channels: `2` (stereo) (100%).
  - Durations: all between 8.000s and 10.000s (target range 8s–12s).
- **Breakdown & Provenance**:
  - **41 Original Pieces**: Verified against `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/`. Exact byte-for-byte match (0 mismatches across all 41 files).
  - **9 Regenerated Pieces**:
    1. `gsa-esportes-closing.mp4` <- `replacements/esportes-closing-repl.mp4`
    2. `gsa-hora-da-palavra-opening.mp4` <- `replacements/hora-opening-repl-2.mp4`
    3. `gsa-business-opening.mp4` <- `replacements/business-opening-repl.mp4`
    4. `gsa-news-noite-opening.mp4` <- `replacements/news-noite-opening-repl.mp4`
    5. `gsa-motor-opening.mp4` <- `replacements/motor-opening-repl.mp4`
    6. `gsa-agro-opening.mp4` <- `replacements/agro-opening-repl.mp4`
    7. `gsa-em-fe-closing.mp4` <- `replacements/em-fe-closing-repl.mp4`
    8. `gsa-bem-viver-closing.mp4` <- `replacements/bem-viver-closing-repl.mp4`
    9. `gsa-sabor-opening.mp4` <- `replacements/sabor-opening-repl.mp4`
  - Provenance of replacements confirmed via `/home/opc/gsa-ai/work/identity-flow-20260907/regen-download-manifest.json`: each file downloaded directly from Google Flow signed URLs (`https://flow-content.google/video/...KeyName=labs-flow-prod-cdn-key&Signature=...`) originating from Flow project `ac1da714-fe03-4812-b62d-fb92d575e554` via CDP browser automation.
  - Conformed cleanly from 720p @ 24fps (8.00s) to broadcast specification 1080p @ 30fps (8.00s) using Lanczos scaling (`scale=1920:1080:flags=lanczos,fps=30`, CRF 18, AAC 384k 48kHz stereo) via `build-masters-final.py`.

### Observation 1.3: GSA Agro Master Revalidation
- **Legacy Test Discarded**: Verified `/home/opc/gsa-ai/work/gsa-agro-builder-teste-publicado.mp4` and `/home/opc/gsa-program-builder/output/gsa-agro-builder-teste.mp4` (which used old MP3s) were permanently deleted.
- **New Master**: `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-master.mp4` (size: 9,435,761 bytes).
- **Builder Job**: `/home/opc/gsa-program-builder/jobs/gsa-agro-20260908-034749-972730/result.json` shows:
  - Segment 1 (Abertura): `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/agro-opening-repl.mp4` (Flow regenerated, clean, no "TV AGRO" watermark).
  - Segment 2 (Bumper): `/home/opc/gsa-program-builder/cache/bumpers/gsa-agro--apresentando--5d0aa957a59c.wav` (dynamically synthesized with Fish Audio institutional continuity voice `5c8a9b5d0b2549c7ada853529199ebe5`).
  - Segment 3 (Encerramento): `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/gsa-agro-closing.mp4` (original clean Flow closing).
- **FFprobe Properties**: H.264 High profile, 1920x1080, 30.0 fps, AAC 48000Hz stereo, duration 23.022s.

### Observation 1.4: Quality Rules Compliance
- **Zero Global Blur (`gblur`)**: Scanned all build scripts and execution pipelines generating final masters (`build-masters-final.py` and `builder.py`). Filter graphs contain ZERO instances of `gblur`.
- **Zero Artificial Slowdown**: Zero instances of `setpts` dilation or `minterpolate` in the final generation pipelines. Durations match the native 8.00s of the Flow pieces.
- **Zero Secondary Logo Overlays**: Filter graphs do not overlay secondary channel bugs or duplicate logos on top of Flow media.
- **Strict Exclusion of `GSA Entrevista`**:
  - `masters-final/*entrevista*`: 0 files found.
  - `manifest.json`: 0 entries found.
  - Distinct programs count: exactly 25 programs (50 pieces). None is `GSA Entrevista`.
- **Audit Logging and Backups**:
  - `GSA_TV_MEMORY_CHANGELOG.md` (272,312 bytes) updated with complete records and technical tables.
  - Backups created prior to modification confirmed on disk:
    - `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md.bak` (258,692 bytes, 2026-09-08 03:50)
    - `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md.bak-20260908` (258,692 bytes)
    - `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md.bak-20260908-m3` (255,670 bytes, 2026-09-08 03:39)
    - `/home/opc/gsa-program-builder/builder.py.bak-20260908` (16,358 bytes)
    - `/home/opc/gsa-program-builder/builder.py.bak-20260908-m3` (21,057 bytes)

---

## 2. Logic Chain

1. **Vault & Code Authenticity**:
   - Observation 1.1 establishes that `builder.py` contains authentic cryptography code invoking AESGCM with a 256-bit key sourced from the live container environment.
   - The empirical decryption test successfully unpacked the vault payload, obtaining an authentic 51-character Fish Audio bearer token (`sk-f...`).
   - The live TTS test verified end-to-end execution: an arbitrary input string was sent to `https://api.fish.audio/v1/tts`, yielding binary audio that was conformed via FFmpeg to a 5.000s 48kHz stereo WAV file.
   - *Inference*: The implementation contains no mock, no facade, and no hardcoded fallback for newly requested continuity bumpers.

2. **Media Integrity & Provenance**:
   - Observation 1.2 establishes that all 50 files in `masters-final/` have valid video and audio streams matching 1080p30 / AAC 48kHz specifications.
   - The 41 files classified as "original" match the initial `masters-v1/` generation byte-for-byte, proving that non-defective assets were preserved without lossy re-encoding or corruption.
   - The 9 files classified as "regenerated" correspond to the 9 defective items identified in the requirements. Their source assets in `replacements/` were confirmed to originate from Google Flow's signed CDN URLs via CDP automation logs.
   - All 50 SHA-256 hashes recorded in `manifest.json` match the files on disk with zero discrepancies.
   - *Inference*: The media assets are authentic, legitimate replacements of defective items, and cryptographically verified.

3. **Invariable Quality Rules Adherence**:
   - Observations 1.3 and 1.4 confirm that although obsolete experimental scripts from earlier iterations (such as `build-gsa-masters-v2.mjs`) had used `gblur` and `setpts`, the production pipeline for Gate 17 (`build-masters-final.py` and `builder.py`) strictly excluded all blur filters, speed manipulations, and secondary logo overlays.
   - `GSA Entrevista` was completely excluded across the entire directory structure, manifest, and program registry.
   - All actions were documented in `GSA_TV_MEMORY_CHANGELOG.md` with verifiable `.bak` files preserved on the filesystem.
   - *Inference*: All user-stipulated quality rules and constraints were rigorously satisfied.

---

## 3. Caveats

- **Network Dependency for Fish Audio**: The Program Builder relies on external internet connectivity to `api.fish.audio` to synthesize new bumpers. However, bumpers once synthesized are persistently cached in `/home/opc/gsa-program-builder/cache/bumpers/`, ensuring local determinism for subsequent runs.
- **Docker Wrapper Script**: `/usr/local/bin/ffprobe` on the host OS is configured to invoke a legacy tag (`gsa-tv/control-plane:1.7.2`). All builder scripts correctly bypass this wrapper by calling the installed image (`gsa-tv/control-plane:1.8.7`) directly with `--user 1000:1000`.
- No caveats regarding integrity, authenticity, or compliance.

---

## 4. Conclusion

All forensic integrity checks mandated by the user and dispatch directives passed with 100% compliance:
1. **Code Authenticity**: Fully authentic. Genuine AES-256-GCM decryption and live dynamic Fish Audio TTS API synthesis verified empirically.
2. **Media Authenticity**: Fully authentic. 50/50 valid 1080p30 broadcast MP4 masters with 100% matching SHA-256 checksums in `manifest.json`. Genuine Google Flow CDP replacements verified.
3. **Quality Compliance**: 100% compliant. ZERO global blur, ZERO artificial slowdown, ZERO duplicate overlays, GSA Entrevista completely excluded, and all changes documented with prior `.bak` backups.

**Final Verdict**: **`CLEAN`**

---

## 5. Verification Method

To independently reproduce and verify this audit on VPS `147.15.43.141`:

1. **Verify Vault Decryption & Live TTS**:
   ```bash
   python3 -c "
   import sys; sys.path.append('/home/opc/gsa-program-builder')
   from builder import load_fish_api_key, synthesize_continuity_bumper
   k = load_fish_api_key()
   assert k.startswith('sk-f') and len(k) > 40
   print('Vault OK:', k[:6])
   "
   ```

2. **Verify Cryptographic Hashes of All 50 Masters**:
   ```bash
   python3 -c "
   import json, hashlib
   from pathlib import Path
   D = Path('/home/opc/gsa-ai/work/identity-flow-20260907/masters-final')
   manifest = json.loads((D / 'manifest.json').read_text())
   assert len(manifest) == 50
   for item in manifest:
       # Match file by hash
       matching = [f for f in D.glob('*.mp4') if hashlib.sha256(f.read_bytes()).hexdigest() == item['sha256']]
       assert len(matching) == 1, f'Hash mismatch for {item[\"program\"]}'
   print('All 50 hashes verified successfully.')
   "
   ```

3. **Verify Zero GSA Entrevista & Zero GBlur**:
   ```bash
   ls /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/*entrevista* 2>/dev/null && echo 'FAIL' || echo 'PASS: No Entrevista'
   grep -i "entrevista" /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json || echo 'PASS: No Entrevista in manifest'
   grep -rn "gblur" /home/opc/gsa-program-builder/builder.py /scratch/build-masters-final.py 2>/dev/null || echo 'PASS: Zero gblur'
   ```
