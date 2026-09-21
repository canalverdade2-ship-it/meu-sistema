const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 Starting Worker R4 Verification Test Suite...\n');

// 1. Load module exports from server_webhook_vps_live.cjs and server_webhook.cjs
const vpsLive = require('../../server_webhook_vps_live.cjs');
const webhook = require('../../server_webhook.cjs');

console.log('✓ Successfully required server_webhook_vps_live.cjs and server_webhook.cjs');

// Test 1: Module exports verification
assert(vpsLive.SessionMutex, 'SessionMutex must be exported from server_webhook_vps_live.cjs');
assert(vpsLive.sessionMutex, 'sessionMutex instance must be exported from server_webhook_vps_live.cjs');
assert(typeof vpsLive.sessionMutex.runExclusive === 'function', 'sessionMutex.runExclusive must be a function');

assert(webhook.SessionMutex, 'SessionMutex must be exported from server_webhook.cjs');
assert(webhook.sessionMutex, 'sessionMutex instance must be exported from server_webhook.cjs');
assert(typeof webhook.sessionMutex.runExclusive === 'function', 'sessionMutex.runExclusive must be a function');
console.log('✓ Exported SessionMutex and sessionMutex verified on both files');

async function testSessionMutexLogic() {
  const { SessionMutex } = vpsLive;
  const mutex = new SessionMutex();

  // Test 2: FIFO order for same key
  const executionOrder = [];
  const p1 = mutex.runExclusive('5511999990001', async () => {
    await new Promise(r => setTimeout(r, 60));
    executionOrder.push('p1_finished');
    return 'r1';
  });

  const p2 = mutex.runExclusive('5511999990001', async () => {
    await new Promise(r => setTimeout(r, 10));
    executionOrder.push('p2_finished');
    return 'r2';
  });

  const [res1, res2] = await Promise.all([p1, p2]);
  assert.strictEqual(res1, 'r1');
  assert.strictEqual(res2, 'r2');
  assert.deepStrictEqual(executionOrder, ['p1_finished', 'p2_finished'], 'Tasks for same phone must execute in FIFO order');
  console.log('✓ SessionMutex FIFO sequential execution for same phone verified');

  // Test 3: Concurrency across different keys
  const timestamps = {};
  const tA = mutex.runExclusive('phone_A', async () => {
    timestamps.startA = Date.now();
    await new Promise(r => setTimeout(r, 80));
    timestamps.endA = Date.now();
  });

  const tB = mutex.runExclusive('phone_B', async () => {
    timestamps.startB = Date.now();
    await new Promise(r => setTimeout(r, 80));
    timestamps.endB = Date.now();
  });

  await Promise.all([tA, tB]);
  const diffStart = Math.abs(timestamps.startA - timestamps.startB);
  assert(diffStart < 40, `Different phone numbers must run concurrently (started ${diffStart}ms apart)`);
  console.log(`✓ SessionMutex concurrent execution across different phones verified (start delta: ${diffStart}ms)`);

  // Test 4: Error resilience (rejection in first task must not block second task)
  let task2Executed = false;
  const failTask = mutex.runExclusive('phone_fail_test', async () => {
    throw new Error('Simulated failure in task 1');
  });

  const followUpTask = mutex.runExclusive('phone_fail_test', async () => {
    task2Executed = true;
    return 'success_after_failure';
  });

  await failTask.catch(e => {
    assert.strictEqual(e.message, 'Simulated failure in task 1');
  });

  const followUpResult = await followUpTask;
  assert.strictEqual(task2Executed, true, 'Task 2 must execute even if task 1 threw an error');
  assert.strictEqual(followUpResult, 'success_after_failure');
  console.log('✓ SessionMutex error resilience verified (subsequent tasks execute without deadlock)');

  // Test 5: Queue cleanup in Map
  await new Promise(r => setTimeout(r, 30));
  assert.strictEqual(mutex.queues.size, 0, `Queues map must be empty after all tasks finish (found size: ${mutex.queues.size})`);
  console.log('✓ SessionMutex automatic memory cleanup verified (queues deleted on completion)');
}

function testCodeIntegrity() {
  const root = path.resolve(__dirname, '..', '..');
  const liveContent = fs.readFileSync(path.join(root, 'server_webhook_vps_live.cjs'), 'utf8');
  const webhookContent = fs.readFileSync(path.join(root, 'server_webhook.cjs'), 'utf8');
  const migrationContent = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260828120000_atomic_points_conversion.sql'), 'utf8');

  // Test 6: Fallback pattern in both files
  const fallbackRegex = /const\s+SERVICE_ROLE_JWT\s*=\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*SUPABASE_KEY\s*\|\|\s*'';/;
  assert(fallbackRegex.test(liveContent), 'server_webhook_vps_live.cjs must contain cascaded SERVICE_ROLE_JWT fallback');
  assert(fallbackRegex.test(webhookContent), 'server_webhook.cjs must contain cascaded SERVICE_ROLE_JWT fallback');
  console.log('✓ SERVICE_ROLE_JWT fallback pattern verified in both files');

  // Test 7: Atomic RPC in LOYALTY_ACTIONS
  assert(liveContent.includes("supabaseRpc('gsa_converter_pontos_carteira'"), 'server_webhook_vps_live.cjs must call gsa_converter_pontos_carteira');
  assert(webhookContent.includes("supabaseRpc('gsa_converter_pontos_carteira'"), 'server_webhook.cjs must call gsa_converter_pontos_carteira');
  console.log('✓ Atomic gsa_converter_pontos_carteira RPC call verified in both files');

  // Test 8: Webhook handler wrapped with sessionMutex.runExclusive
  assert(liveContent.includes('sessionMutex.runExclusive(fromPhone'), 'server_webhook_vps_live.cjs must wrap processMessage in sessionMutex.runExclusive');
  assert(webhookContent.includes('sessionMutex.runExclusive(fromPhone'), 'server_webhook.cjs must wrap processMessage in sessionMutex.runExclusive');
  console.log('✓ sessionMutex.runExclusive wrapper in POST /webhook verified in both files');

  // Test 9: Migration file validation
  assert(migrationContent.includes('CREATE OR REPLACE FUNCTION public.gsa_converter_pontos_carteira'), 'Migration must define gsa_converter_pontos_carteira');
  assert(migrationContent.includes('FOR UPDATE;'), 'Migration must acquire FOR UPDATE row lock');
  assert(migrationContent.includes('INSERT INTO public.pontos_movimentacoes'), 'Migration must insert audit log into pontos_movimentacoes');
  assert(migrationContent.includes('INSERT INTO public.carteira_lancamentos'), 'Migration must insert audit log into carteira_lancamentos');
  assert(migrationContent.includes('INSERT INTO public.extrato_financeiro'), 'Migration must insert audit log into extrato_financeiro');
  assert(migrationContent.includes('GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira'), 'Migration must grant permissions');
  console.log('✓ Database migration 20260828120000_atomic_points_conversion.sql verified with row-level locks and ledger logs');
}

async function run() {
  await testSessionMutexLogic();
  testCodeIntegrity();
  console.log('\n🎉 ALL 9 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
