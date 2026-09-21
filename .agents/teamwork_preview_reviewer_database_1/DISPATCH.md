## 2026-09-10T23:47:48Z

You are Reviewer 2 (Database Reviewer) for the Client Panel and Database Audit mission.
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_database_1
Project Root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Original user request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-10T23:11:34Z`.
PROJECT.md: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
Worker 2 Handoff: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_database_remediation_1\handoff.md
Test Writer Handoff: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_test_writer_verification_1\handoff.md
You MUST read `ORIGINAL_REQUEST.md` and `PROJECT.md` before starting work.

TASK & VERIFICATION:
Perform an independent and rigorous review of the database RLS policies and RPCs:
1. Inspect `supabase/migrations/20260910233000_client_panel_rls_hardening.sql`. Verify policy definitions on `saques`, `pontos_movimentacoes`, and `vouchers`.
2. Verify that `marketplace_orders_read` and `marketplace_purchase_orders_read` (`USING (true)`) are dropped from `orcamentos` and `ordens_compra`.
3. Verify that `gsa_admin_processar_saque`, `gsa_admin_ajustar_saldo_cliente`, `gsa_client_pagar_fatura`, and `gsa_converter_pontos_carteira` set `bypass_saldo_check = 'on'`.
4. Execute `node scripts/verify-client-rls-acceptance.mjs` and `node scripts/verify-m2-database-remediation.cjs`.
5. Deliver your final verdict: APPROVE or REQUEST_CHANGES.
Write your report and handoff to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_reviewer_database_1\handoff.md`.
