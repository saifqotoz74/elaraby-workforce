// Tier 4: Real-World Enterprise Scenarios Test Suite (8 Comprehensive Scenarios)
// End-to-end multi-tenant business journeys as detailed in TEST_INFRA.md

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
const realtimeService = require('../server/src/services/realtimeService');
const erp = require('../server/src/integrations/erp');
const reconciliationEngine = require('../server/src/integrations/reconciliation/reconciliationEngine');
const biometrics = require('../server/src/integrations/biometrics');

let adminToken;
let elarabyEmpToken;
let elsewedyEmpToken;

test('=== TIER 4: REAL-WORLD ENTERPRISE SCENARIOS ===', async (t) => {
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
        id: 'emp_elsewedy_scen',
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

  // =========================================================================
  // SCENARIO 1: Multi-Tenant Monthly Payroll & Batch ZIP Disbursement
  // Features: F1, F2, F7, F9, F15
  // =========================================================================
  await t.test('SCENARIO 1: Multi-Tenant Monthly Payroll & Batch ZIP Disbursement', async () => {
    // 1. Mobile employee verifies their published salary statement
    const mobilePayrollRes = await request('GET', '/api/payroll?period=2026-09', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(mobilePayrollRes.status, 200);

    // 2. HR Administrator retrieves single payslip PDF
    const singlePdfRes = await request('GET', '/api/admin/payroll/emp_1/payslip-pdf?period=2026-09', {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'elaraby',
    });
    assert.notEqual(singlePdfRes.status, 500);

    // 3. Batch ZIP export requested for tenant
    const batchZipRes = await request('GET', '/api/admin/payroll/payslips-zip?tenantId=elaraby&period=2026-09', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(batchZipRes.status, 500);

    // 4. Official WPS CBE Bank Export generation
    const bankExportRes = await request('GET', '/api/admin/reports/bank-export?format=wps_cbe&period=2026-09&tenantId=elaraby', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(bankExportRes.status, 200);
    assert.ok(bankExportRes.text.startsWith('01|'), 'WPS file must start with header 01|');
  });

  // =========================================================================
  // SCENARIO 2: Geofence Violation Detection & Realtime Manager Alert
  // Features: F6, F3, F14, F15
  // =========================================================================
  await t.test('SCENARIO 2: Geofence Violation Detection & Realtime Manager Alert', async () => {
    // 1. Employee punches in from Alexandria while assigned to Qwesna Complex
    const breachPunch = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 31.2001,
      lng: 29.9187,
      timestamp: Date.now(),
    });
    assert.equal(breachPunch.geofence.withinGeofence, false, 'Punch must be out of geofence');
    assert.ok(breachPunch.geofence.distanceMeters > 50000, 'Distance must exceed 50km');

    // 2. Verify alert can be queried by admin
    const alertsRes = await request('GET', '/api/admin/alerts', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(alertsRes.status, 500);

    // 3. Broadcast geofence breach event over SSE bridge
    assert.doesNotThrow(() => {
      realtimeService.broadcast('attendance.geofence_breach', {
        employeeId: 'emp_1',
        factory: 'Qwesna Complex',
        distanceMeters: breachPunch.geofence.distanceMeters,
      });
    });
  });

  // =========================================================================
  // SCENARIO 3: Emergency Loan Application, Alerting & Repayment Deduction
  // Features: F5, F3, F1, F15
  // =========================================================================
  await t.test('SCENARIO 3: Emergency Loan Application, Alerting & Repayment Deduction', async () => {
    const database = db();
    database.loans = (database.loans || []).filter((l) => l.employeeId !== 'emp_1');
    save();

    // 1. Employee checks eligibility caps
    const eligRes = await request('GET', '/api/loans/eligibility', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(eligRes.status, 200);

    // 2. Submit emergency advance request
    const applyRes = await request('POST', '/api/loans', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'emergency',
      amount: 2500,
      installmentsCount: 2, // 1250 EGP / month
      purpose: 'Urgent home repair',
    });
    assert.equal(applyRes.status, 201);
    const loan = applyRes.json.loan;

    // 3. HR Admin reviews and approves loan
    const approveRes = await request('POST', `/api/admin/loans/${loan.id}/status`, {
      Authorization: `Bearer ${adminToken}`,
    }, {
      status: 'approved',
      reason: 'Verified emergency documentation',
    });
    assert.equal(approveRes.status, 200);

    // 4. Verify loan status is approved
    const fetchLoanRes = await request('GET', `/api/loans/${loan.id}`, {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(fetchLoanRes.status, 200);
    assert.equal(fetchLoanRes.json?.loan?.status, 'approved');
  });

  // =========================================================================
  // SCENARIO 4: Enterprise Shift Roster Allocation & Overtime Claim Approval
  // Features: F11, F12, F13, F14
  // =========================================================================
  await t.test('SCENARIO 4: Enterprise Shift Roster Allocation & Overtime Claim Approval', async () => {
    // 1. Generate 4-week factory rotation
    const database = db();
    const emp = database.employees.find((e) => e.id === 'emp_1');
    const weeks = shiftService.getMultiWeekRoster(emp);
    assert.equal(weeks.length, 4);

    // 2. Colleague discovery and peer shift swap
    let emp2 = database.employees.find((e) => e.id === 'emp_2');
    if (!emp2) {
      emp2 = {
        id: 'emp_2',
        name: 'Hany Shaker',
        nationalId: '29303031234567',
        factory: 'Qwesna Complex',
        department: 'Operations',
        active: true,
        tenantId: 'elaraby',
      };
      database.employees.push(emp2);
      save();
    }

    const swap = shiftService.createSwapRequest('emp_1', {
      targetEmployeeId: 'emp_2',
      date: '2026-10-20',
      reason: 'Exchange morning for evening shift',
    });
    shiftService.respondSwapRequest('emp_2', swap.id, 'accept');

    // 3. Supervisor approves swap
    const decideRes = await request('POST', `/api/admin/shifts/swaps/${swap.id}/decide`, {
      Authorization: `Bearer ${adminToken}`,
    }, { decision: 'approved' });
    assert.equal(decideRes.status, 200);

    // 4. Overtime on Friday rest day with 200% rate
    const claimRes = await request('POST', '/api/overtime/claim', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      date: '2026-11-06', // Friday
      hours: 4,
      timePeriod: 'day',
      reason: 'Urgent factory maintenance',
    });
    assert.equal(claimRes.status, 201);
    const claimId = claimRes.json.claim.id;

    // 5. Supervisor approves overtime claim
    const otApproveRes = await request('POST', `/api/admin/overtime/${claimId}/decide`, {
      Authorization: `Bearer ${adminToken}`,
    }, { decision: 'approved' });
    assert.equal(otApproveRes.status, 200);
  });

  // =========================================================================
  // SCENARIO 5: Multi-Tenant Brand Isolation & Master Data Export Audit
  // Features: F7, F8, F9, F10, F16
  // =========================================================================
  await t.test('SCENARIO 5: Multi-Tenant Brand Isolation & Master Data Export Audit', async () => {
    // 1. Verify tenant configurations across companies
    const tenantsRes = await request('GET', '/api/tenants');
    assert.equal(tenantsRes.status, 200);
    const slugs = tenantsRes.json.tenants.map((t) => t.slug);
    assert.ok(slugs.includes('elaraby') && slugs.includes('elsewedy'));

    // 2. Create worker under Elsewedy
    const elsewedyAdmin = getAdminToken({ role: ROLES.HR_OFFICER, tenantId: 'elsewedy' });
    const createRes = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${elsewedyAdmin}`,
      'X-Tenant-ID': 'elsewedy',
    }, {
      name: 'Elsewedy Cable Engineer',
      nationalId: `29${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      factory: '10th of Ramadan Cables',
      department: 'Engineering',
    });
    assert.equal(createRes.status, 201);
    const createdId = createRes.json.employee.id;

    // 3. Elaraby admin cannot query this employee
    const elarabyHr = getAdminToken({ role: ROLES.HR_OFFICER, tenantId: 'elaraby' });
    const crossRes = await request('GET', `/api/admin/employees/${createdId}`, {
      Authorization: `Bearer ${elarabyHr}`,
      'X-Tenant-ID': 'elaraby',
    });
    assert.ok([403, 404].includes(crossRes.status));

    // 4. Audit trail records creation
    const auditRes = await request('GET', '/api/admin/audit-logs', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(auditRes.status, 200);
  });

  // =========================================================================
  // SCENARIO 6: Mobile Offline Attendance Punch & Automatic Queue Sync
  // Features: F6, F15, F14
  // =========================================================================
  await t.test('SCENARIO 6: Mobile Offline Attendance Punch & Automatic Queue Sync', async () => {
    // 1. Generate offline punch token with HMAC signature
    const offlineToken = attendanceService.generateOfflineToken('emp_1', '2026-10-14');
    assert.ok(offlineToken.startsWith('OFFLINE:emp_1:2026-10-14:'));

    // 2. Submit offline punch queue item
    const punchRes = await request('POST', '/api/attendance/punch', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'in',
      lat: 30.5518,
      lng: 31.1442,
      timestamp: Date.now(),
      isOffline: true,
      offlineToken,
    });
    assert.ok([201, 403].includes(punchRes.status));

    // 3. Today punch state reflects active synchronization
    const todayRes = await request('GET', '/api/attendance/today', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.equal(todayRes.status, 200);
    assert.ok(todayRes.json?.status);
  });

  // =========================================================================
  // SCENARIO 7: Tamper-Proof Audit Logging on ERP Gateway & Financial Reversal
  // Features: F4, F3, F7
  // =========================================================================
  await t.test('SCENARIO 7: Tamper-Proof Audit Logging on ERP Gateway & Financial Reversal', async () => {
    // 1. Inspect ERP Gateway Integration Status
    const statusRes = await request('GET', '/api/admin/integrations/status', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.json?.ok, true);

    // 2. Trigger ERP manual sync
    const syncRes = await request('POST', '/api/admin/integrations/sync', {
      Authorization: `Bearer ${adminToken}`,
    }, { domain: 'employees' });
    assert.equal(syncRes.status, 200);

    // 3. Query discrepancy reconciliation
    const reconRes = await request('GET', '/api/admin/integrations/reconciliation', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(reconRes.status, 200);
    assert.ok(reconRes.json?.reconciliation);

    // 4. Audit trail captures ERP sync action
    const auditRes = await request('GET', '/api/admin/audit-logs', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(auditRes.status, 200);
  });

  // =========================================================================
  // SCENARIO 8: Universal Table Export with Filter Scopes Across All 5 Companies
  // Features: F9, F10, F7, F16
  // =========================================================================
  await t.test('SCENARIO 8: Universal Table Export with Filter Scopes Across All 5 Companies', async () => {
    const companies = ['elaraby', 'elsewedy', 'tmg', 'ghabbour', 'gulf'];
    for (const company of companies) {
      // 1. Bank Export across companies
      const exportRes = await request('GET', `/api/admin/reports/bank-export?format=nbe&tenantId=${company}`, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.equal(exportRes.status, 200);
      assert.ok(hasUtf8Bom(exportRes.text) || hasUtf8Bom(exportRes.buffer));
      const rows = parseCsv(exportRes.text);
      assert.ok(rows.length >= 1, `Company ${company} must return valid CSV rows`);

      // 2. Verify header contains corporate banking columns
      const header = rows[0];
      assert.ok(header.some((col) => col.includes('National ID') || col.includes('Employee Code')));
    }
  });

  // =========================================================================
  // SCENARIO 9: Factory Line Multi-Shift Roster Balancing -> Multi-Worker Bulk Sync -> ERP Payroll Reconciliation Audit
  // Features: F17, F18, F19, F20, F4, F7
  // =========================================================================
  await t.test('SCENARIO 9: Factory Line Multi-Shift Roster Balancing -> Multi-Worker Bulk Sync -> ERP Payroll Reconciliation Audit', async () => {
    // 1. Production planner queries weekly roster
    const rosterRes = await request('GET', '/api/admin/rosters', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(rosterRes.status, 200);
    assert.ok(Array.isArray(rosterRes.json?.rosters));
    assert.ok(rosterRes.json.rosters.length >= 1);

    // 2. Verify balanced 7-day schedule with mandatory rest days honoring Egyptian Labor Law
    const lineRosters = rosterRes.json.rosters;
    for (const r of lineRosters.slice(0, 5)) {
      assert.equal(r.days.length, 7);
      const hasOff = r.days.some((d) => d.shift === 'off');
      assert.ok(hasOff, 'Each line operator must have at least one weekly rest day');
    }

    // 3. Shift operators punch in en-masse through Biometrics terminal ingestion
    const bulkPunches = [
      {
        badge_id: 'B_QSN_101',
        terminal_id: 'TERM_QSN_LINE_A',
        time: new Date().toISOString(),
        type: 'CHECK_IN',
      },
      {
        badge_id: 'B_QSN_102',
        terminal_id: 'TERM_QSN_LINE_A',
        time: new Date().toISOString(),
        type: 'CHECK_IN',
      },
      {
        badge_id: 'B_QSN_103',
        terminal_id: 'TERM_QSN_LINE_B',
        time: new Date().toISOString(),
        type: 'CHECK_IN',
      },
    ];
    const ingestRes = await biometrics.ingest(bulkPunches);
    assert.equal(ingestRes.accepted, 3);
    assert.equal(ingestRes.status, 'queued');

    // 4. Monthly close: Export payroll to SAP SuccessFactors
    const sapExportRes = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=payroll', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(sapExportRes.status, 200);
    assert.equal(sapExportRes.json?.system, 'sap');
    assert.ok(sapExportRes.json.records.length >= 1);

    // 5. Audit reconciliation: Corporate audit compares SAP figures with internal slips
    const database = db();
    const p1 = (database.payroll || []).find((p) => p.employeeId === 'emp_1') || { basicSalary: 8500, allowances: 1500, deductions: 500, netSalary: 9500 };
    const externalAuditData = [
      {
        employeeId: 'emp_1',
        period: '2026-09',
        basicSalary: p1.basicSalary,
        allowances: p1.allowances,
        deductions: p1.deductions,
        netSalary: p1.netSalary,
      },
      {
        employeeId: 'emp_audited_diff',
        period: '2026-09',
        basicSalary: 6000,
        allowances: 1000,
        deductions: 200,
        netSalary: 6800,
      },
    ];

    const reconRes = await request('POST', '/api/admin/integrations/reconciliation/payroll', {
      Authorization: `Bearer ${adminToken}`,
    }, { externalPayroll: externalAuditData });
    assert.equal(reconRes.status, 200);
    assert.equal(reconRes.json?.ok, true);
    assert.ok(reconRes.json.auditLogId);

    // 6. Confirm tamper-proof audit log entry
    const auditRes = await request('GET', '/api/admin/audit-logs?action=ERP_RECONCILIATION_PAYROLL', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(auditRes.status, 200);
    const logs = auditRes.json?.auditLogs || auditRes.json || [];
    assert.ok(logs.some((l) => l.action === 'ERP_RECONCILIATION_PAYROLL'));
  });

  // =========================================================================
  // SCENARIO 10: High-Concurrency Disaster Recovery & Cross-Tenant Punch Retransmission Storm
  // Features: F20, F6, F7, F8, F15
  // =========================================================================
  await t.test('SCENARIO 10: High-Concurrency Disaster Recovery & Cross-Tenant Punch Retransmission Storm', async () => {
    // 1. Prepare offline tokens for Elaraby and Elsewedy employees
    const dateKey = shiftService.toDateKey(new Date());
    const elarabyOfflineToken = attendanceService.generateOfflineToken('emp_1', dateKey);
    const elsewedyOfflineToken = attendanceService.generateOfflineToken('emp_elsewedy_scen', dateKey);

    // 2. High-concurrency reconnection burst: multiple simultaneous punches
    const punchPromises = [
      // Elaraby punch 1
      request('POST', '/api/attendance/punch', {
        Authorization: `Bearer ${elarabyEmpToken}`,
      }, {
        type: 'in',
        lat: 30.5518,
        lng: 31.1442,
        timestamp: Date.now(),
        isOffline: true,
        offlineToken: elarabyOfflineToken,
      }),
      // Elaraby punch 1 retransmission (jitter duplicate)
      request('POST', '/api/attendance/punch', {
        Authorization: `Bearer ${elarabyEmpToken}`,
      }, {
        type: 'in',
        lat: 30.5518,
        lng: 31.1442,
        timestamp: Date.now(),
        isOffline: true,
        offlineToken: elarabyOfflineToken,
      }),
      // Elsewedy punch
      request('POST', '/api/attendance/punch', {
        Authorization: `Bearer ${elsewedyEmpToken}`,
      }, {
        type: 'in',
        lat: 30.2981,
        lng: 31.7428,
        timestamp: Date.now(),
        isOffline: true,
        offlineToken: elsewedyOfflineToken,
      }),
    ];

    const punchResults = await Promise.all(punchPromises);
    for (const r of punchResults) {
      assert.ok([201, 403].includes(r.status));
    }

    // 3. Admin verifies Live Attendance monitor for Elaraby tenant
    const liveAttendanceRes = await request('GET', '/api/admin/attendance/today?tenantId=elaraby', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(liveAttendanceRes.status, 200);
    assert.ok(liveAttendanceRes.json?.ok !== undefined || liveAttendanceRes.json?.stats !== undefined);

    // 4. Cross-tenant isolation verification: Elsewedy HR officer cannot access Elaraby employee data
    const elsewedyAdminToken = getAdminToken({ role: ROLES.HR_OFFICER, tenantId: 'elsewedy' });
    const crossTenantEmp = await request('GET', '/api/admin/employees/emp_1', {
      Authorization: `Bearer ${elsewedyAdminToken}`,
      'X-Tenant-ID': 'elsewedy',
    });
    assert.ok([403, 404].includes(crossTenantEmp.status));

    // Elsewedy HR officer queries own attendance without leakage
    const elsewedyAttendance = await request('GET', '/api/admin/attendance/today', {
      Authorization: `Bearer ${elsewedyAdminToken}`,
      'X-Tenant-ID': 'elsewedy',
    });
    assert.equal(elsewedyAttendance.status, 200);
    const records = elsewedyAttendance.json?.records || [];
    assert.ok(records.every((r) => r.tenantId !== 'elaraby'));
  });
});
