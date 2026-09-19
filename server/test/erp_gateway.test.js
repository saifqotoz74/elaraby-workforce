// Test Suite: Enterprise ERP Integration Gateway & Reconciliation
// Covers:
// 1. SAP SuccessFactors Bidirectional Connector Mappings
// 2. Oracle Fusion Cloud HCM Bidirectional Connector Mappings
// 3. Schema Export Endpoint for both systems and all entities (employees, attendance, payroll)
// 4. Payroll Reconciliation Engine & Audit Logging (exact match & mismatch)
// 5. Attendance Reconciliation Engine & Audit Logging (exact match, time deviation, missing punch, shift mismatch)

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-2026';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASS = 'elaraby2026';

const assert = require('assert');
const http = require('http');
const { data, save } = require('../src/db');
const { seed } = require('../src/seed');
const app = require('../server');

const erp = require('../src/integrations/erp');
const SapSuccessFactorsConnector = require('../src/integrations/erp/SapSuccessFactorsConnector');
const OracleFusionHcmConnector = require('../src/integrations/erp/OracleFusionHcmConnector');
const {
  reconcileEmployees,
  reconcilePayroll,
  reconcileAttendance,
} = require('../src/integrations/reconciliation/reconciliationEngine');

const PORT = 3998;
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

async function run() {
  console.log('=============================================================');
  console.log('--- ENTERPRISE ERP INTEGRATION GATEWAY & RECONCILIATION ---');
  console.log('=============================================================\n');

  seed();

  // =========================================================================
  // 1. SAP SuccessFactors Connector Unit Tests
  // =========================================================================
  console.log('--- 1. SAP SuccessFactors Bidirectional Connector ---');
  const sapConnector = new SapSuccessFactorsConnector();
  assert.strictEqual(sapConnector.schemaVersion, 'OData v4 / SF-2026');

  // 1.1 PerPerson / EmpJob Bidirectional Mapping
  const internalEmp = {
    id: 'emp_sf_1',
    employeeCode: 'SF-1042',
    name: 'Hesham Morsi',
    nameAr: 'هشام مرسي',
    nationalId: '29801011234567',
    workEmail: 'hesham.morsi@elarabygroup.com',
    phone: '+201012345678',
    gender: 'M',
    department: 'Industrial Engineering',
    factory: 'Quesna',
    position: 'Automation Engineer',
    costCenter: 'CC-ENG-02',
    supervisor: 'emp_1',
    tenantId: 'elaraby',
    active: true,
    hireDate: '2023-01-15',
  };

  const sapPerPerson = sapConnector.toSapPerPerson(internalEmp);
  assert.strictEqual(sapPerPerson.personIdExternal, 'SF-1042');
  assert.strictEqual(sapPerPerson.personalInfoNav.formalName, 'هشام مرسي');
  assert.strictEqual(sapPerPerson.personalInfoNav.customString1, '29801011234567');
  assert.strictEqual(sapPerPerson.emailNav.emailAddress, 'hesham.morsi@elarabygroup.com');

  const sapEmpJob = sapConnector.toSapEmpJob(internalEmp);
  assert.strictEqual(sapEmpJob.userId, 'SF-1042');
  assert.strictEqual(sapEmpJob.department, 'Industrial Engineering');
  assert.strictEqual(sapEmpJob.location, 'Quesna');
  assert.strictEqual(sapEmpJob.emplStatus, 'A');

  const mappedBackEmp = sapConnector.toInternalEmployee(sapPerPerson, sapEmpJob);
  assert.strictEqual(mappedBackEmp.id, 'SF-1042');
  assert.strictEqual(mappedBackEmp.name, 'هشام مرسي');
  assert.strictEqual(mappedBackEmp.nationalId, '29801011234567');
  assert.strictEqual(mappedBackEmp.department, 'Industrial Engineering');
  assert.strictEqual(mappedBackEmp.active, true);
  console.log('✔ SAP PerPerson & EmpJob bidirectional mapping verified.');

  // 1.2 EmployeeTime Bidirectional Mapping
  const internalAtt = {
    id: 'PCH-SF-01',
    employeeId: 'emp_sf_1',
    date: '2026-09-19',
    checkIn: '08:00:00',
    checkOut: '17:00:00',
    workingMinutes: 540,
    hoursWorked: 9.0,
    type: 'REGULAR',
    status: 'APPROVED',
  };

  const sapTime = sapConnector.toSapEmployeeTime(internalAtt);
  assert.strictEqual(sapTime.externalCode, 'PCH-SF-01');
  assert.strictEqual(sapTime.userId, 'emp_sf_1');
  assert.strictEqual(sapTime.quantityInHours, 9.0);
  assert.strictEqual(sapTime.approvalStatus, 'APPROVED');

  const mappedBackAtt = sapConnector.toInternalAttendance(sapTime);
  assert.strictEqual(mappedBackAtt.id, 'PCH-SF-01');
  assert.strictEqual(mappedBackAtt.employeeId, 'emp_sf_1');
  assert.strictEqual(mappedBackAtt.date, '2026-09-19');
  assert.strictEqual(mappedBackAtt.hoursWorked, 9.0);
  assert.strictEqual(mappedBackAtt.workingMinutes, 540);
  console.log('✔ SAP EmployeeTime bidirectional mapping verified.');

  // 1.3 EmpCompensation Bidirectional Mapping
  const internalPayroll = {
    employeeId: 'emp_sf_1',
    period: 'September 2026',
    basicSalary: 12000,
    allowances: 3000,
    deductions: 1500,
    netSalary: 13500,
    currency: 'EGP',
  };

  const sapComp = sapConnector.toSapEmpCompensation(internalPayroll);
  assert.strictEqual(sapComp.userId, 'emp_sf_1');
  assert.strictEqual(sapComp.basicSalary, 12000);
  assert.strictEqual(sapComp.allowances, 3000);
  assert.strictEqual(sapComp.deductions, 1500);
  assert.strictEqual(sapComp.netSalary, 13500);
  assert.strictEqual(sapComp.payComponents.length, 4);

  const mappedBackPayroll = sapConnector.toInternalPayroll(sapComp);
  assert.strictEqual(mappedBackPayroll.employeeId, 'emp_sf_1');
  assert.strictEqual(mappedBackPayroll.basicSalary, 12000);
  assert.strictEqual(mappedBackPayroll.allowances, 3000);
  assert.strictEqual(mappedBackPayroll.deductions, 1500);
  assert.strictEqual(mappedBackPayroll.netSalary, 13500);
  console.log('✔ SAP EmpCompensation bidirectional mapping verified.\n');

  // =========================================================================
  // 2. Oracle Fusion Cloud HCM Connector Unit Tests
  // =========================================================================
  console.log('--- 2. Oracle Fusion Cloud HCM Bidirectional Connector ---');
  const oracleConnector = new OracleFusionHcmConnector();
  assert.strictEqual(oracleConnector.schemaVersion, 'REST API 11.13.18.05');

  // 2.1 workers / assignments Bidirectional Mapping
  const oracleEmp = {
    id: 'emp_ora_1',
    employeeCode: 'ORA-9921',
    name: 'Tarek Radwan',
    nationalId: '29505051234567',
    workEmail: 'tarek.radwan@elarabygroup.com',
    phone: '+201122334455',
    department: 'Supply Chain Logistics',
    factory: 'Benha',
    position: 'Logistics Supervisor',
    supervisor: 'emp_1',
    tenantId: 'elaraby',
    active: true,
    country: 'EG',
  };

  const oraWorker = oracleConnector.toOracleWorker(oracleEmp);
  assert.strictEqual(oraWorker.PersonNumber, 'ORA-9921');
  assert.strictEqual(oraWorker.DisplayName, 'Tarek Radwan');
  assert.strictEqual(oraWorker.NationalId, '29505051234567');
  assert.strictEqual(oraWorker.LegislationCode, 'EG');

  const oraAssignment = oracleConnector.toOracleAssignment(oracleEmp);
  assert.strictEqual(oraAssignment.PersonNumber, 'ORA-9921');
  assert.strictEqual(oraAssignment.DepartmentName, 'Supply Chain Logistics');
  assert.strictEqual(oraAssignment.LocationName, 'Benha');
  assert.strictEqual(oraAssignment.AssignmentStatus, 'ACTIVE_PROCESS');

  const mappedBackOraEmp = oracleConnector.toInternalEmployee(oraWorker, oraAssignment);
  assert.strictEqual(mappedBackOraEmp.id, 'ORA-9921');
  assert.strictEqual(mappedBackOraEmp.name, 'Tarek Radwan');
  assert.strictEqual(mappedBackOraEmp.department, 'Supply Chain Logistics');
  assert.strictEqual(mappedBackOraEmp.active, true);
  console.log('✔ Oracle workers & assignments bidirectional mapping verified.');

  // 2.2 timeRecords / timeEvents Bidirectional Mapping
  const oraInternalAtt = {
    id: 'PCH-ORA-01',
    employeeId: 'ORA-9921',
    date: '2026-09-19',
    type: 'in',
    timestamp: 1789839600000,
    checkIn: '08:20:00',
    deviceId: 'TERM_BENHA_01',
    badgeNumber: 'BADGE_ORA_1',
    hoursWorked: 8.5,
  };

  const oraTime = oracleConnector.toOracleTimeRecord(oraInternalAtt);
  assert.strictEqual(oraTime.PersonNumber, 'ORA-9921');
  assert.strictEqual(oraTime.TimeType, 'CLOCK_IN');
  assert.strictEqual(oraTime.TerminalId, 'TERM_BENHA_01');

  const mappedBackOraAtt = oracleConnector.toInternalAttendance(oraTime);
  assert.strictEqual(mappedBackOraAtt.employeeId, 'ORA-9921');
  assert.strictEqual(mappedBackOraAtt.type, 'in');
  assert.strictEqual(mappedBackOraAtt.deviceId, 'TERM_BENHA_01');
  console.log('✔ Oracle timeRecords bidirectional mapping verified.');

  // 2.3 payrollElementEntries Bidirectional Mapping
  const oraInternalPayroll = {
    employeeId: 'ORA-9921',
    period: 'September 2026',
    basicSalary: 14000,
    allowances: 3500,
    deductions: 1200,
    netSalary: 16300,
    currency: 'EGP',
  };

  const oraPayroll = oracleConnector.toOraclePayroll(oraInternalPayroll);
  assert.strictEqual(oraPayroll.PersonNumber, 'ORA-9921');
  assert.strictEqual(oraPayroll.BasicSalary, 14000);
  assert.strictEqual(oraPayroll.payrollElementEntries.length, 3);

  const mappedBackOraPayroll = oracleConnector.toInternalPayroll(oraPayroll);
  assert.strictEqual(mappedBackOraPayroll.employeeId, 'ORA-9921');
  assert.strictEqual(mappedBackOraPayroll.basicSalary, 14000);
  assert.strictEqual(mappedBackOraPayroll.netSalary, 16300);
  console.log('✔ Oracle payrollElementEntries bidirectional mapping verified.\n');

  // =========================================================================
  // 3. Multi-Domain Reconciliation Engine Unit Tests
  // =========================================================================
  console.log('--- 3. Multi-Domain Reconciliation Engine ---');

  // 3.1 Payroll Reconciliation: Exact Match
  const internalPayrollList = [
    {
      employeeId: 'emp_1',
      period: 'July 2026',
      basicSalary: 8500,
      allowances: 2200,
      deductions: 1540,
      netSalary: 9160,
    },
    {
      employeeId: 'emp_2',
      period: 'July 2026',
      basicSalary: 7200,
      allowances: 1450,
      deductions: 860,
      netSalary: 7790,
    },
  ];

  const exactExtPayroll = [
    {
      employeeId: 'emp_1',
      period: 'July 2026',
      basicSalary: 8500,
      allowances: 2200,
      deductions: 1540,
      netSalary: 9160,
    },
    {
      employeeId: 'emp_2',
      period: 'July 2026',
      basicSalary: 7200,
      allowances: 1450,
      deductions: 860,
      netSalary: 7790,
    },
  ];

  const payrollMatchResult = reconcilePayroll(exactExtPayroll, internalPayrollList);
  assert.strictEqual(payrollMatchResult.isSynchronized, true);
  assert.strictEqual(payrollMatchResult.matchedCount, 2);
  assert.strictEqual(payrollMatchResult.mismatchCount, 0);
  assert.strictEqual(payrollMatchResult.discrepanciesCount, 0);
  console.log('✔ Payroll reconciliation: exact match synchronized 100%.');

  // 3.2 Payroll Reconciliation: Discrepancy Detection
  const mismatchExtPayroll = [
    {
      employeeId: 'emp_1',
      period: 'July 2026',
      basicSalary: 9000, // +500 diff
      allowances: 2200,
      deductions: 1540,
      netSalary: 9660, // +500 diff
    },
    {
      employeeId: 'emp_2',
      period: 'July 2026',
      basicSalary: 7200,
      allowances: 1250, // -200 diff
      deductions: 860,
      netSalary: 7590, // -200 diff
    },
    {
      employeeId: 'emp_unknown_99',
      period: 'July 2026',
      basicSalary: 5000,
      netSalary: 5000,
    },
  ];

  const payrollMismatchResult = reconcilePayroll(mismatchExtPayroll, internalPayrollList);
  assert.strictEqual(payrollMismatchResult.isSynchronized, false);
  assert.strictEqual(payrollMismatchResult.matchedCount, 0);
  assert.ok(payrollMismatchResult.mismatchCount > 0);
  assert.strictEqual(payrollMismatchResult.missingInInternalCount, 1);

  const emp1Disc = payrollMismatchResult.discrepancies.find((d) => d.employeeId === 'emp_1' && d.field === 'basicSalary');
  assert.ok(emp1Disc, 'Must detect basicSalary discrepancy for emp_1');
  assert.strictEqual(emp1Disc.internalValue, 8500);
  assert.strictEqual(emp1Disc.externalValue, 9000);
  assert.strictEqual(emp1Disc.diff, 500);
  assert.strictEqual(emp1Disc.reason, 'BASIC_SALARY_MISMATCH');

  const emp2Disc = payrollMismatchResult.discrepancies.find((d) => d.employeeId === 'emp_2' && d.field === 'allowances');
  assert.ok(emp2Disc, 'Must detect allowances discrepancy for emp_2');
  assert.strictEqual(emp2Disc.diff, -200);
  assert.strictEqual(emp2Disc.reason, 'ALLOWANCES_DISCREPANCY');
  console.log('✔ Payroll reconciliation: accurately caught salary and allowance variances with reasons.');

  // 3.3 Attendance Reconciliation: Exact Match
  const internalAttList = [
    {
      employeeId: 'emp_1',
      date: '2026-09-19',
      checkIn: '08:00:00',
      checkOut: '17:00:00',
      hoursWorked: 9.0,
      scheduledShift: 'morning_shift',
    },
  ];

  const exactExtAtt = [
    {
      employeeId: 'emp_1',
      date: '2026-09-19',
      checkIn: '08:00:00',
      checkOut: '17:00:00',
      hoursWorked: 9.0,
      shiftKey: 'morning_shift',
    },
  ];

  const attMatchResult = reconcileAttendance(exactExtAtt, internalAttList);
  assert.strictEqual(attMatchResult.isSynchronized, true);
  assert.strictEqual(attMatchResult.matchedCount, 1);
  assert.strictEqual(attMatchResult.mismatchCount, 0);
  console.log('✔ Attendance reconciliation: exact match synchronized 100%.');

  // 3.4 Attendance Reconciliation: Time Deviation, Missing Punch & Shift Code Mismatch
  const mismatchExtAtt = [
    {
      employeeId: 'emp_1',
      date: '2026-09-19',
      checkIn: '08:45:00', // 45m deviation
      checkOut: '17:00:00',
      shiftKey: 'night_shift', // shift code mismatch
      hoursWorked: 8.25,
    },
    {
      employeeId: 'emp_unknown_99',
      date: '2026-09-19',
      checkIn: '08:00:00',
      checkOut: '17:00:00',
    },
  ];

  const attMismatchResult = reconcileAttendance(mismatchExtAtt, internalAttList);
  assert.strictEqual(attMismatchResult.isSynchronized, false);
  assert.ok(attMismatchResult.mismatchCount > 0);

  const timeDevDisc = attMismatchResult.discrepancies.find((d) => d.type === 'TIME_DEVIATION');
  assert.ok(timeDevDisc, 'Must detect check-in time deviation');
  assert.ok(timeDevDisc.reason.includes('deviation'));

  const shiftDisc = attMismatchResult.discrepancies.find((d) => d.type === 'SHIFT_CODE_MISMATCH');
  assert.ok(shiftDisc, 'Must detect shift code mismatch');
  assert.strictEqual(shiftDisc.internalValue, 'morning_shift');
  assert.strictEqual(shiftDisc.externalValue, 'night_shift');

  const missingDisc = attMismatchResult.discrepancies.find((d) => d.type === 'MISSING_PUNCH');
  assert.ok(missingDisc, 'Must detect missing punch in internal');
  console.log('✔ Attendance reconciliation: successfully detected time deviation, shift mismatch, and missing punches.\n');

  // =========================================================================
  // 4. HTTP Integration Tests (Express Endpoints)
  // =========================================================================
  console.log('--- 4. HTTP Integration Endpoints Testing ---');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });

  try {
    // 4.1 Authenticate Admin
    const loginRes = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'elaraby2026',
      role: 'superadmin',
    });
    assert.strictEqual(loginRes.status, 200, 'Login must succeed');
    const token = loginRes.json.token;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
    };

    // 4.2 GET /api/admin/integrations/export/schema (SAP)
    console.log('\n--- 4.2 Schema Export: SAP SuccessFactors ---');
    const sapEmpExport = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=employees', authHeaders);
    assert.strictEqual(sapEmpExport.status, 200);
    assert.strictEqual(sapEmpExport.json.system, 'sap');
    assert.strictEqual(sapEmpExport.json.entity, 'employees');
    assert.strictEqual(sapEmpExport.json.schemaVersion, 'OData v4 / SF-2026');
    assert.ok(Array.isArray(sapEmpExport.json.records));
    assert.ok(sapEmpExport.json.count >= 1);
    assert.ok(sapEmpExport.json.records[0].personIdExternal !== undefined);
    console.log(`✔ GET /api/admin/integrations/export/schema (SAP employees) returned ${sapEmpExport.json.count} OData records.`);

    const sapAttExport = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=attendance', authHeaders);
    assert.strictEqual(sapAttExport.status, 200);
    assert.strictEqual(sapAttExport.json.system, 'sap');
    assert.strictEqual(sapAttExport.json.entity, 'attendance');
    console.log(`✔ GET /api/admin/integrations/export/schema (SAP attendance) returned ${sapAttExport.json.count} EmployeeTime records.`);

    const sapPayExport = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=payroll', authHeaders);
    assert.strictEqual(sapPayExport.status, 200);
    assert.strictEqual(sapPayExport.json.system, 'sap');
    assert.strictEqual(sapPayExport.json.entity, 'payroll');
    assert.ok(sapPayExport.json.records[0]?.payComponents !== undefined);
    console.log(`✔ GET /api/admin/integrations/export/schema (SAP payroll) returned ${sapPayExport.json.count} EmpCompensation records.`);

    // 4.3 GET /api/admin/integrations/export/schema (Oracle)
    console.log('\n--- 4.3 Schema Export: Oracle Fusion Cloud HCM ---');
    const oraEmpExport = await request('GET', '/api/admin/integrations/export/schema?system=oracle&entity=employees', authHeaders);
    assert.strictEqual(oraEmpExport.status, 200);
    assert.strictEqual(oraEmpExport.json.system, 'oracle');
    assert.strictEqual(oraEmpExport.json.entity, 'employees');
    assert.strictEqual(oraEmpExport.json.schemaVersion, 'REST API 11.13.18.05');
    assert.ok(oraEmpExport.json.records[0]?.PersonNumber !== undefined);
    assert.ok(oraEmpExport.json.records[0]?.assignments !== undefined);
    console.log(`✔ GET /api/admin/integrations/export/schema (Oracle employees) returned ${oraEmpExport.json.count} workers records.`);

    const oraAttExport = await request('GET', '/api/admin/integrations/export/schema?system=oracle&entity=attendance', authHeaders);
    assert.strictEqual(oraAttExport.status, 200);
    assert.strictEqual(oraAttExport.json.system, 'oracle');
    assert.strictEqual(oraAttExport.json.entity, 'attendance');
    console.log(`✔ GET /api/admin/integrations/export/schema (Oracle attendance) returned ${oraAttExport.json.count} timeEvents records.`);

    const oraPayExport = await request('GET', '/api/admin/integrations/export/schema?system=oracle&entity=payroll', authHeaders);
    assert.strictEqual(oraPayExport.status, 200);
    assert.strictEqual(oraPayExport.json.system, 'oracle');
    assert.strictEqual(oraPayExport.json.entity, 'payroll');
    assert.ok(oraPayExport.json.records[0]?.payrollElementEntries !== undefined);
    console.log(`✔ GET /api/admin/integrations/export/schema (Oracle payroll) returned ${oraPayExport.json.count} payroll records.`);

    // 4.4 Schema Export Parameter Validation & Auth Guards
    const invalidSystem = await request('GET', '/api/admin/integrations/export/schema?system=invalid_sys&entity=employees', authHeaders);
    assert.strictEqual(invalidSystem.status, 400);

    const invalidEntity = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=invalid_entity', authHeaders);
    assert.strictEqual(invalidEntity.status, 400);

    const unauthExport = await request('GET', '/api/admin/integrations/export/schema?system=sap&entity=employees', {});
    assert.strictEqual(unauthExport.status, 401);
    console.log('✔ Schema export parameter validation and auth guards verified.');

    // 4.5 POST /api/admin/integrations/reconciliation/payroll
    console.log('\n--- 4.5 POST /api/admin/integrations/reconciliation/payroll ---');
    const payReconPayload = {
      externalPayroll: [
        {
          employeeId: 'emp_1',
          period: 'July 2026',
          basicSalary: 8500,
          allowances: 2200,
          deductions: 1540,
          netSalary: 9160,
        },
        {
          employeeId: 'emp_2',
          period: 'July 2026',
          basicSalary: 7500, // 300 discrepancy from 7200
          allowances: 1450,
          deductions: 860,
          netSalary: 8090,
        },
      ],
    };

    const payReconRes = await request('POST', '/api/admin/integrations/reconciliation/payroll', authHeaders, payReconPayload);
    assert.strictEqual(payReconRes.status, 200);
    assert.strictEqual(payReconRes.json.ok, true);
    assert.strictEqual(payReconRes.json.matchedCount, 1);
    assert.ok(payReconRes.json.mismatchCount > 0);
    assert.ok(payReconRes.json.auditLogId, 'Must generate audit log ID');
    assert.strictEqual(payReconRes.json.isSynchronized, false);

    // Verify audit log exists
    const currentDb = data();
    const payAudit = (currentDb.auditLogs || []).find((l) => l.action === 'ERP_RECONCILIATION_PAYROLL');
    assert.ok(payAudit, 'Audit log must record ERP_RECONCILIATION_PAYROLL');
    assert.strictEqual(payAudit.entity, 'payroll');
    console.log(`✔ POST /api/admin/integrations/reconciliation/payroll executed and created audit log ${payReconRes.json.auditLogId}.`);

    // 4.6 POST /api/admin/integrations/reconciliation/attendance
    console.log('\n--- 4.6 POST /api/admin/integrations/reconciliation/attendance ---');
    const attReconPayload = {
      externalAttendance: [
        {
          employeeId: 'emp_1',
          date: '2026-09-19',
          checkIn: '08:00:00',
          checkOut: '17:00:00',
          shiftKey: 'morning_shift',
        },
        {
          employeeId: 'emp_nonexistent',
          date: '2026-09-19',
          checkIn: '09:00:00',
          checkOut: '18:00:00',
        },
      ],
    };

    const attReconRes = await request('POST', '/api/admin/integrations/reconciliation/attendance', authHeaders, attReconPayload);
    assert.strictEqual(attReconRes.status, 200);
    assert.strictEqual(attReconRes.json.ok, true);
    assert.ok(attReconRes.json.auditLogId, 'Must generate audit log ID');
    assert.ok(attReconRes.json.discrepancies.length > 0);

    const attAudit = (currentDb.auditLogs || []).find((l) => l.action === 'ERP_RECONCILIATION_ATTENDANCE');
    assert.ok(attAudit, 'Audit log must record ERP_RECONCILIATION_ATTENDANCE');
    assert.strictEqual(attAudit.entity, 'attendance');
    console.log(`✔ POST /api/admin/integrations/reconciliation/attendance executed and created audit log ${attReconRes.json.auditLogId}.`);

    console.log('\n=============================================================');
    console.log('🎉 ALL ERP GATEWAY & RECONCILIATION TESTS PASSED 100%!');
    console.log('=============================================================\n');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  if (server) server.close();
  process.exit(1);
});
