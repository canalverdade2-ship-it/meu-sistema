# Context for Worker 1 (Implementation of R1, R2 & R3)

## Original User Request Path
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (under header ## 2026-09-09T19:51:10Z)

## Project Plan
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md

## Detailed Survey Reports to Consult
- Explorer 1 (Upload & Approval): `.agents/teamwork_preview_explorer_survey_1/handoff.md`
- Explorer 2 (Master Control & Grade): `.agents/teamwork_preview_explorer_survey_2/handoff.md`
- Explorer 3 (Tabs & Contracts): `.agents/teamwork_preview_explorer_survey_3/handoff.md`

## Assigned Implementation Scope
Implement all simplifications for GSA TV workflow while preserving 100% of tabs and functionality:

### 1. R1: Simplificar o Acervo de Mídia e Upload
- In `src/components/admin/gsa-tv/GsaTvLibraryTab.tsx`:
  - Initialize `mediaRights` as `true`.
  - Remove mandatory rights validation blocking upload (`if (!mediaRights)...`).
  - Make `mediaTitle` optional with automatic fallback to file name (without extension) or 'Novo Vídeo'.
  - Unlock submit button (`disabled={saving}`).
  - Adjust `isReady` logic to recognize media with `state === 'ready'` or `approval_state === 'approved'`.
  - Render clear status badge ("Aprovado" / "Pronto" for ready media).
  - CRITICAL CONTRACT COMPLIANCE: Ensure `onUploadFile` and `onImportUrl` continue passing `rightsConfirmed: true` (matching `/rights_confirmed:\s*true/` checked by `scripts/check-gsa-tv-contracts.ts`).
- In `src/lib/gsaTvMediaUpload.ts`:
  - In `importGsaTvMediaFromUrl` and `uploadGsaTvMedia`, default `input.rightsConfirmed ?? true` so absence doesn't reject.
- In `src/components/admin/gsa-tv/GsaTvAdvertisingStudio.tsx`:
  - Relax eligible advertising media filter so ready media doesn't get blocked by legacy `'pending'` approval states.
- In `src/components/admin/GsaTvLiveConsole.tsx`:
  - Ensure ready media filter allows ready media without approval blockage.
- In `infrastructure/gsa-tv/services/playout-api/src/app.js`:
  - Set default insertion `approval_state` to `'approved'` instead of `'pending'` in upload and import routes (lines 679, 1615, 2001, 3998).

### 2. R2: Simplificar Transmissão e Grade
- In `src/components/admin/GsaTvLiveConsole.tsx`:
  - Remove `window.confirm` from `run` function (lines 80-82) and remove confirmation prompt arguments from `stream_pause`, `stream_stop`, `emergency_take`, `media_take`, `live_take`.
- In `src/components/admin/gsa-tv/GsaTvMasterControl.tsx`:
  - Remove `confirmText` and `window.confirm` from `executeCommand` (line 870) and from `handleTake` (lines 900, 945, 964).
- In `src/components/admin/GsaTvModule.tsx`:
  - In `confirmCommand`, execute `void enqueue(jobType)` directly without `window.confirm`.
- In `src/components/admin/gsa-tv/GsaTvSettingsTab.tsx`:
  - Remove `confirmCommand` prompt wrappers for Start / Stop transmission.
- In `src/components/admin/gsa-tv/GsaTvScheduleTab.tsx`:
  - In `handleSaveSlot`: Require only `slot.mediaId` and `slot.start`. If `slot.end` is omitted, auto-calculate `new Date(new Date(slot.start).getTime() + (durationSec * 1000)).toISOString()`.
  - In JSX: Remove `required` from `slot.end`, mark label as `(Opcional - Calculado automático)`.
  - Add quick button "Hoje Agora" to fill `slot.start` with current time in 1 click.

### 3. R3: Preservação de Todas as Abas e Ferramentas
- Ensure all 6 tabs (`master`, `schedule`, `library`, `ai`, `operations`, `settings`) and all their subcomponents remain functional.

### 4. Build & Contract Verification
- Run:
  - `npm run test:gsa-tv` (must pass 68/68 contracts)
  - `npx tsc --noEmit` (must be 0 errors)
  - `npm run build` (must pass)

Write a detailed handoff report in `handoff.md` in your working directory.
