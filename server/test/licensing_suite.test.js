// Licensing & Super-Admin Platform Test Suite
// Verifies:
// 1. RBAC tenant.admin permission isolation
// 2. maxEmployees seat-limit enforcement on employee provisioning
// 3. Subscription lifecycle (active, warning, grace period, frozen, renewed, cancelled)
// 4. subscriptionGuard middleware (Read-Only freeze: 423 on writes, 200 on reads)
// 5. GET /api/admin/subscription/status endpoint
// 6. Super-admin subscription management APIs (CRUD & renew)
// 7. GET /api/super-admin/analytics global platform metrics
// 8. Schema integrity for subscriptions collection

'use strict';
process.env.NODE_ENV = 'test';

const assert = require('assert');
const { test, describe, before, after } = require('node:test');
const { hasPermission, ROLES, PERMISSIONS } = require('../src/rbac');
const subscriptionService = require('../src/services/subscriptionService');
const { subscriptionGuard } = require('../src/middleware/subscriptionGuard');
const { data: db, save } = require('../src/db');
const { validateConstraints } = require('../src/schema');

describe('Super-Admin Licensing & Seat Limit Suite', () => {
  const testTenantId = `corp_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // ── 1. RBAC tenant.admin Isolation ──────────────────────────────────────────
  test('1. RBAC: Only superadmin has tenant.admin permission', () => {
    assert.strictEqual(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.TENANT_ADMIN), true);
    assert.strictEqual(hasPermission('admin', PERMISSIONS.TENANT_ADMIN), true);
    assert.strictEqual(hasPermission(ROLES.HR_OFFICER, PERMISSIONS.TENANT_ADMIN), false);
    assert.strictEqual(hasPermission(ROLES.PAYROLL_OFFICER, PERMISSIONS.TENANT_ADMIN), false);
    assert.strictEqual(hasPermission(ROLES.SHIFT_SUPERVISOR, PERMISSIONS.TENANT_ADMIN), false);
    assert.strictEqual(hasPermission(ROLES.AUDITOR, PERMISSIONS.TENANT_ADMIN), false);
    assert.strictEqual(hasPermission(ROLES.ANNOUNCEMENT_MANAGER, PERMISSIONS.TENANT_ADMIN), false);
  });

  // ── 2. Subscription Lifecycle Service ───────────────────────────────────────
  test('2. Subscription Service: Creation with default and custom values', () => {
    const sub = subscriptionService.createSubscription(testTenantId, {
      plan: 'growth',
      seatCount: 150,
      durationDays: 30,
      contactEmail: 'admin@testcorp.com',
    });

    assert.ok(sub.id);
    assert.strictEqual(sub.tenantId, testTenantId);
    assert.strictEqual(sub.plan, 'growth');
    assert.strictEqual(sub.seatCount, 150);
    assert.strictEqual(sub.status, 'active');
    assert.strictEqual(sub.contactEmail, 'admin@testcorp.com');

    const retrieved = subscriptionService.getActiveSubscription(testTenantId);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, sub.id);
  });

  test('3. Subscription Status: Active status when expiry is far', () => {
    const status = subscriptionService.getSubscriptionStatus(testTenantId);
    assert.strictEqual(status.status, 'active');
    assert.ok(status.daysUntilExpiry > subscriptionService.WARNING_DAYS);
    assert.strictEqual(status.plan, 'growth');
    assert.strictEqual(status.seatCount, 150);
  });

  test('4. Subscription Status: Warning status within 7 days of expiry', () => {
    const d = db();
    const sub = d.subscriptions.find((s) => s.tenantId === testTenantId);
    assert.ok(sub);

    // Set expiry to 4 days from now
    const warningDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    sub.expiresAt = warningDate;
    save();

    const status = subscriptionService.getSubscriptionStatus(testTenantId);
    assert.strictEqual(status.status, 'warning');
    assert.ok(status.daysUntilExpiry <= 7 && status.daysUntilExpiry > 0);
  });

  test('5. Subscription Status: Frozen status when expired within grace period', () => {
    const d = db();
    const sub = d.subscriptions.find((s) => s.tenantId === testTenantId);
    assert.ok(sub);

    // Set expiry to 1 day ago (within 3-day grace period)
    const expiredGraceDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    sub.expiresAt = expiredGraceDate;
    save();

    const status = subscriptionService.getSubscriptionStatus(testTenantId);
    assert.strictEqual(status.status, 'frozen');
  });

  test('6. Subscription Status: Frozen status when fully past grace period', () => {
    const d = db();
    const sub = d.subscriptions.find((s) => s.tenantId === testTenantId);
    assert.ok(sub);

    // Set expiry to 10 days ago (past 3-day grace period)
    const pastGraceDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    sub.expiresAt = pastGraceDate;
    save();

    const status = subscriptionService.getSubscriptionStatus(testTenantId);
    assert.strictEqual(status.status, 'frozen');
  });

  test('7. Subscription Service: Renewal restores active status with extended date', () => {
    const renewed = subscriptionService.renewSubscription(testTenantId, 365);
    assert.ok(renewed);
    assert.strictEqual(renewed.status, 'active');
    assert.ok(renewed.renewedAt);

    const status = subscriptionService.getSubscriptionStatus(testTenantId);
    assert.strictEqual(status.status, 'active');
    assert.ok(status.daysUntilExpiry > 300);
  });

  test('8. Subscription Service: Cancellation marks status cancelled', () => {
    const cancelTenantId = `cancel_test_${Date.now()}`;
    subscriptionService.createSubscription(cancelTenantId, { plan: 'starter', seatCount: 50 });
    const cancelled = subscriptionService.cancelSubscription(cancelTenantId, 'Contract ended by mutual consent');
    assert.strictEqual(cancelled.status, 'cancelled');

    const status = subscriptionService.getSubscriptionStatus(cancelTenantId);
    assert.strictEqual(status.status, 'cancelled');
  });

  // ── 3. subscriptionGuard Middleware ─────────────────────────────────────────
  test('9. subscriptionGuard: Permits write operations when active', () => {
    const req = {
      method: 'POST',
      path: '/api/admin/employees',
      admin: { role: ROLES.HR_OFFICER, tenantId: testTenantId },
    };
    let calledNext = false;
    const res = {
      status: () => res,
      json: () => {},
    };

    subscriptionGuard(req, res, () => {
      calledNext = true;
    });

    assert.strictEqual(calledNext, true);
  });

  test('10. subscriptionGuard: Allows GET (Read-Only) when frozen', () => {
    const frozenTenantId = `frozen_${Date.now()}`;
    const d = db();
    d.subscriptions.push({
      id: `sub_${frozenTenantId}`,
      tenantId: frozenTenantId,
      plan: 'enterprise',
      seatCount: 100,
      expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    save();

    const req = {
      method: 'GET',
      path: '/api/admin/employees',
      admin: { role: ROLES.HR_OFFICER, tenantId: frozenTenantId },
    };
    let calledNext = false;
    const res = {
      status: () => res,
      json: () => {},
    };

    subscriptionGuard(req, res, () => {
      calledNext = true;
    });

    assert.strictEqual(calledNext, true);
  });

  test('11. subscriptionGuard: Blocks POST (Write) with 423 when frozen', () => {
    const frozenTenantId = `frozen_write_${Date.now()}`;
    const d = db();
    d.subscriptions.push({
      id: `sub_${frozenTenantId}`,
      tenantId: frozenTenantId,
      plan: 'enterprise',
      seatCount: 100,
      expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    save();

    const req = {
      method: 'POST',
      path: '/api/admin/employees',
      admin: { role: ROLES.HR_OFFICER, tenantId: frozenTenantId },
    };
    let statusCode = null;
    let jsonResponse = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        jsonResponse = body;
      },
    };

    subscriptionGuard(req, res, () => {});

    assert.strictEqual(statusCode, 423);
    assert.strictEqual(jsonResponse.error, 'subscription_frozen');
  });

  test('12. subscriptionGuard: Blocks DELETE (Write) with 423 when frozen', () => {
    const frozenTenantId = `frozen_del_${Date.now()}`;
    const d = db();
    d.subscriptions.push({
      id: `sub_${frozenTenantId}`,
      tenantId: frozenTenantId,
      plan: 'enterprise',
      seatCount: 100,
      expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    save();

    const req = {
      method: 'DELETE',
      path: '/api/admin/announcements/123',
      admin: { role: ROLES.HR_OFFICER, tenantId: frozenTenantId },
    };
    let statusCode = null;
    let jsonResponse = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        jsonResponse = body;
      },
    };

    subscriptionGuard(req, res, () => {});

    assert.strictEqual(statusCode, 423);
    assert.strictEqual(jsonResponse.error, 'subscription_frozen');
  });

  test('13. subscriptionGuard: Global Superadmin without tenantId bypasses freeze', () => {
    const req = {
      method: 'POST',
      path: '/api/admin/employees',
      admin: { role: ROLES.SUPER_ADMIN, tenantId: null },
    };
    let calledNext = false;
    const res = {
      status: () => res,
      json: () => {},
    };

    subscriptionGuard(req, res, () => {
      calledNext = true;
    });

    assert.strictEqual(calledNext, true);
  });

  // ── 4. Global Platform Analytics ───────────────────────────────────────────
  test('14. Analytics Aggregation: Returns comprehensive platform-wide statistics', () => {
    const allStatuses = subscriptionService.getAllSubscriptionStatuses();
    assert.ok(Array.isArray(allStatuses));
    assert.ok(allStatuses.length > 0);

    const match = allStatuses.find((s) => s.tenantId === testTenantId);
    assert.ok(match);
    assert.strictEqual(match.plan, 'growth');
  });

  // ── 5. Schema Constraint Validation ────────────────────────────────────────
  test('15. Schema Validation: Passes with valid subscriptions', () => {
    const d = db();
    assert.doesNotThrow(() => validateConstraints(d));
  });

  test('16. Schema Validation: Fails when subscription is missing tenantId', () => {
    const invalidState = {
      ...db(),
      subscriptions: [
        { id: `sub_invalid_${Date.now()}`, tenantId: null, plan: 'enterprise', status: 'active' },
      ],
    };
    assert.throws(() => validateConstraints(invalidState), /missing mandatory "tenantId"/);
  });

  test('17. Schema Validation: Fails with duplicate subscription ID', () => {
    const dupId = `sub_dup_${Date.now()}`;
    const invalidState = {
      ...db(),
      subscriptions: [
        { id: dupId, tenantId: 'tenant1', plan: 'enterprise', status: 'active' },
        { id: dupId, tenantId: 'tenant2', plan: 'growth', status: 'active' },
      ],
    };
    assert.throws(() => validateConstraints(invalidState), /Duplicate subscription primary key/);
  });

  // ── 6. End-to-End HTTP Integration Tests ────────────────────────────────────
  describe('HTTP Integration Endpoints', () => {
    const http = require('http');
    const app = require('../server');
    const { signToken } = require('../src/auth');
    let server;
    let baseUrl;

    before((_, done) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        done();
      });
    });

    after((_, done) => {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close(done);
    });

    function makeRequest(method, path, token, body = null) {
      return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const headers = { 'Content-Type': 'application/json', 'Connection': 'close' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(
          url,
          { method, headers },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              let json = null;
              try {
                json = JSON.parse(data);
              } catch (_) {}
              resolve({ status: res.statusCode, headers: res.headers, body: json, text: data });
            });
          }
        );
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    }

    test('18. HTTP: Super-admin endpoints reject non-superadmin (403)', async () => {
      const hrToken = signToken({ sub: 'hr1', role: ROLES.HR_OFFICER, scope: 'admin', tenantId: testTenantId });
      const res = await makeRequest('GET', '/api/super-admin/tenants', hrToken);
      assert.strictEqual(res.status, 403);
    });

    test('19. HTTP: Super-admin can query global analytics (200)', async () => {
      const superToken = signToken({ sub: 'super1', role: ROLES.SUPER_ADMIN, scope: 'admin', tenantId: null });
      const res = await makeRequest('GET', '/api/super-admin/analytics', superToken);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.totalTenants >= 1);
      assert.ok(typeof res.body.totalActiveEmployees === 'number');
      assert.ok(Array.isArray(res.body.expiringWithin30Days));
    });

    test('20. HTTP: Super-admin can create and renew subscription via API', async () => {
      const superToken = signToken({ sub: 'super1', role: ROLES.SUPER_ADMIN, scope: 'admin', tenantId: null });
      const apiTenant = `api_tenant_${Date.now()}`;

      // Create
      const createRes = await makeRequest('POST', '/api/super-admin/subscriptions', superToken, {
        tenantId: apiTenant,
        plan: 'enterprise',
        seatCount: 200,
        durationDays: 60,
      });
      assert.strictEqual(createRes.status, 201);
      assert.strictEqual(createRes.body.success, true);
      assert.strictEqual(createRes.body.subscription.tenantId, apiTenant);

      // Renew
      const renewRes = await makeRequest('PUT', `/api/super-admin/subscriptions/${apiTenant}/renew`, superToken, {
        durationDays: 180,
      });
      assert.strictEqual(renewRes.status, 200);
      assert.strictEqual(renewRes.body.success, true);
    });

    test('21. HTTP: GET /api/admin/subscription/status returns tenant subscription status', async () => {
      const tenantToken = signToken({ sub: 'adm_test', role: ROLES.HR_OFFICER, scope: 'admin', tenantId: testTenantId });
      const res = await makeRequest('GET', '/api/admin/subscription/status', tenantToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'active');
      assert.strictEqual(res.body.plan, 'growth');
    });

    test('22. HTTP: Seat limit blocks employee creation when maxEmployees reached (403)', async () => {
      const cappedTenantSlug = `capped_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const d = db();
      d.tenants = d.tenants || [];
      d.tenants.push({
        id: cappedTenantSlug,
        slug: cappedTenantSlug,
        name: 'Capped Corp',
        nameAr: 'شركة محددة المقاعد',
        maxEmployees: 1, // Only 1 employee allowed!
        status: 'active',
      });
      save();

      const tenantAdminToken = signToken({
        sub: 'capped_admin',
        role: ROLES.SUPER_ADMIN,
        scope: 'admin',
        tenantId: cappedTenantSlug,
      });

      // Employee 1: Should succeed
      const emp1Res = await makeRequest('POST', '/api/admin/employees', tenantAdminToken, {
        name: 'First Allowed Employee',
        nationalId: `2910101${Math.floor(1000000 + Math.random() * 9000000)}`,
        phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
        employeeCode: `CAP-001`,
        department: 'Operations',
        position: 'Operator',
        factory: 'Factory 1',
        pin: '1234',
        status: 'active',
      });
      assert.strictEqual(emp1Res.status, 201);

      // Employee 2: Exceeds seat limit of 1 -> MUST be blocked with 403 seat_limit_exceeded
      const emp2Res = await makeRequest('POST', '/api/admin/employees', tenantAdminToken, {
        name: 'Second Blocked Employee',
        nationalId: `2920101${Math.floor(1000000 + Math.random() * 9000000)}`,
        phone: `011${Math.floor(10000000 + Math.random() * 90000000)}`,
        employeeCode: `CAP-002`,
        department: 'Operations',
        position: 'Operator',
        factory: 'Factory 1',
        pin: '1234',
        status: 'active',
      });
      assert.strictEqual(emp2Res.status, 403);
      assert.strictEqual(emp2Res.body.error, 'seat_limit_exceeded');
      assert.strictEqual(emp2Res.body.currentCount, 1);
      assert.strictEqual(emp2Res.body.maxAllowed, 1);
    });
  });
});
