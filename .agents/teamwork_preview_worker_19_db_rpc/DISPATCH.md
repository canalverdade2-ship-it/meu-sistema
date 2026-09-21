## 2026-09-10T20:19:37Z
You are teamwork_preview_worker_19_db_rpc.
Your working directory is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_19_db_rpc
Your project root is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
specifically under header ## 2026-09-10T19:56:53Z.

Also read:
- .agents/teamwork_preview_explorer_19_db/analysis.md
- .agents/teamwork_preview_explorer_19_cart/analysis.md
- .agents/teamwork_preview_explorer_19_returns/analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You exclusively own and may edit:
- supabase/migrations/ (create: supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql)
- supabase/functions/gsa-payments/index.ts
- server_webhook_vps_live.cjs (if applicable)
DO NOT modify any files in src/components/ (Worker 2 owns frontend components).

IMPLEMENTATION TASKS:
1. Create `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`:
   Implement the robust, production-grade PostgreSQL migration addressing all identified backend issues:
   a) `gsa_client_checkout_store`:
      - ELIMINATE the temporary update of `produtos.valor`! The unit value for order items must be read directly as `COALESCE(v_variant.valor, v_product.valor)` without mutating `produtos.valor`.
      - Fix `v_sanitized_cart` so `variante_id` / `produto_variante_id` is preserved and recorded in `loja_pedido_itens`.
      - Deduct `produto_variantes.estoque_disponivel` atomically with `SELECT ... FOR UPDATE` and verify `estoque_disponivel >= requested_quantity`.
      - Enforce canonical lock ordering (`ORDER BY item_id ASC, id ASC` / `ORDER BY produto_id ASC, id ASC`) across all items and gifts to prevent deadlocks (40P01).
      - Decrement promotional quota `desconto_quantidade_utilizada` and insert movement into `produto_desconto_cota_movimentos`.
      - Align discount calculation hierarchy: calculate percentage coupons on merchandise subtotal before points deduction.
      - Support PIX discount (5%) when payment method is PIX.
   b) `gsa_converter_pontos_carteira`:
      - Require authentication! Verify that caller is either service role or matching authenticated client (`p_cliente_id = public.gsa_jwt_actor_id()`). Revoke public execute from `anon`.
   c) RLS on `loja_solicitacoes`:
      - Restrict client update policies so clients cannot set `status = 'concluido'` or modify `valor_diferenca`.
   d) Cancellations & Post-Sales:
      - In `gsa_client_cancel_store_order` and `gsa_admin_cancel_store_order`: restore stock for BOTH `produtos` AND `produto_variantes`. Revoke earned loyalty points and claw back referral bonuses.
      - In `gsa_admin_atualizar_solicitacao_loja`: when return status is set to `'concluido'`, restore inventory for returned items and variants into `produtos` and `produto_variantes`, and generate refund record in `loja_reembolsos` or credit `clientes.saldo_carteira` atomically. When exchange is approved, deduct/reserve substitute items.
   e) Create ledger table `cupons_usos` with `UNIQUE (cupom_id, cliente_id, orcamento_id)` and enforce `limite_usos_por_cliente`.

2. Fix `supabase/functions/gsa-payments/index.ts`:
   - Prevent duplicate webhook processing and invoke `gsa_finalize_paid_invoice_internal` so points and VIP tiers are credited on paid invoices.

3. Run verification:
   Run `npx vitest run src/tests/marketplace-checkout-concurrency-audit.test.ts src/tests/marketplace-pricing-integrity.test.ts src/tests/marketplace-returns-exchanges-atomicity.test.ts`
   and `npx tsx scripts/simulate-marketplace-returns-exchanges.ts`.

4. Document all implemented changes, commands run, and results in your `handoff.md`, and notify your parent via send_message.
