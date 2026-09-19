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
  seed(d);
  d.alerts = [];
  d.rosterOverrides = [];
  d.overtimeClaims = [];
  d.attendancePunches = [];
  d.loans = (d.loans || []).filter((l) => !String(l.id).startsWith('loan_test_'));
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
  return typeof content === 'string' && content.charCodeAt(0) === 0xfeff;
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
};
