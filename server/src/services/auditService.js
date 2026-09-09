// Enterprise Audit Service
// Maintains an immutable, tamper-evident audit trail for administrative mutations.

const { data: db, nextId } = require('../db');

const MAX_AUDIT_LOGS = 2000;

/**
 * Records an audit log entry within a database state object.
 * @param {Object} state - The database state (current or inside a transaction)
 * @param {Object} param1
 */
function recordAuditLog(state, { actor, role, action, entity, entityId, before, after, details, ip, userAgent }) {
  if (!state.auditLogs) {
    state.auditLogs = [];
  }

  const entry = {
    id: nextId('audit'),
    timestamp: Date.now(),
    actor: actor || 'admin',
    role: role || 'superadmin',
    action: String(action),
    entity: entity || null,
    entityId: entityId ? String(entityId) : null,
    before: before !== undefined ? before : null,
    after: after !== undefined ? after : null,
    details: details || null,
    ip: ip || null,
    userAgent: userAgent || null,
  };

  state.auditLogs.unshift(entry);

  if (state.auditLogs.length > MAX_AUDIT_LOGS) {
    state.auditLogs.length = MAX_AUDIT_LOGS;
  }

  return entry;
}

/**
 * Retrieves audit logs with optional pagination and filtering.
 */
function getAuditLogs({ page, limit, action, actor, entity, from, to } = {}) {
  const all = db().auditLogs || [];
  let filtered = all;

  if (action) {
    filtered = filtered.filter((l) => l.action === action);
  }
  if (actor) {
    filtered = filtered.filter((l) => l.actor === actor);
  }
  if (entity) {
    filtered = filtered.filter((l) => l.entity === entity);
  }
  if (from) {
    const fromTs = Number(from);
    if (!isNaN(fromTs)) filtered = filtered.filter((l) => l.timestamp >= fromTs);
  }
  if (to) {
    const toTs = Number(to);
    if (!isNaN(toTs)) filtered = filtered.filter((l) => l.timestamp <= toTs);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const start = (pageNum - 1) * limitNum;
  const items = filtered.slice(start, start + limitNum);

  return {
    auditLogs: items,
    total: filtered.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(filtered.length / limitNum),
  };
}

module.exports = {
  recordAuditLog,
  getAuditLogs,
};
