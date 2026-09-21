## 2026-08-26T13:54:06Z

You are the Project Orchestrator for the GSA HUB Supabase Realtime Implementation Project.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_4
Workspace root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

Please read the user request verbatim in `.agents/ORIGINAL_REQUEST.md` (most recent timestamp 2026-08-26T13:52:52Z).

Mission Summary:
Implement Supabase Realtime across 100% of GSA HUB (React 18 + Vite + TypeScript + Supabase), replacing all setInterval polling with realtime subscriptions and creating an idempotent SQL migration for REPLICA IDENTITY FULL and supabase_realtime publication on 105 tables.

Key Requirements (R1 - R13):
- R1: Shared Realtime Infrastructure (canonical utility/hook wrapping supabase.channel, deduplication, auto cleanup/removeChannel, reconnection)
- R2: Partners public + admin pages (instant updates within 2s)
- R3: Admin Dashboard + Notification Bell (replace polling in useAdminNotifications, bell updates within 3s)
- R4: Admin Super-Domain Financeiro (8 views/components)
- R5: Admin Super-Domain Contratos (5 views/components)
- R6: Admin Super-Domain Governança (5 views/components)
- R7: Admin Super-Domain Operações (replace setInterval polling with RT in OperacoesSuperDomain.tsx)
- R8: Admin Super-Domain Pessoas (7 views/drawers/sections)
- R9: Admin Demandas Module (5 components)
- R10: Admin Operational Modules + Polling replacements (ShopeeOperationsModule, GsaTvModule, SystemMonitorModule, etc.)
- R11: Admin Dashboard Portals (AdvertiserPortal, AfiliadoDashboard polling -> RT)
- R12: Client Portal (28 components)
- R13: Database Migration in supabase/migrations/ (REPLICA IDENTITY FULL for all 105 tables, supabase_realtime publication, idempotent)

Acceptance Criteria & Verification:
- All 103 vitest tests in `src/tests` must pass (`npx vitest run src/tests`)
- `npm run build` must succeed with exit code 0 and 0 TypeScript errors
- Zero setInterval polling remaining in flagged files
- Every subscribe() must have a removeChannel() cleanup
- At least 20 component files importing the shared realtime utility

Coordinate subagents, maintain BRIEFING.md and progress.md in your working directory, execute rigorous testing and reviews, and report back when finished.
