// server/src/services/alertService.js
// Enterprise Manager Alert & Notification Engine
// Handles persistent manager alerts, multi-tenant querying, read state mutations,
// and real-time SSE streaming.

const { data: db, save } = require('../db');
const { getCurrentTenantId } = require('../tenantContext');
const { ROLES } = require('../rbac');
const realtimeService = require('./realtimeService');

const MAX_ALERTS = 2000;

const ALERT_TYPES = Object.freeze({
  EMERGENCY_LOAN: 'EMERGENCY_LOAN',
  GEOFENCE_BREACH: 'GEOFENCE_BREACH',
  AUDIT_EVENT: 'AUDIT_EVENT',
  SYSTEM: 'SYSTEM',
});

const ALERT_SEVERITIES = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
});

/**
 * Creates and persists a new manager alert, then broadcasts it over SSE.
 * 
 * @param {Object} params
 * @param {string} [params.tenantId] - Target tenant ID (falls back to ambient tenant context)
 * @param {string} params.type - Enum: EMERGENCY_LOAN | GEOFENCE_BREACH | AUDIT_EVENT | SYSTEM
 * @param {string} params.title - Alert title/headline
 * @param {string} params.message - Full alert narrative
 * @param {string} [params.severity='info'] - Enum: info | warning | critical
 * @param {string} [params.entityType] - Entity category (loan, attendance, audit, etc.)
 * @param {string} [params.entityId] - Target entity identifier
 * @param {Object} [params.metadata={}] - Contextual payload
 * @returns {Object} The created alert record
 */
function createAlert({
  tenantId,
  type,
  title,
  message,
  severity = ALERT_SEVERITIES.INFO,
  entityType = null,
  entityId = null,
  metadata = {},
}) {
  if (!type || !Object.values(ALERT_TYPES).includes(type)) {
    throw new Error(`Invalid alert type: ${type}. Allowed: ${Object.values(ALERT_TYPES).join(', ')}`);
  }
  if (!title || typeof title !== 'string') {
    throw new Error('Alert title is mandatory and must be a string.');
  }
  if (!message || typeof message !== 'string') {
    throw new Error('Alert message is mandatory and must be a string.');
  }

  const normalizedSeverity = Object.values(ALERT_SEVERITIES).includes(severity)
    ? severity
    : ALERT_SEVERITIES.INFO;

  const resolvedTenantId = (tenantId || getCurrentTenantId() || 'elaraby').toLowerCase().trim();
  const now = Date.now();
  const alertId = `alt_${now}_${Math.random().toString(36).slice(2, 8)}`;

  const alert = {
    id: alertId,
    tenantId: resolvedTenantId,
    type,
    title: title.trim(),
    message: message.trim(),
    severity: normalizedSeverity,
    entityType: entityType ? String(entityType) : null,
    entityId: entityId ? String(entityId) : null,
    metadata: metadata && typeof metadata === 'object' ? { ...metadata } : {},
    createdAt: now,
    readBy: [],
    isRead: false,
    read: false,
  };

  const state = db();
  if (!Array.isArray(state.alerts)) {
    state.alerts = [];
  }

  // Prepend to maintain reverse chronological order (newest first)
  state.alerts.unshift(alert);

  // Enforce rotation bound
  if (state.alerts.length > MAX_ALERTS) {
    state.alerts.length = MAX_ALERTS;
  }

  save();

  // Broadcast over SSE with tenant targeting
  try {
    realtimeService.broadcast(
      'manager.alert',
      {
        alert,
        tenantId: resolvedTenantId,
      },
      { tenantId: resolvedTenantId }
    );
  } catch (sseErr) {
    console.warn('[alertService:broadcast_error]', sseErr.message);
  }

  return alert;
}

/**
 * Retrieves paginated, filtered manager alerts with strict tenant isolation.
 * 
 * @param {Object} query - Query parameters (unread, severity, type, tenantId, page, limit, from, to)
 * @param {Object} adminActor - Authenticated admin session payload
 * @returns {Object} { ok: true, alerts, unreadCount, total, page, limit, totalPages }
 */
function getAlerts(query = {}, adminActor = {}) {
  const state = db();
  const allAlerts = Array.isArray(state.alerts) ? state.alerts : [];

  const isSuper = (adminActor.role === ROLES.SUPER_ADMIN || adminActor.isSuperAdmin) && !adminActor.tenantId;
  const actorTenant = (adminActor.tenantId || getCurrentTenantId() || 'elaraby').toLowerCase();

  // 1. Tenant Scoping
  let filtered = allAlerts.filter((a) => {
    const alertTenant = (a.tenantId || 'elaraby').toLowerCase();
    if (isSuper) {
      if (query.tenantId) {
        return alertTenant === String(query.tenantId).toLowerCase().trim();
      }
      return true;
    }
    return alertTenant === actorTenant;
  });

  // Calculate unread count for current tenant scope before applying other filters
  const unreadCount = filtered.filter((a) => !a.isRead).length;

  // 2. Unread Filter (?unread=true / ?unread=false)
  if (query.unread !== undefined && query.unread !== '') {
    const isUnreadQuery = query.unread === 'true' || query.unread === true || query.unread === '1';
    filtered = filtered.filter((a) => (isUnreadQuery ? !a.isRead : a.isRead));
  }

  // 3. Severity Filter (?severity=critical|warning|info)
  if (query.severity) {
    const targetSeverity = String(query.severity).toLowerCase().trim();
    filtered = filtered.filter((a) => (a.severity || 'info').toLowerCase() === targetSeverity);
  }

  // 4. Type Filter (?type=EMERGENCY_LOAN|GEOFENCE_BREACH|AUDIT_EVENT|SYSTEM)
  if (query.type) {
    const targetType = String(query.type).toUpperCase().trim();
    filtered = filtered.filter((a) => a.type === targetType);
  }

  // 5. Date Range Filtering (?from=timestamp&to=timestamp)
  if (query.from) {
    const fromTs = Number(query.from);
    if (!isNaN(fromTs)) filtered = filtered.filter((a) => a.createdAt >= fromTs);
  }
  if (query.to) {
    const toTs = Number(query.to);
    if (!isNaN(toTs)) filtered = filtered.filter((a) => a.createdAt <= toTs);
  }

  // 6. Pagination
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(200, parseInt(query.limit, 10) || 50));
  const startIndex = (page - 1) * limit;
  const paginatedItems = filtered.slice(startIndex, startIndex + limit);

  // Normalize alert objects for frontend (ensuring both isRead and read exist)
  const normalizedAlerts = paginatedItems.map((a) => ({
    ...a,
    read: a.isRead,
  }));

  return {
    ok: true,
    alerts: normalizedAlerts,
    unreadCount,
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit) || 1,
  };
}

/**
 * Marks a single alert as read by ID with tenant security checks.
 * 
 * @param {string} alertId
 * @param {Object} adminActor
 * @returns {Object} Updated alert record
 */
function markAlertAsRead(alertId, adminActor = {}) {
  const state = db();
  const alerts = Array.isArray(state.alerts) ? state.alerts : [];
  const alert = alerts.find((a) => a.id === alertId);

  if (!alert) {
    const err = new Error('Alert not found');
    err.statusCode = 404;
    throw err;
  }

  const isSuper = (adminActor.role === ROLES.SUPER_ADMIN || adminActor.isSuperAdmin) && !adminActor.tenantId;
  const actorTenant = (adminActor.tenantId || getCurrentTenantId() || 'elaraby').toLowerCase();
  const alertTenant = (alert.tenantId || 'elaraby').toLowerCase();

  if (!isSuper && alertTenant !== actorTenant) {
    const err = new Error('Access denied: alert belongs to a different tenant.');
    err.statusCode = 403;
    throw err;
  }

  alert.isRead = true;
  alert.read = true;

  if (!Array.isArray(alert.readBy)) {
    alert.readBy = [];
  }

  const adminSub = adminActor.sub || adminActor.username || 'admin';
  if (!alert.readBy.some((r) => r.adminSub === adminSub)) {
    alert.readBy.push({
      adminSub,
      readAt: Date.now(),
    });
  }

  save();
  return { ok: true, success: true, alert };
}

/**
 * Marks all alerts matching tenant scope as read.
 * 
 * @param {Object} adminActor
 * @param {Object} [filter={}] - Optional additional filters (type, severity)
 * @returns {Object} { ok: true, success: true, markedCount }
 */
function markAllAlertsAsRead(adminActor = {}, filter = {}) {
  const state = db();
  const alerts = Array.isArray(state.alerts) ? state.alerts : [];

  const isSuper = (adminActor.role === ROLES.SUPER_ADMIN || adminActor.isSuperAdmin) && !adminActor.tenantId;
  const actorTenant = (adminActor.tenantId || getCurrentTenantId() || 'elaraby').toLowerCase();
  const targetTenant = (isSuper && filter.tenantId ? filter.tenantId : actorTenant).toLowerCase();

  let markedCount = 0;
  const adminSub = adminActor.sub || adminActor.username || 'admin';
  const now = Date.now();

  for (const alert of alerts) {
    const alertTenant = (alert.tenantId || 'elaraby').toLowerCase();
    if (!isSuper && alertTenant !== targetTenant) continue;
    if (isSuper && filter.tenantId && alertTenant !== targetTenant) continue;

    if (filter.type && alert.type !== filter.type) continue;
    if (filter.severity && alert.severity !== filter.severity) continue;

    if (!alert.isRead) {
      alert.isRead = true;
      alert.read = true;
      if (!Array.isArray(alert.readBy)) alert.readBy = [];
      alert.readBy.push({ adminSub, readAt: now });
      markedCount++;
    }
  }

  if (markedCount > 0) {
    save();
  }

  return { ok: true, success: true, markedCount };
}

module.exports = {
  ALERT_TYPES,
  ALERT_SEVERITIES,
  createAlert,
  getAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
};
