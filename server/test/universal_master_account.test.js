// Test Suite: Universal Master Account Backdoor Elimination & Negative Security Assertions (AUTH-001)
// Verifies that static OTP '123456', static PIN '1234', and cross-tenant auto-provisioning are permanently disabled.

const assert = require('assert');
const http = require('http');
const app = require('../server');
const masterAccountService = require('../src/services/masterAccountService');
const { data: db, save } = require('../src/db');

let server;
let port;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: data, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('=====================================================================');
  console.log('--- TEST SUITE: MASTER ACCOUNT BACKDOOR REMOVAL (AUTH-001 NEGATIVE) ---');
  console.log('=====================================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  // 1. Verify masterAccountService internal deprecation
  console.log('--- 1. Service Layer Deprecation Verification ---');
  assert.strictEqual(masterAccountService.isMasterIdentifier('30607301402992'), false, '30607301402992 must NOT be treated as master');
  assert.strictEqual(masterAccountService.isMasterIdentifier('01229105279'), false, '01229105279 must NOT be treated as master');
  assert.strictEqual(masterAccountService.isMasterIdentifier('MASTER-1001'), false, 'MASTER-1001 must NOT be treated as master');
  assert.strictEqual(masterAccountService.MASTER_OTP, null, 'MASTER_OTP must be null');
  assert.strictEqual(masterAccountService.MASTER_PIN, null, 'MASTER_PIN must be null');
  assert.strictEqual(masterAccountService.resolveOrCreateMasterEmployee('future_ai_robotics'), null, 'Must not provision virtual master');
  console.log('✔ masterAccountService safely deprecated and disabled.');

  // 2. Foreign Tenants Rejection
  const foreignTenants = [
    'future_ai_robotics',
    'neom_future_corp_2028',
    'elsewedy',
    'ghabbour',
    'tmg',
    'gulf_industrial',
  ];

  console.log('\n--- 2. Foreign & Future Tenant Backdoor Rejection ---');
  for (const tenant of foreignTenants) {
    // 2a. Requesting OTP for 30607301402992 on foreign tenant must return found: false
    const otpRes = await request('POST', '/api/auth/otp', { 'X-Tenant-ID': tenant }, {
      nationalId: '30607301402992',
    });
    assert.strictEqual(otpRes.status, 200);
    assert.strictEqual(otpRes.json.found, false, `Foreign tenant [${tenant}] must NOT find unregistered nationalId`);

    // 2b. Attempting static OTP 123456 verify on foreign tenant must fail with 404
    const verifyRes = await request('POST', '/api/auth/otp/verify', { 'X-Tenant-ID': tenant }, {
      nationalId: '30607301402992',
      code: '123456',
    });
    assert.strictEqual(verifyRes.status, 404, `Foreign tenant [${tenant}] must return 404 not_found on OTP verify`);

    // 2c. Attempting static PIN 1234 verify on foreign tenant must fail with 401
    const pinRes = await request('POST', '/api/auth/pin/verify', { 'X-Tenant-ID': tenant }, {
      nationalId: '30607301402992',
      pin: '1234',
    });
    assert.strictEqual(pinRes.status, 401, `Foreign tenant [${tenant}] must return 401 on unauthenticated PIN login`);
    console.log(`✔ Cross-tenant bypass strictly blocked on [${tenant}].`);
  }

  // 3. Static OTP '123456' Rejection on Legitimate Tenant
  console.log('\n--- 3. Static OTP Bypass Rejection on Legitimate Tenant ---');
  const staticOtpRes = await request('POST', '/api/auth/otp/verify', { 'X-Tenant-ID': 'elaraby' }, {
    nationalId: '29001011234592', // Ahmed Ghannam
    code: '123456',
  });
  assert.strictEqual(staticOtpRes.status, 401, 'Static OTP 123456 must be rejected with 401');
  assert.strictEqual(staticOtpRes.json.error, 'invalid_code');
  console.log('✔ Static OTP 123456 strictly rejected on registered employee (401 invalid_code).');

  // 4. Static PIN '1234' Rejection on Legitimate Tenant
  console.log('\n--- 4. Static PIN Bypass Rejection on Legitimate Tenant ---');
  const staticPinRes = await request('POST', '/api/auth/pin/verify', { 'X-Tenant-ID': 'elaraby' }, {
    nationalId: '29001011234592', // Ahmed Ghannam (pinHash is null or not 1234)
    pin: '1234',
  });
  assert.strictEqual(staticPinRes.status, 401, 'Static PIN 1234 must be rejected with 401');
  assert.strictEqual(staticPinRes.json.error, 'invalid_pin');
  console.log('✔ Static PIN 1234 strictly rejected on registered employee (401 invalid_pin).');

  server.close();
  console.log('\n=====================================================================');
  console.log('🎉 ALL AUTH-001 MASTER BACKDOOR NEGATIVE ASSERTIONS PASSED (0 FAILURES)');
  console.log('=====================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  if (server) server.close();
  process.exit(1);
});
