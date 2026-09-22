'use strict';

/**
 * Enterprise Kiosk / Shop Floor Domain Service
 * Enforces unified persistence, strict multi-tenant isolation, and ambient context resolution.
 * Zero module-level mutable state (DATA-002, TENANT-001).
 */

const db = require('../db');
const repository = require('../db/repository');
const { getCurrentTenantId } = require('../tenantContext');

const DEFAULT_INITIAL_MACHINES = [
  { id: 'M001', name: 'خط التجميع A', line: 'assembly-a', status: 'running' },
  { id: 'M002', name: 'خط اللحام B', line: 'welding-b', status: 'running' },
  { id: 'M003', name: 'ضاغط الهواء C', line: 'compressor-c', status: 'stopped', stopReason: 'صيانة دورية' },
  { id: 'M004', name: 'خط الطلاء D', line: 'paint-d', status: 'maintenance' },
];

const DEFAULT_INITIAL_WORK_ORDERS = [
  { id: 'WO-2026-001', title: 'تجميع ثلاجات 12 قدم', targetQty: 200, completedQty: 145, line: 'assembly-a', dueDate: '2026-09-25', priority: 'high' },
  { id: 'WO-2026-002', title: 'لحام هياكل غسالات', targetQty: 150, completedQty: 150, line: 'welding-b', dueDate: '2026-09-22', priority: 'normal' },
  { id: 'WO-2026-003', title: 'طلاء بودرة باب الثلاجة', targetQty: 300, completedQty: 80, line: 'paint-d', dueDate: '2026-09-28', priority: 'normal' },
];

function resolveTenant(explicitTenantId) {
  if (explicitTenantId && typeof explicitTenantId === 'string' && explicitTenantId.trim()) {
    return explicitTenantId.trim().toLowerCase();
  }
  const ambient = getCurrentTenantId({ strict: true });
  if (!ambient) {
    const err = new Error('tenant_context_required');
    err.statusCode = 400;
    throw err;
  }
  return ambient;
}

function ensureDefaultSeedInJson(data, tenantId) {
  if (tenantId !== 'elaraby') return;
  data.machines = data.machines || [];
  data.workOrders = data.workOrders || [];
  data.machineStoppages = data.machineStoppages || [];

  const elarabyMachines = data.machines.filter((m) => m.tenantId === 'elaraby');
  if (elarabyMachines.length === 0) {
    for (const m of DEFAULT_INITIAL_MACHINES) {
      data.machines.push({
        ...m,
        tenantId: 'elaraby',
        stopReason: m.stopReason || null,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
  }

  const elarabyOrders = data.workOrders.filter((w) => w.tenantId === 'elaraby');
  if (elarabyOrders.length === 0) {
    for (const w of DEFAULT_INITIAL_WORK_ORDERS) {
      data.workOrders.push({
        ...w,
        tenantId: 'elaraby',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
      });
    }
  }
}

function getMachineStatuses(explicitTenantId) {
  const tenant = resolveTenant(explicitTenantId);

  if (repository.getBackend() === 'postgres') {
    return repository.listMachines(tenant);
  }

  const d = db.data();
  ensureDefaultSeedInJson(d, tenant);
  const machines = (d.machines || []).filter((m) => m.tenantId === tenant);
  return machines.map((m) => ({ ...m }));
}

function getWorkOrders(explicitTenantId) {
  const tenant = resolveTenant(explicitTenantId);

  if (repository.getBackend() === 'postgres') {
    return repository.listWorkOrders(tenant);
  }

  const d = db.data();
  ensureDefaultSeedInJson(d, tenant);
  const orders = (d.workOrders || []).filter((w) => w.tenantId === tenant);
  return orders.map((w) => ({ ...w }));
}

function getKioskOverview(arg1, arg2) {
  let tenant;
  let employeeCode;

  if (arg2 !== undefined) {
    tenant = resolveTenant(arg1);
    employeeCode = arg2;
  } else {
    tenant = resolveTenant();
    employeeCode = arg1 || '';
  }

  if (repository.getBackend() === 'postgres') {
    return Promise.all([
      repository.listMachines(tenant),
      repository.listWorkOrders(tenant),
    ]).then(([machines, workOrders]) => {
      const stoppedCount = machines.filter((m) => m.status === 'stopped').length;
      return {
        machines,
        workOrders,
        hasStoppage: stoppedCount > 0,
        stoppedCount,
      };
    });
  }

  const machines = getMachineStatuses(tenant);
  const workOrders = getWorkOrders(tenant);
  const stoppedCount = machines.filter((m) => m.status === 'stopped').length;
  const hasStoppage = stoppedCount > 0;

  return {
    machines,
    workOrders,
    hasStoppage,
    stoppedCount,
  };
}

function reportStoppage(arg1, arg2, arg3, arg4) {
  let tenant;
  let machineId;
  let reason;
  let employeeCode;

  if (arg4 !== undefined) {
    tenant = resolveTenant(arg1);
    machineId = arg2;
    reason = arg3;
    employeeCode = arg4;
  } else {
    tenant = resolveTenant();
    machineId = arg1;
    reason = arg2;
    employeeCode = arg3;
  }

  if (repository.getBackend() === 'postgres') {
    return (async () => {
      const machine = await repository.findMachineById(machineId, tenant);
      if (!machine) return { success: false, message: 'Machine not found' };

      const updated = await repository.updateMachine(machineId, {
        status: 'stopped',
        stopReason: reason,
      }, tenant);

      await repository.createMachineStoppage({
        tenantId: tenant,
        machineId,
        reason,
        employeeCode,
        status: 'active',
      });

      return { success: true, machine: updated };
    })();
  }

  let result = { success: false, message: 'Machine not found' };
  db.transaction((data) => {
    ensureDefaultSeedInJson(data, tenant);
    data.machines = data.machines || [];
    data.machineStoppages = data.machineStoppages || [];

    const machine = data.machines.find(
      (m) => m.tenantId === tenant && m.id === machineId
    );
    if (machine) {
      machine.status = 'stopped';
      machine.stopReason = reason;
      machine.lastUpdated = new Date().toISOString();
      machine.updatedAt = new Date().toISOString();

      const stoppageRecord = {
        id: `stp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tenantId: tenant,
        machineId,
        reason,
        employeeCode: employeeCode || null,
        status: 'active',
        reportedAt: new Date().toISOString(),
        resolvedAt: null,
      };
      data.machineStoppages.push(stoppageRecord);

      result = { success: true, machine: { ...machine } };
    }
  });

  return result;
}

function resolveStoppage(arg1, arg2) {
  let tenant;
  let machineId;

  if (arg2 !== undefined) {
    tenant = resolveTenant(arg1);
    machineId = arg2;
  } else {
    tenant = resolveTenant();
    machineId = arg1;
  }

  if (repository.getBackend() === 'postgres') {
    return (async () => {
      const machine = await repository.findMachineById(machineId, tenant);
      if (!machine) return { success: false, message: 'Machine not found' };

      const updated = await repository.updateMachine(machineId, {
        status: 'running',
        stopReason: null,
      }, tenant);

      await repository.resolveMachineStoppage(machineId, tenant);

      return { success: true, machine: updated };
    })();
  }

  let result = { success: false, message: 'Machine not found' };
  db.transaction((data) => {
    ensureDefaultSeedInJson(data, tenant);
    data.machines = data.machines || [];
    data.machineStoppages = data.machineStoppages || [];

    const machine = data.machines.find(
      (m) => m.tenantId === tenant && m.id === machineId
    );
    if (machine) {
      machine.status = 'running';
      machine.stopReason = null;
      machine.lastUpdated = new Date().toISOString();
      machine.updatedAt = new Date().toISOString();

      const stoppages = data.machineStoppages.filter(
        (s) => s.tenantId === tenant && s.machineId === machineId && s.status === 'active'
      );
      for (const stp of stoppages) {
        stp.status = 'resolved';
        stp.resolvedAt = new Date().toISOString();
      }

      result = { success: true, machine: { ...machine } };
    }
  });

  return result;
}

function createMachine(arg1, arg2) {
  let tenant;
  let machineData;

  if (arg2 !== undefined) {
    tenant = resolveTenant(arg1);
    machineData = arg2;
  } else {
    tenant = resolveTenant();
    machineData = arg1;
  }

  return repository.createMachine({
    ...machineData,
    tenantId: tenant,
  });
}

function createWorkOrder(arg1, arg2) {
  let tenant;
  let orderData;

  if (arg2 !== undefined) {
    tenant = resolveTenant(arg1);
    orderData = arg2;
  } else {
    tenant = resolveTenant();
    orderData = arg1;
  }

  return repository.createWorkOrder({
    ...orderData,
    tenantId: tenant,
  });
}

module.exports = {
  getMachineStatuses,
  getWorkOrders,
  getKioskOverview,
  reportStoppage,
  resolveStoppage,
  createMachine,
  createWorkOrder,
};
