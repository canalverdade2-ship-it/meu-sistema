# Handoff Report — Post-Sales Workflows Audit

**Agent:** `teamwork_preview_explorer_19_returns`  
**Parent Agent:** `e03228af-bfd7-4634-ad6a-094821d325f4`  
**Date:** 2026-09-10  
**Status:** Complete (Hard Handoff)  
**Deliverable File:** `.agents/teamwork_preview_explorer_19_returns/analysis.md`

---

## 1. Observation

Direct observations and verbatim code extracts from the static code audit:

### Observation A: Returned Items Never Restore Stock and Exchange Items Never Deduct Stock
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\components\admin\LojaTrocasModule.tsx`
- **Lines:** 168–176 and 640–646:
```tsx
<button
  disabled={updatingStatus}
  onClick={() => handleUpdateAdvancedStatus('concluido', { resposta_admin: resolucaoInput })}
  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase rounded-xl tracking-wider transition-colors disabled:opacity-50"
>
  Concluir Devolução & Liberar Estorno
</button>
```
Where `handleUpdateAdvancedStatus` only runs:
```tsx
const { error } = await supabase
  .from('loja_solicitacoes')
  .update({
    status: targetStatus,
    historico_status: novoHistorico,
    ...payload,
    updated_at: new Date().toISOString()
  })
  .eq('id', selectedSolicitacao.id);
```
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260714045000_secure_admin_store_exchange_rpc.sql`
- **Lines:** 1–206 (`gsa_admin_atualizar_solicitacao_loja`):
The function updates `loja_solicitacoes` and conditionally handles credit limit, but contains **zero statements** updating `public.produtos` or `public.produto_variantes`.
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260714056400_secure_client_budget_settlement_and_exchange.sql`
- **Lines:** 594–598 (`gsa_client_request_store_exchange`):
```sql
IF coalesce(v_new_product.controle_estoque, false)
   AND coalesce(v_new_product.estoque_disponivel, v_new_product.estoque, 0) < v_quantity THEN
  RAISE EXCEPTION 'Estoque insuficiente para o produto substituto %.', v_new_product.nome;
END IF;
```
The check verifies stock availability, but never decrements or reserves it.

### Observation B: Order Cancellations Skip `produto_variantes`
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260714056100_secure_store_invoice_and_cancellation.sql`
- **Lines:** 258–282 (`gsa_client_cancel_store_order`):
```sql
  IF v_has_normalized_items THEN
    UPDATE public.produtos p
    SET estoque_disponivel = p.estoque_disponivel + quantities.quantity
    FROM (
      SELECT item.produto_id, sum(item.quantidade)::integer AS quantity
      FROM public.loja_pedido_itens item
      WHERE item.orcamento_id = p_orcamento_id
        AND item.tipo = 'produto'
        AND item.produto_id IS NOT NULL
      GROUP BY item.produto_id
    ) AS quantities
    WHERE p.id = quantities.produto_id
      AND coalesce(p.controle_estoque, false);
```
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260817120000_product_variations_marketplace.sql`
- **Lines:** 36–99:
Defines table `public.produto_variantes` with column `estoque_disponivel`, and links it to `loja_pedido_itens.produto_variante_id` and `ordens_compra.produto_variante_id`. Neither `gsa_client_cancel_store_order` nor `gsa_admin_cancel_store_order` references `produto_variantes`.

### Observation C: Disjoint Silos Between Returns (`loja_solicitacoes`) and Refunds (`loja_reembolsos`)
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\components\admin\LojaTrocasModule.tsx`
- **Lines:** 633–646: The "Concluir Devolução & Liberar Estorno" button updates only `loja_solicitacoes.status = 'concluido'`.
- There is NO SQL statement in any migration or frontend component inserting into `loja_reembolsos` or crediting `clientes.saldo_carteira` when a return reaches `concluido`.

### Observation D: Earned Points and Referral Commissions are Never Revoked
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260803174500_fix_gsa_finalize_paid_invoice_points_type.sql`
- **Lines:** 348–396: Points are credited to buyer via `gsa_apply_points_internal` and cash/points referral bonus is credited to `v_indicador`.
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260714056100_secure_store_invoice_and_cancellation.sql`
- **Lines:** 304–319: `gsa_client_cancel_store_order` only restores spent discount points (`v_points_to_restore := round(v_points_discount * 100)`). It has no logic to deduct the earned points or claw back the referrer bonus.

### Observation E: Unproportional Return Credits on Partial Returns
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260714056400_secure_client_budget_settlement_and_exchange.sql`
- **Lines:** 556–570 (`gsa_client_request_store_exchange`):
```sql
SELECT valor_unitario INTO v_unit_value
FROM public.loja_pedido_itens
WHERE orcamento_id = v_budget.id
  AND cliente_id = v_actor.cliente_id
  AND tipo = 'produto'
  AND produto_id = v_item.produto_id
ORDER BY created_at
LIMIT 1;
v_unit_value := round(coalesce(v_unit_value, v_item.valor), 2);
v_exchange_credit := v_exchange_credit + v_unit_value * greatest(coalesce(v_item.quantidade, 1), 1);
```
`v_unit_value` is gross catalog price without factoring order-level discounts (`desconto_cupom`, `desconto_promocional`, `desconto_pontos`, `abatimento_carteira`).

### Observation F: Permissive RLS on `loja_solicitacoes`
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\20260830030000_admin_panel_security_end_to_end.sql`
- **Lines:** 620–623:
```sql
CREATE POLICY gsa_client_own_loja_solicitacoes_hardened ON public.loja_solicitacoes FOR ALL TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id())
WITH CHECK (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
```
`FOR ALL` gives authenticated clients full `UPDATE` and `DELETE` privileges on their return records.

### Observation G: Admin Screen Fracture on Refunds
- **File:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\components\admin\ReembolsosModule.tsx` (lines 250–260) vs. `src\components\admin\super-domains\financeiro\RentabilidadeReembolsosView.tsx` (lines 66–86).
`ReembolsosModule.tsx` performs a direct `supabase.from('loja_reembolsos').update({ status: 'pago' })` without crediting `clientes.saldo_carteira` or creating ledger entries.

---

## 2. Logic Chain

1. **Inventory Breakdown (Observation A + B):**
   - Products with variants store stock in `produto_variantes.estoque_disponivel`.
   - When orders are cancelled, only `produtos` is replenished (Observation B); child variant stock remains reduced.
   - When returns/exchanges are completed, neither `produtos` nor `produto_variantes` is updated (Observation A).
   - Furthermore, replacement exchange items are never deducted upon approval or dispatch.
   - **Inference:** The physical warehouse will have items that the system considers out of stock, and replacement items will be sent without inventory deduction, creating phantom inventory and severe overselling risks.

2. **Financial Dead End on Returns (Observation C + G):**
   - A customer return flows into `loja_solicitacoes`.
   - An administrator marks it as received and completed via `LojaTrocasModule.tsx`.
   - Because `loja_solicitacoes` is completely uncoupled from `loja_reembolsos` and wallet logic, no monetary reimbursement is created (Observation C).
   - Furthermore, if an admin processes an order cancellation refund via `ReembolsosModule.tsx`, direct SQL update is called instead of `gsa_admin_process_store_refund`, bypassing the wallet credit and financial ledger (Observation G).
   - **Inference:** Customers who return items never get refunded, exposing the company to legal action and merchant chargebacks.

3. **Gamification & Commission Exploits (Observation D):**
   - Invoices grant loyalty points to buyers and referral commissions to referrers.
   - Post-sales cancellations restore spent points but never revoke earned points or affiliate commissions.
   - **Inference:** Colluding parties can generate infinite points and referral money through continuous buy-and-cancel loops with zero financial penalty.

4. **Discount Arbitrage (Observation E):**
   - In `gsa_client_request_store_exchange`, return credits are based on gross item values without apportioning coupons or discounts.
   - **Inference:** Returning 1 item from a heavily discounted multi-item basket allows the customer to receive credit equal to the gross item price, effectively retaining the remaining items at zero or near-zero cost.

5. **Authorization Vulnerability (Observation F):**
   - RLS policy `gsa_client_own_loja_solicitacoes_hardened` uses `FOR ALL`.
   - **Inference:** Clients can bypass administrative approval and diff payments by forging updates to their own return requests directly via the Supabase client.

---

## 3. Caveats

- Payment gateway behavior was verified statically via `supabase/functions/gsa-payments/index.ts`. No live test sandbox calls were dispatched to InfinitePay.
- Logistics tracking integrations (Correios / Melhores Envios) rely on string inputs entered by the customer or admin; no live third-party carrier webhook integrations exist in the repository for automatic parcel delivery triggers.
- Database triggers on legacy databases: It is assumed that no hidden external database triggers exist outside the audited migrations in `supabase/migrations/`.

---

## 4. Conclusion

The post-sales ecosystem is currently split into disconnected silos with serious flaws in financial integrity, inventory management, and authorization:
1. Returns never issue financial refunds or restore physical/variant inventory.
2. Order cancellations break product variant stock and leave loyalty points and referral bonuses unclawed.
3. Partial returns allow discount arbitrage on gross values.
4. RLS policies on `loja_solicitacoes` allow client-side tampering.

All findings, evidence, line numbers, and actionable remediation steps have been documented in detail in `.agents/teamwork_preview_explorer_19_returns/analysis.md`.

---

## 5. Verification Method

To independently verify these observations:

1. **Verify Stock Variant Failure:**
   - Inspect `supabase/migrations/20260714056100_secure_store_invoice_and_cancellation.sql` (lines 258–282). Note the absence of any reference to `produto_variantes`.
   - Compare with `supabase/migrations/20260817120000_product_variations_marketplace.sql` (lines 36–99), which introduced `produto_variantes.estoque_disponivel`.

2. **Verify Missing Return Refund & Inventory Restitution:**
   - Inspect `src/components/admin/LojaTrocasModule.tsx` (lines 640–646 and 168–176). Note that `handleUpdateAdvancedStatus` only updates `loja_solicitacoes.status = 'concluido'` and never calls any refund or inventory function.
   - Inspect `supabase/migrations/20260714045000_secure_admin_store_exchange_rpc.sql` (lines 1–206). Confirm that when `v_status = 'concluido'`, no refund or stock operation exists.

3. **Verify Points & Referral Bonus Non-Reversal:**
   - Inspect `supabase/migrations/20260803174500_fix_gsa_finalize_paid_invoice_points_type.sql` (lines 348–396). Note the points and bonus awarded on invoice payment.
   - Inspect `supabase/migrations/20260714056100_secure_store_invoice_and_cancellation.sql` (lines 304–320). Note that only spent points are refunded, and no deduction of earned points or clawback of referral bonuses exists.

4. **Verify Permissive RLS on `loja_solicitacoes`:**
   - Inspect `supabase/migrations/20260830030000_admin_panel_security_end_to_end.sql` (lines 620–623). Confirm `FOR ALL TO authenticated` without column or action restrictions.

5. **Project Build / Typecheck Verification:**
   - Run `npm run build` or inspect TypeScript compilation to ensure clean build environment.
