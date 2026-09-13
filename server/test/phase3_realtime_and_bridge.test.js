// Phase 3 Verification Test Suite: Realtime Sanitization, Socket Lifecycle & Client Credentials
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const realtimeService = require('../src/services/realtimeService');
const { data: db, DATA_DIR } = require('../src/db');
const { signToken, verifyToken } = require('../src/auth');

test('PHASE 3: Realtime Architecture, Mobile Bridge & Client Hardening', async (t) => {
  await t.test('1. Realtime Sanitization: broadcast automatically redacts sensitive credentials from SSE stream', async () => {
    let capturedRawEvent = '';

    // Mock client
    const mockRes = {
      writeHead: () => {},
      write: (str) => {
        capturedRawEvent += str;
      },
    };
    const mockReq = {
      on: () => {},
    };

    const client = realtimeService.subscribe(mockReq, mockRes, { role: 'superadmin' });

    // Broadcast an event containing sensitive keys
    realtimeService.broadcast('employee.updated', {
      employeeId: 'emp_123',
      name: 'Ahmed',
      pin: '1234',
      pinHash: 'salt:hash123',
      password: 'secretPassword',
      token: 'jwt.token.here',
      otpCode: '654321',
      details: {
        nestedPin: '4321',
      },
    });

    assert.ok(capturedRawEvent.includes('Ahmed'));
    assert.ok(capturedRawEvent.includes('"pin":"[REDACTED]"'), 'PIN must be redacted');
    assert.ok(capturedRawEvent.includes('"pinHash":"[REDACTED]"'), 'pinHash must be redacted');
    assert.ok(capturedRawEvent.includes('"password":"[REDACTED]"'), 'password must be redacted');
    assert.ok(capturedRawEvent.includes('"token":"[REDACTED]"'), 'token must be redacted');
    assert.ok(capturedRawEvent.includes('"otpCode":"[REDACTED]"'), 'otpCode must be redacted');
    assert.ok(!capturedRawEvent.includes('secretPassword'), 'Raw password must never be broadcast');
    assert.ok(!capturedRawEvent.includes('654321'), 'Raw OTP code must never be broadcast');
  });

  await t.test('2. Socket Lifecycle: Closed connections are properly unlinked to prevent leaks', async () => {
    let closeListener = null;
    let errorListener = null;

    const mockRes = {
      writeHead: () => {},
      write: () => {},
      on: () => {},
    };
    const mockReq = {
      on: (evt, cb) => {
        if (evt === 'close') closeListener = cb;
        if (evt === 'error') errorListener = cb;
      },
    };

    const initialCount = realtimeService.getActiveClientCount();
    realtimeService.subscribe(mockReq, mockRes, { role: 'superadmin' });
    assert.strictEqual(realtimeService.getActiveClientCount(), initialCount + 1);

    // Simulate socket close
    assert.ok(typeof closeListener === 'function', 'Must register close listener');
    closeListener();
    assert.strictEqual(realtimeService.getActiveClientCount(), initialCount, 'Client count must decrement on close');
  });

  await t.test('3. Persistent JWT Secret: Machine secret is persisted to avoid restart logouts', async () => {
    const secretPath = path.join(DATA_DIR, '.jwt_secret');
    assert.ok(fs.existsSync(secretPath), '.jwt_secret file must exist in DATA_DIR');
    const secret = fs.readFileSync(secretPath, 'utf8').trim();
    assert.ok(secret.length >= 32, 'Secret must be at least 32 characters');

    // Tokens signed now should verify successfully
    const token = signToken({ sub: 'emp_p3', scope: 'employee', tokenVersion: 1 });
    const payload = verifyToken(token);
    assert.strictEqual(payload.sub, 'emp_p3');
  });

  await t.test('4. Admin Client Module: apiFetch uses credentials: include for cross-subdomain sessions', async () => {
    const clientJsPath = path.join(__dirname, '../admin/js/api/client.js');
    assert.ok(fs.existsSync(clientJsPath));
    const content = fs.readFileSync(clientJsPath, 'utf8');
    assert.ok(content.includes("credentials: 'include'"), "Admin client must use credentials: 'include'");
  });
});
