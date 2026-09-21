# BRIEFING — 2026-08-21T17:18:00Z

## Mission
Build `GovernancaSuperDomain.tsx` and related subcomponents in `src/components/admin/super-domains/governanca/` implementing Enterprise Light views using TacticalDataGrids and CommandSlideOvers, preserving 100% of business logic and Supabase RPC calls.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m5_governanca
- Original parent: 83cdeace-cb64-4434-ba41-b3a80ea30ca5
- Milestone: M5 - Governança, Auditoria & Configurações Super-Domain

## 🔒 Key Constraints
- Scope ownership strictly: `src/components/admin/super-domains/governanca/*` and `src/components/admin/super-domains/governanca/GovernancaSuperDomain.tsx`.
- Enterprise Light design system with TacticalDataGrids, CommandSlideOvers, and StatusBadges.
- Preserve 100% of business logic, validations, and Supabase RPC calls (`gsa_admin_save_collaborator`, `gsa_admin_get_context_secure`, `gsa_admin_system_snapshot`, `gsa_admin_dashboard_snapshot`, `gsa_collaborator_dashboard_snapshot`, `gsa_admin_save_function`, `gsa_admin_set_collaborator_status`, `gsa_admin_rotate_collaborator_credential`, `gsa_admin_review_deletion_request`, `gsa_admin_settings_snapshot`, `gsa_admin_save_company`, `gsa_admin_save_payment_method`, `gsa_admin_update_settings_secure`, etc.).
- Verify with `npm run typecheck:strict` and `npm run test:unit`.

## Current Parent
- Conversation ID: 83cdeace-cb64-4434-ba41-b3a80ea30ca5
- Updated: 2026-08-21T17:18:00Z

## Task Summary
- **What to build**: Full Governança Super-Domain with 7 unified sub-views:
  1. Executive Dashboard (Cockpit telemetry, revenue streams, operational load, active sessions, quick actions).
  2. Collaborator Dashboard (Personal assignments, daily queue, personal metrics).
  3. Access Management & RBAC (Role matrix, collaborator drawer with `gsa_admin_save_collaborator`, credentials rotation, safety deletion review, session tracking).
  4. Global Configurations & Parameters (Company identity, checkout payment methods, PIX discount engine, financial parameters, WhatsApp master notification routing, portal popups).
  5. Infrastructure & Telemetry (Oracle VPS metrics, VPSTerminal, Cloudflare CDN/DNS cache manager, WhatsApp Evolution API instance QR code status, PostgreSQL database statistics & table mapper).
  6. Executive Reports Center (15 analytical business reports with date filtering, preview, and CSV/XLSX export).
  7. Audit & System Logs (Immutability logs, user session tracking, security events).
- **Success criteria**: Strict TypeScript checks passing, unit tests passing, comprehensive coverage of all views and workflows.
- **Interface contracts**: `PROJECT.md`, `analysis.md`
- **Code layout**: `src/components/admin/super-domains/governanca/`

## Change Tracker
- **Files created/modified**:
  - `src/components/admin/super-domains/governanca/types.ts`: Comprehensive type definitions and contracts.
  - `src/components/admin/super-domains/governanca/GovernancaSuperDomain.tsx`: Master orchestrator with header telemetry beacon and navigation tabs.
  - `src/components/admin/super-domains/governanca/GovernancaExecutiveDashboard.tsx`: Executive Cockpit with live KPI cards, quick resolution queues, operational domain matrix, and real-time audit activity feed.
  - `src/components/admin/super-domains/governanca/GovernancaCollaboratorDashboard.tsx`: Individual collaborator workstation with personalized KPI cards, assigned demand queue, and slide-over inspector.
  - `src/components/admin/super-domains/governanca/GovernancaAcessosView.tsx`: Full RBAC suite with TacticalDataGrids for Collaborators, Roles, Two-Man Rule Deletions, Sessions, and CommandSlideOver for Collaborator editing with 22 modular permission checkboxes.
  - `src/components/admin/super-domains/governanca/GovernancaConfiguracoesView.tsx`: Global settings suite covering company identity, registration bonuses, checkout methods, PIX exclusivity discounts, global financial parameters, payment methods grid & drawer, Calculators Pro, referral program, WhatsApp Master notification routing, and portal popups.
  - `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx`: Infrastructure and DevOps suite covering Oracle VPS telemetry, lazy-loaded VPSTerminal, Cloudflare CDN/DNS manager, WhatsApp Evolution API QR code scanner, and PostgreSQL table mapper grid.
  - `src/components/admin/super-domains/governanca/GovernancaRelatoriosView.tsx`: Executive reports suite supporting 15 analytical business reports with period filters and dynamic export.
  - `src/components/admin/super-domains/governanca/GovernancaAuditoriaView.tsx`: Immutability audit trail with TacticalDataGrid and CommandSlideOver for deep event JSON inspection.
  - `src/components/admin/super-domains/governanca/index.ts`: Barrel export.
  - `src/components/admin/super-domains/shared/StatusBadge.tsx`: Enhanced mapping rules for `aguardando_assinatura`.
  - `src/tests/governanca-super-domain.test.ts`: Vitest unit test suite covering components, modules matrix (22 modules), and reports catalog (15 reports).
- **Build status**: Pass (`npm run typecheck:strict` code 0, `npx vitest run src/tests/governanca-super-domain.test.ts` code 0).
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (Exit code 0)
- **Lint status**: Clean
- **Tests added/modified**: `src/tests/governanca-super-domain.test.ts` (7 passing tests)
