'use strict';

// Mock machine data per tenant (hardcoded for now)
const MOCK_MACHINES = {
  'elaraby': [
    { id: 'M001', name: 'خط التجميع A', line: 'assembly-a', status: 'running', lastUpdated: new Date().toISOString() },
    { id: 'M002', name: 'خط اللحام B', line: 'welding-b', status: 'running', lastUpdated: new Date().toISOString() },
    { id: 'M003', name: 'ضاغط الهواء C', line: 'compressor-c', status: 'stopped', stopReason: 'صيانة دورية', lastUpdated: new Date().toISOString() },
    { id: 'M004', name: 'خط الطلاء D', line: 'paint-d', status: 'maintenance', lastUpdated: new Date().toISOString() },
  ]
};

// Mock work orders per tenant
const MOCK_WORK_ORDERS = {
  'elaraby': [
    { id: 'WO-2026-001', title: 'تجميع ثلاجات 12 قدم', targetQty: 200, completedQty: 145, line: 'assembly-a', dueDate: '2026-09-25', priority: 'high' },
    { id: 'WO-2026-002', title: 'لحام هياكل غسالات', targetQty: 150, completedQty: 150, line: 'welding-b', dueDate: '2026-09-22', priority: 'normal' },
    { id: 'WO-2026-003', title: 'طلاء بودرة باب الثلاجة', targetQty: 300, completedQty: 80, line: 'paint-d', dueDate: '2026-09-28', priority: 'normal' },
  ]
};

function getMachineStatuses(tenantId) {
  const tenant = tenantId || 'elaraby';
  return MOCK_MACHINES[tenant] || MOCK_MACHINES['elaraby'];
}

function getWorkOrders(tenantId) {
  const tenant = tenantId || 'elaraby';
  return MOCK_WORK_ORDERS[tenant] || MOCK_WORK_ORDERS['elaraby'];
}

function getKioskOverview(tenantId, employeeCode) {
  const machines = getMachineStatuses(tenantId);
  const workOrders = getWorkOrders(tenantId);
  const stoppedCount = machines.filter(m => m.status === 'stopped').length;
  const hasStoppage = stoppedCount > 0;
  
  return {
    machines,
    workOrders,
    hasStoppage,
    stoppedCount
  };
}

function reportStoppage(tenantId, machineId, reason, employeeCode) {
  const machines = getMachineStatuses(tenantId);
  const machine = machines.find(m => m.id === machineId);
  if (machine) {
    machine.status = 'stopped';
    machine.stopReason = reason;
    machine.lastUpdated = new Date().toISOString();
    return { success: true, machine };
  }
  return { success: false, message: 'Machine not found' };
}

function resolveStoppage(tenantId, machineId) {
  const machines = getMachineStatuses(tenantId);
  const machine = machines.find(m => m.id === machineId);
  if (machine) {
    machine.status = 'running';
    machine.stopReason = null;
    machine.lastUpdated = new Date().toISOString();
    return { success: true, machine };
  }
  return { success: false, message: 'Machine not found' };
}

module.exports = {
  getMachineStatuses,
  getWorkOrders,
  getKioskOverview,
  reportStoppage,
  resolveStoppage
};
