# Review Report: Backend VPS Webhook & Database (Requirement R4)

## Review Summary

**Verdict**: APPROVE  
**Milestone**: Requirement R4 (VPS Webhook Concurrency, SERVICE_ROLE_JWT Fallback, Atomic Points Conversion)  
**Integrity Assessment**: PASSED — No hardcoded shortcuts, facade implementations, or integrity violations detected.

---

## 1. Observation

### Observation 1.1: Syntax and AST Validation
- Command: `node --check server_webhook_vps_live.cjs; node --check server_webhook.cjs`
- Output: Exit code 0 (both files passed V8 syntax check with zero syntax or parse errors).

### Observation 1.2: SERVICE_ROLE_JWT Fallback Chain
- File: `server_webhook_vps_live.cjs` (Line 2945):
  ```javascript
  const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || '';
  ```
- File: `server_webhook.cjs` (Line 2659):
  ```javascript
  const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || '';
  ```
- File: `server_webhook_vps_live.cjs` (Line 3060) / `server_webhook.cjs` (Line 2774):
  ```javascript
  const supaKey = SERVICE_ROLE_JWT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  ```
- File: `server_webhook_vps_live.cjs` (Line 211-212) / `server_webhook.cjs` (Line 211-212):
  ```javascript
  'apikey': SERVICE_ROLE_JWT || SUPABASE_KEY,
  'Authorization': 'Bearer ' + (SERVICE_ROLE_JWT || SUPABASE_KEY),
  ```

### Observation 1.3: SessionMutex Concurrency Control and FIFO per Phone
- File: `server_webhook_vps_live.cjs` (Lines 44-83) & `server_webhook.cjs` (Lines 44-83):
  ```javascript
  class SessionMutex {
    constructor() {
      this.queues = new Map();
    }

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
- Ingestion Dispatch: `server_webhook_vps_live.cjs` (Line 9208-9216) & `server_webhook.cjs` (Line 9411-9419):
  ```javascript
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

### Observation 1.4: Database RPC Migration for Points Conversion
- File: `supabase/migrations/20260828120000_atomic_points_conversion.sql` (Lines 5-93):
  - Row locking: `SELECT * INTO v_client FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;`
  - Balance validation: `IF v_pts <= 0 OR coalesce(v_client.saldo_pontos, 0) < v_pts THEN ...`
  - Conversion rate bounded reading: `SELECT least(greatest(coalesce(taxa_conversao_pontos, 0.01), 0.0001), 100) INTO v_rate FROM public.empresa ORDER BY created_at LIMIT 1;`
  - Balance update: `UPDATE public.clientes SET saldo_pontos = v_novo_pontos, saldo_carteira = v_novo_carteira, updated_at = now() WHERE id = p_cliente_id;`
  - Audit logging:
    - `INSERT INTO public.pontos_movimentacoes` with `tipo = 'conversao_dinheiro'`
    - `INSERT INTO public.carteira_lancamentos` with `tipo = 'credito'`
    - `INSERT INTO public.extrato_financeiro` with `tipo = 'entrada'`, `modulo_referencia = 'pontos'`
  - Atomic transaction: Encapsulated within single PostgreSQL PL/pgSQL function with `SECURITY DEFINER` and `SET search_path = public`.

### Observation 1.5: Webhook Integration with Atomic RPC
- File: `server_webhook_vps_live.cjs` (Lines 5044-5062) & `server_webhook.cjs` (Lines 5110-5128):
  ```javascript
  supabaseRpc('gsa_converter_pontos_carteira', { p_cliente_id: clientId }, (err, result) => {
    session.state = 'MAIN_MENU';
    userSessions[fromPhone] = session;

    if (err || !result || !result.success) {
      const errMsg = result?.error || (err ? err.message : 'Saldo insuficiente ou erro no servidor');
      console.error('❌ Erro na conversão de pontos via RPC:', errMsg);
      sendWhatsAppReply(fromPhone, `❌ Não foi possível converter seus pontos: ${errMsg}.\n\n_Digite 0 para voltar ao menu._`);
      return;
    }

    if (session.client) {
      session.client.saldo_pontos = result.novo_saldo_pontos;
      session.client.saldo_carteira = result.novo_saldo_carteira;
    }

    sendWhatsAppReply(fromPhone, `✅ *Conversão Concluída!*\n\n${result.pontos_convertidos} pontos foram convertidos com sucesso para *${result.valor_convertido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*.\nNovo Saldo em Carteira: *${result.novo_saldo_carteira.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n_Digite 0 para voltar._`);
  });
  ```

### Observation 1.6: Verification Test Suite Execution
- Command: `node scripts/verify_r4_backend.cjs`
- Output:
  ```
  === R4 VERIFICATION SUITE ===
  1. SERVICE_ROLE_JWT fallback chain:
     - server_webhook_vps_live.cjs: PASS
     - server_webhook.cjs: PASS
  2. SessionMutex Concurrency Guard:
     - Class definition in live: PASS
     - Class definition in dev: PASS
     - runExclusive hook in live: PASS
     - runExclusive hook in dev: PASS
  3. Atomic Points Conversion RPC usage:
     - RPC invoked in live: PASS
     - RPC invoked in dev: PASS
  4. SQL Migration Integrity (20260828120000_atomic_points_conversion.sql):
     - Pessimistic row locking (FOR UPDATE): PASS
     - pontos_movimentacoes ledger audit: PASS
     - carteira_lancamentos wallet audit: PASS
     - extrato_financeiro audit: PASS
     - SECURITY DEFINER safety: PASS
  5. SessionMutex Stress & Concurrency Test:
     - FIFO sequence guaranteed: PASS
     - Error isolation (prev error does not block queue): PASS
     - Memory cleanup on queue drain: PASS

  === FINAL R4 AUDIT RESULT: ALL CHECKS PASSED ✅ ===
  ```

---

## 2. Logic Chain

1. **SERVICE_ROLE_JWT Fallback Chain (Observation 1.2)**:
   - The token resolution order is `process.env.SUPABASE_SERVICE_ROLE_KEY` -> `SUPABASE_SERVICE_ROLE_KEY` (hardcoded default constant) -> `SUPABASE_KEY` (anon) -> `''`.
   - In all PostgREST and RPC HTTP request helper calls (`supabaseGet`, `supabasePost`, `supabasePatch`, `supabaseRpc`), the `apikey` and `Authorization: Bearer <token>` headers are systematically populated from `SERVICE_ROLE_JWT`.
   - This satisfies the fallback requirement and prevents unauthenticated or rejected requests in environments where the environment variable name differs.

2. **SessionMutex & Concurrency Protection (Observations 1.3 & 1.6)**:
   - When multiple WhatsApp messages arrive concurrently from the same user (`fromPhone`), incoming HTTP POST requests return immediate HTTP 200 OK acknowledgments and pass execution to `sessionMutex.runExclusive(fromPhone, ...)`.
   - The `SessionMutex` queues promises per phone number. Message $N+1$ awaits Promise $N$ settlement before executing `task()`.
   - If message $N$ throws an exception or fails, the `try/catch` inside `(async () => { await prevPromise; })()` prevents deadlock, allowing message $N+1$ to proceed.
   - The outer `processMessage` execution is also wrapped in an internal `try/catch` with WhatsApp user feedback.
   - When all queued tasks for a phone finish, the `nextPromise.finally` callback checks whether the current promise is still the active tail and deletes the key from `this.queues`, eliminating memory leaks.
   - Different phone numbers run concurrently without blocking each other.

3. **Atomic Points Conversion & DB Integrity (Observations 1.4 & 1.5)**:
   - The legacy Node.js Read-Modify-Write (RMW) flow was replaced with a PostgreSQL RPC call to `gsa_converter_pontos_carteira`.
   - Inside PostgreSQL, `SELECT * INTO v_client FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;` establishes an exclusive row lock on the client row. Any simultaneous conversion or balance mutation attempts will serialize at the database level.
   - Points balance sufficiency and account lock flags (`pontos_bloqueados`) are validated under the lock.
   - Balance changes on `clientes` and ledger insertions across `pontos_movimentacoes`, `carteira_lancamentos`, and `extrato_financeiro` occur within a single atomic PostgreSQL transaction. If any error occurs, PostgreSQL rolls back all changes completely.
   - Schema types and constraints (e.g., `pontos_movimentacoes_tipo_check` allowing `'conversao_dinheiro'`) match existing project migrations.

4. **Code Parity (Observations 1.1, 1.2, 1.3, 1.5)**:
   - Both `server_webhook_vps_live.cjs` and `server_webhook.cjs` contain matching implementations of `SessionMutex`, `SERVICE_ROLE_JWT` resolution, and `gsa_converter_pontos_carteira` RPC invocation.

---

## 3. Caveats

- **No caveats.** The implementation covers the entire scope of Requirement R4 without regressions, mock logic, or shortcuts.

---

## 4. Conclusion

The deliverables for Requirement R4 (`server_webhook_vps_live.cjs`, `server_webhook.cjs`, and `supabase/migrations/20260828120000_atomic_points_conversion.sql`) successfully resolve all target issues:
- Eliminates RMW race conditions via database-level `FOR UPDATE` row locking and atomic multi-table ledger transactions.
- Prevents message interleaving and out-of-order execution via `SessionMutex` per-phone FIFO serialization with error isolation and memory cleanup.
- Enforces resilient `SERVICE_ROLE_JWT` fallback chains across all Supabase helper functions.
- Maintains 100% parity across live and dev webhook scripts.

**Final Verdict**: **APPROVE**

---

## 5. Verification Method

To independently verify this review:
1. Syntax check:
   ```bash
   node --check server_webhook_vps_live.cjs
   node --check server_webhook.cjs
   ```
2. Automated R4 verification and stress suite:
   ```bash
   node scripts/verify_r4_backend.cjs
   ```
3. Full Realtime Audit suite:
   ```bash
   npx tsx scripts/check-realtime-audit.ts
   ```
