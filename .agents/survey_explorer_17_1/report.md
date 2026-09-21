# Comprehensive Investigation Report: Google Flow CDP & 7 Regenerations

**Date**: 2026-09-08T03:02:00Z  
**Author**: Survey Explorer 1  
**Target VPS**: `147.15.43.141` (`gsa-server-pro`, user `opc`)  
**Assignment**: DISPATCH.md & ORIGINAL_REQUEST.md (## 2026-09-08T02:46:22Z)

---

## Executive Summary

1. **Docker Container `gsa-ai-browser`**: Active and healthy (`Up 3 days`, image `gsa-ai-gsa-ai-browser`). Mapped ports: `127.0.0.1:6088->6080/tcp` (noVNC) and `127.0.0.1:9228->9223/tcp` (Chrome DevTools Protocol - CDP).
2. **CDP Endpoint**: Fully responsive at `http://127.0.0.1:9228`. Chrome 151.0.7922.173. The target Google Flow project (`ac1da714-fe03-4812-b62d-fb92d575e554`) is open.
3. **State of the 7 Google Flow Regenerations**:
   - All 7 defective targets were submitted to Google Flow on 2026-09-07T17:48 to 17:53 UTC.
   - Direct DOM inspection via CDP confirms that **all 7 videos are 100% rendered and present at the top of the Google Flow grid (indices 0 to 6)**.
   - None are currently in generating status or marked with generation errors.
4. **Current Blocking Step for Export/Download**:
   - The Google account session for `flow.google.com` in Chrome experienced token expiry, preventing video blob playback and signed URL extraction.
   - The account `adriano9865@gmail.com` is preserved in the browser (`https://accounts.google.com/v3/signin/accountchooser`), and automated login credentials are encrypted at `/home/opc/gsa-ai/secrets/google-production.enc.json`.
   - Re-authenticating via `/home/opc/gsa-ai/bin/google-session-login.js` (navigating to `https://accounts.google.com/`) will restore the session and allow direct export.
5. **Existing Scripts & QC Pipeline**:
   - Video extraction pattern: `work/identity-flow-20260907/flow-export-project.cjs` opens tile previews and extracts signed CDN URLs (`video.main-video.src`).
   - Tools: `/usr/local/bin/ffmpeg` and `/usr/local/bin/ffprobe` are installed on the host.
   - Contact sheets scripts: `qc-gsa-masters.mjs` and `qc-flow-candidates.mjs` contain proven FFmpeg filters (`xstack` / `-ss 1`, `-ss 5`, `-ss 9`) to generate 1s, 5s, 9s contact sheets.
   - Directory `/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen/` is pending creation once downloads commence.

---

## 1. Docker Container & CDP Endpoint Status

### Docker Status
```bash
CONTAINER ID   IMAGE                   COMMAND                  CREATED      STATUS      PORTS                                                NAMES
51cc1d209dde   gsa-ai-gsa-ai-browser   "/usr/local/bin/star…"   6 days ago   Up 3 days   127.0.0.1:6088->6080/tcp, 127.0.0.1:9228->9223/tcp   gsa-ai-browser
```

### CDP Version (`curl -s http://127.0.0.1:9228/json/version`)
```json
{
   "Browser": "Chrome/151.0.7922.173",
   "Protocol-Version": "1.3",
   "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
   "V8-Version": "15.1.206.23",
   "WebKit-Version": "537.36 (@a96602f30358e9b5d256a0464e7e4d4bec223004)",
   "webSocketDebuggerUrl": "ws://127.0.0.1:9228/devtools/browser/0b50a8a0-52c3-4e3b-8ffb-4ff558dd9dc9"
}
```

### Active Pages in Browser (`curl -s http://127.0.0.1:9228/json/list`)
1. `88927F65A348100EB11B7D5635B9A9F7` — `Google Flow: set. 07 - 09:15` (`https://flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554`)
2. `DAB08997F7118F6CDE4DABD31269DD41` — `Google Flow: GSA Mercado — Identidade Oficial — Flow — 2026-09-07` (`https://flow.google.com/project/5bab07f8-bed9-43e6-aae8-d05f735e4e0c`)
3. `A683DEC7670E92DE75A0A3C5C2D47301` — `GSA TV - AO VIVO - YouTube` (`https://www.youtube.com/watch?v=soeRG2L70ys`)
4. `3BFD520A0D42AC3E389479CAE04CD440` — `GSA TV — Chamada da Grade V2 — Master 85s - Google Vids`
5. `5037349056387D9E08BCFAD6BF76F581` — `GSA TV — Chamada Oficial da Grade de Programação - Google Vids`

---

## 2. Analysis of `regen-defective-state.json` & Regeneration History

- **Exact File Path**: `/home/opc/gsa-ai/work/identity-flow-20260907/regen-defective-state.json`
- **Associated Log**: `/home/opc/gsa-ai/work/identity-flow-20260907/regen-defective.log`
- **Target Google Flow Project**: `ac1da714-fe03-4812-b62d-fb92d575e554`

### Status of the 9 Identified Defective Targets:

| # | Program & Piece | Defect in Original Master | Status in `regen-defective-state.json` | Physical Asset / Location |
|---|---|---|---|---|
| 1 | `gsa-esportes:closing` | Invented text `PROGNAM` | **Approved** | `replacements/esportes-closing-repl.mp4` (`6d4683fe...`) |
| 2 | `gsa-hora-da-palavra:opening` | Synthetic watermark `TV SAFE` | **Approved** | `replacements/hora-opening-repl-2.mp4` (`6129ad61...`) |
| 3 | `gsa-sabor:opening` | Invented typography `SABOE` | Submitted 17:48:17Z | Rendered in Flow, awaiting download/QC |
| 4 | `gsa-bem-viver:closing` | Duplicated `BEM` typography | Submitted 17:48:38Z | Rendered in Flow, awaiting download/QC |
| 5 | `gsa-em-fe:closing` | Foreign watermark / corner marks | Submitted 17:51:53Z | Rendered in Flow, awaiting download/QC |
| 6 | `gsa-agro:opening` | Synthetic watermark `TV AGRO / TV.Safe` | Submitted 17:52:15Z | Rendered in Flow, awaiting download/QC |
| 7 | `gsa-motor:opening` | Hallucinated text `PROGRAM` | Submitted 17:52:37Z | Rendered in Flow, awaiting download/QC |
| 8 | `gsa-news-noite:opening` | Hallucinated text `NEWS PROGRAM` | Submitted 17:53:00Z | Rendered in Flow, awaiting download/QC |
| 9 | `gsa-business:opening` | Synthetic watermark `TV SAFE` | Submitted 17:53:24Z | Rendered in Flow, awaiting download/QC |

*Note: In addition, one experimental generation for Hora da Palavra (`68815c97-739e-4404-8eaf-e58ff22d8817`) was rejected and recorded in `rejected_replacements` due to invented text `PROGUUAC / PROGRECOM`.*

---

## 3. DOM & State Verification of Google Flow Grid

A live Puppeteer query against project `ac1da714-fe03-4812-b62d-fb92d575e554` through CDP retrieved the top tiles:

```json
[
  { "idx": 0, "aria": "GSA Business official opening br…", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 1, "aria": "GSA News Noite opening broadcast", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 2, "aria": "GSA Motor official opening broad…", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 3, "aria": "GSA Agro official opening broadcast", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 4, "aria": "GSA Em Fé closing broadcast", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 5, "aria": "GSA Bem Viver official closing", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 6, "aria": "GSA Sabor official opening broad…", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 7, "aria": "GSA Hora da Palavra opening", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 8, "aria": "Television broadcast opening vis…", "hasVideo": true, "hasError": false, "isGenerating": false },
  { "idx": 9, "aria": "GSA Esportes closing broadcast i…", "hasVideo": true, "hasError": false, "isGenerating": false }
]
```

**Direct Finding**:
The 7 pending regenerations correspond exactly to tiles **idx 0 through 6** in reverse submission order (most recent first):
- **Idx 0**: `gsa-business:opening`
- **Idx 1**: `gsa-news-noite:opening`
- **Idx 2**: `gsa-motor:opening`
- **Idx 3**: `gsa-agro:opening`
- **Idx 4**: `gsa-em-fe:closing`
- **Idx 5**: `gsa-bem-viver:closing`
- **Idx 6**: `gsa-sabor:opening`

All 7 have completed rendering on the Google Flow backend.

---

## 4. Root Cause of Current Export Blocker & Resolution Path

### Root Cause
When inspecting tile previews, the browser displayed:
`"Falha: Houve uma falha ao carregar o vídeo"`
Navigating to `flow.google.com` redirected to `https://flow.google.com/about` with a `Sign in` link pointing to Google Accounts.
The Google session cookies (`OSID`, `SID`, `HSID`) have expired in Chromium, invalidating CDN authentication tokens for video streaming.

### Account State in Chromium
Checking `https://accounts.google.com/` via CDP confirms:
- **Account exists**: `Adriano Farias` (`adriano9865@gmail.com`) is present on the Google Account Chooser screen (`Signed out`).
- **Encrypted credentials**: `/home/opc/gsa-ai/secrets/google-production.enc.json` is present.
- **Decryption key**: `sudo docker exec gsa-tv-control-plane printenv GSA_TV_SECRET_KEY` provides the AES-256-GCM key.
- **Login script**: `/home/opc/gsa-ai/bin/google-session-login.js` implements the programmatic login.

### Resolution Steps for Downstream Implementer:
1. Ensure the browser navigates to `https://accounts.google.com/` (where `adriano9865@gmail.com` is listed in the account chooser).
2. Execute `/home/opc/gsa-ai/bin/google-session-login.js` or run the account click + password submission snippet.
3. Once `AUTH_OK` is reached, navigate back to `https://flow.google.com/project/ac1da714-fe03-4812-b62d-fb92d575e554`.
4. Run the export routine (`flow-export-project.cjs` pattern) to click `.pre-hover-overlay` on tiles 0-6, read `video.main-video.src`, and fetch each MP4 into `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/`.

---

## 5. QC Infrastructure & Downstream Pipeline

### QC Tools Verified
- **FFmpeg**: `/usr/local/bin/ffmpeg` (host) and Docker `gsa-tv/control-plane:1.7.9`
- **FFprobe**: `/usr/local/bin/ffprobe` (host) and Docker `gsa-tv/control-plane:1.7.9`

### Contact Sheet Generation Commands
To satisfy the acceptance criteria (contact sheets at 1s, 5s, 9s saved in `/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen/`):
```bash
mkdir -p /home/opc/gsa-ai/work/identity-flow-20260907/qc-regen

# Single 3-frame horizontal contact sheet per piece:
ffmpeg -y \
  -ss 1 -i "$VIDEO_FILE" \
  -ss 5 -i "$VIDEO_FILE" \
  -ss 9 -i "$VIDEO_FILE" \
  -filter_complex "[0:v]scale=640:360[v0];[1:v]scale=640:360[v1];[2:v]scale=640:360[v2];[v0][v1][v2]hstack=inputs=3[out]" \
  -map "[out]" -frames:v 1 "/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen/${SLUG}-${KIND}-contact.jpg"
```

### Technical Acceptance Standards (`ffprobe`)
- Format: MP4
- Video: H.264, 1920x1080, 30.0 fps (or `30/1`), `yuv420p`
- Audio: AAC stereo, 48000 Hz, duration 8.0s to 12.0s

### Visual Acceptance Rules (Strict Enforcement)
- **Approved**: Only pieces with clean motion resolving to the official attached program logo, without extra text.
- **Rejected**: Any piece showing hallucinated text (`PROGRAM`, `NEWS PROGRAM`, `SABOE`, `TV SAFE`, `TV.Safe`), duplicated titles, or synthetic secondary logos.

---

## 6. Program Builder & Fish Audio Locution Survey

1. **Program Builder Location**: `/home/opc/gsa-program-builder/builder.py`
   - Line 17 currently references:
     `BUMPERS = Path('/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered')`
   - Uses `--apresentando.mp3` and `--de-volta.mp3`.
   - Must be updated to generate continuity bumpers via Fish Audio API.
2. **Fish Audio Configuration**:
   - Worker reference: `/opt/gsa-tv/ai-worker/ai_worker.mjs`
   - Endpoint: `https://api.fish.audio/v1/tts`
   - Voice ID: `5c8a9b5d0b2549c7ada853529199ebe5` (Institutional Voice / Commercial Impact)
   - Model: `s2.1-pro-free`
   - Formats: Conformed to 48kHz stereo, ~5s with fade in/out.
3. **GSA Agro Test**:
   - Defective test: `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-builder-teste-publicado.mp4` (and `/home/opc/gsa-program-builder/output/gsa-agro-builder-teste.mp4`).
   - Must be discarded and re-rendered with new Fish locution and regenerated Flow opening.
