# Post-Sales Workflows Deep Static Code Audit Report
**Audited Subsystems:** Returns, Exchanges, Reversals, Refund Calculations, Wallet Credits, Loyalty Points Reversals, Stock Inventory Replenishment  
**Author:** `teamwork_preview_explorer_19_returns`  
**Date:** 2026-09-10  
**Project Root:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`  
**Audit Scope:** End-to-end static code audit of React frontend components, Supabase PL/pgSQL database migrations, RPC procedures, Edge Functions, and operational workflows.

---

## 1. Executive Summary

A comprehensive static code investigation of the GSA HUB marketplace post-sales architecture revealed **critical systemic defects** across the entire lifecycle of order cancellations, returns, exchanges, refunds, loyalty points accounting, and stock inventory replenishment.

### Key High-Severity Vulnerabilities Identified:
1. **Complete Absence of Stock Replenishment on Returns & Exchanges:** When a product is returned by a customer and accepted/concluded by an administrator (`loja_solicitacoes`), zero inventory replenishment occurs in `produtos` or `produto_variantes`. The returned stock is permanently lost from inventory records. Furthermore, when substitute exchange products are chosen (`outro_produto`), stock is checked once at request time but never reserved or deducted upon approval or shipment.
2. **Product Variants (`produto_variantes`) Inventory Ignored on Cancellations:** Both customer cancellations (`gsa_client_cancel_store_order`) and admin cancellations (`gsa_admin_cancel_store_order`) restore inventory exclusively to parent `produtos.estoque_disponivel`, completely ignoring the child `produto_variantes.estoque_disponivel`. Variant stock remains permanently decremented after cancellations.
3. **Disjointed Silos: Returns (`loja_solicitacoes`) vs. Refunds (`loja_reembolsos`):** When an admin concludes a customer return in `LojaTrocasModule.tsx` ("Concluir Devolução & Liberar Estorno"), the frontend updates only `loja_solicitacoes.status = 'concluido'`. It never inserts into `loja_reembolsos`, never issues a wallet credit, never initiates a financial refund, and never reverses loyalty points. The customer receives a success notification but zero reimbursement.
4. **Earned Loyalty Points and Referral Bonuses Never Revoked:** Customers who complete a purchase receive loyalty points (and referrers receive cash wallet bonuses + points). Upon cancellation or return, spent points are restored, but **earned points and referral bonuses are never clawed back**, enabling infinite points/bonus generation exploits through purchase-and-cancel loops.
5. **Gross Price Return Arbitrage on Partial Returns:** `gsa_client_request_store_exchange` computes exchange credit based on the raw unit price (`loja_pedido_itens.valor_unitario * quantidade`). It fails to proportionally apportion coupons, promotional buy-X-get-Y discounts, points discounts, or wallet abatements across items. A customer returning 1 of 2 items in an order discounted by 50% receives 100% of that item's gross price as credit, keeping the second item for free.
6. **Multi-Unit Item Partial Return Inability:** Return selection accepts only `ordens_compra.id` and multiplies by the total order quantity. If a customer ordered 5 units of an item, they cannot return 1 or 2; it is strictly all 5 or none.
7. **Overly Permissive RLS Policy on `loja_solicitacoes`:** Migration `20260830030000_admin_panel_security_end_to_end.sql` applied a policy `FOR ALL TO authenticated` on `loja_solicitacoes` with only `cliente_id=public.gsa_jwt_actor_id()`. This allows any authenticated customer to directly issue SQL `UPDATE` statements from browser devtools, forging approval statuses (`status = 'concluido'`) or modifying difference amounts.
8. **Admin Panel Screen Discrepancy (`ReembolsosModule.tsx` vs `RentabilidadeReembolsosView.tsx`):** In `CadastroModule.tsx`, the store refunds view uses `ReembolsosModule.tsx`, which executes direct `supabase.from('loja_reembolsos').update({ status: 'pago' })`. This bypasses `gsa_admin_process_store_refund`, meaning the customer's wallet is never credited and no ledger transaction is created.
9. **Zero Automated Payment Gateway Refund Integration:** The payment integration (`supabase/functions/gsa-payments/index.ts`) supports only InfinitePay checkout link creation and incoming payment check. There is no automated refund trigger for card or Pix chargebacks; all external refunds are manual flags with no automated gateway dispatch.

---

## 2. Architecture & Call Chains

### 2.1 Post-Sales Subsystems Map

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CUSTOMER PORTAL                                    │
│                                                                                        │
│  [PurchasesPage.tsx]                 [StoreHub.tsx]                                    │
│          │                                  │                                          │
│          │ Cancel Order                     ├── Request Return/Exchange (Trocas)       │
│          ▼                                  ├── Cancel Order (Minhas Compras)          │
│  gsa_client_cancel_store_order              └── View Refunds (Modal Reembolsos)        │
│          │                                          │                                  │
└──────────┼──────────────────────────────────────────┼──────────────────────────────────┘
           │                                          │
           │                                          ├── callClientRpc('gsa_client_request_store_exchange')
           │                                          └── callClientRpc('gsa_client_store_refunds')
           ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DATABASE / RPC ENGINE                                  │
│                                                                                        │
│  gsa_client_cancel_store_order:             gsa_client_request_store_exchange:         │
│  - Sets orcamentos.status = 'cancelado'     - Validates 7-day delivery window          │
│  - Restores produtos.estoque_disponivel     - Calculates v_exchange_credit             │
│  - Restores spent wallet & spent points     - Inserts into loja_solicitacoes           │
│  - Inserts into loja_reembolsos (if cash)   - (CRITICAL: Does NOT touch inventory)     │
│                                                                                        │
└──────────┬──────────────────────────────────────────┬──────────────────────────────────┘
           │                                          │
           ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               ADMIN WORKSTATION & LOGISTICS                            │
│                                                                                        │
│  [RentabilidadeReembolsosView.tsx]          [LojaTrocasModule.tsx]                     │
│  - gsa_admin_process_store_refund           - gsa_admin_atualizar_solicitacao_loja     │
│    - credito_carteira: credits wallet       - handleUpdateAdvancedStatus (Direct SQL!) │
│    - aprovar_externo: waiting flag          - Button "Concluir & Liberar Estorno"      │
│    - confirmar_externo: manual ref string     (CRITICAL: Never creates refund or       │
│                                                restores stock!)                        │
│                                                                                        │
│  [ReembolsosModule.tsx] (In CadastroModule)                                            │
│  - Direct UPDATE on loja_reembolsos (CRITICAL: Never credits wallet or ledger!)        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Deep Static Code Audit: Detailed Findings

---

### Finding 1: Returned/Exchanged Items Never Replenish Stock & Substitute Items Never Deduct Stock

- **Target Files:**
  - `supabase/migrations/20260714045000_secure_admin_store_exchange_rpc.sql` (`gsa_admin_atualizar_solicitacao_loja`)
  - `supabase/migrations/20260714056400_secure_client_budget_settlement_and_exchange.sql` (`gsa_client_request_store_exchange`)
  - `src/components/admin/LojaTrocasModule.tsx` (lines 168-176, 633-680)
- **Classification:** P0 — Critical Financial & Inventory Loss
- **Observed Code:**
  In `LojaTrocasModule.tsx` (lines 640-646):
  ```tsx
  <button
    disabled={updatingStatus}
    onClick={() => handleUpdateAdvancedStatus('concluido', { resposta_admin: resolucaoInput })}
    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase rounded-xl tracking-wider transition-colors disabled:opacity-50"
  >
    Concluir Devolução & Liberar Estorno
  </button>
  ```
  Where `handleUpdateAdvancedStatus` (lines 168-176) executes:
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
  And in `gsa_admin_atualizar_solicitacao_loja` (lines 69-74 of migration `20260714045000_secure_admin_store_exchange_rpc.sql`):
  ```sql
  UPDATE public.loja_solicitacoes
     SET status = v_status_to_save,
         historico_status = v_historico,
         resposta_admin = coalesce(nullif(trim(coalesce(p_resposta_admin, '')), ''), v_sol.resposta_admin),
         updated_at = now()
   WHERE id = p_solicitacao_id;
  ```
  In `gsa_client_request_store_exchange` (lines 594-598 of migration `20260714056400_secure_client_budget_settlement_and_exchange.sql`):
  ```sql
  IF coalesce(v_new_product.controle_estoque, false)
     AND coalesce(v_new_product.estoque_disponivel, v_new_product.estoque, 0) < v_quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto substituto %.', v_new_product.nome;
  END IF;
  ```
- **Logic Chain & Root Cause:**
  1. When a client requests a return/exchange, `gsa_client_request_store_exchange` checks whether substitute items have stock (`estoque_disponivel < v_quantity`), but **never reserves or deducts it**.
  2. When the admin approves the exchange (`gsa_admin_atualizar_solicitacao_loja`) or when the return is received and concluded (`devolucao_recebida` -> `concluido` in `LojaTrocasModule.tsx`), there is **zero SQL logic** or RPC invocation that updates `public.produtos` or `public.produto_variantes`.
  3. The returned merchandise is received at the warehouse, but the digital catalog keeps the inventory reduced forever.
  4. The substitute merchandise sent to the customer is dispatched without ever deducting the stock from the catalog, leading to overselling.
- **Risk Analysis:**
  Complete desynchronization between physical inventory and system inventory. Returned products become "ghost items" that cannot be sold online, while replacement products cause overselling and unfulfillable orders.
- **Recommended Remediation:**
  1. Create a dedicated transactional RPC `gsa_admin_concluir_devolucao_loja(p_sessao_id, p_session_token, p_solicitacao_id, p_destinacao_estoque)` that executes atomically inside Postgres:
     - For returned items: Restores `estoque_disponivel` in `public.produtos` and in `public.produto_variantes` (if item has variant).
     - Records entry in `public.loja_estoque_historico` with motivo `'Retorno de devolução #' || codigo_solicitacao`.
     - For exchange substitute items (`novo_produto_enviado`): Deducts `estoque_disponivel` from `public.produtos` and `public.produto_variantes` upon approval or dispatch.

---

### Finding 2: Cancellations Only Restore Parent Product Stock, Leaving `produto_variantes` Permanently Decremented

- **Target Files:**
  - `supabase/migrations/20260714056100_secure_store_invoice_and_cancellation.sql` (`gsa_client_cancel_store_order`, lines 258-282)
  - `supabase/migrations/20260721010000_harden_products_and_subscriptions.sql` (`gsa_admin_cancel_store_order`, lines 336-353)
  - `supabase/migrations/20260817120000_product_variations_marketplace.sql` (lines 36-99)
- **Classification:** P0 — Data Corruption & Broken Stock on Product Variants
- **Observed Code:**
  In `gsa_client_cancel_store_order` (lines 258-282):
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
  ELSE
    UPDATE public.produtos p
    SET estoque_disponivel = p.estoque_disponivel + quantities.quantity
    FROM (
      SELECT oc.produto_id, sum(coalesce(oc.quantidade, 1))::integer AS quantity
      FROM public.ordens_compra oc
      WHERE oc.orcamento_id = p_orcamento_id
      GROUP BY oc.produto_id
    ) AS quantities
    WHERE p.id = quantities.produto_id
      AND coalesce(p.controle_estoque, false);
  END IF;
  ```
  And in `gsa_admin_cancel_store_order` (lines 336-339):
  ```sql
  IF v_item.status <> 'cancelado' AND v_item.estoque_estornado_em IS NULL THEN
    UPDATE public.produtos
    SET estoque_disponivel = COALESCE(estoque_disponivel, 0) + COALESCE(v_item.quantidade, 1)
    WHERE id = v_item.produto_id AND COALESCE(controle_estoque, false);
  ```
- **Logic Chain & Root Cause:**
  1. Migration `20260817120000_product_variations_marketplace.sql` introduced variant management:
     - `public.produto_variantes` has column `estoque_disponivel`.
     - `public.loja_pedido_itens` has column `produto_variante_id`.
     - `public.ordens_compra` has column `produto_variante_id`.
  2. In `checkout_pedido` / `gsa_client_checkout_store`, when a variant is purchased, stock is deducted from `produto_variantes.estoque_disponivel`.
  3. However, neither `gsa_client_cancel_store_order` nor `gsa_admin_cancel_store_order` was ever updated to check for `produto_variante_id`!
  4. Both cancellation functions ONLY update `public.produtos`.
- **Risk Analysis:**
  If a customer cancels an order for a variant item (e.g. Size "G" or Color "Azul"), the parent product's generic stock counter is incremented, but the specific variant stock in `produto_variantes` remains 0 or reduced. The variant remains permanently marked "Out of Stock" on the store frontend, blocking future sales.
- **Recommended Remediation:**
  In both `gsa_client_cancel_store_order` and `gsa_admin_cancel_store_order`, add variant replenishment:
  ```sql
  -- Restore product variant stock if applicable
  UPDATE public.produto_variantes pv
  SET estoque_disponivel = pv.estoque_disponivel + v_qty
  WHERE pv.id = v_item.produto_variante_id;
  ```

---

### Finding 3: Return Completion (`loja_solicitacoes`) is Disconnected from Refunds (`loja_reembolsos`) & Wallet

- **Target Files:**
  - `src/components/admin/LojaTrocasModule.tsx` (lines 633-646)
  - `supabase/migrations/20260714045000_secure_admin_store_exchange_rpc.sql`
  - `supabase/migrations/20260829211500_marketplace_security_refund_checkout_hardening.sql`
- **Classification:** P0 — Broken Post-Sales Financial Fulfillment
- **Observed Code:**
  In `LojaTrocasModule.tsx`:
  ```tsx
  {/* Status: DEVOLUÇÃO RECEBIDA (Correios) */}
  {selectedSolicitacao.status === 'devolucao_recebida' && (
    selectedSolicitacao.tipo === 'devolucao' ? (
      <div className="space-y-4 bg-white p-4 rounded-xl border border-amber-150">
        <div className="p-3 bg-amber-50 rounded-lg text-amber-900 font-semibold text-xs leading-normal">
          ✅ <strong>Produto Devolvido Recebido!</strong> Como esta solicitação é uma <strong>devolução</strong>, não há novo produto a enviar. Conclua para finalizar o estorno ao cliente.
        </div>
        <button
          disabled={updatingStatus}
          onClick={() => handleUpdateAdvancedStatus('concluido', { resposta_admin: resolucaoInput })}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase rounded-xl tracking-wider transition-colors disabled:opacity-50"
        >
          Concluir Devolução & Liberar Estorno
        </button>
      </div>
    ) : ...
  ```
- **Logic Chain & Root Cause:**
  1. The system has two disjoint tables: `loja_solicitacoes` (for customer returns/exchanges) and `loja_reembolsos` (for financial refunds).
  2. When an order is cancelled before shipping (`gsa_client_cancel_store_order`), a row is inserted into `loja_reembolsos`.
  3. But when an order is returned post-delivery via `loja_solicitacoes`, **NO ROW is ever inserted into `loja_reembolsos`**.
  4. Neither `gsa_admin_atualizar_solicitacao_loja` nor `handleUpdateAdvancedStatus` inserts into `loja_reembolsos`, nor do they credit `clientes.saldo_carteira` or dispatch a gateway refund.
  5. The return ends at `status = 'concluido'`, and the customer never receives any money back.
- **Risk Analysis:**
  Direct legal non-compliance with the Consumer Defense Code (CDC Art. 49). Customers return physical merchandise to the merchant, the merchant marks the process as concluded, but the financial refund is never triggered, leading to customer disputes and chargebacks.
- **Recommended Remediation:**
  When `gsa_admin_atualizar_solicitacao_loja` or a dedicated RPC transitions a `devolucao` to `concluido`:
  1. Automatically calculate the net refund amount.
  2. Insert a row into `public.loja_reembolsos` linked to the order and client (or directly credit `clientes.saldo_carteira` if wallet refund was chosen).
  3. Ensure the refund appears in the client's `StoreHub` refunds tab and the admin's `RentabilidadeReembolsosView`.

---

### Finding 4: Earned Loyalty Points and Referral Bonuses are Never Revoked on Cancellation or Return

- **Target Files:**
  - `supabase/migrations/20260714054000_atomic_invoice_payment_and_points.sql` (lines 328-403)
  - `supabase/migrations/20260803174500_fix_gsa_finalize_paid_invoice_points_type.sql` (lines 328-403)
  - `supabase/migrations/20260714056100_secure_store_invoice_and_cancellation.sql` (`gsa_client_cancel_store_order`, lines 293-320)
  - `supabase/migrations/20260721010000_harden_products_and_subscriptions.sql` (`gsa_admin_cancel_store_order`, lines 356-380)
- **Classification:** P0 — Financial Exploit & Gamification Drain
- **Observed Code:**
  In `gsa_finalize_paid_invoice_internal` (lines 348-396 of migration `20260803174500_fix_gsa_finalize_paid_invoice_points_type.sql`):
  ```sql
  -- Bonus given to referrer on invoice payment
  IF v_indicador_tipo IN ('carteira', 'ambos') THEN
    v_bonus_carteira := least(round(greatest(v_gross_value, coalesce(v_fatura.valor_total, 0)) * 0.10, 2), v_indicador_limite);
    UPDATE public.clientes SET saldo_carteira = round(coalesce(saldo_carteira, 0) + v_bonus_carteira, 2) WHERE id = v_indicador.id;
  ...
  -- Points given to buyer on invoice payment
  IF NOT coalesce(v_fatura.pontos_gerados, false) THEN
    v_points_res := public.gsa_apply_points_internal(
      v_fatura.cliente_id,
      round(coalesce(v_fatura.valor_total, 0) * v_pontos_por_real)::integer,
      'Pontos acumulados na fatura ' || coalesce(v_fatura.codigo_fatura, v_fatura.id::text),
      'pagamento_fatura',
      v_orcamento_id,
      false
    );
  ```
  Now look at `gsa_client_cancel_store_order` (lines 304-319 of `20260714056100_secure_store_invoice_and_cancellation.sql`):
  ```sql
  -- ONLY restores points the client SPENT as a discount:
  IF v_points_to_restore > 0 THEN
    v_new_points := coalesce(v_client.saldo_pontos, 0) + v_points_to_restore;
    UPDATE public.clientes SET saldo_pontos = v_new_points WHERE id = v_actor.cliente_id;
    INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, ...) ...
  ```
- **Logic Chain & Root Cause:**
  1. When an order is paid, `gsa_finalize_paid_invoice_internal` grants loyalty points to the buyer and cash wallet bonuses to the referrer.
  2. When the order is cancelled or returned, `gsa_client_cancel_store_order` only restores spent discount points (`v_points_discount * 100`).
  3. **It contains zero logic to deduct the points that were awarded (`pagamento_fatura`)**.
  4. **It contains zero logic to deduct the referral commission granted to `v_indicador`**.
- **Risk Analysis:**
  A fraudulent user or syndicate can:
  - Create Account A (Referrer) and Account B (Referred).
  - Account B places an order for R$ 5,000.
  - Account A receives R$ 20.00 cash + 50 points. Account B receives 5,000 points.
  - Account B cancels the order or returns the merchandise, receiving a 100% refund.
  - Account A keeps the referral bonus; Account B keeps the 5,000 points.
  - Repeating this process drains corporate funds and creates unlimited loyalty currency.
- **Recommended Remediation:**
  In order cancellation and return settlement:
  1. Query `pontos_movimentacoes` for `tipo = 'pagamento_fatura'` linked to the cancelled `orcamento_id` or `fatura_id`.
  2. Deduct those points from `clientes.saldo_pontos` and `pontos_totais` using `gsa_apply_points_internal(cliente_id, -points, 'Estorno de pontos por cancelamento de pedido', 'estorno_credito')`.
  3. Query `indicacoes` and claw back any referral bonus paid for that specific invoice.

---

### Finding 5: Partial Return Gross Price Arbitrage (Missing Proportional Apportionment of Coupons & Discounts)

- **Target Files:**
  - `supabase/migrations/20260714056400_secure_client_budget_settlement_and_exchange.sql` (`gsa_client_request_store_exchange`, lines 556-570)
  - `supabase/migrations/20260714056000_atomic_session_store_checkout.sql` (`orcamentos` & `loja_pedido_itens`)
- **Classification:** P1 — High Financial Leakage
- **Observed Code:**
  In `gsa_client_request_store_exchange`:
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
- **Logic Chain & Root Cause:**
  1. `loja_pedido_itens.valor_unitario` stores the gross list price of the product.
  2. Order-wide discounts are recorded at the header level on `orcamentos`:
     - `desconto_promocional`
     - `desconto_cupom`
     - `desconto_pontos`
     - `abatimento_carteira`
  3. When calculating the return credit for an item, the function reads `valor_unitario` without deducting the proportional share of header discounts!
- **Exploit Scenario:**
  - Customer buys Item 1 (R$ 100) and Item 2 (R$ 100). Subtotal: R$ 200.
  - Customer applies a R$ 80 coupon. Total paid: R$ 120.
  - Customer requests a return of Item 1 only.
  - `gsa_client_request_store_exchange` credits `v_exchange_credit = R$ 100.00`.
  - The customer effectively bought Item 2 (worth R$ 100) for only R$ 20 (paying R$ 120 and getting R$ 100 refunded/credited).
  - The discount of the entire cart was concentrated on the returned item.
- **Recommended Remediation:**
  Apportion discounts proportionally across line items when computing return/exchange credits:
  $$\text{Fator de Rateio} = \frac{\text{Total Líquido Pago do Pedido}}{\text{Subtotal Bruto dos Itens}}$$
  $$\text{Crédito do Item Devolvido} = \text{Valor Bruto do Item} \times \text{Fator de Rateio}$$

---

### Finding 6: Missing Return Quantity Selector (All-or-Nothing on Multi-unit Items)

- **Target Files:**
  - `supabase/migrations/20260714056400_secure_client_budget_settlement_and_exchange.sql` (lines 541-568)
  - `src/components/client/StoreHub.tsx` (lines 1213-1250)
- **Classification:** P2 — Medium Business Logic & UX Flaw
- **Observed Code:**
  In `StoreHub.tsx`:
  ```tsx
  if (selectedExchangeItems.length === 0) {
    toast.error('Selecione pelo menos 1 item do pedido para realizar a troca ou devolução.');
    return;
  }
  ```
  And in `gsa_client_request_store_exchange`:
  ```sql
  FOR v_item_id IN
    SELECT DISTINCT value::uuid
    FROM jsonb_array_elements_text(p_itens_devolvidos) AS selected(value)
  LOOP
    SELECT oc.id, oc.produto_id, oc.quantidade, oc.status ...
    ...
    v_exchange_credit := v_exchange_credit + v_unit_value * greatest(coalesce(v_item.quantidade, 1), 1);
  ```
- **Logic Chain & Root Cause:**
  `p_itens_devolvidos` accepts only an array of UUIDs representing `ordens_compra.id`. The backend multiplies by `v_item.quantidade` directly.
- **Impact:**
  If a customer bought 10 units of an item and 1 unit is defective, selecting that item forces a return request for all 10 units. There is no parameter `quantidade_devolvida` per item.
- **Recommended Remediation:**
  Change `p_itens_devolvidos` from `jsonb` array of UUIDs to `jsonb` array of objects: `[{"ordem_compra_id": "...", "quantidade": 1}]`. Validate `quantidade >= 1 AND quantidade <= oc.quantidade`.

---

### Finding 7: Frontend vs Backend Discrepancy on Rejected Returns

- **Target Files:**
  - `src/components/client/StoreHub.tsx` (lines 1125-1130)
  - `supabase/migrations/20260714056400_secure_client_budget_settlement_and_exchange.sql` (line 537)
- **Classification:** P2 — Broken Error Handling & UI Dead End
- **Observed Code:**
  In `StoreHub.tsx`:
  ```ts
  // Solicitações rejeitadas não devem bloquear uma nova tentativa de troca/devolução
  // dentro do prazo de 7 dias, senão o cliente fica travado para sempre.
  const existingExchangeIds = new Set(
    (existingExchanges || [])
      .filter(ex => ex.status !== 'rejeitado')
      .map(ex => ex.orcamento_origem_id)
      .filter(Boolean)
  );
  ```
  In `gsa_client_request_store_exchange`:
  ```sql
  IF EXISTS (SELECT 1 FROM public.loja_solicitacoes WHERE orcamento_origem_id = v_budget.id) THEN
    RAISE EXCEPTION 'Este pedido já possui uma solicitação de troca ou devolução.';
  END IF;
  ```
- **Logic Chain & Root Cause:**
  The frontend developer attempted to allow a customer whose return was rejected to submit a corrected request. However, the database RPC strictly blocks ANY order that has a row in `loja_solicitacoes`, regardless of its status.
- **Impact:**
  The frontend displays the return button as available. The customer spends time selecting items, writing justifications, and uploading up to 5 photos. Upon submitting, the RPC throws an exception, showing a confusing toast error.
- **Recommended Remediation:**
  Update the database guard to:
  ```sql
  IF EXISTS (
    SELECT 1 FROM public.loja_solicitacoes 
    WHERE orcamento_origem_id = v_budget.id 
      AND status NOT IN ('rejeitado', 'cancelado')
  ) THEN
    RAISE EXCEPTION 'Este pedido já possui uma solicitação de troca ou devolução em andamento.';
  END IF;
  ```

---

### Finding 8: Severe RLS Misconfiguration on `loja_solicitacoes` Allows Direct Client Modifications

- **Target Files:**
  - `supabase/migrations/20260830030000_admin_panel_security_end_to_end.sql` (lines 620-623)
- **Classification:** P0 — Critical Authorization Bypass
- **Observed Code:**
  ```sql
  DROP POLICY IF EXISTS gsa_client_own_loja_solicitacoes_hardened ON public.loja_solicitacoes;
  CREATE POLICY gsa_client_own_loja_solicitacoes_hardened ON public.loja_solicitacoes FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id())
  WITH CHECK (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
  ```
- **Logic Chain & Root Cause:**
  `FOR ALL` grants `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
  The only restriction in `WITH CHECK` is that `cliente_id = public.gsa_jwt_actor_id()`.
  There is NO restriction on which columns can be updated or what status transitions are allowed.
- **Exploit Scenario:**
  A malicious customer opens their browser console and executes:
  ```js
  await supabase
    .from('loja_solicitacoes')
    .update({ 
      status: 'concluido', 
      valor_diferenca: 0, 
      rastreio_cliente: 'CORREIOS-FAKE-123' 
    })
    .eq('id', 'my-solicitacao-id');
  ```
  The update succeeds because the row belongs to their `cliente_id`!
- **Recommended Remediation:**
  1. Revoke `UPDATE` and `DELETE` on `loja_solicitacoes` from `authenticated`.
  2. Change RLS policy to `FOR SELECT TO authenticated`.
  3. All mutations must occur through verified RPCs (`gsa_client_request_store_exchange`, `gsa_client_submit_exchange_tracking`, `gsa_admin_atualizar_solicitacao_loja`).

---

### Finding 9: Missing Validation on Admin Status Transitions & Multiple Credit Restorations

- **Target Files:**
  - `supabase/migrations/20260714045000_secure_admin_store_exchange_rpc.sql` (`gsa_admin_atualizar_solicitacao_loja`)
- **Classification:** P1 — High Financial Integrity Flaw
- **Observed Code:**
  ```sql
  IF v_status = 'aprovado' AND v_sol.orcamento_origem_id IS NOT NULL THEN
    ...
    IF v_tem_fatura_credito THEN
      v_limite_disponivel_novo := coalesce(v_cliente.limite_credito_disponivel, 0) + coalesce(v_orc.total, 0);
      UPDATE public.clientes SET limite_credito_disponivel = v_limite_disponivel_novo WHERE id = v_sol.cliente_id;
      ...
    END IF;
  ```
- **Logic Chain & Root Cause:**
  1. There is no state machine validation defining allowed transitions (e.g. `aprovado` cannot transition back to `em_analise`).
  2. If an admin approves the request, credit is restored.
  3. If the admin sets it back to `em_analise` (for re-evaluation) and approves it a second time, `v_sol.status` matches `em_analise` at start, bypassing line 50 (`IF v_sol.status = v_status_to_save`).
  4. The code runs lines 147-185 a second time, restoring credit twice.
- **Recommended Remediation:**
  Add a column `credito_estornado boolean DEFAULT false` to `loja_solicitacoes`. Check `IF NOT coalesce(v_sol.credito_estornado, false) THEN ... UPDATE loja_solicitacoes SET credito_estornado = true;`.

---

### Finding 10: Inactive/Dead Code Discrepancy in `ReembolsosModule.tsx`

- **Target Files:**
  - `src/components/admin/ReembolsosModule.tsx` (lines 177-198, 250-261)
  - `src/components/admin/super-domains/financeiro/RentabilidadeReembolsosView.tsx` (lines 66-86)
  - `src/components/admin/CadastroModule.tsx` (line 373)
- **Classification:** P1 — Functional Fracture & Discrepancy
- **Observed Code:**
  In `ReembolsosModule.tsx`:
  ```tsx
  const { error } = await supabase
    .from('loja_reembolsos')
    .update({
      status: 'pago',
      data_pagamento: dataPagamentoISO,
      comprovante_url: comprovanteUrl,
      observacoes_pagamento: paymentNotes,
      colaborador_id: colaboradorId || null
    })
    .eq('id', selectedRefund.id);
  ```
  In contrast, `RentabilidadeReembolsosView.tsx` uses:
  ```tsx
  const result = await callAdminRpc<any>('gsa_admin_process_store_refund', {
    p_reembolso_id: selectedRefund.id, 
    p_acao: action, 
    p_metodo: paymentMethod,
    p_referencia: paymentReference.trim() || null, 
    p_comprovante_url: null, 
    p_observacoes: paymentNotes.trim() || null,
  });
  ```
- **Logic Chain & Root Cause:**
  `ReembolsosModule.tsx` is an older, unmigrated module that was left mounted in `CadastroModule.tsx` (`activeTab === 'gsa_store' && activeSubTab === 'reembolsos'`).
  Admins operating in `CadastroModule` execute direct updates on `loja_reembolsos`. If RLS permits (due to permissive admin policies), the refund status becomes `pago` without ever crediting `saldo_carteira` or creating entries in `carteira_lancamentos` or `extrato_financeiro`.
- **Recommended Remediation:**
  Refactor `ReembolsosModule.tsx` to call `gsa_admin_process_store_refund` or deprecate it in favor of `RentabilidadeReembolsosView.tsx`.

---

## 4. Cross-System Post-Sales State Matrix

| Action | `orcamentos.status` | `ordens_compra.status` | `loja_solicitacoes.status` | `loja_reembolsos.status` | `produtos.estoque` | `produto_variantes.estoque` | `clientes.saldo_pontos` | `clientes.saldo_carteira` |
|---|---|---|---|---|---|---|---|---|
| **Initial Order (Paid)** | `pago` | `concluido` / `em_transporte` | N/A | N/A | Decremented | Decremented | Awarded (`+X`) | Debited (if wallet used) |
| **Client Cancel (`gsa_client_cancel_store_order`)** | `cancelado` | `cancelado` | N/A | `pendente` (if cash) | **Restored** | **NOT Restored ❌** | **Earned NOT Revoked ❌** (Spent restored) | Restored |
| **Admin Cancel (`gsa_admin_cancel_store_order`)** | `cancelado` | `cancelado` | N/A | `pendente` (if cash) | **Restored** | **NOT Restored ❌** | **Earned NOT Revoked ❌** (Spent restored) | Restored (if first item) |
| **Return Requested (`gsa_client_request_store_exchange`)** | Unchanged (`pago`) | Unchanged (`concluido`) | `em_analise` | N/A | Unchanged | Unchanged | Unchanged | Unchanged |
| **Return Approved (`gsa_admin_atualizar_solicitacao_loja`)** | Unchanged | Unchanged | `aguardando_instrucoes` | **NOT Created ❌** | **NOT Restored ❌** | **NOT Restored ❌** | Unchanged | Unchanged |
| **Return Concluded (`LojaTrocasModule`)** | Unchanged | Unchanged | `concluido` | **NOT Created ❌** | **NOT Restored ❌** | **NOT Restored ❌** | **NOT Revoked ❌** | **NOT Refunded ❌** |
| **Refund Paid (`RentabilidadeReembolsosView`)** | Unchanged | Unchanged | Unchanged | `pago` | N/A | N/A | N/A | Credited (if wallet) |
| **Refund Paid (`ReembolsosModule`)** | Unchanged | Unchanged | Unchanged | `pago` | N/A | N/A | N/A | **NOT Credited ❌** |

---

## 5. Prioritized Remediation Roadmap for Implementers

### Phase 1: Immediate Critical Fixes (P0)
1. **Unify Returns and Refunds:**
   - Modify the completion flow of `loja_solicitacoes` (when `tipo = 'devolucao'` reaches `concluido`) to automatically insert a row in `loja_reembolsos` or invoke `gsa_admin_process_store_refund` directly with wallet credit or bank refund.
2. **Implement Complete Stock Replenishment:**
   - In `gsa_client_cancel_store_order` and `gsa_admin_cancel_store_order`, add replenishment for `public.produto_variantes.estoque_disponivel`.
   - In return completion, add automated replenishment for returned items to both `produtos` and `produto_variantes`.
   - In exchange approval/shipment, deduct inventory for replacement items from `produtos` and `produto_variantes`.
3. **Revoke Unsafe RLS on `loja_solicitacoes`:**
   - Restrict client access on `loja_solicitacoes` to `SELECT` only. Disallow direct client `UPDATE` or `DELETE`.
4. **Enforce Points & Referral Bonus Reversal:**
   - On order cancellation or return, reverse earned points via `gsa_apply_points_internal` and claw back the referral cash/points bonus paid to the referrer.

### Phase 2: High Priority Structural Improvements (P1)
1. **Proportional Discount & Coupon Apportionment:**
   - Update `gsa_client_request_store_exchange` to calculate return credits proportionally based on the net order total after coupons, promos, wallet, and points.
2. **Synchronize Admin Screens:**
   - Update `ReembolsosModule.tsx` to use `gsa_admin_process_store_refund` with transactional ledger creation, or replace it with `RentabilidadeReembolsosView`.
3. **Idempotency and State Transition Controls:**
   - Add state machine guards in `gsa_admin_atualizar_solicitacao_loja` to prevent duplicate credit restorations.

### Phase 3: UX & Business Enhancements (P2)
1. **Add Return/Exchange Entry Point to `PurchasesPage.tsx`:**
   - Expose the return/exchange modal directly on the primary purchases page for completed orders.
2. **Allow Partial Quantities on Multi-Unit Line Items:**
   - Update return modal and RPC signature to accept return quantity per item.
3. **Fix Rejected Return Resubmission:**
   - Allow customers to submit a new return request if their previous request for the order was rejected within 7 days.
