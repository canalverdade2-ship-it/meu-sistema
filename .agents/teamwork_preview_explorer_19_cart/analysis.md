# Deep Static Code Audit: Cart, Checkout, Coupons, Points, Wallet & Promotions

**Audit Date**: 2026-09-10  
**Target Repository**: Grupo GSA Store & Marketplace  
**Auditor**: Teamwork Explorer (`teamwork_preview_explorer_19_cart`)  
**Scope**: Frontend React/TS components, Supabase Edge Functions, and PostgreSQL migrations handling cart operations, checkout flows, coupon validation, loyalty gamification, wallet balance deductions, and promotional engines.

---

## 1. Executive Summary & Risk Matrix

This audit evaluated the transactional integrity, security posture, and mathematical synchronization across the entire Grupo GSA marketplace purchasing pipeline. 

Nine (9) critical vulnerabilities were uncovered. The most severe issues allow:
1. **Permanent catalog master price corruption** for all future users when orders contain product variations.
2. **Zero stock deduction and missing variant metadata** on orders involving product variations.
3. **Severe price discrepancies and consumer law violations** due to inverted calculation precedence between frontend and backend and complete omission of PIX discounts by the server.
4. **Unauthenticated privilege escalation** enabling unauthorized conversion of arbitrary customer loyalty points into wallet credit.
5. **Double-entry financial race conditions** and omission of loyalty points progression during InfinitePay webhook processing.

### Risk Summary Table

| ID | Vulnerability / Defect | Severity | Affected Components | Primary Impact |
|---|---|---|---|---|
| **FLAW-01** | Master Catalog Price Corruption on Variant Checkout | **CRITICAL (P0)** | `supabase/migrations/20260817120000_product_variations_marketplace.sql` | Permanent database corruption of `produtos.valor` to lower variant prices. |
| **FLAW-02** | Zero Variant Stock Deduction & Missing Variant Item Records | **CRITICAL (P0)** | `supabase/migrations/20260817120000_product_variations_marketplace.sql` | Variant stock is never decremented; orders lose all variant specifications. |
| **FLAW-03** | Inverted Discount Calculation Order (Coupon vs Points) | **HIGH (P1)** | `CheckoutPage.tsx` vs `20260714056000_atomic_session_store_checkout.sql` | Client/server mathematical desync; orders created with unexpected totals. |
| **FLAW-04** | Complete Server Omission of 5% PIX Discount | **HIGH (P1)** | `CheckoutPage.tsx`, `pixService.ts`, `20260714056000_atomic_session_store_checkout.sql` | Frontend displays discounted price, but server charges full price to InfinitePay. |
| **FLAW-05** | Promotional Quantity Quotas Never Consumed on Checkout | **HIGH (P1)** | `20260716184000_product_discount_quantity_limit.sql`, `20260714056000_atomic_session_store_checkout.sql` | Infinite promotional units sold; stock limits for discounted prices are non-functional. |
| **FLAW-06** | Unauthenticated Points Draining via Public RPC | **CRITICAL (P0)** | `supabase/migrations/20260828120000_atomic_points_conversion.sql` | Any anonymous caller can convert points to wallet credit for any client UUID. |
| **FLAW-07** | InfinitePay Webhook Race Condition & Missing Points Accrual | **HIGH (P1)** | `supabase/functions/gsa-payments/index.ts` | Duplicate payment entries on webhook retries; customer loyalty points bypassed. |
| **FLAW-08** | Cart Variant Overwrite & Guest Unlimited Coupon Lockout | **MEDIUM (P2)** | `ProductPage.tsx`, `ClientGSAStore.tsx` | Cannot purchase multiple variants of same item; unlimited coupons blocked for visitors. |
| **FLAW-09** | Direct Client-Side Balance Update Violation in Referrals | **HIGH (P1)** | `src/utils/referral.ts` | Referral balance bonuses crash with RLS and trigger mutation errors. |

---

## 2. Domain Audit 1: Cart Management & Storage Mechanics

### 2.1 Storage Architecture & Multi-Source Desynchronization
Cart items are managed across two distinct storage mechanisms:
1. **Guest / Visitor Mode**: Persisted in `localStorage` under `gsa_guest_store_cart`.
2. **Authenticated Mode**: Persisted in PostgreSQL table `loja_carrinhos` via RPC and `clientOperationalWrite`.

**Key Observation**: When migrating cart from `localStorage` to `loja_carrinhos` upon login (`ClientGSAStore.tsx`), or when adding items directly from `ProductPage.tsx`:
- Items are grouped and matched **solely by `item_id` (Product ID)**, completely neglecting `produto_variante_id`.
- If a customer adds 1 unit of "Size M" and subsequently adds 1 unit of "Size XL", `ProductPage.tsx` executes:
  ```typescript
  const { data: existing } = await supabase
    .from('loja_carrinhos')
    .select('id, quantidade')
    .eq('cliente_id', clientId)
    .eq('item_id', product.id)
    .maybeSingle();
  ```
  This identifies the existing "Size M" entry, sums the quantities to `2`, and overwrites `produto_variante_id` with the new variant ("Size XL"). The customer's basket loses the original variant.

### 2.2 In-Flight Price & Stock Stale Closures
When the cart is viewed in `CartDrawer.tsx` or `CheckoutPage.tsx`:
- Subtotals are calculated using `item.item_detalhes.valor`. If prices or promotional rules change in the database while an item sits in the cart, the frontend does not re-fetch real-time item prices until page reload.
- The server checkout RPC re-evaluates prices, but because of **FLAW-01**, running the checkout RPC with variants actually alters the master catalog price.

---

## 3. Domain Audit 2: Checkout Flow, Order Creation & State Transitions

### 3.1 Idempotency Mechanics
- The checkout flow uses `request_id` generated via `crypto.randomUUID()` to prevent duplicate submissions.
- `gsa_client_checkout_store` checks `orcamentos.checkout_request_id`:
  ```sql
  IF v_existing_order.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'orcamento_id', v_existing_order.id,
      'codigo_orcamento', v_existing_order.codigo_orcamento,
      'already_exists', true
    );
  END IF;
  ```
- While idempotency protects order creation, **payment retry** logic in `PurchasesPage.tsx` and `CheckoutPixModal.tsx` re-generates payment charges without verifying whether an existing pending charge was already initiated, creating multiple active payment requests.

### 3.2 Address Validation Integrity
- `CheckoutPage.tsx` collects delivery address fields (`cep`, `logradouro`, `numero`, `bairro`, `cidade`, `estado`).
- In the backend RPC `gsa_client_checkout_store`, address validation is minimal:
  ```sql
  v_delivery_address := p_payload -> 'endereco_entrega';
  -- Simply serialized to jsonb on orcamentos.endereco_entrega
  ```
- If the cart contains only physical products and `taxa_entrega_fixa` is applied, there is no server-side validation ensuring `numero` or `cep` is structurally valid or matches the delivery region.

---

## 4. Domain Audit 3: Loyalty Points System

### 4.1 Points Conversion Mechanism
The system defines 1 point = R$ 0.01 (100 points = R$ 1.00). Customers can use points during checkout or convert points into wallet balance.
- **Checkout Points Deduction**: In `gsa_client_checkout_store`, points are capped at:
  ```sql
  v_points := least(v_points, floor(greatest(v_subtotal - v_promo_discount, 0) * 100)::integer);
  v_points_discount := round(v_points * 0.01, 2);
  ```
- Points are deducted from `clientes.saldo_pontos` atomically inside the checkout transaction.

### 4.2 Security Defect in Standalone Points Conversion (FLAW-06)
In `supabase/migrations/20260828120000_atomic_points_conversion.sql`, function `public.gsa_converter_pontos_carteira(p_cliente_id uuid, p_pontos integer)` was granted to `anon`:
- It does not check session identity (`gsa_validate_session`) or `auth.uid()`.
- Any external caller can pass any arbitrary `cliente_id` and drain all loyalty points into wallet credit.

### 4.3 Missing Points Accrual on InfinitePay Payments (FLAW-07)
When store orders are paid via InfinitePay webhook (`supabase/functions/gsa-payments/index.ts`), the edge function performs:
```typescript
await supabase.from("faturas").update({ status: "pago", ... });
await supabase.from("orcamentos").update({ status: "pago", ... });
```
It completely bypasses `public.gsa_finalize_paid_invoice_internal(fatura.id)`. Consequently:
1. `gsa_apply_points_internal` is never triggered.
2. Store customers never receive loyalty points for purchases paid through PIX or Credit Card via InfinitePay.
3. VIP tier progression (`pontos_expiracao`, `nivel_vip`) is stalled.

---

## 5. Domain Audit 4: Coupon Engine

### 5.1 Validation Rules & Stacking
The coupon system supports two categories:
1. `desconto`: Percentage or fixed discount on items.
2. `entrega`: Free shipping or fixed delivery fee.

`CheckoutPage.tsx` allows 1 discount coupon + 1 delivery coupon to be applied concurrently.

### 5.2 Client vs Server Coupon Discrepancy (FLAW-03)
- In `CheckoutPage.tsx`, coupon discount is calculated against `subtotalComPromos`:
  `desc = subtotalComPromos * (cupom.valor_desconto / 100);`
  And points are deducted *after* coupon discount:
  `totalAntesResgates = subtotalComPromos - descontoCalculado + frete;`
- In `gsa_client_checkout_store.sql`, points discount is deducted *before* percentage coupon discount:
  `v_discount_value := greatest(v_subtotal - v_promo_discount - v_points_discount, 0);`
  `v_discount_value := round((v_discount_value * (v_coupon.valor_desconto / 100.0)), 2);`
- **Result**: A customer using a 20% coupon on a R$ 100 cart with R$ 20 in points gets R$ 20 coupon discount on frontend (Total: R$ 60), but the server calculates 20% of (100 - 20) = R$ 16 coupon discount (Total: R$ 64). The checkout fails or leaves an unpaid balance!

### 5.3 Visitor / Guest Unlimited Coupon Lockout (FLAW-08)
In `ClientGSAStore.tsx` line 1134:
```typescript
if ((cupom.total_usos || 0) >= (cupom.limite_usos || 0)) return toast.error('Limite de uso do cupom esgotado.');
```
When `limite_usos` is `null` or `0` (unlimited coupon), `(cupom.limite_usos || 0)` evaluates to `0`. If `total_usos` is `0`, `0 >= 0` evaluates to `true`. This locks out visitors from using any unlimited coupon.

---

## 6. Domain Audit 5: Wallet Balance & Multi-Tender Stacking

### 6.1 Multi-Tender Payment Order
The checkout permits combining:
1. Promotional Quantity Discounts
2. Discount Coupon
3. Shipping Coupon
4. Loyalty Points (Centavos deduction)
5. PIX Discount (5% on eligible items)
6. Wallet Balance (`saldo_carteira`)
7. External Payment Gateway (InfinitePay PIX or Credit Card) OR Store Credit (`credito_loja`)

### 6.2 Negative Balance & Zero-Balance Protections
- In `supabase/migrations/20260714056000_atomic_session_store_checkout.sql`:
  `v_wallet_used := least(v_wallet_used, v_client.saldo_carteira);`
  `v_wallet_used := least(v_wallet_used, greatest(v_subtotal - v_promo_discount - v_points_discount - v_discount_value + v_delivery_fee, 0));`
- This ensures `saldo_carteira` cannot exceed the customer's available balance or the remaining order total.
- Migration `20260817203000_zero_balance_store_checkout.sql` correctly sets `orcamentos.status = 'pago'` and `faturas.status = 'pago'` when the remaining total after wallet/points is R$ 0.00.

### 6.3 PIX Discount Neglect by Server (FLAW-04)
The frontend deducts 5% for PIX payments (`pixDiscountValue`), but `gsa_client_checkout_store` has no calculation or column for PIX discounts. It persists `orcamentos.total` with the pre-PIX discount amount. When `createInfinitePayOrderCheckout` calls `gsa_client_store_payment_quote`, it fetches the server's un-discounted total, generating a PIX QR Code for the full price.

---

## 7. Domain Audit 6: Promotion Rules & Volume Discounts

### 7.1 Quantity-Based Tier Engine
- File: `src/lib/promocaoQuantidadeEngine.ts` and `src/lib/productPricing.ts`.
- `getProductQuantityPriceBreakdown` accurately computes tiered volume breakdowns (e.g. 1-4 units: R$ 10, 5-9 units: R$ 8, 10+ units: R$ 7).
- Server implementation in `gsa_client_checkout_store` reproduces volume evaluations over `produtos.preco_promocional` and `promocoes_loja`.

### 7.2 Promotional Quota Leaks (FLAW-05)
Migration `20260716184000_product_discount_quantity_limit.sql` introduced `desconto_quantidade_limite` and `desconto_quantidade_utilizada`.
However:
- Neither `gsa_client_checkout_store` nor any database trigger increments `desconto_quantidade_utilizada` during purchase.
- No record is inserted into `produto_desconto_cota_movimentos` with `tipo_movimento = 'consumo'`.
- As a consequence, campaigns with unit caps (e.g. "Only first 50 units at 50% OFF") never exhaust their quotas.

---

## 8. Comprehensive Breakdown of the 9 Critical Vulnerabilities

---

### FLAW-01: Permanent Catalog Master Price Corruption via Variant Checkout
- **Severity**: **CRITICAL (P0)**
- **Location**: `supabase/migrations/20260817120000_product_variations_marketplace.sql`, lines 809–830.
- **Root Cause**:
  To support variants without rewriting the legacy base checkout function, the wrapper updates `produtos.valor` to `v_variant.valor` in-place, invokes the base function, and then restores `produtos.valor` from a stored array `v_original_values`.
  ```sql
  -- Lines 809-815:
  v_original_values := v_original_values || jsonb_build_array(jsonb_build_object(
    'produto_id', v_product.id,
    'valor', v_product.valor
  ));
  IF v_variant.valor IS NOT NULL THEN
    UPDATE public.produtos SET valor = v_variant.valor WHERE id = v_product.id;
  END IF;
  ```
  ```sql
  -- Lines 824-829 (Restoration loop):
  FOR v_original IN SELECT value FROM jsonb_array_elements(v_original_values)
  LOOP
    UPDATE public.produtos
    SET valor = (v_original ->> 'valor')::numeric
    WHERE id = (v_original ->> 'produto_id')::uuid;
  END LOOP;
  ```
- **The Exploit / Bug Mechanism**:
  If a customer purchases two variants of the same product (e.g. Product A: base price R$ 100, Variant 1 = R$ 50, Variant 2 = R$ 150):
  1. Item 1 (Variant 1, R$ 50): `v_product.valor` is read as `100`. `v_original_values` appends `[{produto_id: A, valor: 100}]`. `produtos` is updated: `valor = 50`.
  2. Item 2 (Variant 2, R$ 150): `SELECT * INTO v_product FROM produtos WHERE id = A` now reads the freshly updated `50`! `v_original_values` appends `[{produto_id: A, valor: 50}]`. `produtos` is updated: `valor = 150`.
  3. Restoration loop runs sequentially over `v_original_values`:
     - Element 1: sets `produtos.valor = 100`.
     - Element 2: sets `produtos.valor = 50`.
  4. The master catalog price `produtos.valor` is **permanently corrupted to R$ 50** in the database.
  5. Furthermore, between lines 814 and 826, any other user browsing the marketplace sees Product A at the variant price.
- **Remediation**:
  Never mutate master catalog rows in `produtos` to calculate variant prices. Instead, pass variant pricing directly into order items calculation or pass `variante_id` directly into the base checkout routine.

---

### FLAW-02: Zero Variant Stock Deduction & Missing Variant Item Records
- **Severity**: **CRITICAL (P0)**
- **Location**: `supabase/migrations/20260817120000_product_variations_marketplace.sql`, lines 743–749 and 846–885.
- **Root Cause**:
  1. The wrapper builds `v_sanitized_cart` for the base function, stripping `variante_id`:
     ```sql
     SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
       'tipo', item ->> 'tipo',
       'item_id', item ->> 'item_id',
       'quantidade', item -> 'quantidade',
       'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
     ))) INTO v_sanitized_cart
     ```
  2. The base function inserts rows into `loja_pedido_itens` with `produto_variante_id = NULL`.
  3. After the base function returns, the wrapper attempts to compute requested stock for each variant:
     ```sql
     SELECT COALESCE(sum(quantidade), 0) INTO v_requested
     FROM public.loja_pedido_itens
     WHERE orcamento_id = v_order_id
       AND tipo = 'produto'
       AND produto_id = v_variant.produto_id
       AND produto_variante_id = v_variant.id; -- <-- ALWAYS NULL!
     ```
  4. Because `produto_variante_id` is NULL in `loja_pedido_itens`, `v_requested` is always `0`.
  5. The stock decrement executes:
     ```sql
     UPDATE public.produto_variantes
     SET estoque_disponivel = estoque_disponivel - 0 -- v_requested is 0!
     WHERE id = v_variant.id;
     ```
  6. The update to `variacao_selecionada` in `loja_pedido_itens` and `ordens_compra` matches 0 rows.
- **Impact**: Variant stock is never decremented, allowing infinite inventory overselling. Merchants receive orders with no record of which variant (color, size, model) was purchased.

---

### FLAW-03: Inverted Discount Calculation Order (Frontend vs Backend)
- **Severity**: **HIGH (P1)**
- **Location**:
  - Frontend: `src/components/client/store/CheckoutPage.tsx`, lines 756–801.
  - Backend: `supabase/migrations/20260714056000_atomic_session_store_checkout.sql`, lines 546–588.
- **Root Cause**:
  - Frontend applies Coupon first, then Points:
    $$\text{Total} = (\text{Subtotal} - \text{Promos} - \text{Coupon}) + \text{Shipping} - \text{Points}$$
  - Backend applies Points first, then calculates percentage coupon on the remaining base:
    $$\text{Coupon Base} = \text{Subtotal} - \text{Promos} - \text{Points}$$
    $$\text{Coupon Discount} = \text{Coupon Base} \times \frac{\text{Percent}}{100}$$
- **Impact**:
  For an order of R$ 100 with a 20% coupon and 2000 points (R$ 20.00):
  - Frontend expects: R$ 100 - R$ 20 (coupon) - R$ 20 (points) = R$ 60.00.
  - Backend calculates: Points = R$ 20; Coupon = 20% of (100 - 20) = R$ 16.00; Total = R$ 64.00.
  - If paid with wallet balance matching the frontend total (R$ 60.00), the backend computes an unpaid balance of R$ 4.00 and fails or creates an underpaid invoice.

---

### FLAW-04: Server Ignores PIX Discount Completely (5% Price Discrepancy)
- **Severity**: **HIGH (P1)**
- **Location**:
  - `src/components/client/store/CheckoutPage.tsx`, lines 850–855 and 1097.
  - `src/lib/pixService.ts`, line 151.
  - `supabase/migrations/20260714056000_atomic_session_store_checkout.sql`, lines 679–685.
- **Root Cause**:
  `CheckoutPage.tsx` calculates `pixDiscountValue` and displays the discounted amount to the buyer. However, when calling `gsa_client_checkout_store`, it does not pass any PIX discount parameter and passes `forma_pagamento: 'outros'`. The server calculates `orcamentos.total` without the PIX discount.
  Then `createInfinitePayOrderCheckout` fetches `gsa_client_store_payment_quote`, which reads `orcamentos.total` from the server, generating an InfinitePay transaction for the **undiscounted full price**.
- **Impact**: The customer is shown R$ 95.00 on the checkout page, but the PIX QR Code generated charges R$ 100.00. This is a severe compliance violation under consumer protection regulations.

---

### FLAW-05: Promotional Quantity Quotas Never Consumed on Checkout
- **Severity**: **HIGH (P1)**
- **Location**:
  - `supabase/migrations/20260716184000_product_discount_quantity_limit.sql`.
  - `supabase/migrations/20260714056000_atomic_session_store_checkout.sql`.
- **Root Cause**:
  Migration `20260716184000` added `desconto_quantidade_limite` and `desconto_quantidade_utilizada` to `produtos` and created audit table `produto_desconto_cota_movimentos`. However, no consumption logic was added to `gsa_client_checkout_store`.
- **Impact**: `desconto_quantidade_utilizada` remains 0 forever. Flash sale campaigns with limited promotional units never expire based on quantity, resulting in uncontrolled financial loss for merchants.

---

### FLAW-06: Unauthenticated Points Draining via Public `gsa_converter_pontos_carteira`
- **Severity**: **CRITICAL (P0)**
- **Location**: `supabase/migrations/20260828120000_atomic_points_conversion.sql`, lines 5–92.
- **Root Cause**:
  The function `gsa_converter_pontos_carteira(p_cliente_id uuid, p_pontos integer)` is marked `SECURITY DEFINER` and granted to `anon` and `authenticated`:
  ```sql
  GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) TO anon, authenticated, service_role;
  ```
  It does not validate the session token or verify that `p_cliente_id` belongs to the calling user.
- **Impact**: Any malicious actor can call this RPC with any customer's UUID and convert all their loyalty points to wallet balance without authorization, interfering with customer balances and triggering automated financial audit entries.

---

### FLAW-07: InfinitePay Webhook Race Condition & Missing Loyalty Gamification
- **Severity**: **HIGH (P1)**
- **Location**: `supabase/functions/gsa-payments/index.ts`, lines 233–299.
- **Root Cause**:
  1. Non-atomic check-then-act:
     ```typescript
     if (fatura.status === "pago") return;
     await supabase.from("pagamentos").insert({ ... });
     await supabase.from("faturas").update({ valor_pago: (fatura.valor_pago || 0) + valorPago, ... });
     ```
     Concurrent webhook retries both pass the check and double-credit `faturas.valor_pago`.
  2. The webhook directly updates `faturas.status = 'pago'` instead of calling `public.gsa_finalize_paid_invoice_internal(fatura.id)`.
- **Impact**: Double payment records in financial ledgers. Store customers paying via InfinitePay never receive loyalty points or VIP level progress.

---

### FLAW-08: Cart Variant Overwrite & Guest Unlimited Coupon Lockout
- **Severity**: **MEDIUM (P2)**
- **Location**:
  - `src/components/client/store/ProductPage.tsx`, lines 508–523.
  - `src/components/client/ClientGSAStore.tsx`, line 1134.
- **Root Cause**:
  1. `ProductPage.tsx` checks cart item existence using only `item_id = product.id`. Adding variant B of product X overwrites variant A and merges quantities.
  2. `ClientGSAStore.tsx` tests `if ((cupom.total_usos || 0) >= (cupom.limite_usos || 0))` without checking if `limite_usos` is null. When `limite_usos` is null, `0 >= 0` evaluates to true, blocking visitors from using unlimited coupons.

---

### FLAW-09: Direct Client-Side Balance Update Violation in Referrals
- **Severity**: **HIGH (P1)**
- **Location**: `src/utils/referral.ts`, lines 94–97.
- **Root Cause**:
  ```typescript
  const { error: updateError } = await supabase
    .from('clientes')
    .update({ saldo_carteira: newBalance })
    .eq('id', indicator.id);
  ```
  Direct updates to `clientes.saldo_carteira` are strictly forbidden by database trigger `trg_gsa_guard_client_sensitive_profile_fields` and RLS policies.
- **Impact**: Referral reward completions fail with unhandled database errors; referrers never receive their earned referral bonuses.

---

## 9. Strategic Remediation Plan & Patches

### Patch 1: Fix Variant Checkout (FLAWS 01 & 02)
Replace the temporary mutation of `produtos.valor` in `gsa_client_checkout_store`:
1. In `v_sanitized_cart`, **preserve** `variante_id`:
   ```sql
   'variante_id', CASE WHEN item ? 'variante_id' THEN item -> 'variante_id' ELSE NULL END
   ```
2. In `gsa_client_checkout_store_base`, when inserting `loja_pedido_itens`, look up the variant price directly:
   ```sql
   v_item_price := COALESCE(v_variant.valor, v_product.valor);
   ```
3. Remove the dangerous `UPDATE public.produtos SET valor = v_variant.valor` and restoration loop entirely.
4. Pass `produto_variante_id` into `loja_pedido_itens` so `v_requested` and `estoque_disponivel` decrement properly.

### Patch 2: Harmonize Discount Calculation Precedence (FLAWS 03 & 04)
Align the order of operations in `gsa_client_checkout_store` to match e-commerce standard and frontend expectation:
1. Subtotal of items.
2. Deduct Volume / Quantity Promotions.
3. Deduct Discount Coupon (calculated on the promotional subtotal).
4. Add Shipping Fee (less Shipping Coupon).
5. Deduct PIX Discount (if payment method is PIX and rules allow).
6. Deduct Loyalty Points.
7. Deduct Wallet Balance (`saldo_carteira`).
8. Remainder = Gateway Invoice Total.

### Patch 3: Secure Points Conversion RPC (FLAW-06)
1. In `supabase/migrations/20260828120000_atomic_points_conversion.sql`:
   - Revoke public/anon execute on `gsa_converter_pontos_carteira`.
   - Require authenticated session or `service_role`.
   - Validate that `auth.uid()` corresponds to `p_cliente_id` via `public.clientes.auth_user_id`.

### Patch 4: Edge Function InfinitePay Webhook Atomic Finalization (FLAW-07)
In `supabase/functions/gsa-payments/index.ts`:
- Call an atomic SQL RPC (e.g. `gsa_process_gateway_webhook`) wrapped in a single database transaction with row-level locks on `faturas`.
- Inside the transaction, call `gsa_finalize_paid_invoice_internal` to ensure loyalty points and VIP tiers are credited reliably.

### Patch 5: Server RPC for Referral Reward Credits (FLAW-09)
Create an atomic RPC `gsa_process_referral_reward(p_indicacao_id uuid)` with `SECURITY DEFINER` and internal guard bypass to credit `saldo_carteira` and record financial audit logs safely on the backend.
