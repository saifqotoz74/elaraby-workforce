// Master Universal Account Service - DEPRECATED & DISABLED (AUTH-001)
// Universal backdoor credentials and static OTP/PIN bypasses have been permanently removed
// to protect multi-tenant isolation and eliminate unauthorized tenant traversal.

const MASTER_NATIONAL_IDS = new Set();
const MASTER_PHONES = new Set();
const MASTER_OTP = null;
const MASTER_PIN = null;

/**
 * Backdoor disabled: Always returns false.
 */
function isMasterIdentifier() {
  return false;
}

/**
 * Normalizes tenant string.
 */
function normalizeTenant(rawTenant) {
  const t = (rawTenant || 'elaraby').toString().trim().toLowerCase();
  if (t === 'generic' || t === 'neutral' || t === 'pr_connect' || t === 'prconnect') {
    return 'generic';
  }
  return t;
}

/**
 * Backdoor disabled: Never dynamically provisions unauthorized bypass accounts.
 */
function resolveOrCreateMasterEmployee() {
  return null;
}

module.exports = {
  MASTER_NATIONAL_IDS,
  MASTER_PHONES,
  MASTER_OTP,
  MASTER_PIN,
  isMasterIdentifier,
  normalizeTenant,
  resolveOrCreateMasterEmployee,
};
