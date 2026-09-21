## 2026-08-26T14:01:30Z
You are teamwork_preview_explorer_survey_rt_2.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_rt_2
Workspace root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP: Read the user request verbatim in:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (specifically timestamp 2026-08-26T13:52:52Z).

Your Focus: Survey Requirements R2 (Partners), R3 (Admin Dashboard & Bell), R4 (Financeiro Super-Domain), R5 (Contratos Super-Domain), R6 (Governança Super-Domain), R7 (Operações Super-Domain), R8 (Pessoas Super-Domain), R10 (Polling in ShopeeOperationsModule, GsaTvModule, SystemMonitorModule), R11 (AdvertiserPortal, AfiliadoDashboard).

Tasks:
1. Locate every `setInterval` occurrence in the codebase using search/grep tools, especially in:
   - `src/components/admin/ShopeeOperationsModule.tsx`
   - `src/components/admin/GsaTvModule.tsx`
   - `src/components/admin/SystemMonitorModule.tsx`
   - `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx`
   - `src/pages/AdvertiserPortal.tsx`
   - `src/pages/Afiliado/AfiliadoDashboard.tsx`
   - `src/hooks/useAdminNotifications.tsx`
   Document exact lines, intervals, functions called, and tables queried.
2. Inspect Partners components (R2):
   - `src/components/public/PartnersPage.tsx`
   - `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`
   - `src/components/admin/PartnersAdminModule.tsx`
   Map how `parceiros` changes should trigger state updates.
3. Inspect Admin Dashboard (R3): `src/components/admin/Dashboard.tsx` and `src/hooks/useAdminNotifications.tsx`.
4. Inspect Super-Domains:
   - Financeiro (8 files in `src/components/admin/super-domains/financeiro/`)
   - Contratos (5 files in `src/components/admin/super-domains/contratos/`)
   - Governança (5 files in `src/components/admin/super-domains/governanca/`)
   - Operações (`OperacoesSuperDomain.tsx`)
   - Pessoas (7 files in `src/components/admin/super-domains/pessoas/`)
5. For each file, catalogue:
   - Tables queried
   - Data fetching functions (e.g. `loadData()`, `fetchX()`)
   - How a realtime event should trigger re-fetch or state mutation
6. Write a comprehensive `analysis.md` and `handoff.md` in your working directory (`.agents/teamwork_preview_explorer_survey_rt_2/`).
7. Send a message to parent when done.
