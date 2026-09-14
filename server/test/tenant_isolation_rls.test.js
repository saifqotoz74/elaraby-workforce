// Comprehensive Enterprise Multi-Tenant Isolation & RLS Test Suite
// Verifies:
// 1. Cross-tenant read leak prevention
// 2. Cross-tenant write rejection
// 3. Token tampering & header spoofing defense
// 4. Composite unique constraints (National ID & Phone coexistence across tenants)
// 5. Tenant-scoped announcements & global broadcast flag
// 6. Super Admin global oversight & masquerading
// 7. Concurrent AsyncLocalStorage ambient context preservation

const assert = require('assert');
const http = require('http');
const app = require('../server');
const { data: db } = require('../src/db');
const repository = require('../src/db/repository');
const { runWithTenantContext } = require('../src/tenantContext');
const { signToken } = require('../src/auth');

function httpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            server.close();
            try {
              const parsed = JSON.parse(rawData);
              resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            } catch (_) {
              resolve({ status: res.statusCode, headers: res.headers, body: rawData });
            }
          });
        }
      );
      req.on('error', (e) => {
        server.close();
        reject(e);
      });
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  });
}

async function runPenetrationSuite() {
  console.log('=============================================================');
  console.log('--- ENTERPRISE DATABASE ISOLATION & RLS PENETRATION SUITE ---');
  console.log('=============================================================\n');

  const sharedNationalId = '29912318888888';
  const sharedPhone = '01088776655';

  // Clean up any test fixtures from previous runs
  const d = db();
  d.employees = (d.employees || []).filter(
    (e) => !String(e.id || '').startsWith('emp_sec_') && e.nationalId !== sharedNationalId && e.phone !== sharedPhone
  );
  d.requests = (d.requests || []).filter((r) => !String(r.id || '').startsWith('req_sec_'));
  d.announcements = (d.announcements || []).filter((a) => !String(a.id || '').startsWith('ann_sec_'));
  d.auditLogs = (d.auditLogs || []).filter((l) => !String(l.id || '').startsWith('aud_sec_'));

  // -------------------------------------------------------------
  // Test 1: Composite Unique Key Independence across Tenants
  // -------------------------------------------------------------
  console.log('--- 1. Composite Unique Key Independence ---');

  const empElaraby = await repository.createEmployee({
    id: 'emp_sec_elaraby_1',
    tenantId: 'elaraby',
    name: 'Ahmed Elaraby Worker',
    nationalId: sharedNationalId,
    phone: sharedPhone,
    department: 'Manufacturing',
    factory: 'Benha Factory',
    active: true,
  });

  const empElsewedy = await repository.createEmployee({
    id: 'emp_sec_elsewedy_1',
    tenantId: 'elsewedy',
    name: 'Mahmoud Elsewedy Worker',
    nationalId: sharedNationalId, // Identical national ID
    phone: sharedPhone,          // Identical phone
    department: 'Cables & Wiring',
    factory: '10th of Ramadan',
    active: true,
  });

  assert.strictEqual(empElaraby.id, 'emp_sec_elaraby_1');
  assert.strictEqual(empElsewedy.id, 'emp_sec_elsewedy_1');
  assert.strictEqual(empElaraby.tenantId, 'elaraby');
  assert.strictEqual(empElsewedy.tenantId, 'elsewedy');
  console.log('✔ Independent enterprise tenants can register identical National IDs & phones without collision.');

  // -------------------------------------------------------------
  // Test 2: Cross-Tenant Read Isolation in Repository
  // -------------------------------------------------------------
  console.log('\n--- 2. Repository Cross-Tenant Read Isolation ---');

  // Query in Elaraby context
  await runWithTenantContext({ tenantId: 'elaraby' }, async () => {
    const foundById = await repository.findEmployeeById('emp_sec_elsewedy_1');
    assert.strictEqual(foundById, null, 'Elaraby context MUST NOT read Elsewedy employee by ID');

    const foundByNatId = await repository.findEmployeeByNationalId(sharedNationalId);
    assert.strictEqual(foundByNatId?.id, 'emp_sec_elaraby_1', 'Elaraby context must only find Elaraby employee');

    const list = await repository.listEmployees();
    const hasElsewedy = list.employees.some((e) => e.tenantId === 'elsewedy');
    assert.strictEqual(hasElsewedy, false, 'Elaraby employee list must never leak Elsewedy workers');
  });
  console.log('✔ Elaraby context strictly denied access to Elsewedy employee records.');

  // Query in Elsewedy context
  await runWithTenantContext({ tenantId: 'elsewedy' }, async () => {
    const foundById = await repository.findEmployeeById('emp_sec_elaraby_1');
    assert.strictEqual(foundById, null, 'Elsewedy context MUST NOT read Elaraby employee by ID');

    const foundByNatId = await repository.findEmployeeByNationalId(sharedNationalId);
    assert.strictEqual(foundByNatId?.id, 'emp_sec_elsewedy_1', 'Elsewedy context must only find Elsewedy employee');

    const list = await repository.listEmployees();
    const hasElaraby = list.employees.some((e) => e.tenantId === 'elaraby');
    assert.strictEqual(hasElaraby, false, 'Elsewedy employee list must never leak Elaraby workers');
  });
  console.log('✔ Elsewedy context strictly denied access to Elaraby employee records.');

  // -------------------------------------------------------------
  // Test 3: Cross-Tenant Write & Mutation Defense
  // -------------------------------------------------------------
  console.log('\n--- 3. Cross-Tenant Write & Mutation Defense ---');
  await runWithTenantContext({ tenantId: 'elaraby' }, async () => {
    const updated = await repository.updateEmployee('emp_sec_elsewedy_1', { name: 'Hacked Name' });
    assert.strictEqual(updated, null, 'Elaraby context cannot mutate Elsewedy employee record');
  });

  // Verify Elsewedy employee was NOT modified
  await runWithTenantContext({ tenantId: 'elsewedy' }, async () => {
    const emp = await repository.findEmployeeById('emp_sec_elsewedy_1');
    assert.strictEqual(emp.name, 'Mahmoud Elsewedy Worker');
  });
  console.log('✔ Cross-tenant record tampering successfully blocked.');

  // -------------------------------------------------------------
  // Test 4: Request Domain Isolation
  // -------------------------------------------------------------
  console.log('\n--- 4. Request Domain Cross-Tenant Isolation ---');
  await runWithTenantContext({ tenantId: 'elaraby' }, async () => {
    await repository.createRequest({
      id: 'req_sec_elaraby_1',
      employeeId: 'emp_sec_elaraby_1',
      type: 'annual',
      days: 3,
    });
  });

  await runWithTenantContext({ tenantId: 'elsewedy' }, async () => {
    await repository.createRequest({
      id: 'req_sec_elsewedy_1',
      employeeId: 'emp_sec_elsewedy_1',
      type: 'sick',
      days: 1,
    });
  });

  await runWithTenantContext({ tenantId: 'elaraby' }, async () => {
    const reqList = await repository.listRequests();
    assert.strictEqual(reqList.requests.some((r) => r.id === 'req_sec_elsewedy_1'), false);
    assert.strictEqual(await repository.findRequestById('req_sec_elsewedy_1'), null);
  });

  await runWithTenantContext({ tenantId: 'elsewedy' }, async () => {
    const reqList = await repository.listRequests();
    assert.strictEqual(reqList.requests.some((r) => r.id === 'req_sec_elaraby_1'), false);
    assert.strictEqual(await repository.findRequestById('req_sec_elaraby_1'), null);
  });
  console.log('✔ Leave and vacation requests fully isolated per tenant.');

  // -------------------------------------------------------------
  // Test 5: Token Tampering & Spoofed X-Tenant-ID Header Rejection
  // -------------------------------------------------------------
  console.log('\n--- 5. Token Tampering & Spoofed Header Defense ---');
  // Generate valid employee token for Elsewedy worker
  const elsewedyToken = signToken({
    sub: empElsewedy.id,
    scope: 'employee',
    tokenVersion: 1,
    tenantId: 'elsewedy',
  });

  // Attempt attack: Elsewedy worker sends header X-Tenant-ID: elaraby to breach Elaraby
  const attackRes = await httpRequest(
    'GET',
    '/api/me',
    null,
    {
      Authorization: `Bearer ${elsewedyToken}`,
      'X-Tenant-ID': 'elaraby',
    }
  );

  assert.ok(attackRes.status === 403 || attackRes.status === 200, 'Server must block (403) or neutralize spoofed header');
  assert.strictEqual(attackRes.headers['x-tenant-id'], 'elsewedy', 'Server must override spoofed header with authentic token tenant');
  console.log('✔ Spoofed X-Tenant-ID header was blocked/neutralized; server locked context to authentic JWT tenant.');

  // -------------------------------------------------------------
  // Test 6: Announcements Scoping & Global Broadcast
  // -------------------------------------------------------------
  console.log('\n--- 6. Announcements Scoping & Global Broadcast ---');
  d.announcements.push(
    { id: 'ann_sec_elaraby', tenantId: 'elaraby', isGlobal: false, title: 'Elaraby Annual Bonus', createdAt: Date.now() - 100 },
    { id: 'ann_sec_elsewedy', tenantId: 'elsewedy', isGlobal: false, title: 'Elsewedy Cable Factory Meeting', createdAt: Date.now() - 50 },
    { id: 'ann_sec_global', isGlobal: true, title: 'National Holiday Notice', createdAt: Date.now() }
  );

  const elarabyAnnRes = await httpRequest(
    'GET',
    '/api/announcements',
    null,
    { 'X-Tenant-ID': 'elaraby' }
  );

  assert.strictEqual(elarabyAnnRes.status, 200);
  const elarabyTitles = elarabyAnnRes.body.announcements.map((a) => a.id);
  assert.ok(elarabyTitles.includes('ann_sec_elaraby'), 'Elaraby announcement should be present');
  assert.ok(elarabyTitles.includes('ann_sec_global'), 'Global announcement should be present');
  assert.ok(!elarabyTitles.includes('ann_sec_elsewedy'), 'Elsewedy announcement must NOT be present in Elaraby feed');

  const elsewedyAnnRes = await httpRequest(
    'GET',
    '/api/announcements',
    null,
    { 'X-Tenant-ID': 'elsewedy' }
  );

  const elsewedyTitles = elsewedyAnnRes.body.announcements.map((a) => a.id);
  assert.ok(elsewedyTitles.includes('ann_sec_elsewedy'), 'Elsewedy announcement should be present');
  assert.ok(elsewedyTitles.includes('ann_sec_global'), 'Global announcement should be present');
  assert.ok(!elsewedyTitles.includes('ann_sec_elaraby'), 'Elaraby announcement must NOT be present in Elsewedy feed');
  console.log('✔ Announcements strictly scoped to tenant with verified global broadcast support.');

  // -------------------------------------------------------------
  // Test 7: Super-Admin Global Oversight & Masquerading
  // -------------------------------------------------------------
  console.log('\n--- 7. Super-Admin Global Oversight & Masquerading ---');
  // Global query (isSuperAdmin = true)
  await runWithTenantContext({ isSuperAdmin: true }, async () => {
    const allEmployees = await repository.listEmployees();
    const hasElaraby = allEmployees.employees.some((e) => e.tenantId === 'elaraby');
    const hasElsewedy = allEmployees.employees.some((e) => e.tenantId === 'elsewedy');
    assert.ok(hasElaraby && hasElsewedy, 'Super Admin without tenant scope must observe cross-tenant data');
  });

  // Super-admin masquerading into Elsewedy
  await runWithTenantContext({ isSuperAdmin: true, tenantId: 'elsewedy', masqueraded: true }, async () => {
    const scopedList = await repository.listEmployees();
    // When explicit tenant context is targeted, queries isolate to that tenant
    assert.ok(scopedList.employees.every((e) => e.tenantId === 'elsewedy'));
  });
  console.log('✔ Super Admin global oversight and targeted tenant masquerading confirmed.');

  // -------------------------------------------------------------
  // Test 8: Concurrent AsyncLocalStorage Execution
  // -------------------------------------------------------------
  console.log('\n--- 8. Concurrent AsyncLocalStorage Execution ---');
  const { getCurrentTenantId } = require('../src/tenantContext');
  const concurrentRuns = await Promise.all([
    runWithTenantContext({ tenantId: 'elaraby' }, async () => {
      await new Promise((r) => setTimeout(r, 20));
      return getCurrentTenantId();
    }),
    runWithTenantContext({ tenantId: 'elsewedy' }, async () => {
      await new Promise((r) => setTimeout(r, 10));
      return getCurrentTenantId();
    }),
    runWithTenantContext({ tenantId: 'gb_corp' }, async () => {
      await new Promise((r) => setTimeout(r, 15));
      return getCurrentTenantId();
    }),
  ]);

  assert.strictEqual(concurrentRuns[0], 'elaraby');
  assert.strictEqual(concurrentRuns[1], 'elsewedy');
  assert.strictEqual(concurrentRuns[2], 'gb_corp');
  console.log('✔ Asynchronous execution boundaries preserved zero context bleeding under concurrency.');

  console.log('\n=============================================================');
  console.log('✔ ALL 8 PENETRATION & ISOLATION TESTS PASSED (100% SECURE)');
  console.log('=============================================================\n');
}

if (require.main === module) {
  runPenetrationSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Penetration test failed:', err);
      process.exit(1);
    });
}

module.exports = { runPenetrationSuite };
