// Phase 3: Redis & BullMQ Background Job System Verification Suite
const assert = require('assert');
const { acquireLock, releaseLock, getRedisClient, checkHealth } = require('../src/queue/redis');
const { dispatchJob, getJobStatus, QUEUE_NAMES } = require('../src/queue/queues');
const idempotency = require('../src/queue/idempotency');
const { handlers } = require('../src/queue/workers');

async function runTests() {
  console.log('=============================================================');
  console.log('--- RUNNING PHASE 3: REDIS & BULLMQ QUEUE TEST SUITE ---');
  console.log('=============================================================');

  // Test 1: Redis Connectivity & In-Memory Fallback
  console.log('\n--- 1. Redis Connection & Fallback Probe ---');
  const client = getRedisClient();
  assert.ok(client, 'Redis client must be initialized');
  const pong = await client.ping();
  assert.strictEqual(pong, 'PONG', 'Redis ping must return PONG');
  const health = await checkHealth();
  assert.ok(health.ok, 'Health check must report ok: true');
  console.log(`✔ Redis client status: ${health.status} (ok: true).`);

  // Test 2: Distributed Lock Acquisition and Exclusion
  console.log('\n--- 2. Distributed Mutex Lock (Redlock Pattern) ---');
  const resource = 'leave_balance_emp_test_1';
  const token1 = await acquireLock(resource, 2000);
  assert.ok(token1, 'First lock acquisition must succeed and return a token');

  // Second concurrent attempt must fail (mutual exclusion)
  const token2 = await acquireLock(resource, 2000);
  assert.strictEqual(token2, null, 'Second concurrent lock attempt must be rejected (null)');

  // Release lock with wrong token should fail
  const wrongRelease = await releaseLock(resource, 'wrong_token');
  assert.strictEqual(wrongRelease, false, 'Release with mismatched token must fail');

  // Release lock with correct token
  const rightRelease = await releaseLock(resource, token1);
  assert.strictEqual(rightRelease, true, 'Release with correct token must succeed');

  // Re-acquire after release should succeed
  const token3 = await acquireLock(resource, 2000);
  assert.ok(token3, 'Re-acquiring lock after release must succeed');
  await releaseLock(resource, token3);
  console.log('✔ Distributed Mutex locking and mutual exclusion verified.');

  // Test 3: Distributed Idempotency Guard
  console.log('\n--- 3. Distributed Idempotency Guard ---');
  const idemKey = `idem_test_${Date.now()}`;
  const firstCheck = await idempotency.checkOrSet(idemKey, { status: 'in_progress' });
  assert.strictEqual(firstCheck.exists, false, 'First request with unique key must not exist');

  // Duplicate concurrent submission
  const secondCheck = await idempotency.checkOrSet(idemKey);
  assert.strictEqual(secondCheck.exists, true, 'Second request with same key must be detected as existing');

  // Cache final response
  await idempotency.saveResponse(idemKey, { success: true, reqId: 'req_123' });
  const thirdCheck = await idempotency.checkOrSet(idemKey);
  assert.strictEqual(thirdCheck.exists, true, 'Third check must return cached response');
  assert.strictEqual(thirdCheck.data.reqId, 'req_123', 'Must return cached request ID');

  await idempotency.clear(idemKey);
  const fourthCheck = await idempotency.checkOrSet(idemKey);
  assert.strictEqual(fourthCheck.exists, false, 'Check after clear must be non-existent');
  await idempotency.clear(idemKey);
  console.log('✔ Idempotency guard prevents duplicate executions and returns cached response.');

  // Test 4: BullMQ Job Dispatcher across Queues
  console.log('\n--- 4. BullMQ Queue Job Dispatching ---');
  const queuesToTest = [
    QUEUE_NAMES.SMS,
    QUEUE_NAMES.PUSH,
    QUEUE_NAMES.NOTIFICATIONS,
    QUEUE_NAMES.PAYROLL,
    QUEUE_NAMES.ERP_SYNC,
    QUEUE_NAMES.ATTENDANCE_SYNC,
  ];

  for (const qName of queuesToTest) {
    const jobRes = await dispatchJob(qName, `test_${qName}_action`, {
      test: true,
      timestamp: Date.now(),
    });
    assert.ok(jobRes.jobId, `Job ID must be generated for ${qName}`);
    assert.strictEqual(jobRes.queue, qName, `Queue name must match ${qName}`);

    const status = await getJobStatus(qName, jobRes.jobId);
    assert.ok(status, `Must be able to query job status for ${jobRes.jobId}`);
    assert.ok(status.status === 'completed' || status.status === 'queued', `Job status must be valid`);
  }
  console.log(`✔ Job dispatcher successfully queued and verified jobs across all 6 queues.`);

  // Test 5: Worker Handlers Execution
  console.log('\n--- 5. Worker Handler Processors ---');
  const notifResult = await handlers.notifications({
    data: {
      employeeId: 'emp_1',
      title: 'تنبيه النظام',
      body: 'اختبار المعالجة بالخلفية',
      category: 'system',
    },
  });
  assert.ok(notifResult.notificationId, 'Notification handler must create notification record');

  const payrollResult = await handlers.payroll({
    data: {
      month: 9,
      year: 2026,
      employeeId: 'emp_1',
    },
  });
  assert.strictEqual(payrollResult.status, 'prepared', 'Payroll handler must prepare statement');
  console.log('✔ Background worker handlers processed domain payloads cleanly.');

  console.log('\n=============================================================');
  console.log('ALL PHASE 3 REDIS & BULLMQ TESTS PASSED (0 FAILURES)');
  console.log('=============================================================');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phase 3 test failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
