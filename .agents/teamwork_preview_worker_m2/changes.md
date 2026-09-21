# Changes Log — Worker M2: Program Builder Fish Audio Integration

**Worker:** M2 (Program Builder Fish Audio Integration)  
**Date:** 2026-09-08T03:10:00Z  
**Target Environment:** Oracle VPS Linux (`147.15.43.141:22`), user `opc`  

---

## 1. Summary of Changes

| Target File | Change Summary | Rationale |
|---|---|---|
| `/home/opc/gsa-program-builder/builder.py` | Added AES-256-GCM in-memory decryption for Fish Audio credentials vault (`load_fish_api_key`), dynamic Fish Audio TTS synthesis function (`synthesize_continuity_bumper`) using model `s2.1-pro-free` and voice ID `5c8a9b5d0b2549c7ada853529199ebe5`, FFmpeg conforming filter for broadcast standard 48kHz stereo 5.0s audio with fade-in/out and EBU R128 loudness normalization, local disk cache in `CACHE / 'bumpers'`, updated `bumper_path` to use dynamic synthesis with fallback, and updated `programs` CLI listing. | Resolves root cause of outdated/inappropriate bumper voices in Program Builder masters, guaranteeing consistent institutional voice branding across all television programs without hardcoded secrets. |
| `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md` | Appended official entry documenting the integration of Program Builder with Fish Audio TTS, conforming filter specifications, test validation metrics, and systemd service status. | Satisfies mandatory requirement that all architectural changes on the VPS are logged in the persistent memory changelog. |

---

## 2. Technical Details of Implementation

### 2.1 In-Memory AES-256-GCM Vault Decryption
- Reads `/home/opc/gsa-ai/secrets/fish-production.enc.json`.
- Obtains `GSA_TV_SECRET_KEY` from `gsa-tv-control-plane` environment (tries `docker exec` without sudo first, falling back to `sudo docker exec`).
- Decrypts API key using `cryptography.hazmat.primitives.ciphers.aead.AESGCM`.
- Never prints, logs, or stores the plaintext key on disk.

### 2.2 Fish Audio TTS Synthesis
- Endpoint: `https://api.fish.audio/v1/tts`
- Model: `s2.1-pro-free`
- Voice ID: `5c8a9b5d0b2549c7ada853529199ebe5` (Impacto Comercial)
- Generated texts:
  - Presenting: `"Estamos apresentando " + program_name + "."`
  - Return: `"Estamos de volta " + program_name + "."`

### 2.3 Audio Conforming (FFmpeg)
- Filter:
  `[0:a]adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]`
- Output parameters: `-map [a] -ac 2 -ar 48000 -c:a pcm_s16le`
- Technical output: 5.000000s duration, 48000 Hz, 2 channels stereo, 960,078 bytes.

### 2.4 Caching Architecture
- Directory: `/home/opc/gsa-program-builder/cache/bumpers/`
- Unique hash based on slug, role, spoken text, voice ID, model, and version token.
- Sub-millisecond response (`0.0001s`) for repeated calls.

---

## 3. Verification Commands & Results

| Test | Command / Method | Result |
|---|---|---|
| Python syntax | `python3 -m py_compile builder.py server.py` | 0 errors |
| Vault Decryption | Direct invocation of `load_fish_api_key()` | Key loaded cleanly in memory (length 51) |
| Audio Spec (GSA Agro Presenting) | `ffprobe /home/opc/gsa-program-builder/cache/bumpers/gsa-agro--apresentando.wav` | 5.000000s, 48000 Hz, 2 channels stereo |
| Audio Spec (GSA Agro Return) | `ffprobe /home/opc/gsa-program-builder/cache/bumpers/gsa-agro--de-volta.wav` | 5.000000s, 48000 Hz, 2 channels stereo |
| HTTP API Validation | `curl -X POST http://127.0.0.1:8770/validate -d '{"programa":"GSA Agro",...}'` | HTTP 200, timeline resolved |
| Systemd Service | `sudo systemctl status gsa-program-builder.service` | `active (running)` |
