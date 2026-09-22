// Subscription Guard Middleware
// Enforces subscription status on all tenant-scoped write operations.
//
// Behavior by status:
//   active   → allow all operations
//   warning  → allow all operations (expiry within 7 days, banner shown in UI)
//   frozen   → allow GET/HEAD (read-only), block POST/PUT/PATCH/DELETE with 423
//   cancelled→ block all operations with 403
//   none     → allow all (tenant has no subscription record — open/free tier)
//
// Bypasses:
//   - Super-admin requests (req.admin.role === 'superadmin' && !req.admin.tenantId)
//   - Subscription management endpoints themselves (/super-admin/subscriptions)

'use strict';

const subscriptionService = require('../services/subscriptionService');
const { ROLES } = require('../rbac');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Express middleware that enforces subscription status.
 * Must be applied AFTER requireAdmin so req.admin is populated.
 */
function subscriptionGuard(req, res, next) {
  // 1. Super-admin without tenant binding bypasses all checks
  const admin = req.admin;
  if (admin && (admin.role === ROLES.SUPER_ADMIN || admin.role === 'admin') && !admin.tenantId) {
    return next();
  }

  // 2. Subscription management endpoints are exempt
  if (req.path && (req.path.includes('/super-admin/') || req.path.includes('/subscription'))) {
    return next();
  }

  // 3. Resolve current tenant
  const tenantId = admin?.tenantId || null;
  if (!tenantId) {
    // No tenant binding — treat as open tier, allow through
    return next();
  }

  // 4. Get subscription status
  const status = subscriptionService.getSubscriptionStatus(tenantId);

  // 5. Attach subscription info to request for downstream use (banner API)
  req.subscriptionStatus = status;

  if (status.status === 'cancelled') {
    return res.status(403).json({
      error: 'subscription_cancelled',
      message: 'Your organization\'s subscription has been cancelled. Please contact your platform administrator.',
      expiresAt: status.expiresAt,
    });
  }

  if (status.status === 'frozen') {
    // Frozen: read operations allowed, write operations blocked
    if (WRITE_METHODS.has(req.method)) {
      return res.status(423).json({
        error: 'subscription_frozen',
        message: 'Your organization\'s subscription has expired. Data is read-only. Please contact your platform administrator to renew.',
        expiresAt: status.expiresAt,
        gracePeriodEndsAt: status.gracePeriodEndsAt,
      });
    }
  }

  // active / warning / none — allow through
  next();
}

module.exports = { subscriptionGuard };
