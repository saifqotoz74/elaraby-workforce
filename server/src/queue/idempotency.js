// Enterprise Distributed Idempotency Guard
// Backed by Redis with fallback to in-memory store.
// Protects against:
// - Double form submissions (e.g. rapid multiple taps on "Submit Leave")
// - Network retry duplicates
// - Race conditions across multi-instance API deployments

const { getRedisClient, isConfigured } = require('./redis');

const DEFAULT_IDEMPOTENCY_TTL_SEC = 120; // 2 minutes window

const _memoryStore = new Map();

async function checkOrSet(key, payload = null, ttlSec = DEFAULT_IDEMPOTENCY_TTL_SEC) {
  if (!key) return { exists: false };

  const fullKey = `idempotency:${key}`;
  const client = getRedisClient();

  if (!isConfigured()) {
    const existing = _memoryStore.get(fullKey);
    if (existing) {
      if (existing.expiresAt && Date.now() > existing.expiresAt) {
        _memoryStore.delete(fullKey);
      } else {
        return { exists: true, data: existing.data };
      }
    }
    _memoryStore.set(fullKey, {
      data: payload,
      expiresAt: Date.now() + ttlSec * 1000,
    });
    return { exists: false };
  }

  try {
    const serialized = JSON.stringify(payload || { timestamp: Date.now() });
    const res = await client.set(fullKey, serialized, 'EX', ttlSec, 'NX');
    if (res === 'OK') {
      return { exists: false };
    }
    const cached = await client.get(fullKey);
    return {
      exists: true,
      data: cached ? JSON.parse(cached) : null,
    };
  } catch (err) {
    console.error('[idempotency:error]', err.message);
    return { exists: false };
  }
}

async function saveResponse(key, responseData, ttlSec = DEFAULT_IDEMPOTENCY_TTL_SEC) {
  if (!key) return;
  const fullKey = `idempotency:${key}`;
  const client = getRedisClient();

  if (!isConfigured()) {
    _memoryStore.set(fullKey, {
      data: responseData,
      expiresAt: Date.now() + ttlSec * 1000,
    });
    return;
  }

  try {
    await client.set(fullKey, JSON.stringify(responseData), 'EX', ttlSec);
  } catch (err) {
    console.error('[idempotency:save_response_error]', err.message);
  }
}

async function clear(key) {
  if (!key) return;
  const fullKey = `idempotency:${key}`;
  const client = getRedisClient();
  if (!isConfigured()) {
    _memoryStore.delete(fullKey);
    return;
  }
  try {
    await client.del(fullKey);
  } catch (_) {}
}

module.exports = {
  checkOrSet,
  saveResponse,
  clear,
};
