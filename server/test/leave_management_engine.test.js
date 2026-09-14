const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../server');
const { data: db, save } = require('../src/db');
const { seed } = require('../src/seed');
const { signToken } = require('../src/auth');
const { calculateWorkingDays, isWeekend, getHolidayName } = require('../src/utils/holidays');

let server;
let port;
let employeeToken;
let zeroBalanceEmployeeToken;
let adminToken;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {
            json = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, json });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test.before(async () => {
  seed(db());
  db().requests = [];
  save();

  // Clean any leftover emp_zero_bal
  db().employees = db().employees.filter((e) => e.id !== 'emp_zero_bal');

  const emp1 = db().employees[0];
  emp1.vacationBalance = 15;
  emp1.tokenVersion = 1;

  const emp2 = db().employees[1];
  emp2.vacationBalance = 0;
  emp2.tokenVersion = 1;
  save();

  employeeToken = signToken({
    sub: emp1.id,
    scope: 'employee',
    tokenVersion: 1,
    employeeId: emp1.id,
    nationalId: emp1.nationalId,
    factory: emp1.factory,
    tenantId: 'elaraby',
  });

  zeroBalanceEmployeeToken = signToken({
    sub: emp2.id,
    scope: 'employee',
    tokenVersion: 1,
    employeeId: emp2.id,
    nationalId: emp2.nationalId,
    factory: emp2.factory,
    tenantId: 'elaraby',
  });

  adminToken = signToken({
    sub: 'hr_admin_tester',
    scope: 'admin',
    role: 'superadmin',
    factory: null,
    tenantId: 'elaraby',
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('1. Egyptian Holiday & Working Days Calculator', () => {
  // Friday & Saturday are weekends
  assert.strictEqual(isWeekend('2026-05-01'), true); // Friday
  assert.strictEqual(isWeekend('2026-05-02'), true); // Saturday
  assert.strictEqual(isWeekend('2026-05-03'), false); // Sunday

  // Official holidays
  assert.ok(getHolidayName('2026-01-07')); // Coptic Christmas
  assert.ok(getHolidayName('2026-01-25')); // Revolution Day
  assert.ok(getHolidayName('2026-04-25')); // Sinai Liberation Day
  assert.ok(getHolidayName('2026-07-23')); // July 23 Revolution

  // Calculate working days over a span containing weekend
  // 2026-05-03 (Sun) to 2026-05-07 (Thu) = 5 working days
  const workDays = calculateWorkingDays('2026-05-03', '2026-05-07');
  assert.strictEqual(workDays.workingDays, 5);

  // 2026-04-30 (Thu) to 2026-05-03 (Sun):
  // 2026-04-30 is Thu (working), 05-01 is Fri (weekend & Labor Day), 05-02 is Sat (weekend), 05-03 is Sun (working)
  // Total working days = 2 (Thu + Sun)
  const spanWithWeekend = calculateWorkingDays('2026-04-30', '2026-05-03');
  assert.strictEqual(spanWithWeekend.workingDays, 2);
});

test('2. Sick Leave Submission with 0 Annual Balance', async () => {
  const emp = db().employees.find((e) => e.id === 'emp_2');
  assert.strictEqual(emp.vacationBalance, 0);

  const res = await request('POST', '/api/requests', {
    Authorization: `Bearer ${zeroBalanceEmployeeToken}`,
  }, {
    type: 'Leave',
    title: 'Sick Leave / إجازة مرضية',
    details: {
      leaveType: 'Sick Leave',
      days: 3,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      reason: 'Medical procedure and recovery',
    },
  });

  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
  assert.strictEqual(res.json.request.status, 'inReview');
  assert.strictEqual(res.json.request.details.leaveType, 'Sick Leave');
  // Balance should remain 0, NOT negative or deducted
  assert.strictEqual(res.json.vacationBalance, 0);

  // Verify 3-tier approval stages
  const stages = res.json.request.approvalStages;
  assert.strictEqual(stages.length, 3);
  assert.strictEqual(stages[0].role, 'medical_clinic');
  assert.strictEqual(stages[1].role, 'line_manager');
  assert.strictEqual(stages[2].role, 'hr_operations');
});

test('3. Annual Leave Immediately Deducts Balance & Rejects if Exceeded', async () => {
  const emp = db().employees.find((e) => e.id === 'emp_2');
  assert.strictEqual(emp.vacationBalance, 0);

  // Should fail with 422 exceeds_balance for zero-balance employee
  const failRes = await request('POST', '/api/requests', {
    Authorization: `Bearer ${zeroBalanceEmployeeToken}`,
  }, {
    type: 'Leave',
    title: 'Annual Leave / إجازة سنوية',
    details: {
      leaveType: 'Annual Leave',
      days: 2,
      startDate: '2026-07-01',
      endDate: '2026-07-02',
    },
  });

  assert.strictEqual(failRes.status, 422);
  assert.strictEqual(failRes.json.error, 'exceeds_balance');

  // Should succeed for employee with 15 days balance and deduct 3 days
  const emp1 = db().employees[0];
  const initialBal = emp1.vacationBalance;
  assert.ok(initialBal >= 5);

  const okRes = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Annual Leave / إجازة سنوية',
    details: {
      leaveType: 'Annual Leave',
      days: 3,
      startDate: '2026-07-05',
      endDate: '2026-07-07',
    },
  });

  assert.strictEqual(okRes.status, 200);
  assert.strictEqual(okRes.json.vacationBalance, initialBal - 3);
  assert.strictEqual(emp1.vacationBalance, initialBal - 3);
});

test('4. Transactional Refund of Annual Leave on HR Rejection', async () => {
  const emp1 = db().employees[0];
  const balBefore = emp1.vacationBalance;

  // Submit 2 days annual leave
  const reqRes = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Annual Leave / إجازة سنوية',
    details: {
      leaveType: 'Annual Leave',
      days: 2,
    },
  });

  assert.strictEqual(reqRes.status, 200);
  const reqId = reqRes.json.request.id;
  assert.strictEqual(emp1.vacationBalance, balBefore - 2);

  // HR Rejection via admin route
  const rejectRes = await request('POST', `/api/admin/requests/${reqId}/decide`, {
    Authorization: `Bearer ${adminToken}`,
  }, {
    status: 'rejected',
    reason: 'Operational conflict during shift peak',
  });

  assert.strictEqual(rejectRes.status, 200);
  assert.strictEqual(rejectRes.json.request.status, 'rejected');

  // Balance must be refunded back to balBefore
  assert.strictEqual(emp1.vacationBalance, balBefore);
});

test('5. Transactional Refund of Annual Leave on Employee Cancellation', async () => {
  const emp1 = db().employees[0];
  const balBefore = emp1.vacationBalance;

  // Submit 4 days annual leave
  const reqRes = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Annual Leave / إجازة سنوية',
    details: {
      leaveType: 'Annual Leave',
      days: 4,
    },
  });

  assert.strictEqual(reqRes.status, 200);
  const reqId = reqRes.json.request.id;
  assert.strictEqual(emp1.vacationBalance, balBefore - 4);

  // Employee cancels request
  const cancelRes = await request('POST', `/api/requests/${reqId}/cancel`, {
    Authorization: `Bearer ${employeeToken}`,
  });

  assert.strictEqual(cancelRes.status, 200);
  assert.strictEqual(cancelRes.json.request.status, 'cancelled');
  assert.strictEqual(cancelRes.json.vacationBalance, balBefore);
  assert.strictEqual(emp1.vacationBalance, balBefore);
});

test('6. Emergency Leave Rules (Max 2 Consecutive Days, Max 6 Days Annual Cap)', async () => {
  // Test 2-day consecutive cap
  const fail3Days = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Emergency Leave / إجازة عارضة',
    details: {
      leaveType: 'Emergency Leave',
      days: 3,
    },
  });

  assert.strictEqual(fail3Days.status, 422);
  assert.strictEqual(fail3Days.json.error, 'emergency_leave_max_2_days');

  // Test submitting valid 2-day emergency leaves up to cap of 6
  // Request 1: 2 days (total 2)
  const req1 = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Emergency Leave / إجازة عارضة',
    details: { leaveType: 'Emergency Leave', days: 2 },
  });
  assert.strictEqual(req1.status, 200);

  // Request 2: 2 days (total 4)
  const req2 = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Emergency Leave / إجازة عارضة',
    details: { leaveType: 'Emergency Leave', days: 2 },
  });
  assert.strictEqual(req2.status, 200);

  // Request 3: 2 days (total 6)
  const req3 = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Emergency Leave / إجازة عارضة',
    details: { leaveType: 'Emergency Leave', days: 2 },
  });
  assert.strictEqual(req3.status, 200);

  // Request 4: 1 additional day (total 7 > 6 annual cap) -> should fail
  const req4 = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Emergency Leave / إجازة عارضة',
    details: { leaveType: 'Emergency Leave', days: 1 },
  });
  assert.strictEqual(req4.status, 422);
  assert.strictEqual(req4.json.error, 'emergency_leave_annual_cap_exceeded');
});

test('7. Unpaid Leave Pipeline and Factory GM Stage', async () => {
  const res = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Unpaid Leave / إجازة بدون مرتب',
    details: {
      leaveType: 'Unpaid Leave',
      days: 10,
    },
  });

  assert.strictEqual(res.status, 200);
  const stages = res.json.request.approvalStages;
  assert.strictEqual(stages.length, 3);
  assert.strictEqual(stages[0].role, 'line_manager');
  assert.strictEqual(stages[1].role, 'factory_gm');
  assert.strictEqual(stages[2].role, 'hr_operations');
});

test('8. Multi-tier Stage Advancement via decideApprovalStage', async () => {
  // Create a sick leave request
  const createRes = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Sick Leave / إجازة مرضية',
    details: { leaveType: 'Sick Leave', days: 2 },
  });

  const reqId = createRes.json.request.id;

  // Advance Stage 1 (Medical Clinic)
  const stage1Res = await request('POST', `/api/admin/requests/${reqId}/stages/1/decide`, {
    Authorization: `Bearer ${adminToken}`,
  }, {
    status: 'approved',
    reason: 'Medical report verified',
  });

  assert.strictEqual(stage1Res.status, 200);
  assert.strictEqual(stage1Res.json.request.status, 'inReview');
  assert.strictEqual(stage1Res.json.request.approvalStages[0].status, 'approved');
  assert.strictEqual(stage1Res.json.request.approvalStages[1].status, 'pending');

  // Advance Stage 2 (Line Manager)
  const stage2Res = await request('POST', `/api/admin/requests/${reqId}/stages/2/decide`, {
    Authorization: `Bearer ${adminToken}`,
  }, {
    status: 'approved',
  });

  assert.strictEqual(stage2Res.status, 200);
  assert.strictEqual(stage2Res.json.request.approvalStages[1].status, 'approved');

  // Advance Stage 3 (HR Final Approval)
  const stage3Res = await request('POST', `/api/admin/requests/${reqId}/stages/3/decide`, {
    Authorization: `Bearer ${adminToken}`,
  }, {
    status: 'approved',
  });

  assert.strictEqual(stage3Res.status, 200);
  assert.strictEqual(stage3Res.json.request.status, 'approved');
  assert.strictEqual(stage3Res.json.request.approvalStages[2].status, 'approved');
});

test('9. Employee Document & Medical Attachment Upload Endpoint', async () => {
  // Valid base64 1x1 PNG
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const res = await request('POST', '/api/upload', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    name: 'medical_certificate.png',
    dataBase64: pngBase64,
  });

  assert.strictEqual(res.status, 200);
  assert.ok(res.json.url);
  assert.strictEqual(res.json.filename.endsWith('.png'), true);

  // Submit leave with attachment
  const leaveWithDoc = await request('POST', '/api/requests', {
    Authorization: `Bearer ${employeeToken}`,
  }, {
    type: 'Leave',
    title: 'Sick Leave with Attachment',
    attachmentUrl: res.json.url,
    attachmentName: 'medical_certificate.png',
    details: {
      leaveType: 'Sick Leave',
      days: 2,
    },
  });

  assert.strictEqual(leaveWithDoc.status, 200);
  assert.strictEqual(leaveWithDoc.json.request.attachmentUrl, res.json.url);
  assert.strictEqual(leaveWithDoc.json.request.attachmentName, 'medical_certificate.png');
});
