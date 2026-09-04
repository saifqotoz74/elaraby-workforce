// Elaraby Connect — Enterprise API server + Admin dashboard host.
const path = require('path');
const express = require('express');
require('./src/config').load();
const { data, save } = require('./src/db');
const { seed } = require('./src/seed');
const employeeRoutes = require('./src/routes/employee');
const adminRoutes = require('./src/routes/admin');

const PORT = process.env.PORT || 3000;

seed(data());
save();

const app = express();
app.use(express.json({ limit: '10mb' }));

// Enterprise Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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

// Production-aware CORS
app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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

app.use('/api', employeeRoutes);
app.use('/api/admin', adminRoutes);

// Uploaded images + admin dashboard (single-file SPA).
const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// JSON error handler
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'internal_error' });
});

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`✔ Elaraby Connect API:      http://localhost:${PORT}/api/health`);
    console.log(`✔ Admin dashboard:          http://localhost:${PORT}/admin/`);
    console.log(`  Admin login: admin / ${process.env.ADMIN_PASS || 'elaraby2026'} (change via ADMIN_PASS env)`);
  });
}

module.exports = app;
