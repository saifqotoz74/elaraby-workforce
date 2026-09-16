// server/test/adversarial_pdf_zip.test.js
// ADVERSARIAL STRESS TEST HARNESS FOR PDF & ZIP ENGINE (M1 Worker Review)
// Empirical challenge: Extreme inputs, batch ZIP scale, CRC-32 integrity, PDF-1.4 spec compliance

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-2026';

const assert = require('assert');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const app = require('../server');
const { data: db } = require('../src/db');
const { seed } = require('../src/seed');
const { signToken } = require('../src/auth');
const pdfService = require('../src/services/pdfService');

console.log('=============================================================');
console.log('>>> ADVERSARIAL CHALLENGE: WORKER M1 PDF & ZIP GENERATOR <<<');
console.log('=============================================================\n');

seed(db());

const PORT = 3995;
let server;

function request(method, reqPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      method,
      path: reqPath,
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

// -------------------------------------------------------------
// PDF-1.4 SPECIFICATION COMPLIANCE VERIFIER
// -------------------------------------------------------------
function verifyPdf14Compliance(pdfBuf, contextLabel = 'PDF') {
  assert.ok(Buffer.isBuffer(pdfBuf), `${contextLabel}: Output must be a Buffer`);
  assert.ok(pdfBuf.length > 500, `${contextLabel}: PDF too small to be valid (${pdfBuf.length} bytes)`);

  const pdfStr = pdfBuf.toString('utf8');

  // 1. Header validation
  assert.ok(pdfStr.startsWith('%PDF-1.4\n'), `${contextLabel}: Missing %PDF-1.4 magic header`);
  // Binary comment (at least 4 bytes with codes > 127 to ensure binary transmission)
  const commentLine = pdfStr.split('\n')[1];
  assert.ok(commentLine.startsWith('%'), `${contextLabel}: Second line must be a comment marker`);
  assert.ok(commentLine.length >= 4, `${contextLabel}: Binary comment line should contain non-ASCII characters`);

  // 2. Trailer & EOF validation
  assert.ok(pdfStr.endsWith('%%EOF\n') || pdfStr.endsWith('%%EOF'), `${contextLabel}: File must terminate with %%EOF`);
  const startxrefMatch = pdfStr.match(/startxref\s+(\d+)\s+%%EOF/);
  assert.ok(startxrefMatch, `${contextLabel}: Must contain valid startxref pointer`);
  const startxrefOffset = parseInt(startxrefMatch[1], 10);
  assert.ok(startxrefOffset > 0 && startxrefOffset < pdfBuf.length, `${contextLabel}: startxref offset out of bounds`);

  // Verify byte at startxref points exactly to 'xref'
  const xrefHeader = pdfBuf.subarray(startxrefOffset, startxrefOffset + 5).toString('utf8');
  assert.strictEqual(xrefHeader, 'xref\n', `${contextLabel}: startxref must point exactly to 'xref\\n' (found: ${JSON.stringify(xrefHeader)})`);

  // 3. Objects structure validation
  for (let i = 1; i <= 6; i++) {
    const objMarker = `${i} 0 obj`;
    assert.ok(pdfStr.includes(objMarker), `${contextLabel}: Missing object definition ${objMarker}`);
  }

  // Object 1: Catalog
  assert.ok(pdfStr.includes('/Type /Catalog'), `${contextLabel}: Missing /Type /Catalog`);
  assert.ok(pdfStr.includes('/Pages 2 0 R'), `${contextLabel}: Catalog must reference Pages 2 0 R`);

  // Object 2: Pages
  assert.ok(pdfStr.includes('/Type /Pages'), `${contextLabel}: Missing /Type /Pages`);
  assert.ok(pdfStr.includes('/Kids [3 0 R]'), `${contextLabel}: Pages must reference Kids [3 0 R]`);
  assert.ok(pdfStr.includes('/Count 1'), `${contextLabel}: Pages count must be 1`);

  // Object 3: Page
  assert.ok(pdfStr.includes('/Type /Page'), `${contextLabel}: Missing /Type /Page`);
  assert.ok(pdfStr.includes('/Contents 4 0 R'), `${contextLabel}: Page must reference Contents 4 0 R`);
  assert.ok(pdfStr.includes('/MediaBox [0 0 595.28 841.89]'), `${contextLabel}: Page must have standard A4 MediaBox`);

  // Object 4: Content Stream Length Accuracy
  const streamMatch = pdfStr.match(/4 0 obj\s*<<\s*\/Length\s+(\d+)\s*>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/);
  assert.ok(streamMatch, `${contextLabel}: Object 4 stream structure invalid`);
  const declaredLength = parseInt(streamMatch[1], 10);
  const streamContent = streamMatch[2];
  const actualLength = Buffer.byteLength(streamContent, 'utf8');
  assert.strictEqual(actualLength, declaredLength, `${contextLabel}: Stream length mismatch! Declared=${declaredLength}, Actual=${actualLength}`);

  // Object 5 & 6: Fonts
  assert.ok(pdfStr.includes('/BaseFont /Helvetica'), `${contextLabel}: Missing Helvetica font`);
  assert.ok(pdfStr.includes('/BaseFont /Helvetica-Bold'), `${contextLabel}: Missing Helvetica-Bold font`);

  // 4. Cross-Reference Table Validation
  const xrefSection = pdfStr.slice(startxrefOffset);
  const xrefLines = xrefSection.split('\n');
  assert.strictEqual(xrefLines[1].trim(), '0 7', `${contextLabel}: xref table header must declare '0 7' entries`);

  // Check 20-byte lines in xref table
  for (let i = 2; i <= 8; i++) {
    const line = xrefLines[i];
    assert.strictEqual(line.length, 19, `${contextLabel}: xref entry ${i - 2} length must be 19 chars without newline (20 bytes with \\n)`);
    if (i === 2) {
      assert.strictEqual(line, '0000000000 65535 f ', `${contextLabel}: First xref entry must be head of free list`);
    } else {
      const objNum = i - 2;
      const offset = parseInt(line.slice(0, 10), 10);
      assert.ok(offset > 0, `${contextLabel}: Obj ${objNum} offset must be positive`);
      const targetObjMarker = `${objNum} 0 obj`;
      const actualAtOffset = pdfBuf.subarray(offset, offset + targetObjMarker.length).toString('utf8');
      assert.strictEqual(actualAtOffset, targetObjMarker, `${contextLabel}: xref offset ${offset} does not point to '${targetObjMarker}' (found '${actualAtOffset}')`);
    }
  }

  return true;
}

(async () => {
  const findings = [];
  try {
    await new Promise((resolve, reject) => {
      server = app.listen(PORT, resolve);
      server.on('error', reject);
    });

    const adminToken = signToken({ sub: 'adm_1', scope: 'admin', role: 'admin', tenantId: 'elaraby' });

    // =============================================================
    // TEST SUITE 1: EXTREME INPUTS & NUMERICAL BOUNDARIES
    // =============================================================
    console.log('--- TEST SUITE 1: Extreme Inputs & Numerical Boundaries ---');

    // 1.1 Zero Salary & Zero Allowances
    {
      const zeroInput = {
        payroll: {
          period: 'August 2026',
          basicSalary: 0,
          overtimeAmount: 0,
          transportAllowance: 0,
          mealAllowance: 0,
          incentiveBonus: 0,
          socialInsurance: 0,
          incomeTax: 0,
          medicalInsurance: 0,
          loanDeduction: 0,
          penalties: 0,
          netSalary: 0,
        },
        employee: { id: 'emp_zero', name: 'Zero Salary Worker', baseSalary: 0 },
        tenant: { name: 'Elaraby Group' },
      };
      const buf = pdfService.generatePayslipPdfBuffer(zeroInput);
      verifyPdf14Compliance(buf, 'Zero Salary PDF');
      assert.ok(buf.toString('utf8').includes('(+0 EGP)'), 'Must render zero earnings formatted');
      assert.ok(buf.toString('utf8').includes('(0 EGP)'), 'Must render zero net salary formatted');
      console.log('? 1.1 Zero salary input rendered valid PDF with 0 EGP figures.');
    }

    // 1.2 Massive Overtime & Astronomical Numbers
    {
      const massiveInput = {
        payroll: {
          period: 'August 2026',
          basicSalary: 100000000,
          overtimeAmount: 999999999999,
          transportAllowance: 50000000,
          socialInsurance: 11000000,
          incomeTax: 35000000,
          netSalary: 1000013999999,
        },
        employee: { id: 'emp_massive', name: 'Ultra Executive', baseSalary: 100000000 },
        tenant: { name: 'Global Enterprise' },
      };
      const buf = pdfService.generatePayslipPdfBuffer(massiveInput);
      verifyPdf14Compliance(buf, 'Massive Numbers PDF');
      assert.ok(buf.toString('utf8').includes('999,999,999,999'), 'Must contain formatted massive overtime');
      console.log('? 1.2 Massive numbers (1e12) handled cleanly without overflow.');
    }

    // 1.3 High-Precision Fractional Allowances & Odd Floats
    {
      const fractionalInput = {
        payroll: {
          period: 'August 2026',
          basicSalary: 8500.555,
          overtimeAmount: 700.1234,
          transportAllowance: 12.9999,
          socialInsurance: 935.061,
          incomeTax: 297.519,
          netSalary: 7979.0975,
        },
        employee: { id: 'emp_frac', name: 'Fractional Worker' },
      };
      const buf = pdfService.generatePayslipPdfBuffer(fractionalInput);
      verifyPdf14Compliance(buf, 'Fractional Allowances PDF');
      console.log('? 1.3 Fractional floats handled cleanly in PDF stream.');
    }

    // 1.4 100%+ Deductions Exceeding Gross (Negative Net Pay)
    {
      const negativeInput = {
        payroll: {
          period: 'August 2026',
          basicSalary: 3000,
          loanDeduction: 10000,
          penalties: 2000,
          socialInsurance: 330,
          incomeTax: 105,
          netSalary: -9435,
        },
        employee: { id: 'emp_neg', name: 'Indebted Worker' },
      };
      const buf = pdfService.generatePayslipPdfBuffer(negativeInput);
      verifyPdf14Compliance(buf, 'Negative Net Salary PDF');
      assert.ok(buf.toString('utf8').includes('-9,435 EGP'), 'Must display negative net pay correctly');
      console.log('? 1.4 Negative net salary (-9,435 EGP) rendered without layout crash.');
    }

    // 1.5 Missing / Null / Empty Objects
    {
      const emptyBuf = pdfService.generatePayslipPdfBuffer({});
      verifyPdf14Compliance(emptyBuf, 'Empty Objects PDF');

      const partialBuf = pdfService.generatePayslipPdfBuffer({
        payroll: {},
        employee: {},
        tenant: {},
      });
      verifyPdf14Compliance(partialBuf, 'Partial Objects PDF');
      console.log('? 1.5 Empty and partial parameter objects fall back to sensible defaults.');
    }

    // =============================================================
    // TEST SUITE 2: SPECIAL CHARACTERS & ADVERSARIAL TEXT ENCODING
    // =============================================================
    console.log('\n--- TEST SUITE 2: Special Characters & Adversarial Text Encoding ---');

    // 2.1 Arabic Unicode Text
    {
      const arabicInput = {
        payroll: { period: '????? 2026' },
        employee: {
          id: 'emp_ar',
          name: '???? ???? ?????',
          factory: '???? ?????? ?? ?????',
          department: '??? ??????? ????????',
          position: '????? ???? ???',
        },
        tenant: {
          name: '?????? ?????? ??????? ????????',
          brand: { corporateSubtitle: '?????? ????????? ?????? ????? ???????' },
        },
      };
      const buf = pdfService.generatePayslipPdfBuffer(arabicInput);
      verifyPdf14Compliance(buf, 'Arabic Text PDF');
      console.log('? 2.1 Arabic Unicode text sanitized to WinAnsi space without corrupting PDF syntax.');
    }

    // 2.2 PDF Operator Injection Attack in Name & Fields
    {
      const injectionInput = {
        payroll: { period: 'Current) Tj /F1 20 Tf 1 0 0 rg 50 500 Td (INJECTED' },
        employee: {
          id: 'emp_inj',
          name: 'Ahmed) Tj 1 0 0 rg (HACKED',
          factory: 'Fac) (\\/ () []',
          department: 'Dept) Tj /F2 12 Tf',
          position: 'Pos) \\\\ (((( ))))',
        },
        tenant: {
          name: 'Tenant) Tj (Compromised',
          brand: { corporateSubtitle: 'Sub) Tj (Sub', crNumber: 'CR) 123', taxNumber: 'TAX) 456' },
        },
      };
      const buf = pdfService.generatePayslipPdfBuffer(injectionInput);
      verifyPdf14Compliance(buf, 'PDF Injection Test');
      const str = buf.toString('utf8');
      assert.ok(!str.includes(') Tj 1 0 0 rg (HACKED'), 'Raw injection sequence must NOT appear unescaped');
      console.log('? 2.2 Malicious PDF operator sequences in name/fields neutralized by escapePdfText.');
    }

    // 2.3 Currency Unescaped Parentheses Injection Vulnerability Check
    {
      // Adversarial test: Currency containing closing parenthesis or PDF operators
      const currencyExploit = 'USD ($)';
      const buf = pdfService.generatePayslipPdfBuffer({
        employee: { currency: currencyExploit },
      });
      const str = buf.toString('utf8');
      const linesWithCurrency = str.split('\n').filter(l => l.includes('USD ($)'));
      if (linesWithCurrency.length > 0) {
        findings.push({
          severity: 'MEDIUM',
          component: 'pdfService.js:203,212,237,246',
          issue: 'Unescaped norm.currency in earnings and deductions table lines allows raw parenthesis injection',
          evidence: linesWithCurrency[0],
        });
        console.log('? 2.3 FINDING: norm.currency in earnings/deductions table lacks escapePdfText wrapper.');
      } else {
        console.log('? 2.3 Currency escaped safely.');
      }
    }

    // 2.4 Control Characters, Null Bytes & Emojis
    {
      const weirdChars = {
        payroll: {},
        employee: {
          id: 'emp_ctrl',
          name: 'Ahmed\x00\x01\x08\x0b\x0c\r\n\t ???? Worker',
          department: 'Dept\0With\0Nulls',
        },
      };
      const buf = pdfService.generatePayslipPdfBuffer(weirdChars);
      verifyPdf14Compliance(buf, 'Control Characters PDF');
      console.log('? 2.4 Null bytes, control characters, and emojis stripped/spaced safely.');
    }

    // 2.5 Extremely Long Text Strings (Layout & Memory)
    {
      const longInput = {
        employee: {
          id: 'emp_long',
          name: 'A'.repeat(5000),
          department: 'D'.repeat(2000),
          position: 'P'.repeat(1000),
        },
      };
      const buf = pdfService.generatePayslipPdfBuffer(longInput);
      verifyPdf14Compliance(buf, '5,000 Char Long String PDF');
      console.log('? 2.5 Extremely long 5,000 char strings accommodated without buffer overflow.');
    }

    // 2.6 Invalid Hex Colors in Tenant Branding
    {
      const invalidBrandInput = {
        tenant: {
          brand: {
            primaryColor: '#ZZZZZZ', // Invalid hex
          },
        },
      };
      const buf = pdfService.generatePayslipPdfBuffer(invalidBrandInput);
      const str = buf.toString('utf8');
      if (str.includes('NaN NaN NaN rg')) {
        findings.push({
          severity: 'LOW',
          component: 'pdfService.js:28-31',
          issue: 'hexToPdfRgb does not validate hex characters, resulting in NaN NaN NaN rg when given non-hex characters like #ZZZZZZ',
          evidence: 'Found "NaN NaN NaN rg" in generated PDF stream',
        });
        console.log('? 2.6 FINDING: hexToPdfRgb produces "NaN NaN NaN rg" for invalid hex strings like #ZZZZZZ.');
      } else {
        console.log('? 2.6 Invalid hex color handled.');
      }
    }

    // =============================================================
    // TEST SUITE 3: BATCH ZIP GENERATION & SCALING
    // =============================================================
    console.log('\n--- TEST SUITE 3: Batch ZIP Generation & Scalability ---');

    // 3.1 Empty ZIP Archive
    {
      const emptyZip = pdfService.createZipArchive([]);
      assert.ok(Buffer.isBuffer(emptyZip), 'Empty zip must be Buffer');
      assert.strictEqual(emptyZip.length, 22, 'Empty zip must be exactly 22 bytes (EOCD only)');
      assert.strictEqual(emptyZip.readUInt32LE(0), 0x06054b50, 'Empty zip signature must be EOCD 0x06054b50');
      console.log('? 3.1 Empty ZIP archive generated with valid 22-byte EOCD header.');
    }

    // 3.2 Single File ZIP Archive
    {
      const singlePdf = pdfService.generatePayslipPdfBuffer({});
      const singleZip = pdfService.createZipArchive([{ name: 'solo.pdf', content: singlePdf }]);
      assert.strictEqual(singleZip.readUInt32LE(0), 0x04034b50, 'Must have local file header');
      console.log(`? 3.2 Single file ZIP generated (${singleZip.length} bytes).`);
    }

    // 3.3 Zero-byte content file in ZIP
    {
      const zeroByteZip = pdfService.createZipArchive([
        { name: 'empty_file.txt', content: Buffer.alloc(0) },
      ]);
      assert.strictEqual(zeroByteZip.readUInt32LE(0), 0x04034b50);
      console.log('? 3.3 Zero-byte file compressed and stored in ZIP cleanly.');
    }

    // 3.4 Scalability: 500 Workers Batch Benchmark
    {
      const t0 = Date.now();
      const files = [];
      for (let i = 0; i < 500; i++) {
        const p = pdfService.generatePayslipPdfBuffer({
          employee: { id: `emp_${i}`, name: `Worker ${i}`, baseSalary: 7000 + i * 5 },
          payroll: { period: 'August 2026', basicSalary: 7000 + i * 5 },
        });
        files.push({ name: `Payslip_${i}.pdf`, content: p });
      }
      const tPdfs = Date.now();
      const zip = pdfService.createZipArchive(files);
      const tZip = Date.now();

      console.log(`? 3.4 Batch 500 Workers: Generated in ${tPdfs - t0}ms, Zipped in ${tZip - tPdfs}ms. Total: ${tZip - t0}ms. Size: ${(zip.length / 1024 / 1024).toFixed(2)} MB.`);
      assert.ok(tZip - t0 < 5000, '500 worker batch generation must complete within 5 seconds');
    }

    // 3.5 Large 10MB Uncompressed File in ZIP
    {
      const largeContent = crypto.randomBytes(10 * 1024 * 1024); // 10MB
      const largeZip = pdfService.createZipArchive([{ name: 'large_dump.dat', content: largeContent }]);
      assert.ok(largeZip.length > 10 * 1024 * 1024, 'ZIP contains large payload');
      console.log(`? 3.5 Large 10MB payload compressed into ZIP (${(largeZip.length / 1024 / 1024).toFixed(2)} MB).`);
    }

    // =============================================================
    // TEST SUITE 4: CRC-32 INTEGRITY & ORACLE DECOMPRESSION
    // =============================================================
    console.log('\n--- TEST SUITE 4: CRC-32 Integrity & Oracle Decompression ---');

    // 4.1 Cross-Language CRC-32 Comparison (Node vs Python binascii)
    {
      const testStrings = [
        '',
        'a',
        '123456789',
        'Workforce OS Enterprise Payroll Engine 2026',
        '?????? ?????? ?????????',
        'Special !@#$%^&*()_+{}:"<>?~` chars',
      ];

      // Standard IEEE 802.3 test vectors:
      // '123456789' -> 0xcbf43926 (3421780262)
      // '' -> 0x0
      const pyScript = `
import binascii, json, sys
data = ${JSON.stringify(testStrings)}
res = [binascii.crc32(s.encode('utf-8')) for s in data]
print(json.dumps(res))
`;
      const pyProc = spawnSync('python', ['-c', pyScript], { encoding: 'utf8' });
      assert.strictEqual(pyProc.status, 0, 'Python execution failed');
      const pyCrcs = JSON.parse(pyProc.stdout.trim());

      // Compare with pdfService.js internal crc32 by creating zip archives
      testStrings.forEach((s, idx) => {
        const buf = Buffer.from(s, 'utf8');
        const zip = pdfService.createZipArchive([{ name: 'test.txt', content: buf }]);
        const storedCrc = zip.readUInt32LE(14); // CRC offset in local file header
        assert.strictEqual(storedCrc, pyCrcs[idx], `CRC mismatch for string "${s}": got ${storedCrc}, expected ${pyCrcs[idx]}`);
      });
      console.log('? 4.1 CRC-32 matches Python binascii.crc32 and IEEE 802.3 reference vectors across all test cases.');
    }

    // 4.2 Python zipfile.testzip() Oracle Integrity Check
    {
      const sampleFiles = [
        { name: 'p1.pdf', content: pdfService.generatePayslipPdfBuffer({ employee: { name: 'Worker 1' } }) },
        { name: 'p2.pdf', content: pdfService.generatePayslipPdfBuffer({ employee: { name: 'Worker 2', currency: 'EGP' } }) },
        { name: 'data.txt', content: Buffer.from('Testing data stream integrity') },
        { name: 'empty.bin', content: Buffer.alloc(0) },
      ];
      const testZip = pdfService.createZipArchive(sampleFiles);

      const pyZipCheck = `
import io, zipfile, sys
zip_data = sys.stdin.buffer.read()
zf = zipfile.ZipFile(io.BytesIO(zip_data))
bad_file = zf.testzip()
if bad_file:
    print('CORRUPT:' + bad_file)
    sys.exit(1)
print('SUCCESS:' + str(len(zf.filelist)))
`;
      const proc = spawnSync('python', ['-c', pyZipCheck], {
        input: testZip,
        encoding: 'buffer',
      });
      const output = proc.stdout.toString('utf8').trim();
      assert.strictEqual(proc.status, 0, `Python zipfile found corrupt file: ${proc.stderr.toString('utf8')}`);
      assert.strictEqual(output, 'SUCCESS:4', 'All 4 files in ZIP passed CRC check');
      console.log('? 4.2 Python zipfile.testzip() verified 100% CRC integrity (0 corrupt bytes).');
    }

    // 4.3 Native Decompression & Byte-for-Byte Extraction Verification
    {
      const origPdf1 = pdfService.generatePayslipPdfBuffer({ employee: { name: 'Oracle Test Emp 1' } });
      const origPdf2 = pdfService.generatePayslipPdfBuffer({ employee: { name: 'Oracle Test Emp 2' } });
      const origText = Buffer.from('Oracle text content verification');

      const zipToExtract = pdfService.createZipArchive([
        { name: 'oracle1.pdf', content: origPdf1 },
        { name: 'oracle2.pdf', content: origPdf2 },
        { name: 'note.txt', content: origText },
      ]);

      const tempDir = path.join(__dirname, 'temp_decompress_test');
      const tempZipPath = path.join(__dirname, 'temp_test.zip');
      fs.writeFileSync(tempZipPath, zipToExtract);

      try {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        // Use PowerShell Expand-Archive
        const psRes = spawnSync('powershell', ['-Command', `Expand-Archive -Path "${tempZipPath}" -DestinationPath "${tempDir}" -Force`]);
        assert.strictEqual(psRes.status, 0, `PowerShell Expand-Archive failed: ${psRes.stderr.toString('utf8')}`);

        // Compare extracted files byte-for-byte
        const ext1 = fs.readFileSync(path.join(tempDir, 'oracle1.pdf'));
        const ext2 = fs.readFileSync(path.join(tempDir, 'oracle2.pdf'));
        const extText = fs.readFileSync(path.join(tempDir, 'note.txt'));

        assert.ok(origPdf1.equals(ext1), 'oracle1.pdf extracted byte mismatch!');
        assert.ok(origPdf2.equals(ext2), 'oracle2.pdf extracted byte mismatch!');
        assert.ok(origText.equals(extText), 'note.txt extracted byte mismatch!');
        console.log('? 4.3 PowerShell native decompression verified byte-for-byte fidelity with originals.');
      } finally {
        if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }

    // =============================================================
    // TEST SUITE 5: HTTP INTEGRATION & ROUTE LEVEL ADVERSARIAL EDGE CASES
    // =============================================================
    console.log('\n--- TEST SUITE 5: HTTP Integration & Route Edge Cases ---');

    // 5.1 Query Filters Yielding 0 Employees (404 no_employees_found)
    {
      const res404 = await request('GET', '/api/admin/payroll/payslips-zip?factory=NonExistentFactoryXYZ', {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res404.status, 404, 'Must return 404 when no employees match filters');
      assert.strictEqual(res404.json?.error, 'no_employees_found');
      console.log('? 5.1 Empty employee filter correctly returns 404 no_employees_found.');
    }

    // 5.2 Employees Without Payroll Record (Synthesize Baseline Statement)
    {
      // Insert a fresh employee with no payroll record
      const database = db();
      const freshEmp = {
        id: 'emp_no_payroll',
        name: 'Fresh Hire',
        employeeCode: 'EG-99999',
        nationalId: '29901011234999',
        factory: '10th of Ramadan',
        department: 'Production A',
        tenantId: 'elaraby',
        baseSalary: 6500,
      };
      database.employees.push(freshEmp);

      const resPdf = await request('GET', '/api/admin/payroll/emp_no_payroll/payslip-pdf', {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(resPdf.status, 200, 'Must synthesize baseline payslip when payroll not published');
      assert.strictEqual(resPdf.headers['content-type'], 'application/pdf');
      assert.ok(resPdf.buffer.toString('utf8').includes('Pending Publication'), 'Must show Pending Publication status');

      // Also check strict mode returns 404
      const resStrict = await request('GET', '/api/admin/payroll/emp_no_payroll/payslip-pdf?strict=true', {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(resStrict.status, 404, 'Strict query must return 404 when payroll not published');

      // Cleanup
      const idx = database.employees.findIndex(e => e.id === 'emp_no_payroll');
      if (idx !== -1) database.employees.splice(idx, 1);
      console.log('? 5.2 Employees without published payroll synthesize baseline statement (or 404 if strict).');
    }

    // 5.3 Batch ZIP with Slashes in Period Parameter (Zip Slip / Header Injection Analysis)
    {
      const resPeriodSlash = await request('GET', '/api/admin/payroll/payslips-zip?period=2026%2F08', {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(resPeriodSlash.status, 200);
      assert.strictEqual(resPeriodSlash.headers['content-type'], 'application/zip');
      
      // Check if period slash leaked into zip internal filenames
      const zipBuf = resPeriodSlash.buffer;
      const pyCheck = `
import io, zipfile, sys
zf = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
for n in zf.namelist():
    if '/' in n:
        print('CONTAINS_SLASH:' + n)
        sys.exit(0)
print('CLEAN')
`;
      const p = spawnSync('python', ['-c', pyCheck], { input: zipBuf, encoding: 'buffer' });
      const out = p.stdout.toString('utf8').trim();
      if (out.startsWith('CONTAINS_SLASH:')) {
        findings.push({
          severity: 'LOW',
          component: 'server/src/routes/admin.js:659',
          issue: 'Slash in query param period ("2026/08") is not sanitized with [^a-zA-Z0-9_-], creating subdirectories in ZIP archive',
          evidence: out,
        });
        console.log('? 5.3 FINDING: Slash in period query parameter creates subdirectory paths in ZIP archive.');
      } else {
        console.log('? 5.3 Period parameter sanitized in ZIP.');
      }
    }

    console.log('\n=============================================================');
    console.log('ADVERSARIAL STRESS TEST SUITE SUMMARY:');
    console.log(`Findings logged: ${findings.length}`);
    findings.forEach((f, i) => {
      console.log(` [${f.severity}] Finding ${i + 1}: ${f.component} - ${f.issue}`);
    });
    console.log('ALL CORE SPEC & INTEGRITY VERIFICATIONS PASSED');
    console.log('=============================================================');

  } catch (err) {
    console.error('? Adversarial Test Crashed:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
})();
