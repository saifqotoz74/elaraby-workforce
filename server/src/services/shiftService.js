// Shift & Roster Domain Service
// Handles shift assignment, weekly schedules, scope isolation, and audit tracking.

const { data: db, transaction } = require('../db');
const { checkScope } = require('../rbac');
const { recordAuditLog } = require('./auditService');
const { broadcast } = require('./realtimeService');
const { validateRosterUpdate } = require('../validators/adminValidators');

function getWeekStart() {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
}

function getRoster(admin, employeeId) {
  const employee = db().employees.find((e) => e.id === employeeId);
  if (!employee) {
    const err = new Error('employee_not_found');
    err.statusCode = 404;
    throw err;
  }
  if (!checkScope(admin, employee)) {
    const err = new Error('forbidden_outside_factory_scope');
    err.statusCode = 403;
    throw err;
  }

  const weekStart = getWeekStart();
  const record = db().roster.find(
    (r) => r.employeeId === employeeId && r.weekStart === weekStart
  );

  return { weekStart, days: record?.days || null };
}

function updateRoster(admin, employeeId, rawBody, { ip, userAgent } = {}) {
  const employee = db().employees.find((e) => e.id === employeeId);
  if (!employee) {
    const err = new Error('employee_not_found');
    err.statusCode = 404;
    throw err;
  }
  if (!checkScope(admin, employee)) {
    const err = new Error('forbidden_outside_factory_scope');
    err.statusCode = 403;
    throw err;
  }

  const validation = validateRosterUpdate(rawBody);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const weekStart = getWeekStart();
  const updated = transaction((state) => {
    let record = state.roster.find(
      (r) => r.employeeId === employeeId && r.weekStart === weekStart
    );
    const beforeState = record ? { ...record } : null;

    if (!record) {
      record = { employeeId, weekStart };
      state.roster.push(record);
    }

    record.days = validation.data.days;
    record.updatedAt = Date.now();

    recordAuditLog(state, {
      actor: admin?.sub || 'admin',
      role: admin?.role || 'superadmin',
      action: 'update_roster',
      entity: 'roster',
      entityId: employeeId,
      before: beforeState,
      after: { ...record },
      details: `Updated weekly roster for ${employee.name} (Week: ${weekStart})`,
      ip,
      userAgent,
    });

    return record;
  });

  broadcast(
    'shift.updated',
    { roster: updated, employeeId, weekStart },
    { factory: employee.factory, employeeId }
  );

  return updated;
}

module.exports = {
  getWeekStart,
  getRoster,
  updateRoster,
};
