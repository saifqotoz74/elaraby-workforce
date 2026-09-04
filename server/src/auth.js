// Auth utilities: OTP codes, PIN hashing (scrypt), and HMAC-signed tokens.
// Zero external dependencies — everything from node:crypto.
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
if (isProd && JWT_SECRET === 'dev-secret-change-me-in-production') {
  console.warn('⚠️ [SECURITY WARNING] Default JWT_SECRET used in production! Set JWT_SECRET in .env for full security.');
}
const OTP_TTL_MS = 5 * 60 * 1000;
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

// ---- OTP ----
function createOtp(db, nationalId) {
  const code = String(crypto.randomInt(100000, 999999));
  db.otpCodes = db.otpCodes.filter((o) => o.nationalId !== nationalId);
  db.otpCodes.push({
    nationalId,
    codeHash: hash(code),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  return code;
}

function verifyOtp(db, nationalId, code) {
  const rec = db.otpCodes.find((o) => o.nationalId === nationalId);
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) {
    db.otpCodes = db.otpCodes.filter((o) => o.nationalId !== nationalId);
    return false;
  }
  const ok = verifyHash(code, rec.codeHash);
  if (ok) {
    db.otpCodes = db.otpCodes.filter((o) => o.nationalId !== nationalId);
  }
  return ok;
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

// ---- express middlewares ----
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload || payload.scope !== 'employee') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.employeeId = payload.sub;
  next();
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload || payload.scope !== 'admin') {
    return res.status(401).json({ error: 'unauthorized' });
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
};
