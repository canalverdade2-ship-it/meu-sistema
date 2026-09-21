import http from 'http';
import assert from 'assert/strict';
import crypto from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

/**
 * ============================================================================
 * GSA OS — WHATSAPP ANTI-BAN SHIELD AUTOMATED MOCK TEST SUITE
 * ============================================================================
 * Tests all 7 dimensions of the WhatsApp Anti-Ban Shield:
 *  1. Spintax & Response Variation Engine (R3)
 *  2. Typing Delay Calculation & Scaling (R2)
 *  3. Queue Serialization & Randomized Delays (R1)
 *  4. Multi-User Concurrency & Queue Isolation (R1)
 *  5. Exponential Backoff Retry on HTTP 500 (R4)
 *  6. Permanent Failure Queue Unblocking (R4)
 *  7. Transactional & Media Integrity (PDF & PIX QR) (R5)
 * ============================================================================
 */

// Set environment variables before requiring the antiBanEngine
const MOCK_PORT = Number(process.env.MOCK_EVOLUTION_PORT || 8085);
process.env.EVOLUTION_API_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.EVOLUTION_API_KEY = 'gsa_test_evolution_token_2026';
process.env.EVOLUTION_INSTANCE = 'GSA_WhatsApp';

// Read TIME_SCALE for delay scaling (e.g., TIME_SCALE=0.1 for 10x faster execution)
const TIME_SCALE = Math.max(0.001, Number(process.env.TIME_SCALE || 1.0));
process.env.TIME_SCALE = String(TIME_SCALE);

const antiBanEngine = require('./lib/antiBanEngine.cjs');

// ─── EMBEDDED MOCK EVOLUTION API SERVER ─────────────────────────────────────
class MockEvolutionServer {
  constructor(port = MOCK_PORT) {
    this.port = port;
    this.server = null;
    this.requests = [];
    this.faultRules = new Map(); // endpoint -> { failCount, statusCode }
    this.customHandlers = new Map(); // endpoint -> handler(req, body, res)
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
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

          // Check custom handlers
          if (this.customHandlers.has(req.url)) {
            const handler = this.customHandlers.get(req.url);
            return handler(req, body, res);
          }

          // Check fault injection rules
          const rule = this.faultRules.get(req.url);
          if (rule && rule.failCount > 0) {
            rule.failCount--;
            res.writeHead(rule.statusCode || 500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Injected Error', status: rule.statusCode || 500 }));
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'SUCCESS',
            message: 'OK',
            key: { id: 'MOCK_EVO_' + Date.now(), remoteJid: `${body.number}@s.whatsapp.net` }
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
    this.faultRules.clear();
    this.customHandlers.clear();
  }

  failNext(endpoint, failCount, statusCode = 500) {
    this.faultRules.set(endpoint, { failCount, statusCode });
  }

  onEndpoint(endpoint, handler) {
    this.customHandlers.set(endpoint, handler);
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
    antiBanEngine.clearAllQueues();
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
    // ────────────────────────────────────────────────────────────────────────
    // TEST 1: R3 - Spintax Engine & Response Variation
    // ────────────────────────────────────────────────────────────────────────
    await test('R3: Spintax Engine, Nested Resolution & Template Variable Preservation', async () => {
      // 1. Simple Spintax distribution
      const simpleTemplate = '{Olá|Oi|E aí}, tudo bem?';
      const counts = { 'Olá': 0, 'Oi': 0, 'E aí': 0 };
      for (let i = 0; i < 300; i++) {
        const parsed = antiBanEngine.parseSpintax(simpleTemplate);
        assert.ok(!parsed.includes('{') && !parsed.includes('}') && !parsed.includes('|'), `Unparsed tokens in: ${parsed}`);
        if (parsed.startsWith('Olá')) counts['Olá']++;
        else if (parsed.startsWith('Oi')) counts['Oi']++;
        else if (parsed.startsWith('E aí')) counts['E aí']++;
        else assert.fail(`Unexpected output: ${parsed}`);
      }

      // Assert all 3 variations were selected (each >= 15% of the 300 samples)
      assert.ok(counts['Olá'] >= 45, `Distribution too low for Olá: ${counts['Olá']}`);
      assert.ok(counts['Oi'] >= 45, `Distribution too low for Oi: ${counts['Oi']}`);
      assert.ok(counts['E aí'] >= 45, `Distribution too low for E aí: ${counts['E aí']}`);

      // 2. Nested Spintax
      const nestedTemplate = '{{Bom dia|Boa tarde}|Olá}, {cliente|amigo}! {Como vai?|Tudo bem?}';
      for (let i = 0; i < 100; i++) {
        const parsed = antiBanEngine.parseSpintax(nestedTemplate);
        assert.ok(!parsed.includes('{') && !parsed.includes('}') && !parsed.includes('|'), `Unparsed nested tokens in: ${parsed}`);
        assert.ok(parsed.length > 10, `Parsed output too short: ${parsed}`);
      }

      // 3. Template variable preservation (variables without pipes should NOT be corrupted)
      const variableTemplate = '{Olá|Oi} {nome}, seu pedido #{numero} no valor de R$ {valor} foi aprovado!';
      for (let i = 0; i < 50; i++) {
        const parsed = antiBanEngine.parseSpintax(variableTemplate);
        assert.ok(parsed.includes('{nome}'), `Variable {nome} was corrupted: ${parsed}`);
        assert.ok(parsed.includes('{numero}'), `Variable {numero} was corrupted: ${parsed}`);
        assert.ok(parsed.includes('{valor}'), `Variable {valor} was corrupted: ${parsed}`);
        assert.ok(parsed.startsWith('Olá ') || parsed.startsWith('Oi '), `Spintax failed to resolve prefix: ${parsed}`);
      }

      // 4. Dynamic greeting generator
      const greetings = new Set();
      for (let i = 0; i < 100; i++) {
        const g = antiBanEngine.getDynamicGreeting('Adriano Farias');
        assert.ok(g.includes('*Adriano*'), `Greeting did not format name: ${g}`);
        greetings.add(g);
      }
      // Must generate multiple distinct greeting variations
      assert.ok(greetings.size >= 2, `Expected greeting variety, but got only ${greetings.size} variations`);
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 2: R2 - Typing Delay Calculation & Scaling
    // ────────────────────────────────────────────────────────────────────────
    await test('R2: Typing Delay Calculation Scales Proportional to Length & Type', async () => {
      const config = antiBanEngine.getConfig();

      // Short text (10 chars): close to minTypingDelay
      const shortDelay = antiBanEngine.calculateTypingDelay('1234567890', 'text', config);
      assert.ok(shortDelay >= config.minTypingDelay, `Short delay below minimum: ${shortDelay}`);
      assert.ok(shortDelay <= config.minTypingDelay + 1000, `Short delay excessive: ${shortDelay}`);

      // Long text (300 chars): scaled significantly higher
      const longDelay = antiBanEngine.calculateTypingDelay('A'.repeat(300), 'text', config);
      assert.ok(longDelay >= 6000, `Long text delay too low: ${longDelay}`);
      assert.ok(longDelay <= config.maxTypingDelay, `Long text delay exceeded clamp: ${longDelay}`);

      // Very long text (1000 chars): clamped strictly at maxTypingDelay (8000ms)
      const clampedDelay = antiBanEngine.calculateTypingDelay('A'.repeat(1000), 'text', config);
      assert.strictEqual(clampedDelay, config.maxTypingDelay, `Typing delay not clamped at maximum: ${clampedDelay}`);

      // Audio payload: recording presence duration
      const audioDelay = antiBanEngine.calculateTypingDelay('', 'audio', config);
      assert.ok(audioDelay >= 2500 && audioDelay <= 5000, `Audio recording delay out of bounds: ${audioDelay}`);
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 3: R1 & R2 - Queue Serialization & Randomized Delays (3 Rapid Messages)
    // ────────────────────────────────────────────────────────────────────────
    await test('R1 & R2: Queue Serialization & Randomized Inter-Message Delays (3 Rapid Messages)', async (mock) => {
      const phone = '5511999990001';
      const msg1 = 'Mensagem 1: Notificação de Pedido #101';
      const msg2 = 'Mensagem 2: Chave PIX Copia e Cola';
      const msg3 = 'Mensagem 3: Como avalia nosso atendimento de 1 a 5?';

      // Dispatch 3 messages nearly simultaneously (0ms interval between calls)
      const p1 = antiBanEngine.sendWhatsAppReply(phone, msg1);
      const p2 = antiBanEngine.sendWhatsAppReply(phone, msg2);
      const p3 = antiBanEngine.sendWhatsAppReply(phone, msg3);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      assert.ok(r1.success, 'Message 1 failed');
      assert.ok(r2.success, 'Message 2 failed');
      assert.ok(r3.success, 'Message 3 failed');

      const requests = mock.getByPhone(phone);
      assert.ok(requests.length >= 6, `Expected at least 6 requests, got ${requests.length}`);

      // Verify sequence order
      const sendTextReqs = requests.filter(r => r.url.includes('/message/sendText/'));
      assert.strictEqual(sendTextReqs.length, 3, 'Expected exactly 3 sendText requests');

      assert.ok(sendTextReqs[0].body.text.includes('Mensagem 1'), 'First sent text was not msg1');
      assert.ok(sendTextReqs[1].body.text.includes('Mensagem 2'), 'Second sent text was not msg2');
      assert.ok(sendTextReqs[2].body.text.includes('Mensagem 3'), 'Third sent text was not msg3');

      // Verify presence preceded each sendText
      const presenceReqs = requests.filter(r => r.url.includes('/chat/sendPresence/'));
      assert.ok(presenceReqs.length >= 3, 'Expected presence before each message');
      assert.strictEqual(presenceReqs[0].body.presence, 'composing');

      // Verify presence 1 arrived BEFORE sendText 1
      assert.ok(presenceReqs[0].time <= sendTextReqs[0].time, 'Presence 1 did not arrive before sendText 1');
      // Verify sendText 1 arrived BEFORE sendText 2
      assert.ok(sendTextReqs[0].time < sendTextReqs[1].time, 'sendText 1 did not arrive before sendText 2');
      // Verify sendText 2 arrived BEFORE sendText 3
      assert.ok(sendTextReqs[1].time < sendTextReqs[2].time, 'sendText 2 did not arrive before sendText 3');

      // Verify inter-message delay elapsed between message 1 and message 2
      const deltaT1_T2 = sendTextReqs[1].time - sendTextReqs[0].time;
      const expectedMinDelta = (2000 + 1500) * TIME_SCALE * 0.85; // 2s min interval + 1.5s typing delay with tolerance
      assert.ok(deltaT1_T2 >= expectedMinDelta, `Inter-message delta ${deltaT1_T2}ms was smaller than expected ${expectedMinDelta}ms`);
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 4: R1 - Multi-User Concurrency & Queue Isolation
    // ────────────────────────────────────────────────────────────────────────
    await test('R1: Multi-User Concurrency (Non-blocking Queues across Users)', async (mock) => {
      const userA = '5511999990001';
      const userB = '5511999990002';

      // User A gets 2 messages
      const pA1 = antiBanEngine.sendWhatsAppReply(userA, 'Mensagem 1 para Usuario A');
      const pA2 = antiBanEngine.sendWhatsAppReply(userA, 'Mensagem 2 para Usuario A');

      // User B gets 1 short message at the same time
      const pB = antiBanEngine.sendWhatsAppReply(userB, 'Mensagem unica para Usuario B');

      // Await all
      await Promise.all([pA1, pA2, pB]);

      const reqsA = mock.getByPhone(userA).filter(r => r.url.includes('/message/sendText/'));
      const reqsB = mock.getByPhone(userB).filter(r => r.url.includes('/message/sendText/'));

      assert.strictEqual(reqsA.length, 2, 'User A should have 2 sent messages');
      assert.strictEqual(reqsB.length, 1, 'User B should have 1 sent message');

      // User B's message should complete BEFORE User A's second message
      assert.ok(
        reqsB[0].time < reqsA[1].time,
        `User B was blocked by User A: User B at ${reqsB[0].time}ms vs User A2 at ${reqsA[1].time}ms`
      );
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 5: R4 - Exponential Backoff Retry on HTTP 500 (Recovers on Attempt 3)
    // ────────────────────────────────────────────────────────────────────────
    await test('R4: Exponential Backoff Retry (500 Error recovery on 3rd attempt)', async (mock) => {
      const phone = '5511999990003';
      const sendTextEndpoint = '/message/sendText/GSA_WhatsApp';

      // Mock server returns 500 for the first 2 attempts, then 200 on attempt 3
      mock.failNext(sendTextEndpoint, 2, 500);

      const res = await antiBanEngine.sendWhatsAppReply(phone, 'Mensagem com retry');

      assert.ok(res.success, `Expected message to succeed on attempt 3, but failed: ${JSON.stringify(res)}`);

      const reqs = mock.getByPhone(phone).filter(r => r.url.includes('/message/sendText/'));
      assert.strictEqual(reqs.length, 3, `Expected exactly 3 dispatch attempts, got ${reqs.length}`);

      // Verify exponential backoff intervals between attempts
      const deltaAttempt1To2 = reqs[1].time - reqs[0].time;
      const deltaAttempt2To3 = reqs[2].time - reqs[1].time;

      const minExpected1 = 1000 * TIME_SCALE * 0.8;
      const minExpected2 = 2000 * TIME_SCALE * 0.8;

      assert.ok(deltaAttempt1To2 >= minExpected1, `Attempt 1->2 backoff too short: ${deltaAttempt1To2}ms < ${minExpected1}ms`);
      assert.ok(deltaAttempt2To3 >= minExpected2, `Attempt 2->3 backoff too short: ${deltaAttempt2To3}ms < ${minExpected2}ms`);
      assert.ok(deltaAttempt2To3 >= deltaAttempt1To2, `Backoff was not progressive: attempt 2 (${deltaAttempt2To3}ms) <= attempt 1 (${deltaAttempt1To2}ms)`);
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 6: R4 - Permanent Failure Handling Unblocks Queue
    // ────────────────────────────────────────────────────────────────────────
    await test('R4: Permanent Failure Unblocks Queue without Process Crash', async (mock) => {
      const phone = '5511999990004';
      const sendTextEndpoint = '/message/sendText/GSA_WhatsApp';

      // Mock server returns 500 continuously for 10 attempts
      mock.failNext(sendTextEndpoint, 10, 500);

      // Send failing message
      const resFail = await antiBanEngine.sendWhatsAppReply(phone, 'Mensagem que vai falhar');
      assert.strictEqual(resFail.success, false, 'Expected message to fail when all retries fail');

      // Now clear fault rules and send a follow-up message to the same phone
      mock.clear();

      const resSuccess = await antiBanEngine.sendWhatsAppReply(phone, 'Mensagem de recuperacao');
      assert.ok(resSuccess.success, 'Queue remained jammed after permanent failure');

      const recoveryReqs = mock.getByPhone(phone).filter(r => r.url.includes('/message/sendText/'));
      assert.ok(recoveryReqs.length >= 1, 'Recovery message was not dispatched');
      assert.ok(recoveryReqs[0].body.text.includes('recuperacao'), 'Recovery message text mismatch');
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 7: R5 - Transactional & Media Integrity (PDF Boleto & PIX QR Image)
    // ────────────────────────────────────────────────────────────────────────
    await test('R5: Transactional & Media Integrity (PDF Boleto & QR Code)', async (mock) => {
      const phone = '5511999990005';

      // 1. Test PDF Document transmission
      const mockPdfBuffer = Buffer.from('%PDF-1.4 simulated binary boleto content for GSA OS invoices ' + 'A'.repeat(5000));
      const originalPdfBase64 = mockPdfBuffer.toString('base64');
      const originalPdfHash = crypto.createHash('sha256').update(originalPdfBase64).digest('hex');

      const resPdf = await antiBanEngine.sendWhatsAppMedia(
        phone,
        `data:application/pdf;base64,${originalPdfBase64}`,
        'fatura_gsa_9821.pdf',
        'Segue sua fatura em anexo.',
        'document'
      );

      assert.ok(resPdf.success, `PDF send failed: ${JSON.stringify(resPdf)}`);

      // 2. Test PIX QR Image transmission
      const mockImageBase64 = Buffer.from('mock_png_image_binary_data_' + 'B'.repeat(2000)).toString('base64');
      const resImg = await antiBanEngine.sendWhatsAppMedia(
        phone,
        `data:image/png;base64,${mockImageBase64}`,
        'pix_qr_code.png',
        'Pague via PIX com o QR Code acima.',
        'image'
      );

      assert.ok(resImg.success, `Image send failed: ${JSON.stringify(resImg)}`);

      const mediaReqs = mock.getByPhone(phone).filter(r => r.url.includes('/message/sendMedia/'));
      assert.strictEqual(mediaReqs.length, 2, 'Expected exactly 2 media requests');

      // Verify PDF payload integrity
      const pdfPayload = mediaReqs[0].body;
      assert.strictEqual(pdfPayload.mediatype, 'document');
      assert.strictEqual(pdfPayload.mimetype, 'application/pdf');
      assert.strictEqual(pdfPayload.fileName, 'fatura_gsa_9821.pdf');
      const receivedPdfHash = crypto.createHash('sha256').update(pdfPayload.media).digest('hex');
      assert.strictEqual(receivedPdfHash, originalPdfHash, 'PDF base64 payload corrupted in transit!');

      // Verify Image payload integrity
      const imgPayload = mediaReqs[1].body;
      assert.strictEqual(imgPayload.mediatype, 'image');
      assert.strictEqual(imgPayload.mimetype, 'image/png');
      assert.strictEqual(imgPayload.fileName, 'pix_qr_code.png');

      // 3. Verify queue stats & memory management
      const stats = antiBanEngine.getQueueStats();
      assert.strictEqual(stats.totalPending, 0, `Expected 0 pending items, found ${stats.totalPending}`);
    });

  } finally {
    await mockServer.stop();
  }

  console.log('\n======================================================================');
  console.log(`  TEST RESULTS: \x1b[32m${passed} PASSED\x1b[0m | \x1b[${failed > 0 ? '31' : '32'}m${failed} FAILED\x1b[0m | Total: ${passed + failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run when executed directly via Node
const isDirectlyExecuted = process.argv[1] && (
  process.argv[1].endsWith('test_antiban_queue.js') ||
  process.argv[1] === fileURLToPath(import.meta.url)
);

if (isDirectlyExecuted) {
  runAllTests().catch(err => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
}

export { MockEvolutionServer, runAllTests };
