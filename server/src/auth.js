const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { data: db, DATA_DIR } = require('./db');

const isProd = process.env.NODE_ENV === 'production';
const _generatedSecret = crypto.randomBytes(32).toString('hex');

function getOrGenerateJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try {
    const secretPath = path.join(DATA_DIR, '.jwt_secret');
    if (fs.existsSync(secretPath)) {
      const stored = fs.readFileSync(secretPath, 'utf8').trim();
      if (stored && stored.length >= 32) return stored;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch (_) {
    return isProd ? _generatedSecret : 'dev-secret-change-me-in-production';
  }
}

const JWT_SECRET = getOrGenerateJwtSecret();

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 3;
const TOKEN_TTL_S = 30 * 24 * 3600;

// ---- hashing ----
function hash(secret, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hashHex = crypto.scryptSync(String(secret), salt, 32).toString('hex');
  return `${salt}:${hashHex}`;
}

function verifyHash(secret, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt] = stored.split(':');
  const candidate = hash(secret, salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- OTP (Distributed Cluster Ephemeral Store with Auto-Expiring TTL & Attempt Caps) ----
const _otpStore = new Map();
let _redisPub = null;
let _redisSub = null;
let _clusterInitialized = false;

function _initClusterSync() {
  if (_clusterInitialized) return;
  _clusterInitialized = true;
  try {
    const { isConfigured, getRedisClient, getRedisSubscriber } = require('./queue/redis');
    if (!isConfigured()) return;
    const INSTANCE_ID = `inst_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    _redisPub = getRedisClient();
    _redisSub = getRedisSubscriber();
    if (_redisSub && typeof _redisSub.subscribe === 'function') {
      _redisSub.subscribe('elaraby:cluster:otp').catch?.(() => {});
      _redisSub.on('message', (channel, msg) => {
        if (channel === 'elaraby:cluster:otp') {
          try {
            const data = JSON.parse(msg);
            if (data.instanceId === INSTANCE_ID) return;
            if (data.type === 'create') {
              const remaining = data.expiresAt - Date.now();
              if (remaining > 0) {
                const timer = setTimeout(() => _otpStore.delete(data.nationalId), remaining);
                if (timer.unref) timer.unref();
                _otpStore.set(data.nationalId, {
                  nationalId: data.nationalId,
                  codeHash: data.codeHash,
                  expiresAt: data.expiresAt,
                  attempts: data.attempts || 0,
                  timer,
                });
              }
            } else if (data.type === 'delete') {
              const existing = _otpStore.get(data.nationalId);
              if (existing?.timer) clearTimeout(existing.timer);
              _otpStore.delete(data.nationalId);
            }
          } catch (_) {}
        }
      });
    }
  } catch (_) {}
}

function createOtp(dbInstance, nationalId) {
  _initClusterSync();
  const code = String(crypto.randomInt(100000, 999999));
  const existing = _otpStore.get(nationalId);
  if (existing && existing.timer) {
    clearTimeout(existing.timer);
  }
  const timer = setTimeout(() => {
    _otpStore.delete(nationalId);
  }, OTP_TTL_MS);
  if (timer.unref) timer.unref();

  const codeHash = hash(code);
  const expiresAt = Date.now() + OTP_TTL_MS;

  _otpStore.set(nationalId, {
    nationalId,
    codeHash,
    expiresAt,
    attempts: 0,
    timer,
  });

  if (_redisPub && typeof _redisPub.publish === 'function') {
    _redisPub.publish('elaraby:cluster:otp', JSON.stringify({
      type: 'create',
      nationalId,
      codeHash,
      expiresAt,
      attempts: 0,
    })).catch?.(() => {});
  }

  // Ensure db.otpCodes is empty so it never writes ephemeral codes to disk
  if (dbInstance && dbInstance.otpCodes && dbInstance.otpCodes.length > 0) {
    dbInstance.otpCodes = [];
  }
  return code;
}

function verifyOtp(dbInstance, nationalId, code) {
  _initClusterSync();
  const rec = _otpStore.get(nationalId);
  if (!rec) return { ok: false, reason: 'not_found' };
  if (Date.now() > rec.expiresAt) {
    if (rec.timer) clearTimeout(rec.timer);
    _otpStore.delete(nationalId);
    if (_redisPub && typeof _redisPub.publish === 'function') {
      _redisPub.publish('elaraby:cluster:otp', JSON.stringify({ type: 'delete', nationalId })).catch?.(() => {});
    }
    return { ok: false, reason: 'expired' };
  }
  rec.attempts = (rec.attempts || 0) + 1;
  const ok = verifyHash(code, rec.codeHash);
  if (ok) {
    if (rec.timer) clearTimeout(rec.timer);
    _otpStore.delete(nationalId);
    if (_redisPub && typeof _redisPub.publish === 'function') {
      _redisPub.publish('elaraby:cluster:otp', JSON.stringify({ type: 'delete', nationalId })).catch?.(() => {});
    }
    return { ok: true };
  }
  if (rec.attempts >= MAX_OTP_ATTEMPTS) {
    if (rec.timer) clearTimeout(rec.timer);
    _otpStore.delete(nationalId);
    if (_redisPub && typeof _redisPub.publish === 'function') {
      _redisPub.publish('elaraby:cluster:otp', JSON.stringify({ type: 'delete', nationalId })).catch?.(() => {});
    }
    return { ok: false, reason: 'max_attempts_exceeded', attempts: rec.attempts };
  }
  return { ok: false, reason: 'invalid_code', remainingAttempts: MAX_OTP_ATTEMPTS - rec.attempts };
}

// ---- tokens (HS256, JWT-compatible structure) ----
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S }),
  );
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- O(1) Employee Indexed Lookup Cache ----
let _cachedEmployeesRef = null;
let _cachedEmployeesLen = -1;
const _empById = new Map();
const _empByNationalId = new Map();

function getEmployeeById(id) {
  const employees = db().employees || [];
  if (_cachedEmployeesRef !== employees || _cachedEmployeesLen !== employees.length) {
    _empById.clear();
    _empByNationalId.clear();
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      if (emp.id) _empById.set(emp.id, emp);
      if (emp.nationalId) _empByNationalId.set(emp.nationalId, emp);
    }
    _cachedEmployeesRef = employees;
    _cachedEmployeesLen = employees.length;
  }
  return _empById.get(id);
}

// ---- express middlewares ----
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload || payload.scope !== 'employee') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const employee = getEmployeeById(payload.sub);
  if (!employee || employee.active === false) {
    return res.status(401).json({ error: 'account_deactivated' });
  }
  if ((employee.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    return res.status(401).json({ error: 'token_revoked' });
  }
  req.employeeId = payload.sub;
  req.employee = employee;
  req.authPayload = payload;
  next();
}

function extractCookie(cookieHeader, name) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  let isCookieAuth = false;

  if (!token && req.headers.cookie) {
    token = extractCookie(req.headers.cookie, 'admin_session');
    if (token) isCookieAuth = true;
  }

  const payload = verifyToken(token);
  if (!payload || payload.scope !== 'admin') {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // If authenticated via cookie on mutating requests (POST, PUT, DELETE, PATCH), enforce CSRF
  if (isCookieAuth && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfFromHeader = req.headers['x-csrf-token'];
    const csrfFromCookie = extractCookie(req.headers.cookie, 'csrf_token');
    if (!csrfFromHeader || !csrfFromCookie || csrfFromHeader !== csrfFromCookie) {
      return res.status(403).json({ error: 'invalid_or_missing_csrf_token' });
    }
  }

  const currentDb = db();
  if (currentDb.adminDeactivated === true) {
    return res.status(401).json({ error: 'account_deactivated' });
  }
  if (currentDb.adminTokenVersion !== undefined && payload.tokenVersion !== undefined) {
    if (currentDb.adminTokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: 'token_revoked' });
    }
  }
  req.admin = payload;
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    requireAdmin(req, res, () => {
      const role = req.admin?.role || 'superadmin';
      if (allowedRoles.length > 0 && !allowedRoles.includes(role) && role !== 'superadmin') {
        return res.status(403).json({ error: 'forbidden_role_insufficient' });
      }
      next();
    });
  };
}

module.exports = {
  hash,
  verifyHash,
  createOtp,
  verifyOtp,
  signToken,
  verifyToken,
  requireAuth,
  requireAdmin,
  requireRole,
  getEmployeeById,
};
