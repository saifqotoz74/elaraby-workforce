// Standardized Kubernetes & Enterprise Health Probes
const postgres = require('../db/postgres');
const redis = require('../queue/redis');
const storage = require('../services/storage');
const db = require('../db');

/**
 * Liveness Probe: Returns 200 as long as the Node.js process and event loop are responsive.
 * Used by Kubernetes / Docker / load balancers to detect process deadlock or hang.
 */
function livenessProbe(req, res) {
  res.status(200).json({
    status: 'UP',
    process: 'elaraby-workforce-api',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Readiness Probe: Answers whether the instance can safely accept live user traffic.
 * Validates primary database connectivity, Redis distributed state, and storage operational status.
 */
async function readinessProbe(req, res) {
  const isProd = process.env.NODE_ENV === 'production';
  const pgHealth = await postgres.checkHealth();
  const redisHealth = await redis.checkHealth();
  const storageHealth = await storage.checkHealth();

  let isDbReady = false;
  let records = {};

  try {
    const d = db.data();
    isDbReady = !!d && Array.isArray(d.employees);
    records = {
      employees: d.employees?.length || 0,
      requests: d.requests?.length || 0,
      auditLogs: d.auditLogs?.length || 0,
    };
  } catch (_) {}

  // Safe health objects without leaking passwords or private credentials
  const safePgHealth = {
    status: pgHealth.status,
    ok: pgHealth.ok,
    latencyMs: pgHealth.latencyMs,
    database: pgHealth.database,
    error: pgHealth.error ? 'Connection failed' : undefined,
  };

  const safeRedisHealth = {
    status: redisHealth.status,
    ok: redisHealth.ok,
    latencyMs: redisHealth.latencyMs,
    error: redisHealth.error ? 'Redis ping failed' : undefined,
  };

  const safeStorageHealth = {
    provider: storage.getActiveProvider().name,
    status: storageHealth.status,
    ok: storageHealth.ok,
  };

  // In production, require PostgreSQL and Redis without mock fallbacks
  if (isProd && !process.env.ALLOW_JSON_IN_PROD) {
    const pgFailing = !postgres.isConfigured() || !pgHealth.ok;
    const redisFailing = !redis.isConfigured() || !redisHealth.ok || redisHealth.status === 'mock_in_memory';
    const storageFailing = !storageHealth.ok;

    if (pgFailing || redisFailing || storageFailing) {
      return res.status(503).json({
        status: 'DOWN',
        ready: false,
        reason: pgFailing ? 'database_unavailable' : (redisFailing ? 'redis_unavailable' : 'storage_unavailable'),
        dependencies: {
          database: safePgHealth,
          redis: safeRedisHealth,
          storage: safeStorageHealth,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    // In dev / test: if Postgres is explicitly configured but failing, return 503
    if (postgres.isConfigured() && !pgHealth.ok) {
      return res.status(503).json({
        status: 'DOWN',
        ready: false,
        reason: 'database_unavailable',
        dependencies: {
          database: safePgHealth,
          redis: safeRedisHealth,
          storage: safeStorageHealth,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  res.status(200).json({
    status: 'UP',
    ready: true,
    uptimeSeconds: Math.floor(process.uptime()),
    dependencies: {
      database: postgres.isConfigured() ? safePgHealth : { mode: 'json_compat', ok: true },
      redis: safeRedisHealth,
      storage: safeStorageHealth,
    },
    records,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  livenessProbe,
  readinessProbe,
};
