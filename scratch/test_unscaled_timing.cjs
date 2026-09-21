'use strict';

const http = require('http');
const assert = require('assert/strict');

const MOCK_PORT = 8095;
process.env.EVOLUTION_API_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.EVOLUTION_API_KEY = 'gsa_test_unscaled';
process.env.EVOLUTION_INSTANCE = 'GSA_WhatsApp';
process.env.TIME_SCALE = '1.0';

const antiBanEngine = require('../lib/antiBanEngine.cjs');

async function testUnscaledRealtime() {
  console.log('--- Running 1.0x Real-time Unscaled Timing Verification ---');
  const requests = [];

  const server = http.createServer((req, res) => {
    const time = Date.now();
    const hrtime = process.hrtime.bigint();
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      requests.push({ url: req.url, time, hrtime, body: JSON.parse(body || '{}') });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'SUCCESS' }));
    });
  });

  await new Promise(r => server.listen(MOCK_PORT, '127.0.0.1', r));

  try {
    // 1. Short text (10 chars): formula gives base 1500 + 10*35 + [0..500] = 1850..2350ms
    const phoneShort = '5511991110001';
    const t0 = Date.now();
    await antiBanEngine.sendWhatsAppReply(phoneShort, '1234567890');
    const elapsedShort = Date.now() - t0;
    console.log(`[Unscaled 1.0x] Short text (10 chars) total wall-clock: ${elapsedShort}ms`);
    assert.ok(elapsedShort >= 1800, `Short text too fast: ${elapsedShort}ms < 1800ms`);
    assert.ok(elapsedShort <= 2700, `Short text too slow: ${elapsedShort}ms > 2700ms`);

    // Check request spacing on mock server
    const reqsShort = requests.filter(r => r.body.number === phoneShort);
    const presenceReq = reqsShort.find(r => r.url.includes('/chat/sendPresence/'));
    const sendReq = reqsShort.find(r => r.url.includes('/message/sendText/'));
    const presenceDelta = Number(sendReq.hrtime - presenceReq.hrtime) / 1e6;
    console.log(`[Unscaled 1.0x] Short text presence-to-send delta: ${presenceDelta.toFixed(1)}ms`);
    assert.ok(presenceDelta >= 1800 && presenceDelta <= 2500, `Presence delta ${presenceDelta}ms out of range`);

    console.log('✅ Unscaled Real-time Timing Verification PASSED!');
  } finally {
    server.close();
  }
}

testUnscaledRealtime().catch(e => {
  console.error('FAILED:', e);
  process.exit(1);
});
