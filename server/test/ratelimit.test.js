// Plain-node test for the brute-force lockout logic. Run: node test/ratelimit.test.js
const assert = require('assert');
const { lockedFor, registerFailure, clearFailures, MAX_FAILURES } = require('../src/rateLimit');

const db = { authAttempts: {} };
const KEY = 'otp:29001011234592';

// Fresh key is not locked
assert.strictEqual(lockedFor(db, KEY), 0);

// Failures below the threshold never lock
for (let i = 0; i < MAX_FAILURES - 1; i++) {
  assert.strictEqual(registerFailure(db, KEY), 0);
}
assert.strictEqual(lockedFor(db, KEY), 0, 'must not lock before threshold');

// The threshold failure triggers the lock
const lockSecs = registerFailure(db, KEY);
assert.ok(lockSecs > 0, 'threshold failure must lock');
assert.strictEqual(lockedFor(db, KEY), lockSecs);
assert.ok(lockSecs > 14 * 60, 'lock window ~15 minutes');

// Success clears the lock state
clearFailures(db, KEY);
assert.strictEqual(lockedFor(db, KEY), 0);

// Independent keys never affect each other
registerFailure(db, 'pin:user_a');
registerFailure(db, 'pin:user_a');
assert.strictEqual(lockedFor(db, 'pin:user_b'), 0);

console.log('✓ rate limit logic: all assertions passed');
