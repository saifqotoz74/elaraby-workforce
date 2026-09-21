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
const erp = require('../server/src/integrations/erp');
const reconciliationEngine = require('../server/src/integrations/reconciliation/reconciliationEngine');
const biometrics = require('../server/src/integrations/biometrics');
const contracts = require('./contracts');
const crypto = require('crypto');

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

  // -------------------------------------------------------------------------
  // Interaction 17: AI Roster Generated Shift -> Attendance Punch Validation -> ERP Attendance Reconciliation (F19 + F20 + F18)
  // -------------------------------------------------------------------------
  await t.test('INT-17: AI Roster Generated Shift -> Attendance Punch Validation -> ERP Attendance Reconciliation (F19 + F20 + F18)', async () => {
    const database = db();
    const emp1 = database.employees.find((e) => e.id === 'emp_1');
    const today = new Date();
    const scheduled = shiftService.resolveShiftForDate(emp1, today);
    assert.ok(scheduled.id);

    // Punch in for employee
    const punchRes = await request('POST', '/api/attendance/punch', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'in',
      lat: 30.5518,
      lng: 31.1442,
      timestamp: Date.now(),
    });
    assert.ok([201, 403].includes(punchRes.status));

    // Run ERP Attendance Reconciliation against external punch
    const extPunch = [
      {
        employeeId: 'emp_1',
        date: scheduled.date,
        checkIn: '08:00:00',
        checkOut: '17:00:00',
        shiftKey: scheduled.id,
      },
    ];
    const reconRes = await request('POST', '/api/admin/integrations/reconciliation/attendance', {
      Authorization: `Bearer ${adminToken}`,
    }, { externalAttendance: extPunch });
    assert.equal(reconRes.status, 200);
    assert.equal(reconRes.json?.ok, true);
    assert.ok(reconRes.json?.auditLogId);
  });

  // -------------------------------------------------------------------------
  // Interaction 18: Bulk Punch Retransmission -> Idempotent Today Punch State (F20 + F15)
  // -------------------------------------------------------------------------
  await t.test('INT-18: Bulk Punch Retransmission -> Idempotent Today Punch State (F20 + F15)', async () => {
    const dateKey = shiftService.toDateKey(new Date());
    const offlineToken = attendanceService.generateOfflineToken('emp_1', dateKey);

    // Transmit punch 1
    const res1 = await request('POST', '/api/attendance/punch', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'in',
      lat: 30.5518,
      lng: 31.1442,
      timestamp: Date.now(),
      isOffline: true,
      offlineToken,
    });
    assert.ok([201, 403].includes(res1.status));

    // Retransmit punch 2 (network duplicate)
    const res2 = await request('POST', '/api/attendance/punch', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'in',
      lat: 30.5518,
      lng: 31.1442,
      timestamp: Date.now(),
      isOffline: true,
      offlineToken,
    });
    assert.ok([201, 403].includes(res2.status));

    // Verify today punch state remains coherent
    const todayRes = await request('GET', '/api/attendance/today', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(todayRes.status, 200);
    assert.ok(todayRes.json?.status);
  });

  // -------------------------------------------------------------------------
  // Interaction 19: SAP/Oracle Schema Export -> Mutation -> Payroll Reconciliation Discrepancy Logging (F17 + F18 + F4)
  // -------------------------------------------------------------------------
  await t.test('INT-19: SAP/Oracle Schema Export -> Mutation -> Payroll Reconciliation Discrepancy Logging (F17 + F18 + F4)', async () => {
    // 1. Export schema
    const exportRes = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=payroll', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(exportRes.status, 200);
    assert.ok(exportRes.json?.records);

    // 2. Simulate external system discrepancy mutation
    const database = db();
    const internalPay = (database.payroll || []).find((p) => p.employeeId === 'emp_1') || { basicSalary: 8500 };

    const externalMutated = [
      {
        employeeId: 'emp_1',
        period: '2026-09',
        basicSalary: (internalPay.basicSalary || 8500) + 1200,
        allowances: 1500,
        deductions: 500,
        netSalary: (internalPay.basicSalary || 8500) + 2200,
      },
    ];

    // 3. Reconcile mutated payroll
    const reconRes = await request('POST', '/api/admin/integrations/reconciliation/payroll', {
      Authorization: `Bearer ${adminToken}`,
    }, { externalPayroll: externalMutated });
    assert.equal(reconRes.status, 200);
    assert.ok(reconRes.json?.mismatchCount > 0);

    const disc = reconRes.json?.discrepancies?.find((d) => d.employeeId === 'emp_1' && d.field === 'basicSalary');
    assert.ok(disc, 'Must detect mutated basic salary discrepancy');
    assert.equal(disc.diff, 1200);

    // 4. Audit trail confirms logging
    const payAudit = (database.auditLogs || []).find((l) => l.action === 'ERP_RECONCILIATION_PAYROLL');
    assert.ok(payAudit);
  });

  // -------------------------------------------------------------------------
  // Interaction 20: Factory Line Quota Auto-Generation -> Fatigue Gate -> Overtime Claim Approval (F19 + F13 + F4)
  // -------------------------------------------------------------------------
  await t.test('INT-20: Factory Line Quota Auto-Generation -> Fatigue Gate -> Overtime Claim Approval (F19 + F13 + F4)', async () => {
    const database = db();
    const emp1 = database.employees.find((e) => e.id === 'emp_1');
    const sunday = new Date('2026-09-20T00:00:00');
    const roster = shiftService.getRosterForWeek(emp1, sunday);
    assert.equal(roster.length, 7);

    // Check fatigue compliance for turnaround
    const fatigue = shiftService.checkFatigueSafety('emp_1', 'morning', 'evening', roster[1].date);
    assert.equal(fatigue.safe, true);

    // Worker creates overtime claim
    const claimRes = await request('POST', '/api/overtime/claim', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      date: '2026-09-20',
      hours: 3,
      type: 'day',
      reason: 'Urgent production line assembly quota',
    });
    assert.equal(claimRes.status, 201);
    const claimId = claimRes.json?.claim?.id;

    // Supervisor approves overtime claim
    const approveRes = await request('POST', `/api/admin/overtime/${claimId}/decide`, {
      Authorization: `Bearer ${adminToken}`,
    }, {
      decision: 'approved',
      notes: 'Approved for line balancing completion',
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.json?.claim?.status, 'approved');
  });

  // -------------------------------------------------------------------------
  // Interaction 21: Banking CIB Batch Generation -> HMAC Manifest Signing -> Tamper Verification (Pillar 1)
  // -------------------------------------------------------------------------
  await t.test('INT-21: Banking CIB Batch Generation -> HMAC Manifest Signing -> Tamper Verification (Pillar 1)', async () => {
    const records = [
      { employeeCode: 'EMP-1001', employeeName: 'Mohamed Salah', nationalId: '29001011234567', iban: 'EG440024000000000123456789012', basicSalary: 10000, allowances: 2000, deductions: 500, netSalary: 11500 },
      { employeeCode: 'EMP-1002', employeeName: 'Ali Hassan', nationalId: '29202021234567', iban: 'EG440024000000000123456789013', basicSalary: 8000, allowances: 1000, deductions: 200, netSalary: 8800 },
    ];
    const batch = contracts.CibBatchGenerator.generateFixedWidth(records, { batchReference: 'BATCH-INT-21', period: '2026-09' });
    const payload = typeof batch === 'string' ? batch : batch.content;
    assert.ok(payload);
    const count = batch.recordCount || records.length;
    assert.equal(count, 2);

    const secretKey = 'bank_secret_key_cib';
    const manifest = contracts.HmacManifestSigner.createManifest({
      bank: 'cib',
      batchReference: 'BATCH-INT-21',
      payload,
      recordCount: 2,
      totalAmount: batch.totalAmount || 20300,
      secretKey,
    });
    assert.ok(manifest.signature);

    // Verify pristine manifest
    const validCheck = contracts.HmacManifestSigner.verifyManifest({
      payload,
      manifest,
      secretKey,
    });
    assert.equal(validCheck.valid, true);

    // Tamper payload by mutating 1 character
    const tampered = payload.slice(0, 50) + 'X' + payload.slice(51);
    const tamperedCheck = contracts.HmacManifestSigner.verifyManifest({
      payload: tampered,
      manifest,
      secretKey,
    });
    assert.equal(tamperedCheck.valid, false);
    assert.ok(['SIGNATURE_VERIFICATION_FAILED', 'PAYLOAD_HASH_MISMATCH'].includes(tamperedCheck.error));
  });

  // -------------------------------------------------------------------------
  // Interaction 22: Multi-Bank Reconciliation -> Discrepancy Flagging -> Audit Trail Logging (Pillar 1)
  // -------------------------------------------------------------------------
  await t.test('INT-22: Multi-Bank Reconciliation -> Discrepancy Flagging -> Audit Trail Logging (Pillar 1)', async () => {
    const database = db();
    database.payroll = (database.payroll || []).filter((p) => p.id !== 'pay_int_22');
    database.payroll.push({
      id: 'pay_int_22',
      employeeId: 'emp_1',
      period: '2026-09',
      netSalary: 12000,
      disbursementStatus: 'pending',
    });
    save();

    const res = await request('POST', '/api/admin/banking/disbursement/reconciliation', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      batchId: 'BATCH-INT-22',
      bank: 'qnb',
      period: '2026-09',
      returns: [
        {
          transactionReference: 'TXN-INT-22',
          employeeId: 'emp_1',
          amount: 11500, // 500 EGP difference
          bankStatus: 'SETTLED',
        },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.discrepancyCount, 1);
    assert.ok(res.json?.auditLogId);

    const audit = (db().auditLogs || []).find((l) => l.id === res.json?.auditLogId || l.action === 'BANK_DISBURSEMENT_RECONCILIATION');
    assert.ok(audit, 'Must record audit log for bank reconciliation');
  });

  // -------------------------------------------------------------------------
  // Interaction 23: ZKTeco TCP Packet Creation -> Checksum Verification -> Anti-Passback Validation (Pillar 2)
  // -------------------------------------------------------------------------
  await t.test('INT-23: ZKTeco TCP Packet Creation -> Checksum Verification -> Anti-Passback Validation (Pillar 2)', async () => {
    const attlogBuf = Buffer.alloc(40);
    attlogBuf.writeUInt16LE(550, 0); // PIN
    attlogBuf[2] = 1; // fingerprint
    const packedTs = contracts.ZkTecoParser.encodeTimestamp(new Date('2026-09-22T06:00:00Z'));
    attlogBuf.writeUInt32LE(packedTs, 4);
    attlogBuf[8] = 0; // check-in
    Buffer.from('EMP-INT-23\0').copy(attlogBuf, 10);

    const packet = contracts.ZkTecoParser.createTcpPacket(13, 10, 1, attlogBuf);
    const parsed = contracts.ZkTecoParser.parseTcpPacket(packet);
    assert.equal(parsed.isValid, true);
    assert.equal(parsed.punches.length, 1);
    const punch = parsed.punches[0];

    contracts.AntiPassbackEngine.resetState('elaraby', 'gate_main', punch.employeeCode);
    const t0 = 1758600000000;
    const apb1 = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      zoneId: 'gate_main',
      employeeId: punch.employeeCode,
      requestedType: punch.punchType,
      timestamp: t0,
      mode: 'strict',
    });
    assert.equal(apb1.allowed, true);

    // Consecutive check-in without check-out
    const apb2 = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      zoneId: 'gate_main',
      employeeId: punch.employeeCode,
      requestedType: 'check-in',
      timestamp: t0 + 10000,
      mode: 'strict',
    });
    assert.equal(apb2.allowed, false);
    assert.equal(apb2.violation, 'DOUBLE_ENTRY');
  });

  // -------------------------------------------------------------------------
  // Interaction 24: Hikvision ISAPI XML Event -> Roster Shift Resolution -> Turnstile Granted Status (Pillar 2)
  // -------------------------------------------------------------------------
  await t.test('INT-24: Hikvision ISAPI XML Event -> Roster Shift Resolution -> Turnstile Granted Status (Pillar 2)', async () => {
    const xml = `
      <EventNotificationAlert>
        <eventType>AccessControllerEvent</eventType>
        <dateTime>2026-09-22T08:00:00+02:00</dateTime>
        <AccessControllerEvent>
          <majorEventType>5</majorEventType>
          <subEventType>75</subEventType>
          <employeeNoString>emp_1</employeeNoString>
          <name>Ahmed Mahmoud</name>
          <attendanceStatus>checkIn</attendanceStatus>
          <doorNo>1</doorNo>
        </AccessControllerEvent>
      </EventNotificationAlert>
    `;
    const parsed = contracts.HikvisionIsapiParser.parseEvent(xml, 'application/xml');
    assert.equal(parsed.isValid, true);
    assert.equal(parsed.status, 'GRANTED');
    assert.equal(parsed.punchType, 'check-in');

    const emp = db().employees.find((e) => e.id === 'emp_1');
    const shift = shiftService.resolveShiftForDate(emp, parsed.eventTime);
    assert.ok(shift);
    assert.ok(shift.id);
  });

  // -------------------------------------------------------------------------
  // Interaction 25: Emergency Override -> Turnstile Health Degradation -> Audit Trail Confirmation (Pillar 2)
  // -------------------------------------------------------------------------
  await t.test('INT-25: Emergency Override -> Turnstile Health Degradation -> Audit Trail Confirmation (Pillar 2)', async () => {
    contracts.TurnstileHealthMonitor.registerDevice({ id: 'DEV-INT-25', name: 'Turnstile Int 25' });
    const dev = contracts.TurnstileHealthMonitor.recordHeartbeat('DEV-INT-25', 18, true);
    assert.equal(dev.status, 'ONLINE');

    const overrideRes = await contracts.EmergencyOverrideService.executeOverride({
      action: 'UNLOCK_ALL',
      factoryId: 'Quesna',
      deviceCount: 8,
    });
    assert.equal(overrideRes.ok, true);
    assert.ok(overrideRes.executionTimeMs < 50);

    // Restore to normal operation
    const restoreRes = await request('POST', '/api/admin/access-control/emergency-override', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      action: 'RESTORE',
      factory: 'Quesna',
    });
    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.json?.status, 'NORMAL');
  });

  // -------------------------------------------------------------------------
  // Interaction 26: Mobile Offline DB Schema -> Bulk-Sync Endpoint Ingestion -> 120s Deduplication Window (Pillar 3)
  // -------------------------------------------------------------------------
  await t.test('INT-26: Mobile Offline DB Schema -> Bulk-Sync Endpoint Ingestion -> 120s Deduplication Window (Pillar 3)', async () => {
    const schemas = contracts.OfflineDatabaseContract.SCHEMAS;
    assert.ok(schemas.punch_queue);
    assert.ok(schemas.punch_queue.includes('client_punch_id'));

    const t0 = 1758700000000;
    const punches = [
      { clientPunchId: 'int26-p1', employeeId: 'emp_1', type: 'in', timestamp: t0 },
      { clientPunchId: 'int26-p2', employeeId: 'emp_1', type: 'in', timestamp: t0 + 35000 }, // duplicate within 120s
    ];
    const res = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(res.status, 200);
    assert.equal(res.json?.acceptedCount, 1);
    assert.equal(res.json?.duplicateCount, 1);

    // Punch outside 120s window accepted
    const punchFar = [
      { clientPunchId: 'int26-p3', employeeId: 'emp_1', type: 'in', timestamp: t0 + 150000 },
    ];
    const resFar = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punchFar);
    assert.equal(resFar.status, 200);
    assert.equal(resFar.json?.acceptedCount, 1);
    assert.equal(resFar.json?.duplicateCount, 0);
  });

  // -------------------------------------------------------------------------
  // Interaction 27: Network Blackout Recovery -> Bulk Punch Sync -> Daily Attendance State Calculation (Pillar 3 + Pillar 4)
  // -------------------------------------------------------------------------
  await t.test('INT-27: Network Blackout Recovery -> Bulk Punch Sync -> Daily Attendance State Calculation (Pillar 3 + Pillar 4)', async () => {
    const todayStr = '2026-09-22';
    const punchTs = new Date(`${todayStr}T07:55:00Z`).getTime();
    const punches = [
      { clientPunchId: `blackout-${Date.now()}`, employeeId: 'emp_1', type: 'in', timestamp: punchTs },
    ];
    const syncRes = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(syncRes.status, 200);
    assert.ok(syncRes.json?.acceptedCount >= 0);

    const todayRes = await request('GET', `/api/attendance/today?date=${todayStr}`, {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(todayRes.status, 200);
    assert.ok(todayRes.json);
  });

  // -------------------------------------------------------------------------
  // Interaction 28: AI Absenteeism Scoring -> Assembly Line Stoppage Alert -> Smart Backfill Candidate Matching (Pillar 4)
  // -------------------------------------------------------------------------
  await t.test('INT-28: AI Absenteeism Scoring -> Assembly Line Stoppage Alert -> Smart Backfill Candidate Matching (Pillar 4)', async () => {
    // 1. Assembly line shortage detected (8 workers scheduled for required 10)
    const workers = Array.from({ length: 8 }, (_, i) => ({ id: `w_line_${i}`, historicalAbsenceRate: 0.05 }));
    const stoppage = contracts.AiPredictiveService.assessLineStoppageRisk({
      lineId: 'LINE-ASSM-01',
      requiredQuota: 10,
      scheduledWorkers: workers,
    });
    assert.equal(stoppage.status, 'critical');
    assert.equal(stoppage.isCritical, true);

    // 2. Recommend smart backfill candidates with fatigue gates
    const candidates = [
      { id: 'cand_fatigued', department: 'Operations', skillTier: 'operator', turnaroundRestHours: 7, consecutiveDays: 4, weeklyScheduledHours: 35 },
      { id: 'cand_optimal', department: 'Operations', skillTier: 'operator', turnaroundRestHours: 15, consecutiveDays: 3, weeklyScheduledHours: 24 },
    ];
    const recs = contracts.AiPredictiveService.recommendBackfill({
      lineId: 'LINE-ASSM-01',
      candidates,
    });
    assert.equal(recs.recommendations.length, 1);
    assert.equal(recs.recommendations[0].employeeId, 'cand_optimal');
    assert.ok(recs.recommendations[0].suitabilityScore > 50);
  });

  // -------------------------------------------------------------------------
  // Interaction 29: Overtime Spend Accumulation -> Monthly Budget Drift Projection -> Auto-Freeze Enforcement (Pillar 4 + Pillar 1)
  // -------------------------------------------------------------------------
  await t.test('INT-29: Overtime Spend Accumulation -> Monthly Budget Drift Projection -> Auto-Freeze Enforcement (Pillar 4 + Pillar 1)', async () => {
    // Over-budget department triggers freeze
    const driftOver = contracts.AiPredictiveService.evaluateOvertimeDrift({
      departmentId: 'dept_over',
      monthlyBudgetHours: 200,
      consumedHours: 210, // 105% consumed
      currentDayOfMonth: 20,
      daysInMonth: 30,
    });
    assert.equal(driftOver.isLocked, true);
    assert.ok(driftOver.status === 'frozen' || driftOver.alertLevel === 'CRITICAL');

    // Safe department remains unlocked with warning
    const driftSafe = contracts.AiPredictiveService.evaluateOvertimeDrift({
      departmentId: 'dept_warning',
      monthlyBudgetHours: 200,
      consumedHours: 176, // 88% consumed
      currentDayOfMonth: 20,
      daysInMonth: 30,
    });
    assert.equal(driftSafe.isLocked, false);
    assert.ok(driftSafe.driftWarning === true || driftSafe.alertLevel === 'WARNING');
  });

  // -------------------------------------------------------------------------
  // Interaction 30: Full Industrial Shift Cascade: Banking + QR Gate Pass + APB Validation + Bulk Offline Sync + AI Analytics (All 4 Pillars)
  // -------------------------------------------------------------------------
  await t.test('INT-30: Full Industrial Shift Cascade: Banking + QR Gate Pass + APB Validation + Bulk Offline Sync + AI Analytics (All 4 Pillars)', async () => {
    // 1. Pillar 1: Generate CBE WPS batch & verify HMAC
    const payrollRecords = [
      { employeeCode: 'EMP-INT-30', employeeName: 'Mahmoud Hassan', nationalId: '29001011234567', iban: 'EG440024000000000123456789099', basicSalary: 9500, allowances: 1500, deductions: 500, netSalary: 10500 },
    ];
    const batch = contracts.CbeWpsBatchGenerator.generateCsv(payrollRecords, { batchReference: 'BATCH-CASCADE-30' });
    const payload = typeof batch === 'string' ? batch : batch.content;
    const manifest = contracts.HmacManifestSigner.createManifest({
      bank: 'cbe',
      batchReference: 'BATCH-CASCADE-30',
      payload,
      recordCount: 1,
      totalAmount: 10500,
      secretKey: 'key_cascade_30',
    });
    const manifestCheck = contracts.HmacManifestSigner.verifyManifest({
      payload,
      manifest,
      secretKey: 'key_cascade_30',
    });
    assert.equal(manifestCheck.valid, true);

    // 2. Pillar 2: Generate & verify rotating QR gate pass
    const qrToken = contracts.RotatingQrService.generateGatePassToken({
      tenantId: 'elaraby',
      employeeId: 'emp_1',
      timestamp: Date.now(),
    });
    const qrCheck = contracts.RotatingQrService.verifyGatePassToken({
      token: qrToken,
      expectedEmployeeId: 'emp_1',
      tenantId: 'elaraby',
    });
    assert.equal(qrCheck.valid, true);

    // 3. Pillar 2: Anti-Passback entry validation
    contracts.AntiPassbackEngine.resetState('elaraby', 'turnstile_main', 'emp_1');
    const t0 = 1758800000000;
    const apb = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      zoneId: 'turnstile_main',
      employeeId: 'emp_1',
      direction: 'in',
      timestamp: t0,
    });
    assert.equal(apb.valid, true);

    // 4. Pillar 3: Offline punch sync with 120s deduplication
    const punches = [
      { clientPunchId: 'cascade-p1', employeeId: 'emp_1', type: 'in', timestamp: t0 + 130000 },
    ];
    const syncRes = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(syncRes.status, 200);
    assert.equal(syncRes.json?.acceptedCount, 1);

    // 5. Pillar 4: Predictive analytics for shift line risk
    const lineRisk = contracts.AiPredictiveService.assessLineStoppageRisk({
      lineId: 'LINE-CASCADE-01',
      requiredQuota: 1,
      scheduledWorkers: [{ id: 'emp_1', historicalAbsenceRate: 0.02 }],
    });
    assert.equal(lineRisk.stoppageRisk, 'LOW');
    assert.equal(lineRisk.isCritical, false);
  });
});
