const assert = require('assert');
const { runWithTenantContext } = require('../src/tenantContext');
const repository = require('../src/db/repository');
const loanService = require('../src/services/loanService');
const attendanceService = require('../src/services/attendanceService');
const transportService = require('../src/services/transportService');
const overtimeService = require('../src/services/overtimeService');
const realtimeService = require('../src/services/realtimeService');
const { data: db } = require('../src/db');
const { seed } = require('../src/seed');

async function testSuite() {
  console.log('=============================================================');
  console.log('--- EXTENDED MULTI-TENANT & DOMAIN ISOLATION TEST SUITE ---');
  console.log('=============================================================\n');

  // Ensure database has multi-tenant seed
  seed();

  // -------------------------------------------------------------
  // Test 1: Multi-Tenant Loan Application & Currency Enforcement
  // -------------------------------------------------------------
  console.log('--- 1. Multi-Tenant Loan & Advance Domain ---');
  {
    // Elaraby employee (EGP)
    const elarabyLoan = runWithTenantContext({ tenantId: 'elaraby' }, () => {
      const elig = loanService.getLoanEligibility('emp_3');
      assert.strictEqual(elig.currency, 'EGP');
      assert.strictEqual(elig.tenantId, 'elaraby');

      return loanService.applyLoan('emp_3', {
        type: loanService.LOAN_TYPES.EMERGENCY_ADVANCE,
        amount: 800,
        installmentsCount: 2,
        purpose: 'medical',
        idempotencyKey: `idem_el_${Date.now()}`,
      });
    });

    assert.strictEqual(elarabyLoan.tenantId, 'elaraby');
    assert.strictEqual(elarabyLoan.currency, 'EGP');
    assert.strictEqual(elarabyLoan.amount, 800);
    console.log('  ✔ Elaraby employee applies for loan in EGP under elaraby tenant scope');

    // Gulf Industrial employee (SAR)
    const gulfLoan = runWithTenantContext({ tenantId: 'gulf_industrial' }, () => {
      const elig = loanService.getLoanEligibility('emp_gic_1');
      assert.strictEqual(elig.currency, 'SAR');
      assert.strictEqual(elig.tenantId, 'gulf_industrial');

      return loanService.applyLoan('emp_gic_1', {
        type: loanService.LOAN_TYPES.SOCIAL_LOAN,
        amount: 5000,
        installmentsCount: 6,
        purpose: 'family',
        idempotencyKey: `idem_gic_${Date.now()}`,
      });
    });

    assert.strictEqual(gulfLoan.tenantId, 'gulf_industrial');
    assert.strictEqual(gulfLoan.currency, 'SAR');
    assert.strictEqual(gulfLoan.amount, 5000);
    console.log('  ✔ Gulf Industrial employee applies for loan in SAR under gulf_industrial tenant scope');

    // Cross-tenant loan visibility isolation
    runWithTenantContext({ tenantId: 'elsewedy' }, () => {
      const loans = loanService.getEmployeeLoans('emp_gic_1');
      assert.strictEqual(loans.length, 0, 'Elsewedy tenant should NOT see Gulf Industrial employee loans');
      console.log('  ✔ Strict cross-tenant isolation: Elsewedy tenant cannot view Gulf Industrial employee loans');
    });
  }

  // -------------------------------------------------------------
  // Test 2: Multi-Tenant Attendance Geofencing
  // -------------------------------------------------------------
  console.log('\n--- 2. Multi-Tenant Attendance Geofencing ---');
  {
    // Punch inside Elaraby Benha complex
    const benhaPunch = runWithTenantContext({ tenantId: 'elaraby' }, () => {
      return attendanceService.recordPunch('emp_1', {
        type: 'in',
        lat: 30.466,
        lng: 31.1834,
      });
    });

    assert.strictEqual(benhaPunch.geofence.withinGeofence, true);
    assert.strictEqual(benhaPunch.tenantId, 'elaraby');
    console.log('  ✔ Elaraby employee punch at Benha coordinates successfully detected within geofence');

    // Punch at Benha coordinates by Elsewedy employee (Elsewedy factories are in 10th of Ramadan and Ain Sokhna)
    const elsewedyPunch = runWithTenantContext({ tenantId: 'elsewedy' }, () => {
      return attendanceService.recordPunch('emp_swd_1', {
        type: 'in',
        lat: 30.466, // Benha coordinates
        lng: 31.1834,
        strict: false,
      });
    });

    assert.strictEqual(elsewedyPunch.isOutOfBounds, true);
    assert.strictEqual(elsewedyPunch.geofence.withinGeofence, false);
    console.log('  ✔ Elsewedy employee at Benha flagged as out-of-bounds relative to Elsewedy plant geofences');

    // Strict mode rejection
    let rejected = false;
    try {
      runWithTenantContext({ tenantId: 'elsewedy' }, () => {
        attendanceService.recordPunch('emp_swd_1', {
          type: 'in',
          lat: 30.466,
          lng: 31.1834,
          strict: true,
        });
      });
    } catch (err) {
      if (err.statusCode === 403 || err.code === 'OUT_OF_GEOFENCE') {
        rejected = true;
      }
    }
    assert.strictEqual(rejected, true, 'Strict geofence mode must reject out-of-bounds punch');
    console.log('  ✔ Strict geofence enforcement mode successfully rejects out-of-bounds punch with 403');
  }

  // -------------------------------------------------------------
  // Test 3: Multi-Tenant Bus Fleet Partitioning & Shared Shuttles
  // -------------------------------------------------------------
  console.log('\n--- 3. Multi-Tenant Bus Fleet Partitioning ---');
  {
    // Elsewedy routes query
    const elsewedyRoutes = runWithTenantContext({ tenantId: 'elsewedy' }, () => {
      return transportService.getRoutes();
    });

    const hasElsewedyRoute = elsewedyRoutes.some((r) => r.code === 'SWD-101');
    const hasSharedRoute = elsewedyRoutes.some((r) => r.isShared);
    const hasPrivateElarabyRoute = elsewedyRoutes.some((r) => r.code === 'BUS-101' && !r.isShared);

    assert.strictEqual(hasElsewedyRoute, true, 'Elsewedy routes must be visible to Elsewedy tenant');
    assert.strictEqual(hasSharedRoute, true, 'Shared consortium shuttle must be visible to Elsewedy tenant');
    assert.strictEqual(hasPrivateElarabyRoute, false, 'Private Elaraby routes must NOT be visible to Elsewedy tenant');
    console.log('  ✔ Elsewedy tenant sees Elsewedy routes and shared consortium shuttles, but NOT private Elaraby routes');

    // Cross-tenant getRouteById access control
    runWithTenantContext({ tenantId: 'elsewedy' }, () => {
      const privateElarabyRoute = transportService.getRouteById('route_101');
      assert.strictEqual(privateElarabyRoute, null, 'Elsewedy tenant cannot directly access private Elaraby route by ID');
      console.log('  ✔ Direct route lookup by ID enforces cross-tenant access boundary');
    });
  }

  // -------------------------------------------------------------
  // Test 4: Real-time SSE Tenant Channel Partitioning
  // -------------------------------------------------------------
  console.log('\n--- 4. Real-time SSE Tenant Channel Partitioning ---');
  {
    const receivedElarabyEvents = [];
    const receivedElsewedyEvents = [];

    // Mock Express responses
    const mockResElaraby = {
      writeHead: () => {},
      write: (data) => {
        if (!data.startsWith(':')) receivedElarabyEvents.push(data);
      },
    };
    const mockResElsewedy = {
      writeHead: () => {},
      write: (data) => {
        if (!data.startsWith(':')) receivedElsewedyEvents.push(data);
      },
    };

    const clientElaraby = realtimeService.subscribe({ on: () => {} }, mockResElaraby, {
      sub: 'emp_1',
      tenantId: 'elaraby',
      role: 'employee',
    });

    const clientElsewedy = realtimeService.subscribe({ on: () => {} }, mockResElsewedy, {
      sub: 'emp_swd_1',
      tenantId: 'elsewedy',
      role: 'employee',
    });

    // Clear initial handshake message
    receivedElarabyEvents.length = 0;
    receivedElsewedyEvents.length = 0;

    // Broadcast event for Elaraby tenant only
    realtimeService.broadcast('payroll.statement_ready', {
      tenantId: 'elaraby',
      message: 'August statement published',
    }, { tenantId: 'elaraby' });

    assert.strictEqual(receivedElarabyEvents.length, 1, 'Elaraby client must receive Elaraby event');
    assert.strictEqual(receivedElsewedyEvents.length, 0, 'Elsewedy client must NOT receive Elaraby event');
    console.log('  ✔ Real-time SSE broadcast filtered server-side: zero leakage to other tenants');
  }

  // -------------------------------------------------------------
  // Test 5: Repository Multi-Tenant Dual-Mode Persistence
  // -------------------------------------------------------------
  console.log('\n--- 5. Repository Multi-Tenant Dual-Mode Persistence ---');
  {
    const otRequest = await runWithTenantContext({ tenantId: 'ghabbour' }, async () => {
      return repository.createOvertimeRequest({
        employeeId: 'emp_gb_1',
        shiftDate: '2026-10-15',
        hours: 3.5,
        reason: 'Automotive assembly overtime',
        status: 'pending',
      });
    });

    assert.strictEqual(otRequest.tenantId, 'ghabbour');
    assert.strictEqual(otRequest.hours, 3.5);

    // Query back under Ghabbour context
    const gbList = await runWithTenantContext({ tenantId: 'ghabbour' }, async () => {
      return repository.listOvertimeByEmployee('emp_gb_1');
    });
    assert.ok(gbList.some((o) => o.id === otRequest.id));

    // Query back under TMG context (cross-tenant check)
    const tmgList = await runWithTenantContext({ tenantId: 'tmg' }, async () => {
      return repository.listOvertimeByEmployee('emp_gb_1');
    });
    assert.strictEqual(tmgList.length, 0, 'TMG context must not find Ghabbour employee overtime requests');
    console.log('  ✔ Repository persistence guarantees tenant-scoped isolation for overtime records');
  }

  // -------------------------------------------------------------
  // Test 6: Cross-Tenant Request Header Spoofing Rejection
  // -------------------------------------------------------------
  console.log('\n--- 6. Cross-Tenant Request Header Spoofing Rejection ---');
  {
    const { requireAuth, signToken } = require('../src/auth');
    const elarabyToken = signToken({
      sub: 'emp_1',
      scope: 'employee',
      tenantId: 'elaraby',
      tokenVersion: 1,
    });

    let statusCode = null;
    let errorResponse = null;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { errorResponse = data; },
        };
      },
    };

    const mockReq = {
      headers: {
        authorization: `Bearer ${elarabyToken}`,
        'x-tenant-id': 'elsewedy', // Spoofed header attempting to operate as Elsewedy
      },
    };

    requireAuth(mockReq, mockRes, () => {
      assert.fail('Spoofed cross-tenant request should NOT call next()');
    });

    assert.strictEqual(statusCode, 403, 'Cross-tenant spoofing must return HTTP 403 Forbidden');
    assert.strictEqual(errorResponse.error, 'cross_tenant_forbidden');
    console.log('  ✔ Defense-in-depth: Employee token with spoofed X-Tenant-ID header strictly rejected with 403 Forbidden');
  }

  console.log('\n=============================================================');
  console.log('ALL EXTENDED MULTI-TENANT & DOMAIN ISOLATION TESTS PASSED (0 FAILURES)');
  console.log('=============================================================');
}

if (require.main === module) {
  testSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Test Suite Failed:', err);
      process.exit(1);
    });
}

module.exports = { testSuite };
