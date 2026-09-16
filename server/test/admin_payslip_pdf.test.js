// server/test/admin_payslip_pdf.test.js
// Comprehensive test suite for Corporate PDF Payslip & Batch ZIP Generator
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-2026';

const assert = require('assert');
const http = require('http');
const app = require('../server');
const { data: db } = require('../src/db');
const { seed } = require('../src/seed');
const { signToken } = require('../src/auth');
const pdfService = require('../src/services/pdfService');

console.log('=============================================================');
console.log('--- ADMIN PAYSLIP PDF & BATCH ZIP TEST SUITE ---');
console.log('=============================================================\n');

seed(db());

const adminToken = signToken({ sub: 'adm_1', scope: 'admin', role: 'admin', tenantId: 'elaraby' });
const superAdminToken = signToken({ sub: 'sup_1', scope: 'admin', role: 'superadmin' });
const elsewedyAdminToken = signToken({ sub: 'adm_swd', scope: 'admin', role: 'admin', tenantId: 'elsewedy' });
const supervisorToken = signToken({ sub: 'sup_shift', scope: 'admin', role: 'shift_supervisor', tenantId: 'elaraby' });

const PORT = 3993;
let server;

function request(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      method,
      path,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(buffer.toString('utf8'));
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer,
          text: buffer.toString('utf8'),
          json,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    await new Promise((resolve, reject) => {
      server = app.listen(PORT, resolve);
      server.on('error', reject);
    });

    // 1. Direct PDF Generation Service Test
    console.log('--- 1. Pure Node.js Vector PDF Generator Service ---');
    const employee = db().employees.find(e => e.id === 'emp_1') || {
      id: 'emp_1',
      name: 'Ahmed Ghannam',
      employeeCode: 'EG-20481',
      nationalId: '29001011234592',
      factory: '10th of Ramadan',
      department: 'Production A',
      position: 'Machine Operator',
      currency: 'EGP',
      tenantId: 'elaraby',
    };
    const payroll = (db().payroll || []).find(p => p.employeeId === 'emp_1') || {
      employeeId: 'emp_1',
      period: 'August 2026',
      basicSalary: 8500,
      overtimeAmount: 700,
      transportAllowance: 400,
      mealAllowance: 350,
      incentiveBonus: 850,
      socialInsurance: 680,
      incomeTax: 210,
      medicalInsurance: 150,
      loanDeduction: 500,
      penalties: 0,
      netSalary: 9260,
      paidOn: 'Aug 28, 2026',
      paymentMethod: 'Bank Transfer (CIB)',
    };
    const tenant = { name: 'Elaraby Group', brand: { primaryColor: '#0B63B4', currency: 'EGP' } };

    const pdfBuf = pdfService.generatePayslipPdfBuffer({ payroll, employee, tenant });
    assert.ok(Buffer.isBuffer(pdfBuf), 'Must return a Buffer');
    assert.ok(pdfBuf.length > 2000, 'PDF buffer should be larger than 2KB');
    const pdfStr = pdfBuf.toString('utf8');
    assert.ok(pdfStr.startsWith('%PDF-1.4'), 'Must have valid %PDF-1.4 header');
    assert.ok(pdfStr.includes('%%EOF'), 'Must contain %%EOF trailer');
    assert.ok(pdfStr.includes('CONFIDENTIAL SALARY STATEMENT'), 'Must contain corporate title');
    assert.ok(pdfStr.includes(employee.name), 'Must contain employee name');
    assert.ok(pdfStr.includes(employee.employeeCode || employee.id), 'Must contain employee code');
    assert.ok(pdfStr.includes('NET PAYABLE SALARY'), 'Must contain net pay callout');
    console.log(`✔ PDF generated successfully (${pdfBuf.length} bytes) with valid PDF-1.4 structure.`);

    // 2. Pure Node.js ZIP Generator Service Test
    console.log('\n--- 2. Pure Node.js In-Memory PKZip Engine ---');
    const files = [
      { name: 'test_payslip_1.pdf', content: pdfBuf },
      { name: 'test_payslip_2.pdf', content: pdfBuf },
    ];
    const zipBuf = pdfService.createZipArchive(files);
    assert.ok(Buffer.isBuffer(zipBuf), 'Must return a Buffer');
    assert.strictEqual(zipBuf.readUInt32LE(0), 0x04034b50, 'Must have PKZip local header signature');
    console.log(`✔ ZIP archive created successfully (${zipBuf.length} bytes) with 2 entries.`);

    // 3. GET /api/admin/payroll/:id/payslip-pdf Integration Test
    console.log('\n--- 3. HTTP Integration: GET /api/admin/payroll/:id/payslip-pdf ---');
    const resPdf = await request('GET', '/api/admin/payroll/emp_1/payslip-pdf', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resPdf.status, 200, 'Should return HTTP 200');
    assert.strictEqual(resPdf.headers['content-type'], 'application/pdf');
    assert.ok(resPdf.headers['content-disposition'].includes('Payslip_'));
    assert.ok(resPdf.headers['content-disposition'].includes('.pdf'));
    assert.ok(resPdf.buffer.toString('utf8').startsWith('%PDF-1.4'));
    console.log('✔ GET /api/admin/payroll/emp_1/payslip-pdf returned valid HTTP 200 PDF stream.');

    // 4. Scope and RBAC Protection Test
    console.log('\n--- 4. RBAC & Multi-Tenant Cross-Access Isolation ---');
    const resUnauthorized = await request('GET', '/api/admin/payroll/emp_1/payslip-pdf');
    assert.strictEqual(resUnauthorized.status, 401, 'Should reject unauthenticated access with 401');

    const resForbiddenRole = await request('GET', '/api/admin/payroll/emp_1/payslip-pdf', {
      Authorization: `Bearer ${supervisorToken}`,
    });
    assert.strictEqual(resForbiddenRole.status, 403, 'Should reject role without payroll.read permission with 403');

    // Elsewedy admin attempting to access Elaraby employee payslip
    const resCrossTenant = await request('GET', '/api/admin/payroll/emp_1/payslip-pdf', {
      Authorization: `Bearer ${elsewedyAdminToken}`,
    });
    assert.strictEqual(resCrossTenant.status, 403, 'Cross-tenant access must be rejected with 403');
    console.log('✔ RBAC and cross-tenant boundaries strictly enforced.');

    // 5. Non-Existent Employee (404)
    console.log('\n--- 5. Non-Existent Employee Check ---');
    const resNotFound = await request('GET', '/api/admin/payroll/non_existent_emp/payslip-pdf', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resNotFound.status, 404, 'Non-existent employee should return 404');
    console.log('✔ Non-existent employee returns 404 as expected.');

    // 6. GET /api/admin/payroll/payslips-zip Integration Test
    console.log('\n--- 6. HTTP Integration: GET /api/admin/payroll/payslips-zip ---');
    const resZip = await request('GET', '/api/admin/payroll/payslips-zip?period=August%202026', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resZip.status, 200, 'Should return HTTP 200');
    assert.strictEqual(resZip.headers['content-type'], 'application/zip');
    assert.ok(resZip.headers['content-disposition'].includes('Payslips_elaraby_'));
    assert.ok(resZip.headers['content-disposition'].includes('.zip'));
    assert.strictEqual(resZip.buffer.readUInt32LE(0), 0x04034b50, 'Buffer must be valid PKZip archive');
    console.log(`✔ GET /api/admin/payroll/payslips-zip returned valid HTTP 200 ZIP archive (${resZip.buffer.length} bytes).`);

    console.log('\n=============================================================');
    console.log('ALL ADMIN PAYSLIP PDF & BATCH ZIP TESTS PASSED (0 FAILURES)');
    console.log('=============================================================');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
})();
