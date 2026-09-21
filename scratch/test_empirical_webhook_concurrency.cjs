'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('===============================================================');
console.log('EMPIRICAL CHALLENGE SUITE: WEBHOOK SESSION MUTEX & CONCURRENCY');
console.log('===============================================================\n');

// Import both webhook files
const vpsLive = require('../server_webhook_vps_live.cjs');
const webhook = require('../server_webhook.cjs');

const SessionMutex = vpsLive.SessionMutex || webhook.SessionMutex;
assert(SessionMutex, 'SessionMutex class must be exported');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSuite() {
  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName) {
    passedTests++;
    console.log('  [PASS] ' + testName);
  }

  function recordFail(testName, err) {
    console.error('  [FAIL] ' + testName + ':', err.message);
    throw err;
  }

  // -------------------------------------------------------------
  // TEST 1: Exports and Module Integrity
  // -------------------------------------------------------------
  totalTests++;
  try {
    console.log('\n--- Test 1: Exports and Module Integrity ---');
    assert(vpsLive.sessionMutex instanceof vpsLive.SessionMutex, 'vpsLive.sessionMutex must be an instance of SessionMutex');
    assert(webhook.sessionMutex instanceof webhook.SessionMutex, 'webhook.sessionMutex must be an instance of SessionMutex');
    assert(typeof vpsLive.sessionMutex.runExclusive === 'function', 'runExclusive must be a function');
    assert(typeof webhook.sessionMutex.runExclusive === 'function', 'runExclusive must be a function');
    
    // Check file source for proper wrapping in POST handler
    const liveSrc = fs.readFileSync(path.resolve(__dirname, '../server_webhook_vps_live.cjs'), 'utf8');
    const localSrc = fs.readFileSync(path.resolve(__dirname, '../server_webhook.cjs'), 'utf8');
    
    assert(liveSrc.includes('sessionMutex.runExclusive(fromPhone,'), 'vpsLive must wrap processMessage with sessionMutex.runExclusive(fromPhone, ...)');
    assert(localSrc.includes('sessionMutex.runExclusive(fromPhone,'), 'webhook must wrap processMessage with sessionMutex.runExclusive(fromPhone, ...)');
    
    recordPass('Exports and POST route wrapping verified in both server files');
  } catch (e) {
    recordFail('Test 1', e);
  }

  // -------------------------------------------------------------
  // TEST 2: Strict FIFO Sequential Execution per Phone (Same Key)
  // -------------------------------------------------------------
  totalTests++;
  try {
    console.log('\n--- Test 2: Strict FIFO per Phone (50 simultaneous messages) ---');
    const mutex = new SessionMutex();
    const phone = '5511971858372';
    const numTasks = 50;
    
    let activeConcurrency = 0;
    let maxConcurrency = 0;
    const startOrder = [];
    const completeOrder = [];

    const promises = [];
    for (let i = 0; i < numTasks; i++) {
      const taskId = i;
      const p = mutex.runExclusive(phone, async () => {
        activeConcurrency++;
        if (activeConcurrency > maxConcurrency) {
          maxConcurrency = activeConcurrency;
        }
        startOrder.push(taskId);

        // Random simulated processing duration between 5ms and 25ms
        const delay = Math.floor(Math.random() * 20) + 5;
        await sleep(delay);

        assert.strictEqual(activeConcurrency, 1, 'Active concurrency for phone ' + phone + ' must strictly be 1, but found ' + activeConcurrency);
        
        activeConcurrency--;
        completeOrder.push(taskId);
        return 'result_' + taskId;
      });
      promises.push(p);
    }

    const results = await Promise.all(promises);

    assert.strictEqual(maxConcurrency, 1, 'Max concurrency per phone must be exactly 1, got ' + maxConcurrency);
    assert.strictEqual(startOrder.length, numTasks);
    assert.strictEqual(completeOrder.length, numTasks);

    // Verify strict sequential ordering [0, 1, 2, ..., 49]
    for (let i = 0; i < numTasks; i++) {
      assert.strictEqual(startOrder[i], i, 'Task ' + i + ' started out of FIFO order: started as ' + startOrder[i]);
      assert.strictEqual(completeOrder[i], i, 'Task ' + i + ' completed out of FIFO order: completed as ' + completeOrder[i]);
      assert.strictEqual(results[i], 'result_' + i);
    }

    recordPass('Strict FIFO confirmed: 50/50 tasks executed in exact order with max concurrency = ' + maxConcurrency);
  } catch (e) {
    recordFail('Test 2', e);
  }

  // -------------------------------------------------------------
  // TEST 3: Multi-Phone Concurrency (No Cross-Phone Blocking)
  // -------------------------------------------------------------
  totalTests++;
  try {
    console.log('\n--- Test 3: Multi-Phone Concurrency (5 distinct phones running simultaneously) ---');
    const mutex = new SessionMutex();
    const phones = ['5511900000001', '5511900000002', '5511900000003', '5511900000004', '5511900000005'];
    const tasksPerPhone = 5;
    const taskDurationMs = 30;

    let globalActiveTasks = 0;
    let maxGlobalConcurrency = 0;
    const phoneConcurrency = {};
    phones.forEach(p => { phoneConcurrency[p] = 0; });

    const startTime = Date.now();
    const allPromises = [];

    phones.forEach((phone, pIdx) => {
      for (let t = 0; t < tasksPerPhone; t++) {
        const taskId = 'phone' + pIdx + '_task' + t;
        const p = mutex.runExclusive(phone, async () => {
          globalActiveTasks++;
          phoneConcurrency[phone]++;
          if (globalActiveTasks > maxGlobalConcurrency) {
            maxGlobalConcurrency = globalActiveTasks;
          }

          // Concurrency per phone MUST be 1
          assert.strictEqual(phoneConcurrency[phone], 1, 'Per-phone concurrency for ' + phone + ' exceeded 1: ' + phoneConcurrency[phone]);

          await sleep(taskDurationMs);

          globalActiveTasks--;
          phoneConcurrency[phone]--;
          return taskId;
        });
        allPromises.push(p);
      }
    });

    const results = await Promise.all(allPromises);
    const totalDuration = Date.now() - startTime;

    assert.strictEqual(results.length, phones.length * tasksPerPhone);
    console.log('    Total duration for 25 tasks across 5 phones: ' + totalDuration + 'ms (Max Global Concurrency: ' + maxGlobalConcurrency + ')');
    
    assert(maxGlobalConcurrency > 1, 'Expected global concurrency > 1 across phones, but got ' + maxGlobalConcurrency);
    assert(totalDuration < 600, 'Multi-phone execution took ' + totalDuration + 'ms, indicating blocking across phones');

    recordPass('Multi-phone parallel execution confirmed: max global concurrency reached ' + maxGlobalConcurrency + ', no cross-phone blocking');
  } catch (e) {
    recordFail('Test 3', e);
  }

  // -------------------------------------------------------------
  // TEST 4: Error Resilience in Queue (Middle Task Failure)
  // -------------------------------------------------------------
  totalTests++;
  try {
    console.log('\n--- Test 4: Error Resilience (Errors must not break or stall subsequent tasks) ---');
    const mutex = new SessionMutex();
    const phone = '5511999999999';
    const executedTasks = [];
    const errorsCaught = [];

    const p0 = mutex.runExclusive(phone, async () => {
      await sleep(10);
      executedTasks.push(0);
      return 'ok_0';
    });

    const p1 = mutex.runExclusive(phone, async () => {
      await sleep(10);
      executedTasks.push(1);
      throw new Error('Deliberate failure in Task 1');
    });

    const p2 = mutex.runExclusive(phone, async () => {
      await sleep(10);
      executedTasks.push(2);
      return 'ok_2';
    });

    const p3 = mutex.runExclusive(phone, async () => {
      await sleep(10);
      executedTasks.push(3);
      throw new Error('Deliberate failure in Task 3');
    });

    const p4 = mutex.runExclusive(phone, async () => {
      await sleep(10);
      executedTasks.push(4);
      return 'ok_4';
    });

    // Check individual promise outcomes
    const res0 = await p0;
    assert.strictEqual(res0, 'ok_0');

    try {
      await p1;
      assert.fail('p1 should have thrown');
    } catch (err) {
      assert.strictEqual(err.message, 'Deliberate failure in Task 1');
      errorsCaught.push(1);
    }

    const res2 = await p2;
    assert.strictEqual(res2, 'ok_2');

    try {
      await p3;
      assert.fail('p3 should have thrown');
    } catch (err) {
      assert.strictEqual(err.message, 'Deliberate failure in Task 3');
      errorsCaught.push(3);
    }

    const res4 = await p4;
    assert.strictEqual(res4, 'ok_4');

    assert.deepStrictEqual(executedTasks, [0, 1, 2, 3, 4], 'All tasks must execute in order despite errors');
    assert.deepStrictEqual(errorsCaught, [1, 3], 'Errors must be cleanly passed to respective callers');

    recordPass('Queue survived deliberate task errors without deadlocking or dropping subsequent tasks');
  } catch (e) {
    recordFail('Test 4', e);
  }

  // -------------------------------------------------------------
  // TEST 5: Memory Leak & Queue Cleanup Test
  // -------------------------------------------------------------
  totalTests++;
  try {
    console.log('\n--- Test 5: Memory Cleanup (Queue Map cleanup after draining) ---');
    const mutex = new SessionMutex();
    const phone = '5511988887777';

    assert.strictEqual(mutex.queues.size, 0, 'Initial queues size should be 0');

    const p1 = mutex.runExclusive(phone, async () => {
      await sleep(20);
      return 'p1';
    });

    const p2 = mutex.runExclusive(phone, async () => {
      await sleep(20);
      return 'p2';
    });

    assert.strictEqual(mutex.queues.size, 1, 'Queue map should have 1 entry while tasks are in flight');

    await Promise.all([p1, p2]);
    await sleep(10); // allow microtasks and finally() to settle

    assert.strictEqual(mutex.queues.size, 0, 'Queue map must be 0 after queue drains, but got ' + mutex.queues.size);

    // Test re-entry after cleanup
    const p3 = mutex.runExclusive(phone, async () => {
      await sleep(10);
      return 'p3_after_drain';
    });
    assert.strictEqual(mutex.queues.size, 1, 'Queue map should recreate entry on subsequent message');
    const res3 = await p3;
    assert.strictEqual(res3, 'p3_after_drain');
    await sleep(10);
    assert.strictEqual(mutex.queues.size, 0, 'Queue map must drain to 0 again');

    recordPass('Queue Map correctly creates and cleans up entries preventing memory leaks');
  } catch (e) {
    recordFail('Test 5', e);
  }

  // -------------------------------------------------------------
  // TEST 6: Null / Undefined Key Fallback
  // -------------------------------------------------------------
  totalTests++;
  try {
    console.log('\n--- Test 6: Null/Undefined Key Robustness ---');
    const mutex = new SessionMutex();

    const pNull = mutex.runExclusive(null, async () => {
      await sleep(10);
      return 'null_ok';
    });

    const pUndef = mutex.runExclusive(undefined, async () => {
      await sleep(10);
      return 'undef_ok';
    });

    const [rNull, rUndef] = await Promise.all([pNull, pUndef]);
    assert.strictEqual(rNull, 'null_ok');
    assert.strictEqual(rUndef, 'undef_ok');

    await sleep(10);
    assert.strictEqual(mutex.queues.size, 0);

    recordPass('Null and undefined keys safely coalesce to global without errors');
  } catch (e) {
    recordFail('Test 6', e);
  }

  console.log('\n===============================================================');
  console.log('ALL ' + passedTests + '/' + totalTests + ' WEBHOOK CONCURRENCY STRESS TESTS PASSED EMPIRICALLY!');
  console.log('===============================================================\n');
  process.exit(0);
}

runSuite().catch(err => {
  console.error('\nSuite execution failed:', err);
  process.exit(1);
});