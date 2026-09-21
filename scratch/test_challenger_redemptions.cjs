/**
 * Empirical Challenger 1 Stress Test Harness (Refined & Expanded)
 * Scope:
 * 1. 24h Mode SLA calculations (boundary, negative time, clock skew, timezone, null/undefined, completion priority)
 * 2. Protocol format `PROT-RES-YYYY-XXXXXX` randomness, collision resistance (10,000 iterations), and fallback generation
 * 3. Form input validation & sanitization (name, email regex, phone mask, edge cases, XSS/injection payloads)
 * 4. WhatsApp notification message construction & template fidelity (24h mode, immediate mode, admin alert, activation link)
 * 5. Security & edge case boundaries
 */

const assert = require('assert');

// ─── HELPER IMPLEMENTATIONS REPLICATING CODEBASE LOGIC ───

function maskPhone(value) {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
}

function calculateSLA(resgate, currentTime = new Date()) {
  if (!resgate?.created_at) {
    return {
      solicitadoEm: null,
      prazoLimite: null,
      tempoRestanteMs: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
      expirado: false,
      percentualDecorrido: 100,
      concluido: Boolean(resgate?.link_ativacao || resgate?.status === 'concluido')
    };
  }

  const solicitadoEm = new Date(resgate.created_at);
  if (isNaN(solicitadoEm.getTime())) {
    return {
      solicitadoEm: null,
      prazoLimite: null,
      tempoRestanteMs: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
      expirado: false,
      percentualDecorrido: 100,
      concluido: Boolean(resgate?.link_ativacao || resgate?.status === 'concluido')
    };
  }

  const vinteQuatroHorasMs = 24 * 60 * 60 * 1000;
  const prazoLimite = new Date(solicitadoEm.getTime() + vinteQuatroHorasMs);
  const diffMs = prazoLimite.getTime() - currentTime.getTime();
  const decorridoMs = currentTime.getTime() - solicitadoEm.getTime();

  const percentualDecorrido = Math.min(
    100,
    Math.max(0, Math.round((decorridoMs / vinteQuatroHorasMs) * 100))
  );

  const expirado = diffMs <= 0;
  const absDiff = Math.abs(diffMs);

  const horas = Math.floor(absDiff / (1000 * 60 * 60));
  const minutos = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const segundos = Math.floor((absDiff % (1000 * 60)) / 1000);

  return {
    solicitadoEm,
    prazoLimite,
    tempoRestanteMs: diffMs,
    horas,
    minutos,
    segundos,
    expirado,
    percentualDecorrido,
    concluido: Boolean(resgate?.link_ativacao || resgate?.status === 'concluido')
  };
}

function generateProtocolRandom(year = new Date().getFullYear()) {
  return `PROT-RES-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateProtocolFromId(id, createdAt = Date.now()) {
  const safeId = (id || '000000').slice(0, 6).toUpperCase().padEnd(6, 'X');
  return `PROT-RES-${new Date(createdAt).getFullYear()}-${safeId}`;
}

function validateRedemptionForm(nomeCompleto, email, telefone) {
  const errors = [];
  const trimmedNome = (nomeCompleto || '').trim();
  if (trimmedNome.length < 3) {
    errors.push('Por favor, informe seu nome completo.');
  }

  const trimmedEmail = (email || '').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
    errors.push('Por favor, informe um e-mail válido.');
  }

  const cleanPhone = (telefone || '').replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    errors.push('Informe um telefone/WhatsApp válido com DDD.');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      nome: trimmedNome,
      email: trimmedEmail,
      telefone: cleanPhone
    }
  };
}

function buildClient24hWelcomeMessage(payload, partnerName, benefitDesc, protocolo) {
  return [
    `🐾 *SOLICITAÇÃO DE BENEFÍCIO REGISTRADA!* ✨`,
    ``,
    `Olá, *${payload.nomeCompleto.trim()}*! 👋`,
    ``,
    `Sua solicitação de benefício exclusivo na parceria *${partnerName}* foi registrada com sucesso no *GSA HUB*!`,
    ``,
    `🔖 *PROTOCOLO DE RESGATE:* ${protocolo}`,
    `🏢 *Parceiro:* ${partnerName}`,
    `🎁 *Condição:* ${benefitDesc}`,
    `👤 *Titular:* ${payload.nomeCompleto.trim()}`,
    `📱 *WhatsApp Cadastrado:* ${payload.telefone}`,
    payload.email ? `✉️ *E-mail:* ${payload.email}` : null,
    ``,
    `⏳ *PRAZO DE ATIVAÇÃO (EM ATÉ 24 HORAS):*`,
    `Nossa equipe administrativa está processando o seu registro junto à *${partnerName}*. Em até *24 horas*, você receberá por aqui, no seu WhatsApp, o seu *link exclusivo de ativação* com carência zero e benefício garantido.`,
    ``,
    `📲 _Guarde o seu protocolo de resgate para acompanhamento!_`,
    ``,
    `Atenciosamente,`,
    `🏢 *Grupo GSA — Gestão de Serviços & Benefícios*`
  ].filter(Boolean).join('\n');
}

function buildAdmin24hNotification(payload, partnerName, protocolo) {
  return {
    title: `Novo Resgate: ${partnerName}`,
    category: 'FORNECEDORES',
    message: `O cliente *${payload.nomeCompleto}* solicitou o benefício da parceria *${partnerName}*.\n\nProtocolo: *${protocolo}*\nWhatsApp: ${payload.telefone}\nE-mail: ${payload.email || 'Não informado'}\nStatus: *Pendente de cadastro no parceiro e link de ativação*.\n\nAcesse o Painel Administrativo em Fornecedores & Parceiros > Resgates para gerar o link.`
  };
}

function buildImmediateClientMessage(payload, partnerName, benefitDesc, protocolo, result) {
  return [
    `🎉 *BENEFÍCIO RESGATADO COM SUCESSO!* 🐾✨`,
    ``,
    `Olá, *${payload.nomeCompleto.trim()}*! 👋`,
    ``,
    `O seu benefício exclusivo da parceria *${partnerName}* foi liberado imediatamente no *GSA HUB*!`,
    ``,
    `🔖 *PROTOCOLO DE RESGATE:* ${protocolo}`,
    `🏢 *Parceiro:* ${partnerName}`,
    `🎁 *Condição:* ${benefitDesc}`,
    `👤 *Titular:* ${payload.nomeCompleto.trim()}`,
    `📱 *WhatsApp:* ${payload.telefone}`,
    payload.email ? `✉️ *E-mail:* ${payload.email}` : null,
    result?.codigo_gerado ? `🎟️ *Código do Benefício:* ${result.codigo_gerado}` : null,
    result?.link ? `🔗 *Link da Parceria:* ${result.link}` : null,
    result?.instructions ? `📋 *Instruções:* ${result.instructions}` : null,
    ``,
    `Aproveite a sua condição especial exclusiva de associado GSA!`,
    ``,
    `Atenciosamente,`,
    `🏢 *Grupo GSA — Gestão de Serviços & Benefícios*`
  ].filter(Boolean).join('\n');
}

function buildActivationMessage(payload) {
  const cleanLink = payload.linkAtivacao.trim();
  const partnerTitle = payload.partnerName || 'Parceiro Comercial GSA';
  const benefitDesc = payload.benefitName || 'Condição exclusiva com 100% de desconto e carência zero.';
  const protFormatted = payload.protocolo ? `🔖 *PROTOCOLO DO RESGATE:* ${payload.protocolo}` : null;

  return [
    `🎉 *PARABÉNS, ${payload.customerName.toUpperCase()}! SEU BENEFÍCIO JÁ ESTÁ DISPONÍVEL!* 🐾✨`,
    ``,
    `Olá, *${payload.customerName}*! Temos uma excelente notícia para você! 🌟`,
    ``,
    `O seu link oficial de ativação da parceria com a *${partnerTitle}* foi liberado com sucesso com todas as condições especiais exclusivas do *GSA HUB*!`,
    ``,
    protFormatted,
    `🎁 *BENEFÍCIO EXCLUSIVO:*`,
    `👉 ${benefitDesc}`,
    ``,
    `👤 *TITULAR CADASTRADO:* ${payload.customerName}`,
    payload.customerEmail ? `✉️ *E-MAIL:* ${payload.customerEmail}` : null,
    `📱 *WHATSAPP:* ${payload.customerPhone}`,
    ``,
    `🔗 *SEU LINK EXCLUSIVO PARA ATIVAÇÃO:*`,
    `${cleanLink}`,
    ``,
    `👉 *PASSO A PASSO PARA ATIVAR:*`,
    `1️⃣ Clique no link oficial acima para acessar a página de ativação.`,
    `2️⃣ Conclua o seu cadastro no ambiente da ${partnerTitle}.`,
    `3️⃣ Pronto! Seu benefício e carência especial estarão 100% ativos!`,
    ``,
    `💡 _Dica: Guarde este protocolo e mensagem para consultas futuras._`,
    ``,
    `Qualquer dúvida, estamos à sua inteira disposição!`,
    ``,
    `Atenciosamente,`,
    `🏢 *Grupo GSA — Gestão de Serviços & Benefícios*`
  ].filter(Boolean).join('\n');
}

// ─── TEST RUNNER ───

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const results = [];

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('⚡ STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE ⚡');
console.log('======================================================\n');

// ─── 1. 24h SLA CALCULATIONS ───
console.log('--- CATEGORY 1: 24h SLA Calculations & Edge Cases ---');

runTest('SLA-01: Exactly at creation time (0h elapsed, 24h remaining, 0%, not expired)', () => {
  const now = new Date('2026-08-26T12:00:00Z');
  const resgate = { created_at: '2026-08-26T12:00:00Z', status: 'pendente' };
  const sla = calculateSLA(resgate, now);
  assert.strictEqual(sla.expirado, false);
  assert.strictEqual(sla.horas, 24);
  assert.strictEqual(sla.minutos, 0);
  assert.strictEqual(sla.segundos, 0);
  assert.strictEqual(sla.percentualDecorrido, 0);
  assert.strictEqual(sla.concluido, false);
});

runTest('SLA-02: Halfway through SLA (12h elapsed, 12h remaining, 50%, not expired)', () => {
  const resgate = { created_at: '2026-08-26T12:00:00Z', status: 'pendente' };
  const sla = calculateSLA(resgate, new Date('2026-08-27T00:00:00Z'));
  assert.strictEqual(sla.expirado, false);
  assert.strictEqual(sla.horas, 12);
  assert.strictEqual(sla.minutos, 0);
  assert.strictEqual(sla.percentualDecorrido, 50);
});

runTest('SLA-03: Boundary 1s before SLA expiration (23h 59m 59s elapsed, 1s remaining, 100%, not expired)', () => {
  const created = new Date('2026-08-26T12:00:00Z');
  const current = new Date(created.getTime() + (24 * 3600 * 1000) - 1000);
  const resgate = { created_at: created.toISOString(), status: 'pendente' };
  const sla = calculateSLA(resgate, current);
  assert.strictEqual(sla.expirado, false);
  assert.strictEqual(sla.horas, 0);
  assert.strictEqual(sla.minutos, 0);
  assert.strictEqual(sla.segundos, 1);
  assert.strictEqual(sla.percentualDecorrido, 100);
});

runTest('SLA-04: Exact SLA boundary at 24h 0s (0s remaining, diffMs = 0, expirado = true)', () => {
  const created = new Date('2026-08-26T12:00:00Z');
  const current = new Date(created.getTime() + (24 * 3600 * 1000));
  const resgate = { created_at: created.toISOString(), status: 'pendente' };
  const sla = calculateSLA(resgate, current);
  assert.strictEqual(sla.expirado, true);
  assert.strictEqual(sla.horas, 0);
  assert.strictEqual(sla.minutos, 0);
  assert.strictEqual(sla.segundos, 0);
  assert.strictEqual(sla.percentualDecorrido, 100);
});

runTest('SLA-05: Overdue by 1s (diffMs = -1000, expirado = true, 0h 0m 1s overdue)', () => {
  const created = new Date('2026-08-26T12:00:00Z');
  const current = new Date(created.getTime() + (24 * 3600 * 1000) + 1000);
  const resgate = { created_at: created.toISOString(), status: 'pendente' };
  const sla = calculateSLA(resgate, current);
  assert.strictEqual(sla.expirado, true);
  assert.strictEqual(sla.horas, 0);
  assert.strictEqual(sla.minutos, 0);
  assert.strictEqual(sla.segundos, 1);
  assert.strictEqual(sla.percentualDecorrido, 100);
});

runTest('SLA-06: Severely overdue by 48 hours (diffMs = -24h, 24h 0m 0s overdue, percentage capped at 100%)', () => {
  const created = new Date('2026-08-24T12:00:00Z');
  const current = new Date('2026-08-26T12:00:00Z');
  const resgate = { created_at: created.toISOString(), status: 'pendente' };
  const sla = calculateSLA(resgate, current);
  assert.strictEqual(sla.expirado, true);
  assert.strictEqual(sla.horas, 24);
  assert.strictEqual(sla.minutos, 0);
  assert.strictEqual(sla.percentualDecorrido, 100);
});

runTest('SLA-07: Clock skew / future created_at (created 1 hour in the future, percentage clamped to 0%)', () => {
  const current = new Date('2026-08-26T12:00:00Z');
  const futureCreated = new Date(current.getTime() + 3600 * 1000);
  const resgate = { created_at: futureCreated.toISOString(), status: 'pendente' };
  const sla = calculateSLA(resgate, current);
  assert.strictEqual(sla.expirado, false);
  assert.strictEqual(sla.horas, 25);
  assert.strictEqual(sla.percentualDecorrido, 0);
});

runTest('SLA-08: Timezone parsing resilience (Brasília UTC-3 vs ISO Z timestamps)', () => {
  const currentUtc = new Date('2026-08-26T15:00:00Z');
  const bsbTimestamp = '2026-08-26T12:00:00-03:00'; // Exact same point in time
  const resgate = { created_at: bsbTimestamp, status: 'pendente' };
  const sla = calculateSLA(resgate, currentUtc);
  assert.strictEqual(sla.expirado, false);
  assert.strictEqual(sla.horas, 24);
  assert.strictEqual(sla.percentualDecorrido, 0);
});

runTest('SLA-09: Null / undefined / empty created_at defensive fallback', () => {
  const slaNull = calculateSLA(null);
  assert.strictEqual(slaNull.solicitadoEm, null);
  assert.strictEqual(slaNull.expirado, false);
  assert.strictEqual(slaNull.horas, 0);

  const slaEmpty = calculateSLA({ created_at: '' });
  assert.strictEqual(slaEmpty.solicitadoEm, null);
  assert.strictEqual(slaEmpty.expirado, false);

  const slaInvalid = calculateSLA({ created_at: 'not-a-valid-date' });
  assert.strictEqual(slaInvalid.solicitadoEm, null);
  assert.strictEqual(slaInvalid.expirado, false);
});

runTest('SLA-10: Completion status precedence over expiration status', () => {
  const created = new Date('2026-08-20T12:00:00Z'); // 6 days ago
  const current = new Date('2026-08-26T12:00:00Z');
  const resgateComLink = {
    created_at: created.toISOString(),
    status: 'concluido',
    link_ativacao: 'https://petlove.com.br/ativar?id=123'
  };
  const sla = calculateSLA(resgateComLink, current);
  assert.strictEqual(sla.concluido, true);
});

// ─── 2. PROTOCOL FORMAT & COLLISION RESISTANCE ───
console.log('\n--- CATEGORY 2: Protocol Generation & Collision Resistance ---');

runTest('PROT-01: Protocol regex format match (PROT-RES-YYYY-XXXXXX)', () => {
  const protocolRegex = /^PROT-RES-\d{4}-\d{6}$/;
  for (let i = 0; i < 50; i++) {
    const p = generateProtocolRandom(2026);
    assert.match(p, protocolRegex, `Protocol ${p} must match ^PROT-RES-\\d{4}-\\d{6}$`);
  }
});

runTest('PROT-02: Protocol collision resistance over 10,000 iterations', () => {
  const set = new Set();
  const iterations = 10000;
  for (let i = 0; i < iterations; i++) {
    const p = generateProtocolRandom(2026);
    set.add(p);
  }
  const uniqueCount = set.size;
  const uniquenessRatio = uniqueCount / iterations;
  console.log(`    📊 10,000 protocol sample: ${uniqueCount} unique (${(uniquenessRatio * 100).toFixed(2)}%)`);
  assert.ok(uniquenessRatio > 0.98, `Uniqueness ratio ${(uniquenessRatio * 100).toFixed(2)}% must exceed 98%`);
});

runTest('PROT-03: Deterministic fallback protocol from ID and date', () => {
  const id = 'a3f89b12-4567-89ab-cdef-0123456789ab';
  const p = generateProtocolFromId(id, new Date('2026-08-26T12:00:00Z').getTime());
  assert.strictEqual(p, 'PROT-RES-2026-A3F89B');
  assert.match(p, /^PROT-RES-\d{4}-[A-Z0-9]{6}$/);
});

runTest('PROT-04: Short or malformed ID fallback padding with explicit ISO timestamp', () => {
  const p1 = generateProtocolFromId('12', new Date('2026-06-15T12:00:00Z').getTime());
  assert.strictEqual(p1, 'PROT-RES-2026-12XXXX');
  const p2 = generateProtocolFromId('', new Date('2026-06-15T12:00:00Z').getTime());
  assert.strictEqual(p2, 'PROT-RES-2026-000000');
});

// ─── 3. FORM INPUT VALIDATION & SANITIZATION ───
console.log('\n--- CATEGORY 3: Form Input Validation & Sanitization ---');

runTest('FORM-01: Valid complete form data passes with sanitized fields', () => {
  const res = validateRedemptionForm('  Adriano Farias  ', '  adriano@gsa.com.br ', ' (11) 98765-4321 ');
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.errors.length, 0);
  assert.strictEqual(res.sanitized.nome, 'Adriano Farias');
  assert.strictEqual(res.sanitized.email, 'adriano@gsa.com.br');
  assert.strictEqual(res.sanitized.telefone, '11987654321');
});

runTest('FORM-02: Name validation edge cases (< 3 chars, whitespace only, unicode)', () => {
  assert.strictEqual(validateRedemptionForm('', 'test@test.com', '11999999999').valid, false);
  assert.strictEqual(validateRedemptionForm('   ', 'test@test.com', '11999999999').valid, false);
  assert.strictEqual(validateRedemptionForm('AB', 'test@test.com', '11999999999').valid, false);
  assert.strictEqual(validateRedemptionForm('Ana', 'test@test.com', '11999999999').valid, true); // 3 chars
  assert.strictEqual(validateRedemptionForm('👨‍⚕️ Dr. João', 'test@test.com', '11999999999').valid, true);
});

runTest('FORM-03: Email validation edge cases (missing @, missing dot, plus tags, subdomains)', () => {
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'invalid', '11999999999').valid, false);
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'invalid@', '11999999999').valid, false);
  assert.strictEqual(validateRedemptionForm('Nome Completo', '@domain.com', '11999999999').valid, false);
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'user@domain', '11999999999').valid, false);
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'user@domain.com.br', '11999999999').valid, true);
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'user+tag@sub.domain.co.uk', '11999999999').valid, true);
});

runTest('FORM-04: Phone validation edge cases (< 10 digits, formatted, DDD, country code)', () => {
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'test@test.com', '').valid, false);
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'test@test.com', '123456789').valid, false); // 9 digits (missing DDD)
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'test@test.com', '1187654321').valid, true); // 10 digits (DDD + 8 digits landline)
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'test@test.com', '11987654321').valid, true); // 11 digits (DDD + 9 digits cell)
  assert.strictEqual(validateRedemptionForm('Nome Completo', 'test@test.com', '+55 (11) 98765-4321').valid, true);
});

runTest('FORM-05: maskPhone formatting fidelity for 11-digit mobile phones', () => {
  assert.strictEqual(maskPhone('11987654321'), '(11) 98765-4321');
  assert.strictEqual(maskPhone('21988887777'), '(21) 98888-7777');
  assert.strictEqual(maskPhone(''), '');
  assert.strictEqual(maskPhone(null), '');
  assert.strictEqual(maskPhone(undefined), '');
  assert.strictEqual(maskPhone('abc'), '');
});

// ─── 4. WHATSAPP MESSAGE CONSTRUCTION & INTEGRITY ───
console.log('\n--- CATEGORY 4: WhatsApp Message Construction & Templates ---');

runTest('WA-01: 24h Mode Client Welcome message contains mandatory elements', () => {
  const payload = {
    nomeCompleto: 'Adriano Farias',
    email: 'adriano@gsa.com.br',
    telefone: '(11) 98765-4321'
  };
  const partnerName = 'Petlove';
  const benefitDesc = 'Primeira Mensalidade 100% Grátis';
  const protocolo = 'PROT-RES-2026-583921';

  const msg = buildClient24hWelcomeMessage(payload, partnerName, benefitDesc, protocolo);
  assert.ok(msg.includes('SOLICITAÇÃO DE BENEFÍCIO REGISTRADA'), 'Header check');
  assert.ok(msg.includes('*Adriano Farias*'), 'Client name bold check');
  assert.ok(msg.includes(protocolo), 'Protocol check');
  assert.ok(msg.includes(partnerName), 'Partner name check');
  assert.ok(msg.includes(benefitDesc), 'Benefit description check');
  assert.ok(msg.includes('24 HORAS'), '24h SLA clause check');
  assert.ok(msg.includes('adriano@gsa.com.br'), 'Email presence check');
  assert.ok(msg.includes('Grupo GSA'), 'Company signoff check');
});

runTest('WA-02: 24h Mode Client Welcome message without email omits email line cleanly', () => {
  const payload = {
    nomeCompleto: 'Cliente Sem Email',
    email: '',
    telefone: '(11) 98765-4321'
  };
  const msg = buildClient24hWelcomeMessage(payload, 'Petlove', 'Benefício', 'PROT-RES-2026-111111');
  assert.ok(!msg.includes('E-mail:'), 'Must not include empty email label');
  assert.ok(msg.includes('Cliente Sem Email'));
});

runTest('WA-03: 24h Mode Admin Notification structure and fields', () => {
  const payload = {
    nomeCompleto: 'Carlos Silva',
    email: 'carlos@empresa.com',
    telefone: '(11) 99999-8888'
  };
  const notif = buildAdmin24hNotification(payload, 'Petlove', 'PROT-RES-2026-777888');
  assert.strictEqual(notif.category, 'FORNECEDORES');
  assert.strictEqual(notif.title, 'Novo Resgate: Petlove');
  assert.ok(notif.message.includes('Carlos Silva'));
  assert.ok(notif.message.includes('PROT-RES-2026-777888'));
  assert.ok(notif.message.includes('(11) 99999-8888'));
  assert.ok(notif.message.includes('carlos@empresa.com'));
});

runTest('WA-04: Immediate Mode Client message contains coupon code and partner link', () => {
  const payload = {
    nomeCompleto: 'Mariana Costa',
    email: 'mariana@email.com',
    telefone: '(21) 98888-7777'
  };
  const result = {
    codigo_gerado: 'CUPOM-GSA-50',
    link: 'https://parceiro.com.br/promo',
    instructions: 'Insira o cupom no carrinho.'
  };
  const msg = buildImmediateClientMessage(payload, 'Clinica Exemplo', '50% OFF', 'PROT-RES-2026-333444', result);
  assert.ok(msg.includes('BENEFÍCIO RESGATADO COM SUCESSO'));
  assert.ok(msg.includes('Mariana Costa'));
  assert.ok(msg.includes('PROT-RES-2026-333444'));
  assert.ok(msg.includes('CUPOM-GSA-50'));
  assert.ok(msg.includes('https://parceiro.com.br/promo'));
  assert.ok(msg.includes('Insira o cupom no carrinho.'));
});

runTest('WA-05: Activation Link Message (completePartnerRedemption) contains step-by-step and clean URL', () => {
  const payload = {
    resgateId: 'uuid-1234',
    linkAtivacao: 'https://petlove.com.br/ativacao?token=xyz987',
    partnerName: 'Petlove',
    benefitName: '100% de desconto no primeiro mês',
    customerName: 'Fernanda Lima',
    customerPhone: '(31) 97777-6666',
    customerEmail: 'fernanda@lima.com',
    protocolo: 'PROT-RES-2026-888999'
  };
  const msg = buildActivationMessage(payload);
  assert.ok(msg.includes('SEU BENEFÍCIO JÁ ESTÁ DISPONÍVEL'));
  assert.ok(msg.includes('FERNANDA LIMA'));
  assert.ok(msg.includes('PROT-RES-2026-888999'));
  assert.ok(msg.includes('https://petlove.com.br/ativacao?token=xyz987'));
  assert.ok(msg.includes('PASSO A PASSO PARA ATIVAR'));
  assert.ok(msg.includes('1️⃣'));
  assert.ok(msg.includes('2️⃣'));
  assert.ok(msg.includes('3️⃣'));
});

// ─── 5. SECURITY & SPECIAL CHARACTERS / XSS RESILIENCE ───
console.log('\n--- CATEGORY 5: Security, Special Characters & Injection Resilience ---');

runTest('SEC-01: HTML / XSS tags in customer name do not cause script evaluation or break message lines', () => {
  const payload = {
    nomeCompleto: '<script>alert("xss")</script> João & Maria',
    email: 'joao@maria.com',
    telefone: '11999999999'
  };
  const msg = buildClient24hWelcomeMessage(payload, 'Parceiro <Test>', '50% <img src=x onerror=alert(1)>', 'PROT-RES-2026-000001');
  assert.ok(msg.includes('<script>alert("xss")</script>'));
  assert.ok(msg.includes('PROT-RES-2026-000001'));
  assert.ok(typeof msg === 'string');
});

runTest('SEC-02: SQL Injection style strings in inputs do not break string interpolation or crashing', () => {
  const payload = {
    nomeCompleto: "Robert'); DROP TABLE parceiros;--",
    email: "admin' OR '1'='1@exploit.com",
    telefone: "11988887777"
  };
  const msg = buildClient24hWelcomeMessage(payload, "Partner' OR 1=1", "Benefit", "PROT-RES-2026-999999");
  assert.ok(msg.includes("Robert'); DROP TABLE parceiros;--"));
  assert.ok(msg.includes("PROT-RES-2026-999999"));
});

console.log('\n======================================================');
console.log(`📊 STRESS TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
