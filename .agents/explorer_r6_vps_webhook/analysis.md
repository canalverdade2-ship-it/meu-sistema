# Technical Audit Report — R6: VPS Webhook & WhatsApp Bot Realtime Integration

**Auditor:** Explorer R6  
**Target Subsystems:**
- `server_webhook_vps_live.cjs` (VPS Production Webhook & Bot Service, ~9,236 lines)
- `server_webhook.cjs` (Local Mirror Webhook Service, ~9,439 lines)
- `lib/antiBanEngine.cjs` (WhatsApp Anti-Ban Shield Core Engine, ~925 lines)
- Integration with Supabase PostgREST (`http://127.0.0.1:3001`), Evolution API (`http://127.0.0.1:8080`), and Supabase Realtime (WebSocket CDC)

---

## 1. Executive Summary & Verdict

The VPS WhatsApp Webhook server (`server_webhook_vps_live.cjs`) and WhatsApp Anti-Ban Engine (`lib/antiBanEngine.cjs`) constitute the conversational backbone of the GSA HUB ecosystem, handling customer interactions, automated ticket creation, catalog exploration, and partner benefit redemptions.

### Key Audit Findings:
1. **100% REST-Based Database Interaction (Zero Server-Side Realtime Listeners):**
   - Supabase queries are executed strictly as one-shot HTTP REST calls to a local PostgREST instance (`http://127.0.0.1:3001`) via Node.js native `http.request`.
   - There are **no active `supabase.channel()` or PostgreSQL CDC listeners** running inside the webhook server.
2. **Missing Realtime CDC Opportunities for Operator Chat & Status Events:**
   - When a human operator replies to a support conversation in the web dashboard, the bot cannot react in real time. Operators must manually use the `#responder <phone> <msg>` command via WhatsApp.
   - Ticket assignments, order status transitions (`loja_pedidos`, `os_servicos`), and partner redemption approvals rely on passive, loss-prone HTTP database webhooks (`/webhook/supabase-update`), which fail to resolve customer phone numbers on order tables.
3. **Critical Race Conditions & Lack of Per-User Session Mutex:**
   - Rapid incoming message bursts from the same phone number execute concurrently in parallel asynchronous branches, causing state corruption in `userSessions[fromPhone]`.
   - Points-to-wallet conversions (`saldo_pontos` -> `saldo_carteira`) perform non-atomic Read-Modify-Write (RMW) calculations in Node.js memory, vulnerable to double-spending and lost updates.
4. **Collision-Prone Protocol Generation via `Math.random()`:**
   - Support ticket protocols, quotes, invoices, and voucher codes are generated with unseeded `Math.random()` (e.g. `TKT-YYYY-XXXX` with only 9,000 yearly slots), risking database unique key constraint failures.
5. **Security & Configuration Discrepancies:**
   - A critical variable initialization bug in `server_webhook_vps_live.cjs:2902` causes `SERVICE_ROLE_JWT` to become an empty string if `process.env.SUPABASE_SERVICE_ROLE_KEY` is not explicitly exported, breaking REST queries.
   - Hardcoded Service Role JWTs and Gemini API keys are embedded directly in source code.

---

## 2. Database Query Patterns: REST vs. Realtime Audit

### 2.1 Low-Level PostgREST Query Helpers
In `server_webhook_vps_live.cjs` (lines 2904–3096), all database operations are executed via raw HTTP requests directed at `http://127.0.0.1:3001`:

```javascript
// server_webhook_vps_live.cjs:2904-2946
function supabaseGet(path, callback) {
  const cleanPath = path.replace(/^\/rest\/v1/, '');
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: cleanPath,
    method: 'GET',
    headers: {
      'apikey': SERVICE_ROLE_JWT,
      'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
      'Content-Type': 'application/json'
    }
  };
  ...
}
```

| Function | Method | Target Endpoint | Headers / Options | Status Handling |
| :--- | :--- | :--- | :--- | :--- |
| `supabaseGet` | GET | `127.0.0.1:3001/<path>` | `apikey`, `Authorization`, timeout 8s | Parses JSON response; returns error on timeout or parse failure |
| `supabasePost` | POST | `127.0.0.1:3001/<path>` | `Prefer: return=representation` (or `merge-duplicates`) | Writes JSON payload, returns representation |
| `supabasePatch` | PATCH | `127.0.0.1:3001/<path>` | `Prefer: return=representation` | Sends partial update |
| `supabaseRpc` | POST | `127.0.0.1:3001/rpc/<name>` | `Prefer: return=representation`, timeout 10s | Calls Postgres stored procedure |
| `supabaseUpsertCustom` | POST | `127.0.0.1:3001/<path>?on_conflict=...` | `Prefer: resolution=merge-duplicates` | Conflict-aware upsert |

### 2.2 In-Memory Catalog Cache & Polling
- **Implementation** (`server_webhook_vps_live.cjs:82-143`): `fetchCatalogForAI` caches services and products in memory (`_catalogCache`) for **5 minutes (300,000 ms)**.
- **Problem**: When products, prices, or services are edited in the Supabase web dashboard, the WhatsApp AI bot continues serving outdated prices, descriptions, and stock status for up to 5 minutes.
- **Root Cause**: Absence of a PostgreSQL CDC listener on `servicos` and `produtos` to perform instant cache invalidation.

### 2.3 User Profile 4-Way Parallel Lookup
- **Implementation** (`server_webhook_vps_live.cjs:3896-3960`): `fetchUserProfile` fires **4 simultaneous HTTP GET queries** (`clientes`, `gsa_afiliados`, `fornecedores`, `prestadores`) on every user message or lookup.
- **Problem**: Incurs 4 local HTTP round-trips per contact interaction without per-session caching of resolved identity.

### 2.4 The `/webhook/supabase-update` Inbound Endpoint
At line 8813–8940, `handleSupabaseWebhook` serves `POST /webhook/supabase-update`. This endpoint was designed to receive Supabase Database Webhooks (HTTP triggers) for `clientes`, `parceiros`, `afiliados`, `loja_pedidos`, `cliente_documentos`, `viagens_orcamentos`, and `orcamentos`/`os_servicos`.

#### Critical Defect Found in `handleSupabaseWebhook`:
Lines 8822–8828 inspect `record.telefone || record.telefone_contato || record.celular`.
However, tables such as `loja_pedidos`, `orcamentos`, `os_servicos`, and `cliente_documentos` **do NOT store the client's phone number directly in the order record**; they only store `cliente_id` (foreign key to `clientes.id`).
As a result:
- `clientPhone` evaluates to `null` (`server_webhook_vps_live.cjs:8834`).
- Conditions like `if (oldStatus !== newStatus && clientPhone)` (lines 8872, 8896, 8924) **silently evaluate to `false`**.
- WhatsApp notifications for order status changes, document approval/rejection, and OS status updates **are never delivered to clients**.

---

## 3. Server-Side `supabase.channel()` & PostgreSQL CDC Opportunities

The webhook service currently operates purely reactively on inbound WhatsApp messages. Integrating `@supabase/supabase-js` Realtime subscriptions (`supabase.channel()`) on the VPS unlocks powerful automated capabilities:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SUPABASE POSTGRESQL DATABASE                          │
│                                                                             │
│  ┌───────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │   tickets_mensagens   │  │       tickets       │  │   loja_pedidos    │  │
│  │  (Operator Replies)   │  │  (Status/Assignee)  │  │ (Status: Shipp'd) │  │
│  └──────────┬────────────┘  └──────────┬──────────┘  └─────────┬─────────┘  │
└─────────────┼──────────────────────────┼───────────────────────┼────────────┘
              │                          │                       │
              ▼                          ▼                       ▼
    [ PostgreSQL CDC / Realtime WebSocket (wss://<ref>.supabase.co/realtime/v1) ]
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VPS NODE.JS WEBHOOK SERVER (Daemon)                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     supabase.channel('vps_bot_cdc')                   │  │
│  │                                                                       │  │
│  │  .on('postgres_changes', { table: 'tickets_mensagens' }, onMsgInsert) │  │
│  │  .on('postgres_changes', { table: 'tickets' }, onTicketUpdate)        │  │
│  │  .on('postgres_changes', { table: 'loja_pedidos' }, onOrderStatus)   │  │
│  │  .on('postgres_changes', { table: 'produtos' }, onCatalogChange)     │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 antiBanEngine.enqueueMessage(to, msg)                 │  │
│  │   - JID/LID Context Resolution                                        │  │
│  │   - Human Typing & Presence Emulation                                 │  │
│  │   - Exponential Backoff & Delivery to Evolution API                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 High-Value Server-Side CDC Opportunities:

1. **Operator Web Chat -> WhatsApp Customer Relay (P0)**:
   - *Current State*: If a human agent answers a ticket in the Web Admin dashboard, the customer on WhatsApp receives nothing unless the operator switches to WhatsApp and types `#responder <phone> <text>`.
   - *CDC Architecture*: Listen to `INSERT` on `tickets_mensagens` (or `suporte_mensagens`) where `origem = 'painel'` or `sender_type = 'operador'`. The CDC listener resolves the customer's phone from `tickets.cliente_id` and calls `antiBanEngine.enqueueMessage()`.
   - *Benefit*: Zero-latency omnichannel support; web operators seamlessly converse with WhatsApp users.

2. **Ticket Status & Assignment Notifications (P1)**:
   - *Current State*: No automated notifications when a ticket is assigned to an attendant or moved to `resolvido`.
   - *CDC Architecture*: Listen to `UPDATE` on `tickets`. When `atendente_id` changes from null to a staff member, or `status` changes to `resolvido`/`fechado`, dispatch a polite notification.

3. **E-Commerce & Service Order Realtime Push (P1)**:
   - *Current State*: `/webhook/supabase-update` fails because phone numbers are missing from `loja_pedidos` payload.
   - *CDC Architecture*: Listen to `UPDATE` on `loja_pedidos`, `orcamentos`, `os_servicos`. Upon status change (`pago`, `em_expedicao`, `enviado`, `entregue`), fetch `telefone` via cached client profile or fast lookup, and dispatch immediate WhatsApp tracking updates.

4. **Instant Catalog Cache Invalidation (P2)**:
   - *Current State*: `_catalogCache` is stale for up to 5 minutes.
   - *CDC Architecture*: Listen to `*` on `produtos`, `servicos`, `parceiros`. When an item is created/updated/deleted, immediately set `_catalogCacheTs = 0` (or update memory cache in-place), ensuring 100% price and stock accuracy for the AI assistant.

5. **Partner Benefit Manual Approval Alerts (P1)**:
   - *Current State*: When redemptions require admin review (`delay_24h = true` or `alerta_duplicidade = true`), the client must wait without automated updates when approved.
   - *CDC Architecture*: Listen to `UPDATE` on `parceiros_resgates` where `status` changes from `'analise'` to `'aprovado'`. The bot immediately generates and pushes the promotional coupon code to the user's WhatsApp.

---

## 4. Concurrency & Race Condition Audit

### 4.1 Multi-Message Burst Race Condition (Missing Inbound Session Mutex)
- **Location**: `server_webhook_vps_live.cjs:9153-9160` & `4415-4463`
- **Issue**:
  When a user sends two messages in quick succession (e.g. within 500ms):
  ```javascript
  // server_webhook_vps_live.cjs:9153-9160
  try {
    const rawMessageData = data.data || {};
    processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData);
  } catch (errProcess) { ... }
  ```
  `processMessage` is an `async` function that is **not awaited and has no per-phone mutex/lock**.
- **Consequences**:
  1. Message 1 and Message 2 simultaneously access `userSessions[fromPhone]`.
  2. Both messages initiate asynchronous I/O (Gemini NLU API, Supabase PostgREST queries).
  3. Message 2 may read uncommitted or intermediate state left by Message 1, resulting in:
     - Duplicate ticket creation (`createAITicket` called twice).
     - State machine jumps (e.g. `session.state` overwritten to `MAIN_MENU` while Message 1 was processing a sub-menu).
     - Multiple conflicting WhatsApp responses generated by AI.

### 4.2 Points-to-Wallet Conversion Read-Modify-Write (RMW) Race Condition
- **Location**: `server_webhook_vps_live.cjs:4990-5008`
- **Code Inspection**:
  ```javascript
  // 4991: Read stale in-memory points
  const pts = session.client.saldo_pontos || 0;
  ...
  const convertedValue = pts / 100;
  // 4999: Compute new wallet balance in Node memory
  const newSaldoCarteira = (session.client.saldo_carteira || 0) + convertedValue;
  // 5000: Write absolute values back to database via PATCH
  supabasePatch(`/rest/v1/clientes?id=eq.${session.client.id}`, { saldo_pontos: 0, saldo_carteira: newSaldoCarteira }, (err, res) => { ... });
  ```
- **Vulnerability**:
  - If a user sends "1" twice rapidly, or converts points on WhatsApp while completing a checkout or receiving a cash refund on the web portal, the PATCH overwrites the database with stale balance data (`newSaldoCarteira`).
  - **Remediation**: Must use an atomic PostgreSQL RPC function (e.g. `gsa_converter_pontos_carteira(p_cliente_id UUID)`) with row-level locking (`SELECT ... FOR UPDATE`).

### 4.3 `Math.random()` Collision Vulnerability in Protocol & ID Generation
- **Inspection of Random Number Generators Across Codebase**:
  - `createAITicket` (`server_webhook_vps_live.cjs:150`):
    `protocolo = 'TKT-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);`  
    *(Only 9,000 possible protocols per calendar year!)*
  - `checkPhoneVoucherStatus` (`server_webhook_vps_live.cjs:222`):
    `rawCode = 'GSA-PRO-' + Math.floor(100000 + Math.random() * 900000);`
  - Quotes/Orcamentos (`server_webhook_vps_live.cjs:3558`, `5225`, `6745`):
    `orcCod = 'ORC-' + year + '-' + Math.floor(1000 + Math.random() * 9000);`
  - Invoices/Faturas (`server_webhook_vps_live.cjs:3591`, `5290`):
    `codigo_fatura = 'FAT-' + year + '-' + Math.floor(1000 + Math.random() * 9000);`
  - Clients (`server_webhook_vps_live.cjs:5196`):
    `codigo_cliente = 'CLI-' + Math.floor(100000 + Math.random() * 900000);`
- **Risk**:
  Birthday paradox dictates that with 9,000 slots, a 50% probability of collision occurs after only ~118 tickets/quotes in a year. If a unique index exists on `protocolo`, the insert fails abruptly. If no unique index exists, duplicate protocols corrupt ticket traceability.

### 4.4 Anti-Ban Cooldown & Queue Resilience (`lib/antiBanEngine.cjs`)
- **Queue Implementation**:
  - `lib/antiBanEngine.cjs` implements an isolated per-contact FIFO queue (`ContactQueue`) managed by `QueueManager` with an in-memory `Map()`.
  - Enforces randomized delays (3.5s to 7.5s), human typing presence simulation (6s to 12s with heartbeats), and exponential backoff retry on 429/5xx errors (`dispatchWithRetry`).
- **Cluster/Multi-Process Limitation**:
  - `QueueManager` is an in-memory singleton. If the webhook server is scaled across multiple Node.js worker processes (e.g. PM2 cluster mode or multiple container instances), each process maintains its own queue. Simultaneous messages from different workers to the same phone number will interleave, violating anti-ban typing durations and triggering WhatsApp spam detection.

---

## 5. Error Handling, Connection Resilience & VPS Recovery

### 5.1 Hardcoded PostgREST Port & Lack of Cloud Failover
- **Issue**: `server_webhook_vps_live.cjs` strictly connects to `hostname: '127.0.0.1', port: 3001`.
- **Failure Mode**: If the local PostgREST Docker container (`gsa-postgrest`) crashes, restarts, or runs out of database connections, every webhook operation immediately fails with `ECONNREFUSED`.
- **Remediation**: Implement automated fallback to the Supabase Cloud REST endpoint (`https://<project>.supabase.co/rest/v1`) when the local PostgREST instance is unresponsive.

### 5.2 Unbounded Memory Growth in `userSessions`
- **Location**: `server_webhook_vps_live.cjs:41` (`const userSessions = {};`)
- **Issue**: Customer session objects are stored indefinitely in the global `userSessions` object. Keys are never removed except on specific menu exit transitions (`delete userSessions[fromPhone]`).
- **Failure Mode**: Over weeks of operation with thousands of inbound inquiries, memory consumption continuously escalates, eventually triggering Node.js V8 OOM (Out-of-Memory) crashes.
- **Remediation**: Wrap `userSessions` in a LRU cache or time-based TTL eviction (e.g. 24-hour inactivity sweep).

### 5.3 Global Process Exception Handling
- **Location**: `server_webhook_vps_live.cjs:9180-9195`
- **Audit**:
  - `server.on('error')` catches `EADDRINUSE`.
  - `process.on('uncaughtException')` logs errors without crashing.
  - `process.on('unhandledRejection')` captures rejected Promises.
- **Verdict**: Process-level resilience is adequate to prevent server crashes, but silent Promise catches in database helpers can obscure transient PostgREST failures.

---

## 6. Security, Authentication & RLS Implications

### 6.1 Critical Environment Variable Discrepancy Bug
- **Location**: `server_webhook_vps_live.cjs:14` vs `2902`
- **Code Inspection**:
  ```javascript
  // Line 14: Has fallback JWT string
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOi...';

  // Line 2902: Does NOT have fallback string!
  const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  ```
- **Impact**:
  In `supabaseGet` (line 2912), `supabasePost` (line 2957), and `supabasePatch` (line 2990), the request header uses `SERVICE_ROLE_JWT`. If `process.env.SUPABASE_SERVICE_ROLE_KEY` is not defined in the environment, `SERVICE_ROLE_JWT` is empty (`""`). PostgREST rejects the requests with `401 Unauthorized`.
- **Fix**: Align `SERVICE_ROLE_JWT = SUPABASE_SERVICE_ROLE_KEY;`.

### 6.2 Hardcoded Secrets in Source Code
- **Findings**:
  - `server_webhook_vps_live.cjs:14`: Hardcoded `SUPABASE_SERVICE_ROLE_KEY` JWT.
  - `server_webhook_vps_live.cjs:18`: Hardcoded `GEMINI_API_KEY` (`AIzaSyAD95...`).
  - `server_webhook_vps_live.cjs:80`: Hardcoded `SUPABASE_ANON_FALLBACK` JWT.
  - `lib/antiBanEngine.cjs:27`: Hardcoded default `EVOLUTION_API_KEY` (`gsa_hub_evolution_token_2026`).
- **Remediation**: Enforce strict environment variable injection via `.env` files and vault management; remove all hardcoded fallback secrets.

### 6.3 Complete RLS Bypass via Service Role
- Because the webhook server executes all database queries using `SERVICE_ROLE_KEY`, PostgreSQL Row-Level Security (RLS) is **completely bypassed**.
- **Audit Assessment**:
  - The application code is 100% responsible for data isolation and access validation.
  - While input sanitization (`sanitizeInput`, `validateAndSanitizeField`) is implemented for partner redemptions, direct database queries in self-service flows rely heavily on raw `fromPhone` matching. Phone number normalization (`stripCountryCode55`) must remain strictly enforced to prevent cross-account data leakage.

---

## 7. Actionable Architectural Blueprints & Recommendations

### Blueprint 1: Server-Side Realtime CDC Manager (`lib/serverRealtimeManager.cjs`)

Create a dedicated server-side Realtime listener module leveraging `@supabase/supabase-js` to listen for Postgres CDC events and bridge web operator replies to WhatsApp:

```javascript
'use strict';
const { createClient } = require('@supabase/supabase-js');
const antiBanEngine = require('./antiBanEngine.cjs');

class ServerRealtimeManager {
  constructor(supabaseUrl, serviceRoleKey, options = {}) {
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      realtime: {
        params: { eventsPerSecond: 20 }
      },
      auth: { persistSession: false }
    });
    this.channel = null;
    this.onCatalogInvalidate = options.onCatalogInvalidate || (() => {});
  }

  start() {
    console.log('📡 [Server Realtime] Inicializando listener PostgreSQL CDC...');
    
    this.channel = this.supabase.channel('vps-whatsapp-cdc')
      // 1. Relais de mensagens de operadores (Chat / Tickets)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tickets_mensagens',
        filter: 'tipo=eq.operador'
      }, async (payload) => {
        await this.handleOperatorMessage(payload.new);
      })
      // 2. Mudanças de status de pedidos da loja
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'loja_pedidos'
      }, async (payload) => {
        await this.handleOrderStatusUpdate(payload.old, payload.new);
      })
      // 3. Invalidação imediata de catálogo de serviços e produtos
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'produtos'
      }, () => this.onCatalogInvalidate('produtos'))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'servicos'
      }, () => this.onCatalogInvalidate('servicos'))
      .subscribe((status) => {
        console.log(`📡 [Server Realtime] Status da Subscription: ${status}`);
      });
  }

  async handleOperatorMessage(msg) {
    if (!msg || !msg.ticket_id || !msg.mensagem) return;
    
    // Buscar telefone do cliente associado ao ticket
    const { data: ticket, error } = await this.supabase
      .from('tickets')
      .select('id, cliente_id, clientes(telefone)')
      .eq('id', msg.ticket_id)
      .single();

    if (error || !ticket?.clientes?.telefone) {
      console.warn('⚠️ [Realtime CDC] Não foi possível resolver o telefone do ticket:', msg.ticket_id);
      return;
    }

    const clientPhone = ticket.clientes.telefone.replace(/\D/g, '');
    const formattedText = `👨‍💼 *ATENDENTE GSA:*\n\n${msg.mensagem}\n\n_Chamado #${ticket.id}_`;
    
    console.log(`📤 [Realtime CDC] Reenviando resposta do operador para ${clientPhone}`);
    await antiBanEngine.sendWhatsAppReply(clientPhone, formattedText);
  }

  async handleOrderStatusUpdate(oldRecord, newRecord) {
    if (!oldRecord || !newRecord || oldRecord.status === newRecord.status) return;
    
    const { data: order } = await this.supabase
      .from('loja_pedidos')
      .select('id, total, clientes(telefone, nome)')
      .eq('id', newRecord.id)
      .single();

    if (!order?.clientes?.telefone) return;
    
    const phone = order.clientes.telefone.replace(/\D/g, '');
    const clientName = (order.clientes.nome || 'Cliente').split(' ')[0];
    const statusMap = {
      'pago': '✅ *Pagamento Aprovado!* Seu pedido já está sendo preparado.',
      'em_expedicao': '📦 *Em Preparação!* Seu pacote está sendo embalado.',
      'em_transporte': '🚚 *Saiu para Entrega!* Seu pedido está a caminho.',
      'entregue': '🎉 *Pedido Entregue!* Esperamos que aproveite sua compra.',
      'cancelado': '❌ *Pedido Cancelado.* Se precisar de ajuda, chame nosso suporte!'
    };

    const statusMsg = statusMap[newRecord.status.toLowerCase()];
    if (statusMsg) {
      await antiBanEngine.sendWhatsAppReply(phone, `Olá, *${clientName}*!\n\n${statusMsg}\n\n*Pedido:* #${newRecord.id}`);
    }
  }

  stop() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
    }
  }
}

module.exports = ServerRealtimeManager;
```

---

### Blueprint 2: Inbound Message Mutex & Queue (`lib/sessionMutex.cjs`)

Prevent multi-message burst race conditions with an asynchronous per-phone queue:

```javascript
'use strict';

class SessionMutex {
  constructor() {
    this.locks = new Map(); // phone -> Promise chain
  }

  async runExclusive(phone, taskFn) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const currentLock = this.locks.get(cleanPhone) || Promise.resolve();

    let release;
    const nextLock = new Promise(resolve => { release = resolve; });
    this.locks.set(cleanPhone, currentLock.then(() => nextLock));

    await currentLock;
    try {
      return await taskFn();
    } finally {
      release();
      if (this.locks.get(cleanPhone) === nextLock) {
        this.locks.delete(cleanPhone);
      }
    }
  }
}

module.exports = new SessionMutex();
```

---

### Blueprint 3: Atomic Points Conversion Stored Procedure (PostgreSQL RPC)

Replace non-atomic `supabasePatch` with a safe transactional RPC:

```sql
CREATE OR REPLACE FUNCTION gsa_converter_pontos_carteira(
  p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pontos INT;
  v_valor_convertido NUMERIC(10,2);
  v_novo_saldo NUMERIC(10,2);
BEGIN
  -- Bloqueia a linha do cliente para escrita exclusiva
  SELECT saldo_pontos, saldo_carteira
  INTO v_pontos, v_novo_saldo
  FROM clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  IF COALESCE(v_pontos, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo de pontos insuficiente');
  END IF;

  v_valor_convertido := ROUND(v_pontos / 100.0, 2);
  v_novo_saldo := COALESCE(v_novo_saldo, 0) + v_valor_convertido;

  UPDATE clientes
  SET 
    saldo_pontos = 0,
    saldo_carteira = v_novo_saldo,
    updated_at = NOW()
  WHERE id = p_cliente_id;

  -- Registra a transação no extrato
  INSERT INTO transacoes_carteira (
    cliente_id,
    tipo,
    valor,
    descricao,
    saldo_anterior,
    saldo_posterior
  ) VALUES (
    p_cliente_id,
    'credito_pontos',
    v_valor_convertido,
    format('Conversão de %s pontos fidelidade', v_pontos),
    v_novo_saldo - v_valor_convertido,
    v_novo_saldo
  );

  RETURN jsonb_build_object(
    'success', true,
    'pontos_convertidos', v_pontos,
    'valor_creditado', v_valor_convertido,
    'novo_saldo_carteira', v_novo_saldo
  );
END;
$$;
```

---

## 8. Prioritized Remediation Roadmap

| Priority | Issue | Affected Files | Proposed Solution | Effort |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | `SERVICE_ROLE_JWT` empty variable fallback bug | `server_webhook_vps_live.cjs:2902`, `server_webhook.cjs` | Set `const SERVICE_ROLE_JWT = SUPABASE_SERVICE_ROLE_KEY;` to guarantee fallback | 5 min |
| **P0** | Multi-message burst concurrency / state race | `server_webhook_vps_live.cjs:9153`, `server_webhook.cjs` | Wrap inbound `processMessage` in `SessionMutex.runExclusive(fromPhone)` | 30 min |
| **P0** | Read-Modify-Write points conversion race condition | `server_webhook_vps_live.cjs:4990-5008` | Implement atomic PostgreSQL RPC `gsa_converter_pontos_carteira` | 45 min |
| **P1** | Lack of Server-Side Realtime CDC for operator chat | `server_webhook_vps_live.cjs` | Deploy `ServerRealtimeManager` with CDC on `tickets_mensagens` & `loja_pedidos` | 2 hours |
| **P1** | `Math.random()` collision in ticket & invoice protocols | `server_webhook_vps_live.cjs:150, 3558, 3591` | Replace with timestamp + crypto hex or Postgres `nextval()` sequence | 30 min |
| **P1** | `/webhook/supabase-update` missing phone lookup | `server_webhook_vps_live.cjs:8822-8928` | Add async join/query to resolve `cliente.telefone` from `cliente_id` | 45 min |
| **P2** | Unbounded memory growth in `userSessions` | `server_webhook_vps_live.cjs:41` | Add 24h TTL cleanup interval or LRU eviction map | 30 min |
| **P2** | 5-minute stale AI catalog cache | `server_webhook_vps_live.cjs:82-143` | Hook CDC invalidator on `produtos` and `servicos` to refresh `_catalogCache` | 30 min |
| **P2** | Hardcoded secrets and JWTs in source code | `server_webhook_vps_live.cjs:14, 18, 80` | Move all keys strictly to environment variables / `.env` file | 20 min |

---

## 9. Conclusion

The VPS Webhook & WhatsApp Bot subsystem possesses high-quality humanized outbound anti-ban rate limiting, but is currently constrained by **100% one-shot REST query patterns**, an absence of **server-side PostgreSQL CDC subscriptions**, and **inbound concurrency race conditions**. 

Implementing the proposed `ServerRealtimeManager` and `SessionMutex` will eliminate delays, prevent state corruption, enable real-time operator chat relay, and guarantee enterprise-grade data consistency.
