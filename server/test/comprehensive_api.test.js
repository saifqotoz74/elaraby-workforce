// Comprehensive Full-Project API & Functional Testing Suite
// Tests all 33 endpoints, auth models, edge cases, error handling, input validation, and security.
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Backup original db before running test suite so we can test cleanly
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_TMP = path.join(DATA_DIR, 'db.test_backup.json');

if (fs.existsSync(DB_FILE)) {
  fs.copyFileSync(DB_FILE, BACKUP_TMP);
}

const app = require('../server');

const PORT = 3999;
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
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: data,
          json: json,
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

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  issues: [],
};

async function test(name, fn) {
  results.total++;
  try {
    await fn();
    results.passed++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    results.failed++;
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    -> ${err.message}`);
    results.issues.push({ name, error: err.message });
  }
}

async function runAllTests() {
  server = app.listen(PORT);
  await new Promise((r) => setTimeout(r, 200));

  console.log('\n=============================================================');
  console.log('STARTING FULL PROJECT COMPREHENSIVE QA & FUNCTIONAL AUDIT');
  console.log('=============================================================\n');

  try {
    // -------------------------------------------------------------
    // 1. HEALTH & INFRASTRUCTURE ROUTES
    // -------------------------------------------------------------
    console.log('\n--- Group 1: Infrastructure & Health Endpoints ---');

    await test('GET /api/health returns 200 and healthy status', async () => {
      const res = await request('GET', '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);
      assert.strictEqual(res.json.status, 'healthy');
      assert.ok(res.json.timestamp > 0);
    });

    await test('GET /api/ready returns 200 with DB collection stats', async () => {
      const res = await request('GET', '/api/ready');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ready, true);
      assert.ok(res.json.dbRecords.employees >= 0);
      assert.ok(res.json.dbRecords.requests >= 0);
    });

    await test('GET / serves Admin index.html', async () => {
      const res = await request('GET', '/');
      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes('Elaraby Connect'));
    });

    await test('GET /admin/ serves Admin dashboard SPA', async () => {
      const res = await request('GET', '/admin/');
      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes('HR Admin Dashboard'));
    });

    await test('Enterprise security headers are present on responses', async () => {
      const res = await request('GET', '/api/health');
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.strictEqual(res.headers['x-xss-protection'], '1; mode=block');
    });

    // -------------------------------------------------------------
    // 2. APP VERSION & CONFIGURATION
    // -------------------------------------------------------------
    console.log('\n--- Group 2: App Version & Force Update Config ---');

    await test('GET /api/app/version returns valid update configuration', async () => {
      const res = await request('GET', '/api/app/version');
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.minVersion);
      assert.ok(res.json.latestVersion);
      assert.strictEqual(typeof res.json.forceUpdate, 'boolean');
      assert.ok(res.json.updateUrl);
    });

    await test('GET /api/app-version fallback alias returns identical configuration', async () => {
      const res = await request('GET', '/api/app-version');
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.minVersion);
    });

    // -------------------------------------------------------------
    // 3. EMPLOYEE AUTHENTICATION (OTP + PIN)
    // -------------------------------------------------------------
    console.log('\n--- Group 3: Employee Auth (OTP, PIN, Rate Limiting) ---');

    let demoEmployeeNationalId = '30607301402992'; // Saif Hossam
    let retrievedOtpCode = null;

    await test('POST /api/auth/otp rejects identifiers with less than 10 digits', async () => {
      const res = await request('POST', '/api/auth/otp', {}, { identifier: '12345' });
      assert.strictEqual(res.status, 400);
    });

    await test('POST /api/auth/otp returns found:false for unregistered identity', async () => {
      const res = await request('POST', '/api/auth/otp', {}, { nationalId: '29999999999999' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.found, false);
    });

    await test('POST /api/auth/otp generates OTP by National ID', async () => {
      const res = await request('POST', '/api/auth/otp', {}, { nationalId: demoEmployeeNationalId });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.found, true);
      assert.ok(res.json.devCode || res.json.smsSent);
      retrievedOtpCode = res.json.devCode;
    });

    await test('POST /api/auth/otp/verify rejects invalid OTP code', async () => {
      const res = await request('POST', '/api/auth/otp/verify', {}, {
        nationalId: demoEmployeeNationalId,
        code: '000000',
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.json.error, 'invalid_code');
    });

    await test('POST /api/auth/otp/verify accepts valid OTP code', async () => {
      assert.ok(retrievedOtpCode, 'Pre-requisite: OTP code retrieved');
      const res = await request('POST', '/api/auth/otp/verify', {}, {
        nationalId: demoEmployeeNationalId,
        code: retrievedOtpCode,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);
      assert.strictEqual(res.json.employee.nationalId, demoEmployeeNationalId);
      assert.strictEqual(res.json.employee.pinHash, undefined, 'Security check: pinHash must never be exposed');
    });

    await test('POST /api/auth/otp generates OTP by Phone Number (Arabic / digits only)', async () => {
      const res = await request('POST', '/api/auth/otp', {}, { phone: '01229105279' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.found, true);
    });

    await test('POST /api/auth/pin validates PIN format (must be 4 digits)', async () => {
      const res1 = await request('POST', '/api/auth/pin', {}, { nationalId: demoEmployeeNationalId, pin: '12' });
      assert.strictEqual(res1.status, 400);
      const res2 = await request('POST', '/api/auth/pin', {}, { nationalId: demoEmployeeNationalId, pin: 'abcd' });
      assert.strictEqual(res2.status, 400);
      const res3 = await request('POST', '/api/auth/pin', {}, { nationalId: demoEmployeeNationalId, pin: '12345' });
      assert.strictEqual(res3.status, 400);
    });

    await test('POST /api/auth/pin prevents unauthenticated PIN overwrite if PIN is already set', async () => {
      const res = await request('POST', '/api/auth/pin', {}, { nationalId: demoEmployeeNationalId, pin: '9999' });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.json.error, 'pin_already_set_requires_verification');
    });

    await test('POST /api/auth/pin/verify rejects wrong PIN', async () => {
      const res = await request('POST', '/api/auth/pin/verify', {}, {
        nationalId: demoEmployeeNationalId,
        pin: '9999',
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.json.error, 'invalid_pin');
    });

    let employeeToken = null;
    let employeeId = null;
    await test('POST /api/auth/pin/verify accepts correct PIN and issues JWT token', async () => {
      const res = await request('POST', '/api/auth/pin/verify', {}, {
        nationalId: demoEmployeeNationalId,
        pin: '1234',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);
      assert.ok(res.json.token);
      employeeToken = res.json.token;
      employeeId = res.json.employee.id;
    });

    await test('POST /api/auth/pin/change rejects unauthenticated requests', async () => {
      const res = await request('POST', '/api/auth/pin/change', {}, { currentPin: '1234', newPin: '5678' });
      assert.strictEqual(res.status, 401);
    });

    await test('POST /api/auth/pin/change rejects incorrect current PIN', async () => {
      const res = await request('POST', '/api/auth/pin/change', {
        Authorization: `Bearer ${employeeToken}`,
      }, { currentPin: '0000', newPin: '5678' });
      assert.strictEqual(res.status, 401);
    });

    await test('POST /api/auth/pin/change updates PIN successfully', async () => {
      const res = await request('POST', '/api/auth/pin/change', {
        Authorization: `Bearer ${employeeToken}`,
      }, { currentPin: '1234', newPin: '4321' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);

      // Verify new PIN works and old PIN is rejected
      const verifyOld = await request('POST', '/api/auth/pin/verify', {}, { nationalId: demoEmployeeNationalId, pin: '1234' });
      assert.strictEqual(verifyOld.status, 401);

      const verifyNew = await request('POST', '/api/auth/pin/verify', {}, { nationalId: demoEmployeeNationalId, pin: '4321' });
      assert.strictEqual(verifyNew.status, 200);
      employeeToken = verifyNew.json.token; // update token

      // Revert PIN back to 1234 for subsequent tests
      await request('POST', '/api/auth/pin/change', {
        Authorization: `Bearer ${employeeToken}`,
      }, { currentPin: '4321', newPin: '1234' });
    });

    // -------------------------------------------------------------
    // 4. EMPLOYEE PROTECTED ROUTES
    // -------------------------------------------------------------
    console.log('\n--- Group 4: Employee Profile, Home, Payroll, Roster, Inbox ---');

    await test('GET /api/me requires auth header', async () => {
      const res = await request('GET', '/api/me');
      assert.strictEqual(res.status, 401);
    });

    await test('GET /api/me returns authenticated employee profile', async () => {
      const res = await request('GET', '/api/me', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.employee.id, employeeId);
      assert.strictEqual(res.json.employee.nationalId, demoEmployeeNationalId);
    });

    await test('GET /api/home returns home payload with today shift and vacation balance', async () => {
      const res = await request('GET', '/api/home', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(res.status, 200);
      assert.ok('announcement' in res.json);
      assert.ok('news' in res.json);
      assert.ok('metrics' in res.json);
      assert.ok('todayShift' in res.json);
    });

    await test('GET /api/payroll returns salary statement', async () => {
      const res = await request('GET', '/api/payroll', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.payroll);
      assert.ok(res.json.payroll.basicSalary >= 0);
    });

    await test('GET /api/roster returns 7-day schedule', async () => {
      const res = await request('GET', '/api/roster', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.days.length, 7);
      assert.ok(res.json.todayShift);
    });

    await test('POST /api/fcm-token registers device push token', async () => {
      const res = await request('POST', '/api/fcm-token', {
        Authorization: `Bearer ${employeeToken}`,
      }, { token: 'test_fcm_device_token_xyz_123' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);
    });

    await test('GET /api/inbox returns notifications and marks as read', async () => {
      const res = await request('GET', '/api/inbox', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.json.notifications));

      const markRes = await request('POST', '/api/inbox/read', {
        Authorization: `Bearer ${employeeToken}`,
      }, {});
      assert.strictEqual(markRes.status, 200);
      assert.strictEqual(markRes.json.ok, true);
    });

    // -------------------------------------------------------------
    // 5. EMPLOYEE REQUESTS LIFECYCLE & INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- Group 5: Employee Requests (Leave, Cancel, Balance Deduct/Refund) ---');

    let createdRequestId = null;
    let initialBalance = null;

    await test('POST /api/requests validates mandatory type and title', async () => {
      const res = await request('POST', '/api/requests', {
        Authorization: `Bearer ${employeeToken}`,
      }, { type: '' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.json.error, 'type_and_title_required');
    });

    await test('POST /api/requests rejects leave exceeding vacation balance (422)', async () => {
      const profile = await request('GET', '/api/me', { Authorization: `Bearer ${employeeToken}` });
      initialBalance = profile.json.employee.vacationBalance;

      const res = await request('POST', '/api/requests', {
        Authorization: `Bearer ${employeeToken}`,
      }, {
        type: 'Leave',
        title: 'Excessive Vacation',
        details: { leaveType: 'Annual Leave' },
        days: initialBalance + 100,
      });
      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.json.error, 'exceeds_balance');
    });

    await test('POST /api/requests creates Annual Leave and deducts balance immediately', async () => {
      const daysToRequest = 2;
      const res = await request('POST', '/api/requests', {
        Authorization: `Bearer ${employeeToken}`,
      }, {
        type: 'Leave',
        title: 'Annual Leave Test',
        details: { leaveType: 'Annual Leave', days: daysToRequest },
        days: daysToRequest,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.request.id);
      createdRequestId = res.json.request.id;
      assert.strictEqual(res.json.vacationBalance, initialBalance - daysToRequest);

      // Verify persistence via /me
      const profile = await request('GET', '/api/me', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(profile.json.employee.vacationBalance, initialBalance - daysToRequest);
    });

    await test('GET /api/requests lists employee requests', async () => {
      const res = await request('GET', '/api/requests', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.requests.some((r) => r.id === createdRequestId));
    });

    await test('POST /api/requests/:id/cancel cancels request and refunds balance', async () => {
      const res = await request('POST', `/api/requests/${createdRequestId}/cancel`, {
        Authorization: `Bearer ${employeeToken}`,
      }, {});
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);

      // Verify balance is refunded
      const profile = await request('GET', '/api/me', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(profile.json.employee.vacationBalance, initialBalance);
    });

    // -------------------------------------------------------------
    // 6. BENEFITS & TRIPS BOOKING
    // -------------------------------------------------------------
    console.log('\n--- Group 6: Corporate Benefits & Trip Booking ---');

    let sampleTripId = null;
    await test('GET /api/benefits returns discounts and trips catalog', async () => {
      const res = await request('GET', '/api/benefits', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.json.benefits));
      assert.ok(Array.isArray(res.json.trips));
      if (res.json.trips.length > 0) {
        sampleTripId = res.json.trips[0].id;
      }
    });

    await test('POST /api/trips/:id/book books a seat on the trip', async () => {
      assert.ok(sampleTripId);
      const res = await request('POST', `/api/trips/${sampleTripId}/book`, {
        Authorization: `Bearer ${employeeToken}`,
      }, {});
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);
    });

    await test('POST /api/trips/:id/unbook unbooks seat', async () => {
      assert.ok(sampleTripId);
      const res = await request('POST', `/api/trips/${sampleTripId}/unbook`, {
        Authorization: `Bearer ${employeeToken}`,
      }, {});
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);
    });

    // -------------------------------------------------------------
    // 7. ADMIN AUTHENTICATION & SECURITY ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n--- Group 7: HR Admin Auth & Access Controls ---');

    await test('POST /api/admin/login rejects wrong credentials', async () => {
      const res = await request('POST', '/api/admin/login', {}, { username: 'admin', password: 'wrongPassword' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.json.error, 'invalid_credentials');
    });

    let adminToken = null;
    await test('POST /api/admin/login accepts valid credentials and issues superadmin JWT', async () => {
      const res = await request('POST', '/api/admin/login', {}, { username: 'admin', password: 'elaraby2026' });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.token);
      adminToken = res.json.token;
    });

    await test('Admin endpoints reject regular employee tokens (401)', async () => {
      const res = await request('GET', '/api/admin/stats', { Authorization: `Bearer ${employeeToken}` });
      assert.strictEqual(res.status, 401);
    });

    await test('Admin endpoints reject unauthenticated requests (401)', async () => {
      const res = await request('GET', '/api/admin/employees');
      assert.strictEqual(res.status, 401);
    });

    // -------------------------------------------------------------
    // 8. ADMIN OPERATIONS & AUDIT TRAIL
    // -------------------------------------------------------------
    console.log('\n--- Group 8: Admin Management, Decisioning, Roster, Payroll ---');

    await test('GET /api/admin/stats returns workforce statistics', async () => {
      const res = await request('GET', '/api/admin/stats', { Authorization: `Bearer ${adminToken}` });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.employees >= 1);
      assert.ok(Array.isArray(res.json.requestsByDay));
    });

    await test('GET /api/admin/audit-logs returns chronological audit trail', async () => {
      const res = await request('GET', '/api/admin/audit-logs?limit=50', { Authorization: `Bearer ${adminToken}` });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.json.auditLogs));
      assert.ok(res.json.auditLogs.length > 0);
    });

    let newEmployeeId = null;
    const testNationalId = '29912311234567';
    await test('POST /api/admin/employees validates 14-digit National ID', async () => {
      const res = await request('POST', '/api/admin/employees', { Authorization: `Bearer ${adminToken}` }, {
        name: 'Test Worker',
        nationalId: '123', // invalid length
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.json.error, 'name_and_14_digit_national_id_required');
    });

    await test('POST /api/admin/employees creates new employee', async () => {
      const res = await request('POST', '/api/admin/employees', { Authorization: `Bearer ${adminToken}` }, {
        name: 'Mahmoud Test Worker',
        nationalId: testNationalId,
        factory: 'Benha Complex',
        department: 'Operations',
        position: 'Technician',
        phone: '+201099887766',
        vacationBalance: 21,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.employee.id);
      newEmployeeId = res.json.employee.id;
    });

    await test('POST /api/admin/employees rejects duplicate National ID (422)', async () => {
      const res = await request('POST', '/api/admin/employees', { Authorization: `Bearer ${adminToken}` }, {
        name: 'Duplicate Worker',
        nationalId: testNationalId,
      });
      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.json.error, 'national_id_already_exists');
    });

    await test('PUT /api/admin/employees/:id updates details and resetPin', async () => {
      const res = await request('PUT', `/api/admin/employees/${newEmployeeId}`, {
        Authorization: `Bearer ${adminToken}`,
      }, {
        position: 'Senior Technician',
        resetPin: true,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.employee.position, 'Senior Technician');
    });

    await test('POST /api/admin/employees/:id/toggle toggles active state', async () => {
      const res = await request('POST', `/api/admin/employees/${newEmployeeId}/toggle`, {
        Authorization: `Bearer ${adminToken}`,
      }, {});
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.employee.active, false);
      // Toggle back to active
      await request('POST', `/api/admin/employees/${newEmployeeId}/toggle`, { Authorization: `Bearer ${adminToken}` }, {});
    });

    await test('PUT /api/admin/payroll/:employeeId publishes payroll statement', async () => {
      const res = await request('PUT', `/api/admin/payroll/${newEmployeeId}`, {
        Authorization: `Bearer ${adminToken}`,
      }, {
        period: 'September 2026',
        basicSalary: 8500,
        allowances: 1200,
        deductions: 300,
        paidOn: 'Sep 28, 2026',
        paymentMethod: 'Bank Transfer (CIB)',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.payroll.basicSalary, 8500);

      const fetchRes = await request('GET', `/api/admin/payroll/${newEmployeeId}`, { Authorization: `Bearer ${adminToken}` });
      assert.strictEqual(fetchRes.json.payroll.period, 'September 2026');
    });

    await test('PUT /api/admin/roster/:employeeId saves weekly shifts', async () => {
      const days = [
        { shift: 'morning' },
        { shift: 'morning' },
        { shift: 'morning' },
        { shift: 'morning' },
        { shift: 'evening' },
        { shift: 'off' },
        { shift: 'off' },
      ];
      const res = await request('PUT', `/api/admin/roster/${newEmployeeId}`, {
        Authorization: `Bearer ${adminToken}`,
      }, { days });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.roster.days.length, 7);
    });

    await test('PUT /api/admin/roster/:employeeId supports office shift preset', async () => {
      const days = [
        { shift: 'office' },
        { shift: 'office' },
        { shift: 'office' },
        { shift: 'office' },
        { shift: 'office' },
        { shift: 'off' },
        { shift: 'off' },
      ];
      const res = await request('PUT', `/api/admin/roster/${newEmployeeId}`, {
        Authorization: `Bearer ${adminToken}`,
      }, { days });
      if (res.status === 400 && res.json.error === 'days_must_be_7_valid_shifts') {
        throw new Error('BUG CONFIRMED: Admin roster endpoint rejects valid "office" shift preset!');
      }
      assert.strictEqual(res.status, 200);
    });

    // -------------------------------------------------------------
    // 9. ADMIN REQUEST DECISIONING & LEAVE REFUND VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- Group 9: Admin Request Decision & Vacation Refund Check ---');

    // Submit a leave request for our new employee to test HR Rejection refund
    // First set PIN for new employee
    await request('POST', '/api/auth/pin', {}, { nationalId: testNationalId, pin: '1234' });
    const empLogin = await request('POST', '/api/auth/pin/verify', {}, { nationalId: testNationalId, pin: '1234' });
    const newEmpToken = empLogin.json.token;

    const leaveReq = await request('POST', '/api/requests', {
      Authorization: `Bearer ${newEmpToken}`,
    }, {
      type: 'Leave',
      title: 'Vacation for Wedding',
      details: { leaveType: 'Annual Leave', days: 3 },
      days: 3,
    });
    const testLeaveId = leaveReq.json.request.id;

    await test('POST /api/admin/requests/:id/decide rejects with reason', async () => {
      const res = await request('POST', `/api/admin/requests/${testLeaveId}/decide`, {
        Authorization: `Bearer ${adminToken}`,
      }, {
        status: 'rejected',
        reason: 'Operational requirements during production peak',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.request.status, 'rejected');
      assert.strictEqual(res.json.request.decisionReason, 'Operational requirements during production peak');
    });

    // Verify whether vacation was refunded on rejection
    await test('Checking if Annual Leave balance was refunded after HR rejection', async () => {
      const profile = await request('GET', '/api/me', { Authorization: `Bearer ${newEmpToken}` });
      // Was 21, deducted 3 to 18. If refunded, should be 21. If bug exists, it is 18!
      const balance = profile.json.employee.vacationBalance;
      if (balance === 18) {
        throw new Error('BUG CONFIRMED: Vacation balance was NOT refunded when HR rejected the leave request!');
      }
      assert.strictEqual(balance, 21);
    });

    // -------------------------------------------------------------
    // 10. CONTENT CRUD (Announcements, News, Benefits, Trips)
    // -------------------------------------------------------------
    console.log('\n--- Group 10: Content CRUD & Image Upload ---');

    let announcementId = null;
    await test('POST /api/admin/announcements creates announcement & sends notifications', async () => {
      const res = await request('POST', '/api/admin/announcements', {
        Authorization: `Bearer ${adminToken}`,
      }, {
        title: 'Automated QA Test Announcement',
        body: 'Testing broadcast notification pipeline across all active employees.',
        important: true,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.item.id);
      announcementId = res.json.item.id;
    });

    await test('DELETE /api/admin/announcements/:id deletes announcement', async () => {
      assert.ok(announcementId);
      const res = await request('DELETE', `/api/admin/announcements/${announcementId}`, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);
    });

    await test('POST /api/admin/upload rejects non-image MIME types (415)', async () => {
      const res = await request('POST', '/api/admin/upload', {
        Authorization: `Bearer ${adminToken}`,
      }, {
        name: 'malicious.exe',
        dataBase64: 'ZXhlY3V0YWJsZQ==',
      });
      assert.strictEqual(res.status, 415);
      assert.strictEqual(res.json.error, 'only_png_jpg_webp_allowed');
    });

    await test('POST /api/admin/upload accepts valid Base64 PNG image', async () => {
      // 1x1 transparent PNG
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const res = await request('POST', '/api/admin/upload', {
        Authorization: `Bearer ${adminToken}`,
      }, {
        name: 'test_pixel.png',
        dataBase64: pngBase64,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.url.startsWith('/uploads/img_'));
      assert.ok(res.json.size > 0);
    });

    // -------------------------------------------------------------
    // 11. SECURITY & IDOR AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Group 11: Security, IDOR, and Account Deletion Compliance ---');

    await test('IDOR Check: Employee B cannot cancel Employee A request', async () => {
      // Employee B tries to cancel Employee A's request
      const fakeReq = await request('POST', '/api/requests', {
        Authorization: `Bearer ${employeeToken}`,
      }, {
        type: 'General',
        title: 'Private Request',
      });
      const reqId = fakeReq.json.request.id;

      // Try cancelling with newEmpToken
      const idorRes = await request('POST', `/api/requests/${reqId}/cancel`, {
        Authorization: `Bearer ${newEmpToken}`,
      }, {});
      assert.strictEqual(idorRes.status, 404, 'IDOR blocked: employee cannot touch other employees requests');
    });

    await test('POST /api/employee/delete-account revokes credentials and session', async () => {
      const res = await request('POST', '/api/employee/delete-account', {
        Authorization: `Bearer ${newEmpToken}`,
      }, {});
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.ok, true);

      // Verify that the PIN is revoked
      const loginAttempt = await request('POST', '/api/auth/pin/verify', {}, {
        nationalId: testNationalId,
        pin: '1234',
      });
      assert.strictEqual(loginAttempt.status, 401, 'Credentials must be revoked after account erasure');
    });

  } finally {
    server.close();
    // Restore original DB backup
    if (fs.existsSync(BACKUP_TMP)) {
      fs.copyFileSync(BACKUP_TMP, DB_FILE);
      fs.unlinkSync(BACKUP_TMP);
    }
  }

  console.log('\n=============================================================');
  console.log(`TEST RUN COMPLETE: ${results.passed}/${results.total} Passed (${results.failed} Failed)`);
  console.log('=============================================================\n');

  if (results.failed > 0) {
    console.log('Failed Tests & Discovered Gaps:');
    results.issues.forEach((iss, idx) => {
      console.log(`${idx + 1}. ${iss.name}: ${iss.error}`);
    });
    process.exit(1);
  }

  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('Test suite failed to run:', err);
  process.exit(1);
});
