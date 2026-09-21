# DISPATCH for worker_returns_1

- **Milestone**: M3 - Post-Sales Returns, Refunds & Faturas Remediation (R2)
- **Role**: Worker / Database Implementation Specialist
- **Exclusive Write Ownership**:
  - `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`
  - `src/components/admin/LojaTrocasModule.tsx`
  - `.agents/worker_returns_1/`

- **Reference Analysis**:
  - `.agents/explorer_returns_1/returns_audit_report.md`
  - `.agents/spec_miner_survey_1/spec_report.md`
  - `.agents/teamwork_preview_orchestrator_20/PROJECT.md`

- **Task**:
  Refactor `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql` and `src/components/admin/LojaTrocasModule.tsx` to fix all identified vulnerabilities:
  1. **RPC Signature & Compatibility**: Ensure `gsa_admin_atualizar_solicitacao_loja` accepts `p_sessao_id`, `p_token` / `p_session_token`, `p_solicitacao_id`, `p_status` / `p_novo_status`, `p_resposta_admin DEFAULT NULL` with aliases or defaults so callers using either signature succeed.
  2. **Session Config Bypass**: Add `PERFORM set_config('gsa.credit_release', 'on', true);` and `PERFORM set_config('gsa.system_override', 'on', true);` to prevent trigger `prevent_saldo_tampering()` from blocking admin updates.
  3. **Trigger Condition for Returns**: Fix the condition to trigger restock and refunds for `tipo = 'devolucao'` on approval / completion / delivery reception (`v_status_to_save IN ('aprovado', 'concluido', 'devolucao_recebida')`).
  4. **Idempotency Guard**: Add idempotency protection so restocking and refunds execute exactly once per return request (e.g. check `coalesce(v_sol.estorno_executado, false) = false` and set `estorno_executado = true`).
  5. **Selective Stock Replenishment (No Phantom Stock)**: Restock only the items actually returned in the return request, incrementing both `produto_variantes.estoque_disponivel` and `produtos.estoque_disponivel` when applicable.
  6. **Wallet Balance Refund**: Correct column name to `saldo_carteira` on `public.clientes`, and record in `public.carteira_lancamentos` (and `extrato_financeiro`).
  7. **Loyalty Points Refund**: Use `round()` for conversion, record in `public.pontos_movimentacoes` with valid type `'estorno'`, and apply clawback for points earned on original purchase to prevent infinite points arbitrage.
  8. **Invoice Safety**: Cancel any pending `FAT-TROCA-...` invoices if the request is canceled or rejected.
  9. **Frontend RPC Routing**: Refactor `src/components/admin/LojaTrocasModule.tsx` so that `handleUpdateAdvancedStatus` (and all status transitions) invokes `gsa_admin_atualizar_solicitacao_loja` instead of bypassing with direct `.from('loja_solicitacoes').update(...)`.

- **Verification**:
  - Verify SQL syntax and run project tests / builds (`npm run build` or vitest).
  - Document before/after diffs, exact line numbers, and verification commands in `handoff.md`.

- **Mandatory Warning**:
  DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
