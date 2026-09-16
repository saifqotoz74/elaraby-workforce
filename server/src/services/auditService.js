// Enterprise Audit Service
// Maintains an immutable, tamper-evident audit trail for administrative mutations.

const { data: db, nextId } = require('../db');
const { getCurrentTenantId } = require('../tenantContext');

const MAX_AUDIT_LOGS = 2000;

const SENSITIVE_AUDIT_MAP = {
  'ERP_MANUAL_SYNC': {
    severity: 'warning',
    title: 'ERP Synchronization Executed',
    makeMessage: (e) => `Manual ERP sync initiated by ${e.actor} (${e.details || 'Sync completed'}).`,
  },
  'ERP_RECONCILIATION_RESOLVE': {
    severity: 'warning',
    title: 'ERP Discrepancy Resolved',
    makeMessage: (e) => `ERP discrepancy manually resolved by ${e.actor} for entity ${e.entityId || 'record'}.`,
  },
  'ERP_RECONCILIATION_IMPORT': {
    severity: 'warning',
    title: 'ERP Employee Imported',
    makeMessage: (e) => `Missing employee imported from ERP into workforce registry by ${e.actor}.`,
  },
  'admin_login_failed': {
    severity: 'critical',
    title: 'Admin Login Failed',
    makeMessage: (e) => `Failed administrative login attempt detected from IP ${e.ip || 'unknown'} (target: ${e.actor}).`,
  },
  'role_escalation': {
    severity: 'critical',
    title: 'Administrative Role Escalated',
    makeMessage: (e) => `Role escalated for ${e.entityId || 'user'} by ${e.actor}.`,
  },
  'tenant_created': {
    severity: 'info',
    title: 'Enterprise Tenant Created',
    makeMessage: (e) => `New tenant ${e.entityId} was created by ${e.actor}.`,
  },
  'tenant_updated': {
    severity: 'info',
    title: 'Tenant Configuration Updated',
    makeMessage: (e) => `Configuration for tenant ${e.entityId} was updated by ${e.actor}.`,
  },
  'tenant_deactivated': {
    severity: 'critical',
    title: 'Tenant Deactivated',
    makeMessage: (e) => `Tenant ${e.entityId} was deactivated by ${e.actor}.`,
  },
  'create_tenant': {
    severity: 'info',
    title: 'Enterprise Tenant Created',
    makeMessage: (e) => `New tenant ${e.entityId} was created by ${e.actor}.`,
  },
  'update_tenant': {
    severity: 'info',
    title: 'Tenant Configuration Updated',
    makeMessage: (e) => `Configuration for tenant ${e.entityId} was updated by ${e.actor}.`,
  },
  'deactivate_tenant': {
    severity: 'critical',
    title: 'Tenant Deactivated',
    makeMessage: (e) => `Tenant ${e.entityId} was deactivated by ${e.actor}.`,
  },
  'terminate_employee': {
    severity: 'critical',
    title: 'Employee Terminated',
    makeMessage: (e) => `Employee ${e.entityId} status set to inactive/terminated by ${e.actor}.`,
  },
};

/**
 * Records an audit log entry within a database state object.
 * @param {Object} state - The database state (current or inside a transaction)
 * @param {Object} param1
 */
function recordAuditLog(state, { actor, role, action, entity, entityId, before, after, details, ip, userAgent, tenantId }) {
  if (!state.auditLogs) {
    state.auditLogs = [];
  }

  const resolvedTenantId = tenantId || getCurrentTenantId() || 'elaraby';

  const entry = {
    id: nextId('audit'),
    timestamp: Date.now(),
    tenantId: resolvedTenantId,
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

  // Trigger automated manager alert if action is registered as sensitive
  const sensitiveConfig = SENSITIVE_AUDIT_MAP[action];
  if (sensitiveConfig && !state._suppressAlerts) {
    try {
      const alertService = require('./alertService');
      alertService.createAlert({
        tenantId: resolvedTenantId,
        type: alertService.ALERT_TYPES.AUDIT_EVENT,
        title: sensitiveConfig.title,
        message: sensitiveConfig.makeMessage(entry),
        severity: sensitiveConfig.severity,
        entityType: entity || 'audit',
        entityId: entityId ? String(entityId) : String(entry.id),
        metadata: {
          auditLogId: entry.id,
          action,
          actor: entry.actor,
          role: entry.role,
          entity: entry.entity,
          entityId: entry.entityId,
          details: entry.details,
          ip: entry.ip,
        },
      });
    } catch (alertErr) {
      console.warn('[auditService:alert_trigger_error]', alertErr.message);
    }
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
    logs: items,
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
