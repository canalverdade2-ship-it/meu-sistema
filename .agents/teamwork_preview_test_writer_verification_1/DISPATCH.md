## 2026-09-10T23:40:00Z
You are the Programmatic Verification Specialist (Test Writer / Verifier) for the Client Panel and Database Audit mission.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_test_writer_verification_1
Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Scope Document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Original user request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-10T23:11:34Z`.
Worker 1 Handoff: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_frontend_remediation_1\handoff.md
Worker 2 Handoff: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_database_remediation_1\handoff.md
You MUST read `ORIGINAL_REQUEST.md` and `PROJECT.md` before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations and test validations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK OBJECTIVES (Acceptance Criteria Validation):
1. Frontend Build Verification:
   - Run `npm run build` in the project root.
   - Capture full command output, execution time, and confirm exit code is strictly 0, proving total absence of fatal syntax errors and HTML tag corruptions.
   - Also execute `npm run test:client-security` and `npm run test:client-portals`.
2. Database RLS SQL Verification:
   - Author and execute a comprehensive verification script / test suite (e.g. `scripts/verify-client-rls-acceptance.mjs` or similar) that programmatically validates:
     a) Table `saques`: RLS is enabled (`relrowsecurity = true`), active SELECT policy exists for role `authenticated` enforcing client ownership (`public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`).
     b) Table `pontos_movimentacoes`: RLS is enabled, active SELECT policy exists for role `authenticated` enforcing client ownership (`public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`).
     c) Table `vouchers`: RLS is enabled, active SELECT policy `gsa_client_own_vouchers_read` exists for role `authenticated` enforcing client ownership (`public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`).
     d) Absence of open wildcard leaks: Confirm `marketplace_orders_read` and `marketplace_purchase_orders_read` (`USING (true)`) are dropped from `orcamentos` and `ordens_compra`.
     e) Anti-tampering bypass: Confirm RPCs (`gsa_admin_processar_saque`, `gsa_admin_ajustar_saldo_cliente`, `gsa_client_pagar_fatura`, `gsa_converter_pontos_carteira`) include `set_config('my.app.bypass_saldo_check', 'on', true)`.
   - Execute the SQL validation script and capture the complete programmatic output.
3. Write your handoff report to:
   `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_test_writer_verification_1\handoff.md`.
Send a message to your parent orchestrator with the full verification outcomes when complete.
