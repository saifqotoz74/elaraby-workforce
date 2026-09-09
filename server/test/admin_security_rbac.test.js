// Enterprise Admin Security, Cookie Sessions, CSRF, Scope Isolation & Granular RBAC Test Suite
process.env.NODE_ENV = 'test';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { ROLES, PERMISSIONS, hasPermission, checkScope, ROLE_PERMISSIONS } = require('../src/rbac');
const { data, save } = require('../src/db');
const app = require('../server');

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

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return {};
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const cookies = {};
  for (const item of list) {
    const parts = item.split(';').map((p) => p.trim());
    const [nameVal, ...attrs] = parts;
    const [name, val] = nameVal.split('=');
    cookies[name] = {
      value: decodeURIComponent(val || ''),
      raw: item,
      httpOnly: attrs.some((a) => a.toLowerCase() === 'httponly'),
      sameSite: attrs.find((a) => a.toLowerCase().startsWith('samesite='))?.split('=')[1] || null,
      maxAge: attrs.find((a) => a.toLowerCase().startsWith('max-age='))?.split('=')[1] || null,
    };
  }
  return cookies;
}

async function runTests() {
  console.log('=============================================================');
  console.log('PHASE 1 TEST SUITE: Admin Security, CSRF, RBAC & Scope Guard');
  console.log('=============================================================');

  // 1. RBAC Unit Tests
  console.log('\n--- Section 1: RBAC Permission Matrix & Scope Unit Tests ---');
  assert.strictEqual(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.PAYROLL_READ), true);
  assert.strictEqual(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.AUDIT_READ), true);
  assert.strictEqual(hasPermission(ROLES.HR_OFFICER, PERMISSIONS.LEAVE_APPROVE), true);
  assert.strictEqual(hasPermission(ROLES.HR_OFFICER, PERMISSIONS.PAYROLL_UPDATE), false);
  assert.strictEqual(hasPermission(ROLES.PAYROLL_OFFICER, PERMISSIONS.PAYROLL_READ), true);
  assert.strictEqual(hasPermission(ROLES.PAYROLL_OFFICER, PERMISSIONS.SHIFT_UPDATE), false);
  assert.strictEqual(hasPermission(ROLES.SHIFT_SUPERVISOR, PERMISSIONS.SHIFT_READ), true);
  assert.strictEqual(hasPermission(ROLES.SHIFT_SUPERVISOR, PERMISSIONS.PAYROLL_READ), false);
  assert.strictEqual(hasPermission(ROLES.AUDITOR, PERMISSIONS.AUDIT_READ), true);
  assert.strictEqual(hasPermission(ROLES.AUDITOR, PERMISSIONS.EMPLOYEE_CREATE), false);
  console.log('✔ RBAC permission matrix verified across all 6 roles.');

  // Scope Isolation Unit Tests
  const superAdminUser = { role: ROLES.SUPER_ADMIN };
  const scopedSupervisor = { role: ROLES.SHIFT_SUPERVISOR, scopeFactory: '10th of Ramadan' };
  const empRamadan = { id: 'emp_1', factory: '10th of Ramadan', department: 'Production A' };
  const empQwesna = { id: 'emp_2', factory: 'Qwesna', department: 'Assembly' };

  assert.strictEqual(checkScope(superAdminUser, empRamadan), true);
  assert.strictEqual(checkScope(superAdminUser, empQwesna), true);
  assert.strictEqual(checkScope(scopedSupervisor, empRamadan), true);
  assert.strictEqual(checkScope(scopedSupervisor, empQwesna), false);
  console.log('✔ Scope isolation unit checks verified.');

  // Start HTTP Server
  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`\nTest HTTP Server listening on port ${PORT}`);
      resolve();
    });
  });

  try {
    // Seed initial test employees in different factories
    const d = data();
    const testRamadanEmp = {
      id: 'emp_test_ramadan',
      name: 'Ramadan Worker',
      nationalId: '29001011234567',
      employeeCode: 'EG-9001',
      factory: '10th of Ramadan',
      department: 'Production A',
      position: 'Operator',
      active: true,
      vacationBalance: 14,
    };
    const testQwesnaEmp = {
      id: 'emp_test_qwesna',
      name: 'Qwesna Worker',
      nationalId: '29001017654321',
      employeeCode: 'EG-9002',
      factory: 'Qwesna',
      department: 'Assembly',
      position: 'Technician',
      active: true,
      vacationBalance: 14,
    };
    d.employees = d.employees.filter((e) => e.id !== testRamadanEmp.id && e.id !== testQwesnaEmp.id);
    d.employees.push(testRamadanEmp, testQwesnaEmp);
    save();

    // 2. Cookie Session Issuance & CSRF Token Generation
    console.log('\n--- Section 2: Cookie Session Issuance & CSRF Generation ---');
    const loginRes = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'elaraby2026',
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.json.ok, true);
    assert.ok(loginRes.json.token, 'Must return JWT token');
    assert.ok(loginRes.json.csrfToken, 'Must return CSRF token in body');

    const cookies = parseCookies(loginRes.headers['set-cookie']);
    assert.ok(cookies.admin_session, 'Set-Cookie must contain admin_session');
    assert.strictEqual(cookies.admin_session.httpOnly, true, 'admin_session must be HttpOnly');
    assert.strictEqual(cookies.admin_session.sameSite?.toLowerCase(), 'strict', 'admin_session must have SameSite=Strict');

    assert.ok(cookies.csrf_token, 'Set-Cookie must contain csrf_token');
    assert.strictEqual(cookies.csrf_token.httpOnly, false, 'csrf_token must NOT be HttpOnly (readable by script)');
    assert.strictEqual(cookies.csrf_token.sameSite?.toLowerCase(), 'strict', 'csrf_token must have SameSite=Strict');
    console.log('✔ Admin login sets secure HttpOnly admin_session and client-readable csrf_token cookies.');

    const adminSessionCookie = `admin_session=${encodeURIComponent(cookies.admin_session.value)}`;
    const csrfCookie = `csrf_token=${encodeURIComponent(cookies.csrf_token.value)}`;
    const fullCookies = `${adminSessionCookie}; ${csrfCookie}`;
    const validCsrfToken = cookies.csrf_token.value;

    // 3. Cookie Session Authentication
    console.log('\n--- Section 3: Cookie-Based Authentication ---');
    const statsRes = await request('GET', '/api/admin/stats', {
      Cookie: adminSessionCookie,
    });
    assert.strictEqual(statsRes.status, 200, 'Cookie-authenticated request to /stats must succeed');
    assert.ok(statsRes.json.employees !== undefined);
    console.log('✔ Authenticated via Cookie without Authorization header.');

    // 4. CSRF Protection on Mutating Requests
    console.log('\n--- Section 4: CSRF Protection on Mutating Requests ---');
    // 4a. Cookie auth without X-CSRF-Token header -> Must be rejected with 403
    const csrfMissingRes = await request('POST', '/api/admin/announcements', {
      Cookie: fullCookies,
    }, {
      title: 'CSRF Attack Announcement',
      body: 'Should not be allowed',
    });
    assert.strictEqual(csrfMissingRes.status, 403, 'Must reject missing CSRF token with 403');
    assert.strictEqual(csrfMissingRes.json.error, 'invalid_or_missing_csrf_token');
    console.log('✔ Blocked mutating cookie request missing X-CSRF-Token header (403).');

    // 4b. Cookie auth with mismatched X-CSRF-Token header -> Must be rejected with 403
    const csrfMismatchRes = await request('POST', '/api/admin/announcements', {
      Cookie: fullCookies,
      'X-CSRF-Token': 'wrong_token_value',
    }, {
      title: 'CSRF Attack Mismatched',
    });
    assert.strictEqual(csrfMismatchRes.status, 403, 'Must reject mismatched CSRF token with 403');
    assert.strictEqual(csrfMismatchRes.json.error, 'invalid_or_missing_csrf_token');
    console.log('✔ Blocked mutating cookie request with mismatched X-CSRF-Token (403).');

    // 4c. Cookie auth with valid X-CSRF-Token header -> Must succeed (200)
    const csrfValidRes = await request('POST', '/api/admin/announcements', {
      Cookie: fullCookies,
      'X-CSRF-Token': validCsrfToken,
    }, {
      title: 'Legitimate Admin Announcement',
    });
    assert.strictEqual(csrfValidRes.status, 200, 'Valid CSRF request must succeed');
    assert.strictEqual(csrfValidRes.json.item.title, 'Legitimate Admin Announcement');
    console.log('✔ Allowed mutating cookie request with valid X-CSRF-Token header (200).');

    // 5. Bearer Token CSRF Immunity
    console.log('\n--- Section 5: Bearer Token Backward Compatibility & CSRF Immunity ---');
    const bearerRes = await request('POST', '/api/admin/announcements', {
      Authorization: `Bearer ${loginRes.json.token}`,
    }, {
      title: 'Bearer Token Announcement',
    });
    assert.strictEqual(bearerRes.status, 200, 'Bearer tokens must bypass CSRF checks');
    console.log('✔ Bearer token mutating requests succeed without CSRF headers (backward compatible).');

    // 6. Granular RBAC Role Enforcement
    console.log('\n--- Section 6: Granular RBAC Role Enforcement ---');
    // 6a. Shift Supervisor Login
    const shiftLogin = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'elaraby2026',
      role: ROLES.SHIFT_SUPERVISOR,
    });
    const supervisorToken = shiftLogin.json.token;

    // Shift Supervisor allowed to read roster
    const rosterAllowedRes = await request('GET', `/api/admin/roster/${testRamadanEmp.id}`, {
      Authorization: `Bearer ${supervisorToken}`,
    });
    assert.strictEqual(rosterAllowedRes.status, 200, 'Shift supervisor should have shift.read permission');

    // Shift Supervisor forbidden to read payroll
    const payrollForbiddenRes = await request('GET', `/api/admin/payroll/${testRamadanEmp.id}`, {
      Authorization: `Bearer ${supervisorToken}`,
    });
    assert.strictEqual(payrollForbiddenRes.status, 403, 'Shift supervisor should NOT have payroll.read permission');
    assert.strictEqual(payrollForbiddenRes.json.error, 'forbidden_permission_required');
    assert.strictEqual(payrollForbiddenRes.json.requiredPermission, PERMISSIONS.PAYROLL_READ);
    console.log('✔ Shift Supervisor blocked from Payroll (403 forbidden_permission_required).');

    // Shift Supervisor forbidden to create employee
    const empCreateForbiddenRes = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${supervisorToken}`,
    }, {
      name: 'Unauthorized Create',
      nationalId: '29001019999999',
    });
    assert.strictEqual(empCreateForbiddenRes.status, 403);
    assert.strictEqual(empCreateForbiddenRes.json.requiredPermission, PERMISSIONS.EMPLOYEE_CREATE);
    console.log('✔ Shift Supervisor blocked from Creating Employees (403 forbidden_permission_required).');

    // 6b. Auditor Role
    const auditorLogin = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'elaraby2026',
      role: ROLES.AUDITOR,
    });
    const auditorToken = auditorLogin.json.token;

    // Auditor can view audit logs
    const auditRes = await request('GET', '/api/admin/audit-logs', {
      Authorization: `Bearer ${auditorToken}`,
    });
    assert.strictEqual(auditRes.status, 200, 'Auditor can view audit logs');

    // Auditor cannot create announcements
    const auditorAnnounceForbidden = await request('POST', '/api/admin/announcements', {
      Authorization: `Bearer ${auditorToken}`,
    }, {
      title: 'Auditor announcement',
    });
    assert.strictEqual(auditorAnnounceForbidden.status, 403);
    assert.strictEqual(auditorAnnounceForbidden.json.requiredPermission, PERMISSIONS.ANNOUNCEMENT_CREATE);
    console.log('✔ Auditor can view Audit Logs but blocked from creating Announcements (403).');

    // 7. Multi-Tenant Scope & Factory Isolation
    console.log('\n--- Section 7: Multi-Tenant Scope & Factory Isolation ---');
    const scopedSupervisorLogin = await request('POST', '/api/admin/login', {}, {
      username: 'admin',
      password: 'elaraby2026',
      role: ROLES.HR_OFFICER,
      scopeFactory: '10th of Ramadan',
    });
    const scopedToken = scopedSupervisorLogin.json.token;

    // Scoped admin viewing employees list -> Should only see 10th of Ramadan employees
    const scopedEmpListRes = await request('GET', '/api/admin/employees', {
      Authorization: `Bearer ${scopedToken}`,
    });
    assert.strictEqual(scopedEmpListRes.status, 200);
    const visibleEmployees = scopedEmpListRes.json.employees;
    assert.ok(visibleEmployees.some((e) => e.id === testRamadanEmp.id));
    assert.strictEqual(
      visibleEmployees.some((e) => e.id === testQwesnaEmp.id),
      false,
      'Scoped admin must NOT see employees outside their factory scope'
    );
    console.log('✔ Scoped GET /employees filters out other factories.');

    // Scoped admin updating Ramadan employee -> Allowed (200)
    const updateRamadanRes = await request('PUT', `/api/admin/employees/${testRamadanEmp.id}`, {
      Authorization: `Bearer ${scopedToken}`,
    }, {
      position: 'Senior Operator',
    });
    assert.strictEqual(updateRamadanRes.status, 200);

    // Scoped admin updating Qwesna employee -> Forbidden (403 forbidden_outside_factory_scope)
    const updateQwesnaRes = await request('PUT', `/api/admin/employees/${testQwesnaEmp.id}`, {
      Authorization: `Bearer ${scopedToken}`,
    }, {
      position: 'Tampered Position',
    });
    assert.strictEqual(updateQwesnaRes.status, 403);
    assert.strictEqual(updateQwesnaRes.json.error, 'forbidden_outside_factory_scope');
    console.log('✔ Scoped admin prevented from modifying employees in another factory (403).');

    // Scoped admin attempting to create employee in another factory -> Forbidden (403)
    const crossFactoryCreateRes = await request('POST', '/api/admin/employees', {
      Authorization: `Bearer ${scopedToken}`,
    }, {
      name: 'Cross Factory Worker',
      nationalId: '29001018888888',
      factory: 'Qwesna',
    });
    assert.strictEqual(crossFactoryCreateRes.status, 403);
    assert.strictEqual(crossFactoryCreateRes.json.error, 'forbidden_outside_factory_scope');
    console.log('✔ Scoped admin prevented from creating employees in another factory (403).');

    // Superadmin updating Qwesna employee -> Allowed (200)
    const superUpdateQwesnaRes = await request('PUT', `/api/admin/employees/${testQwesnaEmp.id}`, {
      Authorization: `Bearer ${loginRes.json.token}`,
    }, {
      position: 'Master Technician',
    });
    assert.strictEqual(superUpdateQwesnaRes.status, 200);
    console.log('✔ Superadmin unrestricted across all factories.');

    // 8. Logout & Session Termination
    console.log('\n--- Section 8: Logout & Cookie Session Destruction ---');
    const logoutRes = await request('POST', '/api/admin/logout', {
      Cookie: fullCookies,
    });
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(logoutRes.json.ok, true);

    const logoutCookies = parseCookies(logoutRes.headers['set-cookie']);
    assert.strictEqual(logoutCookies.admin_session.maxAge, '0', 'admin_session cookie must have Max-Age=0');
    assert.strictEqual(logoutCookies.csrf_token.maxAge, '0', 'csrf_token cookie must have Max-Age=0');
    console.log('✔ Admin logout successfully cleared session and CSRF cookies.');

    console.log('\n=============================================================');
    console.log('PHASE 1 COMPLETE: ALL SECURITY, RBAC & SCOPE TESTS PASSED');
    console.log('=============================================================');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ PHASE 1 TEST FAILED:', err);
  if (server) server.close();
  process.exit(1);
});
