// Phase 4 Concurrency, Race Condition, & Realtime Stress Test Suite
// Verifies ACID-like database transactions, balance double-spend prevention, and SSE connection stability under load.

const assert = require('assert');
const http = require('http');
const app = require('../server');
const { data: db, save } = require('../src/db');
const { signToken } = require('../src/auth');

async function runPhase4StressTests() {
  console.log('=============================================================');
  console.log('PHASE 4 TEST SUITE: Concurrency, Race Conditions & SSE Stress');
  console.log('=============================================================');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`    ${err.stack || err.message}`);
      failed++;
    }
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
      const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      const reqHeaders = { ...headers };
      if (payload && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          method,
          path,
          headers: reqHeaders,
        },
        (res) => {
          let resData = '';
          res.on('data', (chunk) => (resData += chunk));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(resData);
            } catch (_) {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json,
              text: resData,
            });
          });
        }
      );

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  function openSseClient(urlPath, headers = {}) {
    return new Promise((resolve, reject) => {
      const events = [];
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          method: 'GET',
          path: urlPath,
          headers: {
            Accept: 'text/event-stream',
            ...headers,
          },
        },
        (res) => {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            const parts = buffer.split('\n\n');
            while (parts.length > 1) {
              const raw = parts.shift().trim();
              if (raw && !raw.startsWith(':')) {
                const lines = raw.split('\n');
                let event = 'message';
                let dataStr = '';
                for (const line of lines) {
                  if (line.startsWith('event: ')) event = line.slice(7).trim();
                  if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
                }
                let parsed = null;
                try {
                  parsed = JSON.parse(dataStr);
                } catch (_) {
                  parsed = dataStr;
                }
                events.push({ event, data: parsed });
              }
            }
            buffer = parts[0] || '';
          });

          resolve({
            req,
            res,
            events,
            close: () => req.destroy(),
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  // Setup test employee with exactly 12 days vacation balance
  const testEmpId = 'emp_stress_concurrency';
  const empIdx = db().employees.findIndex((e) => e.id === testEmpId);
  const testEmployee = {
    id: testEmpId,
    nationalId: '29001011234599',
    name: 'Stress Test Worker',
    phone: '01019998888',
    factory: '10th of Ramadan',
    department: 'Production A',
    position: 'Lead Operator',
    active: true,
    vacationBalance: 12.0,
    role: 'employee',
  };

  if (empIdx >= 0) db().employees[empIdx] = testEmployee;
  else db().employees.push(testEmployee);
  save();

  const empToken = signToken({
    sub: testEmpId,
    role: 'employee',
    scope: 'employee',
    factory: '10th of Ramadan',
    department: 'Production A',
  });
  const empHeaders = { Authorization: `Bearer ${empToken}` };

  const adminToken = signToken({
    sub: 'admin',
    role: 'superadmin',
    scope: 'admin',
  });
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 1. Race condition test: 5 parallel requests trying to spend 10 days each (only 1 can succeed)
  await test('Parallel leave requests cannot double-spend vacation balance (Race condition guard)', async () => {
    // Current balance = 12. Each request asks for 10 days. Total requested = 50 days!
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        request('POST', '/api/requests', empHeaders, {
          type: 'Leave',
          title: 'Annual Leave Request',
          days: 10,
          details: { leaveType: 'Annual Leave', days: 10 },
        })
      );
    }

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.status === 200 || r.status === 201);
    const rejected422 = results.filter((r) => r.status === 422);

    assert.strictEqual(successes.length, 1, 'Exactly ONE request must succeed');
    assert.strictEqual(rejected422.length, 4, 'The other 4 requests must fail with 422 insufficient balance');

    // Verify remaining balance in DB is exactly 2.0 (12 - 10)
    const updatedEmp = db().employees.find((e) => e.id === testEmpId);
    assert.strictEqual(updatedEmp.vacationBalance, 2.0, 'Vacation balance must be exactly 2.0 days');
  });

  // 2. Idempotency test: 5 concurrent requests with the SAME X-Idempotency-Key
  await test('Concurrent identical requests with same X-Idempotency-Key execute once and return cached response', async () => {
    const idempotencyKey = `idem_stress_${Date.now()}`;
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(
        request(
          'POST',
          '/api/requests',
          { ...empHeaders, 'X-Idempotency-Key': idempotencyKey },
          {
            type: 'Leave',
            title: 'Annual Leave Request',
            days: 1,
            details: { leaveType: 'Annual Leave', days: 1 },
          }
        )
      );
    }

    const results = await Promise.all(promises);
    const allOk = results.every((r) => r.status === 200 || r.status === 201);
    assert.ok(allOk, 'All 5 concurrent requests must return HTTP 200/201');

    // Every request should return the exact same request ID
    const requestIds = results.map((r) => r.body?.request?.id);
    const firstId = requestIds[0];
    assert.ok(firstId, 'First request must have an ID');
    assert.ok(requestIds.every((id) => id === firstId), 'All requests must return the identical generated request ID');

    // Balance should only have been deducted by 1 day (from 2.0 to 1.0), NOT 5 days!
    const updatedEmp = db().employees.find((e) => e.id === testEmpId);
    assert.strictEqual(updatedEmp.vacationBalance, 1.0, 'Balance must only be deducted once');
  });

  // 3. Realtime SSE connection resilience under event storm
  await test('Realtime SSE connection withstands rapid event broadcasts without leaking or disconnecting', async () => {
    const sseClients = [];
    const clientCount = 3;

    for (let i = 0; i < clientCount; i++) {
      const client = await openSseClient('/api/admin/realtime', adminHeaders);
      sseClients.push(client);
    }

    // Wait for handshake
    await new Promise((r) => setTimeout(r, 100));

    // Verify all clients received the handshake 'connected' event
    for (let i = 0; i < clientCount; i++) {
      assert.ok(
        sseClients[i].events.some((e) => e.event === 'connected'),
        `Client ${i} must receive 'connected' handshake`
      );
    }

    // Trigger 5 announcement creations rapidly
    for (let j = 0; j < 5; j++) {
      const res = await request('POST', '/api/admin/announcements', adminHeaders, {
        title: `Storm Broadcast #${j + 1}`,
        body: 'Realtime stress test body',
        category: 'Stress',
      });
      assert.strictEqual(res.status, 200);
    }

    // Wait 250ms for event dispersion
    await new Promise((r) => setTimeout(r, 250));

    // Every client must have received the 5 'announcement.created' events
    for (let i = 0; i < clientCount; i++) {
      const announcementEvents = sseClients[i].events.filter((e) => e.event === 'announcement.created');
      assert.strictEqual(
        announcementEvents.length,
        5,
        `Client ${i} must receive exactly 5 announcement.created events`
      );
    }

    // Clean up clients
    for (const c of sseClients) {
      c.close();
    }
  });

  await new Promise((resolve) => server.close(resolve));
  console.log(`\n=============================================================`);
  console.log(`PHASE 4 COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log(`=============================================================`);

  if (failed > 0) process.exit(1);
}

runPhase4StressTests().catch((err) => {
  console.error('Fatal error in Phase 4 stress test:', err);
  process.exit(1);
});
