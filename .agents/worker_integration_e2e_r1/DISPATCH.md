## 2026-08-21T20:23:04Z

<USER_REQUEST>
You are teamwork_preview_worker (Admin Shell Integration & E2E Test Worker - Replacement).

Your Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_integration_e2e_r1
Workspace Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Parent Conversation ID: 83cdeace-cb64-4434-ba41-b3a80ea30ca5
Original Request File: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
Project Scope File: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Test Infra File: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\TEST_INFRA.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Ownership:
You exclusively own:
- `src/pages/AdminPanel.tsx` (and related navigation in `src/components/admin/AdminNavigation.tsx` / routing)
- `src/tests/super-domains-e2e.test.ts`
- `scripts/verify-all-super-domains.ts` (if added)

Tasks:
1. Wire up `src/pages/AdminPanel.tsx` with the 5 consolidated Super-Domains:
   - `OperacoesSuperDomain` from `src/components/admin/super-domains/operacoes`
   - `FinanceiroSuperDomain` from `src/components/admin/super-domains/financeiro`
   - `PessoasSuperDomain` from `src/components/admin/super-domains/pessoas`
   - `ContratosSuperDomain` from `src/components/admin/super-domains/contratos`
   - `GovernancaSuperDomain` from `src/components/admin/super-domains/governanca`
   - Maintain backwards-compatible submodule routing, direct URL hashes, and tab aliases.
2. Build a comprehensive E2E test suite in `src/tests/super-domains-e2e.test.ts`:
   - Test all 5 Super-Domains mount properly with Enterprise Light components.
   - Test that critical RPC dispatches are wired correctly: `gsa_admin_processar_saque`, `gsa_admin_processar_saque_prestador`, `gsa_admin_baixar_fatura`, `gsa_admin_approve_budget`, `gsa_admin_save_collaborator`.
   - Test that navigation and tab transitions work seamlessly.
3. Run and verify:
   - `npm run test:unit`
   - `npm run typecheck:strict`
   - `npm run build` (Must succeed cleanly with exit code 0)
4. Write your complete handoff report to `handoff.md` in your working directory and notify the parent.
</USER_REQUEST>
