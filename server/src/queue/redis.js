// Enterprise Redis Connection & Distributed Lock Manager
// Features:
// - High-performance ioredis connection with auto-reconnection and exponential backoff
// - Safe fallback to in-memory store when REDIS_URL is not configured (e.g. fast unit tests)
// - Distributed Mutex locks via Redlock-style SET key token NX PX
// - Cluster Pub/Sub channel management

const Redis = require('ioredis');

let _client = null;
let _subscriber = null;
let _isConfigured = null;

function isConfigured() {
  if (_isConfigured !== null) return _isConfigured;
  _isConfigured = !!(process.env.REDIS_URL || process.env.REDIS_HOST);
  return _isConfigured;
}

const { EventEmitter } = require('events');

// In-memory fallback mock for environments without running Redis instance
class InMemoryRedisMock extends EventEmitter {
  constructor() {
    super();
    this.store = new Map();
    this.subscribers = new Map();
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, mode, duration) {
    let expiresAt = null;
    if (mode === 'PX') expiresAt = Date.now() + duration;
    if (mode === 'EX') expiresAt = Date.now() + duration * 1000;
    this.store.set(key, { value: String(value), expiresAt });
    return 'OK';
  }

  async incr(key) {
    const item = this.store.get(key);
    let val = 0;
    if (item && (!item.expiresAt || Date.now() <= item.expiresAt)) {
      val = parseInt(item.value, 10) || 0;
    }
    val++;
    this.store.set(key, { value: String(val), expiresAt: item?.expiresAt || null });
    return val;
  }

  async expire(key, seconds) {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async setnx(key, value) {
    if (this.store.has(key)) {
      const item = this.store.get(key);
      if (!item.expiresAt || Date.now() <= item.expiresAt) return 0;
    }
    this.store.set(key, { value: String(value), expiresAt: null });
    return 1;
  }

  async del(...keys) {
    let deleted = 0;
    for (const k of keys) {
      if (this.store.delete(k)) deleted++;
    }
    return deleted;
  }

  async publish(channel, message) {
    this.emit('message', channel, message);
    const listeners = this.subscribers.get(channel) || [];
    listeners.forEach((fn) => {
      try { fn(channel, message); } catch (_) {}
    });
    return listeners.length + this.listenerCount('message');
  }

  async subscribe(channel, fn) {
    if (typeof fn === 'function') {
      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, []);
      }
      this.subscribers.get(channel).push(fn);
    }
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  async quit() {
    this.store.clear();
    this.subscribers.clear();
    this.removeAllListeners();
  }
}

const _inMemoryMock = new InMemoryRedisMock();

function getRedisClient() {
  if (_client) return _client;

  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_REDIS_MOCK_IN_PROD) {
      const err = new Error('FATAL: Production mode strictly forbids InMemoryRedisMock. Set REDIS_URL to connect to Redis 7+ cluster.');
      console.error(`❌ [redis] ${err.message}`);
      throw err;
    }
    return _inMemoryMock;
  }

  const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
  const isTls = url.startsWith('rediss://') || process.env.REDIS_TLS === 'true';
  const redisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  };
  if (isTls) {
    redisOptions.tls = { rejectUnauthorized: false };
  }

  _client = new Redis(url, redisOptions);

  _client.on('error', (err) => {
    console.error('[redis:error]', err.message);
  });

  return _client;
}

function getRedisSubscriber() {
  if (_subscriber) return _subscriber;
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_REDIS_MOCK_IN_PROD) {
      const err = new Error('FATAL: Production mode strictly forbids InMemoryRedisMock. Set REDIS_URL to connect to Redis 7+ cluster.');
      console.error(`❌ [redis] ${err.message}`);
      throw err;
    }
    return _inMemoryMock;
  }

  const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
  const isTls = url.startsWith('rediss://') || process.env.REDIS_TLS === 'true';
  const subOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
  if (isTls) {
    subOptions.tls = { rejectUnauthorized: false };
  }

  _subscriber = new Redis(url, subOptions);
  return _subscriber;
}

/**
 * Acquires a distributed lock using Redis SET resource token NX PX ttl.
 * @param {string} resource - Lock name
 * @param {number} ttlMs - Lock TTL in milliseconds
 * @returns {Promise<string|null>} Token if acquired, null otherwise
 */
async function acquireLock(resource, ttlMs = 5000) {
  const client = getRedisClient();
  const token = `lock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const lockKey = `lock:${resource}`;

  try {
    if (client instanceof InMemoryRedisMock) {
      const existing = await client.get(lockKey);
      if (existing) return null;
      await client.set(lockKey, token, 'PX', ttlMs);
      return token;
    }
    const result = await client.set(lockKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  } catch (err) {
    console.error('[redis:lock:acquire_error]', err.message);
    return null;
  }
}

/**
 * Releases a distributed lock if the token matches.
 * @param {string} resource - Lock name
 * @param {string} token - Acquired token
 */
async function releaseLock(resource, token) {
  const client = getRedisClient();
  const lockKey = `lock:${resource}`;
  try {
    const current = await client.get(lockKey);
    if (current === token) {
      await client.del(lockKey);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[redis:lock:release_error]', err.message);
    return false;
  }
}

/**
 * Health check probe for Redis connectivity.
 */
async function checkHealth() {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_REDIS_MOCK_IN_PROD) {
      return { status: 'not_configured', ok: false, error: 'REDIS_URL required in production' };
    }
    return { status: 'mock_in_memory', ok: true };
  }
  try {
    const client = getRedisClient();
    const start = Date.now();
    await client.ping();
    return {
      status: 'connected',
      ok: true,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'error',
      ok: false,
      error: err.message,
    };
  }
}

async function closeRedis() {
  if (_client && typeof _client.quit === 'function') {
    await _client.quit();
    _client = null;
  }
  if (_subscriber && typeof _subscriber.quit === 'function') {
    await _subscriber.quit();
    _subscriber = null;
  }
}

module.exports = {
  getRedisClient,
  getRedisSubscriber,
  acquireLock,
  releaseLock,
  checkHealth,
  closeRedis,
  isConfigured,
  InMemoryRedisMock,
};
