// In-Memory Brute-Force Protection: N failures on a key (nationalId / username / ip)
// locks that key for a cool-down window. Completely decoupled from persistent db.json to avoid disk I/O churn.
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ENTRIES = 5000; // Maximum tracked keys in memory to prevent OOM attacks

const _attempts = new Map();

function sweepExpired() {
  const now = Date.now();
  for (const [key, rec] of _attempts.entries()) {
    if (rec.lockedUntil && rec.lockedUntil <= now) {
      _attempts.delete(key);
    } else if (!rec.lockedUntil && rec.lastAttempt && (now - rec.lastAttempt > LOCK_MS)) {
      _attempts.delete(key);
    }
  }
}

// Background cleanup sweep every 5 minutes (unref'd so it doesn't keep node alive)
const _cleanupTimer = setInterval(sweepExpired, 5 * 60 * 1000);
if (_cleanupTimer.unref) _cleanupTimer.unref();

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

let _rateLimitRedisPub = null;
let _rateLimitRedisSub = null;
let _rateLimitClusterInit = false;

function _initRateLimitClusterSync() {
  if (_rateLimitClusterInit) return;
  _rateLimitClusterInit = true;
  try {
    const { isConfigured, getRedisClient, getRedisSubscriber } = require('./queue/redis');
    if (!isConfigured()) return;
    const INSTANCE_ID = `inst_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    _rateLimitRedisPub = getRedisClient();
    _rateLimitRedisSub = getRedisSubscriber();
    if (_rateLimitRedisSub && typeof _rateLimitRedisSub.subscribe === 'function') {
      _rateLimitRedisSub.subscribe('elaraby:cluster:ratelimit').catch?.(() => {});
      _rateLimitRedisSub.on('message', (channel, msg) => {
        if (channel === 'elaraby:cluster:ratelimit') {
          try {
            const data = JSON.parse(msg);
            if (data.instanceId === INSTANCE_ID) return;
            if (data.type === 'lock' && data.key && data.lockedUntil) {
              _attempts.set(data.key, { lockedUntil: data.lockedUntil, failures: MAX_FAILURES });
            } else if (data.type === 'clear' && data.key) {
              _attempts.delete(data.key);
            }
          } catch (_) {}
        }
      });
    }
  } catch (_) {}
}

/// Records a failure. Returns remaining lock seconds (0 if not yet locked).
function registerFailure(_db, key) {
  _initRateLimitClusterSync();
  // Evict entries if approaching memory threshold
  if (_attempts.size >= MAX_ENTRIES) {
    sweepExpired();
    if (_attempts.size >= MAX_ENTRIES) {
      // Evict oldest 10% of entries to keep memory strictly bounded
      const toDelete = Math.max(1, Math.ceil(MAX_ENTRIES * 0.1));
      let count = 0;
      for (const k of _attempts.keys()) {
        _attempts.delete(k);
        count++;
        if (count >= toDelete) break;
      }
    }
  }

  let rec = _getRecord(key);
  if (!rec) {
    rec = { failures: 0 };
    _attempts.set(key, rec);
  }
  rec.lastAttempt = Date.now();
  rec.failures = (rec.failures || 0) + 1;
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.failures = 0;

    if (_rateLimitRedisPub && typeof _rateLimitRedisPub.publish === 'function') {
      _rateLimitRedisPub.publish('elaraby:cluster:ratelimit', JSON.stringify({
        type: 'lock',
        key,
        lockedUntil: rec.lockedUntil,
      })).catch?.(() => {});
    }
  }
  return rec.lockedUntil ? Math.ceil((rec.lockedUntil - Date.now()) / 1000) : 0;
}

/// Clears the counter after a successful attempt.
function clearFailures(_db, key) {
  _initRateLimitClusterSync();
  _attempts.delete(key);
  if (_rateLimitRedisPub && typeof _rateLimitRedisPub.publish === 'function') {
    _rateLimitRedisPub.publish('elaraby:cluster:ratelimit', JSON.stringify({
      type: 'clear',
      key,
    })).catch?.(() => {});
  }
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

module.exports = {
  MAX_FAILURES,
  LOCK_MS,
  MAX_ENTRIES,
  lockedFor,
  registerFailure,
  clearFailures,
  guard,
  sweepExpired,
  _attempts,
};
