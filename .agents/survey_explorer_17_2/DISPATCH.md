# Task Assignment for Explorer 2 (Program Builder & Fish Audio API)

## Mission
Investigate the Program Builder Python scripts and Fish Audio integration architecture on the VPS.

## Authoritative User Request
Read: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` under header `## 2026-09-08T02:46:22Z`.

## Investigation Targets on VPS (147.15.43.141, opc):
1. Locate and examine all Program Builder Python scripts in `/home/opc/gsa-ai/` (e.g. `ls -la /home/opc/gsa-ai/*.py`, inspect their architecture, CLI arguments, functions, and logic).
2. Inspect `/opt/gsa-tv/ai-worker/ai_worker.mjs` (read without leaking secrets in output) to understand how the Fish Audio API key is securely loaded (e.g. environment variable, config file, systemd service, etc.). Note the exact mechanism to access it in Python safely.
3. Investigate how continuity voiceovers ("Estamos apresentando [Nome do Programa]" / "Estamos de volta [Nome do Programa]") are currently referenced from `/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/` and how the Program Builder selects or injects them.
4. Verify Fish Audio TTS API specifications (`https://api.fish.audio/v1/tts`, model `s2.1-pro-free`, voice ID `5c8a9b5d0b2549c7ada853529199ebe5`). Check what audio formats it returns (mp3, wav, pcm) and what ffmpeg filter/command conforms the output to 48kHz stereo, ~5s with fade in/out.
5. Check Python environment and installed libraries on VPS (e.g., requests, httpx, ffmpeg, pydantic, etc.).

## Access
- Use `node scratch/ssh2-run.mjs` or execute remote bash commands via SSH to query the VPS.
- DO NOT log or leak API keys or secrets in your reports or stdout!

## Output
Write your comprehensive report to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_17_2\report.md`
And write your `handoff.md`.

## 2026-09-08T02:49:12Z
Received invocation:
You are Survey Explorer 2. Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_17_2`

Read your assignment in `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_17_2\DISPATCH.md` and read the authoritative user request in:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` under header `## 2026-09-08T02:46:22Z`.

Investigate the Program Builder Python scripts in `/home/opc/gsa-ai/`, inspect how Fish Audio API key is securely loaded in `/opt/gsa-tv/ai-worker/ai_worker.mjs` without leaking secrets, and investigate how Fish Audio TTS API (`https://api.fish.audio/v1/tts`, model `s2.1-pro-free`, voice ID `5c8a9b5d0b2549c7ada853529199ebe5`) should be integrated for continuity voiceovers (WAV/MP3 48kHz stereo, ~5s fade in/out).
Use `node scratch/ssh2-run.mjs` or execute remote SSH commands to query the VPS.
Write your full report to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_17_2\report.md`
and write your `handoff.md`. Send a message when complete.
