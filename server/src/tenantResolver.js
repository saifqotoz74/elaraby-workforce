// Multi-Tenant Institutional Resolver Middleware
// Resolves tenant context from request headers, subdomains, or authentication tokens.
// Enforces ambient AsyncLocalStorage context and super-admin masquerading.

const { data: db } = require('./db');
const { runWithTenantContext, DEFAULT_TENANT_ID } = require('./tenantContext');
const { verifyToken } = require('./auth');

/**
 * Normalizes and extracts tenant ID from the incoming HTTP request.
 * Precedence:
 * 1. Explicit Header: `X-Tenant-ID`
 * 2. Auth payload: `req.admin.tenantId` or `req.user.tenantId`
 * 3. Subdomain: e.g. `elsewedy.workforce.app`
 * 4. Query param: `?tenant=...` (testing / dev)
 * 5. Default Fallback: `elaraby`
 */
function resolveTenantId(req) {
  // 1. Explicit Header
  const header = req.headers?.['x-tenant-id'];
  if (header && typeof header === 'string' && header.trim()) {
    return header.trim().toLowerCase();
  }

  // 2. Auth Token Scope (if already attached to req)
  if (req.admin && req.admin.tenantId) {
    return String(req.admin.tenantId).trim().toLowerCase();
  }
  if (req.user && req.user.tenantId) {
    return String(req.user.tenantId).trim().toLowerCase();
  }

  // 3. Subdomain extraction (e.g., elsewedy.workforce.app -> elsewedy)
  const host = req.headers?.host || '';
  const domain = host.split(':')[0].toLowerCase();
  const isIpOrLocal = /^(\d{1,3}\.){3}\d{1,3}$/.test(domain) || domain === 'localhost' || domain === '::1';
  const cloudSuffixes = ['.vercel.app', '.onrender.com', '.koyeb.app', '.railway.app', '.herokuapp.com', '.github.io'];
  const isCloudProviderDomain = cloudSuffixes.some((s) => domain.endsWith(s));

  if (!isIpOrLocal && !isCloudProviderDomain) {
    const parts = domain.split('.');
    if (parts.length >= 3) {
      const candidate = parts[0];
      if (candidate !== 'www' && candidate !== 'api' && candidate !== 'admin') {
        return candidate;
      }
    }
  }

  // 4. Query param fallback
  if (req.query && req.query.tenant && typeof req.query.tenant === 'string') {
    return req.query.tenant.trim().toLowerCase();
  }

  return DEFAULT_TENANT_ID;
}

/**
 * Express middleware to bind tenant context to req.tenantId and ambient AsyncLocalStorage
 */
function tenantResolver(req, res, next) {
  let isSuperAdmin = false;
  let masqueraded = false;
  let tenantId = resolveTenantId(req);

  // Inspect auth token if present to establish authoritative security claims
  try {
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let payload = null;
    if (token) {
      payload = verifyToken(token);
    } else if (req.headers?.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)admin_session=([^;]*)/);
      if (match) {
        payload = verifyToken(decodeURIComponent(match[1]));
      }
    }

    if (payload) {
      if (payload.scope === 'admin') {
        const isSuper = !payload.tenantId || payload.tenantId === 'all' || payload.role === 'superadmin';
        if (isSuper) {
          isSuperAdmin = true;
          const explicitHeader = req.headers?.['x-tenant-id'];
          if (explicitHeader && typeof explicitHeader === 'string' && explicitHeader.trim()) {
            tenantId = explicitHeader.trim().toLowerCase();
            masqueraded = true;
          }
        } else if (payload.tenantId) {
          // Tenant-locked admin: cannot escape their tenant via X-Tenant-ID header
          tenantId = String(payload.tenantId).trim().toLowerCase();
        }
      } else if (payload.scope === 'employee') {
        if (payload.tenantId) {
          // Employee: authoritative tenant from token overrides forged header
          tenantId = String(payload.tenantId).trim().toLowerCase();
        }
      }
    }
  } catch (_) {}

  req.tenantId = tenantId;
  req.isSuperAdmin = isSuperAdmin;
  req.isMasquerading = masqueraded;

  // Look up tenant profile in DB if available
  try {
    const d = db();
    const tenants = d.tenants || [];
    const found = tenants.find((t) => t.id === tenantId || t.slug === tenantId);
    if (found) {
      req.tenant = found;
    }
  } catch (_) {}

  // Echo tenant ID in response headers for traceability
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('X-Tenant-ID', tenantId);
  }

  runWithTenantContext(
    {
      tenantId,
      isSuperAdmin,
      masqueraded,
      actor: req.employeeId || req.admin?.sub,
    },
    () => {
      next();
    }
  );
}

module.exports = {
  DEFAULT_TENANT_ID,
  resolveTenantId,
  tenantResolver,
};
