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
  const store = {
    tenantId: (context.tenantId || DEFAULT_TENANT_ID).toString().trim().toLowerCase(),
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
 * Returns current tenant ID, falling back to default.
 * @returns {string}
 */
function getCurrentTenantId() {
  const store = tenantStorage.getStore();
  return store?.tenantId || DEFAULT_TENANT_ID;
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
  isSuperAdmin,
  hasSuperAdminPrivilege,
};
