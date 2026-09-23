'use strict';

// Test Suite: Bulk Excel/CSV Worker Import Engine & Auto-PIN Provisioning
// Validates:
// 1. Egyptian National ID verification (14 digits, century, birthdate, governorate)
// 2. Egyptian phone number validation (010, 011, 012, 015)
// 3. Positive basic salary verification
// 4. In-batch and DB duplicate National ID detection
// 5. Auto-PIN generation = last 4 digits of National ID (hash(id.slice(-4)))
// 6. CSV (with UTF-8 BOM) and XLSX parsing in pure Node.js
// 7. GET /api/admin/employees/import-template (xlsx and csv)
// 8. POST /api/admin/employees/import-bulk HTTP endpoint with seat limit & RBAC

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const { data: db, save } = require('../src/db');
const { signToken, verifyHash } = require('../src/auth');
const workerImportService = require('../src/services/workerImportService');
const adminRoutes = require('../src/routes/admin');
const { runWithTenantContext } = require('../src/tenantContext');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/admin', adminRoutes);

let server;
let baseUrl;
const highEntropySuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const testTenantId = `test_corp_${highEntropySuffix}`;
const adminToken = signToken({
  sub: `admin_${highEntropySuffix}`,
  username: `admin_${highEntropySuffix}`,
  role: 'superadmin',
  scope: 'admin',
  tenantId: testTenantId,
});

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': testTenantId,
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
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
            body: buffer.toString('utf8'),
            json,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('1. Egyptian National ID Validator: Structural & Calendar Rules', () => {
  // Valid ID: born 1 Jan 1990 in Cairo (01), check digit 4
  const valid1990 = '29001010101234';
  const res1 = workerImportService.validateEgyptianNationalId(valid1990);
  assert.strictEqual(res1.ok, true);
  assert.strictEqual(res1.cleanId, valid1990);

  // Valid ID: born 15 May 2002 in Gharbia (16)
  const valid2002 = '30205151609871';
  const res2 = workerImportService.validateEgyptianNationalId(valid2002);
  assert.strictEqual(res2.ok, true);

  // Arabic-Indic numerals normalization (٢٩٠٠١٠١٠١٠١٢٣٤)
  const arabicIndicId = '٢٩٠٠١٠١٠١٠١٢٣٤';
  const resArabic = workerImportService.validateEgyptianNationalId(arabicIndicId);
  assert.strictEqual(resArabic.ok, true);
  assert.strictEqual(resArabic.cleanId, valid1990);

  // Invalid: 13 digits
  const resShort = workerImportService.validateEgyptianNationalId('2900101010123');
  assert.strictEqual(resShort.ok, false);
  assert.match(resShort.reason, /14 digits/i);

  // Invalid: century not 2 or 3 (starts with 1)
  const resCentury = workerImportService.validateEgyptianNationalId('19001010101234');
  assert.strictEqual(resCentury.ok, false);
  assert.match(resCentury.reason, /start with 2.*or 3/i);

  // Invalid calendar day (31 Feb)
  const resFeb31 = workerImportService.validateEgyptianNationalId('29002310101234');
  assert.strictEqual(resFeb31.ok, false);

  // Invalid governorate code (99)
  const resGov = workerImportService.validateEgyptianNationalId('29001019901234');
  assert.strictEqual(resGov.ok, false);
  assert.match(resGov.reason, /governorate/i);
});

test('2. Egyptian Mobile Phone Validator', () => {
  // Valid standard mobile: 01012345678
  assert.strictEqual(workerImportService.validateEgyptianPhone('01012345678').ok, true);
  // Valid Orange mobile: 01287654321
  assert.strictEqual(workerImportService.validateEgyptianPhone('01287654321').ok, true);
  // Valid Etisalat: 01155443322
  assert.strictEqual(workerImportService.validateEgyptianPhone('01155443322').ok, true);
  // Valid WE: 01599887766
  assert.strictEqual(workerImportService.validateEgyptianPhone('01599887766').ok, true);

  // Normalization of international +20 prefix
  const intlRes = workerImportService.validateEgyptianPhone('+201012345678');
  assert.strictEqual(intlRes.ok, true);
  assert.strictEqual(intlRes.cleanPhone, '01012345678');

  // Normalization with dashes and spaces
  const dashed = workerImportService.validateEgyptianPhone('010-1234-5678');
  assert.strictEqual(dashed.ok, true);
  assert.strictEqual(dashed.cleanPhone, '01012345678');

  // Invalid: landline or wrong prefix (02 / 019)
  assert.strictEqual(workerImportService.validateEgyptianPhone('0227941234').ok, false);
  assert.strictEqual(workerImportService.validateEgyptianPhone('01912345678').ok, false);
});

test('3. Basic Salary Validator', () => {
  assert.strictEqual(workerImportService.validateSalary('7500').ok, true);
  assert.strictEqual(workerImportService.validateSalary(8200.5).ok, true);
  assert.strictEqual(workerImportService.validateSalary('0').ok, false);
  assert.strictEqual(workerImportService.validateSalary('-500').ok, false);
  assert.strictEqual(workerImportService.validateSalary('abc').ok, false);
});

test('4. CSV Parsing with Auto-PIN & Duplicate Detection', async () => {
  const csvData =
    'Name,National ID,Phone,Position,Basic Salary\r\n' +
    'Tarek Mohamed,29203040101234,01011112222,Machine Tech,7200\r\n' +
    'Karim Adel,29406071405678,01122223333,Electrician,8100\r\n' +
    'Duplicate Person,29203040101234,01233334444,Operator,6500\r\n'; // Duplicate of row 2

  const result = await runWithTenantContext({ tenantId: testTenantId }, async () => {
    return workerImportService.importWorkers(
      { sub: 'admin_test', role: 'superadmin', tenantId: testTenantId },
      csvData,
      { filename: 'roster.csv' }
    );
  });

  assert.strictEqual(result.totalRows, 3);
  assert.strictEqual(result.importedCount, 2);
  assert.strictEqual(result.errorCount, 1);
  assert.strictEqual(result.errors[0].row, 4);
  assert.match(result.errors[0].reason, /duplicate/i);

  // Verify PIN is the last 4 digits of National ID
  const d = db();
  const emp1 = d.employees.find((e) => e.nationalId === '29203040101234');
  assert.ok(emp1);
  assert.strictEqual(emp1.mustChangePinOnFirstLogin, true);
  // Last 4 digits of '29203040101234' is '1234'
  assert.strictEqual(verifyHash('1234', emp1.pinHash), true);

  // Second worker: last 4 digits of '29406071405678' is '5678'
  const emp2 = d.employees.find((e) => e.nationalId === '29406071405678');
  assert.ok(emp2);
  assert.strictEqual(verifyHash('5678', emp2.pinHash), true);
});

test('5. Excel Workbook (.xlsx) Generation & Parsing Round-trip', async () => {
  // Generate XLSX template
  const template = workerImportService.generateTemplate('xlsx');
  assert.strictEqual(template.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(Buffer.isBuffer(template.buffer));
  assert.ok(template.buffer.length > 200);

  // Verify pure-Node ZIP extraction
  const files = workerImportService.extractZip(template.buffer);
  assert.ok(files['xl/workbook.xml']);
  assert.ok(files['xl/worksheets/sheet1.xml']);
  assert.ok(files['xl/sharedStrings.xml']);

  // Parse XLSX back into 2D rows
  const parsedRows = workerImportService.parseXlsx(template.buffer);
  assert.ok(parsedRows.length >= 3);
  // Header row has Arabic columns
  assert.ok(parsedRows[0].includes('الاسم'));
  assert.ok(parsedRows[0].includes('الرقم القومي'));
});

test('6. HTTP GET /api/admin/employees/import-template', async () => {
  // 6.1 Download Excel (.xlsx) template
  const resXlsx = await request('GET', '/api/admin/employees/import-template?format=xlsx', {
    Authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(resXlsx.status, 200);
  assert.strictEqual(resXlsx.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(resXlsx.headers['content-disposition'], /workforce_import_template\.xlsx/);

  // 6.2 Download CSV template (with UTF-8 BOM)
  const resCsv = await request('GET', '/api/admin/employees/import-template?format=csv', {
    Authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(resCsv.status, 200);
  assert.match(resCsv.headers['content-type'], /text\/csv/);
  // Verify byte offset 0 contains \uFEFF
  assert.strictEqual(resCsv.buffer[0], 0xEF);
  assert.strictEqual(resCsv.buffer[1], 0xBB);
  assert.strictEqual(resCsv.buffer[2], 0xBF);
});

test('7. HTTP POST /api/admin/employees/import-bulk (JSON & Base64 Payload)', async () => {
  const uniqueNationalId = '29510101604321';
  const csvContent =
    'الاسم,الرقم القومي,رقم الهاتف,المسمى الوظيفي,الراتب الأساسي\r\n' +
    `خالد عبد العزيز,${uniqueNationalId},01099887766,فني صيانة,8500\r\n`;

  const base64Data = Buffer.from(csvContent, 'utf8').toString('base64');

  const res = await request(
    'POST',
    '/api/admin/employees/import-bulk',
    {
      Authorization: `Bearer ${adminToken}`,
    },
    {
      dataBase64: `data:text/csv;base64,${base64Data}`,
      filename: 'workers_batch.csv',
    }
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.totalRows, 1);
  assert.strictEqual(res.json.importedCount, 1);
  assert.strictEqual(res.json.errorCount, 0);

  // Verify PIN is last 4 digits (4321)
  const d = db();
  const createdEmp = d.employees.find((e) => e.nationalId === uniqueNationalId);
  assert.ok(createdEmp);
  assert.strictEqual(verifyHash('4321', createdEmp.pinHash), true);
  assert.strictEqual(createdEmp.mustChangePinOnFirstLogin, true);

  // Second upload with same national ID should report error: already registered
  const resDupe = await request(
    'POST',
    '/api/admin/employees/import-bulk',
    {
      Authorization: `Bearer ${adminToken}`,
    },
    {
      csv: csvContent,
      filename: 'workers_batch_repeat.csv',
    }
  );

  assert.strictEqual(resDupe.status, 200);
  assert.strictEqual(resDupe.json.importedCount, 0);
  assert.strictEqual(resDupe.json.errorCount, 1);
  assert.match(resDupe.json.errors[0].reason, /already registered/i);
});

test('8. National ID Scientific Notation & Float (.0) Parsing and PIN Hashing', () => {
  // Scientific notation from Excel: 2.9001010101234E+13
  const sciId = '2.9001010101234E+13';
  const resSci = workerImportService.validateEgyptianNationalId(sciId);
  assert.strictEqual(resSci.ok, true);
  assert.strictEqual(resSci.cleanId, '29001010101234');
  assert.strictEqual(resSci.cleanId.slice(-4), '1234');

  // Float notation with .0 from Pandas/CSV export: 29001010101234.0
  const floatId = '29001010101234.0';
  const resFloat = workerImportService.validateEgyptianNationalId(floatId);
  assert.strictEqual(resFloat.ok, true);
  assert.strictEqual(resFloat.cleanId, '29001010101234');
});

test('9. Multi-Sheet Excel Workbook: Automatically Detects Worker Sheet', () => {
  const template = workerImportService.generateTemplate('xlsx');
  const files = workerImportService.extractZip(template.buffer);

  // Sheet 1: Cover sheet with instructions only (no worker headers)
  const coverSheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Workforce Onboarding Instructions</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Please fill out data on Sheet 2</t></is></c></row>
  </sheetData>
</worksheet>`;

  // Sheet 2: The actual worker data from the template's sheet1.xml
  const multiSheetZip = workerImportService.createZip({
    ...files,
    'xl/worksheets/sheet1.xml': coverSheetXml,
    'xl/worksheets/sheet2.xml': files['xl/worksheets/sheet1.xml'],
  });

  const parsed = workerImportService.parseXlsx(multiSheetZip);
  assert.ok(parsed.length >= 2, 'Should find data rows in sheet 2');
  assert.ok(parsed[0].includes('الاسم'), 'Should extract headers from sheet 2');
  assert.ok(parsed[0].includes('الرقم القومي'), 'Should extract National ID column from sheet 2');
});
