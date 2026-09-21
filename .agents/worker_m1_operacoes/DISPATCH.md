## 2026-08-21T20:06:55Z
You are teamwork_preview_worker (Operações & Orçamentos Super-Domain Worker).

Your Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m1_operacoes
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
- `src/components/admin/super-domains/operacoes/*`
- `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx`

Tasks:
1. Build `OperacoesSuperDomain.tsx` and related subcomponents in `src/components/admin/super-domains/operacoes/`.
2. Implement the Split-Screen Master-Detail layout for operational workflows:
   - High-density queue on the left (Orçamentos, OS, Demandas, Ordens de Compra/Assinatura).
   - Interactive workstation on the right with tabbed inspector, material lists, technician assignments, execution logs, and actions.
   - Sub-tabs/views for: Orçamentos, Ordens de Serviço, Demandas (Kanban/List), Catálogo de Produtos/Serviços/Pacotes, Viagens GSA, Classificados/Anúncios/TV, Scraping/Shopee.
3. Preserve 100% of business logic and Supabase RPC calls:
   - `gsa_admin_approve_budget` (with approval kind, request id, orcamento id, triggering automatic OS creation).
   - OS status updates, technician assignments, material requisitions.
4. Verify by running `npm run typecheck:strict` and `npm run test:unit`.
5. Write your complete handoff report to `handoff.md` in your working directory and notify the parent.
