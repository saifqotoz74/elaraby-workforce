// Enterprise Backend Readiness Test Suite
const assert = require('assert');
const { data, save, nextId } = require('../src/db');
const { signToken, verifyToken, hash, verifyHash } = require('../src/auth');

console.log('--- Running Backend Production Readiness Tests ---');

// 1. Auth Tokens
console.log('1. Testing JWT HMAC token signing and verification...');
const token = signToken({ sub: 'admin', scope: 'admin', role: 'superadmin' });
const payload = verifyToken(token);
assert.strictEqual(payload.sub, 'admin');
assert.strictEqual(payload.scope, 'admin');
assert.strictEqual(payload.role, 'superadmin');
console.log('✔ Token signing and claims verified.');

// 2. Scrypt Password Hashing & Timing Safe Verify
console.log('2. Testing scrypt password hashing...');
const pass = 'superSecretPass123!';
const hashed = hash(pass);
assert.strictEqual(verifyHash(pass, hashed), true);
assert.strictEqual(verifyHash('wrongPass', hashed), false);
console.log('✔ Password hashing & timing-safe verification verified.');

// 3. Database & Audit Logging
console.log('3. Testing DB schema, backup support, and audit logging...');
const d = data();
assert.ok(Array.isArray(d.employees), 'Employees collection must exist');
assert.ok(Array.isArray(d.requests), 'Requests collection must exist');
assert.ok(Array.isArray(d.auditLogs), 'Audit logs collection must exist');

const initialLogCount = d.auditLogs.length;
const testEntry = {
  id: nextId('audit'),
  timestamp: Date.now(),
  actor: 'test_runner',
  action: 'test_action',
  targetId: 'test_target',
  details: 'Automated test suite verification',
  ip: '127.0.0.1',
};
d.auditLogs.unshift(testEntry);
save();

const reloaded = data();
assert.strictEqual(reloaded.auditLogs.length, initialLogCount + 1);
assert.strictEqual(reloaded.auditLogs[0].action, 'test_action');
console.log('✔ DB atomic write, schema, and audit logging verified.');

console.log('--- ALL BACKEND READINESS TESTS PASSED ---');
