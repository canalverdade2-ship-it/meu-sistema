# Survey Report: PostgreSQL Row Level Security (RLS) Audit for Client Panel

**Date:** 2026-09-10T23:28:00Z  
**Auditor:** Explorer 2 (Database RLS Explorer)  
**Workspace:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`  
**Scope:** PostgreSQL schemas, Supabase migrations (`supabase/migrations/`), database snapshots (`scratch/live_db_audit.*`, `scratch/rls_deep_audit.json`), and client panel frontend queries (`src/components/client/`).

---

## 1. Executive Summary

A comprehensive investigation was conducted across all 397 Supabase migration files, the master database schema (`master_supabase_schema.sql`), live database health records, and the React frontend codebase (`src/components/client/`).

### Core Findings on Focus Tables:
1. **`saques` (Withdrawals):**
   - **RLS Enabled:** YES (`ALTER TABLE public.saques ENABLE ROW LEVEL SECURITY;` via `20260830023000_harden_client_portal_end_to_end.sql`).
   - **Authenticated Policies:** YES. Permissive policy `gsa_client_own_withdrawals_read` restricts reads to `public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`. Direct mutations are forbidden for clients; updates and inserts are handled exclusively through audited `SECURITY DEFINER` RPCs (`gsa_client_request_withdrawal`, `gsa_client_cancel_withdrawal`).
   - **Bypasses / Overly Permissive Policies:** None active. The previous temporary bypass `saques_select_public_temp` (`USING (true)`) was dropped in migration `20260830023000`.

2. **`pontos_movimentacoes` (Points Ledger):**
   - **RLS Enabled:** YES (via `20260830023000_harden_client_portal_end_to_end.sql`).
   - **Authenticated Policies:** YES. Permissive policy `gsa_client_own_points_read` restricts reads to `public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`. Direct mutations are forbidden for clients (handled via atomic RPCs like `gsa_client_redeem_points_for_cash`).
   - **Bypasses / Overly Permissive Policies:** None active. Legacy "Acesso total" policy was purged in migration `20260830023000`.

3. **`vouchers` (Client Vouchers / Benefit Redemptions):**
   - **RLS Enabled:** YES (via `20260830030000_admin_panel_security_end_to_end.sql` line 588).
   - **Authenticated Policies:** Incomplete / Defective. Migration `20260830030000` dropped all open public policies and created administrative policy `gsa_management_hardened` (`actor_type IN ('admin','colaborador')`), but **FAILED to create a client-specific SELECT policy** for `vouchers` (only `gsa_voucher_resgates` was covered).
   - **Vulnerability / Functional Impact:** **CRITICAL DEFECT.** When a client visits the "Meus Vouchers" tab (`src/components/client/ClientVouchers.tsx`), the frontend query `supabase.from('vouchers').select('*').eq('cliente_id', clientId)` returns **0 rows** because PostgreSQL RLS rejects the read. The client is completely blocked from accessing their legitimate vouchers.

### Critical Systemic Vulnerabilities Discovered in Other Client-Facing Tables:
- **`orcamentos` (Orders / Budgets):** An overly permissive policy `marketplace_orders_read` (`FOR SELECT TO public USING (true)`) was created in `20260829211500_marketplace_security_refund_checkout_hardening.sql` line 552 and **was never dropped**. Because PostgreSQL evaluates permissive policies using logical `OR`, this policy bypasses `gsa_client_own_orcamentos_hardened`, allowing **any client or unauthenticated caller to read every customer order in the database**.
- **`ordens_compra` (Purchase Orders):** An overly permissive policy `marketplace_purchase_orders_read` (`FOR SELECT TO public USING (true)`) in `20260829211500` line 553 **was never dropped**, allowing global read access to all customer order items.
- **`loja_favoritos` (Wishlist):** Migration `20260814120000_loja_favoritos_persistence.sql` created policies with `USING (true)` and `WITH CHECK (true)` for both `public` and `authenticated`. Any user can read, insert, update, or delete another client's saved favorites.
- **`promocoes_quantidade_ativadas`:** Created in `20260609000002` without enabling RLS (`rls_enabled: false` in live DB), completely exposing customer activated promo quotas.
- **`loja_carrinhos` (Shopping Cart):** RLS is disabled (`rls_enabled: false`), leaving cart items accessible.
- **`cliente_premios` (Rewards):** RLS is enabled, but **0 client policies exist**. Clients cannot query their awards in `ClientPremios.tsx`.
- **`os_notas` & `os_suporte_mensagens`:** Locked down to administrative staff only; clients cannot read technician progress notes or communication messages regarding their service orders in `ClientServicos.tsx`.

---

## 2. Architecture & Authentication Bridge Analysis

### 2.1 Why `auth.uid() = user_id` Is Inapplicable in GSA HUB
In standard Supabase setups, tables frequently have `user_id UUID REFERENCES auth.users(id)` and RLS policies evaluate `auth.uid() = user_id`.

In GSA HUB:
1. The system uses a dedicated **Auth Gateway / Session Bridge** (`gsa_auth_identities` and `sistema_sessoes` established in `20260714053000_supabase_auth_session_bridge.sql`).
2. Client entities are stored in `public.clientes` with their own primary key `id` (independent of `auth.users`).
3. When a user logs in, the gateway sets custom JWT claims under `app_metadata`:
   - `gsa_actor_type`: `'cliente'` (or `'prestador'`, `'admin'`, `'colaborador'`)
   - `gsa_actor_id`: UUID of the `clientes` record (`clientes.id`)
   - `gsa_session_id`: UUID of the active session (`sistema_sessoes.id`)
4. The database provides canonical helper functions (SECURITY DEFINER / STABLE):
   - `public.gsa_jwt_actor_type()` -> `auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type'`
   - `public.gsa_jwt_actor_id()` -> `(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')::uuid`
   - `public.gsa_jwt_session_is_valid()` -> checks active session matching `auth.uid()`
   - `public.gsa_jwt_is_admin()` -> validates active admin session
5. **Canonical Ownership Rule:**
   Any RLS policy asserting self-ownership for a client **MUST** use:
   ```sql
   public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()
   ```
   Checking `auth.uid() = cliente_id` fails because `auth.uid()` (auth user UUID) never matches `cliente_id` (`clientes.id`).

---

## 3. Focus Tables Deep Dive

### 3.1 `saques` (Withdrawals)
- **Table Definition:** `master_supabase_schema.sql` line 235; references `clientes(id)`.
- **RLS Status:** Enabled (`ALTER TABLE public.saques ENABLE ROW LEVEL SECURITY`).
- **Migration History:**
  - `20260714020000_secure_admin_withdrawal_transfer_rpcs.sql`: Dropped "Acesso total"; created `saques_select_public_temp` (`USING (true)`).
  - `20260828230000_security_lockdown_rls_and_rpc_permissions.sql`: Dropped open wildcard policies; ensured RLS enabled.
  - `20260830023000_harden_client_portal_end_to_end.sql`: Dropped all previous policies. Created:
    - `gsa_management_saques`: `FOR ALL TO authenticated USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))`
    - `gsa_service_role_saques`: `FOR ALL TO service_role USING (true)`
    - `gsa_client_own_withdrawals_read`: `FOR SELECT TO authenticated USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())`
  - `20260830030000_admin_panel_security_end_to_end.sql`: Added restrictive collaborator module policy `gsa_collaborator_module_saques`.
- **Evaluation:** Strict, verified, secure. Clients can only see their own withdrawals. Mutations are strictly guarded behind RPCs.

### 3.2 `pontos_movimentacoes` (Points Ledger)
- **Table Definition:** `master_supabase_schema.sql` line 84; references `clientes(id)`.
- **RLS Status:** Enabled (`ALTER TABLE public.pontos_movimentacoes ENABLE ROW LEVEL SECURITY`).
- **Migration History:**
  - `20260828230000_security_lockdown_rls_and_rpc_permissions.sql`: RLS checked.
  - `20260830023000_harden_client_portal_end_to_end.sql`: Dropped all previous policies. Created:
    - `gsa_management_pontos_movimentacoes`: For admin/colaborador.
    - `gsa_service_role_pontos_movimentacoes`: For service_role.
    - `gsa_client_own_points_read`: `FOR SELECT TO authenticated USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())`
  - `20260830190000_admin_full_audit_security_remediation.sql`: Added restrictive collaborator policy `gsa_collaborator_module_pontos_movimentacoes`.
- **Evaluation:** Strict, verified, secure. Direct insertions/updates by clients are rejected by RLS. Conversions and loyalty additions happen via SECURITY DEFINER functions.

### 3.3 `vouchers` (Vouchers & Redemptions)
- **Table Definition:** `master_supabase_schema.sql` line 136; columns `id, codigo_voucher, valor, cliente_id, prestador_id, status, categoria...`.
- **RLS Status:** Enabled (`20260830030000_admin_panel_security_end_to_end.sql` line 588).
- **Migration History:**
  - `20260720213000_secure_collaborator_panel.sql`: Assigned module boundary 'cadastro'.
  - `20260721000500_admin_module_rls_boundaries.sql`: Assigned module boundary 'promocoes'.
  - `20260830030000_admin_panel_security_end_to_end.sql`: Added to the administrative hardening loop (line 583):
    - Revoked PUBLIC and anon.
    - Granted SELECT, INSERT, UPDATE, DELETE to `authenticated`.
    - Dropped all legacy public policies (`Acesso total`).
    - Created `gsa_management_hardened`: `FOR ALL TO authenticated USING (public.gsa_jwt_actor_type() IN ('admin','colaborador'))`.
    - Created `gsa_collaborator_fail_closed_hardened`: Restrictive policy.
    - **OMISSION:** The migration created client ownership policies for `gsa_voucher_resgates`, `contratos`, etc., but **omitted `vouchers`**.
- **Evaluation:** **CRITICAL DEFECT.** RLS is enabled, but no policy exists allowing role `authenticated` with `actor_type = 'cliente'` to SELECT. The client panel (`ClientVouchers.tsx`) cannot display the client's vouchers.

---

## 4. Audit of Other Client-Facing Tables

| Table Name | RLS Enabled? | Role `authenticated` Policy? | Client Ownership Rule | Status & Vulnerability Assessment |
|---|---|---|---|---|
| `saques` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Read-only for owner client. Mutations via RPC. |
| `pontos_movimentacoes` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Read-only for owner client. |
| `vouchers` | YES | NO (admin only) | None | **DEFECT (P0):** Client policy missing. Clients cannot view vouchers. |
| `carteira_lancamentos` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Financial ledger read-only for owner client. |
| `clientes` | YES | YES | `id = gsa_jwt_actor_id()` | **SECURE.** Profile read-only via RLS; update via operational RPC. |
| `faturas` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Client can only see own invoices. |
| `transferencias` | YES | YES | `gsa_jwt_actor_id() IN (cliente_origem_id, cliente_destino_id)` | **SECURE.** Only sender/receiver can view. |
| `emprestimos` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Client loans restricted to owner. |
| `emprestimo_documentos` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** |
| `emprestimo_parcelas` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** |
| `emprestimo_comentarios` | YES | YES | `EXISTS (emprestimos.cliente_id = gsa_jwt_actor_id())` | **SECURE.** |
| `emprestimo_historico` | YES | YES | `EXISTS (emprestimos.cliente_id = gsa_jwt_actor_id())` | **SECURE.** |
| `loja_credito_solicitacoes`| YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Credit limit requests isolated to owner. |
| `loja_credito_movimentacoes`| YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Store credit movements isolated to owner. |
| `loja_credito_documentos` | YES | YES | `EXISTS (solicitacao.cliente_id = gsa_jwt_actor_id())` | **SECURE.** |
| `notificacoes` | YES | YES | `cliente_id = gsa_jwt_actor_id() OR broadcast` | **SECURE.** Private notifications + broadcasts. |
| `tickets` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Support tickets isolated to owner. |
| `ticket_mensagens` | YES | YES | `EXISTS (tickets.cliente_id = gsa_jwt_actor_id())` | **SECURE.** Message thread isolated to ticket owner. |
| `cliente_documentos` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** (Storage bucket `documentos_cliente` also restricted). |
| `loja_solicitacoes` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Customer store requests restricted to owner. |
| `orcamento_timeline` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Timeline events restricted to owner. |
| `ordens_servico` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Service orders restricted to owner. |
| `ordens_assinatura` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Subscriptions restricted to owner. |
| `indicacoes` | YES | YES | `indicador_id = gsa_jwt_actor_id()` | **SECURE.** Referral list restricted to referring client. |
| `level_history` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** VIP level changes restricted to owner. |
| `points_transactions` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Fallback points table restricted to owner. |
| `cliente_promocoes` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Activated promos restricted to owner. |
| `promocoes_quantidade_uso` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Usage count restricted to owner. |
| `loja_reembolsos` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Refund claims restricted to owner. |
| `gsa_voucher_resgates` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Redemption logs restricted to owner. |
| `contratos` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Contracts restricted to owner. |
| `extrato_financeiro` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Statement entries restricted to owner. |
| `pagamentos` | YES | YES | `EXISTS (faturas.cliente_id = gsa_jwt_actor_id())` | **SECURE.** Payments restricted to invoice owner. |
| `cupons_ativados` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Hardened in `20260830051000`. |
| `loja_pedido_itens` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Hardened in `20260714056000`. |
| `fatura_contestacoes` | YES | YES | `cliente_id = gsa_jwt_actor_id()` | **SECURE.** Hardened in `20260830043000`. |
| `orcamentos` | YES | YES (Bypassed) | `USING (true)` bypass exists! | **VULNERABILITY (P0):** `marketplace_orders_read` (`USING (true)`) exposes all client orders globally. |
| `ordens_compra` | YES | YES (Bypassed) | `USING (true)` bypass exists! | **VULNERABILITY (P0):** `marketplace_purchase_orders_read` (`USING (true)`) exposes all purchase items globally. |
| `loja_favoritos` | YES | YES (Permissive) | None (`USING (true)` on all commands) | **VULNERABILITY (P1):** Public read + full authenticated modification of any user's wishlist. |
| `promocoes_quantidade_ativadas` | **NO** | NO | None | **VULNERABILITY (P1):** RLS disabled. Direct access possible. |
| `loja_carrinhos` | **NO** | NO | None | **VULNERABILITY (P1):** RLS disabled. Direct access possible. |
| `cliente_premios` | YES | NO (missing) | None | **DEFECT (P1):** Zero policies exist. Clients cannot view earned prizes. |
| `os_notas` | YES | NO (admin only) | None | **DEFECT (P2):** Clients cannot see notes on their service orders. |
| `os_suporte_mensagens` | YES | NO (admin only) | None | **DEFECT (P2):** Clients cannot see support messages on their service orders. |
| `produtos`, `servicos`, `assinaturas`, `loja_categorias`, `promocoes`, `promocoes_quantidade`, `cupons_loja`, `client_levels`, `empresa` | YES | YES | `USING (true)` (Public catalog) | **INTENTIONAL PUBLIC CATALOG.** Reads are public `USING (true)`, writes revoked from public/anon. |

---

## 5. Security Vulnerabilities & Defects Catalog

### VULN-RLS-01 (Severity: Critical / Blocker) — Missing Client RLS Policy on `vouchers`
- **Location:** `supabase/migrations/20260830030000_admin_panel_security_end_to_end.sql` (lines 579-600)
- **Mechanism:** The migration locked down `vouchers` alongside administrative tables by dropping public policies and creating `gsa_management_hardened` (`actor_type IN ('admin','colaborador')`). However, it never created a policy granting SELECT to clients (`actor_type = 'cliente'`).
- **Impact:** Any client navigating to `ClientVouchers.tsx` receives 0 rows. Vouchers awarded through referrals or purchases cannot be redeemed or viewed.

### VULN-RLS-02 (Severity: Critical / Data Leak) — Unrestricted Public Read on `orcamentos`
- **Location:** `supabase/migrations/20260829211500_marketplace_security_refund_checkout_hardening.sql` (line 552)
- **Mechanism:** Created `CREATE POLICY marketplace_orders_read ON public.orcamentos FOR SELECT TO public USING (true);`. Migration `20260830030000` created `gsa_client_own_orcamentos_hardened`, but **did not drop** `marketplace_orders_read`. In PostgreSQL, permissive policies combine with `OR`. As a result, `(true OR client_id = actor_id)` evaluates to `true`.
- **Impact:** Any user or API client can query all orders/budgets of every client in the platform, exposing client IDs, total values, addresses, and transaction metadata.

### VULN-RLS-03 (Severity: Critical / Data Leak) — Unrestricted Public Read on `ordens_compra`
- **Location:** `supabase/migrations/20260829211500_marketplace_security_refund_checkout_hardening.sql` (line 553)
- **Mechanism:** Created `CREATE POLICY marketplace_purchase_orders_read ON public.ordens_compra FOR SELECT TO public USING (true);`. Never dropped by later migrations.
- **Impact:** Any user can query all items purchased across the marketplace.

### VULN-RLS-04 (Severity: High / Data Manipulation) — Wildcard RLS on `loja_favoritos`
- **Location:** `supabase/migrations/20260814120000_loja_favoritos_persistence.sql` (lines 433-444)
- **Mechanism:**
  ```sql
  CREATE POLICY "cliente_select_loja_favoritos" ON public.loja_favoritos FOR SELECT TO public USING (true);
  CREATE POLICY "admin_all_loja_favoritos" ON public.loja_favoritos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  ```
- **Impact:** Anyone can read any client's favorite items, and any logged-in user can insert, update, or delete any other user's favorites.

### VULN-RLS-05 (Severity: High) — RLS Disabled on `promocoes_quantidade_ativadas`
- **Location:** `supabase/migrations/20260609000002_add_promocoes_quantidade_ativadas.sql`
- **Mechanism:** Table created without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and never enabled in any subsequent migration.
- **Impact:** Direct table queries bypass RLS checks.

### VULN-RLS-06 (Severity: High) — RLS Disabled on `loja_carrinhos`
- **Location:** Database schema initialization; verified in `scratch/live_db_audit.json` line 32994.
- **Mechanism:** RLS was never enabled on `loja_carrinhos`.
- **Impact:** Shopping cart contents are exposed to direct table queries.

### VULN-RLS-07 (Severity: Medium / Functional Defect) — Missing Client Policy on `cliente_premios`
- **Location:** `master_supabase_schema.sql` / live database schema
- **Mechanism:** Table has `rls_enabled: true`, but has 0 policies configured for role `authenticated` or `cliente`.
- **Impact:** `ClientPremios.tsx` queries fail to return awarded prizes.

### VULN-RLS-08 (Severity: Low / Functional Defect) — Missing Client Read Policy on `os_notas` and `os_suporte_mensagens`
- **Location:** `supabase/migrations/20260830030000_admin_panel_security_end_to_end.sql` (line 581)
- **Mechanism:** Tables were locked down to admin/colaborador. No policy grants SELECT to the client who owns the underlying `ordens_servico`.
- **Impact:** `ClientServicos.tsx` cannot show notes or messages linked to the client's own service orders.

---

## 6. Recommended Remediation Plan (SQL Migration)

The following SQL migration will eliminate all discovered vulnerabilities and restore complete functionality to the Client Panel:

```sql
BEGIN;

-- 1. FIX VOUCHERS: Allow clients to read their own vouchers
DROP POLICY IF EXISTS gsa_client_own_vouchers_read ON public.vouchers;
CREATE POLICY gsa_client_own_vouchers_read
  ON public.vouchers
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 2. FIX ORCAMENTOS: Drop the open public wildcard policy
DROP POLICY IF EXISTS marketplace_orders_read ON public.orcamentos;
-- Ensure client read policy is active
DROP POLICY IF EXISTS gsa_client_own_orcamentos_hardened ON public.orcamentos;
CREATE POLICY gsa_client_own_orcamentos_hardened
  ON public.orcamentos
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 3. FIX ORDENS_COMPRA: Drop the open public wildcard policy
DROP POLICY IF EXISTS marketplace_purchase_orders_read ON public.ordens_compra;
-- Ensure client read policy is active
DROP POLICY IF EXISTS gsa_client_own_ordens_compra_hardened ON public.ordens_compra;
CREATE POLICY gsa_client_own_ordens_compra_hardened
  ON public.ordens_compra
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 4. FIX LOJA_FAVORITOS: Drop wildcard policies, enforce strict self-ownership
ALTER TABLE public.loja_favoritos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cliente_select_loja_favoritos" ON public.loja_favoritos;
DROP POLICY IF EXISTS "admin_all_loja_favoritos" ON public.loja_favoritos;
DROP POLICY IF EXISTS "Favoritos por cliente" ON public.loja_favoritos;
DROP POLICY IF EXISTS "loja_favoritos_select_all" ON public.loja_favoritos;
DROP POLICY IF EXISTS gsa_client_own_favoritos ON public.loja_favoritos;
CREATE POLICY gsa_client_own_favoritos
  ON public.loja_favoritos
  FOR ALL
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  )
  WITH CHECK (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 5. FIX PROMOCOES_QUANTIDADE_ATIVADAS: Enable RLS and restrict to owner
ALTER TABLE public.promocoes_quantidade_ativadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promocoes_quantidade_ativadas FROM PUBLIC, anon;
GRANT SELECT ON public.promocoes_quantidade_ativadas TO authenticated;
GRANT ALL ON public.promocoes_quantidade_ativadas TO service_role;
DROP POLICY IF EXISTS gsa_client_own_qty_promo_activations ON public.promocoes_quantidade_ativadas;
CREATE POLICY gsa_client_own_qty_promo_activations
  ON public.promocoes_quantidade_ativadas
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 6. FIX LOJA_CARRINHOS: Enable RLS and restrict to owner
ALTER TABLE public.loja_carrinhos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loja_carrinhos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_carrinhos TO authenticated;
GRANT ALL ON public.loja_carrinhos TO service_role;
DROP POLICY IF EXISTS gsa_client_own_cart ON public.loja_carrinhos;
CREATE POLICY gsa_client_own_cart
  ON public.loja_carrinhos
  FOR ALL
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  )
  WITH CHECK (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 7. FIX CLIENTE_PREMIOS: Add client read policy
ALTER TABLE public.cliente_premios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cliente_premios FROM PUBLIC, anon;
GRANT SELECT ON public.cliente_premios TO authenticated;
GRANT ALL ON public.cliente_premios TO service_role;
DROP POLICY IF EXISTS gsa_client_own_premios_read ON public.cliente_premios;
CREATE POLICY gsa_client_own_premios_read
  ON public.cliente_premios
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- 8. FIX OS_NOTAS & OS_SUPORTE_MENSAGENS: Allow clients to view notes/messages for their service orders
DROP POLICY IF EXISTS gsa_client_own_os_notas ON public.os_notas;
CREATE POLICY gsa_client_own_os_notas
  ON public.os_notas
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_id
        AND os.cliente_id = public.gsa_jwt_actor_id()
    )
  );

DROP POLICY IF EXISTS gsa_client_own_os_suporte_mensagens ON public.os_suporte_mensagens;
CREATE POLICY gsa_client_own_os_suporte_mensagens
  ON public.os_suporte_mensagens
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_id
        AND os.cliente_id = public.gsa_jwt_actor_id()
    )
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
```

---

## 7. Verification Method

To verify these findings and confirm the security posture:
1. **Inspect policy definitions directly from catalog:**
   ```sql
   SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename IN ('saques', 'pontos_movimentacoes', 'vouchers', 'orcamentos', 'ordens_compra', 'loja_favoritos', 'promocoes_quantidade_ativadas', 'loja_carrinhos', 'cliente_premios')
   ORDER BY tablename, policyname;
   ```
2. **Inspect table RLS flags:**
   ```sql
   SELECT relname, relrowsecurity, relforcerowsecurity
   FROM pg_class
   WHERE relname IN ('saques', 'pontos_movimentacoes', 'vouchers', 'orcamentos', 'ordens_compra', 'loja_favoritos', 'promocoes_quantidade_ativadas', 'loja_carrinhos', 'cliente_premios');
   ```
3. **Validate Auth Simulation:**
   Simulate an authenticated client session using:
   ```sql
   SET LOCAL role TO authenticated;
   SET LOCAL "request.jwt.claims" TO '{"app_metadata": {"gsa_actor_type": "cliente", "gsa_actor_id": "00000000-0000-0000-0000-000000000001", "gsa_session_id": "00000000-0000-0000-0000-000000000002"}}';
   SELECT * FROM public.saques; -- Should only return records where cliente_id = 00000000-0000-0000-0000-000000000001
   SELECT * FROM public.vouchers; -- Currently returns 0 records even when records exist for this client!
   SELECT * FROM public.orcamentos; -- Currently returns ALL records due to marketplace_orders_read bypass!
   ```
