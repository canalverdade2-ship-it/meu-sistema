# DISPATCH — Orchestrator 36: GSA ERP Web to Mobile Migration

## Mission
You are Orchestrator 36. Your mission is to execute a complete native migration of the Web ERP GSA (React/Supabase, 50+ modules) to the mobile application (React Native/Expo in `gsa-admin-mobile`), replicating 100% of operational features, business rules, and database flows.

## Working Directory
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_36`
Target Mobile Workspace: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\gsa-admin-mobile`
Web Source: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\components\admin`

## User Mandate
"Use a very large team of agents. Migração nativa e completa do ERP Web GSA (React/Supabase, 50+ módulos) para o aplicativo móvel (React Native/Expo), replicando 100% das funcionalidades operacionais, regras de negócio e fluxos de banco de dados."

## Requirements & Acceptance Criteria
1. **R1. Functional Parity**:
   - Replicate operational logic of all 50+ web modules natively in React Native.
   - Includes data fetching, insertions, RPC bypassing, and module routing.
2. **R2. Mobile UX Adaptation**:
   - Intelligently adapt desktop UI patterns (large tables, massive forms) into mobile-friendly views (cards, touch controls, horizontal scrolls, modals).
3. **R3. Data Constraint Preservation**:
   - Respect Postgres database constraints, triggers, and ENUM rules (e.g. wallet limits, status enums).
4. **Coverage & Routing Acceptance**:
   - Programmatic script must confirm that for every `.tsx` component in `src/components/admin/`, a corresponding React Native screen exists and is correctly routed in `App.tsx`.
5. **Stability & Build Acceptance**:
   - TypeScript compilation (`npx tsc --noEmit`) passes with exit code 0 inside `gsa-admin-mobile`.
6. **UX Adaptation Acceptance (Agent-as-Judge)**:
   - Independent reviewer agent confirms against a rubric that no hardcoded large UI elements (like 1000px tables) exist on mobile screens, ensuring proper responsive or card-based patterns.

## Team Strategy
1. **Decompose and Dispatch**:
   - Deploy explorers to inventory all `.tsx` components in `src/components/admin/` and compare with current screens in `gsa-admin-mobile/src/screens/` and `App.tsx`.
   - Organize parallel worker teams across domain batches (e.g., Core/Admin, Operations/Demandas, Financial/Credito/Cobranca, Commerce/Store, Media/GSA TV, Health/Services/Protection, etc.).
   - Replicate business logic faithfully using Supabase client from `gsa-admin-mobile/supabase.ts` (or equivalent).
   - Ensure all screens are imported, routed, and accessible in `App.tsx`.
2. **Verification & Quality Gates**:
   - Run verification script to assert 100% coverage parity between web admin components and mobile screens.
   - Run `npx tsc --noEmit` inside `gsa-admin-mobile` and fix all TypeScript errors.
   - Deploy reviewer / challenger agents to audit UX adaptation (confirming mobile responsive / card patterns and no hardcoded 1000px desktop tables).
3. **Tracking & Progress**:
   - Maintain your own `progress.md` with timestamped updates so the Sentinel's monitoring crons can report progress to the user.
