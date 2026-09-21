# Comprehensive Specification & Technical Survey Report: Marketplace Checkout & Post-Sales ACID Concurrency

- **Author**: `spec_miner_survey_1`
- **Date**: 2026-09-10T22:37:00Z
- **Working Directory**: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\spec_miner_survey_1`
- **Target Context**: User Prompt section `## 2026-09-10T22:29:06Z` in `ORIGINAL_REQUEST.md`
- **Target Migrations**:
  1. `supabase/migrations/20260716183010_update_checkout_function.sql`
  2. `supabase/migrations/20260817120000_product_variations_marketplace.sql`
  3. `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`

---

## 1. Executive Summary

This report establishes the authoritative specification mining and architectural audit for the GSA Marketplace checkout and return/exchange post-sales pipelines.

The audit investigated three successive database migrations and their runtime interaction with the React frontend and PostgreSQL engine. Specifically, we evaluated:
1. **Checkout Concurrency and Variant Pricing (`20260716183010` & `20260817120000`)**: Verification of `v_variant_price` injection, catalog price immutability (`produtos.valor`), row-level locking (`SELECT ... FOR UPDATE`), and stock exhaustion behavior under high concurrency.
2. **Post-Sales Returns and Exchanges Atomicity (`20260910180000`)**: Verification of `gsa_admin_atualizar_solicitacao_loja`, inventory replenishment for parent products and child variants, wallet refunds (`saldo_carteira`), loyalty points restoration (`saldo_pontos`), and credit invoice generation/cancellation.

### Critical Findings Overview:
- **Variant Price Global Overwrite**: The logic injecting `v_variant_price` in `20260716183010` operates exclusively on a local PL/pgSQL variable (`v_product.valor := v_variant_price`). It does **not** issue an `UPDATE public.produtos SET valor = ...`, successfully preventing global catalog price corruption.
- **Critical Cart Sanitization & Variant Inventory Disconnection (Architectural Flaw)**: The wrapper in `20260817120000` strips `variante_id` from the cart before invoking `gsa_client_checkout_store_base_20260817` (to bypass a strict key whitelist in line 150 of the base function). Because the base function receives a sanitized cart with no variant IDs, it inserts `NULL` into `loja_pedido_itens.produto_variante_id`. When execution returns to the wrapper, the wrapper queries `loja_pedido_itens` for the variant ID, finds 0 items, and therefore **never decrements variant inventory** (`estoque_disponivel - 0`), leaving variant stock perpetually unreduced and line snapshots unlinked.
- **Fatal SQL Errors in Returns RPC (`20260910180000`)**:
  1. **Column Does Not Exist**: Uses `carteira_saldo` instead of canonical `saldo_carteira` on `public.clientes`.
  2. **Table Does Not Exist**: Inserts into `public.carteira_movimentacoes` instead of canonical `public.carteira_lancamentos`.
  3. **Check Constraint Violation**: Inserts `tipo = 'ganho'` into `public.pontos_movimentacoes`, which violates check constraint `pontos_movimentacoes_tipo_check` (only `'estorno'` is valid).
  4. **PostgREST Parameter Mismatch**: Named parameters `p_token` and `p_status` in the migration conflict with `p_session_token` and `p_novo_status` called by `LojaTrocasModule.tsx`.
  5. **Credit Invoice Cancellation Query Mismatch**: Checks `itens_faturados @> [{'codigo': 'CRE-' || v_orc.codigo_orcamento}]`, which never matches store checkout invoices, permanently preventing credit limit restoration.
  6. **Double-Restock & Double-Refund Vulnerability**: When a refund transitions from `aprovado` to `devolucao_recebida`, lines 110-211 run twice, multiplying refunded points, wallet balance, and restored stock.
  7. **Frontend Direct Update Bypass**: `LojaTrocasModule.tsx` line 169 performs a direct `supabase.from('loja_solicitacoes').update(...)`, completely bypassing the RPC and any restocking/refund logic.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Checkout | `gsa_client_checkout_store_base_20260817` | Base checkout function executing pricing, promotions, coupons, points, wallet balance, credit limits, and order insertion. | `p_sessao_id` (UUID), `p_session_token` (text), `p_payload` (JSONB with cart, coupons, points, wallet, credit) | JSONB (`success`, `orcamento_id`, `codigo_orcamento`, `status`, totals, promo breakdown) | Throws on invalid session, bad payload, missing stock, negative pricing, locked wallet/points. | `20260716183010_update_checkout_function.sql` |
| 2 | Checkout | Variant Price In-Memory Injection | Overrides `v_product.valor` in local record memory with `produto_variantes.valor` when `variante_id` is supplied. | `v_item ->> 'variante_id'` | Local variable `v_product.valor` updated for price calculation | Ignores if `variante_id` is null or variant not found | `20260716183010_update_checkout_function.sql` L186-196 |
| 3 | Checkout | Individual Product Discount Engine | Computes effective unit price using promotional discount settings (`desconto_ativo`, `desconto_tipo`, `desconto_valor`). | Base product or variant regular price, discount rules | `v_effective_price`, `v_unit_product_discount` | Fallback to regular price if discount expired or invalid | `20260716183010_update_checkout_function.sql` L215-225 |
| 4 | Checkout | Idempotent Checkout Protection | Prevents duplicate order creation by verifying `checkout_request_id`. | `p_payload ->> 'request_id'` | Returns existing `orcamento` details if already created by client | Throws if request ID used by a different client | `20260716183010_update_checkout_function.sql` L114-130 |
| 5 | Checkout | Strict Cart Payload Schema Whitelist | Verifies cart structure and rejects unauthorized keys on each item. | JSONB cart array | Validated cart | Throws `'O carrinho contém item inválido ou campo não permitido.'` if key not in `('tipo', 'item_id', 'quantidade', 'prazo_meses')` | `20260716183010_update_checkout_function.sql` L147-153 |
| 6 | Catalog | Product Variation Schema (`produto_variantes`) | Normalized attributes (`grupos`, `opcoes`, `variantes`, `variante_opcoes`) with unique hashes and stock management. | DDL schemas, constraints, foreign keys | Tables, indexes, and RLS policies | Check constraints enforce non-negative prices and non-negative stock | `20260817120000_product_variations_marketplace.sql` L1-184 |
| 7 | Checkout | Variation Checkout Wrapper | Wraps base checkout, validates variant selection, and attempts post-checkout variant stock reduction and snapshotting. | `p_sessao_id`, `p_session_token`, `p_payload` (with `variante_id`) | JSONB order result | Throws if variation not chosen for products with variations, or if variant out of stock | `20260817120000_product_variations_marketplace.sql` L711-874 |
| 8 | Checkout | Cart Sanitization Routine | Strips non-standard keys from cart before delegating to base checkout. | Raw cart array | `v_sanitized_cart` stripped of `variante_id` | Strips `variante_id`, creating an architectural disconnect | `20260817120000_product_variations_marketplace.sql` L743-750 |
| 9 | Checkout | Zero-Balance Order Liquidation Wrapper | Automatically generates and marks paid an internal fatura (`R$ 0,00`) when order is 100% paid by points/wallet. | Session, payload | JSONB order result + internal paid fatura | Throws if order not found | `20260817203000_zero_balance_store_checkout.sql` L19-97 |
| 10 | Post-Sales | Order Cancellation with Variant Restock | Client-authenticated RPC canceling store order, bypassing financial guards, and restocking variant inventory. | `p_sessao_id`, `p_session_token`, `p_orcamento_id`, `p_motivo` | JSONB result | Bypasses guards via transaction session configs `gsa.credit_release`, `gsa.system_override` | `20260817211500_fix_client_store_cancellation_guard.sql` L19-67 |
| 11 | Post-Sales | Admin Request Status Update RPC | Admin-authenticated RPC updating `loja_solicitacoes`, handling exchange difference invoices and return restocking/refunds. | `p_sessao_id`, `p_token`, `p_solicitacao_id`, `p_status`, `p_resposta_admin` | JSONB summary with restored counts and values | Throws on invalid admin session, invalid status, or missing request | `20260910180000_marketplace_acid_concurrency_remediation.sql` L5-228 |
| 12 | Post-Sales | Exchange Difference Invoice Generation | Automatically generates `FAT-TROCA-<codigo>` when an exchange results in positive price difference. | Request ID, `v_diff > 0`, status `aprovado` | New `faturas` record with status `pendente` | Skips insertion if invoice already exists | `20260910180000_marketplace_acid_concurrency_remediation.sql` L84-108 |
| 13 | Post-Sales | Atomic Inventory Restocking on Return | Restocks parent `produtos` and child `produto_variantes` based on order items. | `loja_pedido_itens` rows | Incremented `estoque_disponivel` on tables | Only updates if `controle_estoque = true` | `20260910180000_marketplace_acid_concurrency_remediation.sql` L123-138 |
| 14 | Post-Sales | Atomic Wallet Balance Refund | Restores `abatimento_carteira` to customer wallet and records transaction ledger. | `v_orc.abatimento_carteira` | Incremented wallet balance + ledger row | Fails in current migration due to wrong column & table names | `20260910180000_marketplace_acid_concurrency_remediation.sql` L140-152 |
| 15 | Post-Sales | Atomic Loyalty Points Refund | Restores `desconto_pontos * 100` to customer points balance and records movement ledger. | `v_orc.desconto_pontos` | Incremented `saldo_pontos` + movement row | Fails in current migration due to invalid movement type `'ganho'` | `20260910180000_marketplace_acid_concurrency_remediation.sql` L154-169 |
| 16 | Post-Sales | Store Credit Invoices Cancellation | Cancels pending credit installments and restores client's available credit limit. | Origin order ID, client ID | Canceled faturas, restored `limite_credito_disponivel`, movement record | Fails in current migration due to mismatch in `itens_faturados` query filter | `20260910180000_marketplace_acid_concurrency_remediation.sql` L171-208 |

---

## 3. Edge Cases & Concurrency Scenarios

| # | Feature | Input / Scenario | Observed Behavior & Consequence |
|---|---------|------------------|---------------------------------|
| 1 | Checkout Pricing | Item with `variante_id` passed directly to base checkout `gsa_client_checkout_store_base_20260817` | **Fatal Exception**: Line 150 throws `O carrinho contém item inválido ou campo não permitido.` because `variante_id` is missing from key whitelist. |
| 2 | Checkout Wrapper | Cart with `variante_id` passed through wrapper `gsa_client_checkout_store` | **Catalog Price Undercharging**: Wrapper strips `variante_id`. Base function evaluates variant price as NULL and charges master product base price (`v_product.valor`), undercharging or overcharging customer. |
| 3 | Checkout Inventory | Multiple variants purchased in parallel under high concurrency | **Zero Variant Decrement**: Because base function saves `loja_pedido_itens.produto_variante_id` as NULL, wrapper searches for matching variant rows, finds 0 items, and variant stock is **never decremented** (`estoque - 0`). |
| 4 | Concurrency | Two checkouts for same product at exact same millisecond | **Serialized correctly by row lock**: Base checkout executes `SELECT * FROM produtos WHERE id = ... FOR UPDATE`. The second transaction blocks until the first completes. If stock is exhausted, second throws `'Estoque insuficiente'`. |
| 5 | Returns RPC | Invoking `gsa_admin_atualizar_solicitacao_loja` via Supabase JS client with named parameters `{ p_session_token, p_novo_status }` | **PostgREST RPC Failure**: PostgreSQL returns function not found error because parameter names were changed to `p_token` and `p_status` in migration 20260910180000. |
| 6 | Returns Refund | Admin approves return of order where `abatimento_carteira > 0` | **SQL Error Abort**: Postgres throws `column "carteira_saldo" of relation "clientes" does not exist` and `relation "carteira_movimentacoes" does not exist`. Transaction aborts with 0 changes committed. |
| 7 | Returns Refund | Admin approves return of order where `desconto_pontos > 0` | **Check Constraint Violation**: Postgres throws `violates check constraint "pontos_movimentacoes_tipo_check"` because `'ganho'` is not in the allowed enum values. |
| 8 | Returns Credit | Admin approves return of order paid with `credito_loja` | **Silent Inaction**: Query checks `itens_faturados @> [{'codigo': 'CRE-' || v_orc.codigo_orcamento}]`. Store invoices store product codes, not credit codes. `v_tem_fatura_credito` is always false; faturas remain pending and credit limit is not restored. |
| 9 | Returns Idempotency | Admin marks request as `aprovado` (restocking & refunding), then marks as `devolucao_recebida` upon delivery | **Double Restocking & Double Refund**: Condition `(v_status_to_save = 'devolucao_recebida' OR (v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso'))` evaluates true on both transitions. Stock is added twice, points are added twice, wallet balance is credited twice. |
| 10 | Partial Returns | Order contains 3 products; customer requests return of only 1 item | **Excessive Restocking & Full Refund**: Migration queries `SELECT * FROM loja_pedido_itens WHERE orcamento_id = v_orc.id` and restocks ALL products in order, while refunding 100% of order's wallet and points instead of proportional item value. |
| 11 | Deadlock Potential | Simultaneous returns or checkouts processing identical items in opposite order | **Potential 40P01 Deadlock**: Query `SELECT ... FROM loja_pedido_itens WHERE orcamento_id = ...` has no `ORDER BY`. Simultaneous transactions can acquire locks on products in reverse order, risking database deadlock. |
| 12 | UI Logistic Flow | Admin clicks "Confirmar Recebimento" in `LojaTrocasModule.tsx` | **RPC Bypass**: Component directly runs `supabase.from('loja_solicitacoes').update({ status: 'devolucao_recebida' })`, bypassing the RPC entirely. No stock is restored and no refund is processed. |

---

## 4. Deep Architectural Dissection of Migrations

### 4.1 Migration 1: `20260716183010_update_checkout_function.sql`
- **Function**: `gsa_client_checkout_store(p_sessao_id uuid, p_session_token text, p_payload jsonb)`
- **Security Context**: `SECURITY DEFINER`, `search_path = public`
- **Intent**: Enhance checkout to compute individual product discounts and support item variations.
- **Detailed Behavior**:
  1. **Session Authentication**: Calls `public.gsa_client_session_actor(p_sessao_id, p_session_token)`.
  2. **Client Locking**: `SELECT * INTO v_cliente FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;`
  3. **Idempotency**: Verifies `p_payload ->> 'request_id'`. If already exists in `orcamentos`, returns existing order.
  4. **Strict Whitelist (The Conflict Point)**:
     ```sql
     -- Lines 147-151:
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(item) AS key_name
       WHERE key_name NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses')
     )
     ```
     This clause causes any payload item containing `variante_id` or `produto_variante_id` to fail immediately.
  5. **Variant Price Injection**:
     ```sql
     -- Lines 186-196:
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
     *Verification of R1*: Is this logic free of global overwrite vulnerabilities?
     **YES**. `v_product` is an in-memory PL/pgSQL variable (`v_product public.produtos%rowtype;`). Setting `v_product.valor := v_variant_price;` modifies only the local record in execution memory. There is no `UPDATE public.produtos SET valor = ...`. Thus, the master catalog table is strictly untouched.
  6. **Inventory Validation & Decrement**:
     - Line 181 locks `produtos` with `FOR UPDATE`.
     - Lines 208-211 check `v_product.estoque_disponivel < quantidade`.
     - Lines 688-691 decrement `produtos.estoque_disponivel`.
     - **Weakness**: Does not query or lock `produto_variantes` with `FOR UPDATE`, does not verify `produto_variantes.produto_id = v_product.id`, does not check `produto_variantes.ativo`, and does not check or decrement `produto_variantes.estoque_disponivel`.

---

### 4.2 Migration 2: `20260817120000_product_variations_marketplace.sql`
- **Tables Created**:
  - `produto_variacao_grupos`: Variation categories (Cor, Tamanho, etc.).
  - `produto_variacao_opcoes`: Option values (Azul, G, 42, etc.).
  - `produto_variantes`: Purchasable SKU combinations with specific price, cost, barcode, and inventory (`estoque_disponivel`).
  - `produto_variante_opcoes`: Many-to-many junction between variant and options.
- **Checkout Refactoring**:
  - Renamed `gsa_client_checkout_store` to `gsa_client_checkout_store_base_20260817`.
  - Created wrapper `gsa_client_checkout_store`:
    ```sql
    -- Lines 743-750:
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'tipo', item ->> 'tipo',
      'item_id', item ->> 'item_id',
      'quantidade', item -> 'quantidade',
      'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
    ))) INTO v_sanitized_cart
    FROM jsonb_array_elements(v_cart) source(item);
    ```
  - **The Architectural Disconnect**:
    The author realized that calling the base function with `variante_id` caused the base function to fail line 150 (`key_name NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses')`). Instead of updating the base function's whitelist to allow `variante_id`, they stripped `variante_id` out of `v_sanitized_cart`!
    - When `gsa_client_checkout_store_base_20260817` executes, it receives `v_sanitized_cart`.
    - In the base function, `v_item ->> 'variante_id'` is `NULL`.
    - Variant price is never loaded; base product price is charged.
    - Base function inserts `loja_pedido_itens` with `produto_variante_id = NULL`.
    - Wrapper resumes at line 832:
      ```sql
      SELECT COALESCE(sum(quantidade), 0) INTO v_requested
      FROM public.loja_pedido_itens
      WHERE orcamento_id = v_order_id
        AND tipo = 'produto'
        AND produto_id = v_variant.produto_id
        AND produto_variante_id = v_variant.id;
      ```
    - Since `produto_variante_id` in `loja_pedido_itens` is `NULL`, `v_requested` returns `0`.
    - Line 866 executes: `estoque_disponivel = estoque_disponivel - 0`.
    - Variant stock is **never decremented**.

---

### 4.3 Migration 3: `20260910180000_marketplace_acid_concurrency_remediation.sql`
- **Function**: `gsa_admin_atualizar_solicitacao_loja`
- **Signature**: `(p_sessao_id uuid, p_token text, p_solicitacao_id uuid, p_status text, p_resposta_admin text DEFAULT NULL)`
- **Detailed Behavior**:
  1. **Session Actor**: Calls `gsa_admin_session_actor(p_sessao_id, p_token)`.
  2. **Solicitacao Locking**: `SELECT * INTO v_sol FROM public.loja_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;`
  3. **History & Status Update**: Updates `status`, `historico_status`, and `resposta_admin`.
  4. **Exchange Difference Invoice**: If `v_status_to_save = 'aprovado'` and `v_diff > 0`, creates `FAT-TROCA-<codigo>`.
  5. **Restock and Refunds Block**:
     ```sql
     IF (v_status_to_save = 'devolucao_recebida' OR (v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso')) AND v_sol.orcamento_origem_id IS NOT NULL THEN
     ```
     - Restocks `produto_variantes` and `produtos` for all items in `v_orc.id`.
     - Refunds `abatimento_carteira` to `carteira_saldo` and inserts `carteira_movimentacoes`.
     - Refunds `desconto_pontos * 100` to `saldo_pontos` and inserts `pontos_movimentacoes` with `tipo = 'ganho'`.
     - Cancels credit faturas and restores `limite_credito_disponivel`.

---

## 5. Exhaustive Inconsistency and Vulnerability Matrix

| ID | Issue | Severity | Impact | Exact Code Location | Root Cause |
|---|---|---|---|---|---|
| **VULN-01** | Base Cart Key Whitelist Rejects Variant ID | Critical | Base checkout function crashes if invoked with `variante_id`. | `20260716183010` L147-151 | Whitelist omits `'variante_id'` and `'produto_variante_id'`. |
| **VULN-02** | Wrapper Strips Variant ID from Cart Payload | Critical | Base function never sees variant ID, miscalculates order total, and stores `produto_variante_id = NULL`. | `20260817120000` L743-750 | Sanitizer strips variant keys to evade VULN-01 instead of fixing base function. |
| **VULN-03** | Variant Inventory Decrement Bypassed | Critical | Variant stock is never reduced upon checkout; allows infinite overselling of variants. | `20260817120000` L832-869 | `v_requested` is 0 because `produto_variante_id` was saved as NULL. |
| **VULN-04** | Invalid Column `carteira_saldo` on `clientes` | Blocker | Any return with wallet balance refund crashes transaction with SQL error. | `20260910180000` L143, L149 | Column is named `saldo_carteira` across all other project migrations. |
| **VULN-05** | Invalid Table `carteira_movimentacoes` | Blocker | Any return with wallet balance refund crashes transaction with relation does not exist error. | `20260910180000` L146 | Canonical table is `public.carteira_lancamentos`. |
| **VULN-06** | Check Constraint Violation on `pontos_movimentacoes` | Blocker | Any return with loyalty points refund crashes transaction with constraint violation. | `20260910180000` L163 | `'ganho'` is not in `pontos_movimentacoes_tipo_check`; must be `'estorno'`. |
| **VULN-07** | Parameter Name Mismatch with Frontend | High | Calling RPC via Supabase JS client fails PostgREST signature matching. | `20260910180000` L6, L9 vs `LojaTrocasModule.tsx` L93-98 | Migration uses `p_token` & `p_status`, while caller passes `p_session_token` & `p_novo_status`. |
| **VULN-08** | Credit Fatura Query Filter Fails to Match | High | Pending store credit faturas are never canceled and credit limits are never restored on return. | `20260910180000` L176, L193 | Filter looks for `codigo = 'CRE-' || v_orc.codigo_orcamento` in `itens_faturados`, which does not exist in store invoices. |
| **VULN-09** | Return Restock & Refund Idempotency Flaw | High | Double restocking, double wallet refund, and double points refund if status goes `aprovado` -> `devolucao_recebida`. | `20260910180000` L111 | No guard flag or previous-status check prevents executing the refund block multiple times. |
| **VULN-10** | Partial Return Apportionment Missing | Medium | Partial return of 1 item restocks ALL items in the order and refunds 100% of order discounts. | `20260910180000` L124-169 | Loops over entire `orcamento_id` instead of specific returned item(s). |
| **VULN-11** | Direct Frontend Mutation Bypasses RPC | High | In `LojaTrocasModule.tsx`, advanced status changes bypass RPC completely. | `LojaTrocasModule.tsx` L169-176 | Directly executes `.from('loja_solicitacoes').update(...)`. |
| **VULN-12** | Missing Lock Ordering on Order Items Restock | Medium | Unordered item iteration during restock can cause deadlock under high concurrent returns. | `20260910180000` L124 | Missing `ORDER BY produto_id, produto_variante_id`. |

---

## 6. Mathematical & Transactional Proofs

### 6.1 Concurrency & Overselling Prevention
- **Base Product**: `produtos` row is locked via `SELECT ... FOR UPDATE` in line 181. Under high concurrency, concurrent checkouts on the same product queue sequentially on the row lock. The quantity check `coalesce(estoque_disponivel, 0) < quantidade` is evaluated against the committed, locked row. This guarantees that overselling of the base product cannot occur.
- **Variant Product**: In `20260817120000`, lines 791-795 lock `produtos` and `produto_variantes` `FOR UPDATE` in order of appearance in the cart.
- **Deadlock Condition**: If Cart 1 contains `[Prod A, Prod B]` and Cart 2 contains `[Prod B, Prod A]`, locking in arrival order can produce a deadlock. Locks must be acquired in **canonical sorted order** (`ORDER BY item_id, variante_id`).

### 6.2 Mathematical Integrity of Post-Sales Reversals
For an order with merchandise subtotal $S$, promotional discount $D_{promo}$, coupon discount $D_{cupom}$, points discount $D_{pontos}$, wallet balance $W$, shipping fee $F$, credit interest $I$, and net total $T$:
$$T = \max(0, S - D_{promo} - D_{cupom} - D_{pontos} + F) - W + I$$

When a return is approved:
1. **Inventory**: Restocked quantity must equal the quantity originally decremented:
   $$\Delta Q_{prod} = +Q_{item}, \quad \Delta Q_{variant} = +Q_{item}$$
2. **Wallet Balance**: If order is 100% returned:
   $$\Delta \text{saldo\_carteira} = +W$$
3. **Points Balance**: Points spent at checkout were $P = \lfloor D_{pontos} \times 100 \rfloor$.
   Points refunded must equal:
   $$\Delta \text{saldo\_pontos} = +P$$
   Recorded in `pontos_movimentacoes` with `tipo = 'estorno'`.
4. **Credit Invoices**:
   Unpaid invoices associated with `orcamento_id` must be set to `status = 'cancelado'`, and the customer's available credit limit must be restored by the sum of canceled unpaid invoices:
   $$\Delta \text{limite\_credito\_disponivel} = +\sum \text{valor\_pendente}(\text{faturas\_canceladas})$$

---

## 7. Authoritative Recommendations & Remediation Plan

To fulfill the requirements of `ORIGINAL_REQUEST.md` and ensure 100% ACID compliance and concurrency safety, the following remediations must be implemented in the database:

1. **Unify Cart Key Whitelist in Base Checkout**:
   In `gsa_client_checkout_store_base_20260817`, update line 150 to:
   ```sql
   WHERE key_name NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses', 'variante_id', 'produto_variante_id')
   ```
2. **Preserve Variant IDs in Checkout Wrapper**:
   In `gsa_client_checkout_store`, ensure `v_sanitized_cart` preserves `'variante_id'` and `'produto_variante_id'`.
3. **Correct Column & Table Names in Returns RPC**:
   In `gsa_admin_atualizar_solicitacao_loja`:
   - Change `carteira_saldo` to `saldo_carteira`.
   - Change `carteira_movimentacoes` to `carteira_lancamentos`.
   - Change `pontos_movimentacoes.tipo` from `'ganho'` to `'estorno'`.
4. **Support Parameter Aliases**:
   Add default alias parameters or rename parameters to accept `p_session_token` and `p_novo_status` matching the frontend caller.
5. **Fix Credit Invoice Lookup**:
   Filter credit faturas by `orcamento_id = v_orc.id AND is_amortizacao_credito = true` (or `codigo_fatura LIKE 'FAT-CRE-' || v_orc.codigo_orcamento || '%'`).
6. **Enforce Idempotency on Restock/Refund**:
   Add a guard column or check:
   ```sql
   IF coalesce(v_sol.estorno_executado, false) IS TRUE THEN
     -- Skip restock & refunds to prevent duplicate processing
   END IF;
   ```
7. **Ensure Deterministic Lock Ordering**:
   Add `ORDER BY produto_id, produto_variante_id` to item loops to guarantee deadlock immunity.
8. **Enforce RPC in `LojaTrocasModule.tsx`**:
   Refactor `handleUpdateAdvancedStatus` in `LojaTrocasModule.tsx` to route `devolucao_recebida` through `gsa_admin_atualizar_solicitacao_loja`.

---
*Report compiled and verified by `spec_miner_survey_1`.*
