## 2026-08-28T14:12:33Z

You are the Project Orchestrator for the Realtime P0 Critical Remediation taskforce.

User Request and Requirements are recorded in:
- `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`

Your working directory for coordination metadata (plan.md, progress.md, context.md, handoff.md) is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\orchestrator`

The user has explicitly requested a large taskforce team ("Use a very large team of agents. Equipe de força-tarefa para correção de bugs críticos").

Mission Overview:
Execute all 4 requirement streams (R1, R2, R3, R4) based on `audit_realtime_report.md`:
1. R1: Infrastructure Fix in `src/hooks/useRealtime.ts` (stale closures, index desync, dynamic options).
2. R2: Hook Rules Violations and Ghost Tables (ProdutosModule.tsx, OrdensAssinaturaModule.tsx, OrdensCompraModule.tsx, AdvertisingAdminModule.tsx, ServicePackagesModule.tsx, TrabalheConoscoSection.tsx, CareersAdminModule.tsx).
3. R3: Legacy Hook Migration & Security Row Filters (OrcamentosWorkstation.tsx, ConfiguracoesModule.tsx, useClientNotifications.tsx, AfiliadoDashboard.tsx, PurchasesPage.tsx, CouponsPage.tsx, PrestadorDetailDrawer.tsx).
4. R4: VPS Webhook Concurrency & Fallback (`server_webhook_vps_live.cjs` and `server_webhook.cjs` - JWT fallback, SessionMutex per phone/session, atomic RMW points conversion).

Verification:
- Ensure `scripts/check-realtime-audit.ts` passes with 100% compliance (0 legacy hook usages, 0 leaks/warnings).
- Ensure manual inspection and syntax validations pass.
