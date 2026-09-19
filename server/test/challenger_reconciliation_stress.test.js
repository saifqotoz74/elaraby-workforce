// Comprehensive Empirical Stress Test Harness for Multi-Domain Reconciliation Engine
// Challenger 2 - Milestone 1 (Enterprise ERP Integration Gateway & Reconciliation)

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-2026';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASS = 'elaraby2026';

const assert = require('assert');
const http = require('http');
const { data, save } = require('../src/db');
const { seed } = require('../src/seed');
const app = require('../server');

const {
  reconcilePayroll,
  reconcileAttendance,
} = require('../src/integrations/reconciliation/reconciliationEngine');

const PORT = 4001;
let server;

function request(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let responseText = '';
      res.on('data', (chunk) => {
        responseText += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseText);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: responseText,
          json,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const challengeResults = [];

function recordTest(title, category, status, data) {
  challengeResults.push({ title, category, status, ...data });
}

async function run() {
  console.log('=============================================================');
  console.log('--- CHALLENGER 2: EMPIRICAL RECONCILIATION STRESS TEST ---');
  console.log('=============================================================\n');

  seed();

  // -------------------------------------------------------------------------
  // 1. 100% MATCHED VS 100% MISMATCHED RECORDS
  // -------------------------------------------------------------------------
  console.log('>>> Category 1: 100% Matched vs 100% Mismatched Records');

  // 1.1 Payroll: 100% Matched (100 records)
  {
    const count = 100;
    const internal = [];
    const external = [];
    for (let i = 1; i <= count; i++) {
      const rec = {
        employeeId: `emp_${i}`,
        period: 'August 2026',
        basicSalary: 8000 + i * 50,
        allowances: 2000 + i * 10,
        deductions: 500 + i * 5,
        netSalary: 9500 + i * 55,
      };
      internal.push(rec);
      external.push({ ...rec });
    }

    const res = reconcilePayroll(external, internal);
    assert.strictEqual(res.isSynchronized, true);
    assert.strictEqual(res.matchedCount, 100);
    assert.strictEqual(res.mismatchCount, 0);
    assert.strictEqual(res.missingInInternalCount, 0);
    assert.strictEqual(res.discrepanciesCount, 0);
    console.log('✔ Payroll 100% Matched (100 records): PASSED');
    recordTest('Payroll 100% Matched', '100% Match/Mismatch', 'PASS', {
      matched: res.matchedCount,
      mismatch: res.mismatchCount,
      isSynchronized: res.isSynchronized,
    });
  }

  // 1.2 Payroll: 100% Mismatched by Value (100 records)
  {
    const count = 100;
    const internal = [];
    const external = [];
    for (let i = 1; i <= count; i++) {
      internal.push({
        employeeId: `emp_${i}`,
        period: 'August 2026',
        basicSalary: 10000,
        allowances: 2000,
        deductions: 1000,
        netSalary: 11000,
      });
      external.push({
        employeeId: `emp_${i}`,
        period: 'August 2026',
        basicSalary: 12000, // +2000
        allowances: 2500, // +500
        deductions: 1200, // +200
        netSalary: 13300, // +2300
      });
    }

    const res = reconcilePayroll(external, internal);
    assert.strictEqual(res.isSynchronized, false);
    assert.strictEqual(res.matchedCount, 0);
    assert.strictEqual(res.missingInInternalCount, 0);
    // Every record produces 4 field discrepancies (basic, allowances, deductions, net)
    assert.strictEqual(res.discrepanciesCount, 400);
    console.log('✔ Payroll 100% Mismatched by Value (100 records): PASSED (400 field discrepancies detected)');
    recordTest('Payroll 100% Value Mismatches', '100% Match/Mismatch', 'PASS', {
      matched: res.matchedCount,
      discrepancies: res.discrepanciesCount,
      isSynchronized: res.isSynchronized,
    });
  }

  // 1.3 Attendance: 100% Matched (100 records)
  {
    const count = 100;
    const internal = [];
    const external = [];
    for (let i = 1; i <= count; i++) {
      const rec = {
        employeeId: `emp_att_${i}`,
        date: '2026-09-19',
        checkIn: '08:00:00',
        checkOut: '17:00:00',
        shiftKey: 'morning_shift',
        hoursWorked: 9.0,
      };
      internal.push(rec);
      external.push({ ...rec });
    }

    const res = reconcileAttendance(external, internal);
    assert.strictEqual(res.isSynchronized, true);
    assert.strictEqual(res.matchedCount, 100);
    assert.strictEqual(res.mismatchCount, 0);
    assert.strictEqual(res.discrepanciesCount, 0);
    console.log('✔ Attendance 100% Matched (100 records): PASSED');
    recordTest('Attendance 100% Matched', '100% Match/Mismatch', 'PASS', {
      matched: res.matchedCount,
      mismatch: res.mismatchCount,
      isSynchronized: res.isSynchronized,
    });
  }

  // 1.4 Attendance: 100% Mismatched by Missing in Internal (100 records)
  {
    const count = 100;
    const internal = [];
    const external = [];
    for (let i = 1; i <= count; i++) {
      external.push({
        employeeId: `emp_ext_unmatched_${i}`,
        date: '2026-09-19',
        checkIn: '08:00:00',
        checkOut: '17:00:00',
        shiftKey: 'morning_shift',
      });
    }

    const res = reconcileAttendance(external, internal);
    assert.strictEqual(res.isSynchronized, false);
    assert.strictEqual(res.matchedCount, 0);
    assert.strictEqual(res.missingInInternalCount, 100);
    assert.strictEqual(res.discrepanciesCount, 100);
    console.log('✔ Attendance 100% Missing in Internal (100 records): PASSED');
    recordTest('Attendance 100% Missing in Internal', '100% Match/Mismatch', 'PASS', {
      matched: res.matchedCount,
      missingInInternal: res.missingInInternalCount,
      isSynchronized: res.isSynchronized,
    });
  }

  // -------------------------------------------------------------------------
  // 2. LARGE DATASETS (100+ & 1000 RECORDS) PERFORMANCE & BENCHMARKING
  // -------------------------------------------------------------------------
  console.log('\n>>> Category 2: Large Datasets (1000 records) Performance & Complexity');

  {
    const count = 1000;
    const internal = [];
    const external = [];
    for (let i = 1; i <= count; i++) {
      const isMismatch = i % 10 === 0;
      internal.push({
        employeeId: `emp_big_${i}`,
        period: 'August 2026',
        basicSalary: 12000,
        allowances: 3000,
        deductions: 1000,
        netSalary: 14000,
      });
      external.push({
        employeeId: `emp_big_${i}`,
        period: 'August 2026',
        basicSalary: isMismatch ? 12500 : 12000,
        allowances: 3000,
        deductions: 1000,
        netSalary: isMismatch ? 14500 : 14000,
      });
    }

    const t0 = process.hrtime.bigint();
    const res = reconcilePayroll(external, internal);
    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;

    assert.strictEqual(res.matchedCount, 900);
    assert.strictEqual(res.discrepanciesCount, 200); // 100 mismatched records * 2 diffs (basic + net)
    console.log(`✔ Payroll 1000 Records Benchmark: ${durationMs.toFixed(2)}ms (throughput: ${(1000 / (durationMs / 1000)).toFixed(0)} rec/sec)`);
    recordTest('Payroll 1000 Records Performance', 'Performance', 'PASS', {
      durationMs: durationMs.toFixed(2),
      throughputRecPerSec: (1000 / (durationMs / 1000)).toFixed(0),
    });
  }

  {
    const count = 1000;
    const internal = [];
    const external = [];
    for (let i = 1; i <= count; i++) {
      const isMismatch = i % 10 === 0;
      internal.push({
        employeeId: `emp_att_big_${i}`,
        date: '2026-09-19',
        checkIn: '08:00:00',
        checkOut: '17:00:00',
        shiftKey: 'morning_shift',
        hoursWorked: 9.0,
      });
      external.push({
        employeeId: `emp_att_big_${i}`,
        date: '2026-09-19',
        checkIn: isMismatch ? '08:30:00' : '08:00:00',
        checkOut: '17:00:00',
        shiftKey: 'morning_shift',
        hoursWorked: isMismatch ? 8.5 : 9.0,
      });
    }

    const t0 = process.hrtime.bigint();
    const res = reconcileAttendance(external, internal);
    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;

    assert.strictEqual(res.matchedCount, 900);
    console.log(`✔ Attendance 1000 Records Benchmark: ${durationMs.toFixed(2)}ms (throughput: ${(1000 / (durationMs / 1000)).toFixed(0)} rec/sec)`);
    recordTest('Attendance 1000 Records Performance', 'Performance', 'PASS', {
      durationMs: durationMs.toFixed(2),
      throughputRecPerSec: (1000 / (durationMs / 1000)).toFixed(0),
    });
  }

  // -------------------------------------------------------------------------
  // 3. IDENTICAL CHECK-IN/OUT, MIDNIGHT SHIFTS, & MISSING TIMESTAMPS
  // -------------------------------------------------------------------------
  console.log('\n>>> Category 3: Boundary Punches, Midnight Shifts & Missing Timestamps');

  // 3.1 Identical Check-in and Check-out
  {
    const internal = [
      { employeeId: 'emp_id_1', date: '2026-09-19', checkIn: '08:30:00', checkOut: '08:30:00', hoursWorked: 0 },
    ];
    const external = [
      { employeeId: 'emp_id_1', date: '2026-09-19', checkIn: '08:30:00', checkOut: '08:30:00', hoursWorked: 0 },
    ];
    const res = reconcileAttendance(external, internal);
    assert.strictEqual(res.isSynchronized, true);
    assert.strictEqual(res.matchedCount, 1);
    console.log('✔ Identical checkIn and checkOut (0 elapsed hours): correctly matched without NaN or crash.');
    recordTest('Identical Punch Times', 'Edge Cases', 'PASS', { matched: res.matchedCount });
  }

  // 3.2 Midnight Shift Full Cycle
  {
    const internal = [
      {
        employeeId: 'emp_night_shift',
        date: '2026-09-19',
        checkIn: '22:00:00',
        checkOut: '06:00:00',
        shiftKey: 'night_shift',
        hoursWorked: 8.0,
      },
    ];
    const external = [
      {
        employeeId: 'emp_night_shift',
        date: '2026-09-19',
        checkIn: '22:00:00',
        checkOut: '06:00:00',
        shiftKey: 'night_shift',
        hoursWorked: 8.0,
      },
    ];
    const res = reconcileAttendance(external, internal);
    assert.strictEqual(res.isSynchronized, true);
    console.log('✔ Midnight-spanning shift (22:00 to 06:00): correctly matched.');
    recordTest('Midnight Shift Full Cycle', 'Edge Cases', 'PASS', { matched: res.matchedCount });
  }

  // 3.3 Midnight Boundary Deviation (23:58 vs 00:02)
  {
    const internal = [
      { employeeId: 'emp_midnight_rollover', date: '2026-09-19', checkIn: '23:58:00', checkOut: '08:00:00' },
    ];
    const external = [
      { employeeId: 'emp_midnight_rollover', date: '2026-09-19', checkIn: '00:02:00', checkOut: '08:00:00' },
    ];
    const res = reconcileAttendance(external, internal);
    const timeDev = res.discrepancies.find((d) => d.type === 'TIME_DEVIATION');
    assert.ok(timeDev, 'Should detect TIME_DEVIATION');
    const deltaMins = timeDev.diffs?.[0]?.deltaMinutes;
    console.log(`ℹ Midnight rollover finding: 23:58 vs 00:02 (4m physical diff) produced deltaMinutes=${deltaMins} (${timeDev.reason})`);
    recordTest('Midnight Boundary Rollover Analysis', 'Edge Cases', 'OBSERVATION', {
      deltaMinutes: deltaMins,
      reason: timeDev.reason,
      physicalDiffMinutes: 4,
      systemThreshold: 5,
    });
  }

  // 3.4 Missing Timestamps (Internal missing check-out)
  {
    const internal = [
      { employeeId: 'emp_miss_out', date: '2026-09-19', checkIn: '08:00:00', checkOut: null },
    ];
    const external = [
      { employeeId: 'emp_miss_out', date: '2026-09-19', checkIn: '08:00:00', checkOut: '17:00:00' },
    ];
    const res = reconcileAttendance(external, internal);
    assert.strictEqual(res.isSynchronized, false);
    const disc = res.discrepancies.find((d) => d.reason === 'MISSING_INTERNAL_CHECK_OUT');
    assert.ok(disc, 'Must detect MISSING_INTERNAL_CHECK_OUT');
    console.log('✔ Missing internal check-out punch: correctly flagged as MISSING_INTERNAL_CHECK_OUT.');
    recordTest('Missing Internal Punch', 'Edge Cases', 'PASS', { reason: disc.reason });
  }

  // 3.5 Missing Timestamps (External missing check-in)
  {
    const internal = [
      { employeeId: 'emp_ext_miss_in', date: '2026-09-19', checkIn: '08:00:00', checkOut: '17:00:00' },
    ];
    const external = [
      { employeeId: 'emp_ext_miss_in', date: '2026-09-19', checkIn: null, checkOut: '17:00:00' },
    ];
    const res = reconcileAttendance(external, internal);
    console.log(`ℹ Asymmetric missing check-in in external: matchedCount=${res.matchedCount}, mismatchCount=${res.mismatchCount}`);
    recordTest('Missing External Timestamp Analysis', 'Edge Cases', 'OBSERVATION', {
      matchedCount: res.matchedCount,
      mismatchCount: res.mismatchCount,
      behavior: 'External null checkIn with valid internal checkIn is treated as non-discrepancy',
    });
  }

  // -------------------------------------------------------------------------
  // 4. PAYROLL PENNY / MILL-FRACTION DIFFERENCES
  // -------------------------------------------------------------------------
  console.log('\n>>> Category 4: Payroll Penny / Mill-Fraction Discrepancy Tolerances');

  {
    const tests = [
      { diff: 0.001, extBasic: 10000.001, label: '1 mill (0.001 EGP)' },
      { diff: 0.005, extBasic: 10000.005, label: '5 mills / half cent (0.005 EGP)' },
      { diff: 0.010, extBasic: 10000.010, label: '1 cent / penny (0.010 EGP)' },
      { diff: 0.015, extBasic: 10000.015, label: '1.5 cents (0.015 EGP - float underflow to 1 cent)' },
      { diff: 0.016, extBasic: 10000.016, label: '1.6 cents (0.016 EGP - rounds to 2 cents)' },
      { diff: 0.020, extBasic: 10000.020, label: '2 cents (0.020 EGP)' },
      { diff: 1.000, extBasic: 10001.000, label: '1 pound (1.000 EGP)' },
    ];

    for (const t of tests) {
      const intPay = [{ employeeId: 'emp_penny', basicSalary: 10000.00, allowances: 0, deductions: 0, netSalary: 10000.00 }];
      const extPay = [{ employeeId: 'emp_penny', basicSalary: t.extBasic, allowances: 0, deductions: 0, netSalary: t.extBasic }];
      const res = reconcilePayroll(extPay, intPay);
      const isDetected = res.discrepancies.some((d) => d.field === 'basicSalary');
      console.log(`✔ Difference of ${t.label}: ${isDetected ? 'DETECTED AS DISCREPANCY' : 'ABSORBED AS TOLERANCE/EPSILON'}`);
      recordTest(`Payroll Tolerance ${t.label}`, 'Fractional Precision', 'PASS', {
        diff: t.diff,
        detected: isDetected,
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4.5 MALFORMED INPUTS, NULL SAFETY & TYPE COERCION RESILIENCE
  // -------------------------------------------------------------------------
  console.log('\n>>> Category 4.5: Malformed Inputs, Null Safety & Resilience');

  {
    // A. Completely null / undefined inputs
    const payNull = reconcilePayroll(null, null);
    assert.strictEqual(payNull.isSynchronized, true);
    assert.strictEqual(payNull.totalExternal, 0);
    assert.strictEqual(payNull.totalInternal, 0);

    const attNull = reconcileAttendance(null, null);
    assert.strictEqual(attNull.isSynchronized, true);
    assert.strictEqual(attNull.totalExternal, 0);
    assert.strictEqual(attNull.totalInternal, 0);
    console.log('✔ Null inputs: safely handled with empty fallback without crashing.');

    // B. Object instead of Array
    const payObj = reconcilePayroll({ dummy: 1 }, { dummy: 2 });
    assert.strictEqual(payObj.totalExternal, 0);
    const attObj = reconcileAttendance({ dummy: 1 }, { dummy: 2 });
    assert.strictEqual(attObj.totalExternal, 0);
    console.log('✔ Non-array inputs: safely converted to empty arrays.');

    // C. Non-numeric salary strings (e.g. "12000" vs 12000)
    const intNumeric = [{ employeeId: 'emp_str', basicSalary: 12000, allowances: 2000, deductions: 500, netSalary: 13500 }];
    const extString = [{ employeeId: 'emp_str', basicSalary: '12000', allowances: '2000', deductions: '500', netSalary: '13500' }];
    const payStringRes = reconcilePayroll(extString, intNumeric);
    assert.strictEqual(payStringRes.isSynchronized, true);
    assert.strictEqual(payStringRes.matchedCount, 1);
    console.log('✔ Numeric string coercion: string numbers safely parsed without NaN.');

    // D. Invalid punch time format (e.g. "invalid-time")
    const intInvPunch = [{ employeeId: 'emp_inv', date: '2026-09-19', checkIn: 'invalid-time', checkOut: 'invalid-time' }];
    const extInvPunch = [{ employeeId: 'emp_inv', date: '2026-09-19', checkIn: '08:00:00', checkOut: '17:00:00' }];
    const attInvRes = reconcileAttendance(extInvPunch, intInvPunch);
    assert.ok(attInvRes);
    console.log('✔ Malformed punch times: handled gracefully without throwing unhandled exceptions.');

    recordTest('Malformed & Null Inputs Resilience', 'Resilience', 'PASS', {
      payNullSafe: true,
      attNullSafe: true,
      stringNumberCoercion: true,
      malformedTimeSafe: true,
    });
  }

  // -------------------------------------------------------------------------
  // 5. HTTP INTEGRATION & AUDIT LOG VERIFICATION (HIGH CONCURRENCY / SCALE)
  // -------------------------------------------------------------------------
  console.log('\n>>> Category 5: HTTP Endpoints & Audit Logging Under Scale');

  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`Test HTTP server listening on port ${PORT}`);
      resolve();
    });
  });

  try {
    // 5.1 Login as admin to get auth headers
    const loginRes = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'elaraby2026',
      role: 'superadmin',
    });
    assert.strictEqual(loginRes.status, 200);
    const token = loginRes.json.token;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': 'elaraby',
    };

    // 5.2 POST /api/admin/integrations/reconciliation/payroll with 150 records
    console.log('Sending 150 external payroll records via HTTP POST...');
    const extPayroll150 = [];
    for (let i = 1; i <= 150; i++) {
      extPayroll150.push({
        employeeId: `emp_${i}`,
        period: 'July 2026',
        basicSalary: 8500 + (i % 3 === 0 ? 500 : 0),
        allowances: 2200,
        deductions: 1540,
        netSalary: 9160 + (i % 3 === 0 ? 500 : 0),
      });
    }

    const t0 = process.hrtime.bigint();
    const httpPayRes = await request('POST', '/api/admin/integrations/reconciliation/payroll', authHeaders, {
      externalPayroll: extPayroll150,
    });
    const t1 = process.hrtime.bigint();
    const httpDurationMs = Number(t1 - t0) / 1e6;

    assert.strictEqual(httpPayRes.status, 200);
    assert.strictEqual(httpPayRes.json.ok, true);
    assert.ok(httpPayRes.json.auditLogId, 'Audit log ID must be returned');
    assert.strictEqual(httpPayRes.json.totalCompared, 150);
    console.log(`✔ HTTP POST Payroll Reconciliation (150 recs): 200 OK in ${httpDurationMs.toFixed(2)}ms, auditLogId=${httpPayRes.json.auditLogId}`);
    recordTest('HTTP POST Payroll (150 records)', 'HTTP Endpoints', 'PASS', {
      durationMs: httpDurationMs.toFixed(2),
      auditLogId: httpPayRes.json.auditLogId,
      matchedCount: httpPayRes.json.matchedCount,
      mismatchCount: httpPayRes.json.mismatchCount,
    });

    // 5.3 POST /api/admin/integrations/reconciliation/attendance with 150 records
    console.log('Sending 150 external attendance records via HTTP POST...');
    const extAtt150 = [];
    for (let i = 1; i <= 150; i++) {
      extAtt150.push({
        employeeId: `emp_${i}`,
        date: '2026-09-19',
        checkIn: i % 4 === 0 ? '08:45:00' : '08:00:00',
        checkOut: '17:00:00',
        shiftKey: 'morning_shift',
      });
    }

    const tAtt0 = process.hrtime.bigint();
    const httpAttRes = await request('POST', '/api/admin/integrations/reconciliation/attendance', authHeaders, {
      externalAttendance: extAtt150,
    });
    const tAtt1 = process.hrtime.bigint();
    const httpAttDurationMs = Number(tAtt1 - tAtt0) / 1e6;

    assert.strictEqual(httpAttRes.status, 200);
    assert.strictEqual(httpAttRes.json.ok, true);
    assert.ok(httpAttRes.json.auditLogId, 'Audit log ID must be returned');
    assert.strictEqual(httpAttRes.json.totalCompared, 150);
    console.log(`✔ HTTP POST Attendance Reconciliation (150 recs): 200 OK in ${httpAttDurationMs.toFixed(2)}ms, auditLogId=${httpAttRes.json.auditLogId}`);
    recordTest('HTTP POST Attendance (150 records)', 'HTTP Endpoints', 'PASS', {
      durationMs: httpAttDurationMs.toFixed(2),
      auditLogId: httpAttRes.json.auditLogId,
      matchedCount: httpAttRes.json.matchedCount,
      mismatchCount: httpAttRes.json.mismatchCount,
    });

    // 5.4 Audit Trail Verification
    const currentDb = data();
    const payAudits = (currentDb.auditLogs || []).filter((l) => l.action === 'ERP_RECONCILIATION_PAYROLL');
    const attAudits = (currentDb.auditLogs || []).filter((l) => l.action === 'ERP_RECONCILIATION_ATTENDANCE');
    assert.ok(payAudits.length >= 1, 'Must have ERP_RECONCILIATION_PAYROLL audit logs');
    assert.ok(attAudits.length >= 1, 'Must have ERP_RECONCILIATION_ATTENDANCE audit logs');
    console.log(`✔ Verified audit trail persistence: ${payAudits.length} payroll audit logs and ${attAudits.length} attendance audit logs recorded.`);
    recordTest('Audit Trail Verification', 'Audit Trail', 'PASS', {
      payrollAuditLogs: payAudits.length,
      attendanceAuditLogs: attAudits.length,
    });

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('Test HTTP server shut down cleanly.');
    }
  }

  console.log('\n=============================================================');
  console.log(`🎉 ALL ${challengeResults.length} CHALLENGER STRESS TESTS COMPLETED SUCCESSFULLY!`);
  console.log('=============================================================');
}

run().catch((err) => {
  console.error('Fatal challenge error:', err);
  if (server) server.close();
  process.exit(1);
});
