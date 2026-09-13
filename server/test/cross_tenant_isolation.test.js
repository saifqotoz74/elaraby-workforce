// Enterprise Cross-Tenant Isolation & Multi-Factory Security Test Suite
// Verifies that administrative and employee actors from Factory/Tenant A
// cannot access, mutate, approve, or leak records belonging to Factory/Tenant B.

const assert = require('assert');
const { checkScope, ROLES, PERMISSIONS } = require('../src/rbac');
const employeeService = require('../src/services/employeeService');
const leaveService = require('../src/services/leaveService');
const { data: db, transaction } = require('../src/db');

async function runTests() {
  console.log('=============================================================');
  console.log('--- ENTERPRISE CROSS-TENANT ISOLATION SECURITY SUITE ---');
  console.log('=============================================================\n');

  // Set up mock institutional tenants / factories
  const tenantA_Employee = {
    id: 'emp_tenant_a_101',
    name: 'Ahmed Tenant A',
    factory: 'Benha Complex',
    department: 'Electronics',
    nationalId: '29001011234561',
    vacationBalance: 21.0,
    active: true,
  };

  const tenantB_Employee = {
    id: 'emp_tenant_b_202',
    name: 'Mahmoud Tenant B',
    factory: 'Quesna Industrial',
    department: 'Refrigerators',
    nationalId: '29002021234562',
    vacationBalance: 15.0,
    active: true,
  };

  const d = db();
  d.employees = d.employees.filter((e) => e.id !== tenantA_Employee.id && e.id !== tenantB_Employee.id);
  d.employees.push(tenantA_Employee, tenantB_Employee);

  // Administrative Actors
  const adminFactoryA = {
    sub: 'hr_benha',
    role: ROLES.HR_OFFICER,
    scopeFactory: 'Benha Complex',
    scopeDepartment: null,
  };

  const adminFactoryB = {
    sub: 'hr_quesna',
    role: ROLES.HR_OFFICER,
    scopeFactory: 'Quesna Industrial',
    scopeDepartment: null,
  };

  const superAdmin = {
    sub: 'superadmin_corp',
    role: ROLES.SUPER_ADMIN,
    scopeFactory: null,
    scopeDepartment: null,
  };

  // 1. RBAC checkScope Unit Isolation
  console.log('--- 1. Organizational Scope Isolation Gate ---');
  assert.strictEqual(checkScope(adminFactoryA, tenantA_Employee), true, 'Admin A can access Tenant A');
  assert.strictEqual(checkScope(adminFactoryA, tenantB_Employee), false, 'Admin A MUST NOT access Tenant B');
  assert.strictEqual(checkScope(adminFactoryB, tenantA_Employee), false, 'Admin B MUST NOT access Tenant A');
  assert.strictEqual(checkScope(adminFactoryB, tenantB_Employee), true, 'Admin B can access Tenant B');
  assert.strictEqual(checkScope(superAdmin, tenantA_Employee), true, 'SuperAdmin can access Tenant A');
  assert.strictEqual(checkScope(superAdmin, tenantB_Employee), true, 'SuperAdmin can access Tenant B');
  console.log('✔ Scope isolation gate strictly prevents cross-factory authorization.');

  // 2. Cross-Tenant Employee Read & Query Leakage
  console.log('\n--- 2. Employee Directory Factory Partitioning ---');
  const listForAdminA = employeeService.listEmployees(adminFactoryA, {});
  const hasTenantB = listForAdminA.employees.some((e) => e.factory === 'Quesna Industrial');
  assert.strictEqual(hasTenantB, false, 'Admin A directory query MUST NOT leak Tenant B employees');

  const listForAdminB = employeeService.listEmployees(adminFactoryB, {});
  const hasTenantA = listForAdminB.employees.some((e) => e.factory === 'Benha Complex');
  assert.strictEqual(hasTenantA, false, 'Admin B directory query MUST NOT leak Tenant A employees');

  const listForSuper = employeeService.listEmployees(superAdmin, {});
  assert.ok(listForSuper.employees.length >= 2, 'SuperAdmin sees enterprise-wide roster');
  console.log('✔ Employee queries strictly partitioned by factory boundary.');

  // 3. Cross-Tenant Direct Object Reference (IDOR) on Employee Retrieval
  console.log('\n--- 3. Direct IDOR Access Prevention on Employee Records ---');
  const readOwn = employeeService.getEmployee(adminFactoryA, tenantA_Employee.id);
  assert.strictEqual(readOwn.id, tenantA_Employee.id);

  try {
    employeeService.getEmployee(adminFactoryA, tenantB_Employee.id);
    assert.fail('Admin A must not be allowed to get Tenant B employee by ID');
  } catch (err) {
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.message, 'forbidden_outside_factory_scope');
    console.log('✔ Cross-tenant GET /api/admin/employees/:id rejected with 403 Forbidden.');
  }

  // 4. Cross-Tenant Leave Request Approval Tampering
  console.log('\n--- 4. Cross-Tenant Request Approval Interception Gate ---');
  const leaveReqB = {
    id: 'req_tenant_b_leave_999',
    employeeId: tenantB_Employee.id,
    type: 'Leave',
    status: 'inReview',
    days: 2,
    createdAt: Date.now(),
  };
  d.requests = d.requests.filter((r) => r.id !== leaveReqB.id);
  d.requests.push(leaveReqB);

  try {
    leaveService.decideRequest(adminFactoryA, leaveReqB.id, {
      status: 'approved',
      reason: 'Cross-tenant illegal approval attempt',
    });
    assert.fail('Admin A must not be permitted to approve leave for Tenant B employee');
  } catch (err) {
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.message, 'forbidden_outside_factory_scope');
    console.log('✔ Cross-tenant leave decision strictly blocked with 403.');
  }

  // Clean up
  d.employees = d.employees.filter((e) => e.id !== tenantA_Employee.id && e.id !== tenantB_Employee.id);
  d.requests = d.requests.filter((r) => r.id !== leaveReqB.id);

  console.log('\n=============================================================');
  console.log('ALL CROSS-TENANT ISOLATION TESTS PASSED (0 FAILURES)');
  console.log('=============================================================\n');
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Cross-tenant isolation tests failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
