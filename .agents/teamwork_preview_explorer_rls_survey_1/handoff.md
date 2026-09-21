# Handoff Report: Database RLS Survey for Client Panel

**Agent:** Explorer 2 (Database RLS Explorer)  
**Recipient:** Parent Orchestrator (`1aefd40e-f103-4a7e-ae15-f498b8ea3593`)  
**Mission:** Audit PostgreSQL schemas and Supabase migrations for Row Level Security (RLS) enforcement on client panel tables (`saques`, `pontos_movimentacoes`, `vouchers`, etc.).

---

## 1. Observation

1. **Focus Table `saques`:**
   - In `supabase/migrations/20260830023000_harden_client_portal_end_to_end.sql` (lines 11-15, 22, 110-112):
     ```sql
     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
     ...
     CREATE POLICY gsa_client_own_withdrawals_read ON public.saques
     FOR SELECT TO authenticated
     USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());
     ```
   - Previous temporary bypass policy `saques_select_public_temp` (`USING (true)`) in `20260714020000_secure_admin_withdrawal_transfer_rpcs.sql` line 408 was dropped by line 32 of `20260830023000`.
   - Frontend `src/components/client/financeiro/SaquesList.tsx` line 86 executes:
     `supabase.from('saques').select('*').eq('cliente_id', clientId)`.

2. **Focus Table `pontos_movimentacoes`:**
   - In `supabase/migrations/20260830023000_harden_client_portal_end_to_end.sql` (lines 11-15, 22, 55-57):
     ```sql
     CREATE POLICY gsa_client_own_points_read ON public.pontos_movimentacoes
     FOR SELECT TO authenticated
     USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());
     ```
   - Direct mutations by client role are blocked by RLS.
   - Frontend `src/components/client/ClientPontos.tsx` line 180 executes:
     `supabase.from('pontos_movimentacoes').select('*').eq('cliente_id', clienteId)`.

3. **Focus Table `vouchers`:**
   - In `supabase/migrations/20260830030000_admin_panel_security_end_to_end.sql` (lines 583-595):
     ```sql
     'prestador_vouchers','prestadores','ticket_mensagens','viagens_propostas','vouchers','indicacoes'...
     ...
     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
     EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',t);
     EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
     ...
     CREATE POLICY gsa_management_hardened ON public.%I AS PERMISSIVE FOR ALL TO authenticated
     USING (public.gsa_jwt_actor_type() IN ('admin','colaborador')) WITH CHECK (...);
     ```
   - In subsequent lines (620-667), policies were created for `loja_solicitacoes`, `orcamento_timeline`, `ordens_servico`, `indicacoes`, `level_history`, `points_transactions`, `cliente_promocoes`, `loja_credito_documentos`, `loja_credito_movimentacoes`, `loja_reembolsos`, `gsa_voucher_resgates`, `contratos`, `viagens_propostas`.
   - **`vouchers` was omitted.** No policy granting `SELECT` to `public.gsa_jwt_actor_type() = 'cliente'` exists.
   - Frontend `src/components/client/ClientVouchers.tsx` line 81 executes:
     `supabase.from('vouchers').select('*').eq('cliente_id', clientId)`.

4. **Focus Table `carteira_saldo` / `carteira_lancamentos`:**
   - No table named `carteira_saldo` exists; client balance is stored in the `saldo_carteira` column of `clientes`.
   - The transaction ledger is `public.carteira_lancamentos`, which is protected by `gsa_client_own_wallet_read` in `20260830023000` line 51:
     `USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())`.

5. **Focus Table `orcamentos`:**
   - In `supabase/migrations/20260829211500_marketplace_security_refund_checkout_hardening.sql` line 552:
     `CREATE POLICY marketplace_orders_read ON public.orcamentos FOR SELECT TO public USING (true);`
   - In `supabase/migrations/20260830030000_admin_panel_security_end_to_end.sql` line 144:
     `CREATE POLICY gsa_client_own_orcamentos_hardened ON public.orcamentos FOR SELECT TO authenticated USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());`
   - Grep search confirms `marketplace_orders_read` **was never dropped**.

6. **Focus Table `ordens_compra`:**
   - In `supabase/migrations/20260829211500_marketplace_security_refund_checkout_hardening.sql` line 553:
     `CREATE POLICY marketplace_purchase_orders_read ON public.ordens_compra FOR SELECT TO public USING (true);`
   - Grep search confirms `marketplace_purchase_orders_read` **was never dropped**.

7. **Focus Table `loja_favoritos`:**
   - In `supabase/migrations/20260814120000_loja_favoritos_persistence.sql` lines 433-444:
     ```sql
     CREATE POLICY "cliente_select_loja_favoritos" ON public.loja_favoritos FOR SELECT TO public USING (true);
     CREATE POLICY "admin_all_loja_favoritos" ON public.loja_favoritos FOR ALL TO authenticated USING (true) WITH CHECK (true);
     ```

8. **Tables with RLS Disabled:**
   - `promocoes_quantidade_ativadas`: `rls_enabled: false` (`scratch/live_db_audit.json` line 33252).
   - `loja_carrinhos`: `rls_enabled: false` (`scratch/live_db_audit.json` line 32994).

9. **Table with Zero Policies:**
   - `cliente_premios`: `rls_enabled: true` (`scratch/live_db_audit.json` line 32796), but 0 policies for authenticated or clients exist.

---

## 2. Logic Chain

1. **From Observation 1 & 2:** `saques` and `pontos_movimentacoes` have RLS enabled, their legacy open policies were dropped in `20260830023000`, and permissive policies enforcing `public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()` are actively applied. Clients can select only their own records and cannot directly mutate data.
2. **From Observation 3:** In `20260830030000`, `vouchers` had RLS enabled and open policies dropped. However, the migration developer only generated `gsa_management_hardened` (for admins and collaborators) and forgot to add the client read policy. When `ClientVouchers.tsx` calls `.from('vouchers').select('*').eq('cliente_id', clientId)`, PostgreSQL denies or filters out all rows. Thus, clients are locked out of viewing their own vouchers.
3. **From Observation 5 & 6:** In PostgreSQL, multiple PERMISSIVE policies on the same table are evaluated with boolean `OR` (`policy_1 OR policy_2`). Because `marketplace_orders_read` (`USING (true)`) and `marketplace_purchase_orders_read` (`USING (true)`) still exist alongside `gsa_client_own_orcamentos_hardened`, the evaluation yields `true OR (client_id = actor_id) = true`. Therefore, any user (including anonymous callers) can read all orders and purchases across the platform.
4. **From Observation 7:** `loja_favoritos` grants unrestricted SELECT to public and unrestricted ALL (INSERT/UPDATE/DELETE) to all authenticated users. Any logged-in customer can modify any other customer's wishlist.
5. **From Observation 8 & 9:** `promocoes_quantidade_ativadas` and `loja_carrinhos` lack RLS enablement, while `cliente_premios` has RLS enabled but lacks any policy granting client access, breaking `ClientPremios.tsx`.

---

## 3. Caveats

- **Active Network Access:** Analysis was conducted via static code and schema audit (all 397 migration scripts, schema files, and live database JSON dumps). Live remote connection commands (`psql`) were not run to alter database state since the explorer role is strictly read-only.
- **Client Identifier Resolution:** As detailed in `20260714053000_supabase_auth_session_bridge.sql`, client identity is derived from JWT `app_metadata.gsa_actor_id`. Applications or scripts attempting to query using `auth.uid() = user_id` will fail by design because `clientes.id` is distinct from Supabase `auth.users.id`.
- **Public Catalogs:** Tables such as `produtos`, `servicos`, `assinaturas`, `cupons_loja`, `promocoes`, and `client_levels` have `FOR SELECT TO anon, authenticated USING (true)`. This is intentional for catalog browsing.

---

## 4. Conclusion

1. **`saques` and `pontos_movimentacoes`** are fully secure, with RLS enabled, authenticated client policies strictly enforcing self-ownership via `gsa_jwt_actor_id()`, and direct mutation prevented.
2. **`vouchers`** is suffering from a **critical functional blocker**: RLS is enabled, but no client SELECT policy was created in `20260830030000`, making the client voucher panel return 0 items.
3. **`orcamentos` and `ordens_compra`** contain **critical data leaks**: leftover `USING (true)` policies from `20260829211500` were never dropped, allowing global reads.
4. **`loja_favoritos`** has overly permissive `USING (true)` policies for ALL commands.
5. **`promocoes_quantidade_ativadas` and `loja_carrinhos`** have RLS disabled.
6. **`cliente_premios`, `os_notas`, and `os_suporte_mensagens`** lack client read policies.

A complete remediation script has been designed and documented in `survey_report.md` Section 6.

---

## 5. Verification Method

To independently verify these findings:
1. **Inspect policy definitions in the database:**
   ```sql
   SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename IN ('saques', 'pontos_movimentacoes', 'vouchers', 'orcamentos', 'ordens_compra', 'loja_favoritos', 'promocoes_quantidade_ativadas', 'loja_carrinhos', 'cliente_premios')
   ORDER BY tablename, policyname;
   ```
2. **Inspect table RLS flags:**
   ```sql
   SELECT relname, relrowsecurity
   FROM pg_class
   WHERE relname IN ('saques', 'pontos_movimentacoes', 'vouchers', 'orcamentos', 'ordens_compra', 'loja_favoritos', 'promocoes_quantidade_ativadas', 'loja_carrinhos', 'cliente_premios');
   ```
3. **Simulate authenticated client querying `vouchers` and `orcamentos`:**
   ```sql
   SET LOCAL role TO authenticated;
   SET LOCAL "request.jwt.claims" TO '{"app_metadata": {"gsa_actor_type": "cliente", "gsa_actor_id": "00000000-0000-0000-0000-000000000001", "gsa_session_id": "00000000-0000-0000-0000-000000000002"}}';
   -- Expectation on vouchers: Returns 0 rows (verifies defect VULN-RLS-01)
   SELECT count(*) FROM public.vouchers;
   -- Expectation on orcamentos: Returns all rows in database (verifies data leak VULN-RLS-02)
   SELECT count(*) FROM public.orcamentos;
   ```
