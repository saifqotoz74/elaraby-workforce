// Test Suite for Admin Transport & Fleet, Loans Management, and Live Attendance APIs
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-2026';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASS = 'elaraby2026';

const assert = require('assert');
const http = require('http');
const { data, save } = require('../src/db');
const { seed } = require('../src/seed');
const loanService = require('../src/services/loanService');
const attendanceService = require('../src/services/attendanceService');
const app = require('../server');

const PORT = 3995;
let server;

function request(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let responseText = '';
      res.on('data', (chunk) => {
        responseText += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseText);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: responseText,
          json,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('=============================================================');
  console.log('--- ADMIN TRANSPORT, LOANS & LIVE ATTENDANCE TEST SUITE ---');
  console.log('=============================================================\n');

  const d = data();
  seed(d);
  save();

  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // 1. Admin Authentication Login
    console.log('--- 1. Admin Authentication ---');
    const loginRes = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'elaraby2026',
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login should succeed with 200');
    assert.ok(loginRes.json?.ok, 'Login response should indicate ok: true');

    const setCookie = loginRes.headers['set-cookie'];
    assert.ok(setCookie, 'set-cookie header should be returned');
    const cookieHeader = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : setCookie.split(';')[0];
    const authHeaders = {
      Authorization: `Bearer ${loginRes.json.token}`,
      Cookie: cookieHeader,
      'X-CSRF-Token': loginRes.json?.csrfToken || '',
      'X-Tenant-ID': 'elaraby',
    };
    console.log('✔ Admin authenticated successfully.');

    // 2. Transport & Fleet Admin Endpoints
    console.log('\n--- 2. Transport & Fleet Console Endpoints ---');
    const fleetRes = await request('GET', '/api/admin/transport/fleet', authHeaders);
    assert.strictEqual(fleetRes.status, 200);
    assert.ok(fleetRes.json?.ok);
    assert.ok(Array.isArray(fleetRes.json?.fleet), 'fleet should be an array');
    console.log(`✔ GET /api/admin/transport/fleet returned ${fleetRes.json.fleet.length} active shuttles.`);

    const routesRes = await request('GET', '/api/admin/transport/routes', authHeaders);
    assert.strictEqual(routesRes.status, 200);
    assert.ok(routesRes.json?.ok);
    assert.ok(Array.isArray(routesRes.json?.routes), 'routes should be an array');
    const testRouteId = routesRes.json.routes[0]?.id || 'route_benha_express';
    console.log(`✔ GET /api/admin/transport/routes returned ${routesRes.json.routes.length} transit routes.`);

    const manifestRes = await request('GET', `/api/admin/transport/manifest/${testRouteId}`, authHeaders);
    assert.strictEqual(manifestRes.status, 200);
    assert.ok(manifestRes.json?.ok);
    assert.ok(manifestRes.json?.manifest, 'route manifest should exist');
    console.log(`✔ GET /api/admin/transport/manifest/${testRouteId} retrieved passenger list and stops.`);

    const alertRes = await request('POST', '/api/admin/transport/alerts', authHeaders, {
      routeId: testRouteId,
      type: 'delay',
      message: 'Mechanical maintenance check at gate 3',
      delayMinutes: 20,
    });
    assert.strictEqual(alertRes.status, 200);
    assert.ok(alertRes.json?.ok);
    console.log('✔ POST /api/admin/transport/alerts broadcasted delay notification.');

    // 3. Employee Loans & Salary Advances Administration
    console.log('\n--- 3. Loans & Salary Advances Endpoints ---');
    // Ensure test loan exists
    let testLoan = (data().loans || [])[0];
    if (!testLoan) {
      testLoan = loanService.applyLoan('emp_1', {
        type: 'emergency_advance',
        amount: 2500,
        installmentsCount: 2,
        reason: 'Urgent family medical expense',
      });
      save();
    }

    const loansListRes = await request('GET', '/api/admin/loans', authHeaders);
    assert.strictEqual(loansListRes.status, 200);
    assert.ok(loansListRes.json?.ok);
    assert.ok(Array.isArray(loansListRes.json?.loans), 'loans must be an array');
    assert.ok(loansListRes.json.loans.length > 0, 'at least one loan should exist');
    console.log(`✔ GET /api/admin/loans returned ${loansListRes.json.loans.length} loan applications.`);

    // Approve loan
    const approveRes = await request('POST', `/api/admin/loans/${testLoan.id}/status`, authHeaders, {
      status: 'approved',
    });
    assert.strictEqual(approveRes.status, 200);
    assert.ok(approveRes.json?.ok);
    assert.strictEqual(approveRes.json.loan?.status, 'approved');
    console.log(`✔ POST /api/admin/loans/${testLoan.id}/status successfully approved loan.`);

    // Disburse / activate loan
    const activateRes = await request('POST', `/api/admin/loans/${testLoan.id}/status`, authHeaders, {
      status: 'active',
    });
    assert.strictEqual(activateRes.status, 200);
    assert.strictEqual(activateRes.json.loan?.status, 'active');
    console.log(`✔ POST /api/admin/loans/${testLoan.id}/status successfully disbursed active loan.`);

    // Push loan to test rejection
    const rejectTestLoan = {
      id: 'loan_reject_test_' + Date.now(),
      employeeId: 'emp_3',
      tenantId: 'elaraby',
      referenceNumber: 'LN-2026-REJECT',
      type: 'emergency_advance',
      amount: 4000,
      monthlyInstallment: 2000,
      installmentsCount: 2,
      currency: 'EGP',
      status: 'pending',
      reason: 'Urgent car repair',
      createdAt: Date.now(),
    };
    data().loans.push(rejectTestLoan);
    save();

    const rejectRes = await request('POST', `/api/admin/loans/${rejectTestLoan.id}/status`, authHeaders, {
      status: 'rejected',
      reason: 'Debt service ratio exceeds policy limit',
    });
    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.json.loan?.status, 'rejected');
    assert.strictEqual(rejectRes.json.loan?.rejectionReason, 'Debt service ratio exceeds policy limit');
    console.log(`✔ POST /api/admin/loans/${rejectTestLoan.id}/status successfully recorded rejection reason.`);

    // 4. Live Attendance & Geofencing Monitor
    console.log('\n--- 4. Live Attendance & Geofencing Monitor ---');
    // Record a sample punch for today
    try {
      attendanceService.recordPunch('emp_1', {
        type: 'in',
        lat: 30.4660,
        lng: 31.1850,
      });
    } catch (_) {}

    const attRes = await request('GET', '/api/admin/attendance/today', authHeaders);
    assert.strictEqual(attRes.status, 200);
    assert.ok(attRes.json?.ok);
    assert.ok(attRes.json?.stats, 'stats object must exist');
    assert.ok(typeof attRes.json.stats.totalPunches === 'number', 'totalPunches must be number');
    assert.ok(typeof attRes.json.stats.activePresent === 'number', 'activePresent must be number');
    assert.ok(Array.isArray(attRes.json?.records), 'records must be an array');
    console.log(`✔ GET /api/admin/attendance/today returned ${attRes.json.records.length} punch records (Present: ${attRes.json.stats.activePresent}, OutOfGeofence: ${attRes.json.stats.outOfGeofenceCount}).`);

    console.log('\n=============================================================');
    console.log('🎉 ALL ADMIN EXPANSION ENDPOINTS VERIFIED 100% SUCCESSFULLY!');
    console.log('=============================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

run().catch((err) => {
  console.error('❌ Admin test suite failed:', err);
  if (server) server.close();
  process.exit(1);
});
