// Auth utilities: OTP codes, PIN hashing (scrypt), and HMAC-signed tokens.
// Zero external dependencies — everything from node:crypto.
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
if (isProd && JWT_SECRET === 'dev-secret-change-me-in-production') {
  console.error('FATAL: Default JWT_SECRET used in production! Halting.');
  process.exit(1);
}
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

// ---- OTP (In-Memory Ephemeral Store with Auto-Expiring TTL & Attempt Caps) ----
const _otpStore = new Map();

function createOtp(dbInstance, nationalId) {
  const code = String(crypto.randomInt(100000, 999999));
  const existing = _otpStore.get(nationalId);
  if (existing && existing.timer) {
    clearTimeout(existing.timer);
  }
  const timer = setTimeout(() => {
    _otpStore.delete(nationalId);
  }, OTP_TTL_MS);
  if (timer.unref) timer.unref();

  _otpStore.set(nationalId, {
    nationalId,
    codeHash: hash(code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    timer,
  });

  // Ensure db.otpCodes is empty so it never writes ephemeral codes to disk
  if (dbInstance && dbInstance.otpCodes && dbInstance.otpCodes.length > 0) {
    dbInstance.otpCodes = [];
  }
  return code;
}

function verifyOtp(dbInstance, nationalId, code) {
  const rec = _otpStore.get(nationalId);
  if (!rec) return { ok: false, reason: 'not_found' };
  if (Date.now() > rec.expiresAt) {
    if (rec.timer) clearTimeout(rec.timer);
    _otpStore.delete(nationalId);
    return { ok: false, reason: 'expired' };
  }
  rec.attempts = (rec.attempts || 0) + 1;
  const ok = verifyHash(code, rec.codeHash);
  if (ok) {
    if (rec.timer) clearTimeout(rec.timer);
    _otpStore.delete(nationalId);
    return { ok: true };
  }
  if (rec.attempts >= MAX_OTP_ATTEMPTS) {
    if (rec.timer) clearTimeout(rec.timer);
    _otpStore.delete(nationalId);
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

const { data: db } = require('./db');

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

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload || payload.scope !== 'admin') {
    return res.status(401).json({ error: 'unauthorized' });
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
