# Handoff Report: Marketplace Cart, Checkout, Coupon, Points, Wallet & Promotion Audit

- **Date**: 2026-09-10
- **Agent**: `teamwork_preview_explorer_19_cart` (Explorer)
- **Target**: Marketplace Cart, Checkout, Coupon, Points, Wallet, and Promotion mechanisms
- **Recipient**: Parent Agent (`e03228af-bfd7-4634-ad6a-094821d325f4`)

---

## 1. Observation

Direct observations extracted from the codebase with exact file paths, line numbers, and verbatim code:

### Obs 1: Master Product Price Mutation & Corrupted Restoration
- **File**: `supabase/migrations/20260817120000_product_variations_marketplace.sql`
- **Lines 809–815**:
  ```sql
  v_original_values := v_original_values || jsonb_build_array(jsonb_build_object(
    'produto_id', v_product.id,
    'valor', v_product.valor
  ));
  IF v_variant.valor IS NOT NULL THEN
    UPDATE public.produtos SET valor = v_variant.valor WHERE id = v_product.id;
  END IF;
  ```
- **Lines 824–829**:
  ```sql
  FOR v_original IN SELECT value FROM jsonb_array_elements(v_original_values)
  LOOP
    UPDATE public.produtos
    SET valor = (v_original ->> 'valor')::numeric
    WHERE id = (v_original ->> 'produto_id')::uuid;
  END LOOP;
  ```

### Obs 2: Cart Sanitization Stripping Variant ID and Nullifying Stock Decrement
- **File**: `supabase/migrations/20260817120000_product_variations_marketplace.sql`
- **Lines 743–749**:
  ```sql
  SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tipo', item ->> 'tipo',
    'item_id', item ->> 'item_id',
    'quantidade', item -> 'quantidade',
    'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
  ))) INTO v_sanitized_cart
  FROM jsonb_array_elements(v_cart) source(item);
  ```
- **Lines 846–851 & 880–884**:
  ```sql
  SELECT COALESCE(sum(quantidade), 0) INTO v_requested
  FROM public.loja_pedido_itens
  WHERE orcamento_id = v_order_id
    AND tipo = 'produto'
    AND produto_id = v_variant.produto_id
    AND produto_variante_id = v_variant.id;

  IF v_variant.controle_estoque THEN
    UPDATE public.produto_variantes
    SET estoque_disponivel = estoque_disponivel - v_requested
    WHERE id = v_variant.id;
  END IF;
  ```

### Obs 3: Inverted Discount Precedence between Client and Server
- **Client** (`src/components/client/store/CheckoutPage.tsx`, lines 762–786 & 797–801):
  ```typescript
  let baseCalculo = subtotalComPromos;
  ...
  desc = baseCalculo * ((cupomDesconto.valor_desconto || 0) / 100);
  const totalAntesResgates = Number(Math.max(0, subtotalComPromos - descontoCalculado + taxaEntregaFinal).toFixed(2));
  const maxPontosEmCentavos = Math.floor(totalAntesResgates * 100);
  ```
- **Server** (`supabase/migrations/20260714056000_atomic_session_store_checkout.sql`, lines 546–547 & 585–588):
  ```sql
  v_points := least(v_points, floor(greatest(v_subtotal - v_promo_discount, 0) * 100)::integer);
  v_points_discount := round(v_points * 0.01, 2);
  ...
  v_discount_value := greatest(v_subtotal - v_promo_discount - v_points_discount, 0);
  IF v_coupon.tipo_desconto = 'porcentagem' THEN
    v_discount_value := round((v_discount_value * (v_coupon.valor_desconto / 100.0)), 2);
  ```

### Obs 4: Server PIX Discount Omission
- **Client** (`src/components/client/store/CheckoutPage.tsx`, lines 853–855 & 1097):
  ```typescript
  const pixDiscountValue = isPixDiscountEligible ? parseFloat((baseCalculoPix * (pixPercentage / 100)).toFixed(2)) : 0;
  ...
  forma_pagamento: formaPagamento === 'credito_loja' ? 'credito_loja' : 'outros',
  ```
- **Quote Service** (`src/lib/pixService.ts`, lines 151–154):
  ```typescript
  const quote = await callClientRpc<any>('gsa_client_store_payment_quote', {
    p_orcamento_id: orcamentoId,
  });
  const valorFinal = Number(quote?.total ?? 0);
  ```
- **Server** (`supabase/migrations/20260714056000_atomic_session_store_checkout.sql`, lines 679–682):
  ```sql
  v_total := greatest(round(v_subtotal - v_promo_discount - v_points_discount - v_discount_value + v_delivery_fee - v_wallet_used, 2), 0);
  ```

### Obs 5: Missing Promotional Quota Consumption
- **File**: `supabase/migrations/20260716184000_product_discount_quantity_limit.sql` lines 9–37.
- **Finding**: Table `produto_desconto_cota_movimentos` was created, but zero occurrences of `INSERT INTO public.produto_desconto_cota_movimentos` exist anywhere in checkout migrations, and `produtos.desconto_quantidade_utilizada` is never incremented upon purchase.

### Obs 6: Public Points Conversion RPC Without Identity Check
- **File**: `supabase/migrations/20260828120000_atomic_points_conversion.sql`
- **Lines 5–8 & 92**:
  ```sql
  CREATE OR REPLACE FUNCTION public.gsa_converter_pontos_carteira(
    p_cliente_id uuid,
    p_pontos integer DEFAULT NULL
  )
  ...
  GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) TO anon, authenticated, service_role;
  ```

### Obs 7: Non-Atomic Webhook and Bypass of Invoice Gamification
- **File**: `supabase/functions/gsa-payments/index.ts`
- **Lines 236–260**:
  ```typescript
  if (fatura.status === "pago") return;
  await supabase.from("pagamentos").insert({ ... });
  await supabase.from("faturas").update({
    status: "pago",
    valor_pago: (fatura.valor_pago || 0) + valorPago,
    ...
  }).eq("id", fatura.id);
  ```
- No call is made to `gsa_finalize_paid_invoice_internal(fatura.id)`.

### Obs 8: Cart Variant Overwrite & Visitor Unlimited Coupon Lockout
- **File**: `src/components/client/store/ProductPage.tsx`, lines 508–523: Cart lookup uses `.eq('item_id', product.id)` without variant ID.
- **File**: `src/components/client/ClientGSAStore.tsx`, line 1134:
  ```typescript
  if ((cupom.total_usos || 0) >= (cupom.limite_usos || 0)) return toast.error('Limite de uso do cupom esgotado.');
  ```

### Obs 9: Direct Client-Side Balance Update in Referrals
- **File**: `src/utils/referral.ts`, lines 94–97:
  ```typescript
  const { error: updateError } = await supabase
    .from('clientes')
    .update({ saldo_carteira: newBalance })
    .eq('id', indicator.id);
  ```

---

## 2. Logic Chain

1. **Catalog Master Price Corruption (Obs 1)**:
   - When a user checks out two variants of the same product, the loop queries `SELECT * INTO v_product FROM public.produtos WHERE id = ...`.
   - On the second variant, `v_product.valor` reflects the price set by the first variant (e.g. 50 instead of original 100).
   - Both `[{valor: 100}]` and `[{valor: 50}]` are appended to `v_original_values`.
   - In the restoration loop, the last iteration writes `valor = 50` back to `produtos.valor`.
   - **Conclusion**: The master catalog price is permanently overwritten in the database with the variant price.

2. **Variant Stock Defect (Obs 2)**:
   - `v_sanitized_cart` discards `variante_id` / `produto_variante_id`.
   - `gsa_client_checkout_store_base` inserts `loja_pedido_itens` with `produto_variante_id = NULL`.
   - The outer wrapper queries `loja_pedido_itens WHERE produto_variante_id = v_variant.id`.
   - Since the column is NULL, 0 rows match; `v_requested` is 0.
   - `estoque_disponivel` is decremented by 0, and `variacao_selecionada` updates 0 rows.
   - **Conclusion**: Variant stock is never decremented, and orders lose all variant details.

3. **Inverted Discount Precedence (Obs 3)**:
   - The frontend calculates percentage coupons over the item subtotal before points deduction.
   - The server calculates percentage coupons over `(subtotal - points)`.
   - As a consequence, the server order total is higher than what the client calculated and displayed whenever both points and a percentage coupon are applied.

4. **Server PIX Discount Omission (Obs 4)**:
   - The client reduces the displayed total by 5% when PIX is selected.
   - The client submits `forma_pagamento: 'outros'` with no PIX discount value to `gsa_client_checkout_store`.
   - The server stores the full undiscounted total in `orcamentos.total`.
   - `createInfinitePayOrderCheckout` queries `gsa_client_store_payment_quote` and charges the undiscounted amount in the generated QR code.
   - **Conclusion**: The customer is charged 5% more than displayed.

5. **Promotional Quota Leaks (Obs 5)**:
   - Tables and columns for promotional quantity quotas exist, but no consumption logic was placed in `gsa_client_checkout_store`.
   - **Conclusion**: Quotas are never consumed; promotions with quantity caps never expire on checkout.

6. **Public Unauthenticated Points Draining (Obs 6)**:
   - Function `gsa_converter_pontos_carteira` has `SECURITY DEFINER` and is granted to `anon`.
   - It takes `p_cliente_id` as input with no session verification.
   - **Conclusion**: Any caller can forcibly drain points for any user ID.

7. **Webhook Double-Entry and Missing Loyalty (Obs 7)**:
   - The webhook edge function has no atomic mutex on `fatura.status`. Multiple concurrent webhooks double-credit payment records.
   - The webhook does raw table updates rather than executing `gsa_finalize_paid_invoice_internal`.
   - **Conclusion**: Paid store orders never award loyalty points or VIP level upgrades.

8. **Cart Variant Overwrite and Unlimited Coupon Lockout (Obs 8)**:
   - `ProductPage.tsx` searches cart items only by `product.id`, so adding a second variant overwrites the first variant.
   - `ClientGSAStore.tsx` treats `limite_usos = null` as 0, locking out guests from all unlimited coupons.

9. **Referral Update Violation (Obs 9)**:
   - `src/utils/referral.ts` tries to directly update `clientes.saldo_carteira`.
   - Database triggers guard `saldo_carteira` against direct updates, causing referral bonus credit operations to throw unhandled exceptions.

---

## 3. Caveats

- **External Gateway Implementation**: InfinitePay API endpoints and secret keys are configured in environment variables and external services; tests could not execute live card charges or live PIX settlements against the live bank.
- **Legacy Admin Routes**: The analysis focused on the store customer checkout flow. Admin-side manual order creation routines were audited only where they interface with shared order tables.
- **No Direct Source Changes Made**: As an Explorer agent with read-only mandates, no application code was modified in `src/` or `supabase/`. All proposed fixes are provided in `analysis.md` and this handoff.

---

## 4. Conclusion

The marketplace checkout and promotion subsystem contains multiple severe bugs and security vulnerabilities:
1. Two P0 flaws compromise the core database: master product price corruption (`produtos.valor`) and variant inventory failure.
2. A critical security flaw allows unauthenticated conversion of arbitrary client loyalty points.
3. Multiple P1 flaws produce monetary discrepancies: client/server calculation desync, PIX discount omission in InfinitePay charges, double-entry payment webhooks, and failing referral credits.

Immediate remedial action is required before processing live customer traffic on products with variants, PIX discounts, or promotional limits.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Variant Master Price Corruption (FLAW-01)**:
   Inspect lines 809–829 in `supabase/migrations/20260817120000_product_variations_marketplace.sql`. Notice that when two items have the same `produto_id`, `v_original_values` stores the mutated price on iteration 2 and applies it in iteration 2 of the restoration loop.
   Run SQL test query:
   ```sql
   -- Create a product with valor = 100 and two variants (valor = 50 and valor = 150).
   -- Execute gsa_client_checkout_store with a cart containing both variants.
   -- Query SELECT valor FROM produtos WHERE id = <product_id>;
   -- Observe valor is now 50 instead of 100.
   ```

2. **Verify Variant Stock Bypass (FLAW-02)**:
   Inspect lines 743–749 and 846–851 of `20260817120000_product_variations_marketplace.sql`. Check that `v_sanitized_cart` does not include `variante_id`, causing `loja_pedido_itens.produto_variante_id` to be NULL and `v_requested` to evaluate to 0.

3. **Verify Points & Coupon Precedence Desync (FLAW-03)**:
   Compare `src/components/client/store/CheckoutPage.tsx:780-798` against `supabase/migrations/20260714056000_atomic_session_store_checkout.sql:585`. Observe that client bases coupon on `subtotalComPromos`, while server bases coupon on `(v_subtotal - v_promo_discount - v_points_discount)`.

4. **Verify PIX Discount Omission (FLAW-04)**:
   Inspect `CheckoutPage.tsx:1097` (passes `forma_pagamento: 'outros'`), `pixService.ts:151-154` (reads `quote.total`), and `20260714056000_atomic_session_store_checkout.sql:679-682` (total calculation has no PIX discount term).

5. **Verify Points Conversion Authorization Vulnerability (FLAW-06)**:
   Inspect `supabase/migrations/20260828120000_atomic_points_conversion.sql:92`. Note that `GRANT EXECUTE ... TO anon` allows unauthenticated callers to execute the function for any `p_cliente_id`.

6. **Run Existing Test Suite**:
   Run Vitest across the project:
   ```powershell
   npm test
   ```
