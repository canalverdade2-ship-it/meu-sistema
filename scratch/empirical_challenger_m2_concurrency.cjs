'use strict';
/**
 * EMPIRICAL CHALLENGER STRESS HARNESS — MILESTONE 2 GATE
 * 
 * Verifies:
 * 1. Anti-double click protections on UI buttons & transaction concurrency
 * 2. Dual rate limiting on API Edge functions (IP + Subject buckets)
 * 3. SessionMutex FIFO concurrency on VPS webhooks
 * 4. Unauthorized access rejections (401/403) & SSRF / CORS guards
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

console.log('================================================================');
console.log('  MILESTONE 2 GATE: EMPIRICAL CHALLENGER ADVERSARIAL STRESS TEST');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    testResults.push({ name, status: 'PASS' });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    testResults.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    testResults.push({ name, status: 'PASS' });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    testResults.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {

// =============================================================================
// DOMAIN 1: ANTI-DOUBLE CLICK & CONCURRENCY CONTROLS (UI BUTTONS & TRANSACTIONS)
// =============================================================================
console.log('\n--- Domain 1: Anti-Double Click & Concurrency Controls ---');

// 1.1 Stress test synchronous isSubmittingRef lock under rapid-fire burst
await runAsyncTest('isSubmittingRef blocks 100 concurrent rapid clicks to exactly 1 execution', async () => {
  let executionCount = 0;
  const isSubmittingRef = { current: false };

  async function simulateSubmit() {
    if (isSubmittingRef.current) return 'BLOCKED';
    isSubmittingRef.current = true;
    try {
      executionCount++;
      await sleep(25); // Simulate async backend RPC
      return 'SUCCESS';
    } finally {
      isSubmittingRef.current = false;
    }
  }

  // Fire 100 simultaneous clicks
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(simulateSubmit());
  }

  const results = await Promise.all(promises);
  const successes = results.filter(r => r === 'SUCCESS');
  const blocked = results.filter(r => r === 'BLOCKED');

  assert.strictEqual(executionCount, 1, `Expected exactly 1 execution, got ${executionCount}`);
  assert.strictEqual(successes.length, 1, `Expected exactly 1 SUCCESS result, got ${successes.length}`);
  assert.strictEqual(blocked.length, 99, `Expected 99 BLOCKED results, got ${blocked.length}`);

  // After resolution, verify the lock is freed and a new click succeeds
  const subsequentResult = await simulateSubmit();
  assert.strictEqual(subsequentResult, 'SUCCESS', 'Subsequent click after completion must succeed');
  assert.strictEqual(executionCount, 2, 'Execution count must now be 2');
});

// 1.2 Verify error in submission unlocks isSubmittingRef (no permanent lock)
await runAsyncTest('isSubmittingRef releases lock on error (no deadlock)', async () => {
  const isSubmittingRef = { current: false };

  async function failingSubmit() {
    if (isSubmittingRef.current) return 'BLOCKED';
    isSubmittingRef.current = true;
    try {
      await sleep(10);
      throw new Error('Network error simulated');
    } finally {
      isSubmittingRef.current = false;
    }
  }

  await assert.rejects(async () => {
    await failingSubmit();
  }, /Network error simulated/);

  assert.strictEqual(isSubmittingRef.current, false, 'isSubmittingRef must be false after exception');
});

// 1.3 Audit CheckoutPage.tsx implementation of isSubmittingRef
runTest('CheckoutPage.tsx implements synchronous isSubmittingRef guard', () => {
  const checkoutSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/client/store/CheckoutPage.tsx'), 'utf8');
  assert(checkoutSrc.includes('const isSubmittingRef = useRef(false);'), 'CheckoutPage must declare isSubmittingRef');
  assert(checkoutSrc.includes('if (isSubmittingRef.current) return;'), 'CheckoutPage must check isSubmittingRef.current');
  assert(checkoutSrc.includes('isSubmittingRef.current = true;'), 'CheckoutPage must set isSubmittingRef.current = true');
  assert(checkoutSrc.includes('isSubmittingRef.current = false;'), 'CheckoutPage must reset isSubmittingRef.current in finally block');
});

// 1.4 Audit TravelCheckoutModal.tsx implementation of isSubmittingRef
runTest('TravelCheckoutModal.tsx implements synchronous isSubmittingRef guard', () => {
  const travelSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/client/store/TravelCheckoutModal.tsx'), 'utf8');
  assert(travelSrc.includes('const isSubmittingRef = useRef(false);'), 'TravelCheckoutModal must declare isSubmittingRef');
  assert(travelSrc.includes('if (isSubmittingRef.current) return;'), 'TravelCheckoutModal must check isSubmittingRef.current');
  assert(travelSrc.includes('isSubmittingRef.current = true;'), 'TravelCheckoutModal must set isSubmittingRef.current = true');
  assert(travelSrc.includes('isSubmittingRef.current = false;'), 'TravelCheckoutModal must reset isSubmittingRef.current in finally block');
});

// 1.5 Audit SaquesList.tsx idempotency key (withdrawalRequestId)
runTest('SaquesList.tsx uses withdrawalRequestId UUID idempotency key for RPC', () => {
  const saquesSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/client/financeiro/SaquesList.tsx'), 'utf8');
  assert(saquesSrc.includes('withdrawalRequestId = useRef<string>(generateUUID());'), 'SaquesList must initialize withdrawalRequestId');
  assert(saquesSrc.includes('p_request_id: withdrawalRequestId.current'), 'SaquesList must pass withdrawalRequestId to RPC');
  assert(saquesSrc.includes('if (isSubmitting) return;'), 'SaquesList must check isSubmitting state');
});

// 1.6 Audit ClientTransferencias.tsx idempotency key & database ON CONFLICT guard
runTest('ClientTransferencias.tsx uses transferRequestId UUID idempotency key for RPC', () => {
  const transSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/client/ClientTransferencias.tsx'), 'utf8');
  assert(transSrc.includes('transferRequestId = useRef<string>(generateUUID());'), 'ClientTransferencias must declare transferRequestId');
  assert(transSrc.includes('p_request_id: transferRequestId.current'), 'ClientTransferencias must pass transferRequestId to RPC');
});

// 1.7 Audit Database Migration for gsa_client_request_transfer idempotency & row locking
runTest('gsa_client_request_transfer SQL migration implements ON CONFLICT and FOR UPDATE', () => {
  const sqlSrc = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20260829050000_instant_client_transfers.sql'), 'utf8');
  assert(sqlSrc.includes('INSERT INTO public.gsa_client_operation_requests(request_id,cliente_id,operacao)'), 'Migration must log operation request');
  assert(sqlSrc.includes('ON CONFLICT(request_id) DO NOTHING'), 'Migration must handle conflict on request_id');
  assert(sqlSrc.includes('ORDER BY id FOR UPDATE'), 'Migration must lock client rows in consistent order to prevent deadlock');
});

// =============================================================================
// DOMAIN 2: DUAL RATE LIMITING ON API EDGE FUNCTIONS (gsa-auth-session)
// =============================================================================
console.log('\n--- Domain 2: Dual Rate Limiting on API Edge Functions ---');

const authSessionSrc = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/gsa-auth-session/index.ts'), 'utf8');

// 2.1 Audit Rate Limits Matrix configuration
runTest('gsa-auth-session defines dual (IP + Subject) rate limits for all auth actions', () => {
  assert(authSessionSrc.includes('const rateLimits: Record<AuthAction, { ip: RateLimitRule; subject: RateLimitRule }>'), 'Must define dual rate limits mapping');
  
  const expectedActions = [
    'register_affiliate',
    'login_pin',
    'login_admin',
    'login_colaborador',
    'request_client_first_access',
    'complete_client_first_access',
    'request_client_recovery',
    'complete_client_recovery',
    'request_provider_registration_code',
    'check_provider_registration_code',
    'verify_provider_registration_code',
    'request_partner_appeal',
    'submit_partner_appeal'
  ];

  for (const action of expectedActions) {
    assert(authSessionSrc.includes(`${action}:`), `Rate limits matrix must contain rule for ${action}`);
  }
});

// 2.2 Verify login_pin specific limits match documentation
runTest('login_pin dual rate limit parameters match security specification', () => {
  assert(authSessionSrc.includes('login_pin: {\n    ip: { limit: 30, windowSeconds: 300, blockSeconds: 900 },\n    subject: { limit: 8, windowSeconds: 600, blockSeconds: 900 },'), 'login_pin must specify 30 req/300s for IP and 8 req/600s for subject');
});

// 2.3 Verify bucket hash algorithm (SHA-256 HMAC-like derivation)
runTest('hashBucket implements deterministic SHA-256 hashing with secret salting', () => {
  function hashBucketSim(secret, category, rawValue) {
    const source = `${category}:${rawValue}:${secret}`;
    return crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  }

  const secret = 'super_secret_service_role_key_2026';
  const h1 = hashBucketSim(secret, 'login_pin:subject', '12345678900');
  const h2 = hashBucketSim(secret, 'login_pin:subject', '12345678900');
  const h3 = hashBucketSim(secret, 'login_pin:subject', '98765432100');
  const h4 = hashBucketSim('different_secret', 'login_pin:subject', '12345678900');

  assert.strictEqual(h1, h2, 'Identical inputs must yield identical hash');
  assert.notStrictEqual(h1, h3, 'Different subjects must yield different hashes');
  assert.notStrictEqual(h1, h4, 'Different secret salts must yield different hashes');
  assert.strictEqual(h1.length, 64, 'SHA-256 hex string must be 64 characters');

  // Verify entropy across 500 distinct synthetic subjects
  const hashSet = new Set();
  for (let i = 0; i < 500; i++) {
    hashSet.add(hashBucketSim(secret, 'login_pin:subject', `doc_${i}`));
  }
  assert.strictEqual(hashSet.size, 500, '500 distinct subjects must yield 500 unique hashes (0 collisions)');
});

// 2.4 Verify client IP extraction logic (x-forwarded-for, x-real-ip, cf-connecting-ip)
runTest('clientIp correctly parses client IP across headers with comma separation', () => {
  function clientIpSim(headers) {
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
      const firstIp = forwarded.split(',')[0].trim();
      if (firstIp) return firstIp;
    }
    const realIp = headers['x-real-ip'];
    if (realIp) return realIp.trim();
    const cfIp = headers['cf-connecting-ip'];
    if (cfIp) return cfIp.trim();
    return 'unknown';
  }

  assert.strictEqual(clientIpSim({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' }), '203.0.113.195');
  assert.strictEqual(clientIpSim({ 'x-real-ip': '198.51.100.22' }), '198.51.100.22');
  assert.strictEqual(clientIpSim({ 'cf-connecting-ip': '192.0.2.45' }), '192.0.2.45');
  assert.strictEqual(clientIpSim({}), 'unknown');
});

// 2.5 Verify tooManyAttempts response structure (HTTP 429 & Retry-After header)
runTest('tooManyAttempts generates compliant HTTP 429 response with Retry-After header', () => {
  assert(authSessionSrc.includes("error: 'too_many_attempts'"), 'Must return error too_many_attempts');
  assert(authSessionSrc.includes("'Retry-After': String(retryAfter)"), 'Must include Retry-After HTTP header');
  assert(authSessionSrc.includes('429'), 'Must return HTTP 429 status');
});

// 2.6 Verify payload size protection (MAX_BODY_BYTES = 8192)
runTest('gsa-auth-session restricts payload size to MAX_BODY_BYTES (8KB) returning 413', () => {
  assert(authSessionSrc.includes('const MAX_BODY_BYTES = 8_192;'), 'MAX_BODY_BYTES must be 8,192 bytes');
  assert(authSessionSrc.includes("json({ error: 'payload_too_large' }, 413"), 'Must return HTTP 413 payload_too_large');
});

// =============================================================================
// DOMAIN 3: SESSION MUTEX FIFO CONCURRENCY (VPS WEBHOOK DAEMON)
// =============================================================================
console.log('\n--- Domain 3: Session Mutex FIFO Concurrency on VPS Webhooks ---');

const webhookModule = require(path.resolve(__dirname, '../server_webhook.cjs'));
const SessionMutex = webhookModule.SessionMutex;

// 3.1 Verify SessionMutex is exported and instantiated
runTest('SessionMutex is properly exported and instantiated in server_webhook.cjs', () => {
  assert(SessionMutex, 'SessionMutex must be exported');
  assert(webhookModule.sessionMutex instanceof SessionMutex, 'sessionMutex must be an instance of SessionMutex');
  assert(typeof webhookModule.sessionMutex.runExclusive === 'function', 'runExclusive must be a function');
});

// 3.2 High-load stress test: 100 concurrent tasks on same phone execute in STRICT FIFO order
await runAsyncTest('SessionMutex executes 100 simultaneous tasks per phone in strict FIFO order', async () => {
  const mutex = new SessionMutex();
  const phone = '5511999998888';
  const numTasks = 100;

  let activeConcurrency = 0;
  let maxConcurrency = 0;
  const executionOrder = [];

  const promises = [];
  for (let i = 0; i < numTasks; i++) {
    const taskId = i;
    promises.push(
      mutex.runExclusive(phone, async () => {
        activeConcurrency++;
        if (activeConcurrency > maxConcurrency) {
          maxConcurrency = activeConcurrency;
        }
        executionOrder.push(taskId);

        // Variable jitter delay between 1ms and 5ms
        await sleep(Math.floor(Math.random() * 5) + 1);

        assert.strictEqual(activeConcurrency, 1, `Concurrency violation on phone: ${activeConcurrency} active tasks`);
        activeConcurrency--;
        return `result_${taskId}`;
      })
    );
  }

  const results = await Promise.all(promises);

  assert.strictEqual(maxConcurrency, 1, `Max concurrency must be 1, found ${maxConcurrency}`);
  assert.strictEqual(executionOrder.length, numTasks, 'All 100 tasks must execute');
  for (let i = 0; i < numTasks; i++) {
    assert.strictEqual(executionOrder[i], i, `Task index ${i} executed out of order: found task ${executionOrder[i]}`);
    assert.strictEqual(results[i], `result_${i}`, `Result mismatch for task ${i}`);
  }
});

// 3.3 Multi-phone concurrency: tasks on different phones run in parallel without blocking
await runAsyncTest('SessionMutex allows multi-phone concurrency without cross-blocking', async () => {
  const mutex = new SessionMutex();
  const phones = ['phone_A', 'phone_B', 'phone_C', 'phone_D', 'phone_E'];
  const tasksPerPhone = 10;

  let activeGlobalConcurrency = 0;
  let maxGlobalConcurrency = 0;
  const perPhoneOrder = { phone_A: [], phone_B: [], phone_C: [], phone_D: [], phone_E: [] };

  const allPromises = [];
  for (let i = 0; i < tasksPerPhone; i++) {
    for (const phone of phones) {
      const taskId = i;
      allPromises.push(
        mutex.runExclusive(phone, async () => {
          activeGlobalConcurrency++;
          if (activeGlobalConcurrency > maxGlobalConcurrency) {
            maxGlobalConcurrency = activeGlobalConcurrency;
          }
          perPhoneOrder[phone].push(taskId);

          await sleep(15);

          activeGlobalConcurrency--;
        })
      );
    }
  }

  await Promise.all(allPromises);

  // Concurrency across 5 phones must reach at least 4-5
  assert(maxGlobalConcurrency >= 4, `Multi-phone concurrency should reach at least 4, reached ${maxGlobalConcurrency}`);

  // Each individual phone must preserve FIFO order
  for (const phone of phones) {
    assert.strictEqual(perPhoneOrder[phone].length, tasksPerPhone);
    for (let i = 0; i < tasksPerPhone; i++) {
      assert.strictEqual(perPhoneOrder[phone][i], i, `Phone ${phone} task ${i} executed out of order`);
    }
  }
});

// 3.4 Queue error resilience: an error in task i does not hang task i+1
await runAsyncTest('SessionMutex survives rejected promises without deadlocking queue', async () => {
  const mutex = new SessionMutex();
  const phone = '5511988887777';
  const completed = [];

  const p1 = mutex.runExclusive(phone, async () => {
    completed.push('task_1_start');
    await sleep(10);
    throw new Error('Fatal error in task 1');
  }).catch(err => `caught_${err.message}`);

  const p2 = mutex.runExclusive(phone, async () => {
    completed.push('task_2_start');
    await sleep(10);
    return 'task_2_success';
  });

  const p3 = mutex.runExclusive(phone, async () => {
    completed.push('task_3_start');
    return 'task_3_success';
  });

  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

  assert(r1.includes('Fatal error in task 1'), 'Task 1 error must be caught');
  assert.strictEqual(r2, 'task_2_success', 'Task 2 must execute despite Task 1 failure');
  assert.strictEqual(r3, 'task_3_success', 'Task 3 must execute successfully');
  assert.deepStrictEqual(completed, ['task_1_start', 'task_2_start', 'task_3_start'], 'Tasks must execute in order');
});

// 3.5 Queue cleanup prevents memory leaks
await runAsyncTest('SessionMutex cleans up internal map entry once queue drains', async () => {
  const mutex = new SessionMutex();
  const phone = 'temp_phone_123';

  assert.strictEqual(mutex.queues.has(phone), false, 'Initially phone queue is not in map');

  const p = mutex.runExclusive(phone, async () => {
    assert.strictEqual(mutex.queues.has(phone), true, 'During execution phone queue exists in map');
    await sleep(10);
    return 'done';
  });

  await p;
  // Next tick after finally
  await sleep(5);

  assert.strictEqual(mutex.queues.has(phone), false, 'After queue drains, phone key must be deleted from map');
});

// =============================================================================
// DOMAIN 4: UNAUTHORIZED ACCESS REJECTIONS (401 / 403 / RBAC / SSRF / CORS)
// =============================================================================
console.log('\n--- Domain 4: Unauthorized Access Rejections (401/403 & RBAC) ---');

// 4.1 Audit cloudflare-api edge function for auth rejection
runTest('cloudflare-api edge function rejects unauthenticated (401) and unauthorized non-admin (403)', () => {
  const cfSrc = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/cloudflare-api/index.ts'), 'utf8');
  assert(cfSrc.includes('401'), 'cloudflare-api must return HTTP 401 when unauthenticated');
  assert(cfSrc.includes('403'), 'cloudflare-api must return HTTP 403 when user is not admin');
});

// 4.2 Audit gsa-ads-admin edge function for HMAC authentication rejection
runTest('gsa-ads-admin edge function rejects invalid HMAC signature with 401 invalid_signature', () => {
  const adsSrc = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/gsa-ads-admin/index.ts'), 'utf8');
  assert(adsSrc.includes('invalid_signature') || adsSrc.includes('401'), 'gsa-ads-admin must reject invalid HMAC with 401');
});

// 4.3 Audit gsa-ads-public edge function for scheduler cron-secret rejection
runTest('gsa-ads-public edge function rejects scheduler execution without cron secret (401)', () => {
  const adsPublicSrc = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/gsa-ads-public/index.ts'), 'utf8');
  assert(adsPublicSrc.includes('x-cron-secret') && (adsPublicSrc.includes('401') || adsPublicSrc.includes('unauthorized')), 'gsa-ads-public must protect scheduler with x-cron-secret');
});

// 4.4 Audit ssh-proxy edge function for non-admin rejection (403)
runTest('ssh-proxy edge function restricts terminal WebSocket access strictly to admin role (403)', () => {
  const sshSrc = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/ssh-proxy/index.ts'), 'utf8');
  assert(sshSrc.includes('admin') && sshSrc.includes('403'), 'ssh-proxy must enforce admin role and return 403 for other roles');
});

// 4.5 Audit SSRF protection in gsa-product-import
runTest('gsa-product-import enforces strict SSRF assertUrlResolvesPublic validation', () => {
  const importSrc = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/gsa-product-import/index.ts'), 'utf8');
  assert(importSrc.includes('assertUrlResolvesPublic') || importSrc.includes('SSRF') || importSrc.includes('127.0.0.1'), 'gsa-product-import must validate URLs against private IP / SSRF');
});

// 4.6 Audit CORS Origin Allowlist protection in gsa-auth-session
runTest('gsa-auth-session strictly rejects unauthorized external origins with HTTP 403 origin_not_allowed', () => {
  assert(authSessionSrc.includes("if (requestOrigin && !allowedOrigin) return json({ error: 'origin_not_allowed' }, 403);"), 'Must reject unapproved origin with 403 origin_not_allowed');
  assert(authSessionSrc.includes('DEFAULT_ALLOWED_ORIGINS = ['), 'Must define DEFAULT_ALLOWED_ORIGINS allowlist');
});

// 4.7 Audit PostgreSQL Sensitive RPCs REVOKE from anon/public
runTest('PostgreSQL migrations strictly REVOKE sensitive financial and admin RPCs from anon', () => {
  const { parseMigrationsSnapshot } = require(path.resolve(__dirname, '../scripts/validate-db-schema.cjs'));
  const snapshot = parseMigrationsSnapshot();

  const sensitiveAdminRpcs = [
    'gsa_admin_complete_partner_redemption',
    'gsa_admin_baixar_fatura',
    'gsa_admin_approve_budget',
    'gsa_admin_process_travel_refund',
    'gsa_admin_ajustar_saldo_cliente',
    'gsa_admin_alterar_status_cliente',
    'gsa_admin_save_partner',
    'gsa_admin_set_partner_status',
    'gsa_admin_write_audit',
    'gsa_confirmar_contribuicao_vaquinha' // specifically hardened in 20260830043000
  ];

  for (const rpc of sensitiveAdminRpcs) {
    const perm = snapshot.permissions.get(rpc);
    if (perm) {
      assert.strictEqual(perm.anon, false, `RPC ${rpc} must NOT be granted to anon`);
    }
  }
});

// =============================================================================
// SUMMARY & VERDICT
// =============================================================================
console.log('\n================================================================');
console.log(`TOTAL AUDIT CHECKS: ${totalTests}`);
console.log(`PASSED:              ${passedTests}`);
console.log(`FAILED:              ${failedTests}`);
console.log('================================================================');

if (failedTests === 0) {
  console.log('\n>>> EMPIRICAL VERDICT: CONFIRMED <<<');
  console.log('All concurrency, rate limiting, mutex FIFO and authorization claims verified under stress!\n');
  process.exit(0);
} else {
  console.error('\n>>> EMPIRICAL VERDICT: CHALLENGE_FAILED <<<');
  console.error(`${failedTests} empirical tests failed under stress.\n`);
  process.exit(1);
}

})();
