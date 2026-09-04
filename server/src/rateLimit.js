// Brute-force protection: N failures on a key (nationalId / username / ip)
// locks that key for a cool-down window. Counters reset on success or expiry.
const { save } = require('./db');

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

function _store(db) {
  if (!db.authAttempts) db.authAttempts = {};
  return db.authAttempts;
}

/// Returns remaining lock seconds (>0) when the key is locked, else 0.
function lockedFor(db, key) {
  const rec = _store(db)[key];
  if (!rec?.lockedUntil) return 0;
  const remaining = rec.lockedUntil - Date.now();
  if (remaining <= 0) {
    delete _store(db)[key];
    return 0;
  }
  return Math.ceil(remaining / 1000);
}

/// Records a failure. Returns remaining lock seconds (0 if not yet locked).
function registerFailure(db, key) {
  const store = _store(db);
  const rec = store[key] || { failures: 0 };
  rec.failures += 1;
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.failures = 0;
  }
  store[key] = rec;
  save();
  return rec.lockedUntil ? Math.ceil((rec.lockedUntil - Date.now()) / 1000) : 0;
}

/// Clears the counter after a successful attempt.
function clearFailures(db, key) {
  delete _store(db)[key];
  save();
}

/// Express helper: responds 429 and returns true when locked.
function guard(db, key, res) {
  const secs = lockedFor(db, key);
  if (secs > 0) {
    res.status(429).json({ error: 'too_many_attempts', retryAfter: secs });
    return true;
  }
  return false;
}

module.exports = { MAX_FAILURES, LOCK_MS, lockedFor, registerFailure, clearFailures, guard };
