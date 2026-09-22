// Enterprise Multi-Tenant Ambient Context Management
// Uses Node.js AsyncLocalStorage to propagate tenant identification and security claims
// across asynchronous execution boundaries without polluting function signatures.

const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'elaraby';

/**
 * Runs a function within an ambient tenant context.
 * @param {object} context - { tenantId, isSuperAdmin, actor, role }
 * @param {Function} callback - Function or Promise to execute
 */
function runWithTenantContext(context, callback) {
  const rawTenantId = context.tenantId ? context.tenantId.toString().trim().toLowerCase() : null;
  const store = {
    tenantId: rawTenantId || (context.isSuperAdmin ? null : DEFAULT_TENANT_ID),
    isSuperAdmin: !!context.isSuperAdmin,
    actor: context.actor || null,
    role: context.role || null,
    masqueraded: !!context.masqueraded,
    startedAt: Date.now(),
  };
  return tenantStorage.run(store, callback);
}

/**
 * Retrieves the current ambient tenant context from storage.
 * @returns {object|null}
 */
function getTenantContext() {
  return tenantStorage.getStore() || null;
}

/**
 * Returns current tenant ID.
 * @param {object} [opts] - { required?: boolean, strict?: boolean }
 * @returns {string|null}
 */
function getCurrentTenantId(opts = {}) {
  const store = tenantStorage.getStore();
  const tenantId = store?.tenantId || null;
  if (opts.required && !tenantId) {
    const err = new Error('tenant_context_required');
    err.statusCode = 400;
    throw err;
  }
  if (tenantId) return tenantId;
  return opts.strict ? null : DEFAULT_TENANT_ID;
}

/**
 * Strictly requires active tenant context; throws explicit error if missing.
 * Prevents dangerous cross-tenant fallback.
 * @returns {string}
 */
function getRequiredTenantId() {
  const store = tenantStorage.getStore();
  const tenantId = store?.tenantId;
  if (!tenantId) {
    const err = new Error('tenant_context_required');
    err.statusCode = 400;
    throw err;
  }
  return tenantId;
}

function requireTenantId() {
  return getRequiredTenantId();
}

/**
 * Checks if the current context possesses active Super Admin query bypass privileges.
 * When masquerading as a specific tenant, bypass is dropped to enforce tenant-scoped isolation.
 * @returns {boolean}
 */
function isSuperAdmin() {
  const store = tenantStorage.getStore();
  if (store?.masqueraded) return false;
  return !!store?.isSuperAdmin;
}

function hasSuperAdminPrivilege() {
  const store = tenantStorage.getStore();
  return !!store?.isSuperAdmin;
}

module.exports = {
  DEFAULT_TENANT_ID,
  tenantStorage,
  runWithTenantContext,
  getTenantContext,
  getCurrentTenantId,
  getRequiredTenantId,
  requireTenantId,
  isSuperAdmin,
  hasSuperAdminPrivilege,
};
