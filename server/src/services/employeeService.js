// Employee Domain Service
// Handles employee CRUD, transactional updates, vacation balance validation, and audit tracking.

const { data: db, save, transaction } = require('../db');
const { checkScope } = require('../rbac');
const { recordAuditLog } = require('./auditService');
const { broadcast } = require('./realtimeService');
const { validateEmployeeCreate, validateEmployeeUpdate } = require('../validators/adminValidators');

function employeeOut(e) {
  return { ...e, pinHash: undefined };
}

function listEmployees(admin, { page, limit, q, factory, department } = {}) {
  let all = db().employees.filter((e) => checkScope(admin, e));

  if (factory) {
    all = all.filter((e) => e.factory === factory);
  }
  if (department) {
    all = all.filter((e) => e.department === department);
  }
  if (q) {
    const search = q.toLowerCase().trim();
    all = all.filter(
      (e) =>
        (e.name && e.name.toLowerCase().includes(search)) ||
        (e.nationalId && e.nationalId.includes(search)) ||
        (e.employeeCode && e.employeeCode.toLowerCase().includes(search)) ||
        (e.position && e.position.toLowerCase().includes(search))
    );
  }

  const out = all.map(employeeOut);

  if (page || limit) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const start = (pageNum - 1) * limitNum;
    const items = out.slice(start, start + limitNum);
    return {
      employees: items,
      total: out.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(out.length / limitNum),
    };
  }

  return { employees: out, total: out.length };
}

function getEmployee(admin, id) {
  const employee = db().employees.find((e) => e.id === id);
  if (!employee) return null;
  if (!checkScope(admin, employee)) {
    const err = new Error('forbidden_outside_factory_scope');
    err.statusCode = 403;
    throw err;
  }
  return employeeOut(employee);
}

function createEmployee(admin, rawBody, { ip, userAgent } = {}) {
  const validation = validateEmployeeCreate(rawBody);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const data = validation.data;
  if (!checkScope(admin, { factory: data.factory, department: data.department })) {
    const err = new Error('forbidden_outside_factory_scope');
    err.statusCode = 403;
    throw err;
  }

  const created = transaction((state) => {
    if (state.employees.some((e) => e.nationalId === data.nationalId)) {
      const err = new Error('national_id_already_exists');
      err.statusCode = 422;
      throw err;
    }

    const newEmp = {
      id: `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: data.name,
      nationalId: data.nationalId,
      employeeCode: data.employeeCode || `EG-${Math.floor(10000 + Math.random() * 90000)}`,
      factory: data.factory,
      department: data.department,
      position: data.position,
      supervisor: data.supervisor,
      phone: data.phone,
      vacationBalance: data.vacationBalance,
      pinHash: null,
      active: true,
      createdAt: Date.now(),
    };

    state.employees.push(newEmp);

    recordAuditLog(state, {
      actor: admin?.sub || 'admin',
      role: admin?.role || 'superadmin',
      action: 'create_employee',
      entity: 'employee',
      entityId: newEmp.id,
      after: employeeOut(newEmp),
      details: `Created employee ${newEmp.name} (${newEmp.employeeCode})`,
      ip,
      userAgent,
    });

    return newEmp;
  });

  broadcast('employee.created', { employee: employeeOut(created) }, { factory: created.factory });
  return employeeOut(created);
}

function updateEmployee(admin, id, rawBody, { ip, userAgent } = {}) {
  const validation = validateEmployeeUpdate(rawBody);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const updates = validation.data;

  const updated = transaction((state) => {
    const employee = state.employees.find((e) => e.id === id);
    if (!employee) {
      const err = new Error('not_found');
      err.statusCode = 404;
      throw err;
    }

    if (!checkScope(admin, employee)) {
      const err = new Error('forbidden_outside_factory_scope');
      err.statusCode = 403;
      throw err;
    }

    const beforeState = employeeOut(employee);

    for (const [key, val] of Object.entries(updates)) {
      if (key === 'resetPin') {
        employee.pinHash = null;
        employee.tokenVersion = (employee.tokenVersion || 0) + 1;
      } else {
        employee[key] = val;
      }
    }

    recordAuditLog(state, {
      actor: admin?.sub || 'admin',
      role: admin?.role || 'superadmin',
      action: 'update_employee',
      entity: 'employee',
      entityId: employee.id,
      before: beforeState,
      after: employeeOut(employee),
      details: `Updated employee ${employee.name} (${employee.employeeCode})`,
      ip,
      userAgent,
    });

    return employee;
  });

  broadcast('employee.updated', { employee: employeeOut(updated) }, { factory: updated.factory });
  return employeeOut(updated);
}

function toggleEmployee(admin, id, { ip, userAgent } = {}) {
  const updated = transaction((state) => {
    const employee = state.employees.find((e) => e.id === id);
    if (!employee) {
      const err = new Error('not_found');
      err.statusCode = 404;
      throw err;
    }

    if (!checkScope(admin, employee)) {
      const err = new Error('forbidden_outside_factory_scope');
      err.statusCode = 403;
      throw err;
    }

    const beforeState = employeeOut(employee);
    employee.active = !employee.active;
    employee.tokenVersion = (employee.tokenVersion || 0) + 1;

    recordAuditLog(state, {
      actor: admin?.sub || 'admin',
      role: admin?.role || 'superadmin',
      action: employee.active ? 'activate_employee' : 'deactivate_employee',
      entity: 'employee',
      entityId: employee.id,
      before: beforeState,
      after: employeeOut(employee),
      details: `${employee.active ? 'Activated' : 'Deactivated'} employee ${employee.name}`,
      ip,
      userAgent,
    });

    return employee;
  });

  broadcast('employee.updated', { employee: employeeOut(updated) }, { factory: updated.factory });
  return employeeOut(updated);
}

module.exports = {
  employeeOut,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  toggleEmployee,
};
