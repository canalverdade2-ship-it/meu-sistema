# DISPATCH — 2026-08-21T17:08:00Z

## Assignment
You are teamwork_preview_worker (Governança, Auditoria & Configurações Super-Domain Worker).

Your Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m5_governanca
Workspace Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Parent Conversation ID: 83cdeace-cb64-4434-ba41-b3a80ea30ca5
Original Request File: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
Project Scope File: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Survey 1 Inventory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_1\analysis.md
Shared Components: `src/components/admin/super-domains/shared/` (`TacticalDataGrid`, `CommandSlideOver`, `SplitScreenLayout`, `StatusBadge`)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Ownership:
You exclusively own:
- `src/components/admin/super-domains/governanca/*`
- `src/components/admin/super-domains/governanca/GovernancaSuperDomain.tsx`

Tasks:
1. Build `GovernancaSuperDomain.tsx` and related subcomponents in `src/components/admin/super-domains/governanca/`.
2. Implement Enterprise Light views using TacticalDataGrids and CommandSlideOvers for:
   - Dashboard Executivo (Cockpit telemetry, revenue streams, operational load, active sessions).
   - Dashboard Colaborador (Personal assignments, daily queue, personal metrics).
   - Gestão de Acessos, RBAC & Colaboradores (Role matrix, collaborator editor drawer with `gsa_admin_save_collaborator`, `gsa_admin_get_context_secure`).
   - Configurações Globais & Parâmetros do Sistema (Maintenance mode, SMTP, payment gateways, brand assets).
   - Infraestrutura & Servidores (VPS metrics, Cloudflare, Oracle Cloud, WhatsApp instance QR code status).
   - Central de Relatórios Executivos (15 business reports with date filtering, preview, and CSV/XLSX export).
   - Auditoria & Logs de Sistema (Immutability logs, user session tracking, security events).
3. Preserve 100% of business logic and Supabase RPC calls:
   - `gsa_admin_save_collaborator`
   - `gsa_admin_get_context_secure`
   - Telemetry and snapshot RPCs (`gsa_admin_system_snapshot`, `gsa_admin_dashboard_snapshot`).
4. Verify by running `npm run typecheck:strict` and `npm run test:unit`.
5. Write your complete handoff report to `handoff.md` in your working directory and notify the parent.
