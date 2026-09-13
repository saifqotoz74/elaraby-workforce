// Elaraby Connect — Enterprise API server + Admin dashboard host.
const path = require('path');
const express = require('express');
const config = require('./src/config');
config.load();
const { data, save, flushSync } = require('./src/db');
const { seed } = require('./src/seed');
const { errorHandler } = require('./src/errors');
const employeeRoutes = require('./src/routes/employee');
const adminRoutes = require('./src/routes/admin');
const tenantRoutes = require('./src/routes/tenant');
const { tenantResolver } = require('./src/tenantResolver');

const correlationMiddleware = require('./src/observability/correlationMiddleware');
const { livenessProbe, readinessProbe } = require('./src/observability/healthCheck');
const metrics = require('./src/observability/metrics');
const postgres = require('./src/db/postgres');
const { closeRedis } = require('./src/queue/redis');
const { closeAllQueues } = require('./src/queue/queues');

const PORT = process.env.PORT || 3000;
const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const isProd = process.env.NODE_ENV === 'production';
const d = data();
if (!isVercel && !isProd && d.employees.length === 0) {
  seed(d);
  save();
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Enterprise Request Correlation & Tracing
app.use(correlationMiddleware);

// Multi-Tenant Institutional Resolver
app.use(tenantResolver);

// Initialize Realtime Multi-Instance SSE Bridge via Redis Pub/Sub
try {
  const realtimeService = require('./src/services/realtimeService');
  const { isConfigured, getRedisClient, getRedisSubscriber } = require('./src/queue/redis');
  if (isConfigured()) {
    const INSTANCE_ID = `inst_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    const redisPub = getRedisClient();
    const redisSub = getRedisSubscriber();
    if (redisSub && typeof redisSub.subscribe === 'function') {
      redisSub.subscribe('elaraby:realtime:events').catch?.(() => {});
      redisSub.on('message', (channel, message) => {
        if (channel === 'elaraby:realtime:events') {
          try {
            const { event, payload, filter, instanceId } = JSON.parse(message);
            if (instanceId === INSTANCE_ID) return; // Drop echo to self
            realtimeService.broadcast(event, payload, { ...(filter || {}), _fromCluster: true });
          } catch (_) {}
        }
      });
      realtimeService.setClusterPublisher((event, payload, filter) => {
        try {
          redisPub.publish('elaraby:realtime:events', JSON.stringify({ event, payload, filter, instanceId: INSTANCE_ID })).catch?.(() => {});
        } catch (_) {}
      });
    }
  }
} catch (_) {}

// Enterprise Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:;",
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// Prometheus Metrics Endpoint
app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.toPrometheusText());
});

// Standard Kubernetes Liveness & Readiness Probes
app.get('/health', livenessProbe);
app.get('/liveness', livenessProbe);
app.get('/readiness', readinessProbe);

// Production-aware CORS: whitelist-enforced in production or configured domain
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const configured = process.env.CORS_ORIGIN;
  if (configured && configured !== '*') {
    const allowed = configured.split(',').map((s) => s.trim());
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      res.setHeader('Access-Control-Allow-Origin', allowed[0]);
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Idempotency-Key, X-Tenant-ID');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health & Readiness probes for Kubernetes / Docker / load balancers
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'elaraby-workforce-api',
    status: 'healthy',
    timestamp: Date.now(),
  });
});

app.get('/api/ready', (req, res) => {
  try {
    const d = data();
    const ready = !!d && Array.isArray(d.employees);
    res.status(ready ? 200 : 503).json({
      ready,
      uptime: Math.floor(process.uptime()),
      dbRecords: {
        employees: d.employees.length,
        requests: d.requests.length,
        auditLogs: (d.auditLogs || []).length,
      },
    });
  } catch (err) {
    res.status(503).json({ ready: false, error: err.message });
  }
});

app.get('/api/version', (req, res) => {
  try {
    const d = data();
    res.json({
      apiVersion: '1.2.0',
      env: process.env.NODE_ENV || 'development',
      appVersionConfig: d.appVersionConfig || {},
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api', tenantRoutes);
app.use('/api', employeeRoutes);
app.use('/api/admin', adminRoutes);

// Uploaded images + admin dashboard (single-file SPA).
const storage = require('./src/services/storage');
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Universal Storage Provider asset retrieval bridge (local + S3/MinIO)
app.get('/api/uploads/*', async (req, res) => {
  try {
    const key = req.params[0];
    const file = await storage.getFile(key);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.contentLength);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  } catch (err) {
    if (err.statusCode === 404 || err.message === 'file_not_found') {
      return res.status(404).json({ error: 'file_not_found' });
    }
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin', (req, res) => {
  res.redirect(301, '/admin/');
});
app.get('/admin/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Structured JSON error handler
app.use(errorHandler);

if (!isVercel && require.main === module) {
  (async () => {
    config.printStartupBanner();
    if (postgres.isConfigured()) {
      if (isProd) {
        const pgHealth = await postgres.checkHealth();
        if (!pgHealth.ok) {
          console.error('❌ [FATAL] PostgreSQL health check failed in production:', pgHealth.error);
          process.exit(1);
        }
      }
      await postgres.initializeSchema();
    }
    app.listen(PORT, () => {
      console.log(`✔ Elaraby Connect API:      http://localhost:${PORT}/api/health`);
      console.log(`✔ Admin dashboard:          http://localhost:${PORT}/admin/`);
      console.log(`  Admin login: ${process.env.ADMIN_USER || 'admin'} / [CONFIGURED VIA ADMIN_PASS]`);
    });
  })();
}

// Global Process Resilience Guards: Prevent server death from external async rejections (Twilio/Firebase/Vercel)
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [PROCESS GUARD] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [PROCESS GUARD] Uncaught Exception:', err.message, err.stack);
});

// Graceful Process Termination: Flush pending writes and close connections cleanly
const gracefulShutdown = async (signal) => {
  console.log(`[PROCESS] Received ${signal}. Starting graceful shutdown...`);
  try {
    await flushSync();
    await closeAllQueues();
    await closeRedis();
    await postgres.closePool();
    console.log('[PROCESS] All connections and database flushed cleanly. Exiting.');
  } catch (err) {
    console.error('[PROCESS] Error during graceful shutdown:', err.message);
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
