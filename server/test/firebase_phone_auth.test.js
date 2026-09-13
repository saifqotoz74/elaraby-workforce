// Enterprise Firebase Phone Authentication Test Suite
const assert = require('assert');
const http = require('http');
const express = require('express');

console.log('=============================================================');
console.log('--- RUNNING FIREBASE PHONE AUTHENTICATION TEST SUITE ---');
console.log('=============================================================');

async function runTests() {
  const firebaseAuth = require('../src/firebaseAuth');
  const employeeRoutes = require('../src/routes/employee');
  const { data: db } = require('../src/db');

  // Test 1: Service account verification & initialization
  console.log('\n--- 1. Firebase Admin Auth Initialization ---');
  const authInstance = firebaseAuth.getFirebaseAuth();
  assert(authInstance !== null, 'Firebase Auth instance should initialize with project credentials');
  console.log('✔ Firebase Admin Auth initialized successfully with service account.');

  // Test 2: Mock & simulated token verification in non-prod
  console.log('\n--- 2. Firebase ID Token Verification Engine ---');
  const mockResult = await firebaseAuth.verifyFirebaseIdToken('mock_token:+201229105279');
  assert.strictEqual(mockResult.ok, true, 'Mock token should verify');
  assert.strictEqual(mockResult.decoded.phone_number, '+201229105279');
  console.log('✔ Firebase ID token verification parses decoded phone claims correctly.');

  // Setup express test server
  const app = express();
  app.use(express.json());
  app.use('/api', employeeRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  function request(method, path, body) {
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
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, json: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, text: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  try {
    const testEmployee = db().employees.find((e) => e.active && e.phone);
    assert(testEmployee, 'Active employee with phone number required');
    const nationalId = testEmployee.nationalId;
    const phone = testEmployee.phone;

    // Test 3: POST /api/auth/otp returns phone number
    console.log('\n--- 3. /api/auth/otp Returns Full Phone for Firebase Client ---');
    const otpRes = await request('POST', '/api/auth/otp', { nationalId });
    assert.strictEqual(otpRes.status, 200);
    assert.strictEqual(otpRes.json.found, true);
    assert.strictEqual(otpRes.json.phone, phone, 'Response should contain registered phone for Firebase client trigger');
    console.log(`✔ POST /api/auth/otp returns registered phone: ${otpRes.json.phone} (masked: ${otpRes.json.maskedPhone})`);

    // Test 4: Verify via Firebase ID Token (Valid Token Matching Phone)
    console.log('\n--- 4. POST /api/auth/otp/verify with Valid Firebase ID Token ---');
    const validVerifyRes = await request('POST', '/api/auth/otp/verify', {
      nationalId,
      firebaseIdToken: `mock_token:${phone}`,
    });
    assert.strictEqual(validVerifyRes.status, 200, 'Valid Firebase token should authenticate');
    assert.strictEqual(validVerifyRes.json.ok, true);
    assert(validVerifyRes.json.resetToken, 'Should return resetToken');
    assert.strictEqual(validVerifyRes.json.employee.nationalId, nationalId);
    console.log('✔ Firebase Phone Auth token verified and authenticated successfully!');

    // Test 5: Verify rejection / fallback when Firebase token phone does NOT match employee
    console.log('\n--- 5. Phone Mismatch Rejection & Fallback Protection ---');
    const mismatchRes = await request('POST', '/api/auth/otp/verify', {
      nationalId,
      firebaseIdToken: 'mock_token:+201099999999', // wrong phone number
      code: '000000', // invalid OTP code
    });
    assert.strictEqual(mismatchRes.status, 401, 'Mismatched token with invalid OTP code must be rejected (401)');
    console.log('✔ Phone mismatch strictly prevented impersonation attacks.');

    // Test 6: Fallback to Server OTP when Firebase token is absent
    console.log('\n--- 6. Seamless Fallback to Server OTP Code ---');
    const newOtp = await request('POST', '/api/auth/otp', { nationalId });
    const devCode = newOtp.json.devCode;
    if (devCode) {
      const codeVerifyRes = await request('POST', '/api/auth/otp/verify', {
        nationalId,
        code: devCode,
      });
      assert.strictEqual(codeVerifyRes.status, 200);
      assert.strictEqual(codeVerifyRes.json.ok, true);
      console.log('✔ Fallback to standard server OTP code verified successfully without Firebase token.');
    }

    console.log('\n=============================================================');
    console.log('ALL FIREBASE PHONE AUTHENTICATION TESTS PASSED (0 FAILURES)');
    console.log('=============================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Firebase Phone Auth Tests Failed:', err);
  process.exit(1);
});
