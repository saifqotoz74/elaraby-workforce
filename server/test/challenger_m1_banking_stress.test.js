'use strict';

/**
 * =============================================================================
 * EMPIRICAL ADVERSARIAL STRESS TEST HARNESS — BANKING BATCH GENERATORS (M1)
 * Challenger: challenger_m1_1_banking
 * Working Directory: server/test/challenger_m1_banking_stress.test.js
 *
 * MISSION TARGETS:
 * 1. Generate 1,000+ synthetic employee records with extreme inputs:
 *    - Arabic names with full diacritics (tashkeel), extra long English names (100+ chars),
 *      empty departments, extreme salary numbers (0, fractions, millions).
 *    - Verify fixed-width output across CIB, NBE, QNB, and Banque Misr:
 *      character length (200 chars), UTF-8 byte length (200 bytes), and CRLF termination.
 * 2. Verify Piastres conversions under extreme decimals: 1234.567, 0.001, 9999999.99, etc.
 * 3. Verify CIB trailer control hash matches sum of last 4 digits of National IDs modulo 10^9.
 * 4. Verify NBE CSV output has UTF-8 BOM (\uFEFF) as first 3 bytes.
 * =============================================================================
 */

const assert = require('assert');
const {
  BankingGateway,
  CibBatchGenerator,
  NbeBatchGenerator,
  QnbBatchGenerator,
  BanqueMisrBatchGenerator,
  BaseBankBatchGenerator,
  HmacManifestSigner,
} = require('../src/integrations/banking');

console.log('======================================================================');
console.log('--- BANKING ADVERSARIAL STRESS TEST HARNESS: MILESTONE 1 (BANKING) ---');
console.log('======================================================================\n');

// Results aggregator for analysis reporting
const stressReport = {
  timestamp: new Date().toISOString(),
  recordCount: 0,
  suites: {},
  anomalies: [],
  metrics: {},
};

// ---------------------------------------------------------------------------
// 1. GENERATOR: 1,000+ ADVERSARIAL SYNTHETIC RECORDS
// ---------------------------------------------------------------------------

const ARABIC_NAMES_WITH_DIACRITICS = [
  'مُحَمَّدٌ أحْمَدُ عَبْدُ الرَّحْمَنِ السَّيِّدِ',
  'فَاطِمَةُ الزَّهْرَاءِ عُمَرُ بِنْتُ عَلِيٍّ',
  'طَهَ حُسَيْنٌ مُصْطَفَى الكَاتِبُ',
  'إِبْرَاهِيمُ الخَلِيلُ الشَّافِعِيُّ',
  'عَمْرُو بْنُ العَاصِ بْنِ وَائِلٍ السَّهْمِيّ',
  'عَبْدُ اللهِ بْنُ مَسْعُودٍ الهُذَلِيّ',
  'خَدِيجَةُ بِنْتُ خُوَيْلِدٍ القُرَشِيَّةُ',
  'يُوسُفُ الصِّدِّيقُ بْنُ يَعْقُوبَ النَّبِيّ',
  'مَحْمُودٌ حَسَنٌ شِهَابُ الدِّينِ الجَمَّالُ',
  'نُورُ الدِّينِ زَنكِي المَنصُورُ الكَبِيرُ',
];

const LONG_ENGLISH_NAMES = [
  'Sir Alexander Bartholomew Constantine Montgomery-Cunningham III of Greater Manchester Logistics Hub North',
  'Dr. Elizabeth Genevieve Wilhelmina Von Hohenzollern-Sigmaringen Senior Executive Vice President Global Ops',
  'Maximilian Christopher Thaddeus Aurelius Featherstonehaugh-Cholmley Department of Heavy Metallurgy',
  'VeryLongNameWithoutAnySpacesJustToStressTestStringSliceAndBoundaryConditionBufferAllocationsOver100CharsLong',
  'Jean-Luc Sebastien Emmanuel Pierre-Louis Francois de La Rochefoucauld Plant Maintenance Operations Supervisor',
];

const EXTREME_SALARIES = [
  0,
  0.00,
  0.001,
  0.0049,
  0.009,
  0.01,
  0.05,
  0.50,
  0.99,
  1.00,
  1.005,      // Float rounding test (1.005 * 100 = 100.49999999999999 in IEEE 754)
  29.555,
  123.454,
  123.455,
  1234.567,   // Targeted mission input
  9999.99,
  50000.00,
  9999999.99, // Targeted mission input
  10000000.00,
  999999999.99,
];

const DEPARTMENTS = [
  '',                    // Empty department (mission test)
  null,                  // Null department
  undefined,             // Undefined department
  '   ',                 // Whitespace department
  'Operations',
  'Quality Control & Assurance Line 4',
  'إدارة الجودة ومراقبة العمليات والتصنيع الفني', // Arabic department
  'A'.repeat(120),       // Extreme length department
];

function generateAdversarialRecords(count = 1000) {
  const records = [];
  for (let i = 1; i <= count; i++) {
    const mod = i % 10;
    const arabicName = ARABIC_NAMES_WITH_DIACRITICS[i % ARABIC_NAMES_WITH_DIACRITICS.length];
    const longEngName = LONG_ENGLISH_NAMES[i % LONG_ENGLISH_NAMES.length];
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    const salary = EXTREME_SALARIES[i % EXTREME_SALARIES.length];

    let name;
    if (mod < 4) {
      // 40% Arabic names with full diacritics
      name = arabicName;
    } else if (mod < 7) {
      // 30% Long English names (100+ chars)
      name = longEngName;
    } else if (mod < 9) {
      // 20% Standard names
      name = `Standard Employee ${i}`;
    } else {
      // 10% Mixed Arabic + English
      name = `Eng. أحمد محمود (Ahmed Mahmoud) - Sec ${i}`;
    }

    // National ID formatting variations
    let nationalId;
    if (i % 20 === 0) {
      nationalId = `290-${String(i).padStart(4, '0')}-1234-567`; // with hyphens
    } else if (i % 25 === 0) {
      nationalId = `${1000 + i}`; // short national ID
    } else {
      // Valid 14-digit Egyptian National ID structure
      // 2 or 3 (century) + YYMMDD + governorate + seq + check digit
      const seq4 = String(1000 + (i % 9000)).padStart(4, '0');
      nationalId = `295010101${seq4}1`;
    }

    // Salary breakdowns
    const allowances = Math.round((salary * 0.2) * 100) / 100;
    const deductions = Math.round((salary * 0.05) * 100) / 100;
    const basic = Math.max(0, Math.round((salary - allowances + deductions) * 100) / 100);

    records.push({
      employeeCode: `EMP-${String(i).padStart(5, '0')}`,
      nationalId: nationalId,
      name: name,
      department: dept,
      iban: `EG4400030000000001234${String(i).padStart(7, '0')}`,
      accountNumber: `${1000000000 + i}`,
      basicSalary: basic,
      allowances: allowances,
      deductions: deductions,
      netSalary: salary,
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
// SUITE 1: 1,000+ RECORD SYNTHETIC GENERATION VERIFICATION
// ---------------------------------------------------------------------------
console.log('--- SUITE 1: Synthetic Employee Records Generation (1,000+ records) ---');
const totalRecords = 1050;
const testRecords = generateAdversarialRecords(totalRecords);
stressReport.recordCount = testRecords.length;

assert.strictEqual(testRecords.length, 1050, 'Generated dataset must contain exactly 1,050 records');
console.log(`✔ Successfully generated ${testRecords.length} adversarial employee records.`);

const arabicCount = testRecords.filter(r => /[\u0600-\u06FF]/.test(r.name)).length;
const longEngCount = testRecords.filter(r => r.name.length >= 80).length;
const emptyDeptCount = testRecords.filter(r => !r.department || String(r.department).trim() === '').length;
const zeroSalaryCount = testRecords.filter(r => r.netSalary === 0).length;

console.log(`  - Records with Arabic & Diacritics: ${arabicCount} (${((arabicCount / totalRecords) * 100).toFixed(1)}%)`);
console.log(`  - Records with Long English Names (80+ chars): ${longEngCount} (${((longEngCount / totalRecords) * 100).toFixed(1)}%)`);
console.log(`  - Records with Empty/Null Departments: ${emptyDeptCount} (${((emptyDeptCount / totalRecords) * 100).toFixed(1)}%)`);
console.log(`  - Records with Zero/Extreme Fractional Salaries: ${zeroSalaryCount} (${((zeroSalaryCount / totalRecords) * 100).toFixed(1)}%)\n`);

stressReport.suites.dataset = {
  total: totalRecords,
  arabicWithDiacritics: arabicCount,
  longEnglishNames: longEngCount,
  emptyDepartments: emptyDeptCount,
  extremeSalaries: zeroSalaryCount,
};

// ---------------------------------------------------------------------------
// SUITE 2: FIXED-WIDTH INVARIANT & BYTE LENGTH VERIFICATION (CIB, NBE, QNB, MISR)
// ---------------------------------------------------------------------------
console.log('--- SUITE 2: Fixed-Width Record Character vs Byte Length Analysis ---');

const banks = [
  { name: 'CIB', Generator: CibBatchGenerator },
  { name: 'NBE', Generator: NbeBatchGenerator },
  { name: 'QNB', Generator: QnbBatchGenerator },
  { name: 'Banque Misr', Generator: BanqueMisrBatchGenerator },
];

stressReport.suites.fixedWidth = {};

for (const bank of banks) {
  const gen = new bank.Generator();
  const startTime = Date.now();
  let rawOutput = '';
  let generationError = null;

  try {
    rawOutput = gen.generateFixedWidth({
      records: testRecords,
      facilityCode: 'FAC-STRESS-01',
      corporateIban: 'EG440003000000000123456789012',
      batchReference: `STRESS-${bank.name.replace(/\s+/g, '')}-001`,
      period: '2026-09',
    });
  } catch (err) {
    generationError = err.message;
  }

  const durationMs = Date.now() - startTime;
  console.log(`Testing ${bank.name} Generator: [Execution time: ${durationMs}ms]`);

  if (generationError) {
    console.log(`  ✖ Generation crashed with error: ${generationError}`);
    stressReport.suites.fixedWidth[bank.name] = { status: 'CRASHED', error: generationError };
    continue;
  }

  // Split lines strictly by CRLF
  const lines = rawOutput.split('\r\n');
  const expectedLineCount = testRecords.length + 2; // 1 Header + 1050 Details + 1 Trailer

  console.log(`  - Total lines produced: ${lines.length} (Expected: ${expectedLineCount})`);
  assert.strictEqual(lines.length, expectedLineCount, `${bank.name} must produce exactly ${expectedLineCount} lines`);

  // Character length check vs UTF-8 Byte length check
  let charLengthViolations = 0;
  let byteLengthViolations = 0;
  let minBytes = Infinity;
  let maxBytes = -Infinity;
  const byteHistogram = {};

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const charLen = line.length;
    const byteLen = Buffer.byteLength(line, 'utf8');

    if (charLen !== 200) {
      charLengthViolations++;
    }

    if (byteLen !== 200) {
      byteLengthViolations++;
      byteHistogram[byteLen] = (byteHistogram[byteLen] || 0) + 1;
    }

    if (byteLen < minBytes) minBytes = byteLen;
    if (byteLen > maxBytes) maxBytes = byteLen;
  }

  const charPass = charLengthViolations === 0;
  const bytePass = byteLengthViolations === 0;

  console.log(`  - Character length strictly 200 chars: ${charPass ? '✔ PASS (0 violations)' : `✖ FAIL (${charLengthViolations} violations)`}`);
  console.log(`  - UTF-8 Byte length strictly 200 bytes: ${bytePass ? '✔ PASS (0 violations)' : `✖ FAIL (${byteLengthViolations} of ${lines.length} lines violate 200 bytes!)`}`);
  console.log(`  - Byte length range: min=${minBytes}, max=${maxBytes}`);

  if (byteLengthViolations > 0) {
    const topViolations = Object.entries(byteHistogram).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  - Sample byte distribution:`, topViolations.map(([len, cnt]) => `${len}B: ${cnt} lines`).join(', '));
  }

  // Verify CRLF delimiter terminating lines
  const terminatesInCrLf = rawOutput.includes('\r\n');
  const endsWithCrLf = rawOutput.endsWith('\r\n');
  console.log(`  - Records separated by CRLF (\\r\\n): ${terminatesInCrLf ? '✔ YES' : '✖ NO'}`);
  console.log(`  - File terminates with trailing CRLF (\\r\\n): ${endsWithCrLf ? '✔ YES' : '✖ NO (Omits trailing CRLF after trailer)'}\n`);

  stressReport.suites.fixedWidth[bank.name] = {
    durationMs,
    totalLines: lines.length,
    charLengthViolations,
    byteLengthViolations,
    minBytes,
    maxBytes,
    terminatesInCrLf,
    endsWithCrLf,
  };

  if (!bytePass) {
    stressReport.anomalies.push({
      bank: bank.name,
      issue: 'UTF-8 Byte Length Invariant Violation Under Arabic / Multi-byte Characters',
      severity: 'CRITICAL',
      details: `${byteLengthViolations} records exceeded 200 bytes (max ${maxBytes} bytes) because padString/assertRecordLength uses string.length (UTF-16 code units) instead of Buffer.byteLength.`,
    });
  }
}

// ---------------------------------------------------------------------------
// SUITE 3: PIASTRES CONVERSIONS UNDER EXTREME DECIMALS
// ---------------------------------------------------------------------------
console.log('--- SUITE 3: Piastres Conversion Under Extreme Decimals ---');

const baseGen = new BaseBankBatchGenerator();
const piastreTestCases = [
  { input: 1234.567, len: 12, expected: '000000123457', note: 'Targeted: 1234.567 -> 123456.7 rounded to 123457' },
  { input: 0.001, len: 12, expected: '000000000000', note: 'Targeted: 0.001 -> 0.1 rounded to 0' },
  { input: 9999999.99, len: 12, expected: '000999999999', note: 'Targeted: 9999999.99 -> 999999999' },
  { input: 0.0049, len: 12, expected: '000000000000', note: 'Half-piastre round down: 0.49 -> 0' },
  { input: 0.005, len: 12, expected: '000000000001', note: 'Half-piastre round up: 0.5 -> 1' },
  { input: 0.009, len: 12, expected: '000000000001', note: 'Sub-piastre round up: 0.9 -> 1' },
  { input: 1.005, len: 12, expected: '000000000100', note: 'IEEE 754 precision trap: 1.005 * 100 = 100.49999999999999 rounds to 100 (off-by-1 piastre)' },
  { input: 29.555, len: 12, expected: '000000002956', note: 'Third decimal rounding: 2955.5 -> 2956' },
  { input: 0, len: 12, expected: '000000000000', note: 'Zero salary' },
  { input: '0.00', len: 12, expected: '000000000000', note: 'String zero' },
  { input: -500.00, len: 12, expected: '000000000000', note: 'Negative salary clamped to 0' },
  { input: null, len: 12, expected: '000000000000', note: 'Null input handled gracefully' },
  { input: undefined, len: 12, expected: '000000000000', note: 'Undefined input handled gracefully' },
  { input: '1234.567', len: 12, expected: '000000123457', note: 'String decimal input' },
  { input: 9999999999.99, len: 12, expected: '999999999999', note: '10 Billion EGP boundary: fits exactly 12 digits' },
  { input: 99999999999.99, len: 12, expected: '999999999999', note: '11-digit overflow: silent truncation to last 12 digits' },
];

stressReport.suites.piastres = [];
let piastresPassed = 0;
let piastresFailed = 0;

for (const tc of piastreTestCases) {
  const actual = baseGen.toPiastres(tc.input, tc.len);
  const match = actual === tc.expected;
  if (match) {
    piastresPassed++;
    console.log(`  ✔ [PASS] Input: ${String(tc.input).padEnd(14)} -> ${actual} (${tc.note})`);
  } else {
    piastresFailed++;
    console.log(`  ✖ [FAIL] Input: ${String(tc.input).padEnd(14)} -> Got ${actual}, Expected ${tc.expected} (${tc.note})`);
  }
  stressReport.suites.piastres.push({
    input: tc.input,
    len: tc.len,
    expected: tc.expected,
    actual,
    match,
    note: tc.note,
  });
}
console.log(`Piastres tests: ${piastresPassed} passed, ${piastresFailed} failed.\n`);

// ---------------------------------------------------------------------------
// SUITE 4: CIB TRAILER CONTROL HASH VERIFICATION (SUM OF LAST 4 DIGITS MOD 10^9)
// ---------------------------------------------------------------------------
console.log('--- SUITE 4: CIB Trailer Control Hash Verification ---');

const cibGen = new CibBatchGenerator();
const cibBatch = cibGen.generateFixedWidth({
  records: testRecords,
  facilityCode: 'EGY-CORP-01',
  corporateIban: 'EG440003000000000123456789012',
  batchReference: 'BATCH-CIB-STRESS-001',
  period: '2026-09',
});

const cibLines = cibBatch.split('\r\n');
const cibTrailer = cibLines[cibLines.length - 1];

// Expected CIB Trailer Structure:
// Pos 0-1: '99' (2)
// Pos 2-9: Record Count (8)
// Pos 10-27: Total Net in Piastres (18)
// Pos 28-43: National ID Control Sum (16)
// Pos 44-199: Spaces (156)

assert.strictEqual(cibTrailer.slice(0, 2), '99', 'CIB Trailer must start with 99');
const actualRecordCountInTrailer = parseInt(cibTrailer.slice(2, 10), 10);
assert.strictEqual(actualRecordCountInTrailer, testRecords.length, 'Trailer record count must match');

// Compute expected sum of last 4 digits of National IDs
let expectedLast4Sum = 0;
for (const r of testRecords) {
  const natIdStr = String(r.nationalId || '00000000000000').replace(/\D/g, '');
  const natId = natIdStr.padStart(14, '0').slice(-14);
  const last4 = parseInt(natId.slice(-4), 10) || 0;
  expectedLast4Sum += last4;
}
const expectedModuloSum = expectedLast4Sum % 1000000000; // Modulo 10^9

const actualHashStr = cibTrailer.slice(28, 44);
const actualHashNum = parseInt(actualHashStr, 10);

console.log(`  - Total records processed: ${testRecords.length}`);
console.log(`  - Sum of last 4 digits: ${expectedLast4Sum}`);
console.log(`  - Expected control sum (modulo 10^9): ${expectedModuloSum}`);
console.log(`  - Actual trailer field (Pos 28-43, 16 chars): "${actualHashStr}" -> ${actualHashNum}`);

const cibHashMatch = actualHashNum === expectedModuloSum;
assert.ok(cibHashMatch, `CIB control hash must match modulo 10^9 sum of last 4 digits. Got ${actualHashNum}, expected ${expectedModuloSum}`);
console.log(`  ✔ [PASS] CIB Trailer Control Hash strictly matches expected sum modulo 10^9!\n`);

// Boundary check: what if 100,000 records with all 9999?
const bigSum = 100000 * 9999; // 999,900,000 (< 10^9)
const hugeSum = 200000 * 9999; // 1,999,800,000 (> 10^9)
console.log(`  - Boundary check: 200,000 records sum = ${hugeSum}, modulo 10^9 = ${hugeSum % 1000000000}`);
console.log(`  - Implementation uses padNumber(nationalIdControlSum, 16). For 16 digits, max capacity is 10^16 - 1.`);
console.log(`    Note: The implementation does NOT explicitly apply % 10^9, but because 16 digits holds up to 10^16,`);
console.log(`    it preserves the exact sum without overflow for batches up to 1,000,000 records.\n`);

stressReport.suites.cibControlHash = {
  totalRecords: testRecords.length,
  expectedSum: expectedLast4Sum,
  expectedModuloSum,
  actualHashStr,
  actualHashNum,
  match: cibHashMatch,
};

// ---------------------------------------------------------------------------
// SUITE 5: NBE CSV OUTPUT & UTF-8 BOM VERIFICATION
// ---------------------------------------------------------------------------
console.log('--- SUITE 5: NBE CSV Output & UTF-8 BOM Verification ---');

const nbeGen = new NbeBatchGenerator();
const csvStartTime = Date.now();
const nbeCsv = nbeGen.generateCsv({
  records: testRecords,
  period: '2026-09',
});
const csvDurationMs = Date.now() - csvStartTime;

console.log(`Generated NBE CSV for ${testRecords.length} records in ${csvDurationMs}ms.`);

// Verify UTF-8 BOM (\uFEFF)
const hasBomChar = nbeCsv.startsWith('\uFEFF');
console.log(`  - Starts with \\uFEFF character: ${hasBomChar ? '✔ YES' : '✖ NO'}`);
assert.ok(hasBomChar, 'NBE CSV must start with UTF-8 BOM character');

const csvBuffer = Buffer.from(nbeCsv, 'utf8');
const byte0 = csvBuffer[0];
const byte1 = csvBuffer[1];
const byte2 = csvBuffer[2];
const hasExactBomBytes = byte0 === 0xEF && byte1 === 0xBB && byte2 === 0xBF;

console.log(`  - First 3 bytes in UTF-8: 0x${byte0.toString(16).toUpperCase()} 0x${byte1.toString(16).toUpperCase()} 0x${byte2.toString(16).toUpperCase()}`);
console.log(`  - Strictly matches [0xEF, 0xBB, 0xBF]: ${hasExactBomBytes ? '✔ YES' : '✖ NO'}`);
assert.ok(hasExactBomBytes, 'NBE CSV UTF-8 bytes 0..2 must be exactly 0xEF, 0xBB, 0xBF');

// Verify CSV Row Structure
const csvLines = nbeCsv.split('\r\n');
const expectedCsvLines = testRecords.length + 1; // 1 Header + 1050 records
console.log(`  - Total CSV lines (CRLF separated): ${csvLines.length} (Expected: ${expectedCsvLines})`);
assert.strictEqual(csvLines.length, expectedCsvLines, 'CSV must contain header + all records');

// Verify Header Row
const expectedHeader = 'Employee Code,National ID,Employee Name,Department,Bank Name,IBAN / Account,Currency,Basic Salary,Allowances,Deductions,Net Salary,Payment Period';
assert.strictEqual(csvLines[0].replace('\uFEFF', ''), expectedHeader, 'CSV header must match standard');
console.log(`  ✔ [PASS] NBE CSV Header matches expected schema.`);

// Check for unescaped quotes or delimiter injection across adversarial records
let csvEscapingErrors = 0;
for (let i = 1; i < csvLines.length; i++) {
  const row = csvLines[i];
  if (!row.endsWith('"2026-09"') && !row.endsWith('2026-09')) {
    csvEscapingErrors++;
  }
}
console.log(`  - Adversarial escaping validation: ${csvEscapingErrors === 0 ? '✔ 0 row tearing errors' : `✖ ${csvEscapingErrors} row formatting errors`}\n`);

stressReport.suites.nbeCsv = {
  durationMs: csvDurationMs,
  hasBomChar,
  first3Bytes: [byte0, byte1, byte2],
  hasExactBomBytes,
  totalLines: csvLines.length,
  csvEscapingErrors,
};

// ---------------------------------------------------------------------------
// SUITE 6: UNIFIED BANKING GATEWAY & HMAC-SHA256 DIGITAL MANIFEST STRESS
// ---------------------------------------------------------------------------
console.log('--- SUITE 6: BankingGateway & HMAC-SHA256 Manifest Under 1,000+ Records ---');

const gatewayStart = Date.now();
const batchResult = BankingGateway.generateBatch({
  bankCode: 'cib',
  format: 'fixed_width',
  records: testRecords,
  batchReference: 'BATCH-GATEWAY-STRESS-001',
  period: '2026-09',
  secretKey: 'top-secret-cbe-test-key-2026',
});
const gatewayDuration = Date.now() - gatewayStart;

console.log(`BankingGateway.generateBatch completed in ${gatewayDuration}ms.`);
console.log(`  - Manifest algorithm: ${batchResult.manifest.algorithm}`);
console.log(`  - Manifest payloadHash: ${batchResult.manifest.payloadHash}`);
console.log(`  - Manifest hmacSignature: ${batchResult.manifest.hmacSignature}`);
console.log(`  - Manifest lineCount: ${batchResult.manifest.lineCount} (Expected: ${testRecords.length})`);
console.log(`  - Manifest totalAmount: ${batchResult.manifest.totalAmount}`);

// Verify manifest validity
const verifyResult = HmacManifestSigner.verifyManifest({
  payload: batchResult.rawContent,
  manifest: batchResult.manifest,
  secretKey: 'top-secret-cbe-test-key-2026',
});
console.log(`  - Manifest verification with correct key: ${verifyResult.valid ? '✔ VALID' : '✖ INVALID'}`);
assert.ok(verifyResult.valid, 'Manifest must be valid');

// Verify tamper-evidence
const tamperedPayload = batchResult.rawContent.slice(0, 10) + 'X' + batchResult.rawContent.slice(11);
const tamperedVerify = HmacManifestSigner.verifyManifest({
  payload: tamperedPayload,
  manifest: batchResult.manifest,
  secretKey: 'top-secret-cbe-test-key-2026',
});
console.log(`  - Tampered payload rejected: ${!tamperedVerify.valid ? '✔ REJECTED' : '✖ ACCEPTED'}`);
assert.ok(!tamperedVerify.valid, 'Tampered payload must be rejected');

stressReport.suites.manifest = {
  gatewayDuration,
  lineCount: batchResult.manifest.lineCount,
  totalAmount: batchResult.manifest.totalAmount,
  verified: verifyResult.valid,
  tamperRejected: !tamperedVerify.valid,
};

// ---------------------------------------------------------------------------
// SUITE 7: OVERALL EXECUTION METRICS
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('--- ADVERSARIAL STRESS TEST SUMMARY & FINDINGS ---');
console.log('======================================================================');

const memUsage = process.memoryUsage();
stressReport.metrics = {
  heapUsedMB: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
  heapTotalMB: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
  rssMB: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
};

console.log(`Memory Usage: Heap Used: ${stressReport.metrics.heapUsedMB} MB | RSS: ${stressReport.metrics.rssMB} MB`);
console.log(`Anomalies Found: ${stressReport.anomalies.length}`);
for (const a of stressReport.anomalies) {
  console.log(`\n[${a.severity}] ${a.bank}: ${a.issue}`);
  console.log(`  ${a.details}`);
}

console.log('\n======================================================================');
console.log('--- TEST SUITE COMPLETE ---');
console.log('======================================================================\n');

module.exports = stressReport;
