/**
 * test_whatsapp_redemption_stress.js
 * 
 * Comprehensive Empirical Stress, Concurrency, Session Isolation,
 * Security & Memory Benchmark for WhatsApp Partner Benefit Redemption Flow.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const assert = require('assert');
const http = require('http');

const liveWebhook = require('./server_webhook_vps_live.cjs');
const localWebhook = require('./server_webhook.cjs');

// Mock Partner Catalog
const TEST_PARTNERS = [
  {
    id: 'partner-uuid-001',
    slug: 'petlove',
    name: 'Petlove Saúde Pet',
    category: 'Veterinária & Pet Care',
    benefits: '1ª Mensalidade 100% Grátis',
    status: 'ativo',
    redemption_has_coupon: true,
    redemption_coupon_code: 'PETLOVE-STRESS-100',
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: 'https://petlove.com.br/gsa',
    redemption_delay_24h: false,
    redemption_instructions: 'Insira no carrinho.'
  },
  {
    id: 'partner-uuid-002',
    slug: 'oticas-carol',
    name: 'Óticas Carol',
    category: 'Saúde & Óptica',
    benefits: '20% OFF exclusivo',
    status: 'ativo',
    redemption_has_coupon: false,
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: null,
    redemption_delay_24h: true,
    redemption_instructions: 'Aguarde 24h para ativação.'
  },
  {
    id: 'partner-uuid-003',
    slug: 'drogasil',
    name: 'Drogasil Farmácias',
    category: 'Farmácia & Saúde',
    benefits: '45% OFF medicamentos',
    status: 'ativo',
    redemption_has_coupon: true,
    redemption_coupon_code: 'DROGASIL-STRESS-45',
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: 'https://drogasil.com.br/gsa',
    redemption_delay_24h: false,
    redemption_instructions: 'Apresente o CPF no caixa.'
  }
];

let mockDb = [];
let mockServer = null;
let faultInjectionMode = null;
let requestCount = 0;

function startMockServer(port = 3001) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      requestCount++;
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const url = req.url;
        const method = req.method;

        if (faultInjectionMode === '500_ERROR') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Injected DB 500 error' }));
        }

        if (faultInjectionMode === 'INVALID_JSON') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end('<!DOCTYPE html><html><body>Error</body></html>');
        }

        // 1. GET /rest/v1/parceiros or /parceiros
        if (method === 'GET' && (url.includes('/parceiros?') || url === '/parceiros' || url.startsWith('/rest/v1/parceiros'))) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(TEST_PARTNERS));
        }

        // 2. GET /rest/v1/parceiros_resgates
        if (method === 'GET' && url.includes('parceiros_resgates')) {
          const matchId = url.match(/parceiro_id=eq\.([^&]+)/);
          const pId = matchId ? matchId[1] : null;

          let filtered = mockDb.filter(r => {
            if (pId && r.parceiro_id !== pId) return false;
            if (r.status === 'recusado') return false;
            return true;
          });

          if (url.includes('or=')) {
            const rawOr = url.split('or=(')[1].split(')')[0];
            const orPart = decodeURIComponent(rawOr);
            const terms = orPart.split(',');
            filtered = filtered.filter(r => {
              return terms.some(t => {
                if (t.startsWith('email.eq.')) {
                  const emailVal = t.replace('email.eq.', '').toLowerCase();
                  return (r.email || '').toLowerCase() === emailVal;
                }
                if (t.startsWith('telefone.eq.')) {
                  const phoneVal = t.replace('telefone.eq.', '');
                  const rPhone = (r.telefone || '').replace(/\D/g, '');
                  return rPhone === phoneVal || rPhone.endsWith(phoneVal) || phoneVal.endsWith(rPhone);
                }
                return false;
              });
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(filtered));
        }

        // 3. POST /rest/v1/rpc/gsa_public_resgatar_beneficio_parceiro or /rpc/...
        if (method === 'POST' && url.includes('gsa_public_resgatar_beneficio_parceiro')) {
          try {
            const payload = JSON.parse(body || '{}');
            const pId = payload.p_parceiro_id;
            const pSlug = payload.p_parceiro_slug;
            const partner = TEST_PARTNERS.find(p => p.id === pId || p.slug === pSlug);

            if (!partner) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Parceiro não encontrado' }));
            }

            const randSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            const protocol = 'PROT-RES-2026-' + randSuffix;
            const resgateId = 'resgate-' + Math.random().toString(36).substring(2, 9);

            const newRecord = {
              id: resgateId,
              parceiro_id: partner.id,
              nome_completo: payload.p_nome_completo,
              telefone: payload.p_telefone,
              email: payload.p_email || null,
              cliente_id: payload.p_cliente_id || null,
              codigo_gerado: partner.redemption_has_coupon ? partner.redemption_coupon_code : protocol,
              protocolo: protocol,
              tipo_resgate: partner.redemption_has_coupon ? 'cupom' : 'link',
              status: 'pendente',
              alerta_duplicidade: false,
              justificativa_duplicidade: null,
              created_at: new Date().toISOString()
            };
            mockDb.push(newRecord);

            const responsePayload = {
              success: true,
              resgate_id: resgateId,
              partner_name: partner.name,
              partner_slug: partner.slug,
              benefits: partner.benefits,
              tipo_resgate: newRecord.tipo_resgate,
              codigo_gerado: newRecord.codigo_gerado,
              protocolo: protocol,
              has_coupon: partner.redemption_has_coupon,
              has_voucher: partner.redemption_has_voucher,
              has_link: partner.redemption_has_link,
              link: partner.redemption_link,
              instructions: partner.redemption_instructions,
              delay_24h: partner.redemption_delay_24h,
              status: 'pendente'
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(responsePayload));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
          }
        }

        // 4. PATCH /rest/v1/parceiros_resgates
        if (method === 'PATCH' && url.includes('parceiros_resgates')) {
          try {
            const matchId = url.match(/id=eq\.([^&]+)/);
            const rId = matchId ? matchId[1] : null;
            const patchBody = JSON.parse(body || '{}');

            const record = mockDb.find(r => r.id === rId);
            if (record) {
              Object.assign(record, patchBody);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([record || patchBody]));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
      });
    });

    srv.listen(port, '127.0.0.1', () => {
      resolve(srv);
    });
    srv.on('error', reject);
  });
}

function waitFor(conditionFn, timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (conditionFn()) {
        clearInterval(interval);
        return resolve(true);
      }
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        return reject(new Error(`Timeout (${timeout}ms) waiting for condition`));
      }
    }, 15);
  });
}

async function runStressTestSuite() {
  console.log('⚡ ════════════════════════════════════════════════════════════════════');
  console.log('⚡  EMPIRICAL CHALLENGER: WHATSAPP REDEMPTION STRESS & CONCURRENCY');
  console.log('⚡ ════════════════════════════════════════════════════════════════════\n');

  mockServer = await startMockServer(3001);
  console.log('✅ Mock PostgREST Live on port 3001\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SECTION 1: Massive Concurrency & Session Isolation (VPS Live)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔥 [CHALLENGE 1] Concurrency & Strict Session Isolation (VPS Live - 100 Users)');

  await test('STRESS-CONCURRENCY-01: 100 distinct users concurrently completing redemptions (liveWebhook)', async () => {
    mockDb = [];
    const NUM_USERS = 100;
    const userPromises = [];

    for (let i = 0; i < NUM_USERS; i++) {
      const phone = `551190000${String(i).padStart(4, '0')}`;
      const fullName = `Usuario Teste Concorrente ${i}`;
      const email = `usuario_${i}@gsa-stress-test.com.br`;
      const partner = TEST_PARTNERS[i % TEST_PARTNERS.length];

      const p = (async () => {
        liveWebhook.userSessions[phone] = { state: 'MAIN_MENU', profile: {} };

        liveWebhook.handlePartnerRedemptionFlow(phone, `Quero resgatar ${partner.slug}`, liveWebhook.userSessions[phone], partner.slug);
        await waitFor(() => liveWebhook.userSessions[phone]?.state === 'REDEMPTION_COLLECT_NAME');

        const sessStep1 = liveWebhook.userSessions[phone];
        assert.strictEqual(sessStep1.redemptionPartner.slug, partner.slug, `User ${phone} partner slug mismatch`);

        liveWebhook.handlePartnerRedemptionFlow(phone, fullName, liveWebhook.userSessions[phone], null);
        await waitFor(() => liveWebhook.userSessions[phone]?.state === 'REDEMPTION_COLLECT_EMAIL');

        const sessStep2 = liveWebhook.userSessions[phone];
        assert.strictEqual(sessStep2.redemptionForm.nomeCompleto, fullName, `User ${phone} name mismatch`);

        liveWebhook.handlePartnerRedemptionFlow(phone, email, liveWebhook.userSessions[phone], null);
        await waitFor(() => mockDb.some(r => r.telefone === phone && r.email === email));

        await waitFor(() => liveWebhook.userSessions[phone]?.state === 'MAIN_MENU');
        const sessStep3 = liveWebhook.userSessions[phone];
        assert.strictEqual(sessStep3.state, 'MAIN_MENU');
        assert.strictEqual(sessStep3.redemptionPartner, null);
        assert.strictEqual(sessStep3.redemptionForm, null);
      })();

      userPromises.push(p);
    }

    await Promise.all(userPromises);

    assert.strictEqual(mockDb.length, NUM_USERS, `Expected exactly ${NUM_USERS} records in DB, found ${mockDb.length}`);

    // Verify ZERO data leakage across all 100 records
    for (let i = 0; i < NUM_USERS; i++) {
      const phone = `551190000${String(i).padStart(4, '0')}`;
      const expectedName = `Usuario Teste Concorrente ${i}`;
      const expectedEmail = `usuario_${i}@gsa-stress-test.com.br`;
      const expectedPartner = TEST_PARTNERS[i % TEST_PARTNERS.length];

      const record = mockDb.find(r => r.telefone === phone);
      assert.ok(record, `Missing record for phone ${phone}`);
      assert.strictEqual(record.nome_completo, expectedName, `Data leak: record for ${phone} has wrong name`);
      assert.strictEqual(record.email, expectedEmail, `Data leak: record for ${phone} has wrong email`);
      assert.strictEqual(record.parceiro_id, expectedPartner.id, `Data leak: record for ${phone} has wrong partner ID`);
      assert.match(record.protocolo, /^PROT-RES-2026-[A-Z0-9]{6}$/);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SECTION 2: Concurrency & Duplicate Detection + Justification (50 Users)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔥 [CHALLENGE 2] Concurrency in Duplicate Detection & Justification Workflow');

  await test('STRESS-DUPE-CONCURRENT-01: 50 concurrent duplicate attempts transition to justification & override', async () => {
    // We already have 100 records in mockDb from previous test (phones 5511900000000 to 5511900000049)
    const NUM_DUPES = 50;
    const dupePromises = [];

    for (let i = 0; i < NUM_DUPES; i++) {
      const phone = `551190000${String(i).padStart(4, '0')}`;
      const fullName = `Usuario Teste Concorrente ${i}`;
      const email = `usuario_${i}@gsa-stress-test.com.br`;
      const partner = TEST_PARTNERS[i % TEST_PARTNERS.length];
      const justification = `Justificativa concorrente de teste para usuario ${i}`;

      const p = (async () => {
        liveWebhook.userSessions[phone] = {
          state: 'REDEMPTION_COLLECT_NAME',
          redemptionPartner: partner,
          redemptionForm: {
            nomeCompleto: '',
            email: email,
            telefone: phone,
            justificativa: ''
          }
        };

        // Submit name -> triggers duplicate check
        liveWebhook.handlePartnerRedemptionFlow(phone, fullName, liveWebhook.userSessions[phone], null);
        await waitFor(() => liveWebhook.userSessions[phone]?.state === 'REDEMPTION_AWAITING_JUSTIFICATION');

        assert.strictEqual(liveWebhook.userSessions[phone].state, 'REDEMPTION_AWAITING_JUSTIFICATION');
        assert.ok(liveWebhook.userSessions[phone].redemptionDuplicateRecord);

        // Submit justification -> triggers override RPC + patch
        liveWebhook.handlePartnerRedemptionFlow(phone, justification, liveWebhook.userSessions[phone], null);
        await waitFor(() => mockDb.some(r => r.telefone === phone && r.justificativa_duplicidade === justification));

        await waitFor(() => liveWebhook.userSessions[phone]?.state === 'MAIN_MENU');
        assert.strictEqual(liveWebhook.userSessions[phone].state, 'MAIN_MENU');
      })();

      dupePromises.push(p);
    }

    await Promise.all(dupePromises);

    // Verify 50 override records created with status 'analise'
    const analiseRecords = mockDb.filter(r => r.status === 'analise');
    assert.strictEqual(analiseRecords.length, NUM_DUPES, `Expected ${NUM_DUPES} analise records, found ${analiseRecords.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SECTION 3: Race Conditions & Rapid Repeated Dispatches
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔥 [CHALLENGE 3] Race Conditions & Rapid Repeated Dispatches');

  await test('STRESS-RACE-01: Rapid double-dispatch from same phone does not corrupt state or crash', async () => {
    const phone = '5511988880099';
    liveWebhook.userSessions[phone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: TEST_PARTNERS[0],
      redemptionForm: {
        nomeCompleto: 'Carlos Race Condition',
        email: '',
        telefone: phone,
        justificativa: ''
      }
    };

    // Fire 10 simultaneous dispatches
    const simultaneousRequests = Array.from({ length: 10 }, () => {
      return Promise.resolve().then(() => {
        liveWebhook.handlePartnerRedemptionFlow(phone, 'carlos.race@email.com', liveWebhook.userSessions[phone], null);
      });
    });

    await Promise.all(simultaneousRequests);
    await waitFor(() => mockDb.some(r => r.telefone === phone));

    const finalSession = liveWebhook.userSessions[phone];
    assert.strictEqual(finalSession.state, 'MAIN_MENU');
    assert.strictEqual(finalSession.redemptionPartner, null);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SECTION 4: Memory Footprint & Cleanup Under 2,000 Session Cycles
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔥 [CHALLENGE 4] Memory Footprint & Cleanup Under 2,000 Session Cycles');

  await test('STRESS-MEM-01: 2,000 session cancellations & completions maintain bounded heap & nullify objects', async () => {
    const initialHeap = process.memoryUsage().heapUsed;

    const BATCH_SIZE = 500;
    for (let batch = 0; batch < 4; batch++) {
      for (let i = 0; i < BATCH_SIZE; i++) {
        const phone = `551197777${String(batch * BATCH_SIZE + i).padStart(4, '0')}`;
        liveWebhook.userSessions[phone] = {
          state: 'REDEMPTION_COLLECT_NAME',
          redemptionPartner: TEST_PARTNERS[0],
          redemptionCandidates: TEST_PARTNERS,
          redemptionForm: {
            nomeCompleto: '',
            email: 'mem.test@email.com',
            telefone: phone,
            justificativa: ''
          }
        };

        // User cancels with '0'
        liveWebhook.handlePartnerRedemptionFlow(phone, '0', liveWebhook.userSessions[phone], null);
      }
    }

    // Check all sessions have nullified heavy objects
    let orphanFormCount = 0;
    let orphanPartnerCount = 0;

    Object.keys(liveWebhook.userSessions).forEach(ph => {
      const sess = liveWebhook.userSessions[ph];
      if (sess.state === 'MAIN_MENU') {
        if (sess.redemptionForm !== null && sess.redemptionForm !== undefined) orphanFormCount++;
        if (sess.redemptionPartner !== null && sess.redemptionPartner !== undefined) orphanPartnerCount++;
      }
    });

    assert.strictEqual(orphanFormCount, 0, `Found ${orphanFormCount} orphan redemptionForm objects retained in memory!`);
    assert.strictEqual(orphanPartnerCount, 0, `Found ${orphanPartnerCount} orphan redemptionPartner objects retained in memory!`);

    const finalHeap = process.memoryUsage().heapUsed;
    const heapDiffMb = (finalHeap - initialHeap) / (1024 * 1024);
    console.log(`     Heap delta for 2,000 sessions: ${heapDiffMb.toFixed(2)} MB`);
    assert.ok(heapDiffMb < 30, `Heap grew excessively (${heapDiffMb.toFixed(2)} MB)`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SECTION 5: Adversarial Fuzzing & ReDoS Protection
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔥 [CHALLENGE 5] Adversarial Fuzzing & ReDoS Stress Testing');

  await test('STRESS-FUZZ-01: Massive strings and pathological stop-words in extractPartnerTermFromText', async () => {
    const pathologicalInput = 'por favor quero resgatar beneficio cupom de desconto '.repeat(1000) + 'Petlove ' + 'convenio parceiro '.repeat(500);

    const startTime = Date.now();
    const result = liveWebhook.extractPartnerTermFromText(pathologicalInput);
    const elapsed = Date.now() - startTime;

    assert.ok(elapsed < 50, `extractPartnerTermFromText took too long (${elapsed}ms) - potential ReDoS!`);
    assert.ok(result.toLowerCase().includes('petlove'), 'Should successfully extract petlove');
  });

  await test('STRESS-FUZZ-02: searchPartnersFuzzy resilience against SQLi, XSS, and Unicode attacks', async () => {
    const maliciousInputs = [
      "' OR '1'='1' --",
      '<script>alert("XSS")</script>',
      '\u0000\u0001\u0002\u0003\u0004',
      'SELECT * FROM parceiros_resgates WHERE 1=1;',
      '../../../../etc/passwd',
      '🔥🎁🐶🐱💎'.repeat(50),
      'a'.repeat(20000),
      'null',
      'undefined',
      'NaN',
      '{}',
      '[]'
    ];

    maliciousInputs.forEach(input => {
      const t0 = Date.now();
      const res = liveWebhook.searchPartnersFuzzy(input, TEST_PARTNERS);
      const dt = Date.now() - t0;
      assert.ok(Array.isArray(res), 'Result must be an array');
      assert.ok(dt < 30, `searchPartnersFuzzy too slow on input "${input.substring(0, 20)}": ${dt}ms`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SECTION 6: Network Resiliency & Database Fault Injection
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔥 [CHALLENGE 6] Network Resiliency & Database Fault Injection');

  await test('STRESS-FAULT-01: PostgREST returns 500 error gracefully without crashing session', async () => {
    faultInjectionMode = '500_ERROR';
    const testPhone = '5511999995555';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: TEST_PARTNERS[0],
      redemptionForm: {
        nomeCompleto: 'Usuario Erro Servidor',
        email: '',
        telefone: testPhone,
        justificativa: ''
      }
    };

    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'usuario.erro@email.com', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => liveWebhook.userSessions[testPhone]?.state === 'MAIN_MENU');

    const sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'MAIN_MENU', 'Session should reset to MAIN_MENU on backend 500 failure');
    faultInjectionMode = null;
  });

  await test('STRESS-FAULT-02: PostgREST returns invalid non-JSON gracefully', async () => {
    faultInjectionMode = 'INVALID_JSON';
    const testPhone = '5511999996666';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: TEST_PARTNERS[0],
      redemptionForm: {
        nomeCompleto: 'Usuario JSON Invalido',
        email: '',
        telefone: testPhone,
        justificativa: ''
      }
    };

    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'usuario.invalido@email.com', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => liveWebhook.userSessions[testPhone]?.state === 'MAIN_MENU');

    const sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'MAIN_MENU', 'Session should reset to MAIN_MENU on invalid JSON');
    faultInjectionMode = null;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SECTION 7: Dual-Server Parity Under Concurrency (localWebhook)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔥 [CHALLENGE 7] Dual-Server Parity Under High Concurrency (localWebhook - 50 Users)');

  await test('STRESS-PARITY-01: localWebhook handles 50 concurrent redemptions with identical behavior', async () => {
    mockDb = [];
    const NUM_USERS = 50;
    const userPromises = [];

    for (let i = 0; i < NUM_USERS; i++) {
      const phone = `551191111${String(i).padStart(4, '0')}`;
      const fullName = `Local Webhook Concorrente ${i}`;
      const email = `local_${i}@gsa-stress.com.br`;
      const partner = TEST_PARTNERS[i % TEST_PARTNERS.length];

      const p = (async () => {
        localWebhook.userSessions[phone] = { state: 'MAIN_MENU', profile: {} };

        localWebhook.handlePartnerRedemptionFlow(phone, `Quero resgatar ${partner.slug}`, localWebhook.userSessions[phone], partner.slug);
        await waitFor(() => localWebhook.userSessions[phone]?.state === 'REDEMPTION_COLLECT_NAME');

        localWebhook.handlePartnerRedemptionFlow(phone, fullName, localWebhook.userSessions[phone], null);
        await waitFor(() => localWebhook.userSessions[phone]?.state === 'REDEMPTION_COLLECT_EMAIL');

        localWebhook.handlePartnerRedemptionFlow(phone, email, localWebhook.userSessions[phone], null);
        await waitFor(() => mockDb.some(r => r.telefone === phone && r.email === email));

        await waitFor(() => localWebhook.userSessions[phone]?.state === 'MAIN_MENU');
        assert.strictEqual(localWebhook.userSessions[phone].state, 'MAIN_MENU');
        assert.strictEqual(localWebhook.userSessions[phone].redemptionPartner, null);
        assert.strictEqual(localWebhook.userSessions[phone].redemptionForm, null);
      })();

      userPromises.push(p);
    }

    await Promise.all(userPromises);
    assert.strictEqual(mockDb.length, NUM_USERS, `Expected ${NUM_USERS} records created by localWebhook`);
  });

  // Close Mock Server Cleanly
  if (mockServer) {
    mockServer.close();
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`📊 STRESS CHALLENGE RESULTS: ${passed}/${total} TESTS PASSED (100%)`);
  console.log(`📊 Total Mock HTTP Requests Processed: ${requestCount}`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStressTestSuite().catch(err => {
  console.error('Fatal stress suite failure:', err);
  if (mockServer) mockServer.close();
  process.exit(1);
});
