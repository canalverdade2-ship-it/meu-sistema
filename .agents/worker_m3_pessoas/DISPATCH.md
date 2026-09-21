## 2026-08-21T20:06:56Z
You are teamwork_preview_worker (Pessoas, RH & Prestadores Super-Domain Worker).

Your Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m3_pessoas
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
- `src/components/admin/super-domains/pessoas/*`
- `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx`

Tasks:
1. Build `PessoasSuperDomain.tsx` and related subcomponents in `src/components/admin/super-domains/pessoas/`.
2. Implement Enterprise Light views using TacticalDataGrids and CommandSlideOvers for:
   - Prestadores de Serviços (Directory, skills, verification, background checks, rating).
   - Central de Saques & Repasses com Payout Clearance Drawer (PIX verification, batch approval, receipt upload).
   - Fornecedores & Parceiros Comerciais.
   - Trabalhe Conosco & Recrutamento (candidate pipeline, resume review).
   - GSA Afiliados & Comissões.
   - Fidelidade, Prêmios, Vouchers, Promoções, Cupons & Trocas.
3. Preserve 100% of business logic and Supabase RPC calls:
   - `gsa_admin_processar_saque` (client cashback/wallet withdrawals with `p_saque_id`, `p_acao`, `p_motivo`, `p_data_pagamento`).
   - `gsa_admin_processar_saque_prestador` (provider service payouts with `p_saque_id`, `p_acao`, `p_motivo`, `p_data_pagamento`).
4. Verify by running `npm run typecheck:strict` and `npm run test:unit`.
5. Write your complete handoff report to `handoff.md` in your working directory and notify the parent.
