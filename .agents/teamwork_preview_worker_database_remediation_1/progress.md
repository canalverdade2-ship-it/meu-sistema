# Progress Tracker - Worker 2 (Database Remediation)

Last visited: 2026-09-10T23:38:00Z

## Status
- [x] Initialized DISPATCH.md and BRIEFING.md
- [x] Read ORIGINAL_REQUEST.md and PROJECT.md
- [x] Read Explorer 2 report (RLS survey) & Explorer 3 report (RPC survey)
- [x] Inspected existing migrations and existing RPCs / triggers
- [x] Inspected `server_webhook.cjs` and `server_webhook_vps_live.cjs` lines referenced
- [x] Authored `supabase/migrations/20260910233000_client_panel_rls_hardening.sql`:
  - `vouchers`: Created `gsa_client_own_vouchers_read` policy (`public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`).
  - `orcamentos` & `ordens_compra`: Dropped open public policies `marketplace_orders_read` and `marketplace_purchase_orders_read`, added strict client ownership policies.
  - `loja_favoritos`: Dropped permissive policies, established client self-ownership policies (`FOR ALL TO authenticated USING/CHECK (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())`).
  - `promocoes_quantidade_ativadas` & `loja_carrinhos`: Enabled RLS and created client self-ownership policies.
  - `cliente_premios`: Enabled RLS and created client SELECT policy.
  - `os_notas` & `os_suporte_mensagens`: Created client SELECT policy via `ordens_servico.cliente_id`.
  - RPC `gsa_converter_pontos_carteira`: Revoked anon execution, enforced caller verification (`p_cliente_id` or admin/colaborador), added `set_config('my.app.bypass_saldo_check', 'on', true)`.
  - RPCs `gsa_admin_processar_saque`, `gsa_admin_ajustar_saldo_cliente`, `gsa_client_pagar_fatura`, `gsa_admin_processar_transferencia`: Added `set_config('my.app.bypass_saldo_check', 'on', true)` to eliminate `prevent_saldo_tampering()` blockers.
  - RPC `gsa_admin_ajustar_saldo_cliente`: Added full support for both `p_tipo IN ('credito', 'entrada')` and `p_tipo IN ('debito', 'saida')`, restored ledger entries and full frontend return format.
  - RPC `gsa_client_request_affiliate_payout`: Deducted/locked client wallet balance immediately upon request insertion when commissions do not cover full value, preventing double-spending.
  - RPC `gsa_webhook_solicitar_saque_cliente`: Created dedicated atomic RPC for WhatsApp client withdrawals.
- [x] Fixed withdrawal logic in `server_webhook.cjs` and `server_webhook_vps_live.cjs`:
  - Client withdrawal: replaced non-atomic `supabasePatch` + `supabasePost` with atomic `gsa_webhook_solicitar_saque_cliente` RPC call.
  - Provider withdrawal: replaced hardcoded `valor: 0.00` with actual calculated and requested amount from transactions/faturas.
- [x] Validated SQL syntax (all blocks, functions, dollar quotes, BEGIN/COMMIT balanced).
- [x] Validated Node syntax on webhooks (`node -c server_webhook.cjs` and `node -c server_webhook_vps_live.cjs` passed with exit code 0).
- [x] Validated all 10 checks in `verify-integrations-webhooks.ts` (10/10 passed).
- [x] Created and executed comprehensive test suite `scripts/verify-m2-database-remediation.cjs` (13/13 passed).
- [ ] Monitor build and finalize handoff report.
