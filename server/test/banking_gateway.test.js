'use strict';

const assert = require('assert');
const test = require('node:test');
const {
  BankingGateway,
  CibBatchGenerator,
  NbeBatchGenerator,
  QnbBatchGenerator,
  BanqueMisrBatchGenerator,
  CbeWpsBatchGenerator,
  HmacManifestSigner,
} = require('../src/integrations/banking');

const sampleRecords = [
  {
    employeeCode: 'EG-20481',
    nationalId: '29001011234592',
    name: 'Ahmed Ghannam',
    department: 'Production A',
    iban: 'EG9900030000000001000000001',
    accountNumber: '1000000001',
    basicSalary: 8500.00,
    allowances: 1870.00,
    deductions: 680.00,
    netSalary: 9690.00,
  },
  {
    employeeCode: 'EG-20777',
    nationalId: '29505055443322',
    name: 'Mona Adel',
    department: 'HR',
    iban: 'EG9900030000000001000000002',
    accountNumber: '1000000002',
    basicSalary: 7000.00,
    allowances: 1540.00,
    deductions: 230.00,
    netSalary: 8310.00,
  },
];

test('CIB Generator: 200-byte fixed-width format and checksums', () => {
  const gen = new CibBatchGenerator();
  const batch = gen.generateFixedWidth({
    records: sampleRecords,
    facilityCode: 'EGY-CORP01',
    corporateIban: 'EG440003000000000123456789012',
    batchReference: 'BATCH-CIB-2026-09-001',
    period: '2026-09',
  });

  assert.ok(batch.endsWith('\r\n'), 'CIB batch must terminate with CRLF');
  const cleanBatch = batch.endsWith('\r\n') ? batch.slice(0, -2) : batch;
  const lines = cleanBatch.split('\r\n');
  assert.strictEqual(lines.length, 4, 'Must have Header, 2 Details, Trailer');

  // Verify each line is exactly 200 bytes
  for (let i = 0; i < lines.length; i++) {
    assert.strictEqual(lines[i].length, 200, `Line ${i} must be exactly 200 characters`);
  }

  // Header assertions
  assert.strictEqual(lines[0].slice(0, 2), '01');
  assert.strictEqual(lines[0].slice(2, 12).trim(), 'EGY-CORP01');
  assert.strictEqual(lines[0].slice(75, 78), 'EGP');

  // Trailer assertions
  assert.strictEqual(lines[3].slice(0, 2), '99');
  assert.strictEqual(lines[3].slice(2, 10), '00000002'); // 2 records

  // Total amount in Piastres in Header (Pos 58-75) matches Trailer (Pos 11-28)
  const headerAmt = parseInt(lines[0].slice(57, 75), 10);
  const trailerAmt = parseInt(lines[3].slice(10, 28), 10);
  assert.strictEqual(headerAmt, (9690 + 8310) * 100);
  assert.strictEqual(headerAmt, trailerAmt);

  // Control Hash Total: sum of last 4 digits of National IDs
  // 4592 + 3322 = 7914
  const expectedControlSum = 4592 + 3322;
  const actualControlSum = parseInt(lines[3].slice(28, 44), 10);
  assert.strictEqual(actualControlSum, expectedControlSum);
});

test('NBE Generator: 200-byte fixed-width format and Al Ahly Net CSV with UTF-8 BOM', () => {
  const gen = new NbeBatchGenerator();
  const fixed = gen.generateFixedWidth({
    records: sampleRecords,
    facilityCode: 'FAC-NBE-01',
    corporateIban: 'EG440003000000000123456789012',
    batchReference: 'BATCH-NBE-2026-09-001',
    period: '2026-09',
  });

  assert.ok(fixed.endsWith('\r\n'), 'NBE batch must terminate with CRLF');
  const cleanFixedNbe = fixed.endsWith('\r\n') ? fixed.slice(0, -2) : fixed;
  const fixedLines = cleanFixedNbe.split('\r\n');
  assert.strictEqual(fixedLines.length, 4);
  for (const line of fixedLines) {
    assert.strictEqual(line.length, 200, 'NBE line must be exactly 200 characters');
  }
  assert.strictEqual(fixedLines[0].slice(0, 2), '01');
  assert.strictEqual(fixedLines[0].slice(2, 6), '0003'); // NBE Bank Code
  assert.strictEqual(fixedLines[3].slice(0, 2), '99');

  // CSV format test
  const csv = gen.generateCsv({ records: sampleRecords, period: '2026-09' });
  assert.ok(csv.startsWith('\uFEFF'), 'NBE CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('National Bank of Egypt (NBE)'), 'Must identify NBE bank');
  assert.ok(csv.includes('Employee Code,National ID,Employee Name'), 'Must contain required CSV headers');
});

test('QNB ALAHLI Generator: 200-byte fixed-width and CSV format', () => {
  const gen = new QnbBatchGenerator();
  const fixed = gen.generateFixedWidth({
    records: sampleRecords,
    facilityCode: 'QNB-001',
    corporateIban: 'EG440003000000000123456789012',
    batchReference: 'QNB_SAL_20260921_001',
  });

  assert.ok(fixed.endsWith('\r\n'), 'QNB batch must terminate with CRLF');
  const cleanFixedQnb = fixed.endsWith('\r\n') ? fixed.slice(0, -2) : fixed;
  const fixedLines = cleanFixedQnb.split('\r\n');
  assert.strictEqual(fixedLines.length, 4);
  for (const line of fixedLines) {
    assert.strictEqual(line.length, 200, 'QNB line must be exactly 200 characters');
  }
  assert.strictEqual(fixedLines[0].slice(0, 2), '01');
  assert.strictEqual(fixedLines[1].slice(113, 117), '0037'); // QNB CBE code in detail
  assert.strictEqual(fixedLines[3].slice(0, 2), '99');

  const csv = gen.generateCsv({ records: sampleRecords, period: '2026-09' });
  assert.ok(csv.startsWith('\uFEFF'), 'QNB CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('Seq,Customer Reference,Beneficiary Name'), 'Must contain QNB CSV header');
});

test('Banque Misr Generator: 200-byte fixed-width and CSV format', () => {
  const gen = new BanqueMisrBatchGenerator();
  const fixed = gen.generateFixedWidth({
    records: sampleRecords,
    facilityCode: 'BM-CORP-1',
    corporateIban: 'EG440003000000000123456789012',
    batchReference: 'BM-BATCH-2026-09-001',
  });

  assert.ok(fixed.endsWith('\r\n'), 'Banque Misr batch must terminate with CRLF');
  const cleanFixedBm = fixed.endsWith('\r\n') ? fixed.slice(0, -2) : fixed;
  const fixedLines = cleanFixedBm.split('\r\n');
  assert.strictEqual(fixedLines.length, 4);
  for (const line of fixedLines) {
    assert.strictEqual(line.length, 200, 'Banque Misr line must be exactly 200 characters');
  }
  assert.strictEqual(fixedLines[0].slice(0, 2), '01');
  assert.strictEqual(fixedLines[3].slice(0, 2), '99');

  const csv = gen.generateCsv({ records: sampleRecords, period: '2026-09' });
  assert.ok(csv.startsWith('\uFEFF'), 'Banque Misr CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('Line No,National ID,Employee Code'), 'Must contain BM CSV header');
});

test('CBE WPS Generator: pipe-delimited format with 01 header and 02 detail', () => {
  const gen = new CbeWpsBatchGenerator();
  const wps = gen.generatePipeDelimited({
    records: sampleRecords,
    facilityCode: 'EGY-CORP-01',
    corporateIban: 'EG440003000000000123456789012',
    period: '2026-09',
  });

  const lines = wps.split('\r\n');
  assert.strictEqual(lines.length, 3, 'Must have Header and 2 Details');
  assert.ok(lines[0].startsWith('01|EGY-CORP-01|EG440003000000000123456789012|2026-09|2|18000|EGP|'));
  assert.ok(lines[1].startsWith('02|29001011234592|EG9900030000000001000000001|Ahmed Ghannam|8500|1870|680|9690|EGP|SALARY'));
});

test('BankingGateway Facade: Unified batch generation & manifest signing', () => {
  const result = BankingGateway.generateBatch({
    bankCode: 'cib',
    format: 'fixed_width',
    records: sampleRecords,
    period: '2026-09',
    tenantId: 'elaraby',
  });

  assert.strictEqual(result.bankCode, 'cib');
  assert.strictEqual(result.format, 'fixed_width');
  assert.strictEqual(result.lineCount, 2);
  assert.strictEqual(result.totalAmount, 18000.00);
  assert.strictEqual(result.contentType, 'text/plain; charset=utf-8');
  assert.ok(result.filename.includes('CIB'));
  assert.ok(result.manifest);
  assert.ok(result.manifest.payloadHash.startsWith('sha256:'));
  assert.strictEqual(result.manifest.hmacSignature.length, 64);

  // Validate manifest passes verification against the raw payload
  const verified = HmacManifestSigner.verifyManifest({
    payload: result.rawContent,
    manifest: result.manifest,
  });
  assert.strictEqual(verified.valid, true);
});
