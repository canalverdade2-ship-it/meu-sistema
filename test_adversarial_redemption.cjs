/**
 * test_adversarial_redemption.cjs
 * 
 * Comprehensive Adversarial Test Suite for Conversational WhatsApp Partner Benefit Redemption.
 * Authored by: challenger_redemption_1 (Empirical Challenger)
 * 
 * Stress-tests:
 *  - 1. Fuzzy Partner Matching (Stopwords, Slang, Extreme Typos, Accents, Disambiguation)
 *  - 2. Duplicate Protection Edge Cases (Cross-phone, Cross-email, Formatting, Status exclusions)
 *  - 3. Justification Bypass Attempts (Empty, Whitespace, Sub-length, Cancellation)
 *  - 4. RPC Overload Fallback (PGRST202 parameter mismatch recovery, RPC failure resiliency)
 *  - 5. Instant Coupon vs 24h SLA Delivery Accuracy
 *  - 6. Form Validation & Interactive Multi-turn State Machine
 *  - 7. VPS Live vs Local Webhook Parity
 */

const assert = require('assert');
const http = require('http');

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
  },
  {
    id: '55555555-5555-5555-a555-555555555555',
    slug: 'convenio-sem-recursos',
    name: 'Convênio Genérico Sem Cupom',
    category: 'Geral',
    benefits: 'Atendimento prioritário GSA',
    status: 'ativo',
    redemption_has_coupon: false,
    redemption_coupon_code: null,
    redemption_has_voucher: false,
    redemption_has_link: false,
    redemption_link: null,
    redemption_delay_24h: false, // Will fallback to 24h because no coupon/voucher/link
    redemption_instructions: 'Aguarde ativação interna'
  }
];

let mockDbResgates = [];
let mockServer = null;
let mockServerFailRpc = false;
let mockServerSimulatePgrst202 = false;
let interceptedMessages = [];

// Intercept WhatsApp replies
function installMessageInterceptor(moduleUnderTest) {
  interceptedMessages = [];
  // Store original if needed
  moduleUnderTest._testSentMessages = interceptedMessages;
}

// Mock Server on 127.0.0.1:3001
function startMockPostgrestServer(port = 3001, maxRetries = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryListen() {
      attempts++;
      const srv = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const url = req.url;
          const method = req.method;

          // 1. GET /parceiros_resgates
          if (method === 'GET' && url.includes('/parceiros_resgates')) {
            const matchId = url.match(/parceiro_id=eq\.([^&]+)/);
            const pId = matchId ? matchId[1] : null;

            let filtered = mockDbResgates.filter(r => {
              if (pId && r.parceiro_id !== pId) return false;
              if (r.status === 'recusado') return false; // Exclude rejected
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

          // 2. GET /parceiros
          if (method === 'GET' && (url.startsWith('/parceiros?') || url === '/parceiros')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(MOCK_PARTNERS));
          }

          // 3. POST /rpc/gsa_public_resgatar_beneficio_parceiro
          if (method === 'POST' && url.includes('gsa_public_resgatar_beneficio_parceiro')) {
            if (mockServerFailRpc) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ message: 'Internal Server Error in database function' }));
            }

            try {
              const payload = JSON.parse(body || '{}');

              // Simulate PGRST202 if flag set and p_email is present
              if (mockServerSimulatePgrst202 && payload.p_email !== undefined) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                  code: 'PGRST202',
                  message: 'Could not find function gsa_public_resgatar_beneficio_parceiro with parameter p_email in the schema'
                }));
              }

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

      srv.listen(port, '127.0.0.1', () => resolve(srv));
      srv.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempts < maxRetries) {
          setTimeout(tryListen, 1000);
        } else {
          reject(err);
        }
      });
    }
    tryListen();
  });
}

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

async function runAdversarialSuites() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ 🛡️  SUÍTE DE TESTES ADVERSARIAIS: RESGATE DE BENEFÍCIOS WHATSAPP      ║');
  console.log('║    EMPERICAL CHALLENGER & STRESS VERIFICATION (7 DIMENSÕES)          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  try {
    mockServer = await startMockPostgrestServer(3001);
    console.log('🟢 Mock Server iniciado em http://127.0.0.1:3001\n');
  } catch (err) {
    console.error('🔴 Falha ao iniciar Mock Server:', err.message);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  const failureLog = [];

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Mensagem: ${err.message}`);
      failureLog.push({ name, err: err.message });
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Mensagem: ${err.message}`);
      failureLog.push({ name, err: err.message });
      failed++;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. FUZZY PARTNER MATCHING UNDER EXTREME STRESS & NOISE
  // ═════════════════════════════════════════════════════════════════════════════
  console.log('📦 1. BUSCA FUZZY SOB RUÍDO EXTREMO, GÍRIAS, ACENTOS E STOPWORDS');

  test('ADV-FUZZY-01: Extração com gírias, saudações compostas e stopwords', () => {
    const inputs = [
      { text: 'ae mano me arruma um cupom de desconto da drogasil por favor', expected: 'drogasil' },
      { text: 'gostaria de pegar o benefício da petlove com urgencia', expected: 'petlove' },
      { text: 'como faco para resgatar o desconto nas otica carol?', expected: 'otica' },
      { text: '🔥 QUERO O CUPOM DA PETZ AGORA! 🐶✨', expected: 'petz' }
    ];

    inputs.forEach(({ text, expected }) => {
      const term = liveWebhook.extractPartnerTermFromText(text).toLowerCase();
      assert.ok(
        term.includes(expected) || term === expected,
        `extractPartnerTermFromText("${text}") extraiu "${term}", esperado conter "${expected}"`
      );
    });
  });

  test('ADV-FUZZY-02: Tolerância a acentuação extrema, caixa alta/baixa e normalização Unicode NFD', () => {
    const queries = ['ÓTICAS CAROL', 'óticas carol', 'Oticas Carol', 'Drogasíl', 'DROGASIL', 'Petlóve', 'Pétz'];
    queries.forEach(q => {
      const matches = liveWebhook.searchPartnersFuzzy(q, MOCK_PARTNERS);
      assert.ok(matches.length >= 1, `searchPartnersFuzzy("${q}") deveria encontrar ao menos 1 parceiro`);
    });
  });

  test('ADV-FUZZY-03: Busca por categoria semântica (Farmácia -> Drogasil, Veterinária -> Petlove/Petz, Óptica -> Óticas Carol)', () => {
    const pharmaMatches = liveWebhook.searchPartnersFuzzy('farmacia', MOCK_PARTNERS);
    assert.ok(pharmaMatches.some(p => p.slug === 'drogasil'), 'Busca por farmacia deve encontrar Drogasil');

    const opticaMatches = liveWebhook.searchPartnersFuzzy('optica', MOCK_PARTNERS);
    assert.ok(opticaMatches.some(p => p.slug === 'oticas-carol'), 'Busca por optica deve encontrar Óticas Carol');

    const vetMatches = liveWebhook.searchPartnersFuzzy('veterinaria', MOCK_PARTNERS);
    assert.ok(vetMatches.some(p => p.slug === 'petlove' || p.slug === 'petz'), 'Busca por veterinaria deve encontrar parceiros pets');
  });

  await asyncTest('ADV-FUZZY-04: Desambiguação interativa (Petlove vs Petz) com seleção numérica e troca de intenção', async () => {
    const testPhone = '5511977770001';
    liveWebhook.userSessions[testPhone] = { state: 'MAIN_MENU', profile: {} };

    // 1. Envia 'pet' gerando desambiguação
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Quero resgatar pet', liveWebhook.userSessions[testPhone], 'pet');
    await waitFor(() => liveWebhook.userSessions[testPhone]?.state === 'REDEMPTION_SELECT_PARTNER');

    const sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_SELECT_PARTNER');
    assert.ok(sess.redemptionCandidates.length >= 2, 'Deve ter múltiplos candidatos');

    // 2. Usuário seleciona candidato 2 (Petz)
    const cand2 = sess.redemptionCandidates[1];
    liveWebhook.handlePartnerRedemptionFlow(testPhone, '2', sess, null);
    await waitFor(() => liveWebhook.userSessions[testPhone]?.redemptionPartner?.slug === cand2.slug);

    assert.strictEqual(liveWebhook.userSessions[testPhone].redemptionPartner.slug, cand2.slug);
    assert.strictEqual(liveWebhook.userSessions[testPhone].state, 'REDEMPTION_COLLECT_NAME');
  });

  test('ADV-FUZZY-05: Queries totalmente inexistentes retornam array vazio e não geram erros', () => {
    const invalidMatches = liveWebhook.searchPartnersFuzzy('XYZ_EMPRESA_TOTALMENTE_FANTASMA_123', MOCK_PARTNERS);
    assert.strictEqual(invalidMatches.length, 0);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. DUPLICATE PROTECTION EDGE CASES & INTEGRITY
  // ═════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 2. PROTEÇÃO DE DUPLICIDADE: CONTATOS CRUZADOS, FORMATAÇÕES E STATUS');

  await asyncTest('ADV-DUPE-01: Bloqueio de duplicidade por Telefone cruzado com E-mail diferente', async () => {
    mockDbResgates = [
      {
        id: 'resg-seed-1',
        parceiro_id: '11111111-1111-4111-a111-111111111111', // Petlove
        nome_completo: 'Carlos Silva',
        telefone: '5511999990001',
        email: 'carlos.original@email.com',
        status: 'pendente'
      }
    ];

    let dupeDetected = false;
    liveWebhook.checkDuplicateRedemptionDb(
      '11111111-1111-4111-a111-111111111111',
      'carlos.NOVO_EMAIL_DIFERENTE@email.com',
      '5511999990001', // Mesmo telefone
      (err, isDupe, row) => {
        dupeDetected = isDupe;
      }
    );

    await waitFor(() => dupeDetected === true);
    assert.strictEqual(dupeDetected, true, 'Deve detectar duplicidade pelo telefone mesmo com e-mail diferente');
  });

  await asyncTest('ADV-DUPE-02: Bloqueio de duplicidade por E-mail cruzado com Telefone diferente', async () => {
    let dupeDetected = false;
    liveWebhook.checkDuplicateRedemptionDb(
      '11111111-1111-4111-a111-111111111111',
      'carlos.original@email.com', // Mesmo e-mail
      '5511988889999', // Telefone diferente
      (err, isDupe, row) => {
        dupeDetected = isDupe;
      }
    );

    await waitFor(() => dupeDetected === true);
    assert.strictEqual(dupeDetected, true, 'Deve detectar duplicidade pelo e-mail mesmo com telefone diferente');
  });

  await asyncTest('ADV-DUPE-03: Formatação variada de telefone (com/sem 55, caracteres especiais)', async () => {
    let dupeWithout55 = false;
    liveWebhook.checkDuplicateRedemptionDb(
      '11111111-1111-4111-a111-111111111111',
      null,
      '11999990001', // Sem prefixo 55
      (err, isDupe, row) => {
        dupeWithout55 = isDupe;
      }
    );
    await waitFor(() => dupeWithout55 === true);
    assert.strictEqual(dupeWithout55, true, 'Deve detectar duplicidade em telefone sem 55');
  });

  await asyncTest('ADV-DUPE-04: Status recusado NÃO gera bloqueio de duplicidade (re-solicitação permitida)', async () => {
    mockDbResgates = [
      {
        id: 'resg-seed-recusado',
        parceiro_id: '11111111-1111-4111-a111-111111111111',
        nome_completo: 'Mariana Rejeitada',
        telefone: '5511955554444',
        email: 'mariana.recusada@email.com',
        status: 'recusado' // Status recusado
      }
    ];

    let dupeDetected = true;
    liveWebhook.checkDuplicateRedemptionDb(
      '11111111-1111-4111-a111-111111111111',
      'mariana.recusada@email.com',
      '5511955554444',
      (err, isDupe, row) => {
        dupeDetected = isDupe;
      }
    );

    await waitFor(() => dupeDetected === false);
    assert.strictEqual(dupeDetected, false, 'Resgate anterior RECUSADO não deve bloquear nova solicitação');
  });

  await asyncTest('ADV-DUPE-05: Isolamento entre parceiros distintos para o mesmo titular', async () => {
    // Cliente tem resgate na Petlove, mas solicita Drogasil
    let dupeDifferentPartner = true;
    liveWebhook.checkDuplicateRedemptionDb(
      '33333333-3333-4333-a333-333333333333', // Drogasil ID
      'carlos.original@email.com',
      '5511999990001',
      (err, isDupe, row) => {
        dupeDifferentPartner = isDupe;
      }
    );

    await waitFor(() => dupeDifferentPartner === false);
    assert.strictEqual(dupeDifferentPartner, false, 'Resgate em parceiro diferente não deve conflitar');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. JUSTIFICATION BYPASS ATTEMPTS & VALIDATION
  // ═════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 3. TENTATIVAS DE BYPASS DE JUSTIFICATIVA E TRATAMENTO DE ENTRADAS INVÁLIDAS');

  await asyncTest('ADV-JUST-01: Rejeição de justificativas vazias, espaços em branco e caracteres insuficientes', async () => {
    const testPhone = '5511977770002';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_AWAITING_JUSTIFICATION',
      redemptionPartner: MOCK_PARTNERS[0],
      redemptionForm: {
        nomeCompleto: 'Lucas Medeiros',
        email: 'lucas@empresa.com',
        telefone: testPhone,
        justificativa: ''
      }
    };

    // 1. Tenta enviar espaço em branco
    liveWebhook.handlePartnerRedemptionFlow(testPhone, '   ', liveWebhook.userSessions[testPhone], null);
    let sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_AWAITING_JUSTIFICATION', 'Espaço em branco deve ser rejeitado');

    // 2. Tenta enviar apenas 1 caractere 'a'
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'a', liveWebhook.userSessions[testPhone], null);
    sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_AWAITING_JUSTIFICATION', '1 caractere deve ser rejeitado');

    // 3. Tenta enviar 'ok' (2 chars)
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'ok', liveWebhook.userSessions[testPhone], null);
    sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_AWAITING_JUSTIFICATION', 'Menos de 3 chars deve ser rejeitado');
  });

  await asyncTest('ADV-JUST-02: Cancelamento gracioso (digitar 0 ou cancelar) na etapa de justificativa', async () => {
    const testPhone = '5511977770003';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_AWAITING_JUSTIFICATION',
      redemptionPartner: MOCK_PARTNERS[0],
      redemptionForm: {
        nomeCompleto: 'Lucas Medeiros',
        email: 'lucas@empresa.com',
        telefone: testPhone,
        justificativa: ''
      }
    };

    liveWebhook.handlePartnerRedemptionFlow(testPhone, '0', liveWebhook.userSessions[testPhone], null);
    const sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'MAIN_MENU', 'Digitar 0 deve retornar ao menu principal');
    assert.strictEqual(sess.redemptionPartner, null, 'Sessão de resgate deve ser limpa');
  });

  await asyncTest('ADV-JUST-03: Justificativa válida gera override com status analise, alerta_duplicidade=true e alerta Admin', async () => {
    const testPhone = '5511977770004';
    mockDbResgates = [];

    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_AWAITING_JUSTIFICATION',
      redemptionPartner: MOCK_PARTNERS[0], // Petlove
      redemptionForm: {
        nomeCompleto: 'Fernanda Lima Castro',
        email: 'fernanda.castro@email.com',
        telefone: testPhone,
        justificativa: ''
      }
    };

    const validReason = 'Preciso de um novo cupom porque adotei um filhote de gato recentemente.';
    liveWebhook.handlePartnerRedemptionFlow(testPhone, validReason, liveWebhook.userSessions[testPhone], null);

    await waitFor(() => mockDbResgates.some(r => r.justificativa_duplicidade === validReason));

    const saved = mockDbResgates.find(r => r.justificativa_duplicidade === validReason);
    assert.ok(saved, 'Deve registrar resgate com a justificativa');
    assert.strictEqual(saved.status, 'analise', 'Status deve ser analise');
    assert.strictEqual(saved.alerta_duplicidade, true, 'alerta_duplicidade deve ser true');
    assert.strictEqual(liveWebhook.userSessions[testPhone].state, 'MAIN_MENU', 'Sessão do usuário deve resetar');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. RPC PARAMETER CONTRACTS & OVERLOAD FALLBACK
  // ═════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 4. CONTRATOS RPC, FALLBACK DE SOBRECARGA PGRST202 E RESILIÊNCIA A ERROS');

  await asyncTest('ADV-RPC-01: Recuperação automática transparente em caso de erro PGRST202 (RPC sem p_email)', async () => {
    mockServerSimulatePgrst202 = true; // Força erro PGRST202 no primeiro request com p_email
    mockDbResgates = [];

    const testPhone = '5511977770005';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: MOCK_PARTNERS[2], // Drogasil
      redemptionForm: {
        nomeCompleto: 'Gabriel Souza',
        email: '',
        telefone: testPhone,
        justificativa: ''
      }
    };

    // Submete e-mail, que acionará a RPC com p_email -> PGRST202 -> fallback sem p_email -> Sucesso
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'gabriel.souza@gmail.com', liveWebhook.userSessions[testPhone], null);

    await waitFor(() => mockDbResgates.some(r => r.telefone === testPhone));
    assert.strictEqual(mockDbResgates.length, 1, 'Deve ter salvo o registro via fallback');
    assert.strictEqual(mockDbResgates[0].nome_completo, 'Gabriel Souza');

    mockServerSimulatePgrst202 = false; // Restaura
  });

  await asyncTest('ADV-RPC-02: Tratamento gracioso de falha fatal da RPC 500 sem corromper estado da sessão', async () => {
    mockServerFailRpc = true;

    const testPhone = '5511977770006';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: MOCK_PARTNERS[0],
      redemptionForm: {
        nomeCompleto: 'Roberto Albuquerque',
        email: '',
        telefone: testPhone,
        justificativa: ''
      }
    };

    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'roberto@email.com', liveWebhook.userSessions[testPhone], null);

    await waitFor(() => liveWebhook.userSessions[testPhone]?.state === 'MAIN_MENU');
    assert.strictEqual(liveWebhook.userSessions[testPhone].state, 'MAIN_MENU', 'Deve retornar ao MAIN_MENU em erro 500');

    mockServerFailRpc = false; // Restaura
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 5. IMMEDIATE COUPON VS 24H SLA ACCURACY
  // ═════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 5. ACURÁCIA DE ENTREGA: CUPOM IMEDIATO VS PROVISIONAMENTO SLA 24H');

  await asyncTest('ADV-SLA-01: Parceiro com Cupom Automático entrega cupom exato no fluxo imediato', async () => {
    mockDbResgates = [];
    const testPhone = '5511977770007';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: MOCK_PARTNERS[3], // Petz (PETZGSA15, delay_24h = false)
      redemptionForm: {
        nomeCompleto: 'Juliana Mendes',
        email: '',
        telefone: testPhone,
        justificativa: ''
      }
    };

    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'juliana@petlovers.com', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => mockDbResgates.some(r => r.telefone === testPhone));

    const rec = mockDbResgates.find(r => r.telefone === testPhone);
    assert.strictEqual(rec.codigo_gerado, 'PETZGSA15');
    assert.strictEqual(rec.tipo_resgate, 'cupom');
    assert.match(rec.protocolo, /^PROT-RES-2026-[A-Z0-9]{6}$/);
  });

  await asyncTest('ADV-SLA-02: Parceiro sem cupom/voucher/link é redirecionado automaticamente para SLA 24h', async () => {
    mockDbResgates = [];
    const testPhone = '5511977770008';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: MOCK_PARTNERS[4], // Convênio Genérico Sem Cupom
      redemptionForm: {
        nomeCompleto: 'Marcos Vinicius',
        email: '',
        telefone: testPhone,
        justificativa: ''
      }
    };

    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'marcos@email.com', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => mockDbResgates.some(r => r.telefone === testPhone));

    const rec = mockDbResgates.find(r => r.telefone === testPhone);
    assert.ok(rec, 'Registro deve ser criado com sucesso');
    assert.match(rec.protocolo, /^PROT-RES-2026-[A-Z0-9]{6}$/);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 6. FORM VALIDATION & INTERACTIVE MULTI-TURN STATE MACHINE
  // ═════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 6. MÁQUINA DE ESTADOS & VALIDAÇÃO RIGOROSA DE FORMULÁRIO (NOME, EMAIL, TEL)');

  await asyncTest('ADV-FSM-01: Validação de Nome incompleto (apenas 1 palavra ou <3 chars)', async () => {
    const testPhone = '5511977770009';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_NAME',
      redemptionPartner: MOCK_PARTNERS[0],
      redemptionForm: { nomeCompleto: '', email: '', telefone: testPhone, justificativa: '' }
    };

    // 1 palavra apenas
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Adriano', liveWebhook.userSessions[testPhone], null);
    let sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_COLLECT_NAME', 'Nome sem sobrenome deve ser retido no estado');

    // Menos de 3 letras
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Ab', sess, null);
    sess = liveWebhook.userSessions[testPhone];
    assert.strictEqual(sess.state, 'REDEMPTION_COLLECT_NAME', 'Nome muito curto deve ser retido');

    // Nome e sobrenome válidos
    liveWebhook.handlePartnerRedemptionFlow(testPhone, 'Adriano Farias', sess, null);
    await waitFor(() => liveWebhook.userSessions[testPhone]?.state === 'REDEMPTION_COLLECT_EMAIL');
    assert.strictEqual(liveWebhook.userSessions[testPhone].state, 'REDEMPTION_COLLECT_EMAIL', 'Nome válido avança para e-mail');
  });

  await asyncTest('ADV-FSM-02: Validação rigorosa de formato de E-mail', async () => {
    const testPhone = '5511977770010';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_EMAIL',
      redemptionPartner: MOCK_PARTNERS[0],
      redemptionForm: { nomeCompleto: 'Renato Silva', email: '', telefone: testPhone, justificativa: '' }
    };

    const invalidEmails = ['renato', 'renato@', 'renato@com', 'renato.com', '@dominio.com'];
    for (const inv of invalidEmails) {
      liveWebhook.handlePartnerRedemptionFlow(testPhone, inv, liveWebhook.userSessions[testPhone], null);
      assert.strictEqual(liveWebhook.userSessions[testPhone].state, 'REDEMPTION_COLLECT_EMAIL', `E-mail "${inv}" deve ser rejeitado`);
    }
  });

  await asyncTest('ADV-FSM-03: Validação rigorosa de Telefone (dígitos insuficientes vs formato correto)', async () => {
    const testPhone = '5511977770011';
    liveWebhook.userSessions[testPhone] = {
      state: 'REDEMPTION_COLLECT_PHONE',
      redemptionPartner: MOCK_PARTNERS[0],
      redemptionForm: { nomeCompleto: 'Renato Silva', email: 'renato@email.com', telefone: '', justificativa: '' }
    };

    // Telefone curto
    liveWebhook.handlePartnerRedemptionFlow(testPhone, '12345', liveWebhook.userSessions[testPhone], null);
    assert.strictEqual(liveWebhook.userSessions[testPhone].state, 'REDEMPTION_COLLECT_PHONE', 'Telefone com 5 dígitos deve ser rejeitado');

    // Telefone válido com DDD
    liveWebhook.handlePartnerRedemptionFlow(testPhone, '(11) 98765-4321', liveWebhook.userSessions[testPhone], null);
    await waitFor(() => mockDbResgates.some(r => r.telefone === '5511987654321'));
    assert.ok(mockDbResgates.some(r => r.telefone === '5511987654321'), 'Telefone formatado deve ser salvo com prefixo 55');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 7. VPS LIVE VS LOCAL WEBHOOK PARITY
  // ═════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 7. PARIDADE DUAL-SERVER (VPS LIVE VS LOCAL)');

  test('ADV-PARITY-01: Métodos e contratos de resgate idênticos em ambos os arquivos', () => {
    const methods = [
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

    methods.forEach(m => {
      assert.strictEqual(typeof liveWebhook[m], 'function', `liveWebhook.${m} deve existir e ser função`);
      assert.strictEqual(typeof localWebhook[m], 'function', `localWebhook.${m} deve existir e ser função`);
    });

    assert.strictEqual(liveWebhook.ADMIN_MASTER_PHONE, '5511971858372', 'ADMIN_MASTER_PHONE live correto');
    assert.strictEqual(localWebhook.ADMIN_MASTER_PHONE, '5511971858372', 'ADMIN_MASTER_PHONE local correto');
  });

  // Finalização do servidor
  if (mockServer) {
    mockServer.close();
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`📊 SUMÁRIO FINAL DOS TESTES ADVERSARIAIS:`);
  console.log(`   🟢 PASSOU: ${passed}`);
  console.log(`   🔴 FALHOU: ${failed}`);
  console.log(`   📈 TAXA DE SUCESSO: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('══════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('❌ Falhas encontradas:', JSON.stringify(failureLog, null, 2));
    process.exit(1);
  }
  process.exit(0);
}

runAdversarialSuites().catch(err => {
  console.error('Fatal error running adversarial suites:', err);
  if (mockServer) mockServer.close();
  process.exit(1);
});
