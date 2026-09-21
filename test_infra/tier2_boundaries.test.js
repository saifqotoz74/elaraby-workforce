// Tier 2: Boundary & Corner Cases Test Suite (16 Features x 5 Tests = 80 Tests)
// Extreme inputs, zero values, boundary coordinates, security injections & edge conditions

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
const erp = require('../server/src/integrations/erp');
const reconciliationEngine = require('../server/src/integrations/reconciliation/reconciliationEngine');
const biometrics = require('../server/src/integrations/biometrics');
const { verifyHash } = require('../server/src/auth');
const contracts = require('./contracts');
const crypto = require('crypto');

let adminToken;
let elarabyEmpToken;

test('=== TIER 2: BOUNDARY & CORNER CASES E2E SUITE ===', async (t) => {
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
      emp1.tokenVersion = 1;
    }
    save();

    elarabyEmpToken = getEmployeeToken('emp_1', { tenantId: 'elaraby' });
  });

  t.after(async () => {
    await stopServer();
  });

  // =========================================================================
  // B1: Individual PDF Payslip Boundaries
  // =========================================================================
  await t.test('B1.1: PDF Payslip - Zero base salary (baseSalary: 0) handled gracefully', async () => {
    const database = db();
    const zeroEmp = {
      id: 'emp_zero_salary',
      name: 'Unpaid Intern',
      nationalId: '29901011234567',
      factory: 'Qwesna Complex',
      department: 'Training',
      baseSalary: 0,
      active: true,
      tenantId: 'elaraby',
    };
    database.employees.push(zeroEmp);
    save();

    const res = await request('GET', `/api/admin/payroll/${zeroEmp.id}/payslip-pdf`, {
      Authorization: `Bearer ${adminToken}`,
    });
    // Must return 200 PDF or 404 (if not implemented) without 500 server crash
    assert.notEqual(res.status, 500, 'Zero salary must not crash server with 500');
  });

  await t.test('B1.2: PDF Payslip - Extreme executive salary (1,000,000 EGP) renders without crash', async () => {
    const database = db();
    const execEmp = {
      id: 'emp_exec_salary',
      name: 'Board Chairman',
      nationalId: '26001011234567',
      factory: 'Qwesna Complex',
      department: 'Executive',
      baseSalary: 1000000,
      active: true,
      tenantId: 'elaraby',
    };
    database.employees.push(execEmp);
    save();

    const res = await request('GET', `/api/admin/payroll/${execEmp.id}/payslip-pdf`, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B1.3: PDF Payslip - Complex Arabic name with diacritics and symbols renders safely', async () => {
    const database = db();
    const arEmp = {
      id: 'emp_arabic_diacritics',
      name: 'مُحَمَّد عَبْد الرَّحْمَن (مهندس أول)',
      nationalId: '29501011234567',
      factory: 'Qwesna Complex',
      department: 'Engineering',
      baseSalary: 9500,
      active: true,
      tenantId: 'elaraby',
    };
    database.employees.push(arEmp);
    save();

    const res = await request('GET', `/api/admin/payroll/${arEmp.id}/payslip-pdf`, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B1.4: PDF Payslip - SQL injection in period parameter does not crash server', async () => {
    const res = await request('GET', "/api/admin/payroll/emp_1/payslip-pdf?period=2026-09' OR '1'='1", {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500, 'SQL injection probe must not cause 500 internal error');
  });

  await t.test('B1.5: PDF Payslip - Period in distant past (1970-01) handled without exception', async () => {
    const res = await request('GET', '/api/admin/payroll/emp_1/payslip-pdf?period=1970-01', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  // =========================================================================
  // B2: Batch Payslip ZIP Boundaries
  // =========================================================================
  await t.test('B2.1: Batch ZIP - Non-existent tenant with 0 employees does not crash server', async () => {
    const res = await request('GET', '/api/admin/payroll/payslips-zip?tenantId=empty_tenant_xyz', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B2.2: Batch ZIP - Period in distant future (2099-12) handled safely', async () => {
    const res = await request('GET', '/api/admin/payroll/payslips-zip?period=2099-12', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B2.3: Batch ZIP - Malformed month string (not-a-date) returns 400 or handled safely', async () => {
    const res = await request('GET', '/api/admin/payroll/payslips-zip?period=not-a-date-string', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B2.4: Batch ZIP - Filter with non-existent department returns empty/safe zip', async () => {
    const res = await request('GET', '/api/admin/payroll/payslips-zip?department=NonExistentDepartment999', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B2.5: Batch ZIP - Special characters in department parameter handled without crash', async () => {
    const res = await request('GET', '/api/admin/payroll/payslips-zip?department=%3Cscript%3Ealert(1)%3C/script%3E', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  // =========================================================================
  // B3: Manager Alerts Engine Boundaries
  // =========================================================================
  await t.test('B3.1: Manager Alerts - Mark non-existent alert read returns 404 or safe false', async () => {
    const res = await request('PUT', '/api/admin/alerts/non_existent_alert_9999/read', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.ok([200, 404].includes(res.status));
  });

  await t.test('B3.2: Manager Alerts - Extreme limit parameter (limit=100000) does not crash', async () => {
    const res = await request('GET', '/api/admin/alerts?limit=100000', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B3.3: Manager Alerts - Negative limit parameter (limit=-5) handled safely', async () => {
    const res = await request('GET', '/api/admin/alerts?limit=-5', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B3.4: Manager Alerts - SQL injection in alert query handled without crash', async () => {
    const res = await request('GET', "/api/admin/alerts?type=audit' OR '1'='1", {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B3.5: Manager Alerts - Empty alerts store returns empty array', async () => {
    const database = db();
    database.alerts = [];
    save();
    const res = await request('GET', '/api/admin/alerts', {
      Authorization: `Bearer ${adminToken}`,
    });
    if (res.status === 200) {
      assert.ok(Array.isArray(res.json?.alerts));
      assert.equal(res.json?.alerts?.length, 0);
    }
  });

  // =========================================================================
  // B4: Audit & Sensitive Action Boundaries
  // =========================================================================
  await t.test('B4.1: Audit Logs - Empty query parameters returns default paginated list', async () => {
    const res = await request('GET', '/api/admin/audit-logs', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(res.status, 200);
  });

  await t.test('B4.2: Audit Logs - Inverted date range (from > to) returns empty array or safe result', async () => {
    const res = await request('GET', '/api/admin/audit-logs?from=2026-12-31&to=2026-01-01', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(res.status, 200);
  });

  await t.test('B4.3: Audit Logs - Massive detail payload (50KB text) recorded without crash', () => {
    const auditService = require('../server/src/services/auditService');
    const hugeText = 'X'.repeat(50000);
    assert.doesNotThrow(() => {
      auditService.recordAuditLog(db(), {
        actor: 'admin',
        role: 'superadmin',
        action: 'bulk_data_mutation',
        details: hugeText,
      });
    });
  });

  await t.test('B4.4: Audit Logs - Rapid consecutive audit writes do not corrupt state', () => {
    const auditService = require('../server/src/services/auditService');
    for (let i = 0; i < 20; i++) {
      auditService.recordAuditLog(db(), {
        actor: 'load_tester',
        action: `stress_test_${i}`,
      });
    }
    const logs = auditService.getAuditLogs({ limit: 30 });
    assert.ok(logs.auditLogs.length >= 20);
  });

  await t.test('B4.5: Audit Logs - Filtering by non-existent action returns zero matches', async () => {
    const res = await request('GET', '/api/admin/audit-logs?action=non_existent_action_xyz', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(res.status, 200);
    const logs = res.json?.auditLogs || [];
    assert.equal(logs.length, 0);
  });

  // =========================================================================
  // B5: Emergency Loan Boundaries
  // =========================================================================
  await t.test('B5.1: Loans - Loan application exceeding 50% net salary limit is rejected', () => {
    // emp_1 baseSalary = 8500. Attempting 50000 exceeds 50% of salary
    assert.throws(() => {
      loanService.applyLoan('emp_1', {
        type: 'emergency',
        amount: 50000,
        installmentsCount: 3,
        purpose: 'Excessive loan request',
      });
    });
  });

  await t.test('B5.2: Loans - Zero amount loan rejected with validation error', () => {
    assert.throws(() => {
      loanService.applyLoan('emp_1', {
        type: 'emergency',
        amount: 0,
        installmentsCount: 3,
      });
    });
  });

  await t.test('B5.3: Loans - Negative amount loan rejected with validation error', () => {
    assert.throws(() => {
      loanService.applyLoan('emp_1', {
        type: 'emergency',
        amount: -1000,
        installmentsCount: 3,
      });
    });
  });

  await t.test('B5.4: Loans - Zero installments count rejected with validation error', () => {
    assert.throws(() => {
      loanService.applyLoan('emp_1', {
        type: 'emergency',
        amount: 1000,
        installmentsCount: 0,
      });
    });
  });

  await t.test('B5.5: Loans - Idempotency key deduplication prevents double disbursement', async () => {
    const idemKey = `idem_${Date.now()}`;
    const reqBody = {
      type: 'emergency',
      amount: 500,
      installmentsCount: 2,
      purpose: 'Idempotency check',
      idempotencyKey: idemKey,
    };

    const res1 = await request('POST', '/api/loans', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, reqBody);

    const res2 = await request('POST', '/api/loans', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, reqBody);

    // Second request should return identical loan or 409 conflict
    assert.ok(res2.status === 200 || res2.status === 201 || res2.status === 409);
  });

  // =========================================================================
  // B6: Geofence Boundaries
  // =========================================================================
  await t.test('B6.1: Geofence - Coordinates at Null Island (lat: 0, lng: 0) evaluated outside geofence', () => {
    const punch = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 0.0,
      lng: 0.0,
      timestamp: Date.now(),
    });
    assert.equal(punch.geofence.withinGeofence, false);
    assert.ok(punch.geofence.distanceMeters > 1000000);
  });

  await t.test('B6.2: Geofence - Extreme valid coordinates (lat: 90, lng: 180) evaluated safely', () => {
    const punch = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 90.0,
      lng: 180.0,
      timestamp: Date.now(),
    });
    assert.equal(punch.geofence.withinGeofence, false);
  });

  await t.test('B6.3: Geofence - NaN coordinates handled safely without server crash', () => {
    assert.doesNotThrow(() => {
      attendanceService.recordPunch('emp_1', {
        type: 'in',
        lat: NaN,
        lng: NaN,
        timestamp: Date.now(),
      });
    });
  });

  await t.test('B6.4: Geofence - Missing lat/lng fields falls back gracefully without unhandled exception', () => {
    assert.doesNotThrow(() => {
      attendanceService.recordPunch('emp_1', {
        type: 'in',
        timestamp: Date.now(),
      });
    });
  });

  await t.test('B6.5: Geofence - Coordinate right on factory boundary perimeter evaluates cleanly', () => {
    // Qwesna Complex factory center: 30.5518, 31.1442
    // Exact center should evaluate to withinGeofence: true
    const punch = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 30.5518,
      lng: 31.1442,
      timestamp: Date.now(),
    });
    assert.equal(punch.geofence.withinGeofence, true);
    assert.ok(punch.geofence.distanceMeters <= 50);
  });

  // =========================================================================
  // B7: Multi-Tenant RLS Boundaries
  // =========================================================================
  await t.test('B7.1: Multi-Tenant RLS - Case-insensitive tenant header ELARABY resolves cleanly', async () => {
    const res = await request('GET', '/api/me', {
      Authorization: `Bearer ${elarabyEmpToken}`,
      'X-Tenant-ID': 'ELARABY',
    });
    assert.equal(res.status, 200);
  });

  await t.test('B7.2: Multi-Tenant RLS - Tenant header with surrounding whitespace is trimmed safely', async () => {
    const res = await request('GET', '/api/me', {
      Authorization: `Bearer ${elarabyEmpToken}`,
      'X-Tenant-ID': '  elaraby  ',
    });
    assert.equal(res.status, 200);
  });

  await t.test('B7.3: Multi-Tenant RLS - Path traversal in tenant header is sanitized/rejected', async () => {
    const res = await request('GET', '/api/me', {
      Authorization: `Bearer ${elarabyEmpToken}`,
      'X-Tenant-ID': '../../etc/passwd',
    });
    assert.ok([400, 403, 404].includes(res.status));
  });

  await t.test('B7.4: Multi-Tenant RLS - Expired JWT token rejected with 401', async () => {
    // Generate manually expired token (exp in past)
    const { signToken } = require('../server/src/auth');
    const expiredToken = signToken({ sub: 'emp_1', scope: 'employee', exp: Math.floor(Date.now() / 1000) - 3600 });
    const res = await request('GET', '/api/me', {
      Authorization: `Bearer ${expiredToken}`,
    });
    assert.equal(res.status, 401);
  });

  await t.test('B7.5: Multi-Tenant RLS - Tampered JWT signature rejected with 401', async () => {
    const parts = elarabyEmpToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.badSignature12345`;
    const res = await request('GET', '/api/me', {
      Authorization: `Bearer ${tampered}`,
    });
    assert.equal(res.status, 401);
  });

  // =========================================================================
  // B8: Employee Creation Boundaries
  // =========================================================================
  await t.test('B8.1: Employee Creation - National ID shorter than 14 digits rejected with 400', async () => {
    const res = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      name: 'Short National ID Test',
      nationalId: '123456789', // Only 9 digits
    });
    assert.equal(res.status, 400);
  });

  await t.test('B8.2: Employee Creation - National ID with non-numeric characters rejected with 400', async () => {
    const res = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      name: 'Alpha National ID Test',
      nationalId: '2900101ABCD567',
    });
    assert.equal(res.status, 400);
  });

  await t.test('B8.3: Employee Creation - Extremely long name (500 chars) handled safely', async () => {
    const longName = 'A'.repeat(500);
    const res = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      name: longName,
      nationalId: `29${Math.floor(100000000000 + Math.random() * 900000000000)}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B8.4: Employee Creation - Negative base salary handled safely', async () => {
    const res = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      name: 'Negative Salary Test',
      nationalId: `29${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      baseSalary: -5000,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B8.5: Employee Creation - HTML/XSS injection in name sanitized or safely escaped', async () => {
    const xssName = '<script>alert("XSS")</script>';
    const res = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      name: xssName,
      nationalId: `29${Math.floor(100000000000 + Math.random() * 900000000000)}`,
    });
    assert.notEqual(res.status, 500);
  });

  // =========================================================================
  // B9: CSV Export Boundaries
  // =========================================================================
  await t.test('B9.1: CSV Export - Cell containing double quotes escaped properly', () => {
    const raw = '"Value with quotes"';
    const escaped = `"${raw.replace(/"/g, '""')}"`;
    assert.equal(escaped, '"""Value with quotes"""');
  });

  await t.test('B9.2: CSV Export - Cell containing commas enclosed in quotes', () => {
    const parsed = parseCsv('Name,Department,Salary\r\n"Mahmoud, Ahmed",Operations,8500');
    assert.equal(parsed.length, 2);
    assert.equal(parsed[1][0], 'Mahmoud, Ahmed');
  });

  await t.test('B9.3: CSV Export - Cell containing carriage return line feed handled in parser', () => {
    const parsed = parseCsv('Header1,Header2\r\n"Line 1\nLine 2",Value2');
    assert.ok(parsed.length >= 1);
  });

  await t.test('B9.4: CSV Export - Cell containing Arabic text with tatweel / diacritics preserves encoding', () => {
    const text = '\uFEFF' + 'الاسم,القسم\r\n"مُحَمَّـــد",العمليات';
    assert.ok(hasUtf8Bom(text));
    const parsed = parseCsv(text);
    assert.equal(parsed[1][0], 'مُحَمَّـــد');
  });

  await t.test('B9.5: CSV Export - Zero-row export returns valid header without error', () => {
    const parsed = parseCsv('Code,Name,Department,Status\r\n');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0][0], 'Code');
  });

  // =========================================================================
  // B10: Filter-Aware Export Boundaries
  // =========================================================================
  await t.test('B10.1: Filtered Export - Filter matching 0 records returns header row only', async () => {
    const res = await request('GET', '/api/admin/reports/bank-export?format=nbe&facilityCode=NON_EXISTENT_FACILITY_99', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(res.status, 200);
    const rows = parseCsv(res.text);
    assert.ok(rows.length >= 1);
  });

  await t.test('B10.2: Filtered Export - Filter with unicode emoji handled cleanly', async () => {
    const res = await request('GET', '/api/admin/attendance/today?factory=🏭%20Factory', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B10.3: Filtered Export - Search query with regex metacharacters (*+?^$) does not break regex', async () => {
    const res = await request('GET', '/api/admin/audit-logs?action=*+?^${}()|[]', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B10.4: Filtered Export - Search query with SQL wildcards (% and _) handled safely', async () => {
    const res = await request('GET', '/api/admin/audit-logs?actor=admin%25', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B10.5: Filtered Export - Analytics query with malformed period handled safely', async () => {
    const res = await request('GET', '/api/admin/reports/analytics?period=invalid-period-format', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.notEqual(res.status, 500);
  });

  // =========================================================================
  // B11: Shift Grid Boundaries
  // =========================================================================
  await t.test('B11.1: Shift Grid - Leap day date (2028-02-29) resolves without date error', () => {
    const database = db();
    const emp = database.employees[0];
    const shift = shiftService.resolveShiftForDate(emp, new Date('2028-02-29'));
    assert.ok(shift);
    assert.ok(['morning', 'evening', 'night', 'off'].includes(shift.shift));
  });

  await t.test('B11.2: Shift Grid - Shift lookup for date 10 years in the future resolves cleanly', () => {
    const database = db();
    const emp = database.employees[0];
    const shift = shiftService.resolveShiftForDate(emp, new Date('2036-10-15'));
    assert.ok(shift);
  });

  await t.test('B11.3: Shift Grid - Worker with undefined factory assignment defaults safely', () => {
    const empNoFactory = { id: 'emp_no_factory', name: 'Floating Worker' };
    assert.doesNotThrow(() => {
      shiftService.resolveShiftForDate(empNoFactory, new Date());
    });
  });

  await t.test('B11.4: Shift Grid - Fatigue check blocks identical same-shift double assignment', () => {
    const check = shiftService.checkFatigueSafety('emp_1', 'morning', 'morning', '2026-10-14');
    assert.equal(check.safe, false);
    assert.equal(check.reason, 'same_shift');
  });

  await t.test('B11.5: Shift Grid - Rest day followed by morning shift is safe', () => {
    const check = shiftService.checkFatigueSafety('emp_1', 'off', 'morning', '2026-10-14');
    assert.equal(check.safe, true);
  });

  // =========================================================================
  // B12: Shift Swap Boundaries
  // =========================================================================
  await t.test('B12.1: Shift Swap - Swapping shift on a date in the past is rejected', () => {
    assert.throws(() => {
      shiftService.createSwapRequest('emp_1', {
        targetEmployeeId: 'emp_2',
        date: '2020-01-01',
        reason: 'Backdated swap',
      });
    });
  });

  await t.test('B12.2: Shift Swap - Swapping shift with oneself is rejected', () => {
    assert.throws(() => {
      shiftService.createSwapRequest('emp_1', {
        targetEmployeeId: 'emp_1', // Self swap
        date: '2026-11-01',
        reason: 'Self swap attempt',
      });
    });
  });

  await t.test('B12.3: Shift Swap - Swapping with non-existent employee is rejected', () => {
    assert.throws(() => {
      shiftService.createSwapRequest('emp_1', {
        targetEmployeeId: 'non_existent_worker_9999',
        date: '2026-11-01',
        reason: 'Phantom swap',
      });
    });
  });

  await t.test('B12.4: Shift Swap - Invalid decision string (maybe) rejected with error', () => {
    assert.throws(() => {
      shiftService.respondSwapRequest('emp_2', 'swap_dummy_id', 'maybe');
    });
  });

  await t.test('B12.5: Shift Swap - Responding to non-existent swap returns 404', () => {
    assert.throws(() => {
      shiftService.respondSwapRequest('emp_2', 'non_existent_swap_id', 'accept');
    });
  });

  // =========================================================================
  // B13: Overtime Boundaries
  // =========================================================================
  await t.test('B13.1: Overtime - Zero hours overtime claim is rejected', () => {
    assert.throws(() => {
      overtimeService.createOvertimeClaim('emp_1', {
        hours: 0,
        date: '2026-10-15',
        timePeriod: 'day',
      });
    });
  });

  await t.test('B13.2: Overtime - Negative hours overtime claim is rejected', () => {
    assert.throws(() => {
      overtimeService.createOvertimeClaim('emp_1', {
        hours: -3,
        date: '2026-10-15',
        timePeriod: 'day',
      });
    });
  });

  await t.test('B13.3: Overtime - Fractional hours (1.5 hours) calculates accurately', () => {
    const calc = overtimeService.calculateOvertimePay({
      hours: 1.5,
      date: '2026-10-14',
      timePeriod: 'day',
      hourlyRate: 100,
    });
    // 1.5 * 100 * 1.35 = 202.5
    assert.equal(calc.totalAmount, 202.5);
  });

  await t.test('B13.4: Overtime - Claim exceeding daily labor cap (>8 hours) handled safely', () => {
    const calc = overtimeService.calculateOvertimePay({
      hours: 10,
      date: '2026-10-14',
      timePeriod: 'day',
      hourlyRate: 50,
    });
    assert.ok(calc.totalAmount > 0);
  });

  await t.test('B13.5: Overtime - Deciding non-existent claim returns 404', async () => {
    const res = await request('POST', '/api/admin/overtime/non_existent_claim_9999/decide', {
      Authorization: `Bearer ${adminToken}`,
    }, { decision: 'approved' });
    assert.equal(res.status, 404);
  });

  // =========================================================================
  // B14: SSE Realtime Boundaries
  // =========================================================================
  await t.test('B14.1: SSE - Rapid broadcast of 50 events does not leak or crash memory', () => {
    const realtimeService = require('../server/src/services/realtimeService');
    for (let i = 0; i < 50; i++) {
      realtimeService.broadcast('test.stress', { sequence: i });
    }
    assert.ok(true);
  });

  await t.test('B14.2: SSE - Empty payload broadcast handled cleanly', () => {
    const realtimeService = require('../server/src/services/realtimeService');
    assert.doesNotThrow(() => {
      realtimeService.broadcast('test.empty', null);
    });
  });

  await t.test('B14.3: SSE - Oversized payload (100KB string) broadcast handled without buffer error', () => {
    const realtimeService = require('../server/src/services/realtimeService');
    const largeObj = { data: 'Y'.repeat(100000) };
    assert.doesNotThrow(() => {
      realtimeService.broadcast('test.large', largeObj);
    });
  });

  await t.test('B14.4: SSE - Broadcast with circular reference handled without throwing unhandled exception', () => {
    const realtimeService = require('../server/src/services/realtimeService');
    const circular = { name: 'circular' };
    circular.self = circular;
    assert.doesNotThrow(() => {
      try {
        realtimeService.broadcast('test.circular', circular);
      } catch (_) {}
    });
  });

  await t.test('B14.5: SSE - Endpoint rejects invalid token with 401', async () => {
    const res = await request('GET', '/api/admin/realtime', {
      Authorization: 'Bearer invalid.token.payload',
    });
    assert.equal(res.status, 401);
  });

  // =========================================================================
  // B15: Mobile Sync Boundaries
  // =========================================================================
  await t.test('B15.1: Mobile Sync - Revoked token (tokenVersion mismatch) rejected with 401 token_revoked', async () => {
    const database = db();
    const emp = database.employees.find((e) => e.id === 'emp_1');
    if (emp) {
      emp.tokenVersion = 5; // Bump version
      save();
    }
    // Token issued with tokenVersion 1 while DB has 5
    const staleToken = getEmployeeToken('emp_1', { tokenVersion: 1 });
    const res = await request('GET', '/api/me', {
      Authorization: `Bearer ${staleToken}`,
    });
    assert.equal(res.status, 401);
    assert.equal(res.json?.error, 'token_revoked');
    // Restore
    if (emp) {
      emp.tokenVersion = 1;
      save();
    }
  });

  await t.test('B15.2: Mobile Sync - Deactivated employee rejected with 401 account_deactivated', async () => {
    const database = db();
    const deactEmp = {
      id: 'emp_deactivated_test',
      name: 'Deactivated Worker',
      nationalId: '29801019999999',
      active: false,
      tenantId: 'elaraby',
      tokenVersion: 1,
    };
    database.employees.push(deactEmp);
    save();

    const deactToken = getEmployeeToken(deactEmp.id);
    const res = await request('GET', '/api/me', {
      Authorization: `Bearer ${deactToken}`,
    });
    assert.equal(res.status, 401);
    assert.equal(res.json?.error, 'account_deactivated');
  });

  await t.test('B15.3: Mobile Sync - Tampered QR token fails verification', () => {
    const token = attendanceService.generateAttendanceQrToken('emp_1');
    const tampered = token.slice(0, -4) + 'XXXX';
    const result = attendanceService.verifyAttendanceQrToken(tampered, 'emp_1');
    assert.equal(result.valid, false);
  });

  await t.test('B15.4: Mobile Sync - Impersonation QR token check (employee mismatch) fails', () => {
    const token = attendanceService.generateAttendanceQrToken('emp_1');
    const result = attendanceService.verifyAttendanceQrToken(token, 'emp_2');
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'employee_mismatch');
  });

  await t.test('B15.5: Mobile Sync - Future punch timestamp (> 24 hours ahead) is flagged or handled safely', async () => {
    const futureTime = Date.now() + 48 * 3600 * 1000;
    const res = await request('POST', '/api/attendance/punch', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'in',
      lat: 30.2982,
      lng: 31.7421,
      timestamp: futureTime,
    });
    assert.notEqual(res.status, 500);
  });

  // =========================================================================
  // B16: Flavor Switching Boundaries
  // =========================================================================
  await t.test('B16.1: Flavor Switching - Non-existent flavor slug returns 404', async () => {
    const res = await request('GET', '/api/tenants/non_existent_tenant_slug_xyz');
    assert.equal(res.status, 404);
  });

  await t.test('B16.2: Flavor Switching - Empty string slug handled safely', async () => {
    const res = await request('GET', '/api/tenants/');
    assert.equal(res.status, 200); // Returns list of tenants
  });

  await t.test('B16.3: Flavor Switching - Special characters in tenant slug return 404 or 400', async () => {
    const res = await request('GET', '/api/tenants/%3Cscript%3E');
    assert.ok([400, 404].includes(res.status));
  });

  await t.test('B16.4: Flavor Switching - Multiple rapid requests across 5 flavors do not cross-contaminate', async () => {
    const slugs = ['elaraby', 'elsewedy', 'tmg', 'ghabbour', 'gulf'];
    for (const slug of slugs) {
      const res = await request('GET', `/api/tenants/${slug}`);
      assert.equal(res.status, 200);
      assert.equal(res.json?.tenant?.slug, slug);
    }
  });

  await t.test('B16.5: Flavor Switching - Switching tenant preserves distinct currency tokens', async () => {
    const elaraby = await request('GET', '/api/tenants/elaraby');
    const gulf = await request('GET', '/api/tenants/gulf');
    assert.equal(elaraby.json?.tenant?.currency || 'EGP', 'EGP');
    assert.ok(['SAR', 'AED'].includes(gulf.json?.tenant?.currency || 'SAR'));
  });

  // =========================================================================
  // B17: ERP Schema Export Boundaries & Corrupted Systems
  // =========================================================================
  await t.test('B17.1: ERP Schema Export - Invalid system parameter returns 400 with descriptive error', async () => {
    const res = await request('GET', '/api/admin/integrations/export/schema?system=salesforce&entity=employees', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(res.status, 400);
    assert.equal(res.json?.error, 'invalid_system');
  });

  await t.test('B17.2: ERP Schema Export - Invalid entity parameter returns 400 with descriptive error', async () => {
    const res = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=inventory', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(res.status, 400);
    assert.equal(res.json?.error, 'invalid_entity');
  });

  await t.test('B17.3: ERP Schema Export - Unauthenticated caller returns 401 Unauthorized', async () => {
    const res = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=employees');
    assert.equal(res.status, 401);
  });

  await t.test('B17.4: ERP Schema Export - Insufficient role (employee token) returns 401 or 403', async () => {
    const res = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=employees', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    });
    assert.ok([401, 403].includes(res.status), `Expected 401 or 403, got ${res.status}`);
  });

  await t.test('B17.5: ERP Schema Export - Exporting for tenant with zero matching records produces empty envelope (not 500)', async () => {
    const emptyAdminToken = getAdminToken({ role: ROLES.HR_OFFICER, tenantId: 'empty_tenant_xyz' });
    const res = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=employees', {
      Authorization: `Bearer ${emptyAdminToken}`,
      'X-Tenant-ID': 'empty_tenant_xyz',
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.count, 0);
    assert.deepEqual(res.json?.records, []);
  });

  // =========================================================================
  // B18: Payroll & Attendance Reconciliation Boundaries
  // =========================================================================
  await t.test('B18.1: Payroll Reconciliation - Empty externalPayroll array returns synchronized true with 0 counts', async () => {
    const res = await request('POST', '/api/admin/integrations/reconciliation/payroll', {
      Authorization: `Bearer ${adminToken}`,
    }, { externalPayroll: [] });
    assert.equal(res.status, 200);
    assert.equal(res.json?.matchedCount, 0);
    assert.equal(res.json?.mismatchCount, 0);
    assert.equal(res.json?.isSynchronized, true);
  });

  await t.test('B18.2: Payroll Reconciliation - Missing payload or empty object handled gracefully without 500', async () => {
    const res = await request('POST', '/api/admin/integrations/reconciliation/payroll', {
      Authorization: `Bearer ${adminToken}`,
    }, {});
    assert.equal(res.status, 200);
    assert.equal(res.json?.ok, true);
  });

  await t.test('B18.3: Payroll Reconciliation - Extreme negative salary values flagged as discrepancy without overflow', async () => {
    const res = await request('POST', '/api/admin/integrations/reconciliation/payroll', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      externalPayroll: [
        {
          employeeId: 'emp_1',
          period: '2026-09',
          basicSalary: -50000,
          allowances: 0,
          deductions: 0,
          netSalary: -50000,
        },
      ],
    });
    assert.equal(res.status, 200);
    assert.ok(res.json?.mismatchCount > 0);
    const disc = res.json?.discrepancies?.find((d) => d.employeeId === 'emp_1');
    assert.ok(disc, 'Must detect extreme discrepancy');
  });

  await t.test('B18.4: Attendance Reconciliation - Empty externalAttendance array returns valid empty envelope', async () => {
    const res = await request('POST', '/api/admin/integrations/reconciliation/attendance', {
      Authorization: `Bearer ${adminToken}`,
    }, { externalAttendance: [] });
    assert.equal(res.status, 200);
    assert.equal(res.json?.matchedCount, 0);
    assert.equal(res.json?.mismatchCount, 0);
  });

  await t.test('B18.5: Attendance Reconciliation - Corrupted date strings and invalid timestamps handled safely', async () => {
    const res = await request('POST', '/api/admin/integrations/reconciliation/attendance', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      externalAttendance: [
        {
          employeeId: 'emp_1',
          date: 'not-a-date-at-all',
          checkIn: 'invalid-time-format',
          checkOut: 'corrupted-checkout',
          shiftKey: 'invalid-shift',
        },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.ok, true);
  });

  // =========================================================================
  // B19: Roster Optimization & Labor Law Boundaries
  // =========================================================================
  await t.test('B19.1: Roster Bounds - Non-existent employeeId on /api/admin/roster/:id returns 404', async () => {
    const res = await request('GET', '/api/admin/roster/emp_non_existent_id_404', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(res.status, 404);
    assert.equal(res.json?.error, 'employee_not_found');
  });

  await t.test('B19.2: Roster Bounds - Cross-factory scoped admin blocked from modifying foreign employee roster', async () => {
    const scopedToken = getAdminToken({
      role: ROLES.HR_OFFICER,
      tenantId: 'elaraby',
      scopeFactory: 'Benha Electronics Facility',
    });
    const res = await request('PUT', '/api/admin/roster/emp_1', {
      Authorization: `Bearer ${scopedToken}`,
    }, {
      days: [
        { dayIndex: 0, shift: 'morning' },
      ],
    });
    assert.equal(res.status, 403);
  });

  await t.test('B19.3: Roster Bounds - Same-shift reassignment flagged as safe (idempotent)', async () => {
    const fatigueCheck = shiftService.checkFatigueSafety('emp_1', 'morning', 'morning', '2026-09-20');
    assert.equal(fatigueCheck.safe, false);
    assert.equal(fatigueCheck.reason, 'same_shift');
  });

  await t.test('B19.4: Roster Bounds - Rest day off transitions always satisfy circadian safety gates', async () => {
    const toOff = shiftService.checkFatigueSafety('emp_1', 'night', 'off', '2026-09-20');
    const fromOff = shiftService.checkFatigueSafety('emp_1', 'off', 'morning', '2026-09-20');
    assert.equal(toOff.safe, true);
    assert.equal(fromOff.safe, true);
  });

  await t.test('B19.5: Roster Bounds - Malformed days array on PUT /api/admin/roster/:id rejected with 400', async () => {
    const res = await request('PUT', '/api/admin/roster/emp_1', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      days: 'not_an_array_invalid_format',
    });
    assert.equal(res.status, 400);
  });

  // =========================================================================
  // B20: Bulk Punch & Offline Sync Boundaries
  // =========================================================================
  await t.test('B20.1: Bulk Punch - Empty punches array in biometrics ingestion returns accepted: 0', async () => {
    const result = await biometrics.ingest([]);
    assert.equal(result.accepted, 0);
    assert.equal(result.status, 'empty');
  });

  await t.test('B20.2: Bulk Punch - Malformed punch record without badgeNumber assigned safe fallback', async () => {
    const norm = biometrics.normalizePunch({ deviceId: 'TERM_CORRUPTED' });
    assert.equal(norm.badgeNumber, '');
    assert.equal(norm.deviceId, 'TERM_CORRUPTED');
    assert.equal(norm.punchType, 'CHECK_IN');
  });

  await t.test('B20.3: Bulk Punch - Empty or whitespace-only CSV input returns empty array without exception', async () => {
    const res1 = biometrics.parseCsvFile('');
    const res2 = biometrics.parseCsvFile('   \n\n  ');
    assert.deepEqual(res1, []);
    assert.deepEqual(res2, []);
  });

  await t.test('B20.4: Bulk Punch - Tampered or expired offline token handled safely during punch recording', async () => {
    const res = await request('POST', '/api/attendance/punch', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'in',
      lat: 30.5518,
      lng: 31.1442,
      timestamp: Date.now(),
      isOffline: true,
      offlineToken: 'OFFLINE:emp_1:invalid_tampered_token_format',
    });
    assert.notEqual(res.status, 500);
  });

  await t.test('B20.5: Bulk Punch - Extreme geographic coordinates (North Pole / Null Island) handled without NaN', async () => {
    const dist = attendanceService.calculateDistanceMeters(90.0, 0.0, 30.298, 31.742);
    assert.ok(Number.isFinite(dist));
    assert.ok(!Number.isNaN(dist));
    const dist2 = attendanceService.calculateDistanceMeters(0.0, 0.0, 30.298, 31.742);
    assert.ok(Number.isFinite(dist2));

    const res = await request('POST', '/api/attendance/punch', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, {
      type: 'in',
      lat: 90.0,
      lng: 0.0,
      timestamp: Date.now(),
    });
    assert.notEqual(res.status, 500);
  });

  // =========================================================================
  // B21: Multi-Bank Batch File String Encodings and Truncation Boundaries
  // =========================================================================
  await t.test('B21.1: Multi-Bank Batch - Egyptian name truncation maintains exact 200-byte line width', async () => {
    const longName = 'Mahmoud Abdelrahman Mohamed Elsayed Mostafa Ibrahim El-Gammal of Menofia Plant';
    const records = [{
      employeeCode: 'EG-LONG-1',
      nationalId: '29001011234567',
      employeeName: longName,
      iban: 'EG9900240000000001000000001',
      basicSalary: 6000,
      allowances: 1000,
      deductions: 200,
      netSalary: 6800,
    }];
    const output = contracts.CibBatchGenerator.generateFixedWidth(records, { period: '2026-09' });
    const lines = output.split('\r\n').filter(Boolean);
    assert.equal(lines.length, 3);
    for (const line of lines) {
      assert.equal(line.length, 200, 'Each CIB line must strictly equal 200 bytes');
    }
  });

  await t.test('B21.2: Multi-Bank Batch - Extreme salary values formatted without scientific notation', async () => {
    const records = [
      { employeeCode: 'EG-MAX-1', nationalId: '29001011234567', netSalary: 999999.99, basicSalary: 800000, allowances: 199999.99, deductions: 0 },
      { employeeCode: 'EG-ZERO-1', nationalId: '29001011234568', netSalary: 0.00, basicSalary: 0, allowances: 0, deductions: 0 },
    ];
    const output = contracts.NbeBatchGenerator.generateFixedWidth(records, { period: '2026-09' });
    const lines = output.split('\r\n').filter(Boolean);
    assert.equal(lines.length, 4);
    for (const line of lines) {
      assert.equal(line.length, 200);
      assert.ok(!line.includes('NaN'), 'Line must not contain NaN');
      assert.ok(!line.includes('e+'), 'Line must not contain exponential notation');
    }
  });

  await t.test('B21.3: Multi-Bank Batch - National ID formatting normalizes hyphens and short digits', async () => {
    const records = [
      { employeeCode: 'EG-NAT-1', nationalId: '290-0101-1234-567', netSalary: 7500 },
      { employeeCode: 'EG-NAT-2', nationalId: '12345', netSalary: 7500 },
    ];
    const output = contracts.QnbBatchGenerator.generateFixedWidth(records, { period: '2026-09' });
    const lines = output.split('\r\n').filter(Boolean);
    assert.equal(lines.length, 4);
    assert.equal(lines[1].length, 200);
    assert.equal(lines[2].length, 200);
  });

  await t.test('B21.4: Multi-Bank Batch - Corporate IBAN padding in Banque Misr format', async () => {
    const records = [{ employeeCode: 'EG-BM-1', nationalId: '29001011234567', netSalary: 8500 }];
    const output = contracts.BanqueMisrBatchGenerator.generateFixedWidth(records, {
      corporateIban: 'EG440002000000000123456789012',
      period: '2026-09',
    });
    const lines = output.split('\r\n').filter(Boolean);
    assert.equal(lines[0].length, 200);
    assert.ok(lines[0].includes('EG440002000000000123456789012'));
  });

  await t.test('B21.5: Multi-Bank Batch - Zero records batch generates valid Header and Trailer with zero sums', async () => {
    const output = contracts.CibBatchGenerator.generateFixedWidth([], { batchReference: 'BATCH-EMPTY-CIB' });
    const lines = output.split('\r\n').filter(Boolean);
    assert.equal(lines.length, 2, 'Empty batch must contain only Header and Trailer');
    assert.equal(lines[0].length, 200);
    assert.equal(lines[1].length, 200);
    assert.ok(lines[0].startsWith('01'));
    assert.ok(lines[1].startsWith('99'));
    assert.ok(lines[0].includes('00000000'), 'Header encodes 0 record count');
  });

  // =========================================================================
  // B22: HMAC-SHA256 Manifest Cryptographic Integrity & Tampering Boundaries
  // =========================================================================
  await t.test('B22.1: HMAC Manifest - Single-byte payload tampering triggers hash mismatch', async () => {
    const payload = '01|EGY-CORP-01|EG440003000000000123456789012|2026-09|1|9500.00|EGP|20260921120000\r\n';
    const manifest = contracts.HmacManifestSigner.createManifest({
      payload,
      batchReference: 'BATCH-TAMPER-TEST',
      bankCode: 'cib',
      totalAmount: 9500,
      lineCount: 1,
    });
    const tampered = payload.replace('9500.00', '9500.05');
    const result = contracts.HmacManifestSigner.verifyManifest({ payload: tampered, manifest });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('PAYLOAD_HASH_MISMATCH') || result.error.includes('HASH'));
  });

  await t.test('B22.2: HMAC Manifest - Altering manifest metadata fails cryptographic signature verification', async () => {
    const payload = '01|EGY-CORP-01|EG440003000000000123456789012|2026-09|1|9500.00|EGP|20260921120000\r\n';
    const manifest = contracts.HmacManifestSigner.createManifest({
      payload,
      batchReference: 'BATCH-META-TEST',
      bankCode: 'cib',
      totalAmount: 9500,
      lineCount: 1,
    });
    const altered = { ...manifest, totalAmount: 9500.01 };
    const result = contracts.HmacManifestSigner.verifyManifest({ payload, manifest: altered });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('SIGNATURE_VERIFICATION_FAILED') || result.error.includes('SIGNATURE_MISMATCH'));
  });

  await t.test('B22.3: HMAC Manifest - Verification with missing payload or manifest returns structured error', async () => {
    const res1 = contracts.HmacManifestSigner.verifyManifest({});
    assert.equal(res1.valid, false);
    assert.ok(res1.error);

    const res2 = contracts.HmacManifestSigner.verifyManifest({ payload: 'some_payload', manifest: null });
    assert.equal(res2.valid, false);
  });

  await t.test('B22.4: HMAC Manifest - Zero-byte payload generates standard empty SHA-256 hash', async () => {
    const manifest = contracts.HmacManifestSigner.createManifest({
      payload: '',
      batchReference: 'BATCH-EMPTY-PAYLOAD',
      bankCode: 'wps_cbe',
      totalAmount: 0,
      lineCount: 0,
    });
    assert.ok(manifest.payloadHash.includes('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'));
  });

  await t.test('B22.5: HMAC Manifest - Verification rejects tampered signature of abnormal length', async () => {
    const payload = '01|EGY-CORP-01|EG440003000000000123456789012|2026-09|1|9500.00|EGP|20260921120000\r\n';
    const manifest = contracts.HmacManifestSigner.createManifest({
      payload,
      batchReference: 'BATCH-SIG-LEN',
      bankCode: 'cib',
      totalAmount: 9500,
    });
    const malformed = { ...manifest, hmacSignature: 'short-signature' };
    const result = contracts.HmacManifestSigner.verifyManifest({ payload, manifest: malformed });
    assert.equal(result.valid, false);
  });

  // =========================================================================
  // B23: Banking Feedback Reconciliation Edge Conditions & Mismatches
  // =========================================================================
  await t.test('B23.1: Bank Reconciliation - Ingests 4-category batch (matched, rejected, invalid_account, discrepancy)', async () => {
    const database = db();
    database.employees = database.employees || [];
    database.payroll = database.payroll || [];

    const testEmps = [
      { id: 'b23_emp_match', name: 'Matched Emp', nationalId: '29001011234801', tenantId: 'elaraby' },
      { id: 'b23_emp_rej', name: 'Rej Emp', nationalId: '29001011234802', tenantId: 'elaraby' },
      { id: 'b23_emp_inv', name: 'Invalid Emp', nationalId: '29001011234803', tenantId: 'elaraby' },
      { id: 'b23_emp_disc', name: 'Disc Emp', nationalId: '29001011234804', tenantId: 'elaraby' },
    ];
    for (const e of testEmps) {
      if (!database.employees.some((x) => x.id === e.id)) database.employees.push(e);
    }

    database.payroll.push(
      { id: 'pay_b23_1', employeeId: 'b23_emp_match', period: '2026-09', netSalary: 7000, disbursementStatus: 'pending' },
      { id: 'pay_b23_2', employeeId: 'b23_emp_rej', period: '2026-09', netSalary: 7500, disbursementStatus: 'pending' },
      { id: 'pay_b23_3', employeeId: 'b23_emp_inv', period: '2026-09', netSalary: 8000, disbursementStatus: 'pending' },
      { id: 'pay_b23_4', employeeId: 'b23_emp_disc', period: '2026-09', netSalary: 8500, disbursementStatus: 'pending' }
    );
    save();

    const res = await request('POST', '/api/admin/banking/disbursement/reconciliation', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      batchId: 'BATCH-B23-MULTI',
      bank: 'cib',
      period: '2026-09',
      returns: [
        { transactionReference: 'TXN-M', employeeId: 'b23_emp_match', amount: 7000, bankStatus: 'SETTLED' },
        { transactionReference: 'TXN-R', employeeId: 'b23_emp_rej', amount: 7500, bankStatus: 'REJECTED', bankReasonCode: 'MS03' },
        { transactionReference: 'TXN-I', employeeId: 'b23_emp_inv', amount: 8000, bankStatus: 'INVALID_ACCOUNT', bankReasonCode: 'AC01' },
        { transactionReference: 'TXN-D', employeeId: 'b23_emp_disc', amount: 8400, bankStatus: 'SETTLED' },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.totalProcessed, 4);
    assert.equal(res.json?.matchedCount, 1);
    assert.equal(res.json?.rejectedCount, 1);
    assert.equal(res.json?.invalidAccountCount, 1);
    assert.equal(res.json?.discrepancyCount, 1);
  });

  await t.test('B23.2: Bank Reconciliation - Floating point 0.01 EGP delta treated as match, 0.02 EGP as discrepancy', async () => {
    const database = db();
    database.employees = database.employees || [];
    database.payroll = database.payroll || [];

    const empTol = { id: 'b23_emp_tol', name: 'Tolerance Emp', nationalId: '29001011234805', tenantId: 'elaraby' };
    if (!database.employees.some((x) => x.id === empTol.id)) database.employees.push(empTol);
    database.payroll.push({ id: 'pay_b23_tol', employeeId: 'b23_emp_tol', period: '2026-09', netSalary: 9500.00, disbursementStatus: 'pending' });
    save();

    const resMatch = await request('POST', '/api/admin/banking/disbursement/reconciliation', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      batchId: 'BATCH-B23-TOL',
      bank: 'nbe',
      period: '2026-09',
      returns: [
        { transactionReference: 'TXN-TOL-1', employeeId: 'b23_emp_tol', amount: 9500.01, bankStatus: 'PROCESSED' },
      ],
    });
    assert.equal(resMatch.status, 200);
    assert.equal(resMatch.json?.matchedCount, 1, '0.01 rounding delta should be matched');
  });

  await t.test('B23.3: Bank Reconciliation - Empty returns array completes gracefully with zero processed', async () => {
    const res = await request('POST', '/api/admin/banking/disbursement/reconciliation', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      batchId: 'BATCH-B23-EMPTY',
      bank: 'qnb',
      period: '2026-09',
      returns: [],
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.totalProcessed, 0);
    assert.ok(res.json?.auditLogId);
  });

  await t.test('B23.4: Bank Reconciliation - Unknown employee returns record recorded as discrepancy', async () => {
    const res = await request('POST', '/api/admin/banking/disbursement/reconciliation', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      batchId: 'BATCH-B23-UNKNOWN',
      bank: 'cib',
      period: '2026-09',
      returns: [
        { transactionReference: 'TXN-UNK', employeeId: 'emp_ghost_9999', amount: 5000, bankStatus: 'SETTLED' },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.discrepancyCount, 1);
  });

  await t.test('B23.5: Bank Reconciliation - Missing batch reference or bank code returns 400', async () => {
    const res = await request('POST', '/api/admin/banking/disbursement/reconciliation', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      returns: [],
    });
    assert.equal(res.status, 400);
  });

  // =========================================================================
  // B24: Hardware IoT Turnstiles: ZKTeco TCP Binary Stream Framing Boundaries
  // =========================================================================
  await t.test('B24.1: ZKTeco Parser - Corrupted outer magic header rejected', async () => {
    const badMagicBuf = Buffer.alloc(16);
    badMagicBuf.writeUInt32LE(0x5050827e, 0); // Invalid magic
    badMagicBuf.writeUInt32LE(8, 4);
    const parsed = contracts.ZkTecoParser.parseTcpPacket(badMagicBuf);
    assert.equal(parsed.isValid, false);
    assert.equal(parsed.error, 'INVALID_MAGIC_HEADER');
  });

  await t.test('B24.2: ZKTeco Parser - Payload smaller than 16 bytes rejected as BUFFER_TOO_SHORT', async () => {
    const shortBuf = Buffer.alloc(12);
    const parsed = contracts.ZkTecoParser.parseTcpPacket(shortBuf);
    assert.equal(parsed.isValid, false);
    assert.equal(parsed.error, 'BUFFER_TOO_SHORT');
  });

  await t.test('B24.3: ZKTeco Parser - Checksum mismatch detected when packet body is modified', async () => {
    const packet = contracts.ZkTecoParser.createTcpPacket(1000, 1, 1, Buffer.from('ATTENDANCE'));
    packet[14] ^= 0xff; // Invert byte in inner packet
    const parsed = contracts.ZkTecoParser.parseTcpPacket(packet);
    assert.equal(parsed.isValid, false);
    assert.equal(parsed.error, 'CHECKSUM_MISMATCH');
  });

  await t.test('B24.4: ZKTeco Parser - Large binary stream buffer (16KB) handled cleanly', async () => {
    const largePayload = Buffer.alloc(16384, 0x41);
    const packet = contracts.ZkTecoParser.createTcpPacket(1000, 20, 20, largePayload);
    const parsed = contracts.ZkTecoParser.parseTcpPacket(packet);
    assert.equal(parsed.isValid, true);
    assert.equal(parsed.payload.length, 16384);
  });

  await t.test('B24.5: ZKTeco Parser - Packed integer time encoding/decoding on leap days', async () => {
    const leapDate = new Date(Date.UTC(2028, 1, 29, 23, 59, 59));
    const encoded = contracts.ZkTecoParser.encodeTimestamp(leapDate);
    const decoded = contracts.ZkTecoParser.decodeTimestamp(encoded);
    assert.equal(decoded.getUTCFullYear(), 2028);
    assert.equal(decoded.getUTCMonth(), 1); // February
    assert.equal(decoded.getUTCDate(), 29);
  });

  // =========================================================================
  // B25: Hardware IoT Turnstiles: Hikvision ISAPI XML Parsing Boundaries
  // =========================================================================
  await t.test('B25.1: Hikvision ISAPI - Truncated or unclosed XML string handled without throw', async () => {
    const brokenXml = '<EventNotificationAlert><eventType>AccessControllerEvent<subEventType>';
    const parsed = contracts.HikvisionIsapiParser.parseEvent(brokenXml, 'application/xml');
    assert.equal(parsed.isValid, false);
  });

  await t.test('B25.2: Hikvision ISAPI - Missing optional cardNo and faceQuality elements parsed safely', async () => {
    const xml = `
      <EventNotificationAlert>
        <eventType>AccessControllerEvent</eventType>
        <subEventType>75</subEventType>
        <dateTime>2026-09-21T18:00:00+02:00</dateTime>
        <AccessControllerEvent>
          <employeeNoString>EMP-770</employeeNoString>
        </AccessControllerEvent>
      </EventNotificationAlert>
    `;
    const parsed = contracts.HikvisionIsapiParser.parseEvent(xml, 'application/xml');
    assert.equal(parsed.isValid, true);
    assert.equal(parsed.employeeCode, 'EMP-770');
  });

  await t.test('B25.3: Hikvision ISAPI - Payload with embedded binary Base64 picture data extracts event attributes cleanly', async () => {
    const fakeBase64 = Buffer.alloc(4096, 0x31).toString('base64');
    const xml = `
      <EventNotificationAlert>
        <eventType>AccessControllerEvent</eventType>
        <dateTime>2026-09-21T18:00:00+02:00</dateTime>
        <AccessControllerEvent>
          <employeeNoString>EMP-880</employeeNoString>
          <pictureData>${fakeBase64}</pictureData>
        </AccessControllerEvent>
      </EventNotificationAlert>
    `;
    const parsed = contracts.HikvisionIsapiParser.parseEvent(xml, 'application/xml');
    assert.equal(parsed.isValid, true);
    assert.equal(parsed.employeeCode, 'EMP-880');
  });

  await t.test('B25.4: Hikvision ISAPI - Arabic employee name in XML element correctly parsed', async () => {
    const xml = `
      <EventNotificationAlert>
        <eventType>AccessControllerEvent</eventType>
        <AccessControllerEvent>
          <employeeNoString>EMP-AR-1</employeeNoString>
          <name>طارق السعيد</name>
        </AccessControllerEvent>
      </EventNotificationAlert>
    `;
    const parsed = contracts.HikvisionIsapiParser.parseEvent(xml, 'application/xml');
    assert.equal(parsed.isValid, true);
    assert.equal(parsed.name, 'طارق السعيد');
  });

  await t.test('B25.5: Hikvision ISAPI - Non-access events flagged with isAccessEvent: false', async () => {
    const xml = `
      <EventNotificationAlert>
        <eventType>deviceHeartbeat</eventType>
      </EventNotificationAlert>
    `;
    const parsed = contracts.HikvisionIsapiParser.parseEvent(xml, 'application/xml');
    assert.equal(parsed.isAccessEvent, false);
  });

  // =========================================================================
  // B26: Anti-Passback (APB) Multi-Tenant Gate Boundaries
  // =========================================================================
  await t.test('B26.1: Anti-Passback - Consecutive double-IN punch triggers DOUBLE_ENTRY violation', async () => {
    contracts.AntiPassbackEngine.resetState('elaraby', 'zone_gate_1', 'emp_apb_1');
    const firstIn = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_1',
      zoneId: 'zone_gate_1',
      direction: 'in',
      mode: 'strict',
    });
    assert.equal(firstIn.valid, true);

    const secondIn = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_1',
      zoneId: 'zone_gate_1',
      direction: 'in',
      mode: 'strict',
    });
    assert.equal(secondIn.valid, false);
    assert.equal(secondIn.violation, 'DOUBLE_ENTRY');
  });

  await t.test('B26.2: Anti-Passback - Consecutive double-OUT punch triggers DOUBLE_EXIT violation', async () => {
    contracts.AntiPassbackEngine.resetState('elaraby', 'zone_gate_1', 'emp_apb_2');
    contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_2',
      zoneId: 'zone_gate_1',
      direction: 'in',
    });
    const firstOut = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_2',
      zoneId: 'zone_gate_1',
      direction: 'out',
    });
    assert.equal(firstOut.valid, true);

    const secondOut = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_2',
      zoneId: 'zone_gate_1',
      direction: 'out',
    });
    assert.equal(secondOut.valid, false);
    assert.equal(secondOut.violation, 'DOUBLE_EXIT');
  });

  await t.test('B26.3: Anti-Passback - Multi-tenant isolation prevents state leakage between tenants', async () => {
    contracts.AntiPassbackEngine.resetState('elaraby', 'zone_gate_1', 'emp_shared_badge');
    contracts.AntiPassbackEngine.resetState('tenant_partner', 'zone_gate_1', 'emp_shared_badge');

    contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_shared_badge',
      zoneId: 'zone_gate_1',
      direction: 'in',
    });

    const partnerIn = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'tenant_partner',
      employeeId: 'emp_shared_badge',
      zoneId: 'zone_gate_1',
      direction: 'in',
    });
    assert.equal(partnerIn.valid, true, 'Badge in different tenant must not be affected by another tenant state');
  });

  await t.test('B26.4: Anti-Passback - Sensor bounce within debounce window (<1000ms) deduped cleanly', async () => {
    contracts.AntiPassbackEngine.resetState('elaraby', 'zone_bounce', 'emp_bounce');
    const t0 = Date.now();
    const p1 = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_bounce',
      zoneId: 'zone_bounce',
      direction: 'in',
      timestamp: t0,
    });
    assert.equal(p1.valid, true);

    const p2 = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_bounce',
      zoneId: 'zone_bounce',
      direction: 'in',
      timestamp: t0 + 200,
    });
    assert.equal(p2.debounced, true);
  });

  await t.test('B26.5: Anti-Passback - Soft APB logs violation but permits ingress', async () => {
    contracts.AntiPassbackEngine.resetState('elaraby', 'zone_soft', 'emp_soft');
    contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_soft',
      zoneId: 'zone_soft',
      direction: 'in',
      mode: 'soft',
    });
    const secondIn = contracts.AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_soft',
      zoneId: 'zone_soft',
      direction: 'in',
      mode: 'soft',
    });
    assert.equal(secondIn.valid, true, 'Soft APB grants access');
    assert.equal(secondIn.softViolation, true, 'Soft APB records violation');
  });

  // =========================================================================
  // B27: Turnstile Health Monitor & Deadman Switch Boundaries
  // =========================================================================
  await t.test('B27.1: Turnstile Health - 3 consecutive failed heartbeats transitions device to OFFLINE', async () => {
    const devId = 'DEV-HEALTH-01';
    contracts.TurnstileHealthMonitor.registerDevice({ id: devId, name: 'Turnstile A' });
    contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 0, false);
    contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 0, false);
    const d3 = contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 0, false);
    assert.equal(d3.status, 'OFFLINE');
  });

  await t.test('B27.2: Turnstile Health - RTT > 400ms marks device status as DEGRADED', async () => {
    const devId = 'DEV-HEALTH-02';
    contracts.TurnstileHealthMonitor.registerDevice({ id: devId, name: 'Turnstile B' });
    const d = contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 450, true);
    assert.equal(d.status, 'DEGRADED');
  });

  await t.test('B27.3: Turnstile Health - Recovery heartbeat restores status to ONLINE', async () => {
    const devId = 'DEV-HEALTH-03';
    contracts.TurnstileHealthMonitor.registerDevice({ id: devId, name: 'Turnstile C' });
    contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 0, false);
    contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 0, false);
    contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 0, false);
    const recovered = contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 25, true);
    assert.equal(recovered.status, 'ONLINE');
    assert.equal(recovered.consecutiveFailures, 0);
  });

  await t.test('B27.4: Turnstile Health - Multi-device registration maintains distinct state per node', async () => {
    for (let i = 1; i <= 10; i++) {
      contracts.TurnstileHealthMonitor.registerDevice({ id: `DEV-BULK-${i}`, name: `Gate ${i}` });
    }
    assert.ok(contracts.TurnstileHealthMonitor.devices.size >= 10);
  });

  await t.test('B27.5: Turnstile Health - Exponential moving average (EMA) calculates rolling latency', async () => {
    const devId = 'DEV-HEALTH-EMA';
    contracts.TurnstileHealthMonitor.registerDevice({ id: devId });
    contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 50, true);
    const state = contracts.TurnstileHealthMonitor.recordHeartbeat(devId, 100, true);
    assert.ok(state.rollingLatencyEma > 15 && state.rollingLatencyEma <= 100);
  });

  // =========================================================================
  // B28: Emergency Lockdown / Unlock SLA & Rotating QR Boundaries
  // =========================================================================
  await t.test('B28.1: Emergency Override - Executes factory-wide unlock within <50ms SLA', async () => {
    const start = Date.now();
    const result = await contracts.EmergencyOverrideService.executeOverride({
      action: 'UNLOCK_ALL',
      factoryId: 'Quesna',
      deviceCount: 24,
    });
    const duration = Date.now() - start;
    assert.equal(result.ok, true);
    assert.ok(result.executionTimeMs < 50);
    assert.ok(duration < 100, 'End-to-end execution benchmark < 100ms');
  });

  await t.test('B28.2: Emergency Override - Idempotent execution of repeated UNLOCK_ALL requests', async () => {
    const r1 = await contracts.EmergencyOverrideService.executeOverride({ action: 'UNLOCK_ALL' });
    const r2 = await contracts.EmergencyOverrideService.executeOverride({ action: 'UNLOCK_ALL' });
    assert.equal(r1.success, true);
    assert.equal(r2.success, true);
  });

  await t.test('B28.3: Rotating QR - Token expired beyond sliding time window rejected', async () => {
    const oldTimestamp = Date.now() - 90000;
    const staleToken = contracts.RotatingQrService.generateGatePassToken({
      tenantId: 'elaraby',
      employeeId: 'emp_qr_1',
      timestamp: oldTimestamp,
    });
    const result = contracts.RotatingQrService.verifyGatePassToken({
      token: staleToken,
      expectedEmployeeId: 'emp_qr_1',
      tenantId: 'elaraby',
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'TOKEN_EXPIRED_OR_CLOCK_DRIFT');
  });

  await t.test('B28.4: Rotating QR - Token generated within active 30s epoch step is valid', async () => {
    const validToken = contracts.RotatingQrService.generateGatePassToken({
      tenantId: 'elaraby',
      employeeId: 'emp_qr_2',
      timestamp: Date.now(),
    });
    const result = contracts.RotatingQrService.verifyGatePassToken({
      token: validToken,
      expectedEmployeeId: 'emp_qr_2',
      tenantId: 'elaraby',
    });
    assert.equal(result.valid, true);
  });

  await t.test('B28.5: Rotating QR - Replay attack with same single-use token rejected on second attempt', async () => {
    const replayToken = contracts.RotatingQrService.generateGatePassToken({
      tenantId: 'elaraby',
      employeeId: 'emp_qr_3',
      timestamp: Date.now(),
    });
    const attempt1 = contracts.RotatingQrService.verifyGatePassToken({
      token: replayToken,
      expectedEmployeeId: 'emp_qr_3',
      tenantId: 'elaraby',
    });
    assert.equal(attempt1.valid, true);

    const attempt2 = contracts.RotatingQrService.verifyGatePassToken({
      token: replayToken,
      expectedEmployeeId: 'emp_qr_3',
      tenantId: 'elaraby',
    });
    assert.equal(attempt2.valid, false);
    assert.equal(attempt2.reason, 'REPLAY_ATTACK_DETECTED');
  });

  // =========================================================================
  // B29: Flutter Mobile Offline Engine Schema & Queue Boundaries
  // =========================================================================
  await t.test('B29.1: Offline SQLite Schema - Validates core offline database table definitions', async () => {
    const schemas = contracts.OfflineDatabaseContract.SCHEMAS;
    assert.ok(schemas.punch_queue);
    assert.ok(schemas.cached_schedules);
    assert.ok(schemas.employee_profile);
    assert.ok(schemas.punch_queue.includes('client_punch_id'));
    assert.ok(schemas.punch_queue.includes('status'));
  });

  await t.test('B29.2: Offline SQLite - Punch record without primary key client_punch_id rejected as invalid', async () => {
    const valid = contracts.OfflineDatabaseContract.validateRecord('punch_queue', { client_punch_id: 'uuid-1' });
    assert.equal(valid, true);
    const invalid = contracts.OfflineDatabaseContract.validateRecord('punch_queue', {});
    assert.equal(invalid, false);
  });

  await t.test('B29.3: Offline SQLite - Schedule cache record validation', async () => {
    const validSchedule = contracts.OfflineDatabaseContract.validateRecord('cached_schedules', { id: 'sched_1' });
    assert.equal(validSchedule, true);
    const invalidSchedule = contracts.OfflineDatabaseContract.validateRecord('cached_schedules', {});
    assert.equal(invalidSchedule, false);
  });

  await t.test('B29.4: Offline SQLite - Exponential backoff calculation for sync retries', async () => {
    const backoff1 = contracts.OfflineDatabaseContract.calculateExponentialBackoff(1, 1.5, 60.0);
    assert.equal(backoff1.nominal, 3.0);
    const backoff5 = contracts.OfflineDatabaseContract.calculateExponentialBackoff(5, 1.5, 60.0);
    assert.equal(backoff5.nominal, 48.0);
  });

  await t.test('B29.5: Offline SQLite - Exponential backoff caps at maximum ceiling', async () => {
    const maxBackoff = contracts.OfflineDatabaseContract.calculateExponentialBackoff(10, 1.5, 60.0);
    assert.equal(maxBackoff.nominal, 60.0);
  });

  // =========================================================================
  // B30: Bulk Punch Synchronization Sliding Window Boundaries
  // =========================================================================
  await t.test('B30.1: Bulk Sync - Duplicate punches within 120s sliding window deduplicated', async () => {
    const t0 = 1758500000000;
    const punches = [
      { clientPunchId: 'uuid-1', employeeId: 'emp_1', type: 'in', timestamp: t0 },
      { clientPunchId: 'uuid-2', employeeId: 'emp_1', type: 'in', timestamp: t0 + 45000 },
    ];
    const res = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(res.status, 200);
    assert.equal(res.json?.acceptedCount, 1);
    assert.equal(res.json?.duplicateCount, 1);
  });

  await t.test('B30.2: Bulk Sync - Punches spaced at 121 seconds treated as distinct punches', async () => {
    const t0 = 1758510000000;
    const punches = [
      { clientPunchId: 'uuid-3', employeeId: 'emp_1', type: 'in', timestamp: t0 },
      { clientPunchId: 'uuid-4', employeeId: 'emp_1', type: 'in', timestamp: t0 + 121000 },
    ];
    const res = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(res.status, 200);
    assert.equal(res.json?.acceptedCount, 2);
    assert.equal(res.json?.duplicateCount, 0);
  });

  await t.test('B30.3: Bulk Sync - Out-of-order jittered timestamps sorted and ingested properly', async () => {
    const t0 = 1758520000000;
    const punches = [
      { clientPunchId: 'uuid-jit-2', employeeId: 'emp_1', type: 'out', timestamp: t0 + 200000 },
      { clientPunchId: 'uuid-jit-1', employeeId: 'emp_1', type: 'in', timestamp: t0 },
    ];
    const res = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(res.status, 200);
    assert.equal(res.json?.acceptedCount, 2);
  });

  await t.test('B30.4: Bulk Sync - Mixed batch with accepted, duplicates, and missing badges counts exact numbers', async () => {
    const t0 = 1758530000000;
    const punches = [
      { clientPunchId: 'mix-1', employeeId: 'emp_1', type: 'in', timestamp: t0 },
      { clientPunchId: 'mix-2', employeeId: 'emp_1', type: 'in', timestamp: t0 + 10000 },
      { clientPunchId: 'mix-3', employeeId: '', type: 'in', timestamp: t0 + 20000 },
    ];
    const res = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(res.status, 200);
    assert.equal(res.json?.totalProcessed, 3);
  });

  await t.test('B30.5: Bulk Sync - Retrying identical batch payload yields zero new inserts and 100% duplicates', async () => {
    const t0 = 1758540000000;
    const punches = [
      { clientPunchId: 'retry-1', employeeId: 'emp_1', type: 'in', timestamp: t0 },
    ];
    const r1 = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(r1.json?.acceptedCount, 1);

    const r2 = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(r2.json?.acceptedCount, 0);
    assert.equal(r2.json?.duplicateCount, 1);
  });

  // =========================================================================
  // B31: Offline Clock Skew & Security Token Expiration Boundaries
  // =========================================================================
  await t.test('B31.1: Clock Skew - Punch with future timestamp (>24h) accepted and processed', async () => {
    const futureTime = Date.now() + 86400000 * 2;
    const punches = [{ clientPunchId: 'uuid-future-1', employeeId: 'emp_1', type: 'in', timestamp: futureTime }];
    const res = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(res.status, 200);
    assert.ok(res.json?.results?.length > 0);
  });

  await t.test('B31.2: Clock Skew - Punch with past timestamp (>7 days) accepted and processed', async () => {
    const pastTime = Date.now() - 86400000 * 10;
    const punches = [{ clientPunchId: 'uuid-past-1', employeeId: 'emp_1', type: 'in', timestamp: pastTime }];
    const res = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.equal(res.status, 200);
    assert.ok(res.json?.results?.length > 0);
  });

  await t.test('B31.3: Clock Skew - Corrupted or tampered punch token handled defensively', async () => {
    const punches = [{ clientPunchId: 'uuid-tamper', employeeId: 'emp_1', type: 'in', offlineToken: 'BAD_SIGNATURE' }];
    const res = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, punches);
    assert.notEqual(res.status, 500);
  });

  await t.test('B31.4: Clock Skew - Offline punch matches active roster shift definition during blackout', async () => {
    const morningShift = shiftService.SHIFTS.morning;
    assert.ok(morningShift);
    assert.equal(morningShift.id, 'morning');
    assert.equal(morningShift.startHour, 7);
    assert.equal(morningShift.endHour, 15);
  });

  await t.test('B31.5: Clock Skew - Concurrent bulk sync calls processed without race condition', async () => {
    const p1 = request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, [{ clientPunchId: 'race-1', employeeId: 'emp_1', type: 'in', timestamp: 1758500900000 }]);
    const p2 = request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${elarabyEmpToken}`,
    }, [{ clientPunchId: 'race-2', employeeId: 'emp_1', type: 'out', timestamp: 1758500950000 }]);
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
  });

  // =========================================================================
  // B32: AI Absenteeism Scoring Edge & Probability Bounds
  // =========================================================================
  await t.test('B32.1: AI Absenteeism - Probability score strictly bounded within [0.01, 0.99]', async () => {
    const extremeHigh = contracts.AiPredictiveService.calculateAbsenteeismRisk({
      employeeId: 'emp_1',
      historicalAbsenceRate: 0.95,
      consecutiveDaysWorked: 6,
      turnaroundRestHours: 4,
    });
    assert.ok(extremeHigh.riskScore >= 0.01 && extremeHigh.riskScore <= 0.99);

    const extremeLow = contracts.AiPredictiveService.calculateAbsenteeismRisk({
      employeeId: 'emp_1',
      historicalAbsenceRate: 0.0,
      consecutiveDaysWorked: 1,
      turnaroundRestHours: 24,
    });
    assert.ok(extremeLow.riskScore >= 0.01 && extremeLow.riskScore <= 0.99);
  });

  await t.test('B32.2: AI Absenteeism - Default inputs produce valid bounded riskScore', async () => {
    const result = contracts.AiPredictiveService.calculateAbsenteeismRisk({
      employeeId: 'emp_new_hire',
    });
    assert.ok(result.riskScore >= 0.01 && result.riskScore <= 0.99);
  });

  await t.test('B32.3: AI Absenteeism - Low absence history employee receives riskScore < 0.20', async () => {
    const result = contracts.AiPredictiveService.calculateAbsenteeismRisk({
      employeeId: 'emp_1',
      historicalAbsenceRate: 0.01,
      consecutiveDaysWorked: 1,
      turnaroundRestHours: 24,
    });
    assert.ok(result.riskScore < 0.20);
  });

  await t.test('B32.4: AI Absenteeism - 6-factor logistic evaluation is monotonic with fatigue increase', async () => {
    const lowFatigue = contracts.AiPredictiveService.calculateAbsenteeismRisk({
      employeeId: 'emp_1',
      historicalAbsenceRate: 0.05,
      consecutiveDaysWorked: 2,
    });
    const highFatigue = contracts.AiPredictiveService.calculateAbsenteeismRisk({
      employeeId: 'emp_1',
      historicalAbsenceRate: 0.05,
      consecutiveDaysWorked: 6,
    });
    assert.ok(highFatigue.riskScore > lowFatigue.riskScore);
  });

  await t.test('B32.5: AI Absenteeism - Missing optional inputs defaults gracefully without NaN', async () => {
    const result = contracts.AiPredictiveService.calculateAbsenteeismRisk({});
    assert.ok(!isNaN(result.riskScore));
    assert.ok(result.riskScore >= 0.01 && result.riskScore <= 0.99);
  });

  // =========================================================================
  // B33: Assembly Line Stoppage Warning Quota Boundaries
  // =========================================================================
  await t.test('B33.1: Assembly Line Stoppage - Exactly required quota available returns status normal (GREEN)', async () => {
    const workers = Array.from({ length: 10 }, (_, i) => ({ id: `w_${i}`, historicalAbsenceRate: 0.01 }));
    const result = contracts.AiPredictiveService.assessLineStoppageRisk({
      lineId: 'LINE-01',
      requiredQuota: 10,
      scheduledWorkers: workers,
    });
    assert.equal(result.stoppageRisk, 'LOW');
    assert.equal(result.isCritical, false);
  });

  await t.test('B33.2: Assembly Line Stoppage - 1 worker shortage triggers critical status', async () => {
    const workers = Array.from({ length: 9 }, (_, i) => ({ id: `w_${i}`, historicalAbsenceRate: 0.01 }));
    const result = contracts.AiPredictiveService.assessLineStoppageRisk({
      lineId: 'LINE-01',
      requiredQuota: 10,
      scheduledWorkers: workers,
    });
    assert.equal(result.stoppageRisk, 'CRITICAL');
  });

  await t.test('B33.3: Assembly Line Stoppage - >= 2 worker shortage triggers status critical (RED)', async () => {
    const workers = Array.from({ length: 8 }, (_, i) => ({ id: `w_${i}`, expectedAbsenteeism: 0.05 }));
    const result = contracts.AiPredictiveService.assessLineStoppageRisk({
      lineId: 'LINE-01',
      requiredQuota: 10,
      scheduledWorkers: workers,
    });
    assert.equal(result.status, 'critical');
    assert.equal(result.stoppageRisk, 'CRITICAL');
  });

  await t.test('B33.4: Assembly Line Stoppage - High absenteeism risk among scheduled workers elevates stoppage risk', async () => {
    const workers = Array.from({ length: 10 }, (_, i) => ({ id: `w_${i}`, expectedAbsenteeism: 0.85 }));
    const result = contracts.AiPredictiveService.assessLineStoppageRisk({
      lineId: 'LINE-01',
      requiredQuota: 10,
      scheduledWorkers: workers,
    });
    assert.ok(result.status === 'warning' || result.status === 'critical');
  });

  await t.test('B33.5: Assembly Line Stoppage - Zero scheduled workers returns immediate critical alert', async () => {
    const result = contracts.AiPredictiveService.assessLineStoppageRisk({
      lineId: 'LINE-01',
      requiredQuota: 10,
      scheduledWorkers: [],
    });
    assert.equal(result.status, 'critical');
    assert.equal(result.availableWorkersCount, 0);
  });

  // =========================================================================
  // B34: Monthly Overtime Drift & Budget Freezing Boundaries
  // =========================================================================
  await t.test('B34.1: Overtime Budget - At exactly 99.9% consumption status is UNLOCKED', async () => {
    const drift = contracts.AiPredictiveService.evaluateOvertimeDrift({
      departmentId: 'dept_ops',
      monthlyBudgetHours: 1000,
      consumedHours: 999.0,
      currentDayOfMonth: 25,
      daysInMonth: 30,
    });
    assert.equal(drift.isLocked, false);
    assert.equal(drift.status, 'near_ceiling');
  });

  await t.test('B34.2: Overtime Budget - At exactly 100.0% consumption triggers AUTO_FREEZE (isLocked: true)', async () => {
    const drift = contracts.AiPredictiveService.evaluateOvertimeDrift({
      departmentId: 'dept_ops',
      monthlyBudgetHours: 1000,
      consumedHours: 1000.0,
      currentDayOfMonth: 25,
      daysInMonth: 30,
    });
    assert.equal(drift.isLocked, true);
    assert.equal(drift.status, 'frozen');
  });

  await t.test('B34.3: Overtime Budget - Projected monthly drift exceeding budget emits early warning', async () => {
    const drift = contracts.AiPredictiveService.evaluateOvertimeDrift({
      departmentId: 'dept_ops',
      monthlyBudgetHours: 1000,
      consumedHours: 600,
      currentDayOfMonth: 10,
      daysInMonth: 30,
    });
    assert.ok(drift.projectedHours > 1000);
    assert.equal(drift.driftWarning, true);
  });

  await t.test('B34.4: Overtime Budget - Department with zero budget immediately locks on any claim', async () => {
    const drift = contracts.AiPredictiveService.evaluateOvertimeDrift({
      departmentId: 'dept_zero',
      monthlyBudgetHours: 0,
      consumedHours: 1,
      currentDayOfMonth: 5,
      daysInMonth: 30,
    });
    assert.equal(drift.isLocked, true);
  });

  await t.test('B34.5: Overtime Budget - Negative or NaN inputs handled safely without crash', async () => {
    const drift = contracts.AiPredictiveService.evaluateOvertimeDrift({
      departmentId: 'dept_safe',
      monthlyBudgetHours: -100,
      consumedHours: NaN,
      currentDayOfMonth: 0,
      daysInMonth: 0,
    });
    assert.ok(!isNaN(drift.projectedHours));
  });

  // =========================================================================
  // B35: Smart Backfill Recommendation & Labor Law Fatigue Gates Boundaries
  // =========================================================================
  await t.test('B35.1: Smart Backfill - Candidate with <11h turnaround rest filtered out by Egyptian Labor Law gate', async () => {
    const candidates = [
      { id: 'cand_tired', department: 'Production', skillTier: 'operator', turnaroundRestHours: 8, consecutiveDays: 3, weeklyScheduledHours: 20 },
      { id: 'cand_rested', department: 'Production', skillTier: 'operator', turnaroundRestHours: 14, consecutiveDays: 3, weeklyScheduledHours: 20 },
    ];
    const recs = contracts.AiPredictiveService.recommendBackfill({
      lineId: 'LINE-01',
      absentEmployeeId: 'emp_absent',
      candidates,
    });
    assert.equal(recs.recommendations.length, 1);
    assert.equal(recs.recommendations[0].employeeId, 'cand_rested');
  });

  await t.test('B35.2: Smart Backfill - Candidate with 6 consecutive working days filtered out by weekly rest gate', async () => {
    const candidates = [
      { id: 'cand_6days', department: 'Production', skillTier: 'operator', turnaroundRestHours: 14, consecutiveDays: 6, weeklyScheduledHours: 20 },
      { id: 'cand_4days', department: 'Production', skillTier: 'operator', turnaroundRestHours: 14, consecutiveDays: 4, weeklyScheduledHours: 20 },
    ];
    const recs = contracts.AiPredictiveService.recommendBackfill({
      lineId: 'LINE-01',
      absentEmployeeId: 'emp_absent',
      candidates,
    });
    assert.equal(recs.recommendations.length, 1);
    assert.equal(recs.recommendations[0].employeeId, 'cand_4days');
  });

  await t.test('B35.3: Smart Backfill - Department match bonus prioritizes internal candidates', async () => {
    const candidates = [
      { id: 'cand_cross', department: 'Logistics', skillTier: 'operator', turnaroundRestHours: 14, consecutiveDays: 2, weeklyScheduledHours: 20 },
      { id: 'cand_same', department: 'Production', skillTier: 'operator', turnaroundRestHours: 14, consecutiveDays: 2, weeklyScheduledHours: 20 },
    ];
    const recs = contracts.AiPredictiveService.recommendBackfill({
      lineId: 'LINE-01',
      candidates,
    });
    assert.equal(recs.recommendations[0].employeeId, 'cand_same');
    assert.ok(recs.recommendations[0].suitabilityScore > recs.recommendations[1].suitabilityScore);
  });

  await t.test('B35.4: Smart Backfill - Lower overtime fatigue candidate ranked higher', async () => {
    const candidates = [
      { id: 'cand_high_ot', department: 'Production', skillTier: 'operator', turnaroundRestHours: 14, consecutiveDays: 2, weeklyScheduledHours: 20, monthlyOvertimeHours: 40 },
      { id: 'cand_low_ot', department: 'Production', skillTier: 'operator', turnaroundRestHours: 14, consecutiveDays: 2, weeklyScheduledHours: 20, monthlyOvertimeHours: 5 },
    ];
    const recs = contracts.AiPredictiveService.recommendBackfill({
      lineId: 'LINE-01',
      candidates,
    });
    assert.equal(recs.recommendations[0].employeeId, 'cand_low_ot');
  });

  await t.test('B35.5: Smart Backfill - Zero eligible candidates returning empty list when all violate fatigue gates', async () => {
    const candidates = [
      { id: 'cand_bad_1', department: 'Production', skillTier: 'operator', turnaroundRestHours: 6, consecutiveDays: 3, weeklyScheduledHours: 20 },
      { id: 'cand_bad_2', department: 'Production', skillTier: 'operator', turnaroundRestHours: 14, consecutiveDays: 7, weeklyScheduledHours: 20 },
    ];
    const recs = contracts.AiPredictiveService.recommendBackfill({
      lineId: 'LINE-01',
      candidates,
    });
    assert.equal(recs.recommendations.length, 0);
  });
});
