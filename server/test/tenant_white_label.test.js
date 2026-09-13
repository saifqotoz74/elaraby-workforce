// Comprehensive Multi-Tenant & White-Label Test Suite
const assert = require('assert');
const { resolveTenantId, tenantResolver, DEFAULT_TENANT_ID } = require('../src/tenantResolver');
const { checkScope, ROLES } = require('../src/rbac');

async function runTests() {
  console.log('=============================================================');
  console.log('--- ENTERPRISE WHITE-LABEL & MULTI-TENANT TEST SUITE ---');
  console.log('=============================================================\n');

  // 1. Tenant Resolution Precedence
  console.log('--- 1. Tenant Resolution Resolution Precedence ---');
  // 1a. Default fallback
  const reqDefault = { headers: {} };
  assert.strictEqual(resolveTenantId(reqDefault), DEFAULT_TENANT_ID);
  console.log('✔ Fallback resolves to default institutional tenant (elaraby).');

  // 1b. Header resolution
  const reqHeader = { headers: { 'x-tenant-id': 'Elsewedy' } };
  assert.strictEqual(resolveTenantId(reqHeader), 'elsewedy');
  console.log('✔ X-Tenant-ID header overrides default with case-normalization.');

  // 1c. Subdomain resolution
  const reqSubdomain = { headers: { host: 'fresh.workforce.app:3000' } };
  assert.strictEqual(resolveTenantId(reqSubdomain), 'fresh');
  console.log('✔ Subdomain extracts tenant slug cleanly.');

  // 1d. Auth token scope resolution
  const reqAdmin = { headers: {}, admin: { tenantId: 'gulf_corp' } };
  assert.strictEqual(resolveTenantId(reqAdmin), 'gulf_corp');
  console.log('✔ Auth session token binds tenant scope.');

  // 1e. Query parameter resolution
  const reqQuery = { headers: {}, query: { tenant: 'custom_tenant' } };
  assert.strictEqual(resolveTenantId(reqQuery), 'custom_tenant');
  console.log('✔ Query parameter resolves tenant in dev/testing.');

  // 2. Tenant Middleware Execution
  console.log('\n--- 2. Tenant Middleware Context Binding ---');
  let nextCalled = false;
  const mockReq = { headers: { 'x-tenant-id': 'elsewedy' } };
  const mockRes = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  tenantResolver(mockReq, mockRes, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(mockReq.tenantId, 'elsewedy');
  assert.strictEqual(mockRes.headers['X-Tenant-ID'], 'elsewedy');
  console.log('✔ Middleware binds req.tenantId and sets response trace header.');

  // 3. RBAC Cross-Tenant Isolation
  console.log('\n--- 3. Multi-Tenant Organizational RBAC Isolation ---');
  const adminTenantA = {
    sub: 'admin_a',
    role: ROLES.HR_OFFICER,
    tenantId: 'tenant_a',
    scopeFactory: null,
  };
  const adminTenantB = {
    sub: 'admin_b',
    role: ROLES.HR_OFFICER,
    tenantId: 'tenant_b',
    scopeFactory: null,
  };
  const empTenantA = {
    id: 'emp_1',
    name: 'Tenant A Worker',
    tenantId: 'tenant_a',
    factory: 'Plant 1',
  };
  const empTenantB = {
    id: 'emp_2',
    name: 'Tenant B Worker',
    tenantId: 'tenant_b',
    factory: 'Plant 1',
  };
  const superAdmin = {
    sub: 'super_admin',
    role: ROLES.SUPER_ADMIN,
    tenantId: null,
  };

  assert.strictEqual(checkScope(adminTenantA, empTenantA), true, 'Admin A can access Tenant A');
  assert.strictEqual(checkScope(adminTenantA, empTenantB), false, 'Admin A MUST NOT access Tenant B');
  assert.strictEqual(checkScope(adminTenantB, empTenantA), false, 'Admin B MUST NOT access Tenant A');
  assert.strictEqual(checkScope(adminTenantB, empTenantB), true, 'Admin B can access Tenant B');
  assert.strictEqual(checkScope(superAdmin, empTenantA), true, 'SuperAdmin can access Tenant A');
  assert.strictEqual(checkScope(superAdmin, empTenantB), true, 'SuperAdmin can access Tenant B');
  console.log('✔ Cross-tenant access strictly denied by RBAC checkScope gate.');

  // 4. Multi-Tenant SMS Routing
  console.log('\n--- 4. Multi-Tenant SMS Sender ID & Routing ---');
  const sms = require('../src/integrations/sms');
  const smsResultA = await sms.send('01012345678', 'Verification Code 1234', {
    tenantId: 'elsewedy',
    senderId: 'ELSEWEDY',
  });
  assert.strictEqual(smsResultA.success, true);
  assert.strictEqual(smsResultA.senderId, 'ELSEWEDY');
  assert.strictEqual(smsResultA.tenantId, 'elsewedy');

  const smsResultB = await sms.send('01098765432', 'Verification Code 5678', {
    tenantId: 'aramex',
    senderId: 'ARAMEX',
  });
  assert.strictEqual(smsResultB.success, true);
  assert.strictEqual(smsResultB.senderId, 'ARAMEX');
  assert.strictEqual(smsResultB.tenantId, 'aramex');
  console.log('✔ SMS dispatcher successfully routes tenant-specific sender IDs.');

  // 5. Super-Admin Tenant Provisioning & Config API
  console.log('\n--- 5. Super-Admin Provisioning & Tenant Lifecycle ---');
  const tenantRouter = require('../src/routes/tenant');
  const { data: db } = require('../src/db');
  
  // Helper to simulate express route handling
  function invokeRoute(method, path, body, adminPayload) {
    return new Promise((resolve) => {
      const routeLayer = tenantRouter.stack.find(
        (l) => l.route && (Array.isArray(l.route.path) ? l.route.path.includes(path) : l.route.path === path) && l.route.methods[method.toLowerCase()]
      );
      if (!routeLayer) throw new Error(`Route ${method} ${path} not found`);

      const req = {
        method,
        path,
        params: path.includes(':id') ? { id: path.split('/').pop() } : {},
        body: body || {},
        query: {},
        headers: { authorization: 'Bearer mock_token' },
        admin: adminPayload || { role: ROLES.SUPER_ADMIN, sub: 'admin_root' },
      };
      const res = {
        statusCode: 200,
        body: null,
        status(c) {
          this.statusCode = c;
          return this;
        },
        json(d) {
          this.body = d;
          resolve({ status: this.statusCode, body: this.body });
        },
      };

      // Find the final route handler
      const handler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;
      handler(req, res);
    });
  }

  // 5a. Super-admin lists all tenants
  const listRes = await invokeRoute('GET', '/super-admin/tenants');
  assert.strictEqual(listRes.status, 200);
  assert(listRes.body.totalTenants >= 3, 'Should list at least 3 default tenants');
  console.log('✔ Super-admin GET /super-admin/tenants lists active tenants with stats.');

  // 5b. Super-admin provisions a new tenant
  const newTenantSlug = `tenant_test_${Date.now()}`;
  const provRes = await invokeRoute('POST', '/super-admin/tenants', {
    slug: newTenantSlug,
    name: 'Logistics Plus',
    nameAr: 'لوجستكس بلس',
    brand: {
      primaryColor: '#FF6600',
      supportHotline: '18000',
    },
    features: {
      hasPayroll: true,
      hasShifts: false,
    },
    authMode: 'generic_employee_code',
    smsSenderId: 'LOGISTICS',
  });
  assert.strictEqual(provRes.status, 201);
  assert.strictEqual(provRes.body.tenant.slug, newTenantSlug);
  assert.strictEqual(provRes.body.tenant.brand.primaryColor, '#FF6600');
  console.log('✔ Super-admin POST /super-admin/tenants successfully provisions new tenant.');

  // 5c. Super-admin updates existing tenant
  const updateRes = await invokeRoute('PUT', '/super-admin/tenants/:id', {
    brand: { primaryColor: '#FF9900' },
    status: 'active',
  });
  // set correct param
  const updateReq = {
    method: 'PUT',
    path: `/super-admin/tenants/${newTenantSlug}`,
    params: { id: newTenantSlug },
    body: { brand: { primaryColor: '#FF8800' } },
    admin: { role: ROLES.SUPER_ADMIN, sub: 'admin_root' },
  };
  const updateHandler = tenantRouter.stack.find(
    (l) => l.route && (Array.isArray(l.route.path) ? l.route.path.includes('/super-admin/tenants/:id') : l.route.path === '/super-admin/tenants/:id') && l.route.methods.put
  ).route.stack.slice(-1)[0].handle;
  let updatedData = null;
  updateHandler(updateReq, {
    status(c) { return this; },
    json(d) { updatedData = d; },
  });
  assert.strictEqual(updatedData.tenant.brand.primaryColor, '#FF8800');
  console.log('✔ Super-admin PUT /super-admin/tenants/:id successfully updates tenant config.');

  // 5d. Super-admin soft deactivates tenant
  const deactReq = {
    method: 'DELETE',
    path: `/super-admin/tenants/${newTenantSlug}`,
    params: { id: newTenantSlug },
    body: {},
    admin: { role: ROLES.SUPER_ADMIN, sub: 'admin_root' },
  };
  const deactHandler = tenantRouter.stack.find(
    (l) => l.route && (Array.isArray(l.route.path) ? l.route.path.includes('/super-admin/tenants/:id') : l.route.path === '/super-admin/tenants/:id') && l.route.methods.delete
  ).route.stack.slice(-1)[0].handle;
  let deactData = null;
  deactHandler(deactReq, {
    status(c) { return this; },
    json(d) { deactData = d; },
  });
  assert.strictEqual(deactData.success, true);
  console.log('✔ Super-admin DELETE /super-admin/tenants/:id soft-deactivates tenant.');

  console.log('\n=============================================================');
  console.log('ALL WHITE-LABEL & MULTI-TENANT TESTS PASSED (0 FAILURES)');
  console.log('=============================================================\n');
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('White-label tests failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
