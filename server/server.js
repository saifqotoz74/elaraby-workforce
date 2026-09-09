// Elaraby Connect — Enterprise API server + Admin dashboard host.
const path = require('path');
const express = require('express');
require('./src/config').load();
const { data, save, flushSync } = require('./src/db');
const { seed } = require('./src/seed');
const { errorHandler } = require('./src/errors');
const employeeRoutes = require('./src/routes/employee');
const adminRoutes = require('./src/routes/admin');

const PORT = process.env.PORT || 3000;
const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const d = data();
if (!isVercel && d.employees.length === 0) {
  seed(d);
  save();
}

const app = express();
app.use(express.json({ limit: '10mb' }));

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

// Lightweight request log
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[api] ${req.method} ${req.path} (${req.ip})`);
  }
  next();
});

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

app.use('/api', employeeRoutes);
app.use('/api/admin', adminRoutes);

// Uploaded images + admin dashboard (single-file SPA).
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Structured JSON error handler
app.use(errorHandler);

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`✔ Elaraby Connect API:      http://localhost:${PORT}/api/health`);
    console.log(`✔ Admin dashboard:          http://localhost:${PORT}/admin/`);
    console.log(`  Admin login: admin / ${process.env.ADMIN_PASS || 'elaraby2026'} (change via ADMIN_PASS env)`);
  });
}

// Global Process Resilience Guards: Prevent server death from external async rejections (Twilio/Firebase/Vercel)
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [PROCESS GUARD] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [PROCESS GUARD] Uncaught Exception:', err.message, err.stack);
});

// Graceful Process Termination: Flush pending in-memory database writes before exit
const gracefulShutdown = async (signal) => {
  console.log(`[PROCESS] Received ${signal}. Flushing pending DB writes before shutdown...`);
  try {
    await flushSync();
    console.log('[PROCESS] Database flushed cleanly to disk. Exiting.');
  } catch (err) {
    console.error('[PROCESS] Error flushing DB during shutdown:', err.message);
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
