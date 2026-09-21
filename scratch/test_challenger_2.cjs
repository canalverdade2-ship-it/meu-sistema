'use strict';

/**
 * ============================================================================
 * GSA OS — WHATSAPP ANTI-BAN SHIELD: CHALLENGER 2 EMPIRICAL STRESS TEST HARNESS
 * ============================================================================
 * Focus Areas:
 *  1. Presence duration scaling accuracy & clamp bounds [1500ms, 8000ms]
 *     (Short, Medium, Long, Extreme, Audio, Document)
 *  2. Large payload preservation (1MB+ Base64 PDF invoice buffers)
 *     (Byte-for-byte SHA-256 / MD5 / Binary Buffer validation)
 *  3. Memory leak & Queue cleanup (Idle queue eviction lifecycle & 100-contact churn)
 *  4. Adversarial stress & Boundary conditions (Queue overflow, Fast-fail 4xx, 429 retry)
 * ============================================================================
 */

const http = require('http');
const assert = require('assert/strict');
const crypto = require('crypto');

const MOCK_PORT = Number(process.env.MOCK_EVOLUTION_PORT || 8092);
const TIME_SCALE = Math.max(0.001, Number(process.env.TIME_SCALE || 0.1));

process.env.EVOLUTION_API_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.EVOLUTION_API_KEY = 'gsa_challenger_2_token';
process.env.EVOLUTION_INSTANCE = 'GSA_WhatsApp';
process.env.TIME_SCALE = String(TIME_SCALE);

const antiBanEngine = require('../lib/antiBanEngine.cjs');

// ─── HIGH-PRECISION MOCK EVOLUTION SERVER ───────────────────────────────────
class ChallengerMockServer {
  constructor(port = MOCK_PORT) {
    this.port = port;
    this.server = null;
    this.requests = [];
    this.faultRules = new Map();
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const arrivalHrTime = process.hrtime.bigint();
        const arrivalTime = Date.now();
        const chunks = [];

        req.on('data', chunk => { chunks.push(chunk); });
        req.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const rawString = rawBuffer.toString('utf8');
          let body = {};
          try {
            body = JSON.parse(rawString);
          } catch (_) {
            body = { raw: rawString };
          }

          const record = {
            id: this.requests.length + 1,
            time: arrivalTime,
            hrtime: arrivalHrTime,
            method: req.method,
            url: req.url,
            headers: req.headers,
            body,
            rawBuffer
          };
          this.requests.push(record);

          // Check fault injection rules
          const rule = this.faultRules.get(req.url);
          if (rule && rule.failCount > 0) {
            rule.failCount--;
            res.writeHead(rule.statusCode || 500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Injected Fault', status: rule.statusCode || 500 }));
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'SUCCESS',
            message: 'OK',
            key: { id: `EVO_CHALLENGER_${Date.now()}`, remoteJid: `${body.number || 'unknown'}@s.whatsapp.net` }
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
  }

  failNext(endpoint, failCount, statusCode = 500) {
    this.faultRules.set(endpoint, { failCount, statusCode });
  }

  getByPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    return this.requests.filter(r => r.body && r.body.number && r.body.number.replace(/\D/g, '') === clean);
  }
}

// ─── TEST HARNESS ───────────────────────────────────────────────────────────
async function runChallenger2TestSuite() {
  console.log('======================================================================');
  console.log('  CHALLENGER 2: EMPIRICAL STRESS TEST SUITE (WhatsApp Anti-Ban Shield)');
  console.log(`  Port: ${MOCK_PORT} | TimeScale: ${TIME_SCALE}x | Target: lib/antiBanEngine.cjs`);
  console.log('======================================================================\n');

  const mock = new ChallengerMockServer(MOCK_PORT);
  await mock.start();

  let passedCount = 0;
  let failedCount = 0;
  const results = [];

  async function runTest(testName, testFn) {
    mock.clear();
    antiBanEngine.clearAllQueues();
    const t0 = Date.now();
    process.stdout.write(`  ▶ Running: ${testName}... `);
    try {
      await testFn(mock);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      console.log(`\x1b[32m[PASS]\x1b[0m (${elapsed}s)`);
      passedCount++;
      results.push({ name: testName, status: 'PASS', elapsed: `${elapsed}s` });
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      console.log(`\x1b[31m[FAIL]\x1b[0m (${elapsed}s)`);
      console.error('    ❌ Assertion Error:', err.message);
      if (err.stack) console.error('    ' + err.stack.split('\n').slice(1, 4).join('\n    '));
      failedCount++;
      results.push({ name: testName, status: 'FAIL', elapsed: `${elapsed}s`, error: err.message });
    }
  }

  try {
    // ────────────────────────────────────────────────────────────────────────
    // 1. PRESENCE DURATION SCALING ACCURACY & CLAMP BOUNDS
    // ────────────────────────────────────────────────────────────────────────
    await runTest('1.1: Math Clamp Bounds & Character Scaling Verification', async () => {
      const config = antiBanEngine.getConfig();

      // Test short text (10 chars): base 1500 + 10*35 + [0..500] = 1850..2350
      for (let i = 0; i < 50; i++) {
        const delay = antiBanEngine.calculateTypingDelay('1234567890', 'text', config);
        assert.ok(delay >= 1850, `Short delay ${delay}ms below formula minimum 1850ms`);
        assert.ok(delay <= 2350, `Short delay ${delay}ms above formula maximum 2350ms`);
      }

      // Test medium text (100 chars): base 1500 + 100*35 + [0..500] = 5000..5500
      for (let i = 0; i < 50; i++) {
        const delay = antiBanEngine.calculateTypingDelay('X'.repeat(100), 'text', config);
        assert.ok(delay >= 5000, `Medium delay ${delay}ms below formula minimum 5000ms`);
        assert.ok(delay <= 5500, `Medium delay ${delay}ms above formula maximum 5500ms`);
      }

      // Test long text (500 chars): base 1500 + 500*35 = 19000 -> CLAMPED TO 8000
      for (let i = 0; i < 50; i++) {
        const delay = antiBanEngine.calculateTypingDelay('Y'.repeat(500), 'text', config);
        assert.strictEqual(delay, 8000, `Long delay ${delay}ms was not strictly clamped at maxTypingDelay 8000ms`);
      }

      // Test extreme text (2000 chars): CLAMPED TO 8000
      const extremeDelay = antiBanEngine.calculateTypingDelay('Z'.repeat(2000), 'text', config);
      assert.strictEqual(extremeDelay, 8000, `Extreme delay ${extremeDelay}ms exceeded max clamp`);

      // Test empty text (0 chars): base 1500 + 0 + [0..500] = 1500..2000
      for (let i = 0; i < 50; i++) {
        const emptyDelay = antiBanEngine.calculateTypingDelay('', 'text', config);
        assert.ok(emptyDelay >= 1500, `Empty text delay ${emptyDelay}ms below minimum clamp 1500ms`);
        assert.ok(emptyDelay <= 2000, `Empty text delay ${emptyDelay}ms above 2000ms`);
      }

      // Test audio presence duration bounds: [2500, 5000]
      for (let i = 0; i < 50; i++) {
        const audioDelay = antiBanEngine.calculateTypingDelay('', 'audio', config);
        assert.ok(audioDelay >= 2500 && audioDelay <= 5000, `Audio delay ${audioDelay}ms out of [2500, 5000]`);
      }

      // Test document/image presence duration bounds: [2000, 8000]
      for (let i = 0; i < 50; i++) {
        const docDelay = antiBanEngine.calculateTypingDelay('Relatorio Anual', 'document', config);
        assert.ok(docDelay >= 2000 && docDelay <= 8000, `Document delay ${docDelay}ms out of bounds`);
      }
    });

    await runTest('1.2: Wall-Clock Presence-to-Dispatch Interval Measurement Across Text Lengths', async (m) => {
      // Test actual wall-clock elapsed time between presence emission and message delivery
      const phoneShort = '5511988880001';
      const phoneMedium = '5511988880002';
      const phoneLong = '5511988880003';

      const textShort = '1234567890'; // 10 chars -> ~1850-2350ms
      const textMedium = 'M'.repeat(100); // 100 chars -> ~5000-5500ms
      const textLong = 'L'.repeat(500); // 500 chars -> clamped 8000ms

      // Dispatch 3 isolated contacts
      await antiBanEngine.sendWhatsAppReply(phoneShort, textShort);
      await antiBanEngine.sendWhatsAppReply(phoneMedium, textMedium);
      await antiBanEngine.sendWhatsAppReply(phoneLong, textLong);

      function getPresenceToDispatchDelta(phone) {
        const reqs = m.getByPhone(phone);
        const presenceReq = reqs.find(r => r.url.includes('/chat/sendPresence/'));
        const sendReq = reqs.find(r => r.url.includes('/message/sendText/'));
        assert.ok(presenceReq, `No presence request recorded for ${phone}`);
        assert.ok(sendReq, `No sendText request recorded for ${phone}`);
        assert.strictEqual(presenceReq.body.presence, 'composing');

        // High precision nanosecond delta converted to milliseconds
        const deltaMs = Number(sendReq.hrtime - presenceReq.hrtime) / 1e6;
        return deltaMs;
      }

      const deltaShort = getPresenceToDispatchDelta(phoneShort);
      const deltaMedium = getPresenceToDispatchDelta(phoneMedium);
      const deltaLong = getPresenceToDispatchDelta(phoneLong);

      const tolerance = 0.75; // Allow 25% lower bound tolerance for event loop / tick variations

      const minExpectedShort = 1850 * TIME_SCALE * tolerance;
      const minExpectedMedium = 5000 * TIME_SCALE * tolerance;
      const minExpectedLong = 8000 * TIME_SCALE * tolerance;

      console.log(`\n      [Timing Stats] Short: ${deltaShort.toFixed(1)}ms (expected >= ${minExpectedShort.toFixed(1)}ms)`);
      console.log(`      [Timing Stats] Medium: ${deltaMedium.toFixed(1)}ms (expected >= ${minExpectedMedium.toFixed(1)}ms)`);
      console.log(`      [Timing Stats] Long: ${deltaLong.toFixed(1)}ms (expected >= ${minExpectedLong.toFixed(1)}ms)`);

      assert.ok(deltaShort >= minExpectedShort, `Short delta ${deltaShort}ms below minimum expected ${minExpectedShort}ms`);
      assert.ok(deltaMedium >= minExpectedMedium, `Medium delta ${deltaMedium}ms below minimum expected ${minExpectedMedium}ms`);
      assert.ok(deltaLong >= minExpectedLong, `Long delta ${deltaLong}ms below minimum expected ${minExpectedLong}ms`);

      // Scaling assertion: Short < Medium < Long
      assert.ok(deltaShort < deltaMedium, `Short delta (${deltaShort}ms) was not strictly less than Medium delta (${deltaMedium}ms)`);
      assert.ok(deltaMedium < deltaLong, `Medium delta (${deltaMedium}ms) was not strictly less than Long delta (${deltaLong}ms)`);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 2. LARGE PAYLOAD PRESERVATION (1MB+ BASE64 PDF INVOICES)
    // ────────────────────────────────────────────────────────────────────────
    await runTest('2.1: 1.5MB Synthetic PDF Boleto Binary & Base64 Byte-for-Byte Preservation', async (m) => {
      const phone = '5511977770001';

      // Construct realistic 1.5MB PDF structure with pseudo-random non-compressible binary data
      const pdfHeader = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
      const randomBody = crypto.randomBytes(1500000); // 1.5 MB random binary payload
      const pdfFooter = Buffer.from('\nxref\n0 3\n0000000000 65535 f \n0000000015 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n%%EOF\n');
      const originalBinaryBuffer = Buffer.concat([pdfHeader, randomBody, pdfFooter]);

      const originalBase64 = originalBinaryBuffer.toString('base64');
      const originalSha256 = crypto.createHash('sha256').update(originalBase64).digest('hex');
      const originalMd5 = crypto.createHash('md5').update(originalBase64).digest('hex');
      const originalBinarySha256 = crypto.createHash('sha256').update(originalBinaryBuffer).digest('hex');

      console.log(`\n      [Payload Stats] Original Size: ${originalBinaryBuffer.length} bytes | Base64 Length: ${originalBase64.length} chars`);
      console.log(`      [Payload Stats] Base64 SHA256: ${originalSha256}`);

      // Transmit with data URI prefix
      const dataUri = `data:application/pdf;base64,${originalBase64}`;
      const fileName = 'fatura_gsa_grande_15mb.pdf';
      const caption = 'Segue sua fatura de prestação de serviços - GSA OS';

      const sendResult = await antiBanEngine.sendWhatsAppMedia(
        phone,
        dataUri,
        fileName,
        caption,
        'document'
      );

      assert.ok(sendResult.success, `Media send failed: ${JSON.stringify(sendResult)}`);

      // Verify request received at mock server
      const reqs = m.getByPhone(phone).filter(r => r.url.includes('/message/sendMedia/'));
      assert.strictEqual(reqs.length, 1, 'Expected exactly 1 sendMedia request');

      const receivedPayload = reqs[0].body;
      assert.strictEqual(receivedPayload.mediatype, 'document');
      assert.strictEqual(receivedPayload.mimetype, 'application/pdf');
      assert.strictEqual(receivedPayload.fileName, fileName);
      assert.strictEqual(receivedPayload.caption, caption);

      // Verify Base64 string exact match
      assert.strictEqual(receivedPayload.media.length, originalBase64.length, 'Received Base64 length differs from original');
      const receivedSha256 = crypto.createHash('sha256').update(receivedPayload.media).digest('hex');
      const receivedMd5 = crypto.createHash('md5').update(receivedPayload.media).digest('hex');

      assert.strictEqual(receivedSha256, originalSha256, 'SHA-256 checksum mismatch on Base64 payload!');
      assert.strictEqual(receivedMd5, originalMd5, 'MD5 checksum mismatch on Base64 payload!');

      // Decode received Base64 back to binary and verify binary integrity
      const receivedBinaryBuffer = Buffer.from(receivedPayload.media, 'base64');
      assert.strictEqual(receivedBinaryBuffer.length, originalBinaryBuffer.length, 'Decoded binary length mismatch');
      const receivedBinarySha256 = crypto.createHash('sha256').update(receivedBinaryBuffer).digest('hex');
      assert.strictEqual(receivedBinarySha256, originalBinarySha256, 'Decoded binary SHA-256 mismatch!');
      assert.ok(receivedBinaryBuffer.equals(originalBinaryBuffer), 'Decoded buffer not byte-for-byte equal to original buffer');
    });

    await runTest('2.2: 2.0MB Raw Base64 Image/Document Object Payload Signature', async (m) => {
      const phone = '5511977770002';
      const rawBinary = crypto.randomBytes(2000000); // 2.0 MB
      const rawBase64 = rawBinary.toString('base64');
      const rawSha256 = crypto.createHash('sha256').update(rawBase64).digest('hex');

      // Test object signature enqueueMessage with media type
      const res = await antiBanEngine.enqueueMessage({
        to: phone,
        type: 'media',
        payload: {
          media: rawBase64,
          fileName: 'comprovante_pix_2mb.png',
          caption: 'Comprovante oficial de transferência PIX',
          mediaType: 'image',
          mimetype: 'image/png'
        }
      });

      assert.ok(res.success, `Object signature enqueueMessage failed: ${JSON.stringify(res)}`);

      const reqs = m.getByPhone(phone).filter(r => r.url.includes('/message/sendMedia/'));
      assert.strictEqual(reqs.length, 1, 'Expected 1 sendMedia request');
      const body = reqs[0].body;

      assert.strictEqual(body.fileName, 'comprovante_pix_2mb.png');
      assert.strictEqual(body.mimetype, 'image/png');
      const receivedSha = crypto.createHash('sha256').update(body.media).digest('hex');
      assert.strictEqual(receivedSha, rawSha256, '2MB raw image corrupted in transit');
    });

    // ────────────────────────────────────────────────────────────────────────
    // 3. MEMORY LEAK & IDLE QUEUE CLEANUP LIFECYCLE
    // ────────────────────────────────────────────────────────────────────────
    await runTest('3.1: Single Contact Queue Idle Eviction Lifecycle', async () => {
      const phone = '5511966660001';
      const cleanPhone = antiBanEngine.normalizeRecipient(phone);

      const statsInitial = antiBanEngine.getQueueStats();
      const initialQueues = statsInitial.totalQueues;

      // 1. Enqueue message
      const sendPromise = antiBanEngine.sendWhatsAppReply(phone, 'Mensagem para teste de limpeza');
      
      // 2. While processing, queue must exist in active map
      const activeQueuesDuring = antiBanEngine.queueManager.getActiveQueues();
      assert.ok(activeQueuesDuring.has(cleanPhone), `Queue ${cleanPhone} missing from active map during dispatch`);

      await sendPromise;

      // 3. Immediately after completion, queue is idle but within timeout window
      assert.ok(activeQueuesDuring.has(cleanPhone), 'Queue was prematurely removed before idle timeout');

      // 4. Wait for idle timeout (idleQueueTimeoutMs=30000ms * TIME_SCALE=0.1 = 3000ms; add 500ms safety)
      const waitTime = Math.max(200, Math.round(30000 * TIME_SCALE)) + 600;
      console.log(`\n      [Cleanup] Waiting ${waitTime}ms for idle timer eviction...`);
      await new Promise(r => setTimeout(r, waitTime));

      // 5. Assert queue has been evicted
      const activeQueuesAfter = antiBanEngine.queueManager.getActiveQueues();
      assert.ok(!activeQueuesAfter.has(cleanPhone), `Queue ${cleanPhone} was NOT evicted after idle timeout`);
      assert.strictEqual(antiBanEngine.getQueueStats().totalPending, 0, 'Pending count not zero');
    });

    await runTest('3.2: High Contact Churn Memory Leak Stress (50 Concurrent Ephemeral Contacts)', async () => {
      const contactCount = 50;
      const promises = [];

      console.log(`\n      [Churn Stress] Dispatching messages to ${contactCount} distinct ephemeral contacts...`);
      for (let i = 1; i <= contactCount; i++) {
        const phone = `551195555${String(i).padStart(4, '0')}`;
        promises.push(antiBanEngine.sendWhatsAppReply(phone, `Mensagem de contato ${i}`));
      }

      // All 50 messages should complete concurrently
      const results = await Promise.all(promises);
      for (const res of results) {
        assert.ok(res.success, 'One of the churn messages failed');
      }

      // During active window, all 50 queues should exist
      const statsPeak = antiBanEngine.getQueueStats();
      assert.strictEqual(statsPeak.totalQueues, contactCount, `Expected ${contactCount} active queues, got ${statsPeak.totalQueues}`);

      // Wait for idle eviction window
      const waitTime = Math.max(200, Math.round(30000 * TIME_SCALE)) + 800;
      console.log(`      [Churn Stress] Waiting ${waitTime}ms for bulk idle timeout eviction...`);
      await new Promise(r => setTimeout(r, waitTime));

      // After idle eviction, ALL 50 queues must be deleted from memory
      const statsFinal = antiBanEngine.getQueueStats();
      console.log(`      [Churn Stats] Final Total Queues in Memory: ${statsFinal.totalQueues} (Expected: 0)`);
      assert.strictEqual(statsFinal.totalQueues, 0, `Memory leak: ${statsFinal.totalQueues} queues remained in Map after idle timeout`);
      assert.strictEqual(statsFinal.activeContacts, 0, `Active contacts not zero: ${statsFinal.activeContacts}`);
      assert.strictEqual(antiBanEngine.queueManager.getActiveQueues().size, 0, 'Internal Map is not empty');
    });

    // ────────────────────────────────────────────────────────────────────────
    // 4. ADVERSARIAL STRESS & BOUNDARY CONDITIONS
    // ────────────────────────────────────────────────────────────────────────
    await runTest('4.1: Per-Contact Queue Overflow / Backpressure Rejection (Depth > 50)', async () => {
      const phone = '5511944440001';
      antiBanEngine.clearAllQueues();

      // We flood 55 messages to the same contact queue simultaneously
      const promises = [];
      for (let i = 1; i <= 55; i++) {
        // We use low-level enqueueMessage to observe resolution/rejection directly
        promises.push(
          antiBanEngine.enqueueMessage({
            to: phone,
            type: 'text',
            payload: { text: `Mensagem de flood ${i}` },
            options: { minInterval: 10, maxInterval: 20 }
          }).then(res => ({ idx: i, success: true, res })).catch(err => ({ idx: i, success: false, err: err.message }))
        );
      }

      const results = await Promise.all(promises);

      const accepted = results.filter(r => r.success);
      const rejected = results.filter(r => !r.success);

      console.log(`\n      [Overflow Stats] Accepted: ${accepted.length} | Rejected by Backpressure: ${rejected.length}`);
      assert.ok(rejected.length >= 4, `Expected at least 4-5 overflow rejections, got ${rejected.length}`);
      assert.ok(rejected[0].err.includes('exceeded max depth'), `Unexpected rejection error message: ${rejected[0].err}`);

      // Verify that all accepted messages were delivered safely without corruption
      for (const acc of accepted) {
        assert.ok(acc.res.success, `Accepted message ${acc.idx} failed to deliver`);
      }
    });

    await runTest('4.2: Fast-Fail on Non-Retryable 4xx Client Errors (400, 401, 404)', async (m) => {
      const phone = '5511933330001';
      const endpoint = '/message/sendText/GSA_WhatsApp';

      // Injected 401 Unauthorized
      m.failNext(endpoint, 10, 401);

      const res401 = await antiBanEngine.sendWhatsAppReply(phone, 'Mensagem com 401');
      assert.strictEqual(res401.success, false, 'Expected 401 to fail');

      const reqs401 = m.getByPhone(phone).filter(r => r.url.includes('/message/sendText/'));
      // Fast-fail must NOT retry 3 times for 401!
      assert.strictEqual(reqs401.length, 1, `401 was retried ${reqs401.length} times instead of fast-failing immediately`);

      // Injected 400 Bad Request
      m.clear();
      m.failNext(endpoint, 10, 400);

      const res400 = await antiBanEngine.sendWhatsAppReply(phone, 'Mensagem com 400');
      assert.strictEqual(res400.success, false, 'Expected 400 to fail');
      const reqs400 = m.getByPhone(phone).filter(r => r.url.includes('/message/sendText/'));
      assert.strictEqual(reqs400.length, 1, `400 was retried ${reqs400.length} times instead of fast-failing immediately`);
    });

    await runTest('4.3: Retryable 429 (Rate Limit) Backoff & Recovery', async (m) => {
      const phone = '5511922220001';
      const endpoint = '/message/sendText/GSA_WhatsApp';

      // Fail with 429 for 2 attempts, succeed on 3rd attempt
      m.failNext(endpoint, 2, 429);

      const res429 = await antiBanEngine.sendWhatsAppReply(phone, 'Mensagem com 429 rate limit');
      assert.ok(res429.success, `Expected 429 to recover on 3rd attempt, got: ${JSON.stringify(res429)}`);

      const reqs429 = m.getByPhone(phone).filter(r => r.url.includes('/message/sendText/'));
      assert.strictEqual(reqs429.length, 3, `Expected exactly 3 dispatch attempts for 429, got ${reqs429.length}`);
    });

    await runTest('4.4: Corrupted, Null, Empty and Edge Case Input Resilience', async () => {
      // 1. Missing phone number
      await assert.rejects(
        () => antiBanEngine.enqueueMessage('', 'Hello'),
        /Invalid parameters/
      );

      // 2. Missing payload
      await assert.rejects(
        () => antiBanEngine.enqueueMessage('5511911110001', ''),
        /Invalid parameters/
      );

      // 3. Facade graceful handling (sendWhatsAppReply returns { success: false } without throwing)
      const resEmpty = await antiBanEngine.sendWhatsAppReply('', '');
      assert.strictEqual(resEmpty.success, false);

      const resNull = await antiBanEngine.sendWhatsAppReply(null, null);
      assert.strictEqual(resNull.success, false);

      // 4. Extreme Spintax nesting with unicode & emojis
      const complexSpintax = '{{🔥 Olá|⚡ Oi}|🎉 {Bom dia|Tudo bem}} {amigo|parceiro}! {Ganhe {{10%|20%}|30%} OFF|Confira {aqui|agora}}';
      for (let i = 0; i < 50; i++) {
        const out = antiBanEngine.parseSpintax(complexSpintax);
        assert.ok(!out.includes('{') && !out.includes('}') && !out.includes('|'), `Spintax unparsed in: ${out}`);
      }

      // 5. Template variable preservation with nested Spintax
      const templatedSpintax = '{Olá|Oi} {nome}, seu link {link} expira em {{24|48} horas|{2|3} dias}!';
      for (let i = 0; i < 50; i++) {
        const out = antiBanEngine.parseSpintax(templatedSpintax);
        assert.ok(out.includes('{nome}'), `Variable {nome} lost in: ${out}`);
        assert.ok(out.includes('{link}'), `Variable {link} lost in: ${out}`);
        assert.ok(!out.includes('{24') && !out.includes('{48') && !out.includes('{2|'), `Spintax unparsed in: ${out}`);
      }
    });

  } finally {
    await mock.stop();
  }

  console.log('\n======================================================================');
  console.log(`  CHALLENGER 2 SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED | TOTAL: ${passedCount + failedCount}`);
  console.log('======================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

// Auto-run if executed directly
if (require.main === module) {
  runChallenger2TestSuite().catch(err => {
    console.error('Fatal Error in Challenger 2 test harness:', err);
    process.exit(1);
  });
}

module.exports = { ChallengerMockServer, runChallenger2TestSuite };
