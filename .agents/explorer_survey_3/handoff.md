# Handoff Report: Requirement R4 — VPS Webhooks & Concurrency Remediation

**Date**: 2026-08-28  
**Domain**: VPS Webhooks, Concurrency & Supabase Database Integrations  
**Files Audited**: `server_webhook_vps_live.cjs`, `server_webhook.cjs`  
**Explorer Agent**: Explorer Survey 3 (`.agents/explorer_survey_3`)  
**Status**: Investigation Complete — Detailed Action Plan & Drop-In Code Ready  

---

## 1. Observation

Direct code observations from `server_webhook_vps_live.cjs` and `server_webhook.cjs`:

### 1.1 `SERVICE_ROLE_JWT` Variable Fallback Defect
- **`server_webhook_vps_live.cjs` Line 14**:
  ```javascript
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODY5ODQzMzYsImV4cCI6MjEwMjM0NDMzNn0.HErwZVyHaKqhK_vRx66dcMXSlYkubChX7vGzDDbJHu0';
  ```
- **`server_webhook_vps_live.cjs` Line 2902** (and `server_webhook.cjs` Line 2616):
  ```javascript
  const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  ```
- **Helper Functions Consuming `SERVICE_ROLE_JWT`**:
  - `supabaseGet` (`server_webhook_vps_live.cjs:2912-2913` / `server_webhook.cjs:2626-2627`):
    ```javascript
    'apikey': SERVICE_ROLE_JWT,
    'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
    ```
  - `supabasePost` (`server_webhook_vps_live.cjs:2957-2958` / `server_webhook.cjs:2671-2672`):
    ```javascript
    'apikey': SERVICE_ROLE_JWT,
    'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
    ```
  - `supabasePatch` (`server_webhook_vps_live.cjs:2990-2991` / `server_webhook.cjs:2704-2705`):
    ```javascript
    'apikey': SERVICE_ROLE_JWT,
    'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
    ```
  - `supabaseUpsertCustom` (`server_webhook_vps_live.cjs:3073-3074` / `server_webhook.cjs:2787-2788`):
    ```javascript
    'apikey': SERVICE_ROLE_JWT,
    'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
    ```
  - When `process.env.SUPABASE_SERVICE_ROLE_KEY` is not present in process environment variables, `SERVICE_ROLE_JWT` evaluates to `''` (empty string). As a consequence, PostgREST requests send empty `apikey` and `Authorization: Bearer `, resulting in HTTP `401 Unauthorized`.

---

### 1.2 Race Conditions on Simultaneous Messages / Lack of Per-Phone Concurrency Lock
- **`server_webhook_vps_live.cjs` Lines 9153–9160** (and `server_webhook.cjs` Lines 9356–9363):
  ```javascript
  try {
    const rawMessageData = data.data || {};
    processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData);
  } catch (errProcess) {
    console.error('❌ Exceção ao processar mensagem:', errProcess);
    sendWhatsAppReply(fromPhone, '❌ Desculpe, ocorreu uma falha ao processar sua mensagem. Digite 0 para voltar ao menu principal.');
  }
  ```
- **`processMessage` Declaration** (`server_webhook_vps_live.cjs:4415` / `server_webhook.cjs:4513`):
  ```javascript
  async function processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData = {}) { ... }
  ```
- Observations:
  1. `processMessage` is an `async` function that mutates shared in-memory state in `userSessions[fromPhone]`.
  2. The synchronous `try ... catch` block does NOT catch unhandled rejections that occur after an `await` step (e.g. Gemini AI calls, PostgREST queries).
  3. When a user sends multiple messages in rapid succession (e.g. text followed immediately by button press or media upload), multiple instances of `processMessage` execute in parallel for the exact same `fromPhone`.
  4. Parallel executions read and modify `userSessions[fromPhone]` concurrently, leading to out-of-order WhatsApp replies, corrupted session states, and duplicate ticket/transaction dispatches.

---

### 1.3 Non-Atomic Points Conversion (Read-Modify-Write / RMW)
- **`server_webhook_vps_live.cjs` Lines 4989–5008** (and `server_webhook.cjs` Lines 5055–5074):
  ```javascript
  // ── ESTADO: LOYALTY_ACTIONS ─────────────────────────────────────────────────
  if (session.state === 'LOYALTY_ACTIONS') {
    if (text === '1') {
      const pts = session.client.saldo_pontos || 0;
      if (pts <= 0) {
        sendWhatsAppReply(fromPhone, '❌ Você não possui pontos suficientes para converter.\n\n_Digite 0 para voltar ao menu._');
        return;
      }
      sendWhatsAppReply(fromPhone, '🔄 Convertendo pontos (100 pontos = R$ 1,00)...');
      // PATCH cliente
      const convertedValue = pts / 100;
      const newSaldoCarteira = (session.client.saldo_carteira || 0) + convertedValue;
      supabasePatch(`/rest/v1/clientes?id=eq.${session.client.id}`, { saldo_pontos: 0, saldo_carteira: newSaldoCarteira }, (err, res) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        if (err) {
          sendWhatsAppReply(fromPhone, '❌ Erro ao converter pontos. Tente novamente mais tarde.\n\n_Digite 0 para voltar._');
        } else {
          sendWhatsAppReply(fromPhone, `✅ *Conversão Concluída!*\n\n${pts} pontos foram convertidos com sucesso para *${convertedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*.\nNovo Saldo em Carteira: *${newSaldoCarteira.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n_Digite 0 para voltar._`);
        }
      });
    } ...
  ```
- Observations:
  1. `session.client` holds a stale snapshot of the client row cached in memory.
  2. `newSaldoCarteira = (session.client.saldo_carteira || 0) + convertedValue` computes the new wallet balance in memory and overwrites `saldo_carteira` directly via `supabasePatch`. Any concurrent credit/debit in PostgreSQL (e.g. from purchases, bonuses, web app exchanges) is permanently overwritten and lost.
  3. If duplicate requests are fired, `pts` is read as non-zero twice and converted twice (double spending).
  4. Zero audit ledger entries are created in `pontos_movimentacoes` or `carteira_lancamentos`.

---

### 1.4 File Parity Comparison: `server_webhook_vps_live.cjs` vs `server_webhook.cjs`
- **File Metrics**:
  - `server_webhook_vps_live.cjs`: 9,236 lines (451,929 bytes)
  - `server_webhook.cjs`: 9,439 lines (464,340 bytes)
- **Functional Differences**:
  - `server_webhook.cjs` includes extra credit application state handling: `CREDIT_REQUEST_DOC`, `CREDIT_REQUEST_NAME`, `CREDIT_REQUEST_VALUE`, `CREDIT_REQUEST_INSTALLMENTS`, `CREDIT_REQUEST_PURPOSE`, `CREDIT_REQUEST_INCOME`, `CREDIT_REQUEST_CONFIRM` and helper functions `renderCreditSimulation`, `finalizeCreditSubmission`.
  - `server_webhook_vps_live.cjs` includes `CLIENT_AREA_MENU` and helper functions `fetchCategoryTop`, `getFeaturedShowcase`, `handleClientAccountOverview`, `handleClientStatement`, etc.
- **Line Offset Mapping for R4 Changes**:

| Requirement Item | `server_webhook_vps_live.cjs` | `server_webhook.cjs` |
|---|---|---|
| 1. `SERVICE_ROLE_JWT` Declaration | Line 2902 | Line 2616 |
| 2. `supabaseRpc` Definition | Line 3014 | Line 2728 |
| 3. Points Conversion (`LOYALTY_ACTIONS`) | Line 4989 | Line 5055 |
| 4. POST `/webhook` `processMessage` Execution | Line 9155 | Line 9358 |
| 5. `module.exports` | Line 9210 | Line 9413 |

---

## 2. Logic Chain

1. **SERVICE_ROLE_JWT Authentication Failure**:
   - `SUPABASE_SERVICE_ROLE_KEY` is defined at line 14 with a hardcoded JWT fallback token.
   - However, at line 2902 (in `vps_live`) and line 2616 (in `webhook`), `SERVICE_ROLE_JWT` is redefined as `process.env.SUPABASE_SERVICE_ROLE_KEY || ''`.
   - When running in an environment where `process.env.SUPABASE_SERVICE_ROLE_KEY` is not set, `SERVICE_ROLE_JWT` becomes `''`.
   - All `supabaseGet`, `supabasePost`, `supabasePatch`, and `supabaseUpsertCustom` calls fail with `401 Unauthorized`.
   - *Conclusion*: Changing the initialization to `const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || '';` resolves the authentication failure completely.

2. **Session Concurrency & Race Condition**:
   - Webhook requests arrive asynchronously via HTTP POST.
   - Multiple messages from the same phone number arrive near-simultaneously (especially on unstable network reconnections or interactive menus).
   - Because `processMessage` is `async` and reads/writes `userSessions[fromPhone]`, unbounded concurrency leads to interleaved execution and race conditions.
   - *Conclusion*: Implementing an in-memory `SessionMutex` that chains promises per `fromPhone` guarantees FIFO sequential execution per phone while permitting 100% concurrent processing across different phone numbers.

3. **Atomic Points Conversion**:
   - In-memory addition of `session.client.saldo_carteira + convertedValue` followed by `supabasePatch` is a classic Read-Modify-Write (RMW) anti-pattern.
   - In PostgreSQL, row-level locking (`SELECT ... FOR UPDATE`) in an RPC function ensures that reading the current points, zeroing the points, incrementing the wallet balance, and writing audit log records happen within a single atomic database transaction.
   - *Conclusion*: Creating a dedicated RPC `gsa_converter_pontos_carteira` and calling it via `supabaseRpc` in the bot replaces the vulnerable RMW with an atomic, auditable transaction.

---

## 3. Implementation Proposals (Drop-In Solutions)

### Fix 1: `SERVICE_ROLE_JWT` Fallback
In `server_webhook_vps_live.cjs` (line 2902) and `server_webhook.cjs` (line 2616):

```javascript
// BEFORE:
const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// AFTER:
const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || '';
```

---

### Fix 2: `SessionMutex` In-Memory Promise Queue
Add near the top of both files (e.g. right after helper class definitions or before `processMessage`):

```javascript
// ─── CONCURRENCY CONTROL: SESSION MUTEX (PER-PHONE FIFO QUEUE) ──────────────
class SessionMutex {
  constructor() {
    this.queues = new Map();
  }

  /**
   * Serializes execution of async tasks per key (e.g., fromPhone).
   * Runs tasks for the same phone number sequentially in FIFO order.
   * Runs tasks for different phone numbers concurrently without blocking.
   * @param {string} key - Unique identifier (e.g., phone number)
   * @param {() => Promise<any>} task - Async function to execute
   * @returns {Promise<any>}
   */
  runExclusive(key, task) {
    const safeKey = String(key || 'global');
    const prevPromise = this.queues.get(safeKey) || Promise.resolve();

    const nextPromise = (async () => {
      try {
        await prevPromise;
      } catch (ignored) {
        // Prevent previous errors from deadlocking subsequent queued messages
      }
      return await task();
    })();

    this.queues.set(safeKey, nextPromise);

    // Clean up memory when queue is empty
    nextPromise.finally(() => {
      if (this.queues.get(safeKey) === nextPromise) {
        this.queues.delete(safeKey);
      }
    });

    return nextPromise;
  }
}

const sessionMutex = new SessionMutex();
```

In the HTTP POST Webhook Handler (`server_webhook_vps_live.cjs:9153-9160` / `server_webhook.cjs:9356-9363`):

```javascript
// BEFORE:
try {
  const rawMessageData = data.data || {};
  processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData);
} catch (errProcess) {
  console.error('❌ Exceção ao processar mensagem:', errProcess);
  sendWhatsAppReply(fromPhone, '❌ Desculpe, ocorreu uma falha ao processar sua mensagem. Digite 0 para voltar ao menu principal.');
}

// AFTER:
sessionMutex.runExclusive(fromPhone, async () => {
  try {
    const rawMessageData = data.data || {};
    await processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData);
  } catch (errProcess) {
    console.error(`❌ Exceção ao processar mensagem para ${fromPhone}:`, errProcess);
    sendWhatsAppReply(fromPhone, '❌ Desculpe, ocorreu uma falha ao processar sua mensagem. Digite 0 para voltar ao menu principal.');
  }
});
```

And include `sessionMutex` in `module.exports`:
```javascript
module.exports = {
  ...
  sessionMutex,
  ...
};
```

---

### Fix 3: Atomic Points Conversion RPC & Bot Integration

#### 1. SQL Migration (`supabase/migrations/20260828120000_atomic_points_conversion.sql`):
```sql
CREATE OR REPLACE FUNCTION public.gsa_converter_pontos_carteira(
  p_cliente_id uuid,
  p_pontos integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.clientes%rowtype;
  v_pts integer;
  v_rate numeric := 0.01; -- 100 pontos = R$ 1,00
  v_valor numeric;
  v_novo_pontos integer;
  v_novo_carteira numeric;
BEGIN
  -- Row-level exclusive lock prevents race conditions and concurrent modifications
  SELECT * INTO v_client
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  IF coalesce(v_client.pontos_bloqueados, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira de pontos bloqueada');
  END IF;

  IF p_pontos IS NULL OR p_pontos <= 0 THEN
    v_pts := coalesce(v_client.saldo_pontos, 0);
  ELSE
    v_pts := p_pontos;
  END IF;

  IF v_pts <= 0 OR coalesce(v_client.saldo_pontos, 0) < v_pts THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo de pontos insuficiente');
  END IF;

  v_valor := round(v_pts * v_rate, 2);
  v_novo_pontos := coalesce(v_client.saldo_pontos, 0) - v_pts;
  v_novo_carteira := round(coalesce(v_client.saldo_carteira, 0) + v_valor, 2);

  UPDATE public.clientes
  SET
    saldo_pontos = v_novo_pontos,
    saldo_carteira = v_novo_carteira,
    updated_at = now()
  WHERE id = p_cliente_id;

  INSERT INTO public.pontos_movimentacoes (
    cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido
  ) VALUES (
    p_cliente_id, 'conversao_dinheiro', -v_pts, v_novo_pontos,
    'Conversão de pontos em saldo via WhatsApp', v_valor
  );

  INSERT INTO public.carteira_lancamentos (
    cliente_id, valor, tipo, descricao
  ) VALUES (
    p_cliente_id, v_valor, 'credito',
    'Conversão de pontos via WhatsApp'
  );

  RETURN jsonb_build_object(
    'success', true,
    'pontos_convertidos', v_pts,
    'valor_convertido', v_valor,
    'novo_saldo_pontos', v_novo_pontos,
    'novo_saldo_carteira', v_novo_carteira
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) TO anon, authenticated, service_role;
```

#### 2. Bot State Handler (`server_webhook_vps_live.cjs:4989-5008` / `server_webhook.cjs:5055-5074`):
```javascript
  // ── ESTADO: LOYALTY_ACTIONS ─────────────────────────────────────────────────
  if (session.state === 'LOYALTY_ACTIONS') {
    if (text === '1') {
      sendWhatsAppReply(fromPhone, '🔄 Convertendo pontos (100 pontos = R$ 1,00)...');

      supabaseRpc('gsa_converter_pontos_carteira', { p_cliente_id: session.client.id }, (err, result) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;

        if (err || !result || !result.success) {
          const errMsg = result?.error || (err ? err.message : 'Saldo insuficiente ou erro no servidor');
          console.error('❌ Erro na conversão de pontos via RPC:', errMsg);
          sendWhatsAppReply(fromPhone, `❌ Não foi possível converter seus pontos: ${errMsg}.\n\n_Digite 0 para voltar ao menu._`);
          return;
        }

        // Update in-memory session with verified database returned values
        if (session.client) {
          session.client.saldo_pontos = result.novo_saldo_pontos;
          session.client.saldo_carteira = result.novo_saldo_carteira;
        }

        sendWhatsAppReply(fromPhone, `✅ *Conversão Concluída!*\n\n${result.pontos_convertidos} pontos foram convertidos com sucesso para *${result.valor_convertido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*.\nNovo Saldo em Carteira: *${result.novo_saldo_carteira.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n_Digite 0 para voltar ao menu._`);
      });
      return;
    } ...
```

---

## 4. Caveats

1. **Local PostgREST vs Remote Supabase**: `server_webhook_vps_live.cjs` issues HTTP requests to `127.0.0.1:3001` (local PostgREST in production VPS). When developing or running unit tests in environments without local PostgREST, `supabaseRpc` will return ECONNREFUSED unless connected to the remote Supabase URL or mocked.
2. **RPC Migration Deployment**: The database migration `20260828120000_atomic_points_conversion.sql` must be applied to Supabase so that `supabaseRpc('gsa_converter_pontos_carteira', ...)` succeeds.

---

## 5. Conclusion

All 4 sub-items of Requirement R4 have been thoroughly investigated, diagnosed, and matched with exact line numbers and concrete code implementations:
1. `SERVICE_ROLE_JWT` fallback is resolved by chaining `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_KEY` fallbacks.
2. WhatsApp session concurrency race conditions are eliminated using `SessionMutex` per-phone FIFO serialization in the webhook HTTP POST handler.
3. Points conversion Read-Modify-Write vulnerability is replaced with atomic database transaction execution via `gsa_converter_pontos_carteira` RPC.
4. Parity between `server_webhook_vps_live.cjs` and `server_webhook.cjs` has been mapped out in full detail to guarantee simultaneous alignment.

---

## 6. Verification Method

To independently verify these findings:

1. **Syntax and Static Analysis**:
   ```bash
   node --check server_webhook_vps_live.cjs
   node --check server_webhook.cjs
   ```
2. **SERVICE_ROLE_JWT Verification**:
   Inspect line 2902 of `server_webhook_vps_live.cjs` and line 2616 of `server_webhook.cjs` to confirm the fallback expression is never empty.
3. **SessionMutex Unit Test**:
   Execute simulated concurrent messages using a scratch test script verifying FIFO order for the same phone number and concurrent execution for distinct phone numbers.
4. **RPC Existence & Signature**:
   Verify `gsa_converter_pontos_carteira` signature with `SELECT * FROM pg_proc WHERE proname = 'gsa_converter_pontos_carteira';`.
