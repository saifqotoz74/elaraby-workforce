// Payroll Domain Service
// Handles salary statement access, updates, scope checks, and audit trails.

const { data: db, transaction } = require('../db');
const { checkScope } = require('../rbac');
const { recordAuditLog } = require('./auditService');
const { broadcast } = require('./realtimeService');
const { validatePayrollUpdate } = require('../validators/adminValidators');

function getPayroll(admin, employeeId, { period } = {}) {
  const employee = db().employees.find((e) => e.id === employeeId);
  if (!employee) {
    const err = new Error('employee_not_found');
    err.statusCode = 404;
    throw err;
  }
  if (admin && !checkScope(admin, employee)) {
    const err = new Error('forbidden_outside_factory_scope');
    err.statusCode = 403;
    throw err;
  }

  const allRecords = (db().payroll || []).filter((p) => p.employeeId === employeeId);
  if (allRecords.length === 0) return null;

  if (period) {
    const matched = allRecords.find((p) => p.period && p.period.toLowerCase() === String(period).toLowerCase().trim());
    return matched || null;
  }

  // Return most recent record by updatedAt or last in array
  return allRecords[allRecords.length - 1];
}

function getPayrollHistory(admin, employeeId) {
  const employee = db().employees.find((e) => e.id === employeeId);
  if (!employee) {
    const err = new Error('employee_not_found');
    err.statusCode = 404;
    throw err;
  }
  if (admin && !checkScope(admin, employee)) {
    const err = new Error('forbidden_outside_factory_scope');
    err.statusCode = 403;
    throw err;
  }

  const allRecords = (db().payroll || []).filter((p) => p.employeeId === employeeId);
  return allRecords.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function updatePayroll(admin, employeeId, rawBody, { ip, userAgent } = {}) {
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

  const validation = validatePayrollUpdate(rawBody);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }
  const data = validation.data;

  const updated = transaction((state) => {
    state.payroll = state.payroll || [];
    let record = state.payroll.find((p) => p.employeeId === employeeId && p.period === data.period);
    if (!record) {
      record = state.payroll.find((p) => p.employeeId === employeeId);
    }
    const beforeState = record ? { ...record } : null;

    if (!record) {
      record = {
        employeeId,
        tenantId: employee.tenantId || admin?.tenantId || 'elaraby',
      };
      state.payroll.push(record);
    } else if (!record.tenantId) {
      record.tenantId = employee.tenantId || admin?.tenantId || 'elaraby';
    }

    Object.assign(record, {
      period: data.period,
      basicSalary: data.basicSalary,
      allowances: data.allowances,
      deductions: data.deductions,
      netSalary: data.basicSalary + data.allowances - data.deductions,
      paidOn: data.paidOn,
      paymentMethod: data.paymentMethod,
      updatedAt: Date.now(),
    });

    recordAuditLog(state, {
      actor: admin?.sub || 'admin',
      role: admin?.role || 'superadmin',
      action: 'update_payroll',
      entity: 'payroll',
      entityId: employeeId,
      before: beforeState,
      after: { ...record },
      details: `Updated payroll for ${employee.name} (${data.period})`,
      ip,
      userAgent,
    });

    return record;
  });

  broadcast(
    'payroll.updated',
    { payroll: updated, employeeId },
    { factory: employee.factory, employeeId }
  );

  return updated;
}

module.exports = {
  getPayroll,
  getPayrollHistory,
  updatePayroll,
};
