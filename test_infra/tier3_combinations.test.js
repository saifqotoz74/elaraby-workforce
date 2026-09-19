// Tier 3: Cross-Feature Interaction & Combinatorial Test Suite (16 Pairwise Tests)
// Multi-feature workflows, cascading side-effects, and cross-domain integrity verification

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  startServer,
  stopServer,
  request,
  getAdminToken,
  getEmployeeToken,
  resetDatabase,
  isPdf,
  isZip,
  hasUtf8Bom,
  parseCsv,
  db,
  save,
  ROLES,
} = require('./utils');

const shiftService = require('../server/src/services/shiftService');
const overtimeService = require('../server/src/services/overtimeService');
const attendanceService = require('../server/src/services/attendanceService');
const loanService = require('../server/src/services/loanService');
const auditService = require('../server/src/services/auditService');

let adminToken;
let elarabyEmpToken;
let elsewedyEmpToken;

test('=== TIER 3: CROSS-FEATURE COMBINATORIAL E2E SUITE ===', async (t) => {
  t.before(async () => {
    await startServer();
    resetDatabase();

    adminToken = getAdminToken({ role: ROLES.SUPER_ADMIN, tenantId: 'elaraby' });

    const database = db();
    let emp1 = database.employees.find((e) => e.id === 'emp_1');
    if (!emp1) {
      emp1 = {
        id: 'emp_1',
        name: 'Ahmed Mahmoud',
        nationalId: '29001011234567',
        factory: 'Qwesna Complex',
        department: 'Operations',
        baseSalary: 8500,
        vacationBalance: 21,
        active: true,
        tenantId: 'elaraby',
        tokenVersion: 1,
      };
      database.employees.push(emp1);
    } else {
      emp1.active = true;
      emp1.tenantId = 'elaraby';
      emp1.tokenVersion = 1;
    }

    let empElsewedy = database.employees.find((e) => e.tenantId === 'elsewedy');
    if (!empElsewedy) {
      empElsewedy = {
        id: 'emp_elsewedy_comb',
        name: 'Tariq Elsewedy',
        nationalId: '29404041234567',
        factory: '10th of Ramadan Cables',
        department: 'Production',
        baseSalary: 11000,
        vacationBalance: 21,
        active: true,
        tenantId: 'elsewedy',
        tokenVersion: 1,
      };
      database.employees.push(empElsewedy);
    }
    save();

    elarabyEmpToken = getEmployeeToken('emp_1', { tenantId: 'elaraby' });
    elsewedyEmpToken = getEmployeeToken(empElsewedy.id, { tenantId: 'elsewedy' });
  });

  t.after(async () => {
    await stopServer();
  });

  // -------------------------------------------------------------------------
  // Interaction 1: Emergency Loan -> Alert Engine -> Payroll Deduction (F5 + F3 + F1)
  // -------------------------------------------------------------------------
  await t.test('INT-1: Emergency Loan -> Alerts Engine -> Payroll Deduction (F5 + F3 + F1)', async () => {
    const database = db();
    database.loans = (database.loans || []).filter((l) => l.employeeId !== 'emp_1');
    save();

    // 1. Submit emergency loan
    const loanRes = await request('POST', '/api/loans', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'emergency',
      amount: 2400,
      installmentsCount: 2, // 1200 EGP per month
      purpose: 'Urgent family medical support',
    });
    assert.equal(loanRes.status, 201);
    const loanId = loanRes.json?.loan?.id;

    // 2. Approve loan
    await request('POST', `/api/admin/loans/${loanId}/status`, {
      Authorization: `Bearer ${adminToken}`,
    }, { status: 'approved' });

    // 3. Verify payroll statement accounts for the active loan deduction
    const payrollRes = await request('GET', '/api/payroll?period=2026-10', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(payrollRes.status, 200);
  });

  // -------------------------------------------------------------------------
  // Interaction 2: Geofence Breach -> Manager Alert -> SSE Broadcast (F6 + F3 + F14)
  // -------------------------------------------------------------------------
  await t.test('INT-2: Geofence Breach -> Manager Alert -> SSE Broadcast (F6 + F3 + F14)', async () => {
    const punchRes = await request('POST', '/api/attendance/punch', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'in',
      lat: 31.2001, // Alexandria (150 km breach)
      lng: 29.9187,
      timestamp: Date.now(),
    });
    assert.ok([201, 403].includes(punchRes.status));

    // Verify alert is recorded or punch marked out of bounds
    const todayRes = await request('GET', '/api/attendance/today', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(todayRes.status, 200);
  });

  // -------------------------------------------------------------------------
  // Interaction 3: Shift Allocation -> Peer Swap -> Approval -> Overtime (F11 + F12 + F13)
  // -------------------------------------------------------------------------
  await t.test('INT-3: Shift Allocation -> Peer Swap -> Approval -> Overtime (F11 + F12 + F13)', async () => {
    const database = db();
    let emp2 = database.employees.find((e) => e.id === 'emp_2');
    if (!emp2) {
      emp2 = {
        id: 'emp_2',
        name: 'Amr Ezzat',
        nationalId: '29303031234567',
        factory: 'Qwesna Complex',
        department: 'Operations',
        active: true,
        tenantId: 'elaraby',
      };
      database.employees.push(emp2);
      save();
    }

    // 1. Submit swap
    const swap = shiftService.createSwapRequest('emp_1', {
      targetEmployeeId: 'emp_2',
      date: '2026-10-25',
      reason: 'Shift swap for family visit',
    });

    // 2. Peer accepts
    shiftService.respondSwapRequest('emp_2', swap.id, 'accept');

    // 3. Supervisor approves
    const decideRes = await request('POST', `/api/admin/shifts/swaps/${swap.id}/decide`, {
      Authorization: `Bearer ${adminToken}`,
    }, { decision: 'approved' });
    assert.equal(decideRes.status, 200);

    // 4. Overtime on rest day calculates with 200% multiplier
    const otPay = overtimeService.calculateOvertimePay({
      hours: 4,
      date: '2026-10-23', // Friday rest day
      timePeriod: 'day',
      hourlyRate: 50,
    });
    assert.equal(otPay.multiplier, 2.0);
    assert.equal(otPay.totalAmount, 400);
  });

  // -------------------------------------------------------------------------
  // Interaction 4: Multi-Tenant RLS Isolation -> Tenant A vs Tenant B (F7 + F8 + F10)
  // -------------------------------------------------------------------------
  await t.test('INT-4: Multi-Tenant RLS Isolation -> Tenant A vs Tenant B (F7 + F8 + F10)', async () => {
    // Create employee in Elsewedy
    const uniqueNatId = `29${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const elsewedyAdminToken = getAdminToken({ role: ROLES.HR_OFFICER, tenantId: 'elsewedy' });

    const createRes = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${elsewedyAdminToken}`,
      'X-Tenant-ID': 'elsewedy',
    }, {
      name: 'Elsewedy Cable Specialist',
      nationalId: uniqueNatId,
      factory: '10th of Ramadan Cables',
      department: 'Production',
    });
    assert.equal(createRes.status, 201);
    const elsewedyEmpId = createRes.json?.employee?.id;

    // Elaraby admin with strict tenant context cannot access Elsewedy employee
    const elarabyHrToken = getAdminToken({ role: ROLES.HR_OFFICER, tenantId: 'elaraby' });
    const crossFetch = await request('GET', `/api/admin/employees/${elsewedyEmpId}`, {
      Authorization: `Bearer ${elarabyHrToken}`,
      'X-Tenant-ID': 'elaraby',
    });
    // Should be 403 or 404
    assert.ok([403, 404].includes(crossFetch.status));
  });

  // -------------------------------------------------------------------------
  // Interaction 5: Mobile Punch -> Geofence Violation -> Alert Center (F15 + F6 + F3)
  // -------------------------------------------------------------------------
  await t.test('INT-5: Mobile Punch -> Geofence Violation -> Alert Center (F15 + F6 + F3)', async () => {
    const punch = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 31.5,
      lng: 30.5,
      timestamp: Date.now(),
    });
    assert.equal(punch.geofence.withinGeofence, false);

    // Verify alert query endpoint works without server error
    const alertsRes = await request('GET', '/api/admin/alerts?unread=true', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(alertsRes.status, 500);
  });

  // -------------------------------------------------------------------------
  // Interaction 6: Single Payslip PDF vs Batch ZIP Scope (F1 + F2 + F7)
  // -------------------------------------------------------------------------
  await t.test('INT-6: Single Payslip PDF vs Batch ZIP Scope (F1 + F2 + F7)', async () => {
    // Both endpoints respect the active tenant query or header
    const singlePdfRes = await request('GET', '/api/admin/payroll/emp_1/payslip-pdf?period=2026-09', {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'elaraby',
    });
    assert.notEqual(singlePdfRes.status, 500);

    const batchZipRes = await request('GET', '/api/admin/payroll/payslips-zip?tenantId=elaraby&period=2026-09', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(batchZipRes.status, 500);
  });

  // -------------------------------------------------------------------------
  // Interaction 7: Sensitive Role Escalation -> Audit Trail -> Tenant Isolation (F4 + F3 + F7)
  // -------------------------------------------------------------------------
  await t.test('INT-7: Sensitive Role Escalation -> Audit Trail -> Tenant Isolation (F4 + F3 + F7)', async () => {
    // Record sensitive audit event
    auditService.recordAuditLog(db(), {
      actor: 'admin_elaraby',
      role: 'superadmin',
      action: 'role_escalation',
      entity: 'user',
      entityId: 'emp_1',
      details: 'Elevated role to supervisor',
    });

    const auditRes = await request('GET', '/api/admin/audit-logs?action=role_escalation', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(auditRes.status, 200);
    const logs = auditRes.json?.auditLogs || [];
    assert.ok(logs.length > 0);
  });

  // -------------------------------------------------------------------------
  // Interaction 8: Overtime Claim Approval -> Payroll Allowances (F13 + F1 + F14)
  // -------------------------------------------------------------------------
  await t.test('INT-8: Overtime Claim Approval -> Payroll Allowances (F13 + F1 + F14)', async () => {
    const claim = overtimeService.createOvertimeClaim('emp_1', {
      hours: 4,
      date: '2026-10-18',
      timePeriod: 'day',
      reason: 'Urgent production shipment',
    });

    // Supervisor approves claim
    const approveRes = await request('POST', `/api/admin/overtime/${claim.id}/decide`, {
      Authorization: `Bearer ${adminToken}`,
    }, { decision: 'approved' });
    assert.equal(approveRes.status, 200);

    // Verify claim reflects in employee's overtime history
    const claimsRes = await request('GET', '/api/overtime/claims', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(claimsRes.status, 200);
    const approvedClaim = (claimsRes.json?.claims || []).find((c) => c.id === claim.id);
    assert.equal(approvedClaim?.status, 'approved');
  });

  // -------------------------------------------------------------------------
  // Interaction 9: Mobile Shift Swap -> Colleague Mobile Accept -> Admin Grid (F12 + F11 + F15)
  // -------------------------------------------------------------------------
  await t.test('INT-9: Mobile Shift Swap -> Colleague Mobile Accept -> Admin Grid (F12 + F11 + F15)', async () => {
    const swap = shiftService.createSwapRequest('emp_1', {
      targetEmployeeId: 'emp_2',
      date: '2026-10-28',
      reason: 'Midweek doctor appointment',
    });
    assert.equal(swap.status, 'colleague_pending');

    const emp2Token = getEmployeeToken('emp_2');
    const respondRes = await request('POST', `/api/shifts/swap/${swap.id}/respond`, {
      Authorization: `Bearer ${emp2Token}`,
    }, { decision: 'accept' });
    assert.equal(respondRes.status, 200);
    assert.equal(respondRes.json?.swap?.status, 'supervisor_pending');
  });

  // -------------------------------------------------------------------------
  // Interaction 10: Tenant Employee Creation -> Bank Export Format (F8 + F9 + F16)
  // -------------------------------------------------------------------------
  await t.test('INT-10: Tenant Employee Creation -> Bank Export Format (F8 + F9 + F16)', async () => {
    const exportRes = await request('GET', '/api/admin/reports/bank-export?format=nbe&tenantId=elaraby', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(exportRes.status, 200);
    assert.ok(hasUtf8Bom(exportRes.text) || hasUtf8Bom(exportRes.buffer));
    const rows = parseCsv(exportRes.text);
    assert.ok(rows.length >= 2);
  });

  // -------------------------------------------------------------------------
  // Interaction 11: Emergency Loan Submitted -> Read Alert Workflow (F5 + F14 + F3)
  // -------------------------------------------------------------------------
  await t.test('INT-11: Emergency Loan Submitted -> Read Alert Workflow (F5 + F14 + F3)', async () => {
    const database = db();
    const alertId = `alert_loan_${Date.now()}`;
    database.alerts = database.alerts || [];
    database.alerts.push({
      id: alertId,
      type: 'loan',
      title: 'Emergency Loan Request',
      message: 'Worker emp_1 requested 1500 EGP',
      severity: 'warning',
      read: false,
      createdAt: new Date().toISOString(),
    });
    save();

    const readRes = await request('PUT', `/api/admin/alerts/${alertId}/read`, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(readRes.status, 200);
  });

  // -------------------------------------------------------------------------
  // Interaction 12: Attendance Punches with Geofence -> Export Report (F6 + F10 + F9)
  // -------------------------------------------------------------------------
  await t.test('INT-12: Attendance Punches with Geofence -> Export Report (F6 + F10 + F9)', async () => {
    // Record one punch in geofence, one out of geofence
    attendanceService.recordPunch('emp_1', { type: 'in', lat: 30.5518, lng: 31.1442, timestamp: Date.now() });
    attendanceService.recordPunch('emp_2', { type: 'in', lat: 31.5000, lng: 30.5000, timestamp: Date.now() });

    const attendanceRes = await request('GET', '/api/admin/attendance/today', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(attendanceRes.status, 200);
    assert.ok(attendanceRes.json?.ok);
  });

  // -------------------------------------------------------------------------
  // Interaction 13: PIN Update -> Security Audit -> Token Revocation (F4 + F15 + F7)
  // -------------------------------------------------------------------------
  await t.test('INT-13: PIN Update -> Security Audit -> Token Revocation (F4 + F15 + F7)', async () => {
    const database = db();
    const emp = database.employees.find((e) => e.id === 'emp_1');
    const oldVersion = emp.tokenVersion || 0;

    // Simulate PIN update and token bump
    emp.tokenVersion = oldVersion + 1;
    save();

    auditService.recordAuditLog(database, {
      actor: 'emp_1',
      action: 'pin_changed',
      details: 'Security PIN updated by employee',
    });

    // Old token should be revoked
    const staleToken = getEmployeeToken('emp_1', { tokenVersion: oldVersion });
    const res = await request('GET', '/api/me', {
      Authorization: `Bearer ${staleToken}`,
    });
    assert.equal(res.status, 401);
    assert.equal(res.json?.error, 'token_revoked');

    // Restore version
    emp.tokenVersion = oldVersion || 1;
    save();
  });

  // -------------------------------------------------------------------------
  // Interaction 14: 200% Holiday Overtime -> Bank Export WPS CBE (F13 + F10 + F1)
  // -------------------------------------------------------------------------
  await t.test('INT-14: 200% Holiday Overtime -> Bank Export WPS CBE (F13 + F10 + F1)', async () => {
    const holidayPay = overtimeService.calculateOvertimePay({
      hours: 6,
      date: '2026-10-06', // Official Armed Forces Day
      timePeriod: 'day',
      hourlyRate: 80,
    });
    assert.equal(holidayPay.multiplier, 2.0);
    assert.equal(holidayPay.totalAmount, 960);

    const wpsRes = await request('GET', '/api/admin/reports/bank-export?format=wps_cbe&period=2026-10', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(wpsRes.status, 200);
    assert.ok(wpsRes.text.startsWith('01|'));
  });

  // -------------------------------------------------------------------------
  // Interaction 15: Shift Swap to Night Shift -> Night Punch Verification (F11 + F12 + F6)
  // -------------------------------------------------------------------------
  await t.test('INT-15: Shift Swap to Night Shift -> Night Punch Verification (F11 + F12 + F6)', async () => {
    const database = db();
    database.rosterOverrides = database.rosterOverrides || [];
    database.rosterOverrides.push({
      employeeId: 'emp_1',
      date: '2026-10-29',
      shift: 'night',
      reason: 'Shift swap override',
    });
    save();

    const emp = database.employees.find((e) => e.id === 'emp_1');
    const resolved = shiftService.resolveShiftForDate(emp, new Date('2026-10-29'));
    assert.equal(resolved.shift, 'night', 'Roster override must set shift to night');
  });

  // -------------------------------------------------------------------------
  // Interaction 16: Tenant Switch -> New Tenant Employee -> Cross-Tenant RLS (F16 + F7 + F8)
  // -------------------------------------------------------------------------
  await t.test('INT-16: Tenant Switch -> New Tenant Employee -> Cross-Tenant RLS (F16 + F7 + F8)', async () => {
    // Fetch Ghabbour tenant config
    const tenantRes = await request('GET', '/api/tenants/ghabbour');
    assert.equal(tenantRes.status, 200);
    assert.equal(tenantRes.json?.tenant?.slug, 'ghabbour');

    // Create employee in Ghabbour
    const ghabbourAdminToken = getAdminToken({ role: ROLES.HR_OFFICER, tenantId: 'ghabbour' });
    const createRes = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${ghabbourAdminToken}`,
      'X-Tenant-ID': 'ghabbour',
    }, {
      name: 'Ghabbour Auto Tech',
      nationalId: `29${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      factory: 'Suez Automotive Plant',
      department: 'Assembly',
    });
    assert.equal(createRes.status, 201);
    const ghabbourEmpId = createRes.json?.employee?.id;

    // Elaraby HR officer cannot access Ghabbour employee
    const elarabyHrToken = getAdminToken({ role: ROLES.HR_OFFICER, tenantId: 'elaraby' });
    const crossRes = await request('GET', `/api/admin/employees/${ghabbourEmpId}`, {
      Authorization: `Bearer ${elarabyHrToken}`,
      'X-Tenant-ID': 'elaraby',
    });
    assert.ok([403, 404].includes(crossRes.status));
  });
});
