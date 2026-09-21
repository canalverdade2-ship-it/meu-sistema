# Context for Test Writer 1

## Original User Request Path
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (under header ## 2026-09-09T19:51:10Z)

## Project Plan
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md

## Assigned Scope
Create comprehensive automated test cases for GSA TV Workflow Simplification:
1. Create `src/tests/gsa-tv-workflow-simplification.test.ts` (using Vitest).
2. The tests must verify:
   - **R1 Acceptance**: Upload component allows sending files without requiring approval fields, and uploaded media has status 'approved'/'ready' directly.
   - **R2 Acceptance**: Master Control actions (Play/Stop) execute with 1 click without window.confirm or double confirmation dialogs. Verify static code compliance (0 window.confirm in GsaTvLiveConsole, GsaTvMasterControl, GsaTvModule, GsaTvSettingsTab).
   - **R2 Acceptance (Grade)**: Grade de Programação required fields are reduced by at least 30% (from 3 to 2 required fields: Media and Início), and 'end' time is automatically computed from media duration.
   - **R3 Acceptance**: All tabs (Master Control, Grade, Acervo, IA, Operações, Configurações) remain preserved and fully functional.
   - **Contract Check**: Must pass `scripts/check-gsa-tv-contracts.ts` (`npm run test:gsa-tv`).
3. Run `npm run test:unit` or `npx vitest run src/tests/gsa-tv-workflow-simplification.test.ts` to verify the tests execute properly.
4. Also create `TEST_INFRA.md` and `TEST_READY.md` at the project root once tests are verified.

Write your report in `handoff.md` in your working directory.
