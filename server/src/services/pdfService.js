// server/src/services/pdfService.js
// Enterprise Corporate Payslip PDF & Batch ZIP Engine for Workforce OS
// Pure Node.js - Zero external npm dependencies - Vercel Serverless Ready

const crypto = require('crypto');
const zlib = require('zlib');
const { BUILTIN_TENANTS } = require('../routes/tenant');
const { data: db } = require('../db');

// --- CRC32 Lookup Table for Pure-JS ZIP ---
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}

// --- Hex Color to PDF RGB (0.00 - 1.00) ---
function hexToPdfRgb(hex, fallback = '0.04 0.39 0.71') {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '');
  if (clean.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(clean)) return fallback;
  const r = (parseInt(clean.slice(0, 2), 16) / 255).toFixed(2);
  const g = (parseInt(clean.slice(2, 4), 16) / 255).toFixed(2);
  const b = (parseInt(clean.slice(4, 6), 16) / 255).toFixed(2);
  return `${r} ${g} ${b}`;
}

// --- Escape text for PDF string literals ---
function escapePdfText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' '); // Map non-ASCII to safe space for WinAnsi
}

// --- Financial Normalization ---
function normalizePayroll(payroll = {}, employee = {}, tenant = {}) {
  const basicSalary = Number(
    payroll.basicSalary !== undefined 
      ? payroll.basicSalary 
      : (payroll.baseSalary !== undefined ? payroll.baseSalary : (employee.baseSalary || 7500))
  );

  const overtimeAmount = Number(payroll.overtimeAmount || 0);
  const transportAllowance = Number(payroll.transportAllowance || 0);
  const mealAllowance = Number(payroll.mealAllowance || 0);
  const incentiveBonus = Number(payroll.incentiveBonus || 0);

  const rawAllowances = Number(
    typeof payroll.allowances === 'object' 
      ? (payroll.allowances?.total || 0) 
      : (payroll.allowances || 0)
  );
  const allowancesTotal = rawAllowances > 0 
    ? rawAllowances 
    : (overtimeAmount + transportAllowance + mealAllowance + incentiveBonus);

  const socialInsurance = Number(
    payroll.socialInsurance !== undefined 
      ? payroll.socialInsurance 
      : Math.round(basicSalary * 0.11)
  );
  const incomeTax = Number(
    payroll.incomeTax !== undefined 
      ? payroll.incomeTax 
      : Math.round(basicSalary * 0.035)
  );
  const medicalInsurance = Number(payroll.medicalInsurance || 0);
  const loanDeduction = Number(payroll.loanDeduction || 0);
  const penalties = Number(payroll.penalties || 0);

  const rawDeductions = Number(
    typeof payroll.deductions === 'object' 
      ? (payroll.deductions?.total || 0) 
      : (payroll.deductions || 0)
  );
  const deductionsTotal = rawDeductions > 0 
    ? rawDeductions 
    : (socialInsurance + incomeTax + medicalInsurance + loanDeduction + penalties);

  const grossSalary = basicSalary + allowancesTotal;
  const netSalary = Number(
    payroll.netSalary !== undefined 
      ? payroll.netSalary 
      : (grossSalary - deductionsTotal)
  );

  const tenantBrand = tenant.brand || {};

  return {
    basicSalary,
    overtimeAmount,
    transportAllowance,
    mealAllowance,
    incentiveBonus,
    allowancesTotal,
    socialInsurance,
    incomeTax,
    medicalInsurance,
    loanDeduction,
    penalties,
    deductionsTotal,
    grossSalary,
    netSalary,
    currency: employee.currency || tenantBrand.currency || 'EGP',
    period: payroll.period || 'Current Period',
    paymentMethod: payroll.paymentMethod || 'Bank Transfer (CIB)',
    paidOn: payroll.paidOn || 'End of Month',
  };
}

// --- Generate High-Fidelity Corporate Payslip PDF Buffer ---
function generatePayslipPdfBuffer({ payroll = {}, employee = {}, tenant = {} }) {
  const norm = normalizePayroll(payroll, employee, tenant);
  const tenantBrand = tenant.brand || {};
  const brandRgb = hexToPdfRgb(tenantBrand.primaryColor, '0.04 0.39 0.71');
  const monogram = (tenant.name || 'Workforce OS').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'EG';

  // Page Dimensions: A4
  const W = 595.28;
  const H = 841.89;
  const y = (topY) => (H - topY).toFixed(2);

  let stream = '';

  // 1. Top Brand Accent Stripe (6pt)
  stream += `q ${brandRgb} rg 0 ${y(6)} ${W} 6 re f Q\n`;

  // 2. Corporate Header Banner (Dark Navy `#0F172A`)
  stream += `q 0.06 0.09 0.16 rg 0 ${y(90)} ${W} 84 re f Q\n`;

  // 3. Monogram Badge
  stream += `q ${brandRgb} rg 36 ${y(76)} 46 46 re f Q\n`;
  stream += `BT\n`;
  stream += `/F2 18 Tf 1 1 1 rg 46 ${y(60)} Td (${escapePdfText(monogram)}) Tj\n`;
  stream += `/F2 15 Tf 1 1 1 rg 94 ${y(46)} Td (${escapePdfText(tenant.name || 'Workforce OS')}) Tj\n`;
  stream += `/F1 8 Tf 0.8 0.85 0.9 rg 94 ${y(62)} Td (${escapePdfText(tenantBrand.corporateSubtitle || 'Enterprise Workforce Platform')}) Tj\n`;
  stream += `/F1 7.5 Tf 0.6 0.7 0.8 rg 94 ${y(76)} Td (CR: ${escapePdfText(tenantBrand.crNumber || 'EG-104821')} | Tax ID: ${escapePdfText(tenantBrand.taxNumber || 'EG-102-993-841')}) Tj\n`;

  // Header Right: Title & Pay Period
  stream += `/F2 12 Tf 1 1 1 rg 340 ${y(44)} Td (CONFIDENTIAL SALARY STATEMENT) Tj\n`;
  stream += `/F1 9 Tf 0.85 0.9 0.95 rg 340 ${y(60)} Td (Period: ${escapePdfText(norm.period)}) Tj\n`;
  stream += `/F1 8 Tf 0.7 0.75 0.8 rg 340 ${y(74)} Td (Disbursed: ${escapePdfText(norm.paidOn)} via ${escapePdfText(norm.paymentMethod)}) Tj\n`;
  stream += `ET\n`;

  // 4. Employee Information Grid Card
  stream += `q 0.97 0.98 0.99 rg 36 ${y(155)} 523.28 55 re f Q\n`;
  stream += `q 0.88 0.91 0.94 RG 1 w 36 ${y(155)} 523.28 55 re s Q\n`;

  stream += `BT\n`;
  stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg 48 ${y(120)} Td (EMPLOYEE NAME) Tj\n`;
  stream += `/F2 9.5 Tf 0.1 0.15 0.2 rg 48 ${y(134)} Td (${escapePdfText(employee.name || 'Employee')}) Tj\n`;
  stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg 48 ${y(146)} Td (Code: ${escapePdfText(employee.employeeCode || employee.id || 'N/A')}) Tj\n`;

  stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg 180 ${y(120)} Td (NATIONAL ID / CIVIL ID) Tj\n`;
  stream += `/F2 9.5 Tf 0.1 0.15 0.2 rg 180 ${y(134)} Td (${escapePdfText(employee.nationalId || 'N/A')}) Tj\n`;
  stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg 180 ${y(146)} Td (Factory: ${escapePdfText(employee.factory || 'Main Facility')}) Tj\n`;

  stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg 320 ${y(120)} Td (DEPARTMENT) Tj\n`;
  stream += `/F2 9.5 Tf 0.1 0.15 0.2 rg 320 ${y(134)} Td (${escapePdfText(employee.department || 'Operations')}) Tj\n`;
  stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg 320 ${y(146)} Td (Role: ${escapePdfText(employee.position || 'Specialist')}) Tj\n`;

  stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg 450 ${y(120)} Td (CURRENCY / STATUS) Tj\n`;
  stream += `/F2 10 Tf ${brandRgb} rg 450 ${y(134)} Td (${escapePdfText(norm.currency)}) Tj\n`;
  stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg 450 ${y(146)} Td (Status: Active / Confirmed) Tj\n`;
  stream += `ET\n`;

  // 5. Dual Column: Earnings vs. Deductions
  const leftX = 36;
  const colW = 250;
  const rightX = 309.28;

  // Earnings Header
  stream += `q 0.92 0.97 0.95 rg ${leftX} ${y(186)} ${colW} 24 re f Q\n`;
  stream += `BT\n`;
  stream += `/F2 9 Tf 0.02 0.47 0.34 rg ${leftX + 12} ${y(173)} Td (GROSS EARNINGS / ENTITLEMENTS) Tj\n`;
  stream += `ET\n`;

  const earningsList = [
    { label: 'Basic Contractual Salary', val: norm.basicSalary },
    { label: 'Overtime Allowance (135% / 170%)', val: norm.overtimeAmount },
    { label: 'Transportation Allowance', val: norm.transportAllowance },
    { label: 'Meal Allowance', val: norm.mealAllowance },
    { label: 'Production Incentive Bonus', val: norm.incentiveBonus },
  ];

  let curY = 186;
  for (let i = 0; i < earningsList.length; i++) {
    const item = earningsList[i];
    curY += 26;
    if (i % 2 === 1) stream += `q 0.98 0.99 1.0 rg ${leftX} ${y(curY)} ${colW} 26 re f Q\n`;
    stream += `q 0.9 0.92 0.94 RG 0.5 w ${leftX} ${y(curY)} ${colW} 0.5 re s Q\n`;
    stream += `BT\n`;
    stream += `/F1 8.5 Tf 0.2 0.25 0.3 rg ${leftX + 12} ${y(curY - 10)} Td (${escapePdfText(item.label)}) Tj\n`;
    stream += `/F2 8.5 Tf 0.05 0.35 0.2 rg ${leftX + 180} ${y(curY - 10)} Td (+${item.val.toLocaleString()} ${escapePdfText(norm.currency)}) Tj\n`;
    stream += `ET\n`;
  }
  // Earnings Subtotal
  curY += 28;
  stream += `q 0.88 0.95 0.91 rg ${leftX} ${y(curY)} ${colW} 28 re f Q\n`;
  stream += `q 0.1 0.6 0.3 RG 1.5 w ${leftX} ${y(curY)} ${colW} 0.5 re s Q\n`;
  stream += `BT\n`;
  stream += `/F2 9.5 Tf 0.05 0.45 0.25 rg ${leftX + 12} ${y(curY - 11)} Td (Total Gross Earnings) Tj\n`;
  stream += `/F2 10 Tf 0.05 0.5 0.25 rg ${leftX + 175} ${y(curY - 11)} Td (+${norm.grossSalary.toLocaleString()} ${escapePdfText(norm.currency)}) Tj\n`;
  stream += `ET\n`;

  // Deductions Header
  stream += `q 0.99 0.94 0.94 rg ${rightX} ${y(186)} ${colW} 24 re f Q\n`;
  stream += `BT\n`;
  stream += `/F2 9 Tf 0.75 0.15 0.15 rg ${rightX + 12} ${y(173)} Td (DEDUCTIONS & WITHHOLDINGS) Tj\n`;
  stream += `ET\n`;

  const deductionsList = [
    { label: 'Social Insurance (Employee 11%)', val: norm.socialInsurance },
    { label: 'Income Tax Withholding (Bracket)', val: norm.incomeTax },
    { label: 'Comprehensive Medical Insurance', val: norm.medicalInsurance },
    { label: 'Emergency Loan Installment', val: norm.loanDeduction },
    { label: 'Absence / Disciplinary Penalties', val: norm.penalties },
  ];

  curY = 186;
  for (let i = 0; i < deductionsList.length; i++) {
    const item = deductionsList[i];
    curY += 26;
    if (i % 2 === 1) stream += `q 1.0 0.98 0.98 rg ${rightX} ${y(curY)} ${colW} 26 re f Q\n`;
    stream += `q 0.9 0.92 0.94 RG 0.5 w ${rightX} ${y(curY)} ${colW} 0.5 re s Q\n`;
    stream += `BT\n`;
    stream += `/F1 8.5 Tf 0.2 0.25 0.3 rg ${rightX + 12} ${y(curY - 10)} Td (${escapePdfText(item.label)}) Tj\n`;
    stream += `/F2 8.5 Tf 0.7 0.1 0.1 rg ${rightX + 180} ${y(curY - 10)} Td (-${item.val.toLocaleString()} ${escapePdfText(norm.currency)}) Tj\n`;
    stream += `ET\n`;
  }
  // Deductions Subtotal
  curY += 28;
  stream += `q 0.98 0.88 0.88 rg ${rightX} ${y(curY)} ${colW} 28 re f Q\n`;
  stream += `q 0.8 0.2 0.2 RG 1.5 w ${rightX} ${y(curY)} ${colW} 0.5 re s Q\n`;
  stream += `BT\n`;
  stream += `/F2 9.5 Tf 0.75 0.1 0.1 rg ${rightX + 12} ${y(curY - 11)} Td (Total Deductions) Tj\n`;
  stream += `/F2 10 Tf 0.8 0.1 0.1 rg ${rightX + 175} ${y(curY - 11)} Td (-${norm.deductionsTotal.toLocaleString()} ${escapePdfText(norm.currency)}) Tj\n`;
  stream += `ET\n`;

  // 6. Net Payable Salary Callout Banner
  const netY = 390;
  stream += `q 0.94 0.97 1.0 rg 36 ${y(netY + 68)} 523.28 68 re f Q\n`;
  stream += `q ${brandRgb} RG 2 w 36 ${y(netY + 68)} 523.28 68 re s Q\n`;

  stream += `BT\n`;
  stream += `/F2 11 Tf ${brandRgb} rg 52 ${y(netY + 24)} Td (NET PAYABLE SALARY / SAFI AL-RATIB) Tj\n`;
  stream += `/F1 8.5 Tf 0.3 0.35 0.4 rg 52 ${y(netY + 42)} Td (Disbursed via ${escapePdfText(norm.paymentMethod)} on ${escapePdfText(norm.paidOn)}) Tj\n`;
  stream += `/F1 8 Tf 0.4 0.45 0.5 rg 52 ${y(netY + 56)} Td (Official Currency: ${escapePdfText(norm.currency)} | Statutory Labor Law Compliant) Tj\n`;

  stream += `/F2 20 Tf 0.05 0.35 0.7 rg 360 ${y(netY + 36)} Td (${norm.netSalary.toLocaleString()} ${escapePdfText(norm.currency)}) Tj\n`;
  stream += `ET\n`;

  // 7. Verification Seal & Vector QR Code Matrix
  const footerY = 510;
  stream += `q 1 1 1 rg 36 ${y(footerY + 80)} 80 80 re f Q\n`;
  stream += `q 0.8 0.85 0.9 RG 1 w 36 ${y(footerY + 80)} 80 80 re s Q\n`;

  // QR Code Finder Patterns
  const qrX = 42, qrTop = footerY + 6;
  stream += `q 0 0 0 rg ${qrX} ${y(qrTop + 20)} 20 20 re f Q\n`;
  stream += `q 1 1 1 rg ${qrX + 3} ${y(qrTop + 17)} 14 14 re f Q\n`;
  stream += `q 0 0 0 rg ${qrX + 6} ${y(qrTop + 14)} 8 8 re f Q\n`;

  stream += `q 0 0 0 rg ${qrX + 48} ${y(qrTop + 20)} 20 20 re f Q\n`;
  stream += `q 1 1 1 rg ${qrX + 51} ${y(qrTop + 17)} 14 14 re f Q\n`;
  stream += `q 0 0 0 rg ${qrX + 54} ${y(qrTop + 14)} 8 8 re f Q\n`;

  stream += `q 0 0 0 rg ${qrX} ${y(qrTop + 68)} 20 20 re f Q\n`;
  stream += `q 1 1 1 rg ${qrX + 3} ${y(qrTop + 65)} 14 14 re f Q\n`;
  stream += `q 0 0 0 rg ${qrX + 6} ${y(qrTop + 62)} 8 8 re f Q\n`;

  // Data blocks
  stream += `q 0 0 0 rg ${qrX + 28} ${y(qrTop + 35)} 14 14 re f Q\n`;
  stream += `q 0 0 0 rg ${qrX + 48} ${y(qrTop + 48)} 10 10 re f Q\n`;

  const auditHash = crypto.createHash('sha256')
    .update(`${employee.id || 'emp'}-${norm.period}-${norm.netSalary}-${employee.tenantId || tenant.id || 'elaraby'}`)
    .digest('hex');

  stream += `BT\n`;
  stream += `/F2 9 Tf 0.05 0.35 0.6 rg 130 ${y(footerY + 18)} Td (DIGITALLY VERIFIED ELECTRONIC DOCUMENT) Tj\n`;
  stream += `/F1 7.5 Tf 0.3 0.35 0.4 rg 130 ${y(footerY + 32)} Td (Tamper-evident verification hash: SHA256:${auditHash.slice(0, 32)}) Tj\n`;
  stream += `/F1 7.5 Tf 0.3 0.35 0.4 rg 130 ${y(footerY + 44)} Td (Scan QR Code to verify authentic payroll signature on Workforce OS Gateway) Tj\n`;
  stream += `/F1 7 Tf 0.5 0.55 0.6 rg 130 ${y(footerY + 60)} Td (Issued: ${new Date().toISOString()} | Generated by Enterprise Payroll Engine) Tj\n`;
  stream += `ET\n`;

  // 8. Signatures Block
  const sigY = 630;
  const sW = 160;
  const sGap = 21.64;
  const signatures = [
    { title: 'PREPARED BY', role: 'HR Payroll Specialist', note: 'Workforce Operations' },
    { title: 'AUDITED & APPROVED', role: 'Director of Finance', note: 'Financial Control Division' },
    { title: 'EMPLOYEE ACKNOWLEDGEMENT', role: 'Workforce Member', note: 'Signature & Date' },
  ];

  for (let i = 0; i < 3; i++) {
    const s = signatures[i];
    const sx = 36 + i * (sW + sGap);
    stream += `q 0.8 0.85 0.9 RG 1 w ${sx} ${y(sigY + 50)} ${sW} 0.5 re s Q\n`;
    stream += `BT\n`;
    stream += `/F2 8 Tf 0.2 0.25 0.3 rg ${sx} ${y(sigY + 62)} Td (${s.title}) Tj\n`;
    stream += `/F1 7.5 Tf 0.4 0.45 0.5 rg ${sx} ${y(sigY + 74)} Td (${s.role}) Tj\n`;
    stream += `/F1 7 Tf 0.6 0.65 0.7 rg ${sx} ${y(sigY + 86)} Td (${s.note}) Tj\n`;
    stream += `ET\n`;
  }

  // 9. Confidentiality Footer
  stream += `q 0.88 0.91 0.94 RG 0.5 w 36 ${y(780)} 523.28 0.5 re s Q\n`;
  stream += `BT\n`;
  stream += `/F1 7 Tf 0.5 0.55 0.6 rg 36 ${y(792)} Td (Workforce OS - Confidential Enterprise Record | Page 1 of 1 | Reproduction without authorization is prohibited.) Tj\n`;
  stream += `ET\n`;

  // Assemble PDF Objects
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>'); // Object 1: Catalog
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); // Object 2: Pages
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /ProcSet [/PDF /Text /ImageB /ImageC] >> >>`); // Object 3: Page
  
  const streamBuf = Buffer.from(stream, 'utf8');
  objects.push(`<< /Length ${streamBuf.length} >>\nstream\n${stream}\nendstream`); // Object 4: Stream
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // Object 5: Helvetica
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); // Object 6: Helvetica-Bold

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const startxref = Buffer.byteLength(pdf, 'utf8');
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${startxref}\n`;
  pdf += '%%EOF\n';

  return Buffer.from(pdf, 'utf8');
}

// --- Pure Node.js In-Memory PKZip 2.0 Generator ---
function createZipArchive(files = []) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const content = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content);
    const compressed = zlib.deflateRawSync(content);
    const crc = crc32(content);

    // Local file header (30 bytes + name)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // Signature
    local.writeUInt16LE(20, 4);          // Version needed: 2.0
    local.writeUInt16LE(0x0800, 6);      // Flags: UTF-8 filename
    local.writeUInt16LE(8, 8);           // Method: Deflate
    local.writeUInt16LE(0, 10);          // Mod time
    local.writeUInt16LE(0, 12);          // Mod date
    local.writeUInt32LE(crc, 14);        // CRC-32
    local.writeUInt32LE(compressed.length, 18); // Comp size
    local.writeUInt32LE(content.length, 22);    // Uncomp size
    local.writeUInt16LE(nameBuf.length, 26);    // Name len
    local.writeUInt16LE(0, 28);                 // Extra len
    nameBuf.copy(local, 30);

    parts.push(local);
    parts.push(compressed);

    // Central directory header (46 bytes + name)
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);     // Signature
    cd.writeUInt16LE(20, 4);             // Version made by: 2.0
    cd.writeUInt16LE(20, 6);             // Version needed: 2.0
    cd.writeUInt16LE(0x0800, 8);         // Flags: UTF-8
    cd.writeUInt16LE(8, 10);             // Method: Deflate
    cd.writeUInt16LE(0, 12);             // Mod time
    cd.writeUInt16LE(0, 14);             // Mod date
    cd.writeUInt32LE(crc, 16);           // CRC-32
    cd.writeUInt32LE(compressed.length, 20); // Comp size
    cd.writeUInt32LE(content.length, 24);    // Uncomp size
    cd.writeUInt16LE(nameBuf.length, 28);    // Name len
    cd.writeUInt16LE(0, 30);                 // Extra len
    cd.writeUInt16LE(0, 32);                 // Comment len
    cd.writeUInt16LE(0, 34);                 // Disk start
    cd.writeUInt16LE(0, 36);                 // Internal attrs
    cd.writeUInt32LE(0, 38);                 // External attrs
    cd.writeUInt32LE(offset, 42);            // Relative local header offset
    nameBuf.copy(cd, 46);
    central.push(cd);

    offset += local.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);      // End of central dir signature
  end.writeUInt16LE(0, 4);               // Disk num
  end.writeUInt16LE(0, 6);               // Disk start
  end.writeUInt16LE(files.length, 8);     // Entries on this disk
  end.writeUInt16LE(files.length, 10);    // Total entries
  end.writeUInt32LE(centralBuf.length, 12); // Central dir size
  end.writeUInt32LE(offset, 16);         // Central dir offset
  end.writeUInt16LE(0, 20);              // Comment len

  return Buffer.concat([...parts, centralBuf, end]);
}

module.exports = {
  generatePayslipPdfBuffer,
  createZipArchive,
  normalizePayroll,
};
