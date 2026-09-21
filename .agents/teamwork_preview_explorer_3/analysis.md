# Comprehensive Test & Validation Strategy — WhatsApp Anti-Ban Shield

**Author**: Explorer 3 (Anti-Ban Shield Testing & Verification Architecture)  
**Date**: 2026-08-21  
**Target File**: `test_antiban_queue.js` (Standalone Mock Test Runner)  
**Scope**: Verification of R1 (Per-User Message Queue), R2 (Realistic Presence Emulation), R3 (Spintax & Variation), R4 (Resilience & Exponential Backoff), and R5 (Transactional & Media Payload Invariance).

---

## 1. Executive Summary & Problem Formulation

The GSA OS WhatsApp Chatbot processes high volumes of incoming customer interactions, catalog queries, PIX payments, boleto/invoice generation, and order confirmations via `server_webhook_vps_live.cjs` and `server_webhook.cjs`.

### Current Production Vulnerability:
1. **Direct Synchronous Dispatch**: `sendWhatsAppReply` and `sendWhatsAppMedia` immediately execute `http.request` to Evolution API (`/message/sendText/GSA_WhatsApp` and `/message/sendMedia/GSA_WhatsApp`) without inter-message throttling or queuing. If a workflow dispatches 3 messages (e.g. greeting, PIX code, evaluation prompt), all 3 hit the Meta WhatsApp network within milliseconds. Meta's anti-spam algorithms flag this machine-speed burst behavior as automated bot spam, leading to phone number bans.
2. **Missing Presence Emulation**: Messages are delivered instantly with 0ms typing indicator, violating realistic human conversational behavior.
3. **Static Repetitive Text**: The bot repeatedly sends verbatim greeting and prompt strings, tripping Meta's duplicate content filters.
4. **Fragile Error Handling**: On transient HTTP 500 errors or network timeouts, the current retry logic does a fixed 2s retry or drops the message, lacking backoff with jitter and risk of socket storms.

### Objective:
Design an automated, standalone mock test suite (`test_antiban_queue.js`) that empirically proves the Anti-Ban Shield eliminates all ban vectors through per-user serial queueing, dynamic typing presence, spintax variation, exponential backoff, and transactional payload integrity.

---

## 2. Current Outgoing Dispatch Points in `server_webhook*.cjs`

| Dispatch Point | Location (`server_webhook_vps_live.cjs`) | Endpoint / Method | Current Payload / Behavior |
|---|---|---|---|
| `sendWhatsAppReply(to, text, retryCount)` | Line ~2485 | `POST /message/sendText/GSA_WhatsApp` | `{ number: cleanPhone, text: cleanText }` — Direct HTTP, immediate dispatch, fixed 2s retry. |
| `sendWhatsAppMedia(to, media, fileName, caption, mediaType)` | Line ~2870 | `POST /message/sendMedia/GSA_WhatsApp` | `{ number: cleanPhone, mediatype, mimetype, media, fileName, caption }` — Direct HTTP, no retry, no queue. |
| Follow-up Messages | Lines ~1505, ~2254-2262 | `setTimeout(() => sendWhatsAppReply(...), 900)` | Ad-hoc `setTimeout` hacks with fixed millisecond delays prone to race conditions. |

---

## 3. Anti-Ban Shield Architecture & Verification Contract

```
                     ┌─────────────────────────────────────────────────────────┐
                     │          INCOMING DISPATCH REQUEST                      │
                     │  (sendWhatsAppReply / sendWhatsAppMedia / PDF / PIX)    │
                     └────────────────────────────┬────────────────────────────┘
                                                  │
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          SPINTAX & VARIATION RESOLVER                   │
                     │     - Resolves {A|B|C} spintax options                  │
                     │     - Preserves template variables {nome}, {link}       │
                     │     - Formats WhatsApp Markdown                         │
                     └────────────────────────────┬────────────────────────────┘
                                                  │
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          PER-USER SMART MESSAGE QUEUE                   │
                     │     - Map<Phone, QueueInstance>                         │
                     │     - FIFO Sequential execution per phone               │
                     │     - Independent concurrency across distinct users     │
                     └────────────────────────────┬────────────────────────────┘
                                                  │
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │      STEP 1: PRESENCE EMULATION                         │
                     │     - Calculate typing delay: 30-50ms/char              │
                     │       (Clamped: min 1500ms, max 8000ms)                 │
                     │     - Dispatch: POST /chat/sendPresence                 │
                     │       (composing for text/doc, recording for audio)     │
                     │     - Wait: sleep(calculatedTypingDuration)             │
                     └────────────────────────────┬────────────────────────────┘
                                                  │
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │      STEP 2: MESSAGE DISPATCH WITH BACKOFF              │
                     │     - Dispatch: POST /message/sendText or sendMedia     │
                     │     - If 5xx/timeout: Exponential Backoff Retry         │
                     │       (Attempt 1: ~1.5s, Attempt 2: ~3.0s, Max: 3)      │
                     └────────────────────────────┬────────────────────────────┘
                                                  │
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │      STEP 3: INTER-MESSAGE JITTER DELAY                 │
                     │     - Sleep random 2000ms - 6000ms before next message  │
                     │     - Prune user queue on completion                    │
                     └─────────────────────────────────────────────────────────┘
```

---

## 4. Standalone Mock Evolution API Server Architecture

To achieve 100% reproducible, fast, and deterministic testing without depending on external VPS network connectivity or live WhatsApp instances, `test_antiban_queue.js` implements an embedded HTTP Mock Server.

### Features of the Mock Server:
1. **Dynamic / Configurable Port**: Binds to `process.env.MOCK_EVOLUTION_PORT || 8080` (or dynamic port `0` for parallel test isolation).
2. **Request Journaling**: Every incoming HTTP request records:
   - `id`: Incremental request counter
   - `timestamp`: Epoch milliseconds (`Date.now()`)
   - `hrtime`: High-resolution timestamp (`process.hrtime.bigint()`) for microsecond precision timing
   - `endpoint`: `/message/sendText/:instance`, `/message/sendMedia/:instance`, or `/chat/sendPresence/:instance`
   - `headers`: Headers sent (`apikey`, `Content-Type`)
   - `body`: Parsed JSON payload
3. **Programmable Fault Injection Engine**:
   - `mockServer.failNext(endpoint, times, statusCode)`: Returns specified HTTP error code (e.g. 500) for the next $N$ requests to an endpoint.
   - `mockServer.delayNext(endpoint, delayMs)`: Simulates network latency.
   - `mockServer.hangupNext(endpoint)`: Destroys socket immediately to test connection resets.
4. **Verification Query Helpers**:
   - `mockServer.getHistory()`: Returns full chronological log.
   - `mockServer.getByPhone(phone)`: Returns requests filtered by recipient.
   - `mockServer.clearHistory()`: Resets logs and response rules between tests.

---

## 5. Detailed Test Suite Specifications

### Suite 1: Queue Serialization & Randomized Inter-Message Delays (R1)
- **Objective**: Verify that 3 messages sent to the same user execute in strict FIFO order, with presence before text and a randomized 2-6s inter-message delay.
- **Scenario**:
  ```javascript
  const user = '5511999990001';
  sendWhatsAppReply(user, 'Mensagem 1: Notificação de Pedido');
  sendWhatsAppReply(user, 'Mensagem 2: Chave PIX Copia e Cola');
  sendWhatsAppReply(user, 'Mensagem 3: Como avalia nosso atendimento?');
  ```
- **Timeline & Timing Assertions**:
  1. $t_0$: Presence 1 (`composing`) emitted.
  2. $t_1$: SendText 1 emitted at $t_0 + \text{delay}_{\text{typing1}}$.
     - Assertion: $t_1 - t_0 \ge \text{minTypingDelay}$ (e.g. $\ge 1500\text{ms}$).
  3. $t_2$: Inter-message delay elapses. Presence 2 (`composing`) emitted.
     - Assertion: $t_2 - t_1 \ge \text{MIN\_INTER\_MESSAGE\_DELAY} \; (2000\text{ms})$.
     - Assertion: $t_2 - t_1 \le \text{MAX\_INTER\_MESSAGE\_DELAY} + \text{TOLERANCE} \; (6000\text{ms} + 250\text{ms})$.
  4. $t_3$: SendText 2 emitted at $t_2 + \text{delay}_{\text{typing2}}$.
  5. $t_4$: Inter-message delay elapses. Presence 3 (`composing`) emitted.
     - Assertion: $t_4 - t_3 \ge \text{MIN\_INTER\_MESSAGE\_DELAY} \; (2000\text{ms})$.
  6. $t_5$: SendText 3 emitted.
- **Order Assertions**:
  - `requests[0].body.presence === 'composing'`
  - `requests[1].body.text.includes('Mensagem 1')`
  - `requests[2].body.presence === 'composing'`
  - `requests[3].body.text.includes('Mensagem 2')`
  - `requests[4].body.presence === 'composing'`
  - `requests[5].body.text.includes('Mensagem 3')`

---

### Suite 2: Multi-User Concurrency & Queue Isolation (R1)
- **Objective**: Verify that queues for different recipients run concurrently without head-of-line blocking.
- **Scenario**:
  - User A (`5511999990001`): 3 long messages queued (estimated sequential duration: ~15s).
  - User B (`5511999990002`): 1 short message queued at the exact same millisecond $T_{\text{start}}$.
- **Assertions**:
  - `t(UserB_sendText) < t(UserA_Message2_sendText)`: User B receives their message immediately after their own short typing delay (~1.5s), long before User A's second and third messages are processed.
  - `delta(UserB_Presence_to_Start) < 50ms`: User B queue starts immediately without waiting for User A.

---

### Suite 3: Realistic Presence Emulation & Text Length Scaling (R2)
- **Objective**: Verify that presence requests are dispatched prior to messages, use the correct presence type, and scale typing duration based on character count.
- **Formulas Under Test**:
  $$\text{typingDelay}(\text{len}) = \min\Big(\text{MAX\_DELAY}, \max\big(\text{MIN\_DELAY}, \text{BASE\_DELAY} + \text{len} \times \text{MS\_PER\_CHAR} \pm \text{JITTER}\big)\Big)$$
  - $\text{MIN\_DELAY} = 1500\text{ms}$
  - $\text{MAX\_DELAY} = 8000\text{ms}$
  - $\text{MS\_PER\_CHAR} = 35\text{ms}$
- **Sub-Tests**:
  1. **Short Text (10 chars)**: Assert typing duration $\in [1400\text{ms}, 2000\text{ms}]$.
  2. **Medium Text (150 chars)**: Assert typing duration $\in [5500\text{ms}, 7500\text{ms}]$.
  3. **Long Text (500 chars)**: Assert typing duration clamped to $\in [7800\text{ms}, 8200\text{ms}]$.
  4. **Audio / Voice Payload**: Assert presence emitted is `'recording'`, endpoint is `/chat/sendPresence/GSA_WhatsApp`.
  5. **Document / PDF Payload**: Assert presence emitted is `'composing'`.

---

### Suite 4: Spintax & Response Variation Engine (R3)
- **Objective**: Verify Spintax parsing accuracy, nested resolution, random distribution, and template variable preservation.
- **Sub-Tests**:
  1. **Simple Spintax**:
     - Template: `"{Olá|Oi|E aí}, tudo bem?"`
     - 300 iterations: Assert only outputs are `"Olá, tudo bem?"`, `"Oi, tudo bem?"`, `"E aí, tudo bem?"`.
     - Chi-square / distribution check: Each option selected between 18% and 48% of the time (uniform distribution).
     - Assert zero unparsed braces `{` or `}` or pipes `|`.
  2. **Nested Spintax**:
     - Template: `"{{Bom dia|Boa tarde}|Olá}, {cliente|amigo}! {Como vai?|Tudo bem?}"`
     - 100 iterations: Assert every iteration produces clean Portuguese sentences without syntax errors.
  3. **Template Variable Preservation**:
     - Template: `"{Olá|Oi} {nome}, seu pedido #{numero} no valor de R$ {valor} foi aprovado!"`
     - Variables: `{ nome: "Adriano", numero: "10982", valor: "149,90" }`
     - Assert variables without pipes `{nome}`, `{numero}`, `{valor}` are properly preserved or interpolated, not treated as broken spintax.
  4. **Greeting Generator**:
     - Call `getRandomGreeting("Adriano")` 100 times.
     - Assert at least 4 distinct variations returned across iterations.

---

### Suite 5: Resilience & Exponential Backoff Retry (R4)
- **Objective**: Verify retry behavior, backoff timing progression, and permanent failure handling.
- **Sub-Tests**:
  1. **Transient 500 Error (Fails 2x, Succeeds on 3rd)**:
     - Mock server returns HTTP 500 on attempts 1 and 2, HTTP 200 on attempt 3.
     - Assertions:
       - Total HTTP attempts recorded = 3.
       - Backoff interval 1: $t_{\text{att2}} - t_{\text{att1}} \ge 1000\text{ms} \pm 200\text{ms}$.
       - Backoff interval 2: $t_{\text{att3}} - t_{\text{att2}} \ge 2000\text{ms} \pm 400\text{ms}$.
       - Backoff progression: $(t_{\text{att3}} - t_{\text{att2}}) > (t_{\text{att2}} - t_{\text{att1}})$.
       - Final message status: SUCCESS.
  2. **Permanent Failure Handling (Fails all attempts)**:
     - Mock server returns HTTP 500 continuously.
     - Assertions:
       - Process DOES NOT throw unhandled rejection or crash.
       - Max attempts capped at 3.
       - User queue unblocks and processes subsequent enqueued message.

---

### Suite 6: Transactional & Media Integrity (R5)
- **Objective**: Verify that PDF boletos, images, and transactional payloads pass through the Anti-Ban queue without data corruption or memory leaks.
- **Sub-Tests**:
  1. **PDF Boleto Integrity**:
     - Input: 25KB base64 encoded mock PDF.
     - Assert: Sent payload to `/message/sendMedia/GSA_WhatsApp` has:
       - `mediatype === 'document'`
       - `mimetype === 'application/pdf'`
       - `fileName === 'boleto_gsa_123.pdf'`
       - `crypto.createHash('sha256').update(req.body.media).digest('hex') === originalHash`
  2. **PIX QR Code Image Integrity**:
     - Input: Base64 QR Code PNG.
     - Assert: `mediatype === 'image'`, `mimetype === 'image/png'`.
  3. **Queue Drain & Memory Pruning**:
     - Assert: When all user messages finish sending, `queueManager.getActiveQueues().size === 0` (no dangling references).

---

## 6. Standalone Test Runner Implementation Blueprint (`test_antiban_queue.js`)

Below is the complete architectural specification for `test_antiban_queue.js`.

### Test Runner Architecture:

```javascript
'use strict';
const http = require('http');
const assert = require('assert/strict');
const crypto = require('crypto');

// ─── CONFIGURATION & TIME SCALING ───────────────────────────────────────────
// For lightning-fast CI test runs, TIME_SCALE can scale delays (e.g. 0.05).
// For strict 1:1 real-time compliance verification, TIME_SCALE is set to 1.0.
const TIME_SCALE = Number(process.env.TIME_SCALE || 1.0);
const MOCK_PORT = Number(process.env.MOCK_EVOLUTION_PORT || 8085);

// ─── EMBEDDED MOCK EVOLUTION SERVER ─────────────────────────────────────────
class MockEvolutionServer {
  constructor(port = MOCK_PORT) {
    this.port = port;
    this.server = null;
    this.requests = [];
    this.faultRules = new Map(); // endpoint -> { failCount, statusCode }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        let bodyRaw = '';
        req.on('data', chunk => { bodyRaw += chunk; });
        req.on('end', () => {
          let body = {};
          try { body = JSON.parse(bodyRaw); } catch(e) { body = { raw: bodyRaw }; }

          const record = {
            id: this.requests.length + 1,
            time: Date.now(),
            hrtime: process.hrtime.bigint(),
            method: req.method,
            url: req.url,
            headers: req.headers,
            body
          };
          this.requests.push(record);

          // Check fault injection rules
          const rule = this.faultRules.get(req.url);
          if (rule && rule.failCount > 0) {
            rule.failCount--;
            res.writeHead(rule.statusCode || 500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Injected Error', status: rule.statusCode || 500 }));
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'SUCCESS', message: 'OK', key: { id: 'MOCK_EVO_' + Date.now() } }));
        });
      });

      this.server.on('error', reject);
      this.server.listen(this.port, '127.0.0.1', () => resolve());
    });
  }

  stop() {
    return new Promise(resolve => {
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }

  clear() {
    this.requests = [];
    this.faultRules.clear();
  }

  failNext(endpoint, failCount, statusCode = 500) {
    this.faultRules.set(endpoint, { failCount, statusCode });
  }

  getByPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    return this.requests.filter(r => r.body && r.body.number && r.body.number.replace(/\D/g, '') === clean);
  }
}

// ─── TEST SUITE RUNNER ───────────────────────────────────────────────────────
async function runAllTests() {
  console.log('======================================================================');
  console.log('  GSA OS — WHATSAPP ANTI-BAN SHIELD AUTOMATED MOCK TEST SUITE');
  console.log(`  Mode: Standalone Mock | TimeScale: ${TIME_SCALE}x | Port: ${MOCK_PORT}`);
  console.log('======================================================================\n');

  const mockServer = new MockEvolutionServer(MOCK_PORT);
  await mockServer.start();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    mockServer.clear();
    const start = Date.now();
    process.stdout.write(`  ▶ Running: ${name}... `);
    try {
      await fn(mockServer);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`\x1b[32m[PASS]\x1b[0m (${elapsed}s)`);
      passed++;
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`\x1b[31m[FAIL]\x1b[0m (${elapsed}s)`);
      console.error('    ❌ Error:', err.message);
      if (err.stack) console.error('    ' + err.stack.split('\n').slice(1, 4).join('\n    '));
      failed++;
    }
  }

  try {
    // Test 1: Spintax Engine Unit Tests
    await test('R3: Spintax Parser & Variation Resolution', async () => {
      // Test spintax resolution, distributions, and variable preservation
    });

    // Test 2: Typing Delay Calculation & Scaling
    await test('R2: Typing Delay Calculation Scales Proportional to Length', async () => {
      // Test dynamic typing duration scaling
    });

    // Test 3: Per-User Queue Serialization & Delay
    await test('R1: Queue Serialization & Randomized Inter-Message Delays (3 Rapid Messages)', async (mock) => {
      // Test 3 rapid messages to same user
    });

    // Test 4: Multi-User Concurrency & Queue Isolation
    await test('R1: Multi-User Concurrency (Non-blocking Queues across Users)', async (mock) => {
      // Test User A vs User B
    });

    // Test 5: Exponential Backoff & Retry on 500 Server Error
    await test('R4: Exponential Backoff Retry (500 Error recovery on 3rd attempt)', async (mock) => {
      // Test retry backoff
    });

    // Test 6: Permanent Failure Queue Unblocking
    await test('R4: Permanent Failure Unblocks Queue without Process Crash', async (mock) => {
      // Test permanent failure
    });

    // Test 7: Transactional PDF / Media Integrity
    await test('R5: Transactional & Media Integrity (PDF Boleto & QR Code)', async (mock) => {
      // Test PDF base64 and media preservation
    });

  } finally {
    await mockServer.stop();
  }

  console.log('\n======================================================================');
  console.log(`  TEST RESULTS: \x1b[32m${passed} PASSED\x1b[0m | \x1b[${failed > 0 ? '31' : '32'}m${failed} FAILED\x1b[0m | Total: ${passed + failed}`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}
```

---

## 7. Execution Guide

### Running Locally on Development / VPS:
```bash
# Run with standard Node.js
node test_antiban_queue.js

# Or run with scaled time for fast CI checks:
TIME_SCALE=0.1 node test_antiban_queue.js
```

### Expected Output:
- Exit Code `0`: All 7 test suites passed, proving complete Anti-Ban Shield integrity.
- Exit Code `1`: Assertion failure detected, with exact delta timestamps, request indexes, and mismatch details logged to stderr.
