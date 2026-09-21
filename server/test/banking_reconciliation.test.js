'use strict';

process.env.NODE_ENV = 'test';
const assert = require('assert');
const test = require('node:test');
const http = require('http');
const app = require('../server');
const { signToken } = require('../src/auth');
const { data: db } = require('../src/db');
const BankingReconciliationEngine = require('../src/integrations/banking/BankingReconciliationEngine');

const TEST_PORT = 4991;
let server;
let adminToken;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: data,
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

test('Banking Reconciliation Suite', async (t) => {
  // Start ephemeral HTTP server for route testing
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => resolve());
  });

  adminToken = signToken({
    sub: 'admin',
    scope: 'admin',
    role: 'superadmin',
    tenantId: 'elaraby',
    tokenVersion: 1,
  });

  t.after(() => {
    if (server) {
      server.close();
    }
  });

  await t.test('1. Categorization: Exact Match, Rejection, Invalid Account, Discrepancies', () => {
    const mockEmployees = [
      { id: 'emp_1', employeeCode: 'EG-20481', nationalId: '29001011234592', name: 'Ahmed Ghannam', tenantId: 'elaraby' },
      { id: 'emp_2', employeeCode: 'EG-20777', nationalId: '29505055443322', name: 'Mona Adel', tenantId: 'elaraby' },
      { id: 'emp_3', employeeCode: 'EG-20512', nationalId: '29108081234567', name: 'Tamer Fathy', tenantId: 'elaraby' },
      { id: 'emp_4', employeeCode: 'EG-20999', nationalId: '29303031234567', name: 'Discrepancy Worker', tenantId: 'elaraby' },
    ];

    const mockPayroll = [
      { id: 'p_1', employeeId: 'emp_1', period: '2026-09', netSalary: 9690.00, disbursementStatus: 'pending' },
      { id: 'p_2', employeeId: 'emp_2', period: '2026-09', netSalary: 8310.00, disbursementStatus: 'pending' },
      { id: 'p_3', employeeId: 'emp_3', period: '2026-09', netSalary: 7500.00, disbursementStatus: 'pending' },
      { id: 'p_4', employeeId: 'emp_4', period: '2026-09', netSalary: 5000.00, disbursementStatus: 'pending' },
    ];

    const feedback = [
      { employeeCode: 'EG-20481', amount: 9690.00, status: 'PROCESSED', bankReference: 'TXN-001' },
      { employeeCode: 'EG-20777', amount: 8310.00, status: 'REJECTED', rejectionReason: 'INSUFFICIENT_EMPLOYER_FUNDS' },
      { employeeCode: 'EG-20512', amount: 7500.00, status: 'INVALID_ACCOUNT', rejectionReason: 'AC01_ACCOUNT_CLOSED' },
      { employeeCode: 'EG-20999', amount: 4800.00, status: 'PROCESSED', bankReference: 'TXN-004' }, // 200 EGP mismatch
      { employeeCode: 'UNKNOWN-999', amount: 1000.00, status: 'PROCESSED' }, // Employee not found
    ];

    const result = BankingReconciliationEngine.categorize({
      batchReference: 'BATCH-CIB-TEST-001',
      bankCode: 'cib',
      feedbackRecords: feedback,
      period: '2026-09',
      employees: mockEmployees,
      payrollRecords: mockPayroll,
      tenantId: 'elaraby',
    });

    assert.strictEqual(result.counts.matchedCount, 1);
    assert.strictEqual(result.counts.rejectedCount, 1);
    assert.strictEqual(result.counts.invalidAccountCount, 1);
    assert.strictEqual(result.counts.discrepancyCount, 2);

    assert.strictEqual(result.matched[0].employeeCode, 'EG-20481');
    assert.strictEqual(result.rejected[0].rejectionReason, 'INSUFFICIENT_EMPLOYER_FUNDS');
    assert.strictEqual(result.invalidAccounts[0].rejectionReason, 'AC01_ACCOUNT_CLOSED');
    assert.strictEqual(result.discrepancies[0].reason, 'AMOUNT_MISMATCH');
    assert.strictEqual(result.discrepancies[1].reason, 'EMPLOYEE_NOT_FOUND');
  });

  await t.test('2. Floating Point Precision Tolerance (delta <= 0.01)', () => {
    const mockEmployees = [
      { id: 'emp_float', employeeCode: 'EG-FLOAT', name: 'Float Test', tenantId: 'elaraby' },
    ];
    const mockPayroll = [
      { id: 'p_float', employeeId: 'emp_float', period: '2026-09', netSalary: 9260.00 },
    ];
    const feedback = [
      { employeeCode: 'EG-FLOAT', amount: 9260.004, status: 'PROCESSED' },
    ];

    const result = BankingReconciliationEngine.categorize({
      batchReference: 'BATCH-PRECISION',
      bankCode: 'cib',
      feedbackRecords: feedback,
      period: '2026-09',
      employees: mockEmployees,
      payrollRecords: mockPayroll,
    });

    assert.strictEqual(result.counts.matchedCount, 1);
    assert.strictEqual(result.counts.discrepancyCount, 0);
  });

  await t.test('3. Validation: Missing Parameters Throw 400', () => {
    assert.throws(() => {
      BankingReconciliationEngine.reconcileDisbursementBatch({
        batchReference: '',
        bankCode: 'cib',
      });
    }, /batchReference is required/);

    assert.throws(() => {
      BankingReconciliationEngine.reconcileDisbursementBatch({
        batchReference: 'BATCH-001',
        bankCode: '',
      });
    }, /bankCode is required/);

    assert.throws(() => {
      BankingReconciliationEngine.reconcileDisbursementBatch({
        batchReference: 'BATCH-001',
        bankCode: 'cib',
        feedbackRecords: 'not-an-array',
      });
    }, /feedbackRecords must be an array/);
  });

  await t.test('4. HTTP Endpoint: POST /api/admin/banking/disbursement/reconciliation (Unauthenticated -> 401)', async () => {
    const res = await request('POST', '/api/admin/banking/disbursement/reconciliation', {}, {
      batchReference: 'BATCH-TEST',
      bankCode: 'cib',
      feedbackRecords: [],
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('5. HTTP Endpoint: Full Reconciliation Ingestion & DB Update', async () => {
    const d = db();
    const testEmp = d.employees.find((e) => e.employeeCode === 'EG-20481') || d.employees[0];
    assert.ok(testEmp, 'Test employee must exist in db');

    let testPayroll = d.payroll.find((p) => p.employeeId === testEmp.id && p.period === '2026-09');
    if (!testPayroll) {
      testPayroll = {
        id: `pay_test_m1_${Date.now()}`,
        employeeId: testEmp.id,
        period: '2026-09',
        netSalary: 9690.00,
        disbursementStatus: 'pending',
      };
      d.payroll.push(testPayroll);
    } else {
      testPayroll.netSalary = 9690.00;
      testPayroll.disbursementStatus = 'pending';
    }

    const payload = {
      batchReference: 'BATCH-RECON-E2E-001',
      bankCode: 'cib',
      period: '2026-09',
      feedbackRecords: [
        {
          employeeCode: testEmp.employeeCode || testEmp.id,
          amount: 9690.00,
          status: 'PROCESSED',
          bankReference: 'TXN-CIB-FINAL-001',
        },
      ],
    };

    const res = await request('POST', '/api/admin/banking/disbursement/reconciliation', {
      Authorization: `Bearer ${adminToken}`,
    }, payload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    assert.strictEqual(res.json.ok, true);
    assert.strictEqual(res.json.batchReference, 'BATCH-RECON-E2E-001');
    assert.strictEqual(res.json.matchedCount, 1);
    assert.strictEqual(res.json.rejectedCount, 0);
    assert.strictEqual(res.json.discrepancyCount, 0);
    assert.ok(res.json.auditLogId, 'Must return auditLogId');

    // Verify database record was updated in memory
    const updatedPayroll = d.payroll.find((p) => p.employeeId === testEmp.id && p.period === '2026-09');
    assert.strictEqual(updatedPayroll.disbursementStatus, 'matched');
    assert.strictEqual(updatedPayroll.bankReference, 'TXN-CIB-FINAL-001');
    assert.ok(updatedPayroll.processedAt);

    // Verify audit log exists
    const audit = (d.auditLogs || []).find((l) => l.action === 'BANKING_DISBURSEMENT_RECONCILIATION' && l.entityId === 'BATCH-RECON-E2E-001');
    assert.ok(audit, 'Audit log entry must be recorded');
  });
});
