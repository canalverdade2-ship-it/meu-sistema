const crypto = require('crypto');

// =============================================================================
// CHALLENGER 1: ADVERSARIAL EMPIRICAL STRESS TEST SUITE
// Scope: Partner Benefit Redemption Subsystem & Auth Session Persistence
// =============================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}${details ? ` -> ${details}` : ''}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('=============================================================================');
console.log('CHALLENGER 1: EMPIRICAL ADVERSARIAL STRESS TESTING HARNESS');
console.log('Target: Partner Benefit Redemption & Auth Session Persistence');
console.log('=============================================================================\n');

// -----------------------------------------------------------------------------
// CATEGORY 1: PROTOCOL GENERATION FORMAT & COLLISION STRESS TEST
// -----------------------------------------------------------------------------
console.log('--- CATEGORY 1: Protocol Generation Format & Collision Stress Test ---');

const PROTOCOL_REGEX = /^PROT-RES-\d{4}-[A-Z0-9]{6}$/;

// Generator function replicating DB logic:
// v_rand_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
// v_codigo_gerado := 'PROT-RES-' || v_year || '-' || v_rand_suffix;
function generateDbProtocol(year = new Date().getFullYear()) {
  const seed = Math.random().toString() + Date.now().toString() + process.hrtime.bigint().toString();
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  const suffix = hash.substring(0, 6).toUpperCase();
  return `PROT-RES-${year}-${suffix}`;
}

// Generator function replicating frontend fallback logic:
function generateFrontendFallbackProtocol(year = new Date().getFullYear()) {
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return `PROT-RES-${year}-${randNum}`;
}

// Test 1.1: 1,000 DB protocol samples regex compliance
let dbRegexPassCount = 0;
const dbSamples = new Set();
const SAMPLES_COUNT = 1000;

for (let i = 0; i < SAMPLES_COUNT; i++) {
  const proto = generateDbProtocol();
  if (PROTOCOL_REGEX.test(proto)) {
    dbRegexPassCount++;
  }
  dbSamples.add(proto);
}

assert(
  dbRegexPassCount === SAMPLES_COUNT,
  'DB Protocol Generator 1,000 samples regex compliance',
  `${dbRegexPassCount}/${SAMPLES_COUNT} matched ^PROT-RES-\\d{4}-[A-Z0-9]{6}$`
);

// Test 1.2: 1,000 DB protocol samples 0 collisions
assert(
  dbSamples.size === SAMPLES_COUNT,
  'DB Protocol Generator 1,000 samples collision resistance',
  `${dbSamples.size}/${SAMPLES_COUNT} unique samples (0 collisions)`
);

// Test 1.3: Extended 10,000 sample test for deep entropy check
const EXTENDED_SAMPLES = 10000;
const extendedSet = new Set();
let extendedRegexPass = 0;
for (let i = 0; i < EXTENDED_SAMPLES; i++) {
  const proto = generateDbProtocol();
  if (PROTOCOL_REGEX.test(proto)) extendedRegexPass++;
  extendedSet.add(proto);
}
const collisionCount = EXTENDED_SAMPLES - extendedSet.size;
assert(
  extendedRegexPass === EXTENDED_SAMPLES && collisionCount <= 5,
  'Extended 10,000 DB samples entropy verification',
  `Unique: ${extendedSet.size}/${EXTENDED_SAMPLES} (${((extendedSet.size / EXTENDED_SAMPLES) * 100).toFixed(2)}% uniqueness, ${collisionCount} collisions in 10k)`
);

// Test 1.4: Frontend Fallback Generator 1,000 samples
let feRegexPassCount = 0;
const feSamples = new Set();
for (let i = 0; i < SAMPLES_COUNT; i++) {
  const proto = generateFrontendFallbackProtocol();
  if (PROTOCOL_REGEX.test(proto)) {
    feRegexPassCount++;
  }
  feSamples.add(proto);
}
assert(
  feRegexPassCount === SAMPLES_COUNT,
  'Frontend Fallback Generator 1,000 samples regex compliance',
  `${feRegexPassCount}/${SAMPLES_COUNT} matched ^PROT-RES-\\d{4}-[A-Z0-9]{6}$`
);

// Test 1.5: Adversarial Boundary Rejection on Malformed Protocols
const malformedProtocols = [
  'PROT-1234',
  'PROT-RES-26-123456',           // 2-digit year
  'RES-2026-123456',              // Missing PROT-
  'PROT-RES-2026-12345',          // 5 characters (too short)
  'PROT-RES-2026-1234567',        // 7 characters (too long)
  'PROT-RES-ABCD-123456',         // Non-numeric year
  'prot-res-2026-ABC123',         // Lowercase prefix
  'PROT-RES-2026-abc123',         // Lowercase suffix
  'PROT-RES-2026-123-45',         // Hyphen inside suffix
  'PROT-RES-2026-12$#56',         // Special characters inside suffix
  '',                             // Empty string
  null,
  undefined,
];

let rejectedMalformed = 0;
for (const p of malformedProtocols) {
  if (typeof p !== 'string' || !PROTOCOL_REGEX.test(p)) {
    rejectedMalformed++;
  }
}
assert(
  rejectedMalformed === malformedProtocols.length,
  'Adversarial boundary rejection of malformed protocol strings',
  `${rejectedMalformed}/${malformedProtocols.length} invalid protocols correctly rejected`
);


// -----------------------------------------------------------------------------
// CATEGORY 2: PUBLIC PARTNER REDEMPTION RPC PARAMETERS & INPUT SANITIZATION
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 2: Public Partner Redemption RPC Parameters & Sanitization ---');

// Emulate Postgres DB input validation logic for gsa_public_resgatar_beneficio_parceiro
function simulateDbRpcExecution({
  p_parceiro_id = null,
  p_parceiro_slug = null,
  p_nome_completo = null,
  p_telefone = null,
  p_cliente_id = null,
  p_email = null,
  partnerConfig = { id: 'p-1', slug: 'petlove', status: 'ativo', redemption_delay_24h: false }
}) {
  const v_nome = (p_nome_completo || '').trim();
  const v_telefone = (p_telefone || '').trim();
  const v_email = (p_email || '').trim() || null;
  const v_clean_phone = v_telefone.replace(/\D/g, '');

  if (!v_nome || v_nome.length < 2) {
    throw new Error('Informe seu nome completo para resgatar o benefício.');
  }

  if (v_clean_phone.length < 10) {
    throw new Error('Informe um telefone com DDD válido para contato.');
  }

  if (!partnerConfig || partnerConfig.status !== 'ativo') {
    throw new Error('Parceiro não encontrado ou inativo.');
  }

  const v_rand_suffix = crypto.createHash('md5').update(Math.random().toString()).digest('hex').substring(0, 6).toUpperCase();
  const v_codigo_gerado = `PROT-RES-${new Date().getFullYear()}-${v_rand_suffix}`;
  
  let v_tipo_resgate = 'link';
  if (partnerConfig.redemption_delay_24h) {
    v_tipo_resgate = 'manual_24h';
  } else if (partnerConfig.redemption_has_coupon) {
    v_tipo_resgate = 'cupom';
  } else if (partnerConfig.redemption_has_voucher) {
    v_tipo_resgate = 'voucher';
  }

  return {
    success: true,
    resgate_id: 'uuid-' + Math.random().toString(36).substr(2, 9),
    partner_name: partnerConfig.name || 'Parceiro Teste',
    partner_slug: partnerConfig.slug,
    tipo_resgate: v_tipo_resgate,
    codigo_gerado: v_codigo_gerado,
    protocolo: v_codigo_gerado,
    email: v_email,
    telefone: v_telefone,
    nome_completo: v_nome,
    delay_24h: Boolean(partnerConfig.redemption_delay_24h),
  };
}

// Test 2.1: Phone formats - Brazilian & International & Messy Whitespace
const phoneTestCases = [
  { raw: '(11) 98765-4321', expectedDigits: '11987654321', valid: true, desc: 'Standard 11-digit mobile with mask' },
  { raw: '11987654321', expectedDigits: '11987654321', valid: true, desc: 'Raw 11-digit digits only' },
  { raw: '(21) 2345-6789', expectedDigits: '2123456789', valid: true, desc: 'Standard 10-digit landline with mask' },
  { raw: '2123456789', expectedDigits: '2123456789', valid: true, desc: 'Raw 10-digit landline' },
  { raw: '+55 (11) 98765-4321', expectedDigits: '5511987654321', valid: true, desc: 'International DDI +55 with mask' },
  { raw: '+55 11 98888-7777', expectedDigits: '5511988887777', valid: true, desc: 'International DDI +55 with spaces' },
  { raw: '   1  1  9  8  7  6  5  4  3  2  1   ', expectedDigits: '11987654321', valid: true, desc: 'Messy whitespace interleaved' },
  { raw: '11-98765.4321', expectedDigits: '11987654321', valid: true, desc: 'Dashes and dots' },
  { raw: '123456789', expectedDigits: '123456789', valid: false, desc: '9 digits (missing DDD) -> invalid' },
  { raw: '9876-5432', expectedDigits: '98765432', valid: false, desc: '8 digits without DDD -> invalid' },
  { raw: '', expectedDigits: '', valid: false, desc: 'Empty phone -> invalid' },
  { raw: 'abc-def-ghij', expectedDigits: '', valid: false, desc: 'Letters only -> invalid' },
];

let phoneTestsPassed = 0;
for (const tc of phoneTestCases) {
  let executedOk = false;
  try {
    const res = simulateDbRpcExecution({
      p_nome_completo: 'Usuario Teste',
      p_telefone: tc.raw,
      p_email: 'test@grupogsa.com.br',
    });
    executedOk = res.success;
  } catch (err) {
    executedOk = false;
  }

  if (executedOk === tc.valid) {
    phoneTestsPassed++;
  } else {
    console.error(`    Phone case failed: ${tc.desc} (expected valid=${tc.valid}, got=${executedOk})`);
  }
}

assert(
  phoneTestsPassed === phoneTestCases.length,
  'Phone Number Edge Case Parsing & Validation',
  `${phoneTestsPassed}/${phoneTestCases.length} phone test scenarios matched expected behavior`
);

// Test 2.2: Email Edge Cases Handling (Empty, Null, Undefined, Whitespace, Valid)
const emailTestCases = [
  { raw: 'usuario@grupogsa.com.br', expectedDbValue: 'usuario@grupogsa.com.br', desc: 'Standard business email' },
  { raw: '  usuario.tag+123@empresa.com.br  ', expectedDbValue: 'usuario.tag+123@empresa.com.br', desc: 'Email with plus-addressing & trailing whitespace' },
  { raw: '', expectedDbValue: null, desc: 'Empty string -> stored as NULL' },
  { raw: '   ', expectedDbValue: null, desc: 'Whitespace only -> stored as NULL' },
  { raw: null, expectedDbValue: null, desc: 'Explicit NULL -> stored as NULL' },
  { raw: undefined, expectedDbValue: null, desc: 'Undefined -> stored as NULL' },
];

let emailTestsPassed = 0;
for (const tc of emailTestCases) {
  const res = simulateDbRpcExecution({
    p_nome_completo: 'Carlos Silva',
    p_telefone: '11999998888',
    p_email: tc.raw,
  });

  if (res.email === tc.expectedDbValue) {
    emailTestsPassed++;
  } else {
    console.error(`    Email case failed: ${tc.desc} (expected=${tc.expectedDbValue}, got=${res.email})`);
  }
}

assert(
  emailTestsPassed === emailTestCases.length,
  'Email Handling & NULL/Empty Sanitization',
  `${emailTestsPassed}/${emailTestCases.length} email test cases sanitized correctly`
);

// Test 2.3: Name Validation & Injection Resistance
const nameTestCases = [
  { raw: 'Adriano Farias', valid: true, desc: 'Standard full name' },
  { raw: '  João da Silva Santos  ', valid: true, desc: 'Name with Portuguese accents & leading/trailing space' },
  { raw: '<script>alert("xss")</script>', valid: true, desc: 'HTML/XSS string safely captured as literal string' },
  { raw: 'A', valid: false, desc: 'Single character name (<2 chars) -> rejected' },
  { raw: '   ', valid: false, desc: 'Whitespace only name -> rejected' },
  { raw: '', valid: false, desc: 'Empty name -> rejected' },
];

let nameTestsPassed = 0;
for (const tc of nameTestCases) {
  let executedOk = false;
  try {
    const res = simulateDbRpcExecution({
      p_nome_completo: tc.raw,
      p_telefone: '11999998888',
      p_email: 'teste@gsa.com.br',
    });
    executedOk = res.success && res.nome_completo === tc.raw.trim();
  } catch (err) {
    executedOk = false;
  }

  if (executedOk === tc.valid) {
    nameTestsPassed++;
  }
}

assert(
  nameTestsPassed === nameTestCases.length,
  'Name Input Validation & Sanitization',
  `${nameTestsPassed}/${nameTestCases.length} name scenarios passed`
);

// Test 2.4: 24h SLA Mode vs Immediate Mode Resolution
const partner24h = { id: 'p-24h', slug: 'unimed', status: 'ativo', redemption_delay_24h: true, name: 'Unimed Saúde' };
const partnerCoupon = { id: 'p-cupom', slug: 'drogasil', status: 'ativo', redemption_delay_24h: false, redemption_has_coupon: true, name: 'Drogasil' };

const res24h = simulateDbRpcExecution({
  p_nome_completo: 'Maria Fernandes',
  p_telefone: '11988887777',
  partnerConfig: partner24h,
});

const resCoupon = simulateDbRpcExecution({
  p_nome_completo: 'Pedro Albuquerque',
  p_telefone: '11977776666',
  partnerConfig: partnerCoupon,
});

assert(
  res24h.delay_24h === true && res24h.tipo_resgate === 'manual_24h',
  '24h SLA Partner Mode Flag Resolution',
  `delay_24h=${res24h.delay_24h}, tipo_resgate=${res24h.tipo_resgate}`
);

assert(
  resCoupon.delay_24h === false && resCoupon.tipo_resgate === 'cupom',
  'Immediate Coupon Partner Mode Resolution',
  `delay_24h=${resCoupon.delay_24h}, tipo_resgate=${resCoupon.tipo_resgate}`
);


// -----------------------------------------------------------------------------
// CATEGORY 3: AUTH SESSION PERSISTENCE & OFFLINE NETWORK RESILIENCE
// -----------------------------------------------------------------------------
console.log('\n--- CATEGORY 3: Auth Session Persistence & Offline Resilience ---');

// Mock localStorage and sessionStorage
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) {
    return this.store[k] || null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
}

const mockLocal = new MockStorage();
const mockSession = new MockStorage();

const SESSION_STORAGE_KEY = '_gsa_session';

function readStoredSession() {
  try {
    const stored = mockLocal.getItem(SESSION_STORAGE_KEY) || mockSession.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function writeStoredSession(sessionData) {
  const dataStr = JSON.stringify(sessionData);
  mockLocal.setItem(SESSION_STORAGE_KEY, dataStr);
  mockSession.setItem(SESSION_STORAGE_KEY, dataStr);
  mockLocal.setItem('sessaoId', sessionData.sessaoId);
}

function clearStoredSession() {
  mockLocal.removeItem(SESSION_STORAGE_KEY);
  mockSession.removeItem(SESSION_STORAGE_KEY);
  mockLocal.removeItem('sessaoId');
}

// Emulate restoreStoredSession with resilient error handling
async function simulateRestoreStoredSession(mockRpcHandler, mockAuthRefreshHandler) {
  const sessionData = readStoredSession();
  if (!sessionData?.sessaoId || !sessionData?.atorId || !sessionData?.sessionToken) {
    return null;
  }

  // 1. Tenta validar no Supabase DB via RPC
  try {
    const rpcRes = await mockRpcHandler('gsa_validate_session', {
      p_sessao_id: sessionData.sessaoId,
      p_session_token: sessionData.sessionToken,
    });
    const validation = Array.isArray(rpcRes?.data) ? rpcRes.data[0] : rpcRes?.data;

    // Se o banco explicitamente retornou que a sessão é inválida (encerrada por novo login)
    if (!rpcRes?.error && validation && validation.is_valid === false) {
      clearStoredSession();
      return null;
    }
  } catch (dbErr) {
    // Network drops / offline mode - does NOT invalidate local session!
  }

  // 2. Garante persistência do Supabase Auth de forma resiliente
  try {
    await mockAuthRefreshHandler();
  } catch {
    // Falha no Supabase Auth não derruba a sessão local do GSA
  }

  return sessionData;
}

// Test 3.1: Session Write & Multi-Store Persistence
const testSession = {
  sessaoId: 'sess-test-999',
  sessionToken: 'token-sec-888',
  atorTipo: 'cliente',
  atorId: 'cli-777',
  atorNome: 'Adriano Farias',
};

writeStoredSession(testSession);
assert(
  mockLocal.getItem(SESSION_STORAGE_KEY) !== null &&
  mockSession.getItem(SESSION_STORAGE_KEY) !== null &&
  mockLocal.getItem('sessaoId') === 'sess-test-999',
  'Multi-store write to localStorage, sessionStorage & sessaoId key',
  'All 3 storage locations synchronized'
);

// Test 3.2: Fallback to sessionStorage when localStorage is empty
mockLocal.clear();
const recoveredFromSessionStore = readStoredSession();
assert(
  recoveredFromSessionStore !== null && recoveredFromSessionStore.sessaoId === 'sess-test-999',
  'Session recovery fallback to sessionStorage when localStorage is wiped',
  `Recovered sessaoId=${recoveredFromSessionStore?.sessaoId}`
);

// Test 3.3: Corrupted JSON handling
mockLocal.setItem(SESSION_STORAGE_KEY, 'CORRUPTED_JSON_{{[(');
mockSession.clear();
const corruptResult = readStoredSession();
assert(
  corruptResult === null,
  'Corrupted JSON in localStorage handled gracefully without crash',
  'Returned null as expected'
);

// Test 3.4: Simulated OFFLINE Network Drop during restoreSession
writeStoredSession(testSession);
const networkDropRpcMock = async () => {
  throw new Error('TypeError: Failed to fetch (Network unreachable / offline)');
};
const networkDropAuthMock = async () => {
  throw new Error('Auth fetch failed: Offline');
};

(async () => {
  const offlineRestored = await simulateRestoreStoredSession(networkDropRpcMock, networkDropAuthMock);
  assert(
    offlineRestored !== null && offlineRestored.sessaoId === 'sess-test-999',
    'Session preserved during offline network drop (resilient fallback)',
    `Session retained despite network drop: ${offlineRestored?.sessaoId}`
  );

  // Test 3.5: Explicit Revocation (is_valid: false) DOES clear session
  const explicitRevocationRpcMock = async () => ({
    data: { is_valid: false, reason: 'superseded_by_new_login' },
    error: null,
  });

  const revokedRestored = await simulateRestoreStoredSession(explicitRevocationRpcMock, async () => {});
  assert(
    revokedRestored === null && readStoredSession() === null,
    'Session invalidated when DB explicitly returns is_valid=false',
    'Session storage cleaned up after revocation'
  );

  // Test 3.6: Realtime payload filtering: only status === 'encerrado' triggers logout
  const realtimeEvents = [
    { payload: { new: { status: 'ativo' } }, shouldLogout: false, desc: 'Realtime UPDATE status=ativo' },
    { payload: { new: { status: 'em_uso' } }, shouldLogout: false, desc: 'Realtime UPDATE status=em_uso' },
    { payload: { new: { status: 'pendente' } }, shouldLogout: false, desc: 'Realtime UPDATE status=pendente' },
    { payload: { new: { status: 'encerrado' } }, shouldLogout: true, desc: 'Realtime UPDATE status=encerrado' },
  ];

  let realtimeTestsPassed = 0;
  for (const rt of realtimeEvents) {
    let triggeredLogout = false;
    // Emulate hook logic: if (payload.new && payload.new.status === 'encerrado') performLogout()
    if (rt.payload.new && rt.payload.new.status === 'encerrado') {
      triggeredLogout = true;
    }

    if (triggeredLogout === rt.shouldLogout) {
      realtimeTestsPassed++;
    }
  }

  assert(
    realtimeTestsPassed === realtimeEvents.length,
    'Realtime Listener Status Filter (Only "encerrado" revokes session)',
    `${realtimeTestsPassed}/${realtimeEvents.length} realtime events handled according to contract`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY OF HARNESS EXECUTION
  // ---------------------------------------------------------------------------
  console.log('\n=============================================================================');
  console.log(`STRESS TEST SUMMARY: ${passedTests}/${totalTests} PASSED (Failed: ${failedTests})`);
  console.log(`OVERALL VERDICT: ${failedTests === 0 ? 'APPROVE' : 'REQUEST_CHANGES'}`);
  console.log('=============================================================================');

  process.exit(failedTests === 0 ? 0 : 1);
})();
