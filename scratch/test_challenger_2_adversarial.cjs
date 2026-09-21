const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ─── 1. SIMULATED BACKEND LOGIC & DATA CONTRACTS ───

function resolvePartnerRedemptionMode(partner) {
  const hasCoupon = Boolean(partner.redemption_has_coupon);
  const hasVoucher = Boolean(partner.redemption_has_voucher);
  const hasLink = Boolean(partner.redemption_has_link);
  const hasImmediateActive = hasCoupon || hasVoucher || hasLink;

  let delay24h = Boolean(partner.redemption_delay_24h);
  
  // If no immediate method is configured, system defaults to 24h mode
  if (!hasImmediateActive) {
    delay24h = true;
  }

  let tipoResgate = 'link';
  if (hasCoupon && hasLink) {
    tipoResgate = 'combinado';
  } else if (hasVoucher && hasLink) {
    tipoResgate = 'combinado';
  } else if (hasCoupon) {
    tipoResgate = 'cupom';
  } else if (hasVoucher) {
    tipoResgate = 'voucher';
  } else if (hasLink) {
    tipoResgate = 'link';
  } else {
    tipoResgate = 'atendimento_24h';
  }

  return {
    hasImmediateActive,
    delay24h,
    tipoResgate,
    statusInicial: delay24h ? 'pendente' : 'concluido'
  };
}

function simulateSavePartnerValidation(payload) {
  const errors = [];
  const name = (payload.name || '').trim();
  if (name.length < 2) {
    errors.push('Informe um nome válido para o parceiro.');
  }

  const slug = (payload.slug || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!slug) {
    errors.push('Slug inválido.');
  }

  const hasCoupon = Boolean(payload.redemption_has_coupon);
  const hasVoucher = Boolean(payload.redemption_has_voucher);
  const hasLink = Boolean(payload.redemption_has_link);
  const delay24h = Boolean(payload.redemption_delay_24h);

  // In UI and DB logic: If immediate active, delay_24h must be false
  let resolvedDelay24h = delay24h;
  if (hasCoupon || hasVoucher || hasLink) {
    resolvedDelay24h = false;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      name,
      slug,
      redemption_has_coupon: hasCoupon,
      redemption_coupon_code: hasCoupon ? (payload.redemption_coupon_code || '').trim().toUpperCase() || null : null,
      redemption_has_voucher: hasVoucher,
      redemption_has_link: hasLink,
      redemption_link: hasLink ? (payload.redemption_link || '').trim() || null : null,
      redemption_auto_redirect: Boolean(payload.redemption_auto_redirect),
      redemption_instructions: (payload.redemption_instructions || '').trim() || null,
      redemption_delay_24h: resolvedDelay24h
    }
  };
}

function simulatePublicRedeem(payload, partner) {
  if (!payload.nomeCompleto || payload.nomeCompleto.trim().length < 2) {
    throw new Error('Informe seu nome completo para resgatar o benefício.');
  }
  const cleanPhone = (payload.telefone || '').replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    throw new Error('Informe um telefone com DDD válido para contato.');
  }

  const mode = resolvePartnerRedemptionMode(partner);
  const resgateId = 'res-' + Math.random().toString(36).substring(2, 10);
  const year = new Date().getFullYear();
  const randCode = Math.floor(100000 + Math.random() * 900000);
  const protocolo = 'PROT-RES-' + year + '-' + randCode;

  let codigoGerado = null;
  if (partner.redemption_has_coupon) {
    codigoGerado = partner.redemption_coupon_code || 'GSA-' + partner.slug.toUpperCase().slice(0, 6) + '-' + randCode.toString().slice(0, 4);
  } else if (partner.redemption_has_voucher) {
    codigoGerado = 'VOUCHER-GSA-' + partner.slug.toUpperCase().slice(0, 4) + '-' + randCode.toString().slice(0, 4);
  } else {
    codigoGerado = protocolo;
  }

  // Row inserted into parceiros_resgates
  const dbRow = {
    id: resgateId,
    parceiro_id: partner.id,
    cliente_id: payload.clienteId || null,
    nome_completo: payload.nomeCompleto.trim(),
    email: (payload.email || '').trim() || null,
    telefone: payload.telefone.trim(),
    codigo_gerado: codigoGerado,
    tipo_resgate: mode.tipoResgate,
    link_destino: partner.redemption_link || partner.website || null,
    link_ativacao: null,
    status: mode.statusInicial,
    data_ativacao: null,
    auto_redirecionado: Boolean(partner.redemption_auto_redirect),
    created_at: new Date().toISOString()
  };

  return {
    dbRow,
    rpcResult: {
      success: true,
      resgate_id: resgateId,
      partner_name: partner.name,
      partner_slug: partner.slug,
      benefits: partner.benefits,
      tipo_resgate: mode.tipoResgate,
      codigo_gerado: codigoGerado,
      protocolo,
      has_coupon: Boolean(partner.redemption_has_coupon),
      has_voucher: Boolean(partner.redemption_has_voucher),
      has_link: Boolean(partner.redemption_has_link),
      link: partner.redemption_link || partner.website || null,
      auto_redirect: Boolean(partner.redemption_auto_redirect),
      instructions: partner.redemption_instructions || null,
      delay_24h: mode.delay24h
    }
  };
}

function simulateCompleteRedemption(dbRow, linkAtivacao) {
  const cleanLink = (linkAtivacao || '').trim();
  if (!cleanLink) {
    throw new Error('Informe o link de ativação gerado no site do parceiro.');
  }

  return {
    ...dbRow,
    link_ativacao: cleanLink,
    status: 'concluido',
    data_ativacao: new Date().toISOString()
  };
}

function enrichRedemptionsWithClients(redemptions, clients) {
  return redemptions.map((r) => {
    const cleanPhone = r.telefone ? r.telefone.replace(/\D/g, '') : '';
    const matched = clients.find((c) =>
      (r.cliente_id && c.id === r.cliente_id) ||
      (cleanPhone && c.telefone && c.telefone.replace(/\D/g, '').includes(cleanPhone.slice(-8))) ||
      (r.nome_completo && c.nome && c.nome.toLowerCase().trim() === r.nome_completo.toLowerCase().trim())
    );

    return {
      ...r,
      email: r.email || matched?.email || null,
      telefone: r.telefone || matched?.telefone || '',
      cpf: r.cpf || matched?.cpf || null,
      endereco: r.endereco || matched?.endereco || null,
      cidade: r.cidade || matched?.cidade || null,
      estado: r.estado || matched?.estado || null,
      cep: r.cep || matched?.cep || null
    };
  });
}

// ─── 2. REALTIME SUBSCRIPTION EMULATOR ───

class RealtimeSubscriptionEmulator {
  constructor(configs) {
    this.configs = Array.isArray(configs) ? configs : [configs];
    this.status = 'INITIALIZING';
    this.timers = {};
    this.subscribed = false;
    this.dispatches = [];
    this.subscribers = new Map();
  }

  subscribe() {
    this.status = 'SUBSCRIBED';
    this.subscribed = true;
    return this;
  }

  dispatchPostgresChange(table, eventType, oldRow, newRow) {
    if (!this.subscribed) return;

    this.configs.forEach((config, idx) => {
      if (config.table === table) {
        const payload = {
          schema: config.schema || 'public',
          table,
          eventType,
          old: oldRow,
          new: newRow,
          commit_timestamp: new Date().toISOString()
        };

        if (config.onPayload) {
          config.onPayload(payload);
        }

        if (config.onChange) {
          const debounceMs = config.debounceMs || 0;
          if (debounceMs > 0) {
            if (this.timers[idx]) clearTimeout(this.timers[idx]);
            this.timers[idx] = setTimeout(() => {
              this.timers[idx] = null;
              config.onChange();
            }, debounceMs);
          } else {
            config.onChange();
          }
        }

        this.dispatches.push(payload);
      }
    });
  }

  unsubscribe() {
    Object.values(this.timers).forEach((t) => {
      if (t) clearTimeout(t);
    });
    this.timers = {};
    this.status = 'CLOSED';
    this.subscribed = false;
  }
}

// ─── 3. TEST SUITE EXECUTION ───

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    testResults.push({ name, pass: true });
    console.log('  ✓ [PASS] ' + name);
  } catch (err) {
    failedTests++;
    testResults.push({ name, pass: false, error: err.message });
    console.error('  ✗ [FAIL] ' + name + ': ' + err.message);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    testResults.push({ name, pass: true });
    console.log('  ✓ [PASS] ' + name);
  } catch (err) {
    failedTests++;
    testResults.push({ name, pass: false, error: err.message });
    console.error('  ✗ [FAIL] ' + name + ': ' + err.message);
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('🚀 CHALLENGER 2: ADVERSARIAL VERIFICATION & STRESS TEST HARNESS');
  console.log('================================================================\n');

  // --- SECTION 1: REDEMPTION MODE SWITCHES & TOGGLE LOGIC ---
  console.log('--- DIMENSION 1: Redemption Mode Switches & Mutually Exclusive Toggles ---');

  test('MODE-01: Enabling 24h delay mode when all immediate benefits are false', () => {
    const partner = {
      id: 'p-1',
      name: 'PETLOVE',
      slug: 'petlove',
      redemption_has_coupon: false,
      redemption_has_voucher: false,
      redemption_has_link: false,
      redemption_delay_24h: true
    };
    const mode = resolvePartnerRedemptionMode(partner);
    assert.strictEqual(mode.hasImmediateActive, false);
    assert.strictEqual(mode.delay24h, true);
    assert.strictEqual(mode.tipoResgate, 'atendimento_24h');
    assert.strictEqual(mode.statusInicial, 'pendente');
  });

  test('MODE-02: Partner with coupon benefit forces immediate mode and disables 24h delay in save logic', () => {
    const savePayload = {
      name: 'Pet Shop XYZ',
      slug: 'pet-shop-xyz',
      redemption_has_coupon: true,
      redemption_coupon_code: 'PET20',
      redemption_delay_24h: true
    };
    const validation = simulateSavePartnerValidation(savePayload);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.sanitized.redemption_has_coupon, true);
    assert.strictEqual(validation.sanitized.redemption_coupon_code, 'PET20');
    assert.strictEqual(validation.sanitized.redemption_delay_24h, false);
  });

  test('MODE-03: Partner with no benefits configured automatically falls back to 24h delay mode', () => {
    const partner = {
      id: 'p-2',
      name: 'Academia Fit',
      slug: 'academia-fit',
      redemption_has_coupon: false,
      redemption_has_voucher: false,
      redemption_has_link: false,
      redemption_delay_24h: false
    };
    const mode = resolvePartnerRedemptionMode(partner);
    assert.strictEqual(mode.delay24h, true, 'Must fallback to delay24h = true');
    assert.strictEqual(mode.statusInicial, 'pendente');
  });

  test('MODE-04: Combined redemption type when both coupon and link are provided', () => {
    const partner = {
      id: 'p-3',
      name: 'E-commerce Partner',
      slug: 'ecommerce-partner',
      redemption_has_coupon: true,
      redemption_coupon_code: 'GSA10',
      redemption_has_link: true,
      redemption_link: 'https://partner.com/gsa',
      redemption_auto_redirect: true
    };
    const mode = resolvePartnerRedemptionMode(partner);
    assert.strictEqual(mode.tipoResgate, 'combinado');
    assert.strictEqual(mode.delay24h, false);
    assert.strictEqual(mode.statusInicial, 'concluido');
  });

  test('MODE-05: Dynamic coupon generation when fixed coupon code is empty', () => {
    const partner = {
      id: 'p-4',
      name: 'Veterinária Central',
      slug: 'vet-central',
      redemption_has_coupon: true,
      redemption_coupon_code: null
    };
    const { dbRow, rpcResult } = simulatePublicRedeem(
      { nomeCompleto: 'João da Silva', telefone: '(11) 98888-7777', email: 'joao@silva.com' },
      partner
    );
    assert.ok(dbRow.codigo_gerado.startsWith('GSA-VET-CE') || dbRow.codigo_gerado.startsWith('GSA-'), 'Dynamic code starts with GSA-');
    assert.strictEqual(rpcResult.has_coupon, true);
  });

  // --- SECTION 2: DATA PERSISTENCE IN parceiros_resgates ---
  console.log('\n--- DIMENSION 2: Data Persistence & Lifecycle in parceiros_resgates ---');

  test('PERSIST-01: Full lead data persistence on public redemption (email, status, protocol, phone, name)', () => {
    const partner = {
      id: 'partner-uuid-999',
      name: 'Odonto GSA',
      slug: 'odonto-gsa',
      benefits: '100% gratuito no 1º mês',
      redemption_delay_24h: true
    };
    const customerPayload = {
      nomeCompleto: 'Maria Oliveira Santos',
      email: 'maria.oliveira@empresa.com.br',
      telefone: '(21) 99123-4567',
      clienteId: 'cliente-uuid-111'
    };

    const { dbRow, rpcResult } = simulatePublicRedeem(customerPayload, partner);

    assert.strictEqual(dbRow.parceiro_id, 'partner-uuid-999');
    assert.strictEqual(dbRow.cliente_id, 'cliente-uuid-111');
    assert.strictEqual(dbRow.nome_completo, 'Maria Oliveira Santos');
    assert.strictEqual(dbRow.email, 'maria.oliveira@empresa.com.br');
    assert.strictEqual(dbRow.telefone, '(21) 99123-4567');
    assert.strictEqual(dbRow.status, 'pendente');
    assert.strictEqual(dbRow.link_ativacao, null);
    assert.strictEqual(dbRow.data_ativacao, null);
    assert.match(rpcResult.protocolo, /^PROT-RES-\d{4}-\d{6}$/);
  });

  test('PERSIST-02: Admin complete redemption updates link_ativacao, status to concluido, and sets data_ativacao', () => {
    const initialRow = {
      id: 'res-abc12345',
      parceiro_id: 'partner-uuid-999',
      nome_completo: 'Maria Oliveira Santos',
      email: 'maria.oliveira@empresa.com.br',
      telefone: '(21) 99123-4567',
      status: 'pendente',
      link_ativacao: null,
      data_ativacao: null,
      created_at: new Date('2026-08-26T10:00:00Z').toISOString()
    };

    const completedRow = simulateCompleteRedemption(initialRow, 'https://odonto.com.br/ativacao?id=987654');

    assert.strictEqual(completedRow.status, 'concluido');
    assert.strictEqual(completedRow.link_ativacao, 'https://odonto.com.br/ativacao?id=987654');
    assert.ok(completedRow.data_ativacao !== null, 'data_ativacao timestamp must be recorded');
    assert.ok(new Date(completedRow.data_ativacao).getTime() >= new Date(completedRow.created_at).getTime());
  });

  test('PERSIST-03: Empty linkAtivacao is rejected defensively', () => {
    const initialRow = { id: 'res-1', status: 'pendente' };
    assert.throws(() => {
      simulateCompleteRedemption(initialRow, '   ');
    }, /Informe o link de ativação/);
  });

  test('PERSIST-04: Client profile enrichment matches phone or email when redemption record lacks fields', () => {
    const redemptions = [
      {
        id: 'r-1',
        nome_completo: 'Carlos Mendes',
        telefone: '11977778888',
        email: null,
        cpf: null,
        endereco: null
      },
      {
        id: 'r-2',
        nome_completo: 'Beatriz Costa',
        telefone: '21966665555',
        email: 'beatriz@email.com',
        cpf: null,
        endereco: null
      }
    ];

    const clients = [
      {
        id: 'c-1',
        nome: 'Carlos Mendes',
        telefone: '(11) 97777-8888',
        email: 'carlos.mendes@empresa.com',
        cpf: '123.456.789-00',
        endereco: 'Av. Paulista, 1000',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100'
      },
      {
        id: 'c-2',
        nome: 'Beatriz Costa',
        telefone: '(21) 96666-5555',
        email: 'beatriz@email.com',
        cpf: '987.654.321-99',
        endereco: 'Rua das Flores, 50',
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
        cep: '20000-000'
      }
    ];

    const enriched = enrichRedemptionsWithClients(redemptions, clients);

    assert.strictEqual(enriched[0].email, 'carlos.mendes@empresa.com');
    assert.strictEqual(enriched[0].cpf, '123.456.789-00');
    assert.strictEqual(enriched[0].cidade, 'São Paulo');

    assert.strictEqual(enriched[1].email, 'beatriz@email.com');
    assert.strictEqual(enriched[1].cpf, '987.654.321-99');
    assert.strictEqual(enriched[1].cidade, 'Rio de Janeiro');
  });

  // --- SECTION 3: REAL-TIME LISTENERS & LIFECYCLE ---
  console.log('\n--- DIMENSION 3: Real-Time Listeners & WebSocket Subscription Lifecycle ---');

  await runAsyncTest('RT-01: Real-time subscription dispatches changes on parceiros with debouncing', async () => {
    let partnerReloadCount = 0;
    const emulator = new RealtimeSubscriptionEmulator({
      table: 'parceiros',
      debounceMs: 50,
      onChange: () => {
        partnerReloadCount++;
      }
    });

    emulator.subscribe();
    assert.strictEqual(emulator.status, 'SUBSCRIBED');

    for (let i = 0; i < 5; i++) {
      emulator.dispatchPostgresChange('parceiros', 'UPDATE', { id: 'p-1', name: 'Partner v' + i }, { id: 'p-1', name: 'Partner v' + (i+1) });
    }

    assert.strictEqual(partnerReloadCount, 0);

    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.strictEqual(partnerReloadCount, 1, 'Debounce must coalesce rapid changes into a single execution');

    emulator.unsubscribe();
    assert.strictEqual(emulator.status, 'CLOSED');
  });

  await runAsyncTest('RT-02: Multi-table subscription dispatches separately on parceiros_resgates', async () => {
    let redemptionsTriggered = 0;
    let partnersTriggered = 0;

    const emulator = new RealtimeSubscriptionEmulator([
      {
        table: 'parceiros',
        debounceMs: 30,
        onChange: () => { partnersTriggered++; }
      },
      {
        table: 'parceiros_resgates',
        debounceMs: 30,
        onChange: () => { redemptionsTriggered++; }
      }
    ]);

    emulator.subscribe();

    emulator.dispatchPostgresChange('parceiros_resgates', 'INSERT', null, { id: 'res-new', nome_completo: 'Test User' });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(redemptionsTriggered, 1, 'parceiros_resgates trigger fired');
    assert.strictEqual(partnersTriggered, 0, 'parceiros trigger must remain 0');

    emulator.unsubscribe();
  });

  test('RT-03: Unsubscribing clears all pending debounce timers preventing memory leaks', () => {
    let calledAfterUnmount = false;
    const emulator = new RealtimeSubscriptionEmulator({
      table: 'parceiros',
      debounceMs: 100,
      onChange: () => { calledAfterUnmount = true; }
    });

    emulator.subscribe();
    emulator.dispatchPostgresChange('parceiros', 'UPDATE', {}, {});

    emulator.unsubscribe();
    assert.strictEqual(Object.keys(emulator.timers).length, 0);

    return new Promise((resolve) => {
      setTimeout(() => {
        assert.strictEqual(calledAfterUnmount, false, 'Callback must not fire after unmount/unsubscribe');
        resolve();
      }, 150);
    });
  });

  // --- SECTION 4: SUMMARY ---
  console.log('\n================================================================');
  console.log('📊 ADVERSARIAL STRESS TEST SUMMARY: ' + passedTests + '/' + totalTests + ' TESTS PASSED (' + failedTests + ' FAILED)');
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error in test harness:', err);
  process.exit(1);
});
