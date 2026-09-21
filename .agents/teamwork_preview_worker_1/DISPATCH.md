## 2026-08-26T23:21:54Z
You are teamwork_preview_worker_1, an implementation and remediation worker for GSA HUB.
Your working directory is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gest�o-de-servi�os - Copia (4)\.agents\teamwork_preview_worker_1
Original User Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gest�o-de-servi�os - Copia (4)\.agents\ORIGINAL_REQUEST.md
Scope document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gest�o-de-servi�os - Copia (4)\PROJECT.md

TASK:
Based on the comprehensive findings of the 3 Phase 1 Explorers:
1. Database & Migrations: 20260826233000_db_rpc_integrity_remediation.sql and apply to VPS PostgreSQL (port 5433, db gsahub)
2. Affiliate Stress & Business Logic Test Suite: src/tests/affiliates-attribution-payout.test.ts
3. Test Typing Alignments
4. Verification & Build: vitest, tsc, npm run build

## 2026-09-09T19:58:44Z
You are Worker 1 for the GSA TV Workflow Simplification project.
Your identity: teamwork_preview_worker_1
Your working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read ORIGINAL_REQUEST.md at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (under header ## 2026-09-09T19:51:10Z)
and your context at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_1\context.md
and the project plan at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md

Task:
Implement the simplifications for GSA TV according to requirements R1, R2, and R3:
1. R1: Simplificar o Acervo de Mídia e Upload (in `GsaTvLibraryTab.tsx`, `gsaTvMediaUpload.ts`, `GsaTvAdvertisingStudio.tsx`, `GsaTvLiveConsole.tsx`, `infrastructure/gsa-tv/services/playout-api/src/app.js`).
   - Allow uploading without requiring approval checkboxes or fields.
   - Title optional with automatic fallback to file name.
   - Set status directly to 'approved'/'ready' without pending state.
   - PRESERVE contract requirements in `scripts/check-gsa-tv-contracts.ts` (e.g. `rights_confirmed: true` in upload payloads).
2. R2: Simplificar Transmissão e Grade (in `GsaTvLiveConsole.tsx`, `GsaTvMasterControl.tsx`, `GsaTvModule.tsx`, `GsaTvSettingsTab.tsx`, `GsaTvScheduleTab.tsx`).
   - Remove `window.confirm` and double confirmation dialogs on Play/Stop/Take/Pause actions for 1-click execution.
   - In Grade de Programação (`GsaTvScheduleTab.tsx`), reduce required fields by >= 30% (from 3 to 2: Media and Início), auto-calculating 'end' from media duration, with a quick "Hoje Agora" button.
3. R3: Maintain all existing tabs and tools functional.
4. Verification:
   - Run `npm run test:gsa-tv` (must pass 68/68 contracts).
   - Run `npx tsc --noEmit` (0 errors).
   - Run `npm run build` (must succeed).
5. Document all changes, file paths, diffs, and verification commands in `handoff.md` in your working directory.
When finished, send a message to parent summarizing your work and linking to handoff.md.
