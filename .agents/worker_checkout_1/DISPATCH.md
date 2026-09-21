# DISPATCH for worker_checkout_1

- **Milestone**: M2 - Checkout & Variation Remediation (R1)
- **Role**: Worker / Database Implementation Specialist
- **Exclusive Write Ownership**:
  - `supabase/migrations/20260716183010_update_checkout_function.sql`
  - `supabase/migrations/20260817120000_product_variations_marketplace.sql`
  - `.agents/worker_checkout_1/`

- **Reference Analysis**:
  - `.agents/explorer_checkout_1/checkout_audit_report.md`
  - `.agents/spec_miner_survey_1/spec_report.md`
  - `.agents/teamwork_preview_orchestrator_20/PROJECT.md`

- **Task**:
  Refactor the checkout base function and variation wrapper to fix all identified vulnerabilities:
  1. **Base Cart Whitelist**: In `gsa_client_checkout_store_base_20260817` (in `20260716183010_update_checkout_function.sql`), update the key whitelist in line 150 to explicitly allow `'variante_id'` and `'produto_variante_id'`.
  2. **Variant Preservation**: In `gsa_client_checkout_store` (in `20260817120000_product_variations_marketplace.sql`), ensure `v_sanitized_cart` preserves `'variante_id'` and `'produto_variante_id'` so the base function receives them.
  3. **Base Variant ID Persistence**: Verify and ensure the base function persists `produto_variante_id` into `loja_pedido_itens` and `ordens_compra`.
  4. **Variant Stock Decrement**: Ensure the wrapper's post-checkout decrement properly finds the ordered variants in `loja_pedido_itens` and decrements `produto_variantes.estoque_disponivel` by the exact purchased quantity.
  5. **Lock Ordering**: Ensure row locks (`FOR UPDATE`) on `produtos` and `produto_variantes` are acquired in canonical sorted order (`ORDER BY item_id, variante_id`) to prevent deadlocks under extreme concurrency.
  6. **Zero Catalog Mutation Confirmation**: Ensure `v_variant_price` continues to be strictly isolated to the memory variable `v_product.valor` and never mutates `public.produtos`.

- **Verification**:
  - Verify SQL syntax and run project tests / builds (`npm run build` or vitest).
  - Document before/after diffs, exact line numbers, and verification commands in `handoff.md`.

- **Mandatory Warning**:
  DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-10T22:38:31Z
Dispatched to worker_checkout_1:
Refactor the checkout base function and variation wrapper:
1. Base function whitelist: allow 'variante_id' and 'produto_variante_id' in key validation.
2. Wrapper sanitization: preserve 'variante_id' in v_sanitized_cart.
3. Base persistence: ensure produto_variante_id is saved to loja_pedido_itens and ordens_compra.
4. Wrapper stock decrement: ensure requested quantity is properly calculated and decremented from produto_variantes.estoque_disponivel.
5. Lock ordering: acquire row locks on produtos and produto_variantes in sorted order to avoid deadlocks.
6. Verify v_variant_price remains local in memory and does not mutate public.produtos.
