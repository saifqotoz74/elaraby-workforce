// Test Suite for Admin Executive Reports, Bank WPS Exports, and ERP & Biometrics Integrations
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-2026';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASS = 'elaraby2026';

const assert = require('assert');
const http = require('http');
const { data, save } = require('../src/db');
const { seed } = require('../src/seed');
const app = require('../server');

const PORT = 3996;
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
  console.log('--- ADMIN EXECUTIVE REPORTS & ERP INTEGRATIONS TEST SUITE ---');
  console.log('=============================================================\n');

  seed();

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });

  try {
    // 1. Authenticate Admin
    console.log('--- 1. Admin Authentication ---');
    const loginRes = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'elaraby2026',
      role: 'superadmin',
    });
    assert.strictEqual(loginRes.status, 200, 'Login must succeed with 200');
    const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0] : '';
    const token = loginRes.json.token;
    const authHeaders = {
      Cookie: cookie,
      Authorization: `Bearer ${token}`,
    };
    console.log('✔ Admin authenticated successfully.\n');

    // 2. Executive Analytics
    console.log('--- 2. Executive Analytics Engine ---');
    const analyticsRes = await request('GET', '/api/admin/reports/analytics', authHeaders);
    assert.strictEqual(analyticsRes.status, 200, 'Analytics must return 200 OK');
    assert.strictEqual(analyticsRes.json.ok, true, 'ok must be true');
    assert.ok(analyticsRes.json.kpi.headcount > 0, 'Headcount must be positive');
    assert.ok(analyticsRes.json.kpi.totalNetPayroll > 0, 'Total net payroll must be positive');
    assert.ok(analyticsRes.json.departmentDistribution.length > 0, 'Must have department distribution');
    assert.ok(analyticsRes.json.monthlyTrend.length > 0, 'Must have monthly trend array');
    console.log(`✔ GET /api/admin/reports/analytics returned KPI summary (Headcount: ${analyticsRes.json.kpi.headcount}, Net Payroll: ${analyticsRes.json.kpi.totalNetPayroll} EGP).\n`);

    // 3. Bank WPS & ACH Exports
    console.log('--- 3. Bank Payroll & WPS File Generator ---');
    const wpsRes = await request('GET', '/api/admin/reports/bank-export?format=wps_cbe', authHeaders);
    assert.strictEqual(wpsRes.status, 200, 'WPS export must return 200 OK');
    assert.ok(wpsRes.text.includes('01|'), 'WPS must contain CBE 01 header record');
    assert.ok(wpsRes.text.includes('02|'), 'WPS must contain CBE 02 detail records');
    assert.ok(wpsRes.text.includes('EGP'), 'WPS must specify EGP currency');
    console.log('✔ GET /api/admin/reports/bank-export?format=wps_cbe generated valid CBE Wages Protection file.');

    const nbeRes = await request('GET', '/api/admin/reports/bank-export?format=nbe', authHeaders);
    assert.strictEqual(nbeRes.status, 200, 'NBE export must return 200 OK');
    assert.ok(nbeRes.text.includes('National Bank of Egypt'), 'Must identify bank');
    assert.ok(nbeRes.text.includes('Employee Code'), 'Must contain CSV headers');
    console.log('✔ GET /api/admin/reports/bank-export?format=nbe generated valid ACH CSV payroll statement.\n');

    // 4. ERP & Biometrics Integrations Hub
    console.log('--- 4. ERP & Biometrics Gateway Endpoints ---');
    const statusRes = await request('GET', '/api/admin/integrations/status', authHeaders);
    assert.strictEqual(statusRes.status, 200, 'Integration status must return 200');
    assert.strictEqual(statusRes.json.ok, true);
    assert.ok(statusRes.json.erp.activeProvider, 'Must identify active ERP provider');
    assert.strictEqual(statusRes.json.biometrics.status, 'ONLINE', 'Biometrics must report ONLINE');
    console.log(`✔ GET /api/admin/integrations/status confirmed ${statusRes.json.erp.activeProvider} and Biometrics ONLINE.`);

    const syncRes = await request('POST', '/api/admin/integrations/sync', authHeaders, {
      domain: 'employees',
    });
    assert.strictEqual(syncRes.status, 200, 'ERP sync must succeed');
    assert.strictEqual(syncRes.json.ok, true);
    assert.ok(syncRes.json.result.count >= 0, 'Sync result must have count');
    console.log(`✔ POST /api/admin/integrations/sync executed real-time sync with ${syncRes.json.result.source || 'ERP'}.`);

    const reconRes = await request('GET', '/api/admin/integrations/reconciliation', authHeaders);
    assert.strictEqual(reconRes.status, 200, 'Reconciliation must return 200');
    assert.strictEqual(reconRes.json.ok, true);
    assert.ok(reconRes.json.reconciliation !== undefined, 'Must return reconciliation diff object');
    console.log('✔ GET /api/admin/integrations/reconciliation computed external vs internal diffs.');

    const resolveRes = await request('POST', '/api/admin/integrations/reconciliation/resolve', authHeaders, {
      action: 'sync_field',
      employeeId: 'emp_1',
      field: 'department',
      value: 'Advanced Manufacturing',
    });
    assert.strictEqual(resolveRes.status, 200, 'Resolve must return 200');
    assert.strictEqual(resolveRes.json.resolved, true);
    console.log('✔ POST /api/admin/integrations/reconciliation/resolve resolved discrepancy successfully.\n');

    console.log('=============================================================');
    console.log('🎉 ALL EXECUTIVE REPORTS & INTEGRATIONS TESTS PASSED 100%!');
    console.log('=============================================================\n');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  if (server) server.close();
  process.exit(1);
});
