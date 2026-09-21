# Handoff Report — Explorer R6: VPS Webhook & WhatsApp Bot Realtime Audit

**Agent:** Explorer R6  
**Parent Agent:** `91d031e2-3f08-418b-be50-7447fa705bdf`  
**Mission:** Audit VPS Webhook & WhatsApp Bot Realtime Integration  
**Target Files:** `server_webhook_vps_live.cjs`, `server_webhook.cjs`, `lib/antiBanEngine.cjs`  
**Full Technical Analysis:** `.agents/explorer_r6_vps_webhook/analysis.md`

---

## 1. Observation

1. **Database Query Architecture (100% REST, Zero Realtime)**:
   - In `server_webhook_vps_live.cjs` (lines 2904–3096), all database queries use raw HTTP requests via Node `http.request` to `http://127.0.0.1:3001` (`supabaseGet`, `supabasePost`, `supabasePatch`, `supabaseRpc`, `supabaseUpsertCustom`).
   - A search for `supabase.channel`, `realtime`, `websocket`, `postgres_changes` across `server_webhook_vps_live.cjs` returned **0 matches**.
   - Profile resolution (`fetchUserProfile`, lines 3896–3960) fires 4 simultaneous REST requests (`clientes`, `gsa_afiliados`, `fornecedores`, `prestadores`) on every user message without session-level profile memoization.
   - The AI dynamic catalog (`fetchCatalogForAI`, lines 82–143) caches `servicos` and `produtos` in memory (`_catalogCache`) with a 5-minute fixed TTL (`300000 ms`), serving stale prices and products after database updates.

2. **Supabase Database Webhook Inbound Defect (`/webhook/supabase-update`)**:
   - `server_webhook_vps_live.cjs` lines 8813–8940 serve `handleSupabaseWebhook`.
   - Lines 8822–8828 attempt to extract phone numbers via `record.telefone || record.telefone_contato || record.celular`.
   - Tables `loja_pedidos`, `orcamentos`, `os_servicos`, and `cliente_documentos` only have `cliente_id` (foreign key) and lack inline `telefone`. Consequently, `clientPhone` evaluates to `null` (line 8834), and customer WhatsApp status update messages (lines 8872, 8896, 8924) **never execute**.

3. **Inbound Message Burst Concurrency & State Race Conditions**:
   - `server_webhook_vps_live.cjs` lines 9153–9160 invoke `processMessage(...)` asynchronously without `await` and without a per-phone mutex/lock.
   - When a user sends rapid successive messages, concurrent async branches read and mutate `userSessions[fromPhone]` simultaneously, causing duplicate ticket creation and state corruption.

4. **Points-to-Wallet Conversion Read-Modify-Write (RMW) Vulnerability**:
   - `server_webhook_vps_live.cjs` lines 4991–5008 read stale in-memory points (`pts = session.client.saldo_pontos`), calculate `newSaldoCarteira` in Node.js memory, and execute `supabasePatch('/rest/v1/clientes?id=eq.' + session.client.id, { saldo_pontos: 0, saldo_carteira: newSaldoCarteira })`.
   - This lacks atomic transaction guarantees and risks double-conversion or overwriting concurrent wallet balance changes.

5. **`Math.random()` Collision Vulnerability in Protocols & IDs**:
   - `createAITicket` (line 150): `protocolo = 'TKT-' + year + '-' + Math.floor(1000 + Math.random() * 9000);` (only 9,000 slots per year).
   - Phone voucher (`checkPhoneVoucherStatus`, line 222): `rawCode = 'GSA-PRO-' + Math.floor(100000 + Math.random() * 900000);`
   - Quotes/Orcamentos (lines 3558, 5225, 6745): `orcCod = 'ORC-' + year + '-' + Math.floor(1000 + Math.random() * 9000);`
   - Invoices/Faturas (lines 3591, 5290): `codigo_fatura = 'FAT-' + year + '-' + Math.floor(1000 + Math.random() * 9000);`

6. **Environment Variable Fallback Discrepancy (Bug)**:
   - Line 14: `const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOi...';`
   - Line 2902: `const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || '';`
   - If `SUPABASE_SERVICE_ROLE_KEY` is not present in process environment variables, `SERVICE_ROLE_JWT` evaluates to `''`, causing `supabaseGet`, `supabasePost`, and `supabasePatch` to fail with empty authorization headers.

---

## 2. Logic Chain

1. **REST vs Realtime**: The server relies entirely on local PostgREST HTTP requests. Because there is no persistent WebSocket CDC listener (`supabase.channel`), the server is incapable of receiving real-time database events (such as operator web chat replies, ticket reassignments, or order approvals) without an external webhook trigger.
2. **Webhook Endpoint Fragility**: The `/webhook/supabase-update` fallback fails in practice for order/service tables due to missing foreign-key phone resolution.
3. **Concurrency Analysis**: Because JavaScript event loop handles async I/O between ticks, multiple incoming webhook POST requests for the same sender interleave execution before state commits to `userSessions`, leading to data race conditions and duplicate operations.
4. **Data Integrity**: Performing balance calculations in Node.js application memory rather than through PostgreSQL atomic stored procedures (`SELECT FOR UPDATE` or `UPDATE ... SET saldo = saldo + delta`) creates critical double-spend and lost-update vulnerabilities.
5. **Protocol Generation**: Unseeded 4-digit random numbers produce high collision probabilities in production according to the Birthday Problem, leading to unhandled unique constraint errors.

---

## 3. Caveats

1. **VPS Runtime Environment**: The live VPS at `opc@147.15.43.141` runs PostgREST locally on port 3001 and Evolution API on port 8080. If network isolation restricts port 3001 to localhost, cloud Realtime WebSockets (`wss://<ref>.supabase.co/realtime/v1`) must connect via public internet or VPN.
2. **Anti-Ban Constraints**: Implementing real-time operator chat relay via CDC must route all outbound messages through `antiBanEngine.enqueueMessage` to preserve human presence emulation and avoid WhatsApp spam flags.
3. **No Code Modification**: In accordance with the Explorer role, no source code was directly modified; full implementation blueprints and code patches are provided in `analysis.md`.

---

## 4. Conclusion

- **Architecture Assessment**: The current VPS Webhook system is functional for standalone customer-initiated WhatsApp interactions, but lacks real-time bidirectional synchronization with the web admin platform.
- **Priority Fixes**:
  1. **P0**: Fix `SERVICE_ROLE_JWT` variable fallback bug (`server_webhook_vps_live.cjs:2902`).
  2. **P0**: Introduce `SessionMutex` to serialize incoming message processing per phone number (`lib/sessionMutex.cjs`).
  3. **P0**: Migrate points conversion to an atomic PostgreSQL stored procedure (`gsa_converter_pontos_carteira`).
  4. **P1**: Deploy `ServerRealtimeManager` (`lib/serverRealtimeManager.cjs`) using `supabase.channel()` to enable instant operator chat relay, order status updates, and catalog cache invalidation.
  5. **P1**: Replace `Math.random()` protocols with cryptographic UUID/timestamp sequences.

---

## 5. Verification Method

To independently verify these findings, execute the following commands in the workspace root:

1. **Verify Absence of Realtime / WebSocket in Webhook**:
   ```bash
   grep -rn "supabase.channel" server_webhook_vps_live.cjs server_webhook.cjs lib/antiBanEngine.cjs
   # Result: 0 matches (proves purely REST-based architecture)
   ```

2. **Verify Variable Fallback Bug**:
   ```bash
   grep -n "SERVICE_ROLE_JWT" server_webhook_vps_live.cjs
   # Check line 2902: const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
   # Contrast with line 14: const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '<jwt>';
   ```

3. **Verify Defect in `/webhook/supabase-update`**:
   ```bash
   # Inspect lines 8820-8835 of server_webhook_vps_live.cjs:
   # Note that clientPhone extraction only inspects record.telefone, which is null on loja_pedidos and os_servicos.
   ```

4. **Verify RMW Race Condition on Points Conversion**:
   ```bash
   # Inspect lines 4990-5008 of server_webhook_vps_live.cjs:
   # Note non-atomic read of session.client.saldo_pontos followed by PATCH of calculated saldo_carteira.
   ```

5. **Verify Math.random() Protocol Patterns**:
   ```bash
   grep -n "Math.random" server_webhook_vps_live.cjs | grep -E "TKT|ORC|FAT|CLI|PRD|PRO"
   ```
