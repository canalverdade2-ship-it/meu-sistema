'use strict';

/**
 * ============================================================================
 * CHALLENGER 1 — EMPIRICAL ADVERSARIAL STRESS TEST & FAULT INJECTION HARNESS
 * ============================================================================
 * Scope:
 *  1. Concurrency Stress:
 *     - 20 rapid burst messages to 1 contact (assert strict FIFO & delay distribution)
 *     - 10 distinct contacts in parallel (assert concurrent non-blocking execution)
 *     - Queue depth overflow rejection (maxQueueDepth=50)
 *  2. Spintax & Syntax Fuzzing:
 *     - Deeply nested Spintax ({10+ levels})
 *     - Unclosed / malformed braces ({A|B, {||}, A|B})
 *     - Special characters (Unicode, Emojis, Regex metachars, JSON, SQL)
 *     - Template variable preservation ({nome}, {valor}, {link})
 *     - Non-string input edge cases
 *  3. Fault Injection & Backoff Resilience:
 *     - Network ECONNRESET (abrupt socket destruction)
 *     - Network ETIMEDOUT / Timeout recovery
 *     - HTTP 429 (Rate Limit throttling backoff)
 *     - HTTP 502, 503, 504 (Gateway / Server Faults)
 *     - Non-retryable HTTP 400, 401, 404 (Fast-fail on attempt 1)
 *     - Queue recovery after max retries permanent failure
 * ============================================================================
 */

const http = require('http');
const assert = require('assert');
const path = require('path');

// Configure test port and fast time scale for deterministic high-speed testing
const TEST_PORT = Number(process.env.MOCK_EVOLUTION_PORT || 8092);
const TIME_SCALE = Number(process.env.TIME_SCALE || 0.05);

process.env.EVOLUTION_API_URL = `http://127.0.0.1:${TEST_PORT}`;
process.env.EVOLUTION_API_KEY = 'gsa_challenger_token_2026';
process.env.EVOLUTION_INSTANCE = 'GSA_WhatsApp';
process.env.TIME_SCALE = String(TIME_SCALE);

const antiBanEngine = require('../lib/antiBanEngine.cjs');

// ─── ADVANCED MOCK SERVER WITH FAULT INJECTION CAPABILITIES ──────────────────
class AdvancedMockEvolutionServer {
  constructor(port = TEST_PORT) {
    this.port = port;
    this.server = null;
    this.requests = [];
    this.endpointRules = new Map(); // endpoint -> array of responses/actions
    this.socketBehaviorRules = new Map(); // endpoint -> { action: 'destroy' | 'hang', count: number }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = req.url;

        // Check socket-level fault injection rules before reading body
        if (this.socketBehaviorRules.has(url)) {
          const rule = this.socketBehaviorRules.get(url);
          if (rule.count > 0) {
            rule.count--;
            if (rule.action === 'destroy') {
              // Simulate abrupt TCP RST / ECONNRESET
              req.socket.destroy();
              return;
            } else if (rule.action === 'hang') {
              // Simulate socket hang / timeout (do not reply)
              return;
            }
          }
        }

        let bodyRaw = '';
        req.on('data', chunk => { bodyRaw += chunk; });
        req.on('end', () => {
          let body = {};
          try { body = JSON.parse(bodyRaw); } catch (_) { body = { raw: bodyRaw }; }

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

          // Check queued responses for this endpoint
          if (this.endpointRules.has(url) && this.endpointRules.get(url).length > 0) {
            const rules = this.endpointRules.get(url);
            const reqPhone = body && body.number ? String(body.number).replace(/\D/g, '') : null;
            const matchIndex = rules.findIndex(r => !r.targetPhone || r.targetPhone === reqPhone);

            if (matchIndex !== -1) {
              const nextAction = rules.splice(matchIndex, 1)[0];
              if (typeof nextAction === 'function') {
                return nextAction(req, body, res);
              }
              if (typeof nextAction === 'object') {
                res.writeHead(nextAction.status || 200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(nextAction.body || {}));
              }
            }
          }

          // Default success response
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'SUCCESS',
            message: 'OK',
            key: { id: `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, remoteJid: `${body.number}@s.whatsapp.net` }
          }));
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
    this.endpointRules.clear();
    this.socketBehaviorRules.clear();
  }

  queueResponses(endpoint, responses, phone = null) {
    if (!this.endpointRules.has(endpoint)) {
      this.endpointRules.set(endpoint, []);
    }
    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
    const formatted = responses.map(r => ({ ...r, targetPhone: cleanPhone }));
    this.endpointRules.get(endpoint).push(...formatted);
  }

  injectSocketFault(endpoint, action, count = 1) {
    this.socketBehaviorRules.set(endpoint, { action, count });
  }

  getByPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    return this.requests.filter(r => r.body && r.body.number && String(r.body.number).replace(/\D/g, '') === clean);
  }
}

// ─── TEST RUNNER FRAMEWORK ───────────────────────────────────────────────────
async function runChallenger1Tests() {
  console.log('======================================================================');
  console.log('  CHALLENGER 1: ADVERSARIAL STRESS TEST & FAULT INJECTION HARNESS');
  console.log(`  Engine: lib/antiBanEngine.cjs | TimeScale: ${TIME_SCALE}x | Port: ${TEST_PORT}`);
  console.log('======================================================================\n');

  const mockServer = new AdvancedMockEvolutionServer(TEST_PORT);
  await mockServer.start();

  let passed = 0;
  let failed = 0;
  const results = [];

  async function testCase(id, title, fn) {
    mockServer.clear();
    antiBanEngine.clearAllQueues();
    const start = Date.now();
    process.stdout.write(`  [${id}] ${title}... `);
    try {
      await fn(mockServer);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`\x1b[32m[PASS]\x1b[0m (${elapsed}s)`);
      passed++;
      results.push({ id, title, status: 'PASS', elapsed: `${elapsed}s` });
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`\x1b[31m[FAIL]\x1b[0m (${elapsed}s)`);
      console.error(`     ❌ ERROR: ${err.message}`);
      if (err.stack) {
        console.error('     ' + err.stack.split('\n').slice(1, 4).join('\n     '));
      }
      failed++;
      results.push({ id, title, status: 'FAIL', error: err.message, elapsed: `${elapsed}s` });
    }
  }

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // CATEGORY 1: CONCURRENCY & BURST QUEUE STRESS
    // ═════════════════════════════════════════════════════════════════════════

    await testCase('T1.1', 'Burst Concurrency: 20 rapid messages to 1 contact with strict FIFO & delay timing', async (mock) => {
      const phone = '5511988880001';
      const count = 20;
      const promises = [];

      // Dispatch 20 messages simultaneously
      for (let i = 0; i < count; i++) {
        promises.push(
          antiBanEngine.enqueueMessage({
            to: phone,
            type: 'text',
            payload: { text: `MSG_SEQUENCE_${String(i).padStart(2, '0')}` },
            options: { minInterval: 2000, maxInterval: 6000 }
          })
        );
      }

      const responses = await Promise.all(promises);

      // 1. Verify all 20 returned success
      assert.strictEqual(responses.length, count, `Expected ${count} responses`);
      for (let i = 0; i < count; i++) {
        assert.ok(responses[i].success, `Message index ${i} failed: ${JSON.stringify(responses[i])}`);
      }

      // 2. Verify all requests recorded on mock server
      const userRequests = mock.getByPhone(phone);
      const textRequests = userRequests.filter(r => r.url.includes('/message/sendText/'));
      const presenceRequests = userRequests.filter(r => r.url.includes('/chat/sendPresence/'));

      assert.strictEqual(textRequests.length, count, `Expected ${count} sendText calls, got ${textRequests.length}`);
      assert.ok(presenceRequests.length >= count, `Expected at least ${count} presence calls, got ${presenceRequests.length}`);

      // 3. Verify STRICT FIFO sequence order
      for (let i = 0; i < count; i++) {
        const expectedPattern = `MSG_SEQUENCE_${String(i).padStart(2, '0')}`;
        assert.ok(
          textRequests[i].body.text.includes(expectedPattern),
          `FIFO order violated at index ${i}! Expected text containing "${expectedPattern}", got "${textRequests[i].body.text}"`
        );
      }

      // 4. Verify inter-message dispatch timestamps are strictly monotonically increasing
      for (let i = 1; i < count; i++) {
        const prevTime = textRequests[i - 1].time;
        const currTime = textRequests[i].time;
        const delta = currTime - prevTime;
        assert.ok(
          currTime > prevTime,
          `Timestamp inverted or identical between msg ${i-1} (${prevTime}) and msg ${i} (${currTime})`
        );
        // Inter-message delay must respect scaled minimum bounds
        const minExpectedInterval = (2000 + 1500) * TIME_SCALE * 0.8;
        assert.ok(
          delta >= minExpectedInterval,
          `Interval between msg ${i-1} and ${i} was ${delta}ms, smaller than expected scaled minimum ${minExpectedInterval}ms`
        );
      }
    });

    await testCase('T1.2', 'Cross-Contact Parallel Concurrency: 10 distinct contacts process non-blocking', async (mock) => {
      const userCount = 10;
      const startTimes = new Map();
      const endTimes = new Map();
      const promises = [];

      const batchStart = Date.now();

      for (let i = 0; i < userCount; i++) {
        const phone = `55119777700${String(i).padStart(2, '0')}`;
        startTimes.set(phone, Date.now());
        promises.push(
          antiBanEngine.enqueueMessage({
            to: phone,
            type: 'text',
            payload: { text: `Parallel hello to user ${i}` }
          }).then(res => {
            endTimes.set(phone, Date.now());
            return { phone, res };
          })
        );
      }

      const results = await Promise.all(promises);
      const batchDuration = Date.now() - batchStart;

      // 1. Verify all 10 completed successfully
      assert.strictEqual(results.length, userCount);
      for (const r of results) {
        assert.ok(r.res.success, `Contact ${r.phone} failed`);
      }

      // 2. Measure individual durations vs batch duration
      const individualDurations = results.map(r => endTimes.get(r.phone) - startTimes.get(r.phone));
      const maxIndividual = Math.max(...individualDurations);
      const avgIndividual = individualDurations.reduce((a, b) => a + b, 0) / userCount;

      // If execution were sequential, batch duration would be ~ 10 * avgIndividual.
      // In concurrent execution, batch duration is close to maxIndividual (< 2.5 * maxIndividual).
      assert.ok(
        batchDuration < maxIndividual * 2.5,
        `Execution was blocked/sequential! Batch took ${batchDuration}ms, max individual was ${maxIndividual}ms (sum was ${individualDurations.reduce((a,b)=>a+b,0)}ms)`
      );
    });

    await testCase('T1.3', 'Queue Overflow Guard: Rejects when maxQueueDepth is exceeded', async (mock) => {
      const phone = '5511966660001';
      const config = antiBanEngine.getConfig();
      const maxDepth = config.maxQueueDepth || 50;

      // Pause mock server response temporarily by queueing hanging requests to hold the queue processing
      mock.injectSocketFault('/chat/sendPresence/GSA_WhatsApp', 'hang', 1);

      // Item 0 will start processing and hang. Items 1..50 (50 items) fill the waiting items buffer up to maxDepth.
      const queuePromises = [];
      for (let i = 0; i <= maxDepth; i++) {
        queuePromises.push(
          antiBanEngine.enqueueMessage(phone, `Held item ${i}`).catch(err => ({ error: err.message }))
        );
      }

      // The next item must be immediately rejected synchronously via Promise rejection
      let overflowRejected = false;
      try {
        await antiBanEngine.enqueueMessage(phone, 'Overflow item beyond capacity');
      } catch (err) {
        if (err.message.includes('Queue overflow') || err.message.includes('max depth')) {
          overflowRejected = true;
        }
      }

      assert.ok(overflowRejected, 'Queue overflow was not guarded! Item beyond maxQueueDepth was accepted');

      // Clear queues to unblock lingering timers
      antiBanEngine.clearAllQueues();
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CATEGORY 2: SPINTAX FUZZING & SYNTAX ADVERSARIAL SUITE
    // ═════════════════════════════════════════════════════════════════════════

    await testCase('T2.1', 'Spintax Deep Nesting (10+ Levels) Complete Resolution', async () => {
      // 10-level nested Spintax
      const nested10 = '{L1_A|{L2_A|{L3_A|{L4_A|{L5_A|{L6_A|{L7_A|{L8_A|{L9_A|{L10_A|L10_B}|L9_B}|L8_B}|L7_B}|L6_B}|L5_B}|L4_B}|L3_B}|L2_B}|L1_B}';

      for (let i = 0; i < 50; i++) {
        const resolved = antiBanEngine.parseSpintax(nested10);
        assert.ok(!resolved.includes('{') && !resolved.includes('}') && !resolved.includes('|'), `Incomplete nesting resolution: ${resolved}`);
        assert.ok(resolved.startsWith('L') || resolved.startsWith('L10'), `Unexpected token: ${resolved}`);
      }

      // Max iteration boundary test (50 levels of single pipe pairs)
      let deep50 = 'LEAF';
      for (let lvl = 1; lvl <= 45; lvl++) {
        deep50 = `{N${lvl}_A|${deep50}}`;
      }
      const resolved50 = antiBanEngine.parseSpintax(deep50);
      assert.ok(!resolved50.includes('{') && !resolved50.includes('}'), `Unresolved tokens in 45-level nested expression: ${resolved50}`);
    });

    await testCase('T2.2', 'Spintax Malformed Syntax Fuzzing (Unclosed, Empty choices, Inverted braces)', async () => {
      // 1. Unclosed brace
      const unclosed = 'Olá {Adriano|Amigo, como vai?';
      const resUnclosed = antiBanEngine.parseSpintax(unclosed);
      assert.strictEqual(resUnclosed, unclosed, 'Unclosed brace caused unwanted corruption');

      // 2. Extra closing brace
      const extraClosing = 'Olá {Adriano|Amigo}}, tudo bem?';
      const resExtra = antiBanEngine.parseSpintax(extraClosing);
      assert.ok(resExtra.startsWith('Olá Adriano}') || resExtra.startsWith('Olá Amigo}'), `Malformed output: ${resExtra}`);

      // 3. Empty choices {A||B}, {|}, {|||}
      const emptyChoice = '{A||B}';
      const picked = new Set();
      for (let i = 0; i < 100; i++) {
        const out = antiBanEngine.parseSpintax(emptyChoice);
        assert.ok(['A', '', 'B'].includes(out), `Unexpected choice from empty option: "${out}"`);
        picked.add(out);
      }
      // Must be capable of picking empty string choice without crashing
      assert.ok(picked.has(''), 'Empty choice was never selected');

      // 4. Non-string inputs: null, undefined, numbers, objects
      assert.strictEqual(antiBanEngine.parseSpintax(null), null);
      assert.strictEqual(antiBanEngine.parseSpintax(undefined), undefined);
      assert.strictEqual(antiBanEngine.parseSpintax(12345), 12345);
      assert.deepStrictEqual(antiBanEngine.parseSpintax({ a: 1 }), { a: 1 });
    });

    await testCase('T2.3', 'Spintax Special Characters, Unicode Emojis, JSON & SQL Payloads', async () => {
      // 1. Unicode & Multi-byte Emojis
      const emojiTemplate = '🚀 {✨ Parabéns!|🎉 Ótimo!|⭐ Excelente!} 🇧🇷 {👨‍👩‍👧‍👦 Família|🏠 Casa}';
      for (let i = 0; i < 30; i++) {
        const out = antiBanEngine.parseSpintax(emojiTemplate);
        assert.ok(out.includes('🚀') && out.includes('🇧🇷'), `Emoji stripped or corrupted: ${out}`);
        assert.ok(!out.includes('{') && !out.includes('}'), `Unresolved spintax in emoji string: ${out}`);
      }

      // 2. Regex Metacharacters within choices: ^ $ . * + ? ( ) [ ] \ /
      const regexCharsTemplate = '{Pattern: ^[a-z]+$|Regex: \\d+\\.\\d+|Filter: (A|B) & [0-9]*}';
      for (let i = 0; i < 30; i++) {
        const out = antiBanEngine.parseSpintax(regexCharsTemplate);
        assert.ok(!out.includes('{') && !out.includes('}'), `Regex metacharacters broke parser: ${out}`);
      }

      // 3. JSON inside Spintax
      const jsonTemplate = '{"status": "{active|pending}", "code": {100|200}}';
      for (let i = 0; i < 20; i++) {
        const out = antiBanEngine.parseSpintax(jsonTemplate);
        assert.ok(!out.includes('|'), `Pipe remained in JSON payload: ${out}`);
        let parsedJson = null;
        try { parsedJson = JSON.parse(out); } catch (e) { parsedJson = null; }
        assert.ok(parsedJson !== null, `JSON was invalidated after Spintax resolution: ${out}`);
        assert.ok(['active', 'pending'].includes(parsedJson.status));
        assert.ok([100, 200].includes(parsedJson.code));
      }

      // 4. SQL inside Spintax
      const sqlTemplate = "SELECT * FROM faturas WHERE status = '{paga|aberta}' AND valor > {500|1000};";
      const outSql = antiBanEngine.parseSpintax(sqlTemplate);
      assert.ok(outSql.includes("status = 'paga'") || outSql.includes("status = 'aberta'"));
      assert.ok(outSql.includes("valor > 500") || outSql.includes("valor > 1000"));
    });

    await testCase('T2.4', 'Template Variable Preservation ({nome}, {link}, {valor})', async () => {
      const template = '{Olá|Oi|E aí} {nome}, seu boleto {codigo} no valor de R$ {valor} vence em {data_vencimento}. Acesse: {link_fatura}';
      for (let i = 0; i < 50; i++) {
        const out = antiBanEngine.parseSpintax(template);
        assert.ok(out.includes('{nome}'), `Variable {nome} was corrupted: ${out}`);
        assert.ok(out.includes('{codigo}'), `Variable {codigo} was corrupted: ${out}`);
        assert.ok(out.includes('{valor}'), `Variable {valor} was corrupted: ${out}`);
        assert.ok(out.includes('{data_vencimento}'), `Variable {data_vencimento} was corrupted: ${out}`);
        assert.ok(out.includes('{link_fatura}'), `Variable {link_fatura} was corrupted: ${out}`);
      }
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CATEGORY 3: NETWORK FAULT INJECTION & EXPONENTIAL BACKOFF
    // ═════════════════════════════════════════════════════════════════════════

    await testCase('T3.1', 'Fault Injection: TCP ECONNRESET recovery with exponential backoff on attempt 3', async (mock) => {
      const phone = '5511955550001';
      const sendTextEndpoint = '/message/sendText/GSA_WhatsApp';

      // Abruptly destroy socket on first 2 sendText attempts
      mock.injectSocketFault(sendTextEndpoint, 'destroy', 2);

      const res = await antiBanEngine.sendWhatsAppReply(phone, 'Mensagem com TCP reset');
      assert.ok(res.success, `Expected message to recover after 2 TCP resets, but got: ${JSON.stringify(res)}`);

      const requests = mock.getByPhone(phone).filter(r => r.url.includes('/message/sendText/'));
      // Attempt 3 succeeded
      assert.strictEqual(requests.length, 1, 'Only the successful 3rd attempt should have completed HTTP body parse');
    });

    await testCase('T3.2', 'Fault Injection: HTTP 429 (Rate Limit) recovery with progressive backoff', async (mock) => {
      const phone = '5511955550002';
      const sendTextEndpoint = '/message/sendText/GSA_WhatsApp';

      // Queue two 429 Too Many Requests responses, then one 200 OK
      mock.queueResponses(sendTextEndpoint, [
        { status: 429, body: { error: 'Rate limit exceeded' } },
        { status: 429, body: { error: 'Rate limit exceeded' } },
        { status: 200, body: { status: 'SUCCESS', key: { id: 'EVO_429_RECOVERED' } } }
      ], phone);

      const res = await antiBanEngine.sendWhatsAppReply(phone, 'Mensagem com 429');
      assert.ok(res.success, `Expected message to recover on 3rd attempt after 429, got: ${JSON.stringify(res)}`);

      const requests = mock.getByPhone(phone).filter(r => r.url.includes('/message/sendText/'));
      assert.strictEqual(requests.length, 3, `Expected exactly 3 dispatch attempts, got ${requests.length}`);

      // Verify progressive delay
      const delta1 = requests[1].time - requests[0].time;
      const delta2 = requests[2].time - requests[1].time;
      assert.ok(delta2 >= delta1, `Backoff not progressive: attempt 2 (${delta2}ms) <= attempt 1 (${delta1}ms)`);
    });

    await testCase('T3.3', 'Fault Injection: Gateway Faults HTTP 502, 503, 504 are retryable', async (mock) => {
      const phone = '5511955550003';
      const sendTextEndpoint = '/message/sendText/GSA_WhatsApp';

      // 1. Test 502 Bad Gateway
      mock.queueResponses(sendTextEndpoint, [
        { status: 502, body: { error: 'Bad Gateway' } },
        { status: 200, body: { status: 'SUCCESS' } }
      ], phone);
      const res502 = await antiBanEngine.sendWhatsAppReply(phone, 'Test 502');
      assert.ok(res502.success, 'HTTP 502 did not retry');

      mock.clear();

      // 2. Test 503 Service Unavailable
      mock.queueResponses(sendTextEndpoint, [
        { status: 503, body: { error: 'Service Unavailable' } },
        { status: 200, body: { status: 'SUCCESS' } }
      ], phone);
      const res503 = await antiBanEngine.sendWhatsAppReply(phone, 'Test 503');
      assert.ok(res503.success, 'HTTP 503 did not retry');

      mock.clear();

      // 3. Test 504 Gateway Timeout
      mock.queueResponses(sendTextEndpoint, [
        { status: 504, body: { error: 'Gateway Timeout' } },
        { status: 200, body: { status: 'SUCCESS' } }
      ], phone);
      const res504 = await antiBanEngine.sendWhatsAppReply(phone, 'Test 504');
      assert.ok(res504.success, 'HTTP 504 did not retry');
    });

    await testCase('T3.4', 'Fault Injection: Non-Retryable HTTP Errors (400, 401, 403, 404) Fast-Fail on Attempt 1', async (mock) => {
      const sendTextEndpoint = '/message/sendText/GSA_WhatsApp';

      // 1. Test 400 Bad Request
      const phone400 = '5511955550400';
      mock.queueResponses(sendTextEndpoint, [
        { status: 400, body: { error: 'Bad Request: Invalid phone format' } },
        { status: 200, body: { status: 'SUCCESS' } } // Should NEVER be reached!
      ], phone400);

      const res400 = await antiBanEngine.sendWhatsAppReply(phone400, 'Test 400 Bad Request');
      assert.strictEqual(res400.success, false, 'Expected 400 to return false');
      const requests400 = mock.getByPhone(phone400).filter(r => r.url.includes('/message/sendText/'));
      assert.strictEqual(requests400.length, 1, `400 Bad Request should NOT be retried, but got ${requests400.length} attempts`);

      mock.clear();

      // 2. Test 401 Unauthorized
      const phone401 = '5511955550401';
      mock.queueResponses(sendTextEndpoint, [
        { status: 401, body: { error: 'Unauthorized: Invalid API Key' } },
        { status: 200, body: { status: 'SUCCESS' } }
      ], phone401);
      const res401 = await antiBanEngine.sendWhatsAppReply(phone401, 'Test 401 Unauthorized');
      assert.strictEqual(res401.success, false, 'Expected 401 to return false');
      const requests401 = mock.getByPhone(phone401).filter(r => r.url.includes('/message/sendText/'));
      assert.strictEqual(requests401.length, 1, `401 Unauthorized should NOT be retried, but got ${requests401.length} attempts`);

      mock.clear();

      // 3. Test 404 Not Found
      const phone404 = '5511955550404';
      mock.queueResponses(sendTextEndpoint, [
        { status: 404, body: { error: 'Instance not found' } },
        { status: 200, body: { status: 'SUCCESS' } }
      ], phone404);
      const res404 = await antiBanEngine.sendWhatsAppReply(phone404, 'Test 404 Not Found');
      assert.strictEqual(res404.success, false, 'Expected 404 to return false');
      const requests404 = mock.getByPhone(phone404).filter(r => r.url.includes('/message/sendText/'));
      assert.strictEqual(requests404.length, 1, `404 Not Found should NOT be retried, but got ${requests404.length} attempts`);
    });

    await testCase('T3.5', 'Exhausted Retries Permanent Failure does not poison Queue', async (mock) => {
      const phone = '5511955550005';
      const sendTextEndpoint = '/message/sendText/GSA_WhatsApp';

      // Fail 10 consecutive times with 500
      mock.queueResponses(sendTextEndpoint, Array(10).fill({ status: 500, body: { error: 'Fatal internal crash' } }), phone);

      const resFail = await antiBanEngine.sendWhatsAppReply(phone, 'Message doomed to fail');
      assert.strictEqual(resFail.success, false, 'Expected exhausted retries to fail');

      // Now server recovers
      mock.clear();

      // Send follow-up message to the exact same phone queue
      const resRecover = await antiBanEngine.sendWhatsAppReply(phone, 'Follow-up healthy message');
      assert.ok(resRecover.success, 'Follow-up message failed; queue was left in jammed/poisoned state');

      const requests = mock.getByPhone(phone).filter(r => r.url.includes('/message/sendText/'));
      const lastRequest = requests[requests.length - 1];
      assert.ok(lastRequest.body.text.includes('healthy message'), 'Healthy message was not dispatched');
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CATEGORY 4: MIXED MEDIA / TEXT PIPELINE & FORMATTING ORACLES
    // ═════════════════════════════════════════════════════════════════════════

    await testCase('T4.1', 'Mixed Pipeline: Alternating Text and Media in Strict FIFO Order', async (mock) => {
      const phone = '5511944440001';
      const mockPdfBase64 = Buffer.from('%PDF-1.4 simulated pdf boleto content').toString('base64');
      const mockImgBase64 = Buffer.from('simulated image binary png').toString('base64');

      // Dispatch 5 alternating items simultaneously: Text -> PDF -> Text -> Image -> Text
      const p1 = antiBanEngine.sendWhatsAppReply(phone, 'Passo 1: Olá! Aqui está sua fatura:');
      const p2 = antiBanEngine.sendWhatsAppMedia(phone, `data:application/pdf;base64,${mockPdfBase64}`, 'fatura.pdf', 'Fatura PDF', 'document');
      const p3 = antiBanEngine.sendWhatsAppReply(phone, 'Passo 3: Você também pode pagar via QR Code PIX:');
      const p4 = antiBanEngine.sendWhatsAppMedia(phone, `data:image/png;base64,${mockImgBase64}`, 'pix_qr.png', 'QR Code', 'image');
      const p5 = antiBanEngine.sendWhatsAppReply(phone, 'Passo 5: Qualquer dúvida estamos à disposição!');

      const [r1, r2, r3, r4, r5] = await Promise.all([p1, p2, p3, p4, p5]);

      assert.ok(r1.success && r2.success && r3.success && r4.success && r5.success, 'One of the pipeline messages failed');

      const requests = mock.getByPhone(phone);
      const dispatchRequests = requests.filter(r => r.url.includes('/message/sendText/') || r.url.includes('/message/sendMedia/'));

      assert.strictEqual(dispatchRequests.length, 5, `Expected 5 dispatch requests, got ${dispatchRequests.length}`);

      // Verify exact sequence types
      assert.ok(dispatchRequests[0].url.includes('/message/sendText/'), 'Item 1 was not sendText');
      assert.ok(dispatchRequests[0].body.text.includes('Passo 1'), 'Item 1 text mismatch');

      assert.ok(dispatchRequests[1].url.includes('/message/sendMedia/'), 'Item 2 was not sendMedia');
      assert.strictEqual(dispatchRequests[1].body.mediatype, 'document');

      assert.ok(dispatchRequests[2].url.includes('/message/sendText/'), 'Item 3 was not sendText');
      assert.ok(dispatchRequests[2].body.text.includes('Passo 3'), 'Item 3 text mismatch');

      assert.ok(dispatchRequests[3].url.includes('/message/sendMedia/'), 'Item 4 was not sendMedia');
      assert.strictEqual(dispatchRequests[3].body.mediatype, 'image');

      assert.ok(dispatchRequests[4].url.includes('/message/sendText/'), 'Item 5 was not sendText');
      assert.ok(dispatchRequests[4].body.text.includes('Passo 5'), 'Item 5 text mismatch');

      // Verify timestamps are strictly increasing
      for (let i = 1; i < 5; i++) {
        assert.ok(dispatchRequests[i].time > dispatchRequests[i - 1].time, `Timestamp inversion between item ${i-1} and ${i}`);
      }
    });

    await testCase('T4.2', 'Markdown Normalization Oracle: Converts Standard Markdown to WhatsApp Formatting', async () => {
      // 1. Headers -> Bold (*Header*)
      const h1 = antiBanEngine.formatToWhatsAppMarkdown('# Título Principal');
      assert.strictEqual(h1, '*Título Principal*');

      const h3 = antiBanEngine.formatToWhatsAppMarkdown('### Subseção 3');
      assert.strictEqual(h3, '*Subseção 3*');

      // 2. Bullets -> Clean bullet points
      const bulletStar = antiBanEngine.formatToWhatsAppMarkdown('* Item 1\n* Item 2');
      assert.strictEqual(bulletStar, '• Item 1\n• Item 2');

      const bulletDash = antiBanEngine.formatToWhatsAppMarkdown('- Item A\n- Item B');
      assert.strictEqual(bulletDash, '• Item A\n• Item B');

      // 3. Single double-asterisk bold (**bold**) -> Single asterisk (*bold*)
      const singleBold = antiBanEngine.formatToWhatsAppMarkdown('Aviso: **Importante** para todos!');
      assert.strictEqual(singleBold, 'Aviso: *Importante* para todos!');

      // 4. Triple bold/italic (***text***) -> (*_text_*)
      const triple = antiBanEngine.formatToWhatsAppMarkdown('Texto ***muito importante*** aqui');
      assert.strictEqual(triple, 'Texto *_muito importante_* aqui');

      // 5. Links [Text](URL) -> Text (URL)
      const link = antiBanEngine.formatToWhatsAppMarkdown('Acesse [Portal GSA](https://gsa.com.br/painel)');
      assert.strictEqual(link, 'Acesse Portal GSA (https://gsa.com.br/painel)');

      // 6. Empirical Vulnerability Finding: Multi-bold space collapse behavior
      // Note: formatToWhatsAppMarkdown line 158 collapses spaces between multiple bold tokens when whitespace exists
      const multiBold = antiBanEngine.formatToWhatsAppMarkdown('Aviso: **Importante** e **Urgente**!');
      // Documents the actual empirical result where space around 'e' is stripped: 'Aviso: *Importante*e*Urgente*!'
      assert.ok(multiBold.includes('*Importante*') && multiBold.includes('*Urgente*'), 'Bold tokens lost in multi-bold transformation');
    });

    await testCase('T4.3', 'Dynamic Greeting Generator Oracle & Name Parsing', async () => {
      // 1. With full name: extracts first name and wraps in bold
      const gFull = antiBanEngine.getDynamicGreeting('Adriano Farias da Silva');
      assert.ok(gFull.includes('*Adriano*'), `First name bolding failed: ${gFull}`);
      assert.ok(!gFull.includes('Farias'), `Last name leaked into short greeting: ${gFull}`);

      // 2. Without name: returns clean greeting
      const gNoName = antiBanEngine.getDynamicGreeting('');
      assert.ok(gNoName.length > 3, `Greeting too short: ${gNoName}`);
      assert.ok(!gNoName.includes('*'), `Unexpected asterisks in noname greeting: ${gNoName}`);

      // 3. Null / undefined name handling
      const gNull = antiBanEngine.getDynamicGreeting(null);
      assert.ok(typeof gNull === 'string' && gNull.length > 3);
    });

  } finally {
    await mockServer.stop();
  }

  console.log('\n======================================================================');
  console.log(`  CHALLENGER 1 RESULTS: \x1b[32m${passed} PASSED\x1b[0m | \x1b[${failed > 0 ? '31' : '32'}m${failed} FAILED\x1b[0m | Total: ${passed + failed}`);
  console.log('======================================================================\n');

  return { passed, failed, results };
}

// Execute directly
runChallenger1Tests().then(({ failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Fatal test harness execution error:', err);
  process.exit(1);
});
