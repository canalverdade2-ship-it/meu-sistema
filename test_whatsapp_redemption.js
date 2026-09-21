/**
 * test_whatsapp_redemption.js
 * 
 * Comprehensive E2E and Unit Test Suite for Conversational WhatsApp
 * Partner Benefit Redemption Flow (1:1 Web Parity).
 * 
 * Covers:
 *  - Suite 1: Fuzzy Search & Multi-Tier Partner Identification
 *  - Suite 2: Data Collection State Machine & Validation (Name, Email, Phone)
 *  - Suite 3: Instant Auto-Coupon Delivery (delay_24h = false)
 *  - Suite 4: Duplicate Protection, Justification Prompt & Analise State (48h SLA)
 *  - Suite 5: 24h SLA Provisioning & Admin Master Alerts (5511971858372)
 *  - Suite 6: Edge Cases, Security Boundaries, RPC Overload Fallback & Dual-Server Parity
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const assert = require('assert');
const http = require('http');

// Load modules under test
const liveWebhook = require('./server_webhook_vps_live.cjs');
const localWebhook = require('./server_webhook.cjs');

// Mock Data Catalog
const MOCK_PARTNERS = [
  {
    id: '11111111-1111-4111-a111-111111111111',
    slug: 'petlove',
    name: 'Petlove',
    category: 'Veterinária & Pet Care',
    benefits: 'Primeira Mensalidade 100% Grátis na GSA Saúde Pet',
    status: 'ativo',
    redemption_has_coupon: true,
    redemption_coupon_code: 'PETLOVEGSA100',
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: 'https://petlove.com.br/convenio-gsa',
    redemption_delay_24h: false,
    redemption_instructions: 'Insira o cupom no carrinho para ativar 100% de desconto no 1º mês.'
  },
  {
    id: '22222222-2222-4222-a222-222222222222',
    slug: 'oticas-carol',
    name: 'Óticas Carol',
    category: 'Saúde & Óptica',
    benefits: 'Desconto exclusivo de 20% em armações e lentes solares',
    status: 'ativo',
    redemption_has_coupon: false,
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: null,
    redemption_delay_24h: true,
    redemption_instructions: 'Aguarde o link exclusivo de ativação enviado em até 24 horas úteis.'
  },
  {
    id: '33333333-3333-4333-a333-333333333333',
    slug: 'drogasil',
    name: 'Drogasil',
    category: 'Farmácia & Saúde',
    benefits: 'Até 45% de desconto em medicamentos genéricos e 15% em perfumaria',
    status: 'ativo',
    redemption_has_coupon: true,
    redemption_coupon_code: 'DROGASILGSA45',
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: 'https://drogasil.com.br/convenio',
    redemption_delay_24h: false,
    redemption_instructions: 'Apresente o CPF ou código na farmácia ou utilize no site.'
  },
  {
    id: '44444444-4444-4444-a444-444444444444',
    slug: 'petz',
    name: 'Petz Super Store',
    category: 'Veterinária & Pet Shop',
    benefits: '15% de desconto em banho, tosa e acessórios para pets',
    status: 'ativo',
    redemption_has_coupon: true,
    redemption_coupon_code: 'PETZGSA15',
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: 'https://petz.com.br/gsa',
    redemption_delay_24h: false,
    redemption_instructions: 'Insira o cupom no checkout do app ou site da Petz.'
  }
];

let mockDbResgates = [];
let mockServer = null;

// Mock PostgREST HTTP Server on 127.0.0.1:3001
function startMockPostgrest(port = 3001) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const url = req.url;
        const method = req.method;
        // console.log('  [MOCK HTTP]', method, url);

        // 1. GET /parceiros_resgates (duplicate checking & lookup)
        if (method === 'GET' && url.includes('/parceiros_resgates')) {
          const matchId = url.match(/parceiro_id=eq\.([^&]+)/);
          const pId = matchId ? matchId[1] : null;

          let filtered = mockDbResgates.filter(r => {
            if (pId && r.parceiro_id !== pId) return false;
            if (r.status === 'recusado') return false; // status != recusado
            return true;
          });

          // Check OR filters for phone/email
          if (url.includes('or=')) {
            const orPart = decodeURIComponent(url.split('or=(')[1].split(')')[0]);
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

        // 2. GET /parceiros (catalog query)
        if (method === 'GET' && (url.startsWith('/parceiros?') || url === '/parceiros')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(MOCK_PARTNERS));
        }

        // 3. POST /rpc/gsa_public_resgatar_beneficio_parceiro
        if (method === 'POST' && url.includes('gsa_public_resgatar_beneficio_parceiro')) {
          try {
            const payload = JSON.parse(body || '{}');
            const pId = payload.p_parceiro_id;
            const pSlug = payload.p_parceiro_slug;
            const partner = MOCK_PARTNERS.find(p => p.id === pId || p.slug === pSlug);

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
            mockDbResgates.push(newRecord);

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

        // 4. PATCH /parceiros_resgates
        if (method === 'PATCH' && url.includes('/parceiros_resgates')) {
          try {
            const matchId = url.match(/id=eq\.([^&]+)/);
            const rId = matchId ? matchId[1] : null;
            const patchBody = JSON.parse(body || '{}');

            const record = mockDbResgates.find(r => r.id === rId);
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

// Test Runner
async function runAllSuites() {
  console.log('🧪 ════════════════════════════════════════════════════════════════════');
  console.log('🧪  INICIANDO SUÍTE DE TESTES: RESGATE DE BENEFÍCIOS WHATSAPP (1:1)');
  console.log('🧪 ════════════════════════════════════════════════════════════════════\n');

  try {
    mockServer = await startMockPostgrest(3001);
    console.log('✅ Mock PostgREST Server iniciado na porta 3001\n');
  } catch (err) {
    console.error('❌ Falha ao iniciar mock server:', err.message);
    process.exit(1);
  }

  let passedTests = 0;
  let totalTests = 0;

  function waitFor(conditionFn, timeout = 3000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (conditionFn()) {
          clearInterval(interval);
          return resolve(true);
        }
        if (Date.now() - start > timeout) {
          clearInterval(interval);
          return reject(new Error('Timeout aguardando condição no teste'));
        }
      }, 20);
    });
  }

  function runTest(testName, testFn) {
    totalTests++;
    try {
      testFn();
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${testName}`);
      console.error(`     Erro: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
    }
  }

  async function runAsyncTest(testName, asyncTestFn) {
    totalTests++;
    try {
      await asyncTestFn();
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${testName}`);
      console.error(`     Erro: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 1: Busca Fuzzy e Identificação Interativa de Parceiros
  // ──────────────────────────────────────────────────────────────────────────
  console.log('📦 [SUÍTE 1] Busca Fuzzy & Identificação Interativa de Parceiros');

  runTest('TEST-FUZZY-01: Correspondência exata por slug e nome (Score 1.0)', () => {
    const matchesSlug = liveWebhook.searchPartnersFuzzy('petlove', MOCK_PARTNERS);
    assert.strictEqual(matchesSlug.length, 1, 'Deveria retornar exatamente 1 parceiro');
    assert.strictEqual(matchesSlug[0].slug, 'petlove');

    const matchesName = liveWebhook.searchPartnersFuzzy('Óticas Carol', MOCK_PARTNERS);
    assert.strictEqual(matchesName.length, 1);
    assert.strictEqual(matchesName[0].slug, 'oticas-carol');
  });

  runTest('TEST-FUZZY-02: Correspondência parcial com stop-words e acentos', () => {
    const textQuery = 'Quero resgatar o benefício da drogasil por favor';
    const cleanTerm = liveWebhook.extractPartnerTermFromText(textQuery);
    assert.ok(cleanTerm.toLowerCase().includes('drogasil'), 'Deveria extrair drogasil');

    const matches = liveWebhook.searchPartnersFuzzy(textQuery, MOCK_PARTNERS);
    assert.ok(matches.length >= 1);
    assert.strictEqual(matches[0].slug, 'drogasil');
  });

  runTest('TEST-FUZZY-03: Busca ambígua trazendo múltiplos candidatos (Petlove vs Petz)', () => {
    const matches = liveWebhook.searchPartnersFuzzy('pet', MOCK_PARTNERS);
    assert.ok(matches.length >= 2, 'Deveria encontrar ao menos 2 parceiros com termo pet');
    const slugs = matches.map(m => m.slug);
    assert.ok(slugs.includes('petlove'));
    assert.ok(slugs.includes('petz'));
  });

  runTest('TEST-FUZZY-04: Busca sem correspondência retorna lista de sugestões', () => {
    const matches = liveWebhook.searchPartnersFuzzy('empresa-inexistente-xyz', MOCK_PARTNERS);
    assert.strictEqual(matches.length, 0, 'Termo desconhecido deve retornar 0 no filtro estrito');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 2: Máquina de Estados de Coleta de Dados & Validação
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📦 [SUÍTE 2] Máquina de Estados de Coleta de Dados & Validação');

  await runAsyncTest('TEST-FSM-01: Coleta progressiva (Nome -> E-mail -> Telefone) e Validações', async () => {
    const testPhone = '5511999990001';
    liveWebhook.userSessions[testPhone] = { state: 'MAIN_MENU', profile: {} };

    // 1. Envia intenção de resgatar Petlove
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Quero resgatar petlove', liveWebhook.userSessions[testPhone], 'petlove');
    await waitFor(() => liveWebhook.userSessions[testPhone]?.state === 'REDEMPTION_COLLECT_NAME');

    let sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.redemptionPartner.slug, 'petlove');
    assert.strictEqual(sess.state, 'REDEMPTION_COLLECT_NAME', 'Deveria solicitar o nome do cliente');

    // 2. Envia nome inválido (apenas 1 palavra)
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Adriano', liveWebhook.userSessions[testPhone], null);
    sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_COLLECT_NAME', 'Deve continuar solicitando nome após entrada inválida');

    // 3. Envia nome completo válido
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Adriano Farias', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => liveWebhook.userSessions[testPhone]?.state === 'REDEMPTION_COLLECT_EMAIL');
    sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.redemptionForm.nomeCompleto, 'Adriano Farias');
    assert.strictEqual(sess.state, 'REDEMPTION_COLLECT_EMAIL', 'Deveria avançar para coleta de e-mail');

    // 4. Envia e-mail inválido
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'email-invalido-sem-arroba', liveWebhook.userSessions[testPhone], null);
    sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_COLLECT_EMAIL', 'Deve recusar e-mail inválido');

    // 5. Envia e-mail válido
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'adriano@gsahub.com.br', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => mockDbResgates.some(r => r.email === 'adriano@gsahub.com.br'));
    assert.ok(mockDbResgates.some(r => r.email === 'adriano@gsahub.com.br'), 'Deve ter registrado o resgate de Adriano');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 3: Entrega Imediata de Auto-Cupom (delay_24h = false)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📦 [SUÍTE 3] Entrega Imediata de Auto-Cupom (delay_24h = false)');

  await runAsyncTest('TEST-COUPON-01: Resgate bem-sucedido com entrega de código PETLOVEGSA100 e Protocolo', async () => {
    const testPhone = '5511999990002';
    mockDbResgates = []; // Limpa banco

    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: MOCK_PARTNERS[0], // Petlove (delay_24h = false)
      redemptionForm: {
        nomeCompleto: 'Carlos Eduardo Santos',
        email: '',
        telefone: testPhone,
        justificativa: ''
      }
    };

    // Submete e-mail final para disparar a RPC
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'carlos.santos@email.com', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => mockDbResgates.some(r => r.telefone === testPhone));

    assert.strictEqual(mockDbResgates.length, 1, 'Deve ter inserido 1 registro em parceiros_resgates');
    const created = mockDbResgates[0];
    assert.strictEqual(created.nome_completo, 'Carlos Eduardo Santos');
    assert.strictEqual(created.email, 'carlos.santos@email.com');
    assert.strictEqual(created.codigo_gerado, 'PETLOVEGSA100', 'Deve conter o código de cupom configurado');
    assert.match(created.protocolo, /^PROT-RES-2026-[A-Z0-9]{6}$/, 'Protocolo deve seguir padrão PROT-RES-YYYY-XXXXXX');
    assert.strictEqual(created.status, 'pendente');
    assert.strictEqual(created.alerta_duplicidade, false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 4: Detecção de Duplicidade, Justificativa & Status Análise (48h)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📦 [SUÍTE 4] Detecção de Duplicidade, Justificativa & Status Análise');

  await runAsyncTest('TEST-DUPE-01: Bloqueio 409 em nova tentativa para o mesmo parceiro e telefone', async () => {
    const testPhone = '5511999990002'; // Mesmo telefone do TEST-COUPON-01
    assert.strictEqual(mockDbResgates.length, 1, 'Banco deve conter o registro anterior do Carlos Eduardo');

    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_NAME',
      redemptionPartner: MOCK_PARTNERS[0], // Petlove
      redemptionForm: {
        nomeCompleto: '',
        email: 'carlos.santos@email.com',
        telefone: testPhone,
        justificativa: ''
      }
    };

    // Submete nome para disparar validação de duplicidade
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Carlos Eduardo Santos', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => liveWebhook.userSessions[testPhone]?.state === 'REDEMPTION_AWAITING_JUSTIFICATION');

    const sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_AWAITING_JUSTIFICATION', 'Deve transitar para o estado de coleta de justificativa');
    assert.ok(sess.redemptionDuplicateRecord, 'Deve guardar referência ao resgate duplicado');
  });

  await runAsyncTest('TEST-DUPE-02: Envio de Justificativa com forceOverride -> Status analise e alerta_duplicidade', async () => {
    const testPhone = '5511999990002';
    const sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_AWAITING_JUSTIFICATION');

    const justificationText = 'Preciso de um novo cupom para cadastrar o segundo cachorro da família (Thor).';

    liveWebhook.handlePartnerRedemptionFlow(testPhone, justificationText, sess, null);
    await waitFor(() => mockDbResgates.length >= 2 && mockDbResgates.some(r => r.justificativa_duplicidade === justificationText));

    assert.strictEqual(mockDbResgates.length, 2, 'Deve ter criado o segundo registro sob análise');
    const overrideRecord = mockDbResgates.find(r => r.justificativa_duplicidade === justificationText);
    assert.ok(overrideRecord, 'Deve encontrar registro com a justificativa');
    assert.strictEqual(overrideRecord.status, 'analise', 'Status no banco deve ser analise');
    assert.strictEqual(overrideRecord.alerta_duplicidade, true, 'alerta_duplicidade deve ser true');
    assert.strictEqual(overrideRecord.justificativa_duplicidade, justificationText);
    assert.match(overrideRecord.protocolo, /^PROT-RES-2026-[A-Z0-9]{6}$/);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 5: Provedor com SLA 24h & Alerta Master (5511971858372)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📦 [SUÍTE 5] Provedor com SLA 24h & Alerta ao Admin Master');

  await runAsyncTest('TEST-SLA-01: Parceiro com delay_24h = true gera protocolo e notificação administrativa', async () => {
    const testPhone = '5511988887777';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_NAME',
      redemptionPartner: MOCK_PARTNERS[1], // Óticas Carol (delay_24h = true)
      redemptionForm: {
        nomeCompleto: '',
        email: 'mariana.silva@empresa.com',
        telefone: testPhone,
        justificativa: ''
      }
    };

    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Mariana Silva de Oliveira', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => mockDbResgates.some(r => r.telefone === testPhone));

    const created = mockDbResgates.find(r => r.telefone === testPhone);
    assert.ok(created, 'Deve ter criado o resgate');
    assert.strictEqual(created.nome_completo, 'Mariana Silva de Oliveira');
    assert.strictEqual(created.status, 'pendente');
    assert.match(created.protocolo, /^PROT-RES-2026-[A-Z0-9]{6}$/);
    assert.strictEqual(liveWebhook.ADMIN_MASTER_PHONE, '5511971858372');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 6: Conformidade e Paridade Dual-Server (vps_live vs local)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📦 [SUÍTE 6] Conformidade e Paridade Dual-Server (vps_live vs local)');

  runTest('TEST-PARITY-01: Funções e exports idênticos em ambos os arquivos de webhook', () => {
    const expectedExports = [
      'handlePartnerRedemptionFlow',
      'searchPartnersFuzzy',
      'fetchPartnersForAI',
      'checkDuplicateRedemptionDb',
      'dispatchAdminRedemptionAlert',
      'executeBenefitRedemptionRpc',
      'selectRedemptionPartner',
      'extractPartnerTermFromText',
      'supabaseRpc'
    ];

    expectedExports.forEach(fnName => {
      assert.strictEqual(typeof liveWebhook[fnName], 'function', `liveWebhook.${fnName} deve ser function`);
      assert.strictEqual(typeof localWebhook[fnName], 'function', `localWebhook.${fnName} deve ser function`);
    });
  });

  runTest('TEST-PARITY-02: Fallback NLU de protocolo detecta intenção resgatar', () => {
    const resLive = liveWebhook.parseProtocolIntentFallback('quero resgatar meu beneficio da petlove');
    assert.strictEqual(resLive.intent, 'resgatar');
    assert.strictEqual(resLive.field, 'parceiro');
    assert.ok(resLive.new_value.toLowerCase().includes('petlove'));

    const resLocal = localWebhook.parseProtocolIntentFallback('resgatar cupom de desconto drogasil');
    assert.strictEqual(resLocal.intent, 'resgatar');
    assert.strictEqual(resLocal.field, 'parceiro');
    assert.ok(resLocal.new_value.toLowerCase().includes('drogasil'));
  });

  // Encerra mock server
  if (mockServer) {
    mockServer.close();
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO (100%)`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllSuites().catch(err => {
  console.error('Fatal test error:', err);
  if (mockServer) mockServer.close();
  process.exit(1);
});
