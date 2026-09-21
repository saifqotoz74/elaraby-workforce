'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const kioskService = require('../src/services/kioskService');

test('=== KIOSK SERVICE SUITE ===', async (t) => {
  await t.test('1. getMachineStatuses returns array for elaraby tenant', () => {
    const machines = kioskService.getMachineStatuses('elaraby');
    assert.ok(Array.isArray(machines));
    assert.ok(machines.length > 0);
    assert.equal(machines[0].id, 'M001');
  });

  await t.test('2. getWorkOrders returns array with required fields', () => {
    const orders = kioskService.getWorkOrders('elaraby');
    assert.ok(Array.isArray(orders));
    assert.ok(orders.length > 0);
    assert.ok(orders[0].id);
    assert.ok(orders[0].title);
    assert.ok(orders[0].targetQty);
  });

  await t.test('3. getKioskOverview returns machines + workOrders + hasStoppage', () => {
    const overview = kioskService.getKioskOverview('elaraby', 'EMP123');
    assert.ok(Array.isArray(overview.machines));
    assert.ok(Array.isArray(overview.workOrders));
    assert.ok(typeof overview.hasStoppage === 'boolean');
    assert.ok(typeof overview.stoppedCount === 'number');
  });

  await t.test('4. reportStoppage changes machine status to stopped', () => {
    const res = kioskService.reportStoppage('elaraby', 'M001', 'Test Reason', 'EMP123');
    assert.equal(res.success, true);
    assert.equal(res.machine.status, 'stopped');
    assert.equal(res.machine.stopReason, 'Test Reason');
    
    // Check if it's updated in overview
    const overview = kioskService.getKioskOverview('elaraby', 'EMP123');
    const machine = overview.machines.find(m => m.id === 'M001');
    assert.equal(machine.status, 'stopped');
  });

  await t.test('5. resolveStoppage changes machine status back to running', () => {
    const res = kioskService.resolveStoppage('elaraby', 'M001');
    assert.equal(res.success, true);
    assert.equal(res.machine.status, 'running');
    assert.equal(res.machine.stopReason, null);
    
    const overview = kioskService.getKioskOverview('elaraby', 'EMP123');
    const machine = overview.machines.find(m => m.id === 'M001');
    assert.equal(machine.status, 'running');
  });

  await t.test('6. Unknown tenant falls back to elaraby mock data', () => {
    const machines = kioskService.getMachineStatuses('unknown_tenant');
    assert.ok(Array.isArray(machines));
    assert.equal(machines[0].id, 'M001'); // fallback
  });
});
