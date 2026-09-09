// In-Memory Brute-Force Protection: N failures on a key (nationalId / username / ip)
// locks that key for a cool-down window. Completely decoupled from persistent db.json to avoid disk I/O churn.
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes

const _attempts = new Map();

function _getRecord(key) {
  const rec = _attempts.get(key);
  if (!rec) return null;
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) {
    _attempts.delete(key);
    return null;
  }
  return rec;
}

/// Returns remaining lock seconds (>0) when the key is locked, else 0.
function lockedFor(_db, key) {
  const rec = _getRecord(key);
  if (!rec || !rec.lockedUntil) return 0;
  const remaining = rec.lockedUntil - Date.now();
  if (remaining <= 0) {
    _attempts.delete(key);
    return 0;
  }
  return Math.ceil(remaining / 1000);
}

/// Records a failure. Returns remaining lock seconds (0 if not yet locked).
function registerFailure(_db, key) {
  let rec = _getRecord(key);
  if (!rec) {
    rec = { failures: 0 };
    _attempts.set(key, rec);
  }
  rec.failures = (rec.failures || 0) + 1;
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.failures = 0;
  }
  return rec.lockedUntil ? Math.ceil((rec.lockedUntil - Date.now()) / 1000) : 0;
}

/// Clears the counter after a successful attempt.
function clearFailures(_db, key) {
  _attempts.delete(key);
}

/// Express helper: responds 429 and returns true when locked.
function guard(_db, key, res) {
  const secs = lockedFor(_db, key);
  if (secs > 0) {
    res.status(429).json({ error: 'too_many_attempts', retryAfter: secs });
    return true;
  }
  return false;
}

module.exports = { MAX_FAILURES, LOCK_MS, lockedFor, registerFailure, clearFailures, guard };
