'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rosterSolverService = require('../src/services/rosterSolverService');
const { data, save } = require('../src/db');

test('=== WORKFORCE OS AI ROSTER SOLVER ===', async (t) => {
  // Setup DB snapshot to restore afterwards
  const db = data();
  const snapshotEmployees = JSON.parse(JSON.stringify(db.employees || []));
  const snapshotRequests = JSON.parse(JSON.stringify(db.requests || []));

  t.after(() => {
    const curDb = data();
    curDb.employees = snapshotEmployees;
    curDb.requests = snapshotRequests;
    save();
  });

  db.employees = [
    { id: 'e1', tenantId: 't1', employeeCode: 'EMP01', name: 'John Doe', yearsOfService: 1 },
    { id: 'e2', tenantId: 't1', employeeCode: 'EMP02', name: 'Jane Smith', yearsOfService: 5 },
    { id: 'e3', tenantId: 't1', employeeCode: 'EMP03', name: 'Bob', yearsOfService: 2 },
  ];
  db.requests = [
    { 
      id: 'r1', 
      employeeId: 'e3', 
      type: 'leave', 
      status: 'approved', 
      startDate: '2026-09-21T00:00:00Z',
      days: 2
    }
  ];
  save();

  await t.test('1. solveRoster returns roster entries for all employees x 7 days', () => {
    const result = rosterSolverService.solveRoster('t1', '2026-09-20');
    assert.equal(result.roster.length, 3 * 7);
  });

  await t.test('2. Friday is always OFF for all employees', () => {
    const result = rosterSolverService.solveRoster('t1', '2026-09-20');
    const fridays = result.roster.filter(r => r.dayOfWeek === 5);
    assert.equal(fridays.length, 3);
    for (const f of fridays) {
      assert.equal(f.shift, 'OFF');
    }
  });

  await t.test('3. Employees on approved leave get LEAVE assignment', () => {
    const result = rosterSolverService.solveRoster('t1', '2026-09-20');
    // e3 has leave on 2026-09-21 and 2026-09-22
    const e3Leave1 = result.roster.find(r => r.employeeCode === 'EMP03' && r.date === '2026-09-21');
    const e3Leave2 = result.roster.find(r => r.employeeCode === 'EMP03' && r.date === '2026-09-22');
    assert.equal(e3Leave1.shift, 'LEAVE');
    assert.equal(e3Leave2.shift, 'LEAVE');
  });

  await t.test('4. Shift distribution is roughly equal (A/B/C)', () => {
    const result = rosterSolverService.solveRoster('t1', '2026-09-20');
    assert.ok(result.stats.shiftA >= 0);
    assert.ok(result.stats.shiftB >= 0);
    assert.ok(result.stats.shiftC >= 0);
  });

  await t.test('5. validateRoster detects violation (employee with no OFF day)', () => {
    const fakeRoster = [];
    for (let i=0; i<7; i++) {
      fakeRoster.push({
        date: `2026-09-${20+i}`,
        employeeCode: 'EMP99',
        shift: 'A'
      });
    }
    const val = rosterSolverService.validateRoster(fakeRoster);
    assert.equal(val.valid, false);
    assert.ok(val.violations.length > 0);
  });

  await t.test('6. exportRosterToCsv returns string starting with BOM', () => {
    const result = rosterSolverService.solveRoster('t1', '2026-09-20');
    const csv = rosterSolverService.exportRosterToCsv(result.roster, db.employees);
    assert.ok(csv.startsWith('\uFEFF'));
  });

  await t.test('7. Stats object has correct total employees count', () => {
    const result = rosterSolverService.solveRoster('t1', '2026-09-20');
    assert.equal(result.stats.totalEmployees, 3);
  });
});
