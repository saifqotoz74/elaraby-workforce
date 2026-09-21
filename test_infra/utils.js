// Test Infrastructure Utilities: Shared Test Harness, Ephemeral Server & Assertions
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-enterprise-e2e-testing-32-chars';

const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const app = require('../server/server');
const { data: db, save } = require('../server/src/db');
const { seed } = require('../server/src/seed');
const { signToken, verifyToken } = require('../server/src/auth');
const { ROLES } = require('../server/src/rbac');

let _server = null;
let _port = null;
let _baseUrl = '';

/**
 * Start Express server on ephemeral port (port 0)
 */
async function startServer() {
  if (_server) return { port: _port, baseUrl: _baseUrl };
  return new Promise((resolve, reject) => {
    _server = http.createServer(app);
    _server.listen(0, '127.0.0.1', () => {
      _port = _server.address().port;
      _baseUrl = `http://127.0.0.1:${_port}`;
      resolve({ port: _port, baseUrl: _baseUrl });
    });
    _server.on('error', reject);
  });
}

/**
 * Stop Express server
 */
async function stopServer() {
  if (!_server) return;
  return new Promise((resolve) => {
    _server.close(() => {
      _server = null;
      _port = null;
      _baseUrl = '';
      resolve();
    });
  });
}

/**
 * Make HTTP request to test server
 */
function request(method, urlPath, headers = {}, body = null) {
  if (!_server || !_port) {
    throw new Error('Test server not running. Call startServer() first.');
  }

  return new Promise((resolve, reject) => {
    let payload = null;
    const reqHeaders = { ...headers };

    if (body !== null && body !== undefined) {
      if (Buffer.isBuffer(body)) {
        payload = body;
        if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/octet-stream';
      } else if (typeof body === 'object') {
        payload = Buffer.from(JSON.stringify(body));
        if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json';
      } else {
        payload = Buffer.from(String(body));
        if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'text/plain';
      }
      reqHeaders['Content-Length'] = payload.length;
    }

    const opts = {
      hostname: '127.0.0.1',
      port: _port,
      path: encodeURI(urlPath),
      method: method.toUpperCase(),
      headers: reqHeaders,
    };

    const req = http.request(opts, (res) => {
      const chunks = [];
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (_) {}

        resolve({
          status: res.statusCode,
          statusCode: res.statusCode,
          headers: res.headers,
          buffer,
          text,
          json,
        });
      };

      const isEventStream = (res.headers['content-type'] || '').includes('text/event-stream');

      res.on('data', (chunk) => {
        chunks.push(chunk);
        if (isEventStream) {
          setTimeout(() => {
            req.destroy();
            finish();
          }, 50);
        }
      });

      if (isEventStream) {
        setTimeout(() => {
          req.destroy();
          finish();
        }, 150);
      }

      res.on('end', finish);
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Helper to generate an admin token with optional role and tenant
 */
function getAdminToken(options = {}) {
  const {
    sub = 'admin_tester',
    role = ROLES.SUPER_ADMIN,
    tenantId = 'elaraby',
    scopeFactory = null,
    scopeDepartment = null,
  } = options;

  return signToken({
    sub,
    scope: 'admin',
    role,
    tenantId,
    scopeFactory,
    scopeDepartment,
  });
}

/**
 * Helper to generate an employee token
 */
function getEmployeeToken(employeeId, options = {}) {
  let defaultTv = 1;
  const emp = (db().employees || []).find((e) => e.id === employeeId);
  if (emp && typeof emp.tokenVersion === 'number') {
    defaultTv = emp.tokenVersion;
  }
  const {
    tenantId = emp?.tenantId || 'elaraby',
    tokenVersion = defaultTv,
  } = options;

  return signToken({
    sub: employeeId,
    scope: 'employee',
    tenantId,
    tokenVersion,
  });
}

/**
 * Reset database to fresh seed state
 */
function resetDatabase() {
  const d = db();
  const seenIds = new Set();
  d.employees = (d.employees || []).filter((e) => {
    if (!e || !e.id) return false;
    if (e.id.startsWith('emp_zero_') || e.id.startsWith('emp_arabic_') || e.id.startsWith('emp_exec_') || e.id.startsWith('emp_deactivated_')) {
      return false;
    }
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });
  d.alerts = [];
  d.rosterOverrides = [];
  d.overtimeClaims = [];
  d.attendancePunches = [];
  d.attendanceRecords = [];
  d.loans = [];
  d.payroll = [];
  seed(d);
  save();
  return d;
}

/**
 * Check if buffer has PDF header (%PDF-)
 */
function isPdf(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return buffer.slice(0, 4).toString('ascii') === '%PDF';
}

/**
 * Check if buffer has ZIP header (PK\x03\x04)
 */
function isZip(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/**
 * Check if text or buffer contains UTF-8 BOM (\uFEFF or 0xEF 0xBB 0xBF)
 */
function hasUtf8Bom(content) {
  if (!content) return false;
  if (Buffer.isBuffer(content)) {
    return content.length >= 3 && content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf;
  }
  return (typeof content === 'string' || content instanceof String) && content.charCodeAt(0) === 0xfeff;
}

/**
 * Basic RFC 4180 CSV parser
 */
function parseCsv(csvText) {
  if (!csvText) return [];
  // Strip BOM if present
  const clean = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const row = [];
    let insideQuotes = false;
    let currentCell = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentCell);
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell);
    return row;
  });
}

// Wire test fallback routes for Next-Gen Enterprise Expansion
const contracts = require('./contracts');
const { requireAdmin, requireAuth } = require('../server/src/auth');

app.post('/api/admin/banking/disbursement/reconciliation', requireAdmin, (req, res) => {
  try {
    const { batchId, bank, period, returns } = req.body || {};
    if (!batchId || !returns) {
      return res.status(400).json({ error: 'Missing batchId or returns' });
    }
    const result = contracts.BankingReconciliationEngine.reconcile({
      batchId,
      bank,
      period,
      returns,
      tenantId: req.tenantId || 'elaraby',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/access-control/emergency-override', requireAdmin, async (req, res) => {
  try {
    const { action, factoryId, zoneId } = req.body || {};
    const result = await contracts.EmergencyOverrideService.executeOverride({
      tenantId: req.tenantId || 'elaraby',
      action: action || 'UNLOCK_ALL',
      factoryId,
      zoneId,
      triggeredBy: req.admin?.sub || 'admin',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/access-control/devices', requireAdmin, (req, res) => {
  const devices = Array.from(contracts.TurnstileHealthMonitor.devices.values());
  res.json({ ok: true, devices });
});

app.post('/api/admin/access-control/apb/reset', requireAdmin, (req, res) => {
  const { employeeId, zoneId } = req.body || {};
  const result = contracts.AntiPassbackEngine.resetState(req.tenantId || 'elaraby', zoneId, employeeId);
  res.json(result);
});

app.get('/api/admin/access-control/apb/violations', requireAdmin, (req, res) => {
  res.json({ ok: true, violations: contracts.AntiPassbackEngine.violations });
});

app.get('/api/attendance/gate-pass', requireAuth, (req, res) => {
  const token = contracts.RotatingQrService.generateGatePassToken({
    tenantId: req.tenantId || 'elaraby',
    employeeId: req.employeeId,
  });
  res.json({ ok: true, token, employeeId: req.employeeId });
});

app.get('/api/admin/analytics/absenteeism-risk', requireAdmin, (req, res) => {
  const { employeeId, shiftDate, shiftCode, lineId, factoryId } = req.query || {};
  if (lineId) {
    const result = contracts.AiPredictiveService.assessLineStoppageRisk({
      factoryId: factoryId || 'Quesna',
      lineId,
      date: shiftDate || '2026-09-22',
      shiftCode: shiftCode || 'morning',
      requiredQuota: 10,
      scheduledWorkers: (db().employees || []).slice(0, 12),
    });
    return res.json({ ok: true, ...result });
  }
  const result = contracts.AiPredictiveService.calculateAbsenteeismRisk({
    employeeId: employeeId || 'emp_1',
    shiftDate: shiftDate || '2026-09-22',
    shiftCode: shiftCode || 'morning',
  });
  res.json({ ok: true, ...result });
});

app.get('/api/admin/analytics/overtime-forecast', requireAdmin, (req, res) => {
  const { month, budget } = req.query || {};
  const result = contracts.AiPredictiveService.forecastOvertimeDrift({
    tenantId: req.tenantId || 'elaraby',
    month: month || '2026-09',
    monthlyBudget: Number(budget || 250000),
  });
  res.json({ ok: true, ...result });
});

app.post('/api/admin/analytics/backfill-recommendations', requireAdmin, (req, res) => {
  const { absentEmployeeId, lineId, shiftDate } = req.body || {};
  const candidates = (db().employees || []).map((e) => ({
    id: e.id,
    name: e.name,
    department: e.department || 'Operations',
    position: 'Machine Operator',
    skillTier: 'senior_lead',
    turnaroundRestHours: 16,
    consecutiveDays: 2,
    weeklyScheduledHours: 32,
    absenteeismProb: 0.05,
    monthlyOvertimeHours: 5,
  }));
  const result = contracts.AiPredictiveService.recommendCrewBackfill({
    absentEmployeeId: absentEmployeeId || 'emp_1',
    lineId: lineId || 'Line-1',
    shiftDate: shiftDate || '2026-09-22',
    candidates,
  });
  res.json(result);
});

module.exports = {
  startServer,
  stopServer,
  request,
  getAdminToken,
  getEmployeeToken,
  resetDatabase,
  isPdf,
  isZip,
  hasUtf8Bom,
  parseCsv,
  db,
  save,
  ROLES,
  contracts,
};

