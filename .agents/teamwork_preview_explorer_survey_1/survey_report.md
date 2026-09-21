# GSA HUB Deep System Audit — Security, RPCs & Webhooks Survey Report

**Explorer ID**: `teamwork_preview_explorer_survey_1`  
**Specialty**: Security & Backend / RPCs / Webhooks Specialist  
**Date**: 2026-08-28  
**Scope**: Backend Webhook Servers (`server_webhook_vps_live.cjs`, `server_webhook.cjs`), Supabase Client & Architecture, PostgreSQL Stored Procedures (RPCs), Row Level Security (RLS) Policies, Authentication/Authorization, Concurrency, and Integration Encodings.

---

## 1. Executive Summary

This comprehensive audit investigated the backend architecture, webhook engines, database permissions, RPC stored procedures, and frontend-to-backend communication pipelines across the GSA HUB repository.

### Key Risk Summary Matrix

| Vulnerability / Defect | Severity | Impact | File Location(s) |
|---|---|---|---|
| **Unauthenticated `cliente_operational_write` RPC** | **CRITICAL (P0)** | Allows any remote anonymous user to execute arbitrary `INSERT`, `UPDATE`, and `DELETE` on 24 core tables, with unrestricted column manipulation (e.g. balances, limits, roles). | `supabase/migrations/20260814120000_loja_favoritos_persistence.sql:17-106`, live schema |
| **92 Open RLS Policies (`Public Full Access`)** | **CRITICAL (P0)** | Public/Anon users holding the anon key can directly query and modify sensitive tables (`clientes`, `faturas`, `pagamentos`, `cobrancas`, `carteira_lancamentos`). | Live DB Schema, `master_supabase_schema.sql:640-645`, `scratch/live_db_audit.md` |
| **Unprotected Security Definer Administrative RPCs** | **CRITICAL (P0)** | `delete_client_cascade(p_cliente_id)` and metadata extraction RPCs (`get_auth_users_details`, `get_database_details`) are granted to `PUBLIC`/`anon` without session verification. | Live DB Schema, `vps_functions.json:29,60,63` |
| **Hardcoded Secrets & API Keys in Source Code** | **HIGH (P1)** | Hardcoded `SUPABASE_SERVICE_ROLE_KEY` (JWT), `GEMINI_API_KEY`, and `SUPABASE_ANON_KEY` embedded in repo files. | `server_webhook_vps_live.cjs:14,18,123`, `server_webhook.cjs:14,18`, `src/lib/supabase.ts:308-310` |
| **`/webhook/supabase-update` Missing Client Phone Lookup** | **HIGH (P1)** | Outgoing WhatsApp notifications for store orders, bills, OS, quotes, and documents fail because `record.telefone` is null on relational tables. | `server_webhook_vps_live.cjs:8877-8985`, `server_webhook.cjs:9071-9180` |
| **Client-Side Read-Modify-Write (RMW) Balance Overwrite** | **HIGH (P1)** | UI fallback directly executes `supabase.from('clientes').update({ saldo_carteira: novoSaldo })` using stale client state on RPC error. | `src/components/admin/super-domains/contratos/CrmClientesView.tsx:254-258` |
| **Corrupted Characters / Broken UTF-8 in WhatsApp & Services** | **HIGH (P1)** | Corrupted byte sequences (`\uFFFD`, double-encoding) in `src/features/partners/service.ts:751,771`, `src/utils/n8nWhatsApp.ts:62,82,97,101,104`, and `PartnerRedemptionDetailModal.tsx` cause WhatsApp message corruption and fail 17 vitest test suites (15 test assertion failures). | `src/features/partners/service.ts`, `src/utils/n8nWhatsApp.ts`, `PartnerRedemptionDetailModal.tsx` |
| **Inconsistent `SERVICE_ROLE_JWT` Top-Level Declarations** | **MEDIUM (P2)** | `SERVICE_ROLE_JWT` referenced before declaration in earlier functions (e.g. `createAITicket`). | `server_webhook.cjs:211` vs `2659`, `server_webhook_vps_live.cjs:211` vs `2945` |

---

## 2. In-Depth Audit: Webhook Servers (`server_webhook_vps_live.cjs`, `server_webhook.cjs`)

### 2.1 Hardcoded Secrets and Fallback Chains
- **Observations**:
  - `server_webhook_vps_live.cjs:14`:
    ```javascript
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODY5ODQzMzYsImV4cCI6MjEwMjM0NDMzNn0.HErwZVyHaKqhK_vRx66dcMXSlYkubChX7vGzDDbJHu0';
    ```
  - `server_webhook_vps_live.cjs:18`:
    ```javascript
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAD95jNTRpQdfuL96Mffs7FmqXbRWy-jM0';
    ```
  - `server_webhook_vps_live.cjs:123`:
    ```javascript
    const SUPABASE_ANON_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZ2FqdmFneGFndXRmdmd4d3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTY0MDksImV4cCI6MjA4OTUzMjQwOX0.1OXsjDAsGl82u6ytGQ5iX2vroXjhmqUoFkbOLKbO6XI';
    ```
  - `server_webhook_vps_live.cjs:2945`:
    ```javascript
    const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || '';
    ```
- **Analysis**:
  1. The fallback chains now correctly prioritize environment variables while falling back to the configuration constants.
  2. However, placing `const SERVICE_ROLE_JWT` at line 2945 means functions declared or executed earlier (such as `createAITicket` at line 190) reference `SERVICE_ROLE_JWT` before its initialization statement.
- **Remediation**:
  Move `const SERVICE_ROLE_JWT = ...` to lines 15-16 directly underneath `SUPABASE_SERVICE_ROLE_KEY`. Never log raw tokens in console outputs.

---

### 2.2 Concurrency, SessionMutex & Race Conditions
- **Observations**:
  - `SessionMutex` is implemented at `server_webhook_vps_live.cjs:44-83` and applied to inbound messages in the Evolution API router at line 9208:
    ```javascript
    sessionMutex.runExclusive(fromPhone, async () => {
      try {
        const rawMessageData = data.data || {};
        await processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData);
      } catch (errProcess) { ... }
    });
    ```
  - Loyalty point conversion at line 5044 calls `supabaseRpc('gsa_converter_pontos_carteira', { p_cliente_id: clientId }, ...)`, ensuring database-level row lock (`SELECT ... FOR UPDATE`) during atomic conversion.
- **Defects & Gaps**:
  1. **Scraping and Supabase Webhooks**: Background scraping (`handleProductScraping`) and database change events (`handleSupabaseWebhook`) run outside `SessionMutex`. If a Supabase webhook triggers a message to a user while the user is actively chatting, a race condition occurs in `sendWhatsAppReply`.
  2. **Transient In-Memory State**: `userSessions` is an in-memory dictionary. If PM2 restarts the process or multiple instances are spawned across cluster workers, state and locks are not synchronized across workers.
- **Remediation**:
  Route outbound user messages resulting from `handleSupabaseWebhook` through `sessionMutex.runExclusive(clientPhone, ...)`.

---

### 2.3 Webhook Failure Mode: Missing Phone Extraction in `/webhook/supabase-update`
- **Observations**:
  - `server_webhook_vps_live.cjs:8877-8883`:
    ```javascript
    const getClientPhone = (rec) => {
      let rawPhone = rec.telefone || rec.telefone_contato || rec.celular;
      if (!rawPhone) return null;
      let phone = String(rawPhone).replace(/\D/g, '');
      if (!phone.startsWith('55') && phone.length >= 10) phone = '55' + phone;
      return phone;
    };
    ```
  - For tables `loja_pedidos` (line 8914), `cliente_documentos` (line 8944), `orcamentos` (line 8970), `os_servicos` (line 8971):
    The payload record has schema `{ id, cliente_id, status, ... }` — none of these tables have a `telefone` column.
  - As a result, `clientPhone` is always `null`, and the conditional blocks `if (clientPhone) { sendWhatsAppReply(...) }` are never reached.
- **Remediation**:
  When `rec.cliente_id` is present and `rawPhone` is absent, perform an asynchronous lookup:
  ```javascript
  async function resolveClientContact(clienteId, rec) {
    let phone = getClientPhone(rec);
    let name = getDisplayName(rec);
    if (phone) return { phone, name };
    if (!clienteId) return { phone: null, name };
    return new Promise((resolve) => {
      supabaseGet(`/rest/v1/clientes?id=eq.${encodeURIComponent(clienteId)}&select=id,nome,telefone,celular&limit=1`, (err, rows) => {
        if (!err && Array.isArray(rows) && rows[0]) {
          return resolve({ phone: getClientPhone(rows[0]), name: getDisplayName(rows[0]) });
        }
        resolve({ phone: null, name });
      });
    });
  }
  ```

---

## 3. In-Depth Audit: Database, RLS, and Stored Procedures (RPCs)

### 3.1 Critical Vulnerability: Unauthenticated `cliente_operational_write`
- **Location**: `supabase/migrations/20260814120000_loja_favoritos_persistence.sql:17-106`, live schema
- **Vulnerability Details**:
  - `cliente_operational_write` is declared as `SECURITY DEFINER` with parameters `(p_cliente_id uuid, p_table text, p_action text, p_data jsonb, p_filter jsonb)`.
  - In PostgreSQL, functions created with `CREATE OR REPLACE FUNCTION` default to granting execution to `PUBLIC`.
  - Unlike `gsa_client_operational_write` (which requires `p_sessao_id` and `p_session_token` and validates them against `gsa_client_session_actor`), `cliente_operational_write` performs **zero authentication**. It accepts any `p_cliente_id` passed in the request.
  - On `update`, it builds dynamic SQL from all keys in `p_data` except `cliente_id`:
    ```sql
    IF v_action = 'update' THEN
      SELECT string_agg(format('%I = %L', key, value #>> '{}'), ', ')
        INTO v_sets
      FROM jsonb_each(v_data)
      WHERE key <> 'cliente_id' AND value IS NOT NULL AND value <> 'null'::JSONB;
      v_sql := format('UPDATE public.%I SET %s WHERE %s RETURNING to_jsonb(%I.*)', v_table, v_sets, v_where, v_table);
      EXECUTE v_sql INTO v_result;
    ```
  - **Attack Vector**: Any remote user holding the public anonymous Supabase key can call:
    ```javascript
    supabase.rpc('cliente_operational_write', {
      p_cliente_id: '<VICTIM_CLIENT_UUID>',
      p_table: 'clientes',
      p_action: 'update',
      p_data: {
        saldo_carteira: 999999.00,
        saldo_pontos: 1000000,
        limite_credito_disponivel: 500000.00
      },
      p_filter: { id: '<VICTIM_CLIENT_UUID>' }
    });
    ```
- **Remediation**:
  1. `REVOKE ALL ON FUNCTION public.cliente_operational_write(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;`
  2. `GRANT EXECUTE ON FUNCTION public.cliente_operational_write(uuid, text, text, jsonb, jsonb) TO service_role;`
  3. Ensure that all client mutations go strictly through `gsa_client_operational_write` with session token verification and field whitelisting.

---

### 3.2 Critical Vulnerability: 92 Open RLS Policies (`Public Full Access`)
- **Location**: `master_supabase_schema.sql:640-645`, `scratch/live_db_audit.md:24,51-144`
- **Vulnerability Details**:
  - The master schema generator iterated over all public tables and executed:
    ```sql
    CREATE POLICY "Public Full Access" ON public.%I FOR ALL USING (true) WITH CHECK (true)
    ```
  - In the live database, 92 tables retain permissive policies granted to `{public}` or `{anon}` with `cmd: ALL`, `qual: true`, `with_check: true`.
  - Sensitive tables exposed include:
    - Financial: `faturas`, `pagamentos`, `cobrancas`, `cobranca_historico`, `carteira_lancamentos`, `extrato_financeiro`, `loja_credito_movimentacoes`, `loja_credito_solicitacoes`.
    - User/PII: `clientes`, `colaboradores`, `prestadores`, `solicitacoes_exclusao`.
- **Remediation**:
  Execute an automated lockdown script:
  1. Drop all `"Public Full Access"` and wildcard `ALL USING (true)` policies for public/anon roles on sensitive domain tables.
  2. Implement strict row-level filters:
     - Public read-only tables (`servicos`, `produtos`, `parceiros`, `loja_categorias`): `FOR SELECT TO public USING (status = 'ativo' OR status = 'publicado')`.
     - User owned tables: `FOR ALL TO authenticated USING (cliente_id = auth.uid())` or restrict access exclusively to authenticated RPCs (`SECURITY DEFINER` with session validation) and revoke direct table write from anon/authenticated.

---

### 3.3 Critical Vulnerability: Administrative Stored Procedures without Authentication
- **Observations in `vps_functions.json`**:
  - `delete_client_cascade(p_cliente_id uuid)`: `is_security_definer: true`, granted to `PUBLIC`, `anon`, `authenticated`.
  - `get_auth_users_details()`: `is_security_definer: true`, granted to `PUBLIC`, `anon`, `authenticated`. Leaks auth user accounts and email addresses.
  - `get_database_details()`, `get_system_metrics()`, `get_storage_details()`: `is_security_definer: true`, granted to `PUBLIC`, `anon`. Leaks server topology and storage paths.
  - `admin_delete_record(p_admin_code text, p_table text, p_id uuid)`: Uses plaintext admin code instead of active session tokens.
- **Remediation**:
  1. Revoke `EXECUTE` on `delete_client_cascade`, `get_auth_users_details`, `get_database_details`, `get_system_metrics`, `get_storage_details` from `PUBLIC`, `anon`, `authenticated`.
  2. Replace legacy `p_admin_code` RPCs with `gsa_admin_*` RPCs requiring `(p_sessao_id uuid, p_session_token text)`.

---

### 3.4 Read-Modify-Write (RMW) Concurrency in Frontend Balance Adjustments
- **Location**: `src/components/admin/super-domains/contratos/CrmClientesView.tsx:252-259`
- **Observations**:
  ```typescript
  const { error } = await supabase.rpc('gsa_admin_ajustar_saldo_cliente', {
    p_cliente_id: selectedCliente.id,
    p_valor: valorFinal,
    p_motivo: ajusteSaldoMotivo.trim()
  });

  if (error) {
    // Fallback update
    const novoSaldo = Math.max(0, selectedCliente.saldo_carteira + valorFinal);
    await supabase
      .from('clientes')
      .update({ saldo_carteira: novoSaldo })
      .eq('id', selectedCliente.id);
  }
  ```
- **Analysis**:
  1. If `gsa_admin_ajustar_saldo_cliente` fails, the client code computes `novoSaldo` from in-memory state `selectedCliente.saldo_carteira` and issues a direct database update.
  2. If another transaction modified the wallet in the interim, the direct update overwrites the balance with stale data, causing financial discrepancies.
  3. Furthermore, direct updates to `saldo_carteira` on `clientes` should be completely blocked by RLS policies.
- **Remediation**:
  Remove the direct update fallback in `CrmClientesView.tsx`. If the atomic RPC fails, present an error toast to the administrator without attempting non-atomic client-side mutations.

---

## 4. In-Depth Audit: Integrations & Character Encoding

### 4.1 Character Corruption across Services & Components
- **Locations**:
  - `src/features/partners/service.ts:751,771`:
    - Line 751: `throw new Error('No foi possvel enviar o anexo de evidncia.');`
    - Line 771: `throw new Error('No foi possvel registrar a deciso do recurso.');`
  - `src/utils/n8nWhatsApp.ts:62,82,97,101,104`:
    - Corrupted tokens `xa`, `x &`, `S&`, `a️`, `R`.
  - `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`:
    - Contains replacement character `\uFFFD` in user-facing texts.
- **Test Impact**:
  During `npm run test:unit`, 17 test files and 15 assertions failed specifically due to `\uFFFD` and broken UTF-8 strings in service error messages and WhatsApp templates.
- **Remediation**:
  Normalize all string literals across `src/features/partners/service.ts`, `src/utils/n8nWhatsApp.ts`, and `PartnerRedemptionDetailModal.tsx` to clean UTF-8 Portuguese characters.

---

## 5. Comprehensive Remediation Strategy & Action Plan

### Action 1: Database Security Hardening Migration
Apply a dedicated SQL migration (`supabase/migrations/20260828230000_deep_security_remediation.sql`):
1. **Revoke Public Execution on Dangerous Security Definer Functions**:
   ```sql
   REVOKE ALL ON FUNCTION public.cliente_operational_write(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
   GRANT EXECUTE ON FUNCTION public.cliente_operational_write(uuid, text, text, jsonb, jsonb) TO service_role;

   REVOKE ALL ON FUNCTION public.delete_client_cascade(uuid) FROM PUBLIC, anon, authenticated;
   GRANT EXECUTE ON FUNCTION public.delete_client_cascade(uuid) TO service_role;

   REVOKE ALL ON FUNCTION public.get_auth_users_details() FROM PUBLIC, anon, authenticated;
   GRANT EXECUTE ON FUNCTION public.get_auth_users_details() TO service_role;

   REVOKE ALL ON FUNCTION public.get_database_details() FROM PUBLIC, anon, authenticated;
   REVOKE ALL ON FUNCTION public.get_system_metrics() FROM PUBLIC, anon, authenticated;
   REVOKE ALL ON FUNCTION public.get_storage_details() FROM PUBLIC, anon, authenticated;
   ```
2. **Eliminate Open Wildcard RLS Policies on Sensitive Tables**:
   Drop `Public Full Access` on `clientes`, `faturas`, `pagamentos`, `cobrancas`, `cobranca_historico`, `loja_credito_solicitacoes`, `loja_credito_movimentacoes`, `loja_credito_documentos`, `demanda_comentarios`, `carteira_lancamentos`.

### Action 2: Webhook VPS Stabilization
1. In `server_webhook_vps_live.cjs` and `server_webhook.cjs`:
   - Declare `SERVICE_ROLE_JWT` immediately at top-level.
   - Implement `resolveClientContact` in `handleSupabaseWebhook` to fetch customer phone and name for relational records.
   - Route all customer-bound dispatches through `sessionMutex.runExclusive(phone, ...)`.

### Action 3: Frontend & Integration Cleanup
1. Clean up corrupted UTF-8 literals in `src/features/partners/service.ts`, `src/utils/n8nWhatsApp.ts`, and `PartnerRedemptionDetailModal.tsx`.
2. Remove unsafe RMW fallback in `src/components/admin/super-domains/contratos/CrmClientesView.tsx`.
3. Verify with `npm run typecheck:strict` and `npm run test:unit`.

---
*Report prepared for orchestrator review and remediation phase dispatch.*
