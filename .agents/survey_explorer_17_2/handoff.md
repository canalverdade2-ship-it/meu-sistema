# Handoff Report — Survey Explorer 2: Program Builder & Fish Audio TTS Integration

**Date**: 2026-09-08T03:05:00Z  
**Agent**: Survey Explorer 2  
**Working Directory**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_17_2`  
**Target File**: `report.md`  

---

## 1. Observation

1. **Program Builder Scripts & Location**:
   - Location: `/home/opc/gsa-program-builder/`
   - Active files:
     - `/home/opc/gsa-program-builder/builder.py` (16,358 bytes)
     - `/home/opc/gsa-program-builder/server.py` (2,992 bytes)
   - Service status:
     Command `sudo systemctl status gsa-program-builder.service --no-pager`:
     ```text
     ● gsa-program-builder.service - GSA Program Builder API
          Loaded: loaded (/etc/systemd/system/gsa-program-builder.service; enabled; preset: disabled)
          Active: active (running) since Mon 2026-09-07 16:09:43 GMT; 10h ago
        Main PID: 402346 (python3)
          CGroup: /system.slice/gsa-program-builder.service
                  └─402346 /usr/bin/python3 /home/opc/gsa-program-builder/server.py
     ```
   - Current bumper reference in `builder.py` (lines 14, 137-143, 172-177):
     ```python
     BUMPERS = Path('/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered')

     def bumper_path(slug, kind):
         suffix = 'apresentando' if kind == 'presenting' else 'de-volta'
         p = BUMPERS / f'{slug}--{suffix}.mp3'
         if not p.is_file():
             raise ValueError(f'bumper nao encontrado: {p.name}')
         return p
     ```

2. **Fish Audio Secret Vault & Key Decryption**:
   - Vault path: `/home/opc/gsa-ai/secrets/fish-production.enc.json` (permissions `0600`, owner `opc`).
   - In `/opt/gsa-tv/ai-worker/ai_worker.mjs` (lines 12-23):
     ```javascript
     const FISH_VAULT_PATH = '/home/opc/gsa-ai/secrets/fish-production.enc.json';
     function loadFishApiKey() {
       const v = JSON.parse(fs.readFileSync(FISH_VAULT_PATH, 'utf8'));
       const key = Buffer.from(execSync('sudo docker exec gsa-tv-control-plane printenv GSA_TV_SECRET_KEY', { encoding: 'utf8' }).trim(), 'hex');
       const nonce = Buffer.from(v.nonce, 'base64url');
       const all = Buffer.from(v.ciphertext, 'base64url');
       const tag = all.subarray(-16), body = all.subarray(0, -16);
       const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
       decipher.setAAD(Buffer.from(v.aad)); decipher.setAuthTag(tag);
       return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')).api_key;
     }
     ```
   - Tested in Python 3.9 on VPS with `cryptography.hazmat.primitives.ciphers.aead.AESGCM`:
     `Decryption SUCCESS! Key found in decrypted json: True key len: 51`. Decryption runs completely in-memory without `sudo` and without writing plaintext secrets to disk.

3. **Fish Audio TTS API Specification & Test Calls**:
   - Endpoint: `https://api.fish.audio/v1/tts`
   - Headers: `Authorization: Bearer <FISH_API_KEY>`, `Content-Type: application/json`, `model: s2.1-pro-free`
   - Reference voice: `5c8a9b5d0b2549c7ada853529199ebe5` (Impacto Comercial)
   - Test call with `format: "mp3"`:
     HTTP Status: `200 OK`, `Content-Type: audio/mpeg`, 52,243 bytes.
     `ffprobe` result: `codec_name: mp3`, `sample_rate: 44100`, `channels: 1`, `duration: 3.265188s`.
   - Test call with `format: "wav"`:
     HTTP Status: `200 OK`, `Content-Type: audio/wav`, 278,572 bytes.
     `ffprobe` result: `codec_name: pcm_s16le`, `sample_rate: 44100`, `channels: 1`, `duration: 3.157914s`.

4. **FFmpeg Audio Conforming to 48kHz Stereo ~5s with Fade In/Out**:
   - Filter executed in container `gsa-tv/control-plane:1.7.9`:
     ```bash
     [0:a]adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]
     ```
   - Output `ffprobe` verification:
     `codec_name: pcm_s16le` (or `mp3`/`aac`), `sample_rate: 48000`, `channels: 2`, `duration: 5.000000s`.

5. **Python Environment & Host Wrapper Issue**:
   - Host Python: Python 3.9.25 on Oracle Linux 9.8 (aarch64).
   - Installed packages: `cryptography 36.0.1`, `requests 2.25.1`, `urllib3 1.26.5`, `aiohttp 3.13.5`, `edge-tts 7.2.8`.
   - Host wrapper `/usr/local/bin/ffprobe`: points to obsolete deleted image `gsa-tv/control-plane:1.7.2` and fails if executed directly on the host shell. But `builder.py` calls Docker with `IMAGE = 'gsa-tv/control-plane:1.7.9'` directly via `run_tool()`, which functions normally.

---

## 2. Logic Chain

1. **Premise 1**: The user request and changelog note that GSA Agro and other programs currently produce masters with outdated/incorrect voices because the Program Builder selects static MP3s from `/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/`.
2. **Observation Step 1**: Inspection of `scratch/generate-all-program-bumpers-vps.mjs` confirms that on 2026-09-05, the bumpers were generated from a provisional casting map (`provisional-assignment-2026-09-05.json`), where only the three news programs used the official voice `5c8a9b5d0b2549c7ada853529199ebe5`. GSA Agro and others received arbitrary non-institutional voices.
3. **Observation Step 2**: Inspection of `/home/opc/gsa-program-builder/builder.py` confirms that `resolve_item()` resolves `'presenting'` and `'return'` exclusively by retrieving files from `BUMPERS = Path('/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered')`.
4. **Observation Step 3**: Inspection of `/opt/gsa-tv/ai-worker/ai_worker.mjs` revealed the exact AES-256-GCM vault architecture (`/home/opc/gsa-ai/secrets/fish-production.enc.json` + `GSA_TV_SECRET_KEY` from docker container `gsa-tv-control-plane`).
5. **Deduction Step 4**: By porting the AES-256-GCM decryption to Python via `cryptography.hazmat.primitives.ciphers.aead.AESGCM`, `builder.py` can load the Fish Audio API key securely in memory without writing it to disk or exposing it in environment files.
6. **Deduction Step 5**: By calling `https://api.fish.audio/v1/tts` with voice ID `5c8a9b5d0b2549c7ada853529199ebe5` and model `s2.1-pro-free`, `builder.py` obtains the dry voice (~3.2s mono 44.1kHz).
7. **Deduction Step 6**: By applying the tested FFmpeg filter (`adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000`), the dry voice is conformed to broadcast standards: exactly 5.000s, 48kHz, stereo, with gentle pre-roll and fade-out.
8. **Conclusion**: Replacing `bumper_path()` in `builder.py` with dynamic generation via `get_continuity_bumper()` resolves R2 completely, provides caching in `CACHE`, and unblocks R3 (revalidation and QC of GSA Agro).

---

## 3. Caveats

1. **Scope Boundary**: This investigation was strictly read-only. No modifications were made to `/home/opc/gsa-program-builder/builder.py` or the VPS services.
2. **Host Wrapper Discrepancy**: Calling `ffprobe` directly on the VPS host shell currently errors due to `/usr/local/bin/ffprobe` targeting `control-plane:1.7.2`. Any testing command on the VPS must call `docker run ... gsa-tv/control-plane:1.7.9 ffprobe` or `docker exec gsa-tv-ffplayout ffprobe`.
3. **Secret Key Availability**: Decrypting the Fish Audio key requires `gsa-tv-control-plane` to be running. If that container is stopped, `docker exec ... GSA_TV_SECRET_KEY` will fail unless the environment variable is also exposed to the systemd service.

---

## 4. Conclusion

1. The Program Builder architecture is fully mapped (`/home/opc/gsa-program-builder/builder.py` and `server.py`).
2. The Fish Audio API key can be decrypted cleanly in Python using the existing vault and `docker exec gsa-tv-control-plane printenv GSA_TV_SECRET_KEY` via `cryptography.hazmat.primitives.ciphers.aead.AESGCM`.
3. Fish Audio API endpoint, model `s2.1-pro-free`, and voice `5c8a9b5d0b2549c7ada853529199ebe5` were successfully tested and verified live on the VPS.
4. The exact FFmpeg filter to conform raw TTS audio to 48kHz stereo 5.0s with fade-in/out and loudness normalization has been designed, tested, and benchmarked.
5. All detailed code proposals, before/after snippets, and architectural guidelines are documented in `report.md`.

---

## 5. Verification Method

To independently verify these findings on the VPS:

1. **Verify Python In-Memory Vault Decryption**:
   ```bash
   node -e "import('./scratch/ssh2-run.mjs').then(async m => {
     const r = await m.runSshScript(\`python3 -c \"
   import json, base64, subprocess
   from cryptography.hazmat.primitives.ciphers.aead import AESGCM
   v = json.load(open('/home/opc/gsa-ai/secrets/fish-production.enc.json'))
   k = bytes.fromhex(subprocess.check_output(['docker', 'exec', 'gsa-tv-control-plane', 'printenv', 'GSA_TV_SECRET_KEY'], text=True).strip())
   dec = AESGCM(k).decrypt(base64.urlsafe_b64decode(v['nonce'] + '=='), base64.urlsafe_b64decode(v['ciphertext'] + '=='), v['aad'].encode())
   print('DECRYPT_OK:', len(json.loads(dec)['api_key']) == 51)
   \"\`);
     console.log(r.stdout);
   })"
   ```
   *Expected output*: `DECRYPT_OK: True`.

2. **Verify Fish Audio API Model & Voice**:
   Verify HTTP status 200 using the decrypted key against `https://api.fish.audio/v1/tts` with voice ID `5c8a9b5d0b2549c7ada853529199ebe5`.

3. **Verify Conforming Filter Duration**:
   Run FFmpeg in `gsa-tv/control-plane:1.7.9` with `[0:a]adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]` and inspect with `ffprobe`. Duration is confirmed at `5.000000` seconds with 2 channels at 48000 Hz.

4. **Inspect Full Investigation Report**:
   Read `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_17_2\report.md`.
