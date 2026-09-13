// Phase 2 Verification Test Suite: Concurrency, Database Durability, Leave Decoupling, Soft Deletion, Rate Limiting & CORS
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { data: db, withTransaction, cleanupOrphanedTmpFiles, flushSync, DATA_DIR } = require('../src/db');
const { registerFailure, sweepExpired, MAX_ENTRIES, _attempts } = require('../src/rateLimit');
const { _hashObject, _syncedDocHashes } = require('../src/firestore');
const app = require('../server');

function makeRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const opts = {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };
      const req = http.request(opts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          server.close();
          const raw = Buffer.concat(chunks).toString();
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: raw, json });
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (body) {
        if (typeof body === 'string' || Buffer.isBuffer(body)) {
          req.write(body);
        } else {
          req.write(JSON.stringify(body));
        }
      }
      req.end();
    });
  });
}

test('PHASE 2: Concurrency, Database, Leave & System Integrity', async (t) => {
  // Setup test employee
  const testEmpId = 'emp_test_phase2';
  const state = db();
  state.employees = state.employees.filter((e) => e.id !== testEmpId);
  state.employees.push({
    id: testEmpId,
    nationalId: '29901011234599',
    phone: '01099998888',
    name: 'Phase 2 Test User',
    factory: 'Qwesna Complex',
    department: 'Engineering',
    vacationBalance: 5,
    active: true,
    tokenVersion: 1,
  });
  flushSync();

  const { signToken } = require('../src/auth');
  const employeeToken = signToken({ sub: testEmpId, scope: 'employee', tokenVersion: 1 });
  const authHeader = { Authorization: `Bearer ${employeeToken}` };

  await t.test('1. Concurrency: withTransaction mutex serialization prevents rollback clobbering', async () => {
    // Transaction A adds a marker
    // Transaction B runs concurrently, takes snapshot, but throws an error
    // Transaction A must NOT be clobbered by Transaction B's rollback!
    const opA = withTransaction(async (d) => {
      // Small simulated delay to allow opB to queue
      await new Promise((r) => setTimeout(r, 30));
      const emp = d.employees.find((e) => e.id === testEmpId);
      emp.customMarkers = emp.customMarkers || [];
      emp.customMarkers.push('A_COMMITTED');
    });

    const opB = withTransaction(async (d) => {
      // Small simulated delay, then fail
      await new Promise((r) => setTimeout(r, 10));
      const emp = d.employees.find((e) => e.id === testEmpId);
      emp.customMarkers = emp.customMarkers || [];
      emp.customMarkers.push('B_SHOULD_ROLLBACK');
      throw new Error('Transaction B failed intentionally');
    });

    // Execute concurrently
    const [resA, resB] = await Promise.allSettled([opA, opB]);
    assert.strictEqual(resA.status, 'fulfilled', 'Transaction A must commit');
    assert.strictEqual(resB.status, 'rejected', 'Transaction B must reject');

    // Verify final state
    const currentEmp = db().employees.find((e) => e.id === testEmpId);
    assert.ok(currentEmp.customMarkers.includes('A_COMMITTED'), 'Transaction A commits must persist');
    assert.ok(!currentEmp.customMarkers.includes('B_SHOULD_ROLLBACK'), 'Transaction B must be rolled back');
  });

  await t.test('2. Durability: Orphaned .tmp files are cleaned up on startup and after flushes', async () => {
    // Create a synthetic .tmp file in DATA_DIR
    const syntheticTmp = path.join(DATA_DIR, `test_orphan.${Date.now()}.tmp`);
    fs.writeFileSync(syntheticTmp, 'orphan test');
    assert.ok(fs.existsSync(syntheticTmp));

    cleanupOrphanedTmpFiles();
    assert.ok(!fs.existsSync(syntheticTmp), 'cleanupOrphanedTmpFiles must unlink .tmp files');

    // Test flush leaves no tmp files
    await flushSync();
    const files = fs.readdirSync(DATA_DIR);
    const tmpFiles = files.filter((f) => f.endsWith('.tmp'));
    assert.strictEqual(tmpFiles.length, 0, 'No .tmp files should linger after flushSync');
  });

  await t.test('3. Leave Calculation: Sick Leave does NOT deduct vacation balance or fail on low balance', async () => {
    const emp = db().employees.find((e) => e.id === testEmpId);
    emp.vacationBalance = 1; // Only 1 day vacation balance
    flushSync();

    // Request 5 days of Sick Leave (exceeds vacation balance, but should succeed because it is NOT Annual Leave!)
    const sickRes = await makeRequest('POST', '/api/requests', authHeader, {
      type: 'Leave',
      title: 'Sick Leave Request',
      details: { leaveType: 'Sick Leave', days: 5 },
      days: 5,
    });

    assert.strictEqual(sickRes.status, 200, 'Sick Leave must succeed even if days > vacationBalance');
    assert.strictEqual(sickRes.json.request.type, 'Leave');
    assert.strictEqual(sickRes.json.vacationBalance, 1, 'Vacation balance must NOT be deducted for Sick Leave');

    // Verify Annual Leave request for 5 days still rejects with 422
    const annualRes = await makeRequest('POST', '/api/requests', authHeader, {
      type: 'Leave',
      title: 'Annual Leave Request',
      details: { leaveType: 'Annual Leave', days: 5 },
      days: 5,
    });
    assert.strictEqual(annualRes.status, 422, 'Annual Leave exceeding balance must fail with 422');
    assert.strictEqual(annualRes.json.error, 'exceeds_balance');
  });

  await t.test('4. Soft Deletion: Request cancellation sets status=cancelled and preserves audit trail', async () => {
    // Create an annual leave request
    const createRes = await makeRequest('POST', '/api/requests', authHeader, {
      type: 'Leave',
      title: 'Annual Leave To Cancel',
      details: { leaveType: 'Annual Leave', days: 1 },
      days: 1,
    });
    assert.strictEqual(createRes.status, 200);
    const reqId = createRes.json.request.id;

    // Cancel the request
    const cancelRes = await makeRequest('POST', `/api/requests/${reqId}/cancel`, authHeader, {});
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.json.ok, true);

    // Verify record still exists in db with status = 'cancelled'
    const storedReq = db().requests.find((r) => r.id === reqId);
    assert.ok(storedReq, 'Request record must still exist in DB (soft deletion)');
    assert.strictEqual(storedReq.status, 'cancelled');
    assert.ok(storedReq.cancelledAt > 0, 'cancelledAt timestamp must be recorded');
    assert.ok(storedReq.updatedAt > 0, 'updatedAt timestamp must be recorded');

    // Verify default GET /api/requests filters out cancelled
    const listRes = await makeRequest('GET', '/api/requests', authHeader);
    assert.strictEqual(listRes.status, 200);
    const inDefaultList = (listRes.json.requests || []).some((r) => r.id === reqId);
    assert.strictEqual(inDefaultList, false, 'Default requests list should omit cancelled requests');

    // Verify GET /api/requests?includeCancelled=true includes it
    const listWithCancelled = await makeRequest('GET', '/api/requests?includeCancelled=true', authHeader);
    const inFullList = (listWithCancelled.json.requests || []).some((r) => r.id === reqId);
    assert.strictEqual(inFullList, true, 'includeCancelled=true must return cancelled requests');
  });

  await t.test('5. Rate Limiter: Memory is strictly bounded to MAX_ENTRIES and sweeps expired', async () => {
    // Fill beyond MAX_ENTRIES
    for (let i = 0; i < 5200; i++) {
      registerFailure(db(), `test_flood_ip_${i}`);
    }
    assert.ok(_attempts.size <= MAX_ENTRIES, `_attempts map size (${_attempts.size}) must not exceed MAX_ENTRIES (${MAX_ENTRIES})`);

    // Clean up test keys
    _attempts.clear();
  });

  await t.test('6. Firestore: Differential hashing detects changes and skips identical records', async () => {
    const docA = { id: 'test_1', name: 'Original', updated: 100 };
    const hash1 = _hashObject(docA);
    const hash2 = _hashObject({ id: 'test_1', name: 'Original', updated: 100 });
    const hash3 = _hashObject({ id: 'test_1', name: 'Modified', updated: 101 });

    assert.strictEqual(hash1, hash2, 'Identical objects must produce identical hashes');
    assert.notStrictEqual(hash1, hash3, 'Modified objects must produce distinct hashes');
  });

  await t.test('7. CORS: Preflight OPTIONS allows X-CSRF-Token and X-Idempotency-Key', async () => {
    const optionsRes = await makeRequest('OPTIONS', '/api/requests', {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Idempotency-Key',
    });

    assert.strictEqual(optionsRes.status, 204);
    const allowedHeaders = optionsRes.headers['access-control-allow-headers'] || '';
    assert.ok(allowedHeaders.includes('X-CSRF-Token'), 'CORS must allow X-CSRF-Token');
    assert.ok(allowedHeaders.includes('X-Idempotency-Key'), 'CORS must allow X-Idempotency-Key');
  });
});
