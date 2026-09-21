# Handoff Report: Specification Mining of Marketplace Checkout & Post-Sales ACID Concurrency

- **Agent**: `spec_miner_survey_1`
- **Working Directory**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\spec_miner_survey_1`
- **Output Report**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\spec_miner_survey_1\spec_report.md`
- **Date**: 2026-09-10T22:38:00Z
- **Handoff Type**: Hard (Task complete)

---

## 1. Observation

Direct observations from the inspected codebase and migration files:

1. **`ORIGINAL_REQUEST.md` (lines 292-320)**:
   - "R1. Auditoria de Concorrência no Checkout (Base Function): Analisar a função `gsa_client_checkout_store_base_20260817` no arquivo `20260716183010_update_checkout_function.sql`. Verificar se a lógica que injeta o preço da variação `v_variant_price` está livre de vulnerabilidades de sobreposição global (evitando a mutação da tabela principal de produtos) e se os bloqueios `FOR UPDATE` impedem a venda de produtos sem estoque durante alta simultaneidade."
   - "R2. Auditoria de Estornos e Devoluções Atômicas: Analisar a migração `20260910180000_marketplace_acid_concurrency_remediation.sql` e a RPC `gsa_admin_atualizar_solicitacao_loja`."

2. **`supabase/migrations/20260716183010_update_checkout_function.sql`**:
   - Lines 147-151:
     ```sql
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(item) AS key_name
       WHERE key_name NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses')
     )
     ```
     Verbatim: Throws `RAISE EXCEPTION 'O carrinho contém item inválido ou campo não permitido.';` if any item contains `variante_id`.
   - Lines 186-196:
     ```sql
     IF nullif(v_item ->> 'variante_id', '') IS NOT NULL THEN
       DECLARE
         v_variant_price numeric;
       BEGIN
         SELECT valor INTO v_variant_price FROM public.produto_variantes WHERE id = (v_item ->> 'variante_id')::uuid;
         IF v_variant_price IS NOT NULL THEN
           v_product.valor := v_variant_price;
         END IF;
       END;
     END IF;
     ```
     Verbatim: Assigns to local variable `v_product.valor`. No `UPDATE public.produtos SET valor = ...` exists.

3. **`supabase/migrations/20260817120000_product_variations_marketplace.sql`**:
   - Lines 743-750:
     ```sql
     SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
       'tipo', item ->> 'tipo',
       'item_id', item ->> 'item_id',
       'quantidade', item -> 'quantidade',
       'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
     ))) INTO v_sanitized_cart
     FROM jsonb_array_elements(v_cart) source(item);
     ```
     Verbatim: Strips `variante_id` and `produto_variante_id` from the cart.
   - Lines 832-836:
     ```sql
     SELECT COALESCE(sum(quantidade), 0) INTO v_requested
     FROM public.loja_pedido_itens
     WHERE orcamento_id = v_order_id
       AND tipo = 'produto'
       AND produto_id = v_variant.produto_id
       AND produto_variante_id = v_variant.id;
     ```
     Verbatim: Filters by `produto_variante_id = v_variant.id`. Because the base function received `v_sanitized_cart` with no variant ID, `loja_pedido_itens.produto_variante_id` is inserted as `NULL`, so `v_requested` returns `0`.
   - Line 867: `UPDATE public.produto_variantes SET estoque_disponivel = estoque_disponivel - v_requested WHERE id = v_variant.id;` reduces stock by 0.

4. **`supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`**:
   - Line 5-11:
     `CREATE OR REPLACE FUNCTION public.gsa_admin_atualizar_solicitacao_loja(p_sessao_id uuid, p_token text, p_solicitacao_id uuid, p_status text, p_resposta_admin text DEFAULT NULL)`
   - Lines 143, 146, 149:
     ```sql
     UPDATE public.clientes SET carteira_saldo = coalesce(carteira_saldo, 0) + v_orc.abatimento_carteira WHERE id = v_sol.cliente_id;
     INSERT INTO public.carteira_movimentacoes(cliente_id, tipo, valor, saldo_apos, descricao) ...
     ```
     Grep in codebase reveals column is `saldo_carteira` and table is `carteira_lancamentos`. Neither `carteira_saldo` nor `carteira_movimentacoes` exist anywhere else in the project.
   - Line 163:
     `INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido) VALUES (v_sol.cliente_id, 'ganho', ...)`
     Migration `20260803173000_fix_points_movement_type_check_constraint.sql` line 32 enforces:
     `CHECK (tipo IN ('geracao_fatura', 'pagamento', ..., 'estorno', ...))` — `'ganho'` is not in the check constraint.
   - Lines 176, 193:
     `AND itens_faturados @> jsonb_build_array(jsonb_build_object('codigo', 'CRE-' || v_orc.codigo_orcamento))`
     Store invoices store product items in `itens_faturados`, never `'CRE-' || codigo_orcamento`.
   - Line 111:
     `IF (v_status_to_save = 'devolucao_recebida' OR (v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso')) AND v_sol.orcamento_origem_id IS NOT NULL THEN`
     Lacks any previous-state or idempotency guard; running status `aprovado` then `devolucao_recebida` executes restocking and refunds twice.

5. **`src/components/admin/LojaTrocasModule.tsx`**:
   - Lines 93-98 calls RPC passing:
     `{ p_sessao_id, p_session_token, p_solicitacao_id, p_novo_status, p_resposta_admin }`
     Mismatch with SQL parameter names (`p_token`, `p_status`).
   - Line 168-176: `handleUpdateAdvancedStatus` directly updates `loja_solicitacoes` table without calling the RPC, bypassing restocking.

6. **Test execution results**:
   - `npx vitest run src/tests/marketplace-returns-exchanges-atomicity.test.ts`: 25 passed.
   - `npx vitest run src/tests/marketplace-checkout-concurrency-audit.test.ts`: 15 passed.
   - `npx vitest run src/tests/productVariations.test.ts`: 4 passed.
   - `npx vitest run src/tests/marketplace-checkout-pricing.test.ts src/tests/marketplace-pricing-integrity.test.ts`: 31 passed.

---

## 2. Logic Chain

1. **R1 Evaluation (Global Overwrite & Concurrency)**:
   - Based on Obs. 2 (lines 186-196), `v_product.valor := v_variant_price` updates only a local PL/pgSQL variable in memory. No database table is updated with this assignment. Therefore, the master catalog table `public.produtos.valor` is strictly protected from global mutation.
   - Based on Obs. 2 (lines 181, 208-211), base product inventory is locked via `SELECT * FROM produtos ... FOR UPDATE`. Under concurrent requests, row locks enforce sequential execution, preventing base product overselling.
   - However, based on Obs. 2 & 3, variant rows are not locked in the base function, and due to Obs. 3 (lines 743-750), `v_sanitized_cart` strips variant keys. Thus, the base function inserts `loja_pedido_itens.produto_variante_id = NULL`, which causes the wrapper's variant inventory decrement (Obs. 3, lines 832-867) to calculate `v_requested = 0`, completely failing to decrement variant inventory.

2. **R2 Evaluation (Atomic Reversals & Returns)**:
   - Based on Obs. 4 (lines 143, 146, 149), `gsa_admin_atualizar_solicitacao_loja` attempts to update a non-existent column `carteira_saldo` on `clientes` and insert into a non-existent table `carteira_movimentacoes`. When an order with `abatimento_carteira > 0` is processed, PostgreSQL will raise a runtime exception and abort the transaction.
   - Based on Obs. 4 (line 163), the function inserts `tipo = 'ganho'` into `pontos_movimentacoes`. This violates check constraint `pontos_movimentacoes_tipo_check`. When an order with `desconto_pontos > 0` is processed, PostgreSQL raises a check constraint violation and aborts the transaction.
   - Based on Obs. 4 (lines 176, 193), the JSON containment query for credit invoices looks for `codigo = 'CRE-' || v_orc.codigo_orcamento`. Invoices created by checkout store product items, not this synthetic code. Consequently, the check returns false, pending credit invoices are never canceled, and customer credit limits are never restored.
   - Based on Obs. 4 (line 111), the restocking and refund block is triggered whenever the target status is `devolucao_recebida` OR (`aprovado` and `tipo = 'reembolso'`). If an admin marks a refund request as `aprovado` and later updates it to `devolucao_recebida` upon physical receipt, both stock and monetary refunds will execute twice.
   - Based on Obs. 5, calling the function from `LojaTrocasModule.tsx` fails PostgREST parameter resolution due to argument name differences (`p_session_token` vs `p_token`, `p_novo_status` vs `p_status`), and `handleUpdateAdvancedStatus` directly updates the table, bypassing the RPC entirely.

---

## 3. Caveats

- Migration scripts were analyzed through static code inspection and unit/concurrency test simulation suites. No live PostgreSQL database mutation was executed (strictly adhering to the read-only specification miner role).
- If `carteira_saldo` or `carteira_movimentacoes` were created outside git/migrations directly on a remote database instance without migration tracking, that remote state was not visible in repository files; however, within the authoritative migration directory, they are indisputably inconsistent with the rest of the schema.
- No other caveats.

---

## 4. Conclusion

The specification mining has uncovered critical architectural flaws and blocker bugs:
1. **Master catalog price immutability is preserved** in `20260716183010`, but variant inventory is **never decremented** due to cart sanitization stripping variant IDs between the wrapper and base checkout function.
2. **`gsa_admin_atualizar_solicitacao_loja` in `20260910180000` is currently broken**:
   - Fails on wallet refund (`carteira_saldo` does not exist; `carteira_movimentacoes` does not exist).
   - Fails on points refund (violates check constraint `pontos_movimentacoes_tipo_check`).
   - Fails on credit invoice cancellation (query filter does not match store invoices).
   - Fails on PostgREST client invocation (parameter naming mismatch).
   - Suffers from double-refund vulnerability if transitioned through multiple approved/received statuses.
   - Is bypassed by `LojaTrocasModule.tsx` during advanced status updates.

All technical requirements, parameters, table dependencies, transaction boundaries, and exact lines of code have been documented in `.agents/spec_miner_survey_1/spec_report.md`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Base Whitelist & Sanitizer Disconnect**:
   - Inspect `supabase/migrations/20260716183010_update_checkout_function.sql` at lines 147-151 and lines 186-196.
   - Inspect `supabase/migrations/20260817120000_product_variations_marketplace.sql` at lines 743-750 and lines 832-869.
2. **Verify Schema Discrepancies in Remediation Migration**:
   - Inspect `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql` at lines 143, 146, 163, 176.
   - Inspect `supabase/migrations/20260803173000_fix_points_movement_type_check_constraint.sql` at line 32 to observe allowed `tipo` values on `pontos_movimentacoes`.
   - Inspect `src/components/admin/LojaTrocasModule.tsx` at lines 93-98 to observe caller parameter names.
3. **Run Concurrency and Post-Sales Verification Suites**:
   - `npx vitest run src/tests/marketplace-checkout-concurrency-audit.test.ts`
   - `npx vitest run src/tests/marketplace-returns-exchanges-atomicity.test.ts`
   - Invalidation condition: If `carteira_saldo` is demonstrated to exist on `public.clientes` or `'ganho'` is demonstrated to be a valid value in `pontos_movimentacoes_tipo_check`, the respective blocker findings are invalidated.
