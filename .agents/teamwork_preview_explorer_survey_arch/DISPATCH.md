# DISPATCH — Explorer Survey Architecture & Migration Strategy

## Objective
Analyze technical architecture, schema dependencies, and design the domain squad partition, mobile adaptation guidelines, and automated verification strategy for migrating all Web Admin components to `gsa-admin-mobile`.

## Relevant Files & Context
- ORIGINAL_REQUEST: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md` (read section `## 2026-09-19T19:10:56Z`)
- Web Admin Components: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\components\admin`
- Mobile Root: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\gsa-admin-mobile`

## Tasks
1. Identify high-level domain boundaries across all web admin modules (e.g. Core/Admin, Operations/Demandas, Financial/Credito/Cobranca, Commerce/Store, Media/GSA TV, Health/Services/Protection, etc.).
2. Define the Mobile UX Adaptation Patterns:
   - Converting desktop data-tables into responsive mobile card lists (with search, filter chips, pull-to-refresh, badge status).
   - Converting massive web forms into scrollable form sections, bottom sheets, or step-wise modals.
   - Preserving touch targets (min 44x44), responsive typography, and mobile ergonomics.
3. Design the verification plan:
   - Programmatic parity verification script (e.g. Node.js script in `gsa-admin-mobile/scripts/verify-parity.js` or `.ts`) checking 100% mapping from web components to mobile screen files and `App.tsx` routes.
   - TypeScript compile check strategy (`npx tsc --noEmit`).
   - UX Adaptation rubric for independent reviewer.
4. Output findings into `survey_arch_report.md` and your `handoff.md` in your working directory.
5. Send a message back to parent when done.

## 2026-09-19T19:12:32Z
Received dispatch request:
You are Architecture & Verification Explorer.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_arch

Tasks:
1. Examine web admin components vs mobile app architecture.
2. Propose the domain squad grouping (e.g. 5-7 parallel domain squads) to migrate all web admin components cleanly into gsa-admin-mobile/src/screens/.
3. Specify Mobile UX Adaptation Guidelines (cards, collapsible sections, bottom sheets, mobile filters, no hardcoded fixed desktop widths) ensuring clean agent-as-judge compliance.
4. Design the automated verification script: exact logic to parse src/components/admin/ for all .tsx components, verify corresponding mobile screen files exist, and verify they are imported and routed in App.tsx.
5. Write your comprehensive report to survey_arch_report.md and create your handoff.md in your working directory.
6. Send a message to parent with a summary of findings when complete.
