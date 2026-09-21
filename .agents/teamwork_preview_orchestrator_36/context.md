# CONTEXT — Orchestrator 36 (Full Native Web ERP -> Mobile React Native/Expo Migration)

## Project Roots
- Root Project: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`
- Mobile App Working Directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\gsa-admin-mobile`
- Web Admin Components Source: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\components\admin`

## Authoritative User Request
- Consult `ORIGINAL_REQUEST.md` (section `## 2026-09-19T19:10:56Z`).

## Core Requirements
1. **R1. Functional Parity**: Replicate the operational logic of all 50+ web modules (from `../src/components/admin/`) natively in the React Native project (`gsa-admin-mobile`). This includes data fetching, insertions, RPC bypassing, and module routing.
2. **R2. Mobile UX Adaptation**: Intelligently adapt desktop-centric UI patterns (large tables, massive forms) into mobile-friendly Native views (cards, touch controls, horizontal scrolls, modals). No hardcoded desktop sizes (e.g., 1000px fixed tables).
3. **R3. Data Constraint Preservation**: Ensure all Supabase updates respect existing constraints, triggers, and ENUM rules established in the Postgres database (e.g., wallet limits, status enums).

## Acceptance Criteria
1. **Coverage & Routing**: Programmatic verification script confirms that for every `.tsx` component found in the web `src/components/admin/` folder, a corresponding React Native screen exists and is correctly routed in `App.tsx`.
2. **Stability & Build**: TypeScript compilation (`npx tsc --noEmit`) passes with exit code 0 inside `gsa-admin-mobile`.
3. **UX Adaptation (Agent-as-Judge)**: Independent reviewer agent confirms against a rubric that no hardcoded large UI elements exist on mobile screens, ensuring proper responsive or card-based patterns.

## Teamwork Instructions
- User explicitly requested: "Use a very large team of agents". Deploy specialized subagents across parallel tracks/batches (e.g. explorers to inventory all web modules and assess existing mobile screens, workers to implement native screens and routes, test writers/reviewers to verify types and UI adaptation rubrics).
- Keep `progress.md` updated continuously with timestamped entries so the Sentinel monitoring crons can track progress.
