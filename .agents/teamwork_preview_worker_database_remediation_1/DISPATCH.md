## 2026-09-10T23:28:00Z
You are Worker 2 (Database Remediation Worker) for the Client Panel and Database Audit mission.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_database_remediation_1
Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Scope Document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Original user request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-10T23:11:34Z`.
Explorer 2 Report: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_rls_survey_1\survey_report.md
Explorer 3 Report: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_rpc_survey_1\survey_report.md
You MUST read `ORIGINAL_REQUEST.md` and `PROJECT.md` before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

WRITE OWNERSHIP:
You exclusively own:
- `supabase/migrations/20260910233000_client_panel_rls_hardening.sql` (new migration)
- `server_webhook.cjs`
- `server_webhook_vps_live.cjs`

TASK OBJECTIVES:
1. Create the new SQL migration: `supabase/migrations/20260910233000_client_panel_rls_hardening.sql` (refer to Section 6 of Explorer 2's survey report for the exact template and SQL commands):
   - Table `vouchers`: Add policy `gsa_client_own_vouchers_read` FOR SELECT TO authenticated USING (`public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`).
   - Tables `orcamentos` & `ordens_compra`: DROP POLICY IF EXISTS `marketplace_orders_read` on `public.orcamentos` and DROP POLICY IF EXISTS `marketplace_purchase_orders_read` on `public.ordens_compra`.
   - Table `loja_favoritos`: Drop permissive `cliente_select_loja_favoritos` and `admin_all_loja_favoritos`. Establish strict client-ownership policies (`cliente_id = public.gsa_jwt_actor_id()`).
   - Tables `promocoes_quantidade_ativadas` & `loja_carrinhos`: Enable RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and create client self-ownership policies.
   - Table `cliente_premios`: Create client SELECT policy with `public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`.
   - RPC `gsa_converter_pontos_carteira`: Revoke grant on `anon`, verify authenticated session caller matches `p_cliente_id` or admin.
   - RPCs `gsa_admin_processar_saque`, `gsa_admin_ajustar_saldo_cliente`, `gsa_client_pagar_fatura`, `gsa_admin_processar_transferencia`: Set `PERFORM set_config('my.app.bypass_saldo_check', 'on', true);` so trigger `prevent_saldo_tampering()` permits legitimate balance operations.
   - RPC `gsa_admin_ajustar_saldo_cliente`: Handle both `p_tipo IN ('credito', 'entrada')` for balance credit.
   - RPC `gsa_client_request_affiliate_payout`: Deduct/lock client wallet balance on request insertion to prevent double-spending.
2. Fix Webhook Withdrawal operations in `server_webhook.cjs` and `server_webhook_vps_live.cjs`:
   - In `server_webhook_vps_live.cjs` (lines ~5133-5155) and `server_webhook.cjs` (lines ~5179-5201): ensure client withdrawal creates the withdrawal and decrements balance atomically or via RPC.
   - In `server_webhook_vps_live.cjs` (line ~6454) and `server_webhook.cjs` (line ~6500): fix provider withdrawal insertion with actual requested amount instead of hardcoded `0.00`.
3. Validate the SQL syntax of the migration and syntax of the webhooks.
4. Document all changes and verification in your handoff report:
   `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_database_remediation_1\handoff.md`.
Send a message to your parent orchestrator with your results when complete.
