// Phase 1: Security Foundation Verification Test Suite
// Rigorously verifies closure of P0 backdoors, privilege escalation, OTP leaks, XSS, and auth bypasses.

const assert = require('assert');
const http = require('http');
const app = require('../server');
const { data: db, save, nextId } = require('../src/db');
const { hash, signToken } = require('../src/auth');
const { ROLES } = require('../src/rbac');

let server;
let baseUrl;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers },
    };

    let payload = null;
    if (body !== null && typeof body === 'object') {
      payload = JSON.stringify(body);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  console.log('\n=============================================================');
  console.log('--- RUNNING PHASE 1: SECURITY FOUNDATION VERIFICATION ---');
  console.log('=============================================================\n');

  try {
    // 1. BACKDOOR PASSWORD REMOVAL
    console.log('--- 1. Admin Backdoor Passwords & Role Validation ---');
    const admin123Res = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'admin123',
    });
    assert.strictEqual(admin123Res.status, 401, 'Hardcoded "admin123" backdoor must be rejected');
    console.log('✔ Rejects hardcoded backdoor "admin123" (401).');

    const invalidRoleRes = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: process.env.ADMIN_PASS || 'elaraby2026',
      role: 'unauthorized_super_hacker',
    });
    assert.strictEqual(invalidRoleRes.status, 400, 'Invalid client-supplied role must be rejected');
    assert.strictEqual(invalidRoleRes.json.error, 'invalid_role');
    console.log('✔ Rejects invalid client-supplied role (400 invalid_role).');

    // 2. SHARED DEVICE FCM TOKEN UNBINDING
    console.log('\n--- 2. Shared Device FCM Token Unbinding ---');
    const sharedToken = 'fcm_shared_device_token_abc123';
    const emp1Id = 'emp_test_fcm_1';
    const emp2Id = 'emp_test_fcm_2';

    db().employees = (db().employees || []).filter((e) => e.id !== emp1Id && e.id !== emp2Id);
    db().employees.push(
      { id: emp1Id, name: 'FCM Emp 1', active: true, tokenVersion: 1 },
      { id: emp2Id, name: 'FCM Emp 2', active: true, tokenVersion: 1 }
    );
    save();

    const emp1Jwt = signToken({ sub: emp1Id, scope: 'employee', tokenVersion: 1 });
    const emp2Jwt = signToken({ sub: emp2Id, scope: 'employee', tokenVersion: 1 });

    // Employee 1 binds device
    const bind1 = await request('POST', '/api/fcm-token', { Authorization: `Bearer ${emp1Jwt}` }, { token: sharedToken });
    assert.strictEqual(bind1.status, 200);

    const check1 = (db().fcmTokens || []).filter((t) => t.token === sharedToken);
    assert.strictEqual(check1.length, 1);
    assert.strictEqual(check1[0].employeeId, emp1Id);

    // Employee 2 logs into the same physical phone
    const bind2 = await request('POST', '/api/fcm-token', { Authorization: `Bearer ${emp2Jwt}` }, { token: sharedToken });
    assert.strictEqual(bind2.status, 200);

    const check2 = (db().fcmTokens || []).filter((t) => t.token === sharedToken);
    assert.strictEqual(check2.length, 1, 'Device token must exist at most once across all employees');
    assert.strictEqual(check2[0].employeeId, emp2Id, 'Device token must be reassigned to Employee 2');
    console.log('✔ Device token unbinds from previous employee when new employee logs in on shared device.');

    // 3. ACCOUNT DELETION MANDATORY PIN
    console.log('\n--- 3. Account Deletion Mandatory PIN ---');
    const testDelEmpId = 'emp_test_deletion_safe';
    const delEmp = {
      id: testDelEmpId,
      name: 'Safe Deletion Employee',
      nationalId: '29011112223334',
      phone: '+201011112233',
      pinHash: hash('9876'),
      active: true,
      tokenVersion: 1,
    };
    db().employees = (db().employees || []).filter((e) => e.id !== testDelEmpId);
    db().employees.push(delEmp);
    save();

    const delEmpToken = signToken({ sub: testDelEmpId, scope: 'employee', tokenVersion: 1 });

    // Omitted PIN -> must be rejected
    const omitPinRes = await request('POST', '/api/employee/delete-account', { Authorization: `Bearer ${delEmpToken}` }, {});
    assert.strictEqual(omitPinRes.status, 401, 'Must reject account erasure without PIN');
    assert.strictEqual(omitPinRes.json.error, 'invalid_pin');

    // Wrong PIN -> must be rejected
    const wrongPinRes = await request('POST', '/api/employee/delete-account', { Authorization: `Bearer ${delEmpToken}` }, { pin: '0000' });
    assert.strictEqual(wrongPinRes.status, 401, 'Must reject account erasure with incorrect PIN');
    assert.strictEqual(wrongPinRes.json.error, 'invalid_pin');

    // Correct PIN -> accepted
    const validPinRes = await request('POST', '/api/employee/delete-account', { Authorization: `Bearer ${delEmpToken}` }, { pin: '9876' });
    assert.strictEqual(validPinRes.status, 200);
    assert.strictEqual(validPinRes.json.ok, true);
    console.log('✔ Account deletion strictly enforces valid PIN and rejects missing or incorrect PIN (401).');

    // 4. OTP REDACTION IN AUDIT LOGS
    console.log('\n--- 4. Plaintext OTP Redaction in Audit Logs ---');
    const otpEmpId = 'emp_test_otp_redaction';
    const otpEmp = {
      id: otpEmpId,
      name: 'OTP Redaction Test Employee',
      nationalId: '29099998888777',
      phone: '+201099998888',
      active: true,
      tokenVersion: 1,
    };
    db().employees = (db().employees || []).filter((e) => e.id !== otpEmpId);
    db().employees.push(otpEmp);
    save();

    const otpReqRes = await request('POST', '/api/auth/otp', {}, { nationalId: '29099998888777' });
    assert.strictEqual(otpReqRes.status, 200);

    const latestAudit = db().auditLogs.find((l) => l.action === 'OTP_REQUESTED' && l.nationalId === '29099998888777');
    assert.ok(latestAudit, 'Audit log must be recorded');
    assert.strictEqual(latestAudit.otpCode, '[REDACTED]', 'Plaintext OTP must NOT be saved in auditLogs');
    assert.strictEqual(latestAudit.details.includes('['), false, 'Plaintext code must NOT be in details string');
    console.log('✔ Plaintext OTP code is strictly redacted in audit logs.');

    // 5. ANONYMOUS CONCERNS SANITIZATION & PROTOCOL CHECK
    console.log('\n--- 5. Anonymous Concerns Input Validation & URL Check ---');
    const xssConcernRes = await request('POST', '/api/concerns', {}, {
      category: 'Safety',
      details: 'Legitimate workplace report without XSS',
      attachedPhoto: 'javascript:alert(1)',
    });
    assert.strictEqual(xssConcernRes.status, 400, 'Malicious javascript: attachment URL must be rejected');
    assert.strictEqual(xssConcernRes.json.error, 'invalid_attachment_url');
    console.log('✔ Malicious javascript: attachment URLs strictly rejected with 400.');

    const validConcernRes = await request('POST', '/api/concerns', {}, {
      category: 'Safety',
      details: 'Oil spill on assembly line 3',
      attachedPhoto: '/uploads/img_test_evidence.png',
    });
    assert.strictEqual(validConcernRes.status, 200);
    assert.ok(validConcernRes.json.refNumber);
    console.log('✔ Valid anonymous concern accepted with clean refNumber.');

    console.log('\n=============================================================');
    console.log('ALL PHASE 1 SECURITY FOUNDATION TESTS PASSED (0 FAILURES)');
    console.log('=============================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Phase 1 test failed:', err);
  process.exit(1);
});
