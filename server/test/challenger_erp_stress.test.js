// Challenger 1: Comprehensive Empirical Stress Test Harness for Milestone 1 ERP Connectors
// Focus: SAP SuccessFactors & Oracle Fusion HCM Connectors, Schema Export, and Edge Cases
// Evaluates: Malformed/null fields, edge dates, salaries (zero, negative, floats), unsupported schemas

const assert = require('assert');
const erp = require('../src/integrations/erp');
const SapSuccessFactorsConnector = require('../src/integrations/erp/SapSuccessFactorsConnector');
const OracleFusionHcmConnector = require('../src/integrations/erp/OracleFusionHcmConnector');

const testSuite = {
  passed: 0,
  failed: 0,
  tests: [],
};

function recordTest(category, description, fn) {
  try {
    fn();
    testSuite.passed++;
    testSuite.tests.push({ category, description, status: 'PASS' });
    console.log(`  ✔ [PASS] [${category}] ${description}`);
  } catch (err) {
    testSuite.failed++;
    testSuite.tests.push({
      category,
      description,
      status: 'FAIL',
      error: err.message,
      stack: err.stack,
    });
    console.error(`  ✘ [FAIL] [${category}] ${description}`);
    console.error(`      Error: ${err.name}: ${err.message}`);
  }
}

function runEmpiricalHarness() {
  console.log('================================================================================');
  console.log('CHALLENGER 1: EMPIRICAL ERP INTEGRATION STRESS TEST HARNESS');
  console.log('Milestone 1: Enterprise ERP Integration Gateway & Reconciliation');
  console.log('================================================================================\n');

  const sap = new SapSuccessFactorsConnector();
  const oracle = new OracleFusionHcmConnector();

  // ===========================================================================
  // 1. SAP SUCCESSFACTORS: MALFORMED, NULL, OR MISSING FIELDS
  // ===========================================================================
  console.log('--- 1. SAP SuccessFactors: Malformed, Null, and Missing Fields ---');

  recordTest('SAP Malformed/Null', 'Handles null and undefined internalEmployee gracefully', () => {
    assert.strictEqual(sap.toSapPerPerson(null), null);
    assert.strictEqual(sap.toSapPerPerson(undefined), null);
    assert.strictEqual(sap.toSapEmpJob(null), null);
    assert.strictEqual(sap.toSapEmpJob(undefined), null);
  });

  recordTest('SAP Malformed/Null', 'Handles empty internalEmployee object with safe fallbacks', () => {
    const p = sap.toSapPerPerson({});
    assert.ok(p !== null);
    assert.strictEqual(p.personId, 10001);
    assert.strictEqual(p.personalInfoNav.firstName, '');
    assert.strictEqual(p.personalInfoNav.lastName, '');

    const j = sap.toSapEmpJob({});
    assert.ok(j !== null);
    assert.strictEqual(j.department, 'Operations');
    assert.strictEqual(j.location, 'Quesna');
    assert.strictEqual(j.emplStatus, 'A');
  });

  recordTest('SAP Malformed/Null', 'Handles non-string employee name without throwing uncaught TypeError', () => {
    // Should safely coerce or fallback if name is a number (e.g. 12345)
    const p = sap.toSapPerPerson({ name: 12345 });
    assert.ok(p !== null);
    assert.ok(typeof p.personalInfoNav.firstName === 'string');
  });

  recordTest('SAP Malformed/Null', 'Handles null/undefined in toInternalEmployee', () => {
    assert.strictEqual(sap.toInternalEmployee(null, null), null);
  });

  recordTest('SAP Malformed/Null', 'Handles null navigation properties in SAP PerPerson payload', () => {
    const internal = sap.toInternalEmployee({
      personIdExternal: 'SF-TEST',
      personalInfoNav: null,
      emailNav: null,
      phoneNav: null,
    }, null);
    assert.ok(internal !== null);
    assert.strictEqual(internal.id, 'SF-TEST');
    assert.strictEqual(internal.workEmail, '');
    assert.strictEqual(internal.phone, '');
  });

  recordTest('SAP Malformed/Null', 'Handles null payComponents array or null elements in payComponents', () => {
    // Array containing null or undefined elements should not throw uncaught TypeError
    const internal = sap.toInternalPayroll({
      userId: 'SF-100',
      period: '2026-09',
      payComponents: [
        null,
        undefined,
        { payComponent: 'BASE_SALARY', paycompvalue: 10000 },
      ],
    });
    assert.ok(internal !== null);
    assert.strictEqual(internal.basicSalary, 10000);
  });

  // ===========================================================================
  // 2. ORACLE FUSION HCM: MALFORMED, NULL, OR MISSING FIELDS
  // ===========================================================================
  console.log('\n--- 2. Oracle Fusion HCM: Malformed, Null, and Missing Fields ---');

  recordTest('Oracle Malformed/Null', 'Handles null and undefined internalEmployee gracefully', () => {
    assert.strictEqual(oracle.toOracleWorker(null), null);
    assert.strictEqual(oracle.toOracleWorker(undefined), null);
    assert.strictEqual(oracle.toOracleAssignment(null), null);
    assert.strictEqual(oracle.toOracleAssignment(undefined), null);
  });

  recordTest('Oracle Malformed/Null', 'Handles empty internalEmployee object with safe defaults', () => {
    const w = oracle.toOracleWorker({});
    assert.ok(w !== null);
    assert.strictEqual(w.PersonId, 20001);
    assert.strictEqual(w.DisplayName, 'Oracle Worker');
    assert.strictEqual(w.LegislationCode, 'EG');

    const a = oracle.toOracleAssignment({});
    assert.ok(a !== null);
    assert.strictEqual(a.AssignmentId, 30001);
    assert.strictEqual(a.DepartmentName, 'Operations');
  });

  recordTest('Oracle Malformed/Null', 'Handles null/empty inputs in toInternalEmployee', () => {
    assert.strictEqual(oracle.toInternalEmployee(null, null), null);
    const internal = oracle.toInternalEmployee({}, {});
    assert.ok(internal !== null);
    assert.strictEqual(internal.name, 'Oracle Worker');
  });

  recordTest('Oracle Malformed/Null', 'Handles null elements in payrollElementEntries array', () => {
    // Array containing null entry should not throw uncaught TypeError
    const internal = oracle.toInternalPayroll([
      null,
      { PersonNumber: 'ORA-99', ElementName: 'Basic Salary', Amount: 9500 },
    ]);
    assert.ok(internal !== null);
    assert.strictEqual(internal.basicSalary, 9500);
  });

  recordTest('Oracle Malformed/Null', 'Handles null elements in object payrollElementEntries property', () => {
    const internal = oracle.toInternalPayroll({
      PersonNumber: 'ORA-99',
      payrollElementEntries: [
        null,
        { ElementName: 'Basic Salary', Amount: 9500 },
      ],
    });
    assert.ok(internal !== null);
    assert.strictEqual(internal.basicSalary, 9500);
  });

  recordTest('Oracle Malformed/Null', 'Handles malformed attendance timestamps without throwing uncaught RangeError', () => {
    // Invalid timestamp string must not throw RangeError: Invalid time value
    const rec = oracle.toOracleTimeRecord({
      employeeId: 'EMP-1',
      timestamp: 'invalid-iso-date',
    });
    assert.ok(rec !== null);
    assert.ok(rec.StartTime);
  });

  recordTest('Oracle Malformed/Null', 'Handles malformed attendance date strings without throwing uncaught RangeError', () => {
    const rec = oracle.toOracleTimeRecord({
      employeeId: 'EMP-1',
      date: 'invalid-date',
      checkIn: '08:00',
    });
    assert.ok(rec !== null);
    assert.ok(rec.StartTime);
  });

  recordTest('Oracle Malformed/Null', 'Handles malformed checkOut in attendance without throwing uncaught RangeError', () => {
    const rec = oracle.toOracleTimeRecord({
      employeeId: 'EMP-1',
      date: '2026-09-19',
      checkOut: 'invalid-time',
    });
    assert.ok(rec !== null);
    assert.ok(rec.EndTime);
  });

  recordTest('Oracle Malformed/Null', 'Handles malformed EndTime in toInternalAttendance without throwing uncaught RangeError', () => {
    const internal = oracle.toInternalAttendance({
      PersonNumber: 'EMP-1',
      StartTime: '2026-09-19T08:00:00Z',
      EndTime: 'invalid-iso-date',
    });
    assert.ok(internal !== null);
    assert.strictEqual(internal.checkOut, '17:00:00');
  });

  // ===========================================================================
  // 3. EDGE CASE DATES: LEAP YEARS, BOUNDARIES, TIMEZONE OFFSETS
  // ===========================================================================
  console.log('\n--- 3. Edge Case Dates: Leap Years, Boundaries, Timezone Offsets ---');

  recordTest('Edge Dates', 'SAP: Leap year date roundtrip (2024-02-29 and 2028-02-29)', () => {
    const job2024 = sap.toSapEmpJob({ hireDate: '2024-02-29' });
    const emp2024 = sap.toInternalEmployee(null, job2024);
    assert.strictEqual(emp2024.hireDate, '2024-02-29');

    const job2028 = sap.toSapEmpJob({ hireDate: '2028-02-29' });
    const emp2028 = sap.toInternalEmployee(null, job2028);
    assert.strictEqual(emp2028.hireDate, '2028-02-29');
  });

  recordTest('Edge Dates', 'SAP: Month boundary dates (Jan 31, Feb 28, Mar 31, Apr 30, Dec 31)', () => {
    const testDates = ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-12-31', '2027-01-01'];
    for (const d of testDates) {
      const job = sap.toSapEmpJob({ hireDate: d });
      const emp = sap.toInternalEmployee(null, job);
      assert.strictEqual(emp.hireDate, d, `Date mismatch on ${d}`);
    }
  });

  recordTest('Edge Dates', 'SAP: Timezone offset parsing in /Date(ms+offset)/ format', () => {
    const empPositiveTz = sap.toInternalEmployee(null, { startDate: '/Date(1774915200000+0300)/' });
    assert.ok(empPositiveTz.hireDate.startsWith('2026-'));

    const empNegativeTz = sap.toInternalEmployee(null, { startDate: '/Date(1774915200000-0500)/' });
    assert.ok(empNegativeTz.hireDate.startsWith('2026-'));
  });

  recordTest('Edge Dates', 'SAP: Extreme numeric date value does not throw uncaught RangeError', () => {
    // Extreme timestamp (e.g. 1e20) should not cause unhandled RangeError
    const internal = sap.toInternalAttendance({ startDate: 1e20 });
    assert.ok(internal !== null);
  });

  recordTest('Edge Dates', 'SAP: Time boundary parsing (00:00:00, 23:59:59, 12:00 AM, 11:59 PM)', () => {
    const boundaryTimes = [
      { in: '00:00:00', expSap: 'PT00H00M00S', expBack: '00:00:00' },
      { in: '23:59:59', expSap: 'PT23H59M59S', expBack: '23:59:59' },
      { in: '12:00 AM', expSap: 'PT00H00M00S', expBack: '00:00:00' },
      { in: '12:00 PM', expSap: 'PT12H00M00S', expBack: '12:00:00' },
    ];
    for (const item of boundaryTimes) {
      const timeRec = sap.toSapEmployeeTime({ checkIn: item.in, checkOut: item.in });
      assert.strictEqual(timeRec.startTime, item.expSap);
      const back = sap.toInternalAttendance(timeRec);
      assert.strictEqual(back.checkIn, item.expBack);
    }
  });

  recordTest('Edge Dates', 'Oracle: Leap year and timezone offset ISO timestamps', () => {
    const recLeap = oracle.toOracleTimeRecord({
      employeeId: 'EMP-LEAP',
      date: '2024-02-29',
      checkIn: '08:30:00',
    });
    assert.ok(recLeap.StartTime.includes('2024-02-29'));

    const recTz = oracle.toOracleTimeRecord({
      employeeId: 'EMP-TZ',
      timestamp: '2026-09-19T11:00:00+03:00',
    });
    assert.strictEqual(recTz.StartTime, '2026-09-19T08:00:00.000Z');

    const backTz = oracle.toInternalAttendance(recTz);
    assert.strictEqual(backTz.date, '2026-09-19');
    assert.strictEqual(backTz.checkIn, '08:00:00');
  });

  // ===========================================================================
  // 4. SALARY VALUES: ZERO, NEGATIVE, AND FLOATING POINT AMOUNTS
  // ===========================================================================
  console.log('\n--- 4. Salary Values: Zero, Negative, and Floating Point Amounts ---');

  recordTest('Salaries', 'SAP: Zero salary amounts correctly handled without false fallback', () => {
    const sapComp = sap.toSapEmpCompensation({
      employeeId: 'EMP-ZERO',
      basicSalary: 0,
      allowances: 0,
      deductions: 0,
      netSalary: 0,
    });
    assert.strictEqual(sapComp.basicSalary, 0);
    assert.strictEqual(sapComp.netSalary, 0);

    const internal = sap.toInternalPayroll(sapComp);
    assert.strictEqual(internal.basicSalary, 0);
    assert.strictEqual(internal.allowances, 0);
    assert.strictEqual(internal.deductions, 0);
    assert.strictEqual(internal.netSalary, 0);
  });

  recordTest('Salaries', 'SAP: Negative salary amounts (retroactive deductions / clawbacks)', () => {
    const sapComp = sap.toSapEmpCompensation({
      employeeId: 'EMP-NEG',
      basicSalary: 10000,
      allowances: -1200,
      deductions: 800,
      netSalary: 8000,
    });
    assert.strictEqual(sapComp.allowances, -1200);

    const internal = sap.toInternalPayroll(sapComp);
    assert.strictEqual(internal.allowances, -1200);
    assert.strictEqual(internal.netSalary, 8000);
  });

  recordTest('Salaries', 'SAP: Floating point precision preserved', () => {
    const sapComp = sap.toSapEmpCompensation({
      employeeId: 'EMP-FLOAT',
      basicSalary: 14567.89,
      allowances: 3456.78,
      deductions: 1234.56,
      netSalary: 16790.11,
    });
    assert.strictEqual(sapComp.basicSalary, 14567.89);

    const internal = sap.toInternalPayroll(sapComp);
    assert.strictEqual(internal.basicSalary, 14567.89);
    assert.strictEqual(internal.netSalary, 16790.11);
  });

  recordTest('Salaries', 'Oracle: Zero salary amounts correctly handled', () => {
    const oraPay = oracle.toOraclePayroll({
      employeeId: 'EMP-ZERO',
      basicSalary: 0,
      allowances: 0,
      deductions: 0,
      netSalary: 0,
    });
    assert.strictEqual(oraPay.BasicSalary, 0);
    assert.strictEqual(oraPay.NetSalary, 0);

    const internalObj = oracle.toInternalPayroll(oraPay);
    assert.strictEqual(internalObj.basicSalary, 0);
    assert.strictEqual(internalObj.netSalary, 0);

    const internalEntries = oracle.toInternalPayroll(oraPay.payrollElementEntries);
    assert.strictEqual(internalEntries.basicSalary, 0);
    assert.strictEqual(internalEntries.netSalary, 0);
  });

  recordTest('Salaries', 'Oracle: Negative salary adjustments handled cleanly', () => {
    const oraPay = oracle.toOraclePayroll({
      employeeId: 'EMP-NEG',
      basicSalary: 8500,
      allowances: -500,
      deductions: 1000,
      netSalary: 7000,
    });
    assert.strictEqual(oraPay.Allowances, -500);

    const internal = oracle.toInternalPayroll(oraPay.payrollElementEntries);
    assert.strictEqual(internal.allowances, -500);
    assert.strictEqual(internal.netSalary, 7000);
  });

  recordTest('Salaries', 'Oracle: Floating point net salary calculation rounded to 2 decimal places', () => {
    // 18765.43 + 3456.78 - 987.65 in IEEE 754 produces 21234.559999999998
    // Financial netSalary must round to 21234.56
    const internal = oracle.toInternalPayroll({
      BasicSalary: 18765.43,
      Allowances: 3456.78,
      Deductions: 987.65,
      payrollElementEntries: [
        { ElementName: 'Basic Salary', Amount: 18765.43 },
        { ElementName: 'Allowances', Amount: 3456.78, EntryType: 'E' },
        { ElementName: 'Deductions', Amount: 987.65, EntryType: 'D' },
      ],
    });
    assert.strictEqual(internal.netSalary, 21234.56, `Expected rounded 21234.56, got ${internal.netSalary}`);
  });

  // ===========================================================================
  // 5. SCHEMA EXPORT: UNSUPPORTED SYSTEMS, ENTITIES, AND NULL RECORDS
  // ===========================================================================
  console.log('\n--- 5. Schema Export: Unsupported Systems, Entities, and Inputs ---');

  recordTest('Schema Export', 'erp.getConnector rejects unsupported ERP system names with descriptive error', () => {
    const badSystems = ['salesforce', 'workday', 'infor', '', null];
    for (const sys of badSystems) {
      assert.throws(() => erp.getConnector(sys), /Unsupported ERP system/);
    }
  });

  recordTest('Schema Export', 'SAP exportSchema rejects unsupported entity types with descriptive error', () => {
    const badEntities = ['invoices', 'gl_accounts', 'purchase_orders', '', null, undefined];
    for (const ent of badEntities) {
      assert.throws(() => sap.exportSchema(ent, []), /Unsupported SAP export entity/);
    }
  });

  recordTest('Schema Export', 'Oracle exportSchema rejects unsupported entity types with descriptive error', () => {
    const badEntities = ['invoices', 'payables', 'suppliers', '', null, undefined];
    for (const ent of badEntities) {
      assert.throws(() => oracle.exportSchema(ent, []), /Unsupported Oracle export entity/);
    }
  });

  recordTest('Schema Export', 'SAP exportSchema handles null records argument gracefully without throwing TypeError', () => {
    // Calling exportSchema('employees', null) must not crash with TypeError: Cannot read properties of null (reading 'map')
    const exp = sap.exportSchema('employees', null);
    assert.ok(exp !== null);
    assert.strictEqual(exp.count, 0);
  });

  recordTest('Schema Export', 'Oracle exportSchema handles null records argument gracefully without throwing TypeError', () => {
    // Calling exportSchema('attendance', null) must not crash with TypeError: Cannot read properties of null (reading 'map')
    const exp = oracle.exportSchema('attendance', null);
    assert.ok(exp !== null);
    assert.strictEqual(exp.count, 0);
  });

  recordTest('Schema Export', 'Export schema with empty array returns valid contract metadata and zero count', () => {
    const sapExp = sap.exportSchema('employees', []);
    assert.strictEqual(sapExp.system, 'sap');
    assert.strictEqual(sapExp.entity, 'employees');
    assert.strictEqual(sapExp.count, 0);
    assert.deepStrictEqual(sapExp.records, []);

    const oraExp = oracle.exportSchema('attendance', []);
    assert.strictEqual(oraExp.system, 'oracle');
    assert.strictEqual(oraExp.entity, 'attendance');
    assert.strictEqual(oraExp.count, 0);
    assert.deepStrictEqual(oraExp.records, []);
  });

  // ===========================================================================
  // REPORT
  // ===========================================================================
  console.log('\n================================================================================');
  console.log(`STRESS HARNESS RESULTS: ${testSuite.passed} PASSED | ${testSuite.failed} FAILED | TOTAL ${testSuite.tests.length}`);
  console.log('================================================================================');

  if (testSuite.failed > 0) {
    console.log('\nCRITICAL FAILURE SUMMARY:');
    testSuite.tests.filter((t) => t.status === 'FAIL').forEach((f, i) => {
      console.log(`\n[${i + 1}] Category: ${f.category}`);
      console.log(`    Test: ${f.description}`);
      console.log(`    Error: ${f.error}`);
    });
  }
}

runEmpiricalHarness();
