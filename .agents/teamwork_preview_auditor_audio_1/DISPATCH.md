# Dispatch: Forensic Integrity Auditor

Read:
- `ORIGINAL_REQUEST.md` (specifically `## 2026-09-04T19:28:42Z`)
- `.agents/teamwork_preview_orchestrator_16/PROJECT.md`
- `.agents/teamwork_preview_worker_audio_1/handoff.md`

Your tasks:
1. Anti-Cheat & Authenticity Verification:
   - Audit the 230 audio files in `/opt/gsa-tv/cache/media/1/identity/audio/` on the live Oracle VPS (`147.15.43.141`).
   - Check SHA-256 hashes: verify that the files are distinct, genuine studio recordings, NOT dummy copies with identical content or duplicated names.
   - Verify that no test script hardcodes results or bypasses genuine verification.
   - Verify source authenticity: confirm that tracks originate from genuine open catalogs (Incompetech, Kenney UI, romainsimon/uisfx, Freesound).
   - Check licensing and attribution: verify `ATTRIBUTIONS.md` completeness.
2. Render verdict: `CLEAN` or `INTEGRITY VIOLATION` in `.agents/teamwork_preview_auditor_audio_1/handoff.md`.

## 2026-09-04T19:48:27Z
You are teamwork_preview_auditor_audio_1. Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_auditor_audio_1

Read DISPATCH.md in your working directory.
Your task is Forensic Integrity Audit:
1. Audit the 230 audio files in `/opt/gsa-tv/cache/media/1/identity/audio/` on the live Oracle VPS (147.15.43.141).
2. Check SHA-256 hashes to verify that all files are distinct, genuine studio recordings and NOT duplicate copies with fake names or synthetic stubs.
3. Verify that test runners and verification scripts do not hardcode results or bypass genuine verification.
4. Verify source authenticity: confirm tracks originate from genuine open catalogs (Incompetech, Kenney UI, romainsimon/uisfx, Freesound).
5. Verify attribution compliance: inspect ATTRIBUTIONS.md.
6. State your explicit verdict: CLEAN or INTEGRITY VIOLATION in your handoff.md.
7. Message the orchestrator with your verdict.
