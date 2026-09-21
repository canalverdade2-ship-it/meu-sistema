# Handoff Report — Explorer 3: GSA Agro, Masters Package, and Changelog

## 1. Observation

1. **`masters-v1` Inventory & Properties**:
   - Directory: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/`
   - File count: Exactly 50 MP4 files (25 pairs of opening and closing).
   - Naming pattern: `gsa-<program>-opening.mp4` and `gsa-<program>-closing.mp4`.
   - Probed with `docker run --rm --user 0:0 -v /home:/home gsa-tv/control-plane:1.8.7 ffprobe`:
     - Every single file: H.264, 1920x1080, 30fps (`30/1`), duration exactly 10.000s, AAC 48,000 Hz, 2 channels (stereo).
     - File sizes: between 2,906,974 bytes and 9,112,423 bytes.
     - Checksums: all 50 recorded in `/home/opc/gsa-ai/work/identity-flow-20260907/SHA256SUMS-MASTERS-V1.txt`.
   - Origin script: `/home/opc/gsa-ai/work/identity-flow-20260907/build-gsa-masters.mjs` line 10 applied:
     `scale=2074:1167:force_original_aspect_ratio=increase,crop=1920:1080,setpts=1.25*PTS,fps=30,trim=duration=10,split[sharp][bl];[bl]crop=1100:700:410:190,gblur=sigma=18[bc];...`
     This slowed down audio/video and added blur + second logo overlay, which violated the visual standard.
   - Quality status from `GSA_TV_MEMORY_CHANGELOG.md` (lines 2400-2453) and `regen-defective-state.json`:
     - 41 original pieces have clean visuals (no defect from Flow).
     - 9 pieces were flagged with defects (synthetic text/logos: `PROGNAM`, `SABOE`, `TV SAFE watermark`, `duplicated BEM text`, etc.).

2. **Approved Regenerations**:
   - `gsa-esportes:closing`:
     - File: `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/esportes-closing-repl.mp4`
     - SHA-256: `db5a9055baf2c8cb18c6bb9b7f1e2bbbea6772f73e7d94556728c7cce31b2a22`
     - Size: 4,012,353 bytes
     - Flow ID: `6d4683fe-78b3-4e62-b7b1-6be20f570fbe`
     - Contact sheet: `/home/opc/gsa-ai/work/identity-flow-20260907/qc-replacements/esportes-closing-repl.jpg`
     - Raw properties: H.264, 1280x720, 24fps, 8.0s, AAC 48kHz stereo.
     - Status: `approved_visual_sample` in `regen-defective-state.json`.
   - `gsa-hora-da-palavra:opening`:
     - File: `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/hora-opening-repl-2.mp4`
     - SHA-256: `3eed26e249fe74ca3101d78663d8a47c74334f344c4cd8c25ac3fe39263980dc`
     - Size: 1,688,162 bytes
     - Flow ID: `6129ad61-df66-476a-b91d-9770bc515fb7`
     - Contact sheet: `/home/opc/gsa-ai/work/identity-flow-20260907/qc-replacements/hora-opening-repl-2.jpg`
     - Raw properties: H.264, 1280x720, 24fps, 8.0s, AAC 48kHz stereo.
     - Status: `approved_visual_sample` in `regen-defective-state.json`.

3. **GSA Agro Assets & Published Test**:
   - Published test file: `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-builder-teste-publicado.mp4`
     - Size: 259,095 bytes, 8.256s, 1280x720 30fps.
     - Why discarded: uses legacy static MP3 `/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/gsa-agro--apresentando.mp3`, uses old presenter voice instead of institutional voice `5c8a9b5d0b2549c7ada853529199ebe5` (`s2.1-pro-free`), only 720p, and uses defective opening.
   - Original opening: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/gsa-agro-opening.mp4` (defective with `TV AGRO / TV.Safe`).
   - Original closing: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/gsa-agro-closing.mp4` (clean, approved).
   - Regenerated opening: submitted in Flow (`2026-09-07T17:52:15.814Z ACCEPTED gsa-agro:opening` in `regen-defective.log`).
   - Program Builder: `/home/opc/gsa-program-builder/builder.py` lines 17 and 135-140 hardcode legacy bumper directory lookup.

4. **`masters-final/` & `manifest.json` Requirements**:
   - Target dir: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/` (does NOT exist yet).
   - Minimum count: at least 40 MP4s. Currently 43 approved MP4s (41 clean originals + 2 approved replacements) are available immediately; with the 7 pending regenerations, up to 50 MP4s will be available.
   - Exclusion: `GSA Entrevista` is explicitly excluded.
   - Format: H.264, 1920x1080, 30fps, AAC 48kHz stereo, duration 8s to 12s.
   - Manifest schema: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json` with keys `program`, `piece_type`, `source`, `sha256`, `approved_at`.

5. **`GSA_TV_MEMORY_CHANGELOG.md`**:
   - File has 2,453 lines. Latest entry: `## 2026-09-07 23:38 -03 — Reconciliação canônica das identidades após reprovação das remasterizações`.
   - Always requires creating a `.bak-<timestamp>-<slug>` backup before writing.

6. **VPS Tooling Issue**:
   - Host wrapper `/usr/local/bin/ffprobe` hardcodes missing container `gsa-tv/control-plane:1.7.2`. Calling directly via `docker run --rm --user 0:0 -v /home:/home gsa-tv/control-plane:1.8.7 ffprobe ...` is required.

## 2. Logic Chain

1. From inspection of `masters-v1/` and `master-manifest.json`, there are 25 programs x 2 pieces = 50 MP4s.
2. From inspection of `regen-defective-state.json` and `regen-defective.log`, 9 pieces had defects identified in initial Flow generation. 2 pieces have already been downloaded, audited, and approved (`esportes-closing-repl.mp4` and `hora-opening-repl-2.mp4`), while 7 remain pending in Flow.
3. Therefore, 41 pieces from `masters-v1` are original pieces with no defect. Adding the 2 approved replacements gives 43 approved pieces. This strictly satisfies the user acceptance criterion ("Diretório masters-final/ existe com pelo menos 40 MP4s (desconsiderando peças ainda em regeneração pendente)").
4. From inspection of `builder.py` and `ai_worker.mjs`, the Program Builder currently relies on static legacy MP3s in `/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/`. To fulfill R2 and R3, `builder.py` must invoke Fish Audio API (`https://api.fish.audio/v1/tts`, voice `5c8a9b5d0b2549c7ada853529199ebe5`, model `s2.1-pro-free`) using the encrypted vault key in `/home/opc/gsa-ai/secrets/fish-production.enc.json`.
5. From inspection of `masters-final/`, the directory does not exist yet. When created, raw 720p 24fps Flow replacements must be scaled cleanly to 1080p 30fps without blur or double logo overlay to match broadcast standards.

## 3. Caveats

- We did not download or execute CDP commands to extract the 7 pending regenerations from the live browser container `gsa-ai-browser`, as that belongs to Explorer 1 / implementer tasks.
- We did not modify any files on the VPS, adhering strictly to read-only investigation rules.
- GSA Entrevista is confirmed completely absent from `masters-v1` and must not be created.

## 4. Conclusion

- The baseline assets on the VPS are completely identified and mapped.
- 43 pieces (41 original clean + 2 approved replacements) are ready for packaging into `masters-final/` immediately, with the remaining 7 pending pieces in Flow ready for export and QC.
- The requirements for `masters-final/`, `manifest.json`, the refactoring of `builder.py` for Fish Audio, and the update procedure for `GSA_TV_MEMORY_CHANGELOG.md` are documented in detail in `report.md`.

## 5. Verification Method

To independently verify all findings on the VPS (`147.15.43.141`, `opc`), run:
1. Count and inspect `masters-v1`:
   ```bash
   ls -1 /home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/*.mp4 | wc -l # Expect 50
   ```
2. Verify the 2 approved replacements:
   ```bash
   sha256sum /home/opc/gsa-ai/work/identity-flow-20260907/replacements/esportes-closing-repl.mp4 /home/opc/gsa-ai/work/identity-flow-20260907/replacements/hora-opening-repl-2.mp4
   # Expect db5a9055baf2c8cb18c6bb9b7f1e2bbbea6772f73e7d94556728c7cce31b2a22
   # and    3eed26e249fe74ca3101d78663d8a47c74334f344c4cd8c25ac3fe39263980dc
   ```
3. Verify `masters-final/` non-existence:
   ```bash
   ls -d /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ # Expect No such file or directory
   ```
4. Verify builder bumper dependency:
   ```bash
   grep -n "BUMPERS =" /home/opc/gsa-program-builder/builder.py # Expect line 17
   ```
5. Verify changelog length and latest header:
   ```bash
   tail -n 30 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md | grep "^## " # Expect latest entry from 23:38 -03
   ```
