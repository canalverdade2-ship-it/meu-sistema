## 2026-08-26T14:19:15Z
You are worker_m3_superdomains.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m3_superdomains
Workspace root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP: Read the user request verbatim in:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (specifically timestamp 2026-08-26T13:52:52Z) and `PROJECT.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Scope: Milestone 3 — Admin Super-Domains (Financeiro R4, Contratos R5, Governança R6, Pessoas R8).
Exclusive File Ownership:
- Financeiro (`src/components/admin/super-domains/financeiro/`):
  1. `FaturamentoView.tsx`
  2. `CobrancaView.tsx`
  3. `FluxoCaixaView.tsx`
  4. `EmprestimosCreditoView.tsx`
  5. `FiscalView.tsx`
  6. `RentabilidadeReembolsosView.tsx`
  7. `CalculadorasGatewayView.tsx`
  8. `FinanceiroSuperDomain.tsx`
- Contratos (`src/components/admin/super-domains/contratos/`):
  9. `AreaVipView.tsx`
  10. `AtendimentoTicketsView.tsx`
  11. `ContratosDocumentosView.tsx`
  12. `CrmClientesView.tsx`
  13. `HubEmpresasView.tsx`
  14. `GsaSaudeView.tsx`
  15. `GsaSegurosView.tsx`
  16. `ContratosSuperDomain.tsx`
- Governança (`src/components/admin/super-domains/governanca/`):
  17. `GovernancaAcessosView.tsx`
  18. `GovernancaAuditoriaView.tsx`
  19. `GovernancaConfiguracoesView.tsx`
  20. `GovernancaExecutiveDashboard.tsx`
  21. `GovernancaInfraView.tsx`
- Pessoas (`src/components/admin/super-domains/pessoas/`):
  22. `AfiliadosSection.tsx`
  23. `FidelidadePromocoesSection.tsx`
  24. `NovoPrestadorDrawer.tsx`
  25. `PayoutClearanceDrawer.tsx`
  26. `PrestadorDetailDrawer.tsx`
  27. `SaquesRepassesSection.tsx`
  28. `TrabalheConoscoSection.tsx`

Tasks:
- Use canonical `useRealtimeSubscription` / `useRealtime` from `src/hooks/useRealtime.ts` across all views.
- Subscribe each view to its underlying tables (`faturas`, `cobrancas`, `transferencias`, `saques`, `emprestimos`, `clientes`, `tickets`, `contratos`, `colaboradores`, `sistema_logs`, `system_settings`, `prestadores`, `indicacoes`, `vouchers`, `gsa_afiliados`, `career_applications`, etc.).
- Remove any remaining `setInterval` in `GovernancaAcessosView.tsx`, `GovernancaExecutiveDashboard.tsx`, `GovernancaInfraView.tsx`, and `TrabalheConoscoSection.tsx`.
- Run `npx vitest run src/tests` and `npm run build` to verify exit code 0 and zero regressions.
- Write `handoff.md` and report back.
