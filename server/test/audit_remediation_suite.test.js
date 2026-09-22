// Comprehensive Audit Remediation Verification Suite
// Validates DATA-002, TENANT-001, DB-001, UI-001, AUTH-003, and TEST-001

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const db = require('../src/db');
const { runWithTenantContext, getCurrentTenantId } = require('../src/tenantContext');
const kioskService = require('../src/services/kioskService');
const hseService = require('../src/services/hseService');
const incentivesDeductionsService = require('../src/services/incentivesDeductionsService');
const repository = require('../src/db/repository');
const { PERMISSIONS, ROLES } = require('../src/rbac');
const schema = require('../src/schema');
const postgres = require('../src/db/postgres');

async function runSuite() {
  console.log('=== Starting Re-Audit Remediation Verification Suite ===\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.stack || err.message}`);
      failed++;
    }
  }

  // Generate unique test tenant slugs
  const tenantA = `corp_a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tenantB = `corp_b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // =========================================================================
  // 1. DATA-002: Kiosk In-Memory Elimination & Persistent Multi-Tenant Isolation
  // =========================================================================
  console.log('--- 1. DATA-002: Kiosk Persistent Multi-Tenant Isolation ---');

  await test('DATA-002.1: Machines in Tenant A are strictly isolated from Tenant B', async () => {
    // Run in Tenant A context
    await runWithTenantContext({ tenantId: tenantA }, async () => {
      await kioskService.createMachine(tenantA, {
        id: 'M_ISO_01',
        name: 'Injection Molding Alpha',
        line: 'Line-A1',
        status: 'running',
        activeWorkOrderId: null,
      });

      const listA = kioskService.getMachineStatuses(tenantA);
      assert.strictEqual(listA.length, 1, 'Tenant A must have exactly 1 machine');
      assert.strictEqual(listA[0].id, 'M_ISO_01');
    });

    // Run in Tenant B context
    await runWithTenantContext({ tenantId: tenantB }, async () => {
      const listB = kioskService.getMachineStatuses(tenantB);
      assert.strictEqual(listB.length, 0, 'Tenant B must see 0 machines from Tenant A');
    });
  });

  await test('DATA-002.2: Identical machine ID in Tenant A and Tenant B co-exist without collision', async () => {
    // Create machine with same ID 'M_SHARED' in Tenant A and Tenant B
    await runWithTenantContext({ tenantId: tenantA }, async () => {
      await kioskService.createMachine(tenantA, {
        id: 'M_SHARED',
        name: 'Machine Tenant A',
        line: 'Line-A',
        status: 'running',
      });
    });

    await runWithTenantContext({ tenantId: tenantB }, async () => {
      await kioskService.createMachine(tenantB, {
        id: 'M_SHARED',
        name: 'Machine Tenant B',
        line: 'Line-B',
        status: 'idle',
      });
    });

    // Verify properties remain distinct and isolated
    await runWithTenantContext({ tenantId: tenantA }, async () => {
      const mA = kioskService.getMachineStatuses(tenantA).find((m) => m.id === 'M_SHARED');
      assert.ok(mA, 'Tenant A machine must exist');
      assert.strictEqual(mA.name, 'Machine Tenant A');
      assert.strictEqual(mA.status, 'running');
    });

    await runWithTenantContext({ tenantId: tenantB }, async () => {
      const mB = kioskService.getMachineStatuses(tenantB).find((m) => m.id === 'M_SHARED');
      assert.ok(mB, 'Tenant B machine must exist');
      assert.strictEqual(mB.name, 'Machine Tenant B');
      assert.strictEqual(mB.status, 'idle');
    });
  });

  await test('DATA-002.3: Machine stoppages and resolution are strictly tenant-isolated', async () => {
    await runWithTenantContext({ tenantId: tenantA }, async () => {
      const stoppageRes = kioskService.reportStoppage(tenantA, 'M_ISO_01', 'Maintenance Jam', 'EMP_TECH_01');
      assert.ok(stoppageRes.success, 'Stoppage report must succeed');
      assert.strictEqual(stoppageRes.machine.status, 'stopped');

      // Machine status in A changed to stopped
      const mA = kioskService.getMachineStatuses(tenantA).find((m) => m.id === 'M_ISO_01');
      assert.strictEqual(mA.status, 'stopped');

      // Resolve stoppage
      const resolvedRes = kioskService.resolveStoppage(tenantA, 'M_ISO_01');
      assert.ok(resolvedRes.success, 'Resolution must succeed');
      assert.strictEqual(resolvedRes.machine.status, 'running');
    });

    await runWithTenantContext({ tenantId: tenantB }, async () => {
      const stoppagesB = await repository.listMachineStoppages(tenantB);
      assert.strictEqual(stoppagesB.length, 0, 'Tenant B must see 0 stoppages from Tenant A');
    });
  });

  await test('DATA-002.4: Work orders persist and transition cleanly in DB', async () => {
    await runWithTenantContext({ tenantId: tenantA }, async () => {
      const wo = await kioskService.createWorkOrder(tenantA, {
        id: 'WO_1001',
        title: 'Batch Assembly 1001',
        line: 'Line-A1',
        targetQty: 500,
        unit: 'pcs',
        status: 'in_progress',
      });

      assert.strictEqual(wo.id, 'WO_1001');
      assert.strictEqual(wo.status, 'in_progress');

      // Update work order
      const updated = await repository.updateWorkOrder('WO_1001', { completedQty: 500, status: 'completed' }, tenantA);
      assert.strictEqual(updated.status, 'completed');
      assert.strictEqual(updated.completedQty, 500);

      // Verify work orders list in tenant A has it
      const orders = kioskService.getWorkOrders(tenantA);
      const found = orders.find((o) => o.id === 'WO_1001');
      assert.ok(found, 'Work order must be retrieved in getWorkOrders');
      assert.strictEqual(found.status, 'completed');
    });
  });

  // =========================================================================
  // 2. TENANT-001: Ambient Context & Strict Tenant Isolation
  // =========================================================================
  console.log('\n--- 2. TENANT-001: Ambient Context & Strict Tenant Isolation ---');

  await test('TENANT-001.1: Missing tenant context throws strict tenant_context_required', async () => {
    // When called outside any tenant context with no explicit tenant
    assert.throws(
      () => {
        kioskService.getMachineStatuses();
      },
      (err) => {
        return err.message === 'tenant_context_required' && err.statusCode === 400;
      },
      'kioskService must throw tenant_context_required when no tenant is set'
    );

    assert.throws(
      () => {
        hseService.listPermits();
      },
      (err) => {
        return err.message === 'tenant_context_required' && err.statusCode === 400;
      },
      'hseService must throw tenant_context_required when no tenant is set'
    );
  });

  await test('TENANT-001.2: Cross-tenant permit modification is rejected with forbidden_cross_tenant (403)', async () => {
    let permitId = null;

    // Tenant A creates permit
    await runWithTenantContext({ tenantId: tenantA }, async () => {
      const permit = await hseService.createPermit(tenantA, 'EMP_A_1', {
        type: 'Hot Work',
        line: 'Line-A1',
        description: 'Welding work',
        validUntil: Date.now() + 3600000,
      });
      permitId = permit.id;
    });

    assert.ok(permitId, 'Permit should be created');

    // Tenant B attempts to decide/modify Tenant A permit
    await runWithTenantContext({ tenantId: tenantB }, async () => {
      let threw = false;
      try {
        await hseService.decidePermit(permitId, 'approved', { reviewer: 'Rival Officer', tenantId: tenantB });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.message, 'forbidden_cross_tenant');
        assert.strictEqual(err.statusCode, 403);
      }
      assert.ok(threw, 'Should throw forbidden_cross_tenant when cross-tenant permit is decided');
    });
  });

  await test('TENANT-001.3: Super-admin bypass is strictly scoped and resets properly', async () => {
    let permitId = null;

    // Tenant A creates permit
    await runWithTenantContext({ tenantId: tenantA }, async () => {
      const permit = await hseService.createPermit(tenantA, 'EMP_A_2', {
        type: 'Confined Space',
        line: 'Line-A2',
        description: 'Tank cleaning',
        validUntil: Date.now() + 3600000,
      });
      permitId = permit.id;
    });

    // Super-admin context decides it
    await runWithTenantContext({ tenantId: 'platform_ops', isSuperAdmin: true }, async () => {
      const decided = await hseService.decidePermit(permitId, 'approved', { reviewer: 'Super Admin' });
      assert.ok(decided, 'Super-admin can approve cross-tenant permit');
      assert.strictEqual(decided.status, 'approved');
    });

    // Regular non-super context cannot access
    await runWithTenantContext({ tenantId: tenantB, isSuperAdmin: false }, async () => {
      let threw = false;
      try {
        await hseService.decidePermit(permitId, 'rejected', { reviewer: 'Rival Officer' });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.message, 'forbidden_cross_tenant');
      }
      assert.ok(threw, 'Regular tenant cannot decide after super-admin finishes');
    });
  });

  await test('TENANT-001.4: Pure ambient context resolution without explicit tenantId parameter in service calls (GEMINI.md Rule 1)', async () => {
    const ambientSlugA = `ambient_a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ambientSlugB = `ambient_b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // In Tenant A context - ZERO tenant arguments passed
    await runWithTenantContext({ tenantId: ambientSlugA }, async () => {
      // Kiosk
      const machine = await kioskService.createMachine({
        id: 'M_AMB_01',
        name: 'Ambient Press 1',
        line: 'Line-Amb',
        status: 'idle',
      });
      assert.strictEqual(machine.tenantId, ambientSlugA);

      const machines = kioskService.getMachineStatuses();
      assert.strictEqual(machines.length, 1);
      assert.strictEqual(machines[0].id, 'M_AMB_01');

      const wo = await kioskService.createWorkOrder({
        id: 'WO_AMB_01',
        title: 'Work Order Ambient',
        line: 'Line-Amb',
        targetQty: 250,
      });
      assert.strictEqual(wo.tenantId, ambientSlugA);

      const workOrders = kioskService.getWorkOrders();
      assert.strictEqual(workOrders.length, 1);
      assert.strictEqual(workOrders[0].id, 'WO_AMB_01');

      const overview = kioskService.getKioskOverview();
      assert.strictEqual(overview.machines.length, 1);
      assert.strictEqual(overview.workOrders.length, 1);

      const stoppageRes = kioskService.reportStoppage('M_AMB_01', 'Overheating bearing', 'EMP_AMB_1');
      assert.strictEqual(stoppageRes.success, true);
      assert.strictEqual(stoppageRes.machine.status, 'stopped');

      const resolvedRes = kioskService.resolveStoppage('M_AMB_01');
      assert.strictEqual(resolvedRes.success, true);
      assert.strictEqual(resolvedRes.machine.status, 'running');

      // HSE
      const permit = await hseService.createPermit('EMP_AMB_1', {
        type: 'Cold Work',
        line: 'Line-Amb',
        description: 'Ambient test permit',
      });
      assert.strictEqual(permit.tenantId, ambientSlugA);

      const permits = hseService.listPermits();
      assert.strictEqual(permits.length, 1);
      assert.strictEqual(permits[0].id, permit.id);

      const incident = await hseService.reportIncident('EMP_AMB_1', {
        title: 'Ambient minor leak',
        line: 'Line-Amb',
        severity: 'low',
        injuryReported: false,
      });
      assert.strictEqual(incident.tenantId, ambientSlugA);

      const incidents = hseService.listIncidents();
      assert.strictEqual(incidents.length, 1);

      const ppe = await hseService.submitPpeInspection('EMP_AMB_INSPECTOR', {
        line: 'Line-Amb',
        checklist: { helmets: true, gloves: true },
      });
      assert.strictEqual(ppe.tenantId, ambientSlugA);

      const summary = hseService.getHseSummary();
      assert.ok(typeof summary.activePermitsCount === 'number');
      assert.strictEqual(summary.openIncidentsCount, 1);
    });

    // In Tenant B context - ZERO tenant arguments passed
    await runWithTenantContext({ tenantId: ambientSlugB }, async () => {
      const machinesB = kioskService.getMachineStatuses();
      assert.strictEqual(machinesB.length, 0, 'Tenant B must see 0 machines from Tenant A via ambient resolution');

      const permitsB = hseService.listPermits();
      assert.strictEqual(permitsB.length, 0, 'Tenant B must see 0 permits from Tenant A via ambient resolution');

      const incidentsB = hseService.listIncidents();
      assert.strictEqual(incidentsB.length, 0, 'Tenant B must see 0 incidents from Tenant A via ambient resolution');
    });
  });

  // =========================================================================
  // 3. DB-001: Schema & Migration 003 Validation
  // =========================================================================
  console.log('\n--- 3. DB-001: Schema & Migration 003 Validation ---');

  await test('DB-001.1: Migration 003 file exists and contains valid DDL with all 6 tables and RLS', async () => {
    const migPath = path.resolve(__dirname, '../src/db/migrations/003_hse_and_kiosk_domains.sql');
    assert.ok(fs.existsSync(migPath), '003_hse_and_kiosk_domains.sql must exist');
    const sql = fs.readFileSync(migPath, 'utf8');

    const expectedTables = [
      'hse_permits',
      'hse_incidents',
      'hse_ppe_inspections',
      'machines',
      'work_orders',
      'machine_stoppages',
    ];

    for (const table of expectedTables) {
      assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Migration must create table ${table}`);
      assert.ok(sql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`), `Table ${table} must have RLS enabled`);
    }

    assert.ok(sql.includes('PRIMARY KEY (tenant_id, id)'), 'Machines/work_orders must have composite tenant_id, id PK');
    assert.ok(sql.includes("CHECK (status IN ('running', 'stopped', 'maintenance', 'idle'))"), 'Machines must allow idle status');
    assert.ok(sql.includes('FOREIGN KEY (tenant_id, machine_id) REFERENCES machines(tenant_id, id) ON DELETE CASCADE'), 'Stoppages must have composite FK');
    assert.ok(sql.includes('tenant_isolation_'), 'Migration must declare tenant isolation RLS policies');
  });

  await test('DB-001.2: Unified schema.sql contains migration 003 tables and RLS definitions', async () => {
    const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
    assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS hse_permits'), 'schema.sql must include hse_permits');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS machines'), 'schema.sql must include machines');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS work_orders'), 'schema.sql must include work_orders');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS machine_stoppages'), 'schema.sql must include machine_stoppages');
    assert.ok(sql.includes("CHECK (status IN ('running', 'stopped', 'maintenance', 'idle'))"), 'schema.sql machines must allow idle status');
    assert.ok(sql.includes('FOREIGN KEY (tenant_id, machine_id) REFERENCES machines(tenant_id, id) ON DELETE CASCADE'), 'schema.sql stoppages must have composite FK');
  });

  await test('DB-001.3: Repository implements dual-mode persistence for all 6 entities', async () => {
    const requiredMethods = [
      'createHsePermit',
      'findHsePermitById',
      'updateHsePermit',
      'listHsePermits',
      'createHseIncident',
      'listHseIncidents',
      'createHsePpeInspection',
      'listHsePpeInspections',
      'createMachine',
      'findMachineById',
      'updateMachine',
      'listMachines',
      'createWorkOrder',
      'findWorkOrderById',
      'updateWorkOrder',
      'listWorkOrders',
      'createMachineStoppage',
      'listMachineStoppages',
      'resolveMachineStoppage',
    ];

    for (const m of requiredMethods) {
      assert.strictEqual(typeof repository[m], 'function', `repository must implement ${m}`);
    }
  });

  await test('DB-001.4: Schema constraints validator validates Kiosk & HSE domain models', async () => {
    assert.strictEqual(typeof schema.validateConstraints, 'function', 'validateConstraints must be a function');

    // Valid state with machines and HSE
    assert.doesNotThrow(() => {
      schema.validateConstraints({
        machines: [
          {
            id: 'M001',
            tenantId: 'test',
            name: 'Lathe 1',
            line: 'Line-1',
            status: 'running',
          },
        ],
        hsePermits: [
          {
            id: 'HSE-P-01',
            tenantId: 'test',
            employeeId: 'EMP1',
            type: 'Hot Work',
            line: 'Line-1',
            status: 'pending',
          },
        ],
      });
    });

    // Invalid machine status should throw
    assert.throws(() => {
      schema.validateConstraints({
        machines: [
          {
            id: 'M001',
            tenantId: 'test',
            name: 'Lathe 1',
            line: 'Line-1',
            status: 'exploding', // invalid status
          },
        ],
      });
    });

    // Invalid permit status should throw
    assert.throws(() => {
      schema.validateConstraints({
        hsePermits: [
          {
            id: 'HSE-P-01',
            tenantId: 'test',
            employeeId: 'EMP1',
            type: 'Hot Work',
            line: 'Line-1',
            status: 'non_existent_status',
          },
        ],
      });
    });
  });

  await test('DB-001.5: Postgres module implements and exports all 18 Kiosk and HSE domain queries', async () => {
    const requiredPostgresMethods = [
      'createMachine',
      'findMachineById',
      'updateMachine',
      'listMachines',
      'createWorkOrder',
      'findWorkOrderById',
      'updateWorkOrder',
      'listWorkOrders',
      'createMachineStoppage',
      'listMachineStoppages',
      'resolveMachineStoppage',
      'createHsePermit',
      'findHsePermitById',
      'updateHsePermit',
      'listHsePermits',
      'createHseIncident',
      'listHseIncidents',
      'createHsePpeInspection',
      'listHsePpeInspections',
    ];

    for (const m of requiredPostgresMethods) {
      assert.strictEqual(typeof postgres[m], 'function', `postgres must implement and export ${m}`);
    }
  });

  // =========================================================================
  // 4. UI-001 & AUTH-003: Backend Routes & RBAC Integration
  // =========================================================================
  console.log('\n--- 4. UI-001 & AUTH-003: Backend Routes & RBAC Integration ---');

  const app = require('../server');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  function makeRequest({ method, urlPath, headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (_) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Obtain test JWT tokens for HR Officer (has hse.read, hse.approve, payroll.read, payroll.update)
  // Define tokens for different administrative roles
  const { signToken } = require('../src/auth');

  const hrToken = signToken({
    sub: 'hr_user_1',
    role: ROLES.HR_OFFICER,
    tenantId: tenantA,
    scope: 'admin',
  });

  const payrollToken = signToken({
    sub: 'payroll_user_1',
    role: ROLES.PAYROLL_OFFICER,
    tenantId: tenantA,
    scope: 'admin',
  });

  const supervisorToken = signToken({
    sub: 'sup_user_1',
    role: ROLES.SHIFT_SUPERVISOR,
    tenantId: tenantA,
    scope: 'admin',
  });

  await test('AUTH-003.1: HSE routes reject unauthorized roles with 403 Forbidden', async () => {
    const res = await makeRequest({
      method: 'GET',
      urlPath: '/api/admin/hse/summary',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });

    assert.strictEqual(res.status, 403, 'Supervisor role without hse.read must receive 403');
    assert.strictEqual(res.body.error, 'forbidden_permission_required');
  });

  await test('AUTH-003.2: Incentives routes reject unauthorized roles with 403 Forbidden', async () => {
    const res = await makeRequest({
      method: 'GET',
      urlPath: '/api/admin/incentives-deductions/summary',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });

    assert.strictEqual(res.status, 403, 'Supervisor role without payroll.read must receive 403');
    assert.strictEqual(res.body.error, 'forbidden_permission_required');
  });

  await test('UI-001.1: HSE Summary API returns live calculated KPIs for authorized HR Officer', async () => {
    const res = await makeRequest({
      method: 'GET',
      urlPath: '/api/admin/hse/summary',
      headers: { Authorization: `Bearer ${hrToken}` },
    });

    assert.strictEqual(res.status, 200, 'HR Officer must receive 200 OK');
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.data.daysWithoutLti === 'number', 'daysWithoutLti must be number');
    assert.ok(typeof res.body.data.activePermitsCount === 'number', 'activePermitsCount must be number');
    assert.ok(typeof res.body.data.complianceScore === 'number', 'complianceScore must be number');
  });

  await test('UI-001.2: HSE Permits Decision API approves permit and updates status', async () => {
    // Create a permit in tenantA first
    let permit = null;
    await runWithTenantContext({ tenantId: tenantA }, async () => {
      permit = await hseService.createPermit(tenantA, 'EMP_A_DECIDE', {
        type: 'Working at Heights',
        line: 'Line-A1',
        description: 'Scaffolding inspection',
        validUntil: Date.now() + 86400000,
      });
    });

    assert.ok(permit, 'Permit created');

    const res = await makeRequest({
      method: 'POST',
      urlPath: `/api/admin/hse/permits/${permit.id}/decide`,
      headers: { Authorization: `Bearer ${hrToken}` },
      body: { decision: 'approved', reason: 'Verified by safety engineer' },
    });

    assert.strictEqual(res.status, 200, 'Must return 200 OK');
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'approved');
  });

  await test('UI-001.3: Incentives Summary API returns calculated adjustments list', async () => {
    const res = await makeRequest({
      method: 'GET',
      urlPath: '/api/admin/incentives-deductions/summary',
      headers: { Authorization: `Bearer ${payrollToken}` },
    });

    assert.strictEqual(res.status, 200, 'Must return 200 OK');
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data), 'Data must be array of employee adjustments');
  });

  await test('UI-001.4: Incentives Post-to-Payroll API records adjustments into payroll records', async () => {
    // Add an employee to tenantA in db
    db.transaction((d) => {
      d.employees = d.employees || [];
      d.employees.push({
        id: `EMP_TEST_${Date.now()}`,
        tenantId: tenantA,
        employeeCode: 'E_TEST_99',
        name: 'Mohamed Ali',
        department: 'Production',
        basicSalary: 8000,
        active: true,
      });
    });

    const currentPeriod = new Date().toISOString().slice(0, 7);
    const res = await makeRequest({
      method: 'POST',
      urlPath: '/api/admin/incentives-deductions/post-to-payroll',
      headers: { Authorization: `Bearer ${payrollToken}` },
      body: { period: currentPeriod },
    });

    assert.strictEqual(res.status, 200, 'Must return 200 OK');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data && res.body.data.postedCount >= 1, 'At least 1 employee payroll must be updated');
  });

  await new Promise((resolve) => server.close(resolve));

  console.log(`\n=== Re-Audit Verification Finished: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Fatal error in audit suite:', err);
  process.exit(1);
});
