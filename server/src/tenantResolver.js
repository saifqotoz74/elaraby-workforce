// Multi-Tenant Institutional Resolver Middleware
// Resolves tenant context from request headers, subdomains, or authentication tokens.
const { data: db } = require('./db');

const DEFAULT_TENANT_ID = 'elaraby';

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
  const header = req.headers['x-tenant-id'];
  if (header && typeof header === 'string' && header.trim()) {
    return header.trim().toLowerCase();
  }

  // 2. Auth Token Scope (if already authenticated)
  if (req.admin && req.admin.tenantId) {
    return String(req.admin.tenantId).trim().toLowerCase();
  }
  if (req.user && req.user.tenantId) {
    return String(req.user.tenantId).trim().toLowerCase();
  }

  // 3. Subdomain extraction (e.g., elsewedy.domain.com -> elsewedy)
  const host = req.headers.host || '';
  const parts = host.split(':')[0].split('.');
  if (parts.length >= 3) {
    const candidate = parts[0].toLowerCase();
    if (candidate !== 'www' && candidate !== 'api' && candidate !== 'admin') {
      return candidate;
    }
  }

  // 4. Query param fallback
  if (req.query && req.query.tenant && typeof req.query.tenant === 'string') {
    return req.query.tenant.trim().toLowerCase();
  }

  return DEFAULT_TENANT_ID;
}

/**
 * Express middleware to bind tenant context to req.tenantId and req.tenant
 */
function tenantResolver(req, res, next) {
  const tenantId = resolveTenantId(req);
  req.tenantId = tenantId;

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
  res.setHeader('X-Tenant-ID', tenantId);
  next();
}

module.exports = {
  DEFAULT_TENANT_ID,
  resolveTenantId,
  tenantResolver,
};
