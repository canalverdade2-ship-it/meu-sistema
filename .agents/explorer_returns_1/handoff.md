# HANDOFF REPORT — explorer_returns_1

**Milestone:** Marketplace ACID Concurrency Remediation & Returns Audit  
**Agent:** explorer_returns_1 (Returns, Refunds & ACID Explorer)  
**Parent Conversation ID:** 284ed346-0d14-4cb6-af78-95944f699698  
**Working Directory:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_returns_1`  

---

## 1. OBSERVATION
Direct observations from code inspection and database auditing:

1. **Status Condition Mismatch in SQL**:
   - In `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql` line 111:
     ```sql
     IF (v_status_to_save = 'devolucao_recebida' OR (v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso')) AND v_sol.orcamento_origem_id IS NOT NULL THEN
     ```
   - In `src/types.ts` line 800 and `supabase/migrations/20260714056400_secure_client_budget_settlement_and_exchange.sql` lines 573-613, `tipo` is strictly `'devolucao'` or `'troca'`. The value `'reembolso'` does not exist.
   - When an admin approves a return (`p_status = 'aprovado'`), `(v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso')` evaluates to FALSE, and `v_status_to_save = 'devolucao_recebida'` evaluates to FALSE. The entire restock/refund block (lines 111-210) is completely skipped.

2. **Frontend Direct Table Mutation Bypass**:
   - In `src/components/admin/LojaTrocasModule.tsx` line 602 (`devolucao_recebida`) and line 641 (`concluido`), the handler calls `handleUpdateAdvancedStatus(...)`.
   - Lines 168-176 of `LojaTrocasModule.tsx` execute:
     ```typescript
     const { error } = await supabase
       .from('loja_solicitacoes')
       .update({ status: targetStatus, historico_status: novoHistorico, ...payload, updated_at: new Date().toISOString() })
       .eq('id', selectedSolicitacao.id);
     ```
   - It performs a raw REST update on `loja_solicitacoes`. The RPC `gsa_admin_atualizar_solicitacao_loja` is not invoked, leaving inventory and ledgers untouched.

3. **RPC Signature Parameter Mismatch**:
   - `LojaTrocasModule.tsx` lines 93-98 invokes the RPC with named parameters `{ p_sessao_id, p_session_token, p_solicitacao_id, p_novo_status, p_resposta_admin }`.
   - `20260910180000` line 5 defines `p_sessao_id uuid, p_token text, p_solicitacao_id uuid, p_status text, p_resposta_admin text DEFAULT NULL`.
   - Parameter names mismatch (`p_session_token` vs `p_token`, `p_novo_status` vs `p_status`), causing PostgREST named-call rejection.

4. **Fatal Column and Table Hallucinations in Wallet Refund**:
   - `20260910180000` line 143: `UPDATE public.clientes SET carteira_saldo = coalesce(carteira_saldo, 0) + v_orc.abatimento_carteira`.
   - `20260910180000` line 146: `INSERT INTO public.carteira_movimentacoes(cliente_id, tipo, valor, saldo_apos, descricao)`.
   - Inspection of all migrations (`20260711160000`, `20260714032000`, `20260714056100`) and live database inventories confirms the column on `clientes` is **`saldo_carteira`**, the ledger table is **`carteira_lancamentos`**, and **`carteira_movimentacoes` does not exist**. Postgres throws runtime errors when executed.
   - The trigger `prevent_saldo_tampering()` in `20260723114000:1-21` aborts authenticated updates unless `gsa.credit_release = 'on'`. `20260910180000` fails to set this config.

5. **Phantom Stock Inflation from Full-Order Restocking**:
   - `20260910180000` lines 124-128:
     ```sql
     FOR v_item IN (
       SELECT produto_id, produto_variante_id, quantidade
       FROM public.loja_pedido_itens
       WHERE orcamento_id = v_orc.id AND tipo = 'produto'
     ) LOOP
     ```
   - In a partial return (e.g. 1 out of 3 products returned), it restocks all items in the entire order to `produtos` and `produto_variantes`.

6. **Loyalty Infinite Exploitation Loop**:
   - `20260910180000` line 156 restores points used as discount via `floor()`, but does **not** claw back loyalty points awarded on order completion. A buyer can purchase R$ 5.000, earn 5.000 points, return the merchandise, receive full cash back, and cash out the 5.000 points.

7. **Invoices and Payment Gateways**:
   - For PIX or credit card purchases, lines 171-209 do not create a `loja_reembolsos` record or return cash to the customer.
   - Exchange difference invoices (`FAT-TROCA-...`) remain pending even if the exchange is later rejected or cancelled.

---

## 2. LOGIC CHAIN
1. **From Observation 1 & 2 $\rightarrow$ Broken Atomicity**: Because `loja_solicitacoes.tipo` is `'devolucao'` and never `'reembolso'`, `(v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso')` evaluates to FALSE. Furthermore, frontend advances logistics statuses via raw client updates. Therefore, a return request can reach `'aprovado'`, `'devolucao_recebida'`, and `'concluido'` with zero financial or stock operations executing.
2. **From Observation 4 $\rightarrow$ Database Execution Failure**: Executing `gsa_admin_atualizar_solicitacao_loja` where `abatimento_carteira > 0` directly executes SQL statements referencing `clientes.carteira_saldo` and `public.carteira_movimentacoes`. Because neither exists in the schema, PostgreSQL aborts the transaction with an unhandled exception. Even if resolved, the absence of `PERFORM set_config('gsa.credit_release', 'on', true)` triggers `prevent_saldo_tampering()`, guaranteeing rejection.
3. **From Observation 5 $\rightarrow$ Inventory Corruption**: Iterating over `loja_pedido_itens WHERE orcamento_id = v_orc.id` without filtering for returned items causes items retained by the customer to be credited back into available inventory. Under concurrent checkouts, phantom stock is sold, leading to fulfillment failure.
4. **From Observation 6 $\rightarrow$ Financial Leakage**: When order total is refunded without deducting previously credited loyalty points and referrer commissions, the company suffers net financial loss through points redemption or cash withdrawals.

---

## 3. CAVEATS
- **Scope Limit**: Investigation was read-only; no code modifications were applied to `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql` or `LojaTrocasModule.tsx`.
- **Live Database Connection**: Code inspection and live schema dumps (`scratch/deep_live_db_health_audit.json` and migration files) were used to verify table definitions and triggers.
- **Client Cancellation RPC**: Order cancellations (`gsa_client_cancel_store_order`) were checked for reference and already correctly implement `saldo_carteira` and `set_config('gsa.credit_release', 'on', true)` as of `20260817211500_fix_client_store_cancellation_guard.sql`.

---

## 4. CONCLUSION
The return and refund implementation in `20260910180000_marketplace_acid_concurrency_remediation.sql` fails mathematical correctness, atomic execution guarantees, and database schema compliance:
1. **Atomicity**: Fails completely (condition deadlocks execution; frontend bypasses RPC).
2. **Stock Restoration**: Fails (inflates stock of non-returned items; lacks idempotency).
3. **Wallet Refund**: Fails with fatal SQL errors (`carteira_saldo` and `carteira_movimentacoes` do not exist; trigger blocks execution).
4. **Points Refund**: Fails (arithmetic truncation, lack of earned points clawback enables infinite points arbitrage).
5. **Invoices**: Fails (orphans difference invoices on cancellation; omits PIX/Card refund records).
6. **Remediation**: The migration must be refactored with the proposed specification in `returns_audit_report.md` and `LojaTrocasModule.tsx` must route all status transitions through the secure RPC.

---

## 5. VERIFICATION METHOD
1. **Audit Report Inspection**:
   Examine detailed technical report at:
   `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_returns_1\returns_audit_report.md`
2. **Automated Test Suite Verification**:
   Run Vitest suite verifying the post-sales business logic and static constraints:
   ```bash
   npx vitest run src/tests/marketplace-returns-exchanges-atomicity.test.ts
   ```
3. **SQL Static Inspection**:
   - Check `20260910180000_marketplace_acid_concurrency_remediation.sql` line 111 (`tipo = 'reembolso'`).
   - Check lines 143 and 146 (`carteira_saldo` and `carteira_movimentacoes`).
   - Check `LojaTrocasModule.tsx` line 168-176 (`handleUpdateAdvancedStatus`).
