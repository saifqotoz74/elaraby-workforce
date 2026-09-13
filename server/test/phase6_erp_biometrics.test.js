// Phase 6: Enterprise ERP, Biometric Ingestion & Reconciliation Test Suite
const assert = require('assert');
const erp = require('../src/integrations/erp');
const MockErpAdapter = require('../src/integrations/erp/MockErpAdapter');
const SapAdapter = require('../src/integrations/erp/SapAdapter');
const OracleAdapter = require('../src/integrations/erp/OracleAdapter');
const RestErpAdapter = require('../src/integrations/erp/RestErpAdapter');
const biometrics = require('../src/integrations/biometrics');
const { reconcileEmployees } = require('../src/integrations/reconciliation/reconciliationEngine');

async function runTests() {
  console.log('=============================================================');
  console.log('--- RUNNING PHASE 6: ERP & BIOMETRIC TEST SUITE ---');
  console.log('=============================================================');

  // Test 1: ERP Adapter Master Pull
  console.log('\n--- 1. ERP Adapter Employee Master Data Pull ---');
  const mockErp = new MockErpAdapter();
  const empRes = await mockErp.fetchEmployees({ factory: 'Qwesna Complex' });
  assert.strictEqual(empRes.source, 'mock_erp', 'Source must match mock_erp');
  assert.strictEqual(empRes.count, 1, 'Should filter to 1 employee in Qwesna');
  assert.strictEqual(empRes.records[0].nationalId, '29801011234567', 'National ID must match');
  console.log('✔ ERP Adapter successfully pulled filtered master records.');

  // Test 2: ERP Leave Approval Push
  console.log('\n--- 2. ERP Leave Approval Synchronization Push ---');
  const pushRes = await mockErp.pushLeaveApproval({
    employeeId: 'emp_1',
    days: 3,
    type: 'Annual Leave',
    approvedBy: 'superadmin',
  });
  assert.strictEqual(pushRes.success, true, 'Leave push must succeed');
  assert.ok(pushRes.externalReferenceId, 'Must generate externalReferenceId');
  assert.strictEqual(mockErp.pushedLeaves.length, 1, 'Pushed leaves array must contain 1 entry');
  console.log('✔ Leave approval successfully synchronized to ERP with external audit reference.');

  // Test 3: Unconfigured ERP Adapters Safety
  console.log('\n--- 3. Unconfigured Enterprise ERP Adapters Safety ---');
  const sap = new SapAdapter();
  const oracle = new OracleAdapter();
  const rest = new RestErpAdapter();

  if (!process.env.SAP_ODATA_URL) {
    assert.strictEqual(sap.isConfigured(), false);
    const sapRes = await sap.fetchEmployees();
    assert.strictEqual(sapRes.count, 0);
    assert.strictEqual(sapRes.error, 'sap_not_configured');
  }

  if (!process.env.ORACLE_HCM_URL) {
    assert.strictEqual(oracle.isConfigured(), false);
    const oraRes = await oracle.fetchEmployees();
    assert.strictEqual(oraRes.count, 0);
    assert.strictEqual(oraRes.error, 'oracle_not_configured');
  }

  if (!process.env.ERP_BASE_URL) {
    assert.strictEqual(rest.isConfigured(), false);
    const restRes = await rest.fetchEmployees();
    assert.strictEqual(restRes.count, 0);
    assert.strictEqual(restRes.error, 'erp_not_configured');
  }
  console.log('✔ Real ERP adapters safely detect missing production endpoints without crashing.');

  // Test 4: Biometric Punch Normalization
  console.log('\n--- 4. Biometric Time-Clock Punch Normalization ---');
  const rawPunch1 = {
    badge_id: 'BADGE_1042',
    terminal_id: 'TERM_QWESNA_GATE_1',
    punch_time: '2026-09-12T07:45:00Z',
    type: 'CHECK_IN',
  };
  const normalized1 = biometrics.normalizePunch(rawPunch1);
  assert.strictEqual(normalized1.badgeNumber, 'BADGE_1042', 'Badge number must match');
  assert.strictEqual(normalized1.deviceId, 'TERM_QWESNA_GATE_1', 'Device ID must match');
  assert.strictEqual(normalized1.punchType, 'CHECK_IN', 'Punch type must be CHECK_IN');

  const rawPunch2 = {
    badgeNumber: 'BADGE_1042',
    deviceId: 'TERM_QWESNA_GATE_1',
    timestamp: '2026-09-12T16:30:00Z',
    status: 'OUT',
  };
  const normalized2 = biometrics.normalizePunch(rawPunch2);
  assert.strictEqual(normalized2.punchType, 'CHECK_OUT', 'OUT must normalize to CHECK_OUT');
  console.log('✔ Biometric hardware punches normalized to internal attendance specification.');

  // Test 5: Biometric SFTP/CSV Parsing & Ingestion
  console.log('\n--- 5. Biometric CSV Batch Parsing & Queue Ingestion ---');
  const csvData = `badge_number,device_id,timestamp,type
BADGE_001,TERM_1,2026-09-12T08:00:00Z,IN
BADGE_002,TERM_1,2026-09-12T08:05:00Z,IN
BADGE_003,TERM_2,2026-09-12T17:00:00Z,OUT`;

  const parsedPunches = biometrics.parseCsvFile(csvData);
  assert.strictEqual(parsedPunches.length, 3, 'Must parse 3 punch records from CSV');
  assert.strictEqual(parsedPunches[0].badgeNumber, 'BADGE_001');
  assert.strictEqual(parsedPunches[2].punchType, 'CHECK_OUT');

  const ingestRes = await biometrics.ingest(parsedPunches);
  assert.strictEqual(ingestRes.accepted, 3, 'Must accept 3 punches');
  assert.ok(ingestRes.jobId, 'Must dispatch to background queue with jobId');
  console.log('✔ Biometric CSV batch parsed and queued into BullMQ attendance worker.');

  // Test 6: External vs Internal System Reconciliation Engine
  console.log('\n--- 6. Workforce Reconciliation Engine ---');
  const externalRecords = [
    {
      externalId: 'E_1',
      nationalId: '29801011234567',
      name: 'أحمد محمود',
      vacationBalance: 25.0, // Discrepancy: internal has 21.0
      department: 'Engineering',
    },
    {
      externalId: 'E_999',
      nationalId: '29909091234599',
      name: 'موظف خارجي جديد',
      vacationBalance: 21.0,
      department: 'Production',
    },
  ];

  const internalEmployees = [
    {
      id: 'emp_1',
      nationalId: '29801011234567',
      name: 'أحمد محمود',
      vacationBalance: 21.0,
      department: 'Engineering',
      active: true,
    },
    {
      id: 'emp_2',
      nationalId: '29505051234568',
      name: 'محمد إبراهيم',
      vacationBalance: 14.0,
      department: 'Quality',
      active: true,
    },
  ];

  const reconReport = reconcileEmployees(externalRecords, internalEmployees);
  assert.strictEqual(reconReport.isSynchronized, false, 'Report must flag out of sync');
  assert.strictEqual(reconReport.missingInInternalCount, 1, 'Must detect 1 missing employee in internal');
  assert.strictEqual(reconReport.missingInInternal[0].externalId, 'E_999');
  assert.strictEqual(reconReport.missingInExternalCount, 1, 'Must detect 1 internal employee missing from external');
  assert.strictEqual(reconReport.discrepanciesCount, 1, 'Must detect 1 balance discrepancy');
  assert.strictEqual(reconReport.discrepancies[0].diffs[0].field, 'vacationBalance');
  console.log('✔ Reconciliation engine detected discrepancies, missing records, and generated audit report.');

  console.log('\n=============================================================');
  console.log('ALL PHASE 6 ERP & BIOMETRIC TESTS PASSED (0 FAILURES)');
  console.log('=============================================================');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phase 6 test failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
