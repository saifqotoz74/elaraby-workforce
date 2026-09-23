// Bulk Excel / CSV Worker Import Engine & Auto-PIN Provisioning
// Enterprise-grade parser with Egyptian National ID / Phone validation,
// auto-PIN generation (last 4 digits of National ID), zero SMS cost onboarding,
// and pure-Node zero-external-dependency XLSX / CSV parsing.

const zlib = require('zlib');
const { data: db, save, transaction } = require('../db');
const { hash } = require('../auth');
const { recordAuditLog } = require('./auditService');
const { broadcast } = require('./realtimeService');
const { getCurrentTenantId } = require('../tenantContext');
const { checkScope } = require('../rbac');

// Valid Egyptian governorate codes (National ID digits 8-9)
const VALID_GOVERNORATES = new Set([
  '01', '02', '03', '04', '11', '12', '13', '14', '15', '16',
  '17', '18', '19', '21', '22', '23', '24', '25', '26', '27',
  '28', '29', '31', '32', '33', '34', '35', '88'
]);

// --- CRC32 Lookup Table for Pure-JS ZIP Generation ---
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

/**
 * Normalizes Arabic-Indic (٠-٩) and Persian numerals to standard ASCII (0-9).
 */
function normalizeDigits(str) {
  if (str === null || str === undefined) return '';
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
  let s = String(str)
    .replace(/[٠-٩]/g, (d) => arabicIndic.indexOf(d))
    .replace(/[۰-۹]/g, (d) => easternArabic.indexOf(d))
    .trim();

  // If number formatted in scientific notation by Excel (e.g. 2.9001010101234E+13)
  if (/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(s)) {
    try {
      const num = Number(s);
      if (!isNaN(num) && isFinite(num)) {
        s = BigInt(Math.round(num)).toString();
      }
    } catch (_) {}
  }

  // Strip trailing .0+ from Excel numeric floats (e.g. 29001010101234.0 -> 29001010101234)
  if (/^\d+\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, '');
  }

  return s;
}

/**
 * Validates 14-digit Egyptian National ID structure, century, birthdate, and governorate.
 */
function validateEgyptianNationalId(rawId) {
  const clean = normalizeDigits(rawId).replace(/[\s-]/g, '');

  if (!clean || clean.length !== 14 || !/^\d{14}$/.test(clean)) {
    return { ok: false, reason: 'National ID must be exactly 14 digits' };
  }

  const centuryChar = clean[0];
  if (centuryChar !== '2' && centuryChar !== '3') {
    return { ok: false, reason: 'National ID must start with 2 (1900s) or 3 (2000s)' };
  }

  const century = centuryChar === '2' ? 1900 : 2000;
  const year = century + parseInt(clean.slice(1, 3), 10);
  const month = parseInt(clean.slice(3, 5), 10);
  const day = parseInt(clean.slice(5, 7), 10);

  if (month < 1 || month > 12) {
    return { ok: false, reason: 'Invalid birth month in National ID' };
  }

  if (day < 1 || day > 31) {
    return { ok: false, reason: 'Invalid birth day in National ID' };
  }

  // Verify calendar validity (e.g. days in February, leap years)
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return { ok: false, reason: 'Birth date in National ID does not exist on the calendar' };
  }

  const govCode = clean.slice(7, 9);
  if (!VALID_GOVERNORATES.has(govCode)) {
    return { ok: false, reason: `Invalid Egyptian governorate code (${govCode}) in National ID` };
  }

  const checkDigit = parseInt(clean[13], 10);
  if (isNaN(checkDigit) || checkDigit < 1) {
    return { ok: false, reason: 'Invalid check digit in National ID' };
  }

  return { ok: true, cleanId: clean };
}

/**
 * Validates Egyptian mobile phone number (010, 011, 012, 015 - 11 digits).
 */
function validateEgyptianPhone(rawPhone) {
  let clean = normalizeDigits(rawPhone).replace(/[\s\-().+]/g, '');

  // Strip international prefix: 0020... or 20...
  if (clean.startsWith('0020')) {
    clean = clean.slice(4);
  } else if (clean.startsWith('20') && clean.length === 12) {
    clean = clean.slice(2);
  }

  if (!clean.startsWith('0')) {
    clean = '0' + clean;
  }

  if (!/^01[0125]\d{8}$/.test(clean)) {
    return { ok: false, reason: 'Phone must be a valid 11-digit Egyptian mobile number (010, 011, 012, 015)' };
  }

  return { ok: true, cleanPhone: clean };
}

/**
 * Validates basic salary.
 */
function validateSalary(rawSalary) {
  if (rawSalary === undefined || rawSalary === null || rawSalary === '') {
    return { ok: false, reason: 'Basic salary is required' };
  }
  const clean = normalizeDigits(rawSalary).replace(/[^\d.-]/g, '');
  const num = Number(clean);
  if (isNaN(num) || num <= 0) {
    return { ok: false, reason: 'Basic salary must be a positive number' };
  }
  return { ok: true, salary: num };
}

/**
 * Parses CSV text or buffer into 2D array of rows.
 */
function parseCsv(input) {
  let text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input || '');
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = [];

  for (const line of lines) {
    const row = [];
    let inQuotes = false;
    let token = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          token += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
        row.push(token.trim());
        token = '';
      } else {
        token += char;
      }
    }
    row.push(token.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Extracts all files from a ZIP buffer in pure Node.js.
 */
function extractZip(buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf);
  }
  const files = {};

  // Find End of Central Directory Record (0x06054b50)
  let eocdOffset = -1;
  const searchLimit = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= searchLimit; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const totalEntries = buf.readUInt16LE(eocdOffset + 10);
    const cdSize = buf.readUInt32LE(eocdOffset + 12);
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    let pos = cdOffset;

    for (let e = 0; e < totalEntries && pos < cdOffset + cdSize; e++) {
      if (buf.readUInt32LE(pos) !== 0x02014b50) break;
      const method = buf.readUInt16LE(pos + 10);
      const compSize = buf.readUInt32LE(pos + 20);
      const nameLen = buf.readUInt16LE(pos + 28);
      const extraLen = buf.readUInt16LE(pos + 30);
      const commentLen = buf.readUInt16LE(pos + 32);
      const localHeaderOffset = buf.readUInt32LE(pos + 42);
      const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
      pos += 46 + nameLen + extraLen + commentLen;

      if (localHeaderOffset + 30 <= buf.length) {
        const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const compData = buf.slice(dataStart, dataStart + compSize);
        let decompressed = null;

        if (method === 0) {
          decompressed = compData;
        } else if (method === 8) {
          try {
            decompressed = zlib.inflateRawSync(compData);
          } catch (_) {}
        }

        if (decompressed) {
          files[name] = decompressed.toString('utf8');
        }
      }
    }
    return files;
  }

  // Fallback: local file headers walk
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    const compData = buf.slice(dataStart, dataStart + compSize);
    let decompressed = null;

    if (method === 0) {
      decompressed = compData;
    } else if (method === 8) {
      try {
        decompressed = zlib.inflateRawSync(compData);
      } catch (_) {}
    }

    if (decompressed) {
      files[name] = decompressed.toString('utf8');
    }
    offset = dataStart + compSize;
  }

  return files;
}

function unescapeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match;
  while ((match = siRegex.exec(xml)) !== null) {
    const siContent = match[1];
    let text = '';
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let tMatch;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      text += unescapeXml(tMatch[1]);
    }
    strings.push(text);
  }
  return strings;
}

function colRefToIndex(ref) {
  const letters = String(ref || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, col - 1);
}

function parseSheetXml(sheetXml, sharedStrings) {
  if (!sheetXml) return [];
  const rows = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowContent = rowMatch[1];
    const currentRow = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];

      const rMatch = attrs.match(/r="([A-Za-z0-9]+)"/);
      const colIdx = rMatch ? colRefToIndex(rMatch[1]) : currentRow.length;
      const typeMatch = attrs.match(/t="([a-z]+)"/);
      const cellType = typeMatch ? typeMatch[1] : '';

      let val = '';
      if (cellType === 's') {
        const vMatch = inner.match(/<v>(\d+)<\/v>/);
        if (vMatch) {
          const sIdx = parseInt(vMatch[1], 10);
          val = sharedStrings[sIdx] || '';
        }
      } else if (cellType === 'inlineStr') {
        const tMatch = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        if (tMatch) val = unescapeXml(tMatch[1]);
      } else {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) val = unescapeXml(vMatch[1]);
      }

      while (currentRow.length < colIdx) {
        currentRow.push('');
      }
      currentRow[colIdx] = val.trim();
    }

    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses XLSX buffer into 2D array of rows in pure Node.js.
 * Supports multi-sheet workbooks: automatically selects worksheet containing worker headers.
 */
function parseXlsx(buffer) {
  const files = extractZip(buffer);
  const sharedXml = files['xl/sharedStrings.xml'] || files['xl/SharedStrings.xml'] || '';
  const sharedStrings = parseSharedStrings(sharedXml);

  // Discover all worksheet files
  const sheetKeys = Object.keys(files).filter((k) =>
    /^xl\/worksheets\/sheet\d+\.xml$/i.test(k)
  );

  if (sheetKeys.length === 0) {
    const fallback = Object.keys(files).find((k) => k.toLowerCase().includes('sheet') && k.endsWith('.xml'));
    if (fallback) sheetKeys.push(fallback);
  }

  if (sheetKeys.length === 0) {
    throw new Error('Unable to find worksheet data in Excel workbook');
  }

  // If multiple sheets exist, inspect each sheet to find the one containing worker headers
  let bestRows = [];
  for (const key of sheetKeys) {
    const candidateRows = parseSheetXml(files[key], sharedStrings);
    if (candidateRows.length >= 2) {
      const headerRow = candidateRows[0].map(normalizeHeaderName);
      const hasWorkerHeaders = headerRow.some((h) =>
        h === 'nationalId' || h === 'phone' || h === 'name' || h === 'basicSalary'
      );
      if (hasWorkerHeaders) {
        return candidateRows;
      }
      if (candidateRows.length > bestRows.length) {
        bestRows = candidateRows;
      }
    } else if (candidateRows.length > bestRows.length) {
      bestRows = candidateRows;
    }
  }

  if (bestRows.length > 0) {
    return bestRows;
  }

  return parseSheetXml(files[sheetKeys[0]], sharedStrings);
}

/**
 * Standard column mapping supporting English and Arabic variations.
 */
const COLUMN_ALIASES = {
  name: ['name', 'الاسم', 'اسم الموظف', 'full name', 'fullname', 'اسم'],
  nationalId: ['national id', 'nationalid', 'الرقم القومي', 'رقم البطاقة', 'رقم الهوية', 'بطاقة رقم قومي', 'nid', 'القومي'],
  phone: ['phone', 'mobile', 'رقم الهاتف', 'الموبايل', 'الهاتف', 'رقم المحمول', 'محمول', 'تليفون'],
  employeeCode: ['employee code', 'employeecode', 'كود الموظف', 'الرقم الوظيفي', 'code', 'id', 'كود'],
  department: ['department', 'القسم', 'الإدارة', 'ادارة', 'dept', 'إدارة'],
  factory: ['factory', 'المصنع', 'موقع العمل', 'فرع', 'site', 'مصنع'],
  position: ['position', 'المسمى الوظيفي', 'الوظيفة', 'job title', 'title', 'role', 'مسمى'],
  basicSalary: ['basic salary', 'basicsalary', 'الراتب الأساسي', 'المرتب', 'الراتب', 'salary', 'base salary', 'مرتب', 'راتب'],
  vacationBalance: ['vacation balance', 'vacationbalance', 'رصيد الإجازات', 'إجازات', 'رصيد'],
};

function normalizeHeaderName(raw) {
  const clean = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  for (const [standardKey, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(clean)) {
      return standardKey;
    }
  }
  return clean;
}

/**
 * Converts 2D array of rows to mapped objects based on header row.
 */
function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeaderName);
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const rawRow = rows[i];
    if (!rawRow || rawRow.every((c) => !c || String(c).trim() === '')) continue;

    const obj = { _rowIndex: i + 1 };
    headers.forEach((h, idx) => {
      obj[h] = rawRow[idx] !== undefined ? String(rawRow[idx]).trim() : '';
    });
    data.push(obj);
  }

  return data;
}

/**
 * Validates a single worker row and returns either sanitized entity or validation error.
 */
function validateWorkerRow(row, encounteredNationalIds = new Set(), existingDbNationalIds = new Set()) {
  const rowNum = row._rowIndex || 2;
  const name = String(row.name || '').trim();
  const rawNatId = row.nationalId;
  const rawPhone = row.phone;
  const rawSalary = row.basicSalary;

  if (!name || name.length < 2) {
    return { ok: false, row: rowNum, nationalId: rawNatId || '', reason: 'Name is required (minimum 2 characters)' };
  }

  // National ID Check
  const natCheck = validateEgyptianNationalId(rawNatId);
  if (!natCheck.ok) {
    return { ok: false, row: rowNum, nationalId: rawNatId || '', reason: natCheck.reason };
  }
  const cleanNatId = natCheck.cleanId;

  // In-file duplicate check
  if (encounteredNationalIds.has(cleanNatId)) {
    return { ok: false, row: rowNum, nationalId: cleanNatId, reason: 'Duplicate National ID found within this import file' };
  }
  encounteredNationalIds.add(cleanNatId);

  // Existing database duplicate check
  if (existingDbNationalIds.has(cleanNatId)) {
    return { ok: false, row: rowNum, nationalId: cleanNatId, reason: 'National ID is already registered in the organization' };
  }

  // Phone Check
  const phoneCheck = validateEgyptianPhone(rawPhone);
  if (!phoneCheck.ok) {
    return { ok: false, row: rowNum, nationalId: cleanNatId, reason: phoneCheck.reason };
  }

  // Salary Check
  const salCheck = validateSalary(rawSalary);
  if (!salCheck.ok) {
    return { ok: false, row: rowNum, nationalId: cleanNatId, reason: salCheck.reason };
  }

  // Vacation balance (default 21)
  let vacationBalance = 21;
  if (row.vacationBalance) {
    const parsedBal = Number(normalizeDigits(row.vacationBalance));
    if (!isNaN(parsedBal) && parsedBal >= 0) {
      vacationBalance = parsedBal;
    }
  }

  // Auto-generate PIN = last 4 digits of National ID
  const rawPin = cleanNatId.slice(-4);
  const pinHash = hash(rawPin);

  return {
    ok: true,
    data: {
      name,
      nationalId: cleanNatId,
      phone: phoneCheck.cleanPhone,
      employeeCode: row.employeeCode || `EG-${Math.floor(10000 + Math.random() * 90000)}`,
      factory: row.factory || '10th of Ramadan',
      department: row.department || 'Production',
      position: row.position || 'Worker',
      basicSalary: salCheck.salary,
      baseSalary: salCheck.salary,
      vacationBalance,
      pinHash,
      mustChangePinOnFirstLogin: true,
      active: true,
      tokenVersion: 1,
      createdAt: Date.now(),
    },
  };
}

/**
 * Main import runner for bulk workers file.
 * Handles CSV or XLSX buffer/string, validates all rows, provisions records with auto-PIN.
 */
async function importWorkers(admin, fileBufferOrString, { filename = 'workers.csv', ip, userAgent } = {}) {
  let rows = [];
  const isXlsx = filename.endsWith('.xlsx') ||
    (Buffer.isBuffer(fileBufferOrString) &&
      fileBufferOrString.length >= 4 &&
      fileBufferOrString.readUInt32LE(0) === 0x04034b50);

  if (isXlsx) {
    rows = parseXlsx(fileBufferOrString);
  } else {
    rows = parseCsv(fileBufferOrString);
  }

  if (rows.length < 2) {
    return {
      totalRows: 0,
      importedCount: 0,
      errorCount: 0,
      errors: [{ row: 1, reason: 'File does not contain any data rows' }],
      importedEmployees: [],
    };
  }

  const objects = rowsToObjects(rows);
  const tenantId = (
    getCurrentTenantId() ||
    admin?.tenantId ||
    'elaraby'
  ).toString().trim().toLowerCase();

  const currentDb = db();
  const existingTenEmps = (currentDb.employees || []).filter(
    (e) => (e.tenantId || 'elaraby').toLowerCase() === tenantId
  );
  const existingDbIds = new Set(existingTenEmps.map((e) => e.nationalId));
  const encounteredIds = new Set();

  const errors = [];
  const validEntities = [];

  for (const obj of objects) {
    const validation = validateWorkerRow(obj, encounteredIds, existingDbIds);
    if (!validation.ok) {
      errors.push({
        row: validation.row,
        nationalId: validation.nationalId,
        reason: validation.reason,
      });
    } else {
      const emp = validation.data;
      emp.id = `emp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}_${Math.random().toString(36).slice(2, 7)}`;
      emp.tenantId = tenantId;
      validEntities.push(emp);
    }
  }

  // Atomically persist valid employees into database
  if (validEntities.length > 0) {
    transaction((state) => {
      for (const emp of validEntities) {
        state.employees.push(emp);
      }

      recordAuditLog(state, {
        actor: admin?.sub || 'admin',
        role: admin?.role || 'superadmin',
        action: 'bulk_import_employees',
        entity: 'employee',
        details: `Bulk imported ${validEntities.length} employees with Auto-PIN (Last 4 digits of National ID)`,
        tenantId,
        ip,
        userAgent,
      });
    });

    try {
      broadcast('employee.created', { count: validEntities.length, bulk: true }, { tenantId });
    } catch (_) {}
  }

  return {
    totalRows: objects.length,
    importedCount: validEntities.length,
    errorCount: errors.length,
    errors,
    importedEmployees: validEntities.map((e) => ({
      id: e.id,
      name: e.name,
      nationalId: e.nationalId,
      employeeCode: e.employeeCode,
      phone: e.phone,
      factory: e.factory,
      department: e.department,
      position: e.position,
      basicSalary: e.basicSalary,
      mustChangePinOnFirstLogin: e.mustChangePinOnFirstLogin,
    })),
  };
}

/**
 * Creates a valid ZIP buffer from a dictionary of file contents.
 */
function createZip(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const rawBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const compBuf = zlib.deflateRawSync(rawBuf);
    const fileCrc = crc32(rawBuf);
    const nameBuf = Buffer.from(name, 'utf8');

    // Local file header (30 bytes)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4); // Min version (2.0)
    localHeader.writeUInt16LE(0, 6); // Flags
    localHeader.writeUInt16LE(8, 8); // Method 8 (Deflate)
    localHeader.writeUInt16LE(0, 10); // Time
    localHeader.writeUInt16LE(0, 12); // Date
    localHeader.writeUInt32LE(fileCrc, 14); // CRC32
    localHeader.writeUInt32LE(compBuf.length, 18); // Comp Size
    localHeader.writeUInt32LE(rawBuf.length, 22); // Uncomp Size
    localHeader.writeUInt16LE(nameBuf.length, 26); // Name Length
    localHeader.writeUInt16LE(0, 28); // Extra field length
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compBuf);

    // Central directory header (46 bytes)
    const cdHeader = Buffer.alloc(46 + nameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
    cdHeader.writeUInt16LE(20, 4); // Version made by
    cdHeader.writeUInt16LE(20, 6); // Version needed
    cdHeader.writeUInt16LE(0, 8); // Flags
    cdHeader.writeUInt16LE(8, 10); // Method 8 (Deflate)
    cdHeader.writeUInt16LE(0, 12); // Time
    cdHeader.writeUInt16LE(0, 14); // Date
    cdHeader.writeUInt32LE(fileCrc, 16); // CRC32
    cdHeader.writeUInt32LE(compBuf.length, 20); // Comp Size
    cdHeader.writeUInt32LE(rawBuf.length, 24); // Uncomp Size
    cdHeader.writeUInt16LE(nameBuf.length, 28); // Name Length
    cdHeader.writeUInt16LE(0, 30); // Extra length
    cdHeader.writeUInt16LE(0, 32); // Comment length
    cdHeader.writeUInt16LE(0, 34); // Disk number start
    cdHeader.writeUInt16LE(0, 36); // Internal attributes
    cdHeader.writeUInt32LE(0, 38); // External attributes
    cdHeader.writeUInt32LE(offset, 42); // Relative offset of local header
    nameBuf.copy(cdHeader, 46);

    centralHeaders.push(cdHeader);
    offset += localHeader.length + compBuf.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  centralHeaders.forEach((h) => (cdSize += h.length));

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Disk with central directory
  eocd.writeUInt16LE(centralHeaders.length, 8); // Entries on this disk
  eocd.writeUInt16LE(centralHeaders.length, 10); // Total entries
  eocd.writeUInt32LE(cdSize, 12); // Central directory size
  eocd.writeUInt32LE(cdOffset, 16); // Central directory offset
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Generates an official, pre-formatted import template (CSV with BOM or XLSX).
 */
function generateTemplate(format = 'xlsx') {
  if (format === 'csv') {
    const csvContent =
      '\uFEFF' +
      'الاسم,الرقم القومي,رقم الهاتف,كود الموظف,القسم,المصنع,المسمى الوظيفي,الراتب الأساسي,رصيد الإجازات\r\n' +
      'أحمد محمد إبراهيم,29001011401234,01012345678,EG-10001,Production A,10th of Ramadan,فني تشغيل ماكينات,7500,21\r\n' +
      'محمود عبد الله علي,29505151609876,01198765432,EG-10002,Quality Control,10th of Ramadan,مراقب جودة,8200,21\r\n' +
      'سيد حسن مصطفى,30102032104568,01287654321,EG-10003,Maintenance,10th of Ramadan,فني صيانة ميكانيكية,6800,21\r\n';
    return {
      contentType: 'text/csv; charset=utf-8',
      filename: 'workforce_import_template.csv',
      buffer: Buffer.from(csvContent, 'utf8'),
    };
  }

  // Pre-built OpenXML Excel Workbook (.xlsx)
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedString+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Workers" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedString" Target="sharedStrings.xml"/>
</Relationships>`;

  const strings = [
    'الاسم',
    'الرقم القومي',
    'رقم الهاتف',
    'كود الموظف',
    'القسم',
    'المصنع',
    'المسمى الوظيفي',
    'الراتب الأساسي',
    'رصيد الإجازات',
    'أحمد محمد إبراهيم',
    '29001011401234',
    '01012345678',
    'EG-10001',
    'Production A',
    '10th of Ramadan',
    'فني تشغيل ماكينات',
    'محمود عبد الله علي',
    '29505151609876',
    '01198765432',
    'EG-10002',
    'Quality Control',
    'مراقب جودة',
  ];

  let sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">`;
  strings.forEach((s) => {
    sharedStringsXml += `<si><t>${s}</t></si>`;
  });
  sharedStringsXml += `</sst>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
      <c r="F1" t="s"><v>5</v></c>
      <c r="G1" t="s"><v>6</v></c>
      <c r="H1" t="s"><v>7</v></c>
      <c r="I1" t="s"><v>8</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>9</v></c>
      <c r="B2" t="s"><v>10</v></c>
      <c r="C2" t="s"><v>11</v></c>
      <c r="D2" t="s"><v>12</v></c>
      <c r="E2" t="s"><v>13</v></c>
      <c r="F2" t="s"><v>14</v></c>
      <c r="G2" t="s"><v>15</v></c>
      <c r="H2"><v>7500</v></c>
      <c r="I2"><v>21</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>16</v></c>
      <c r="B3" t="s"><v>17</v></c>
      <c r="C3" t="s"><v>18</v></c>
      <c r="D3" t="s"><v>19</v></c>
      <c r="E3" t="s"><v>20</v></c>
      <c r="F3" t="s"><v>14</v></c>
      <c r="G3" t="s"><v>21</v></c>
      <c r="H3"><v>8200</v></c>
      <c r="I3"><v>21</v></c>
    </row>
  </sheetData>
</worksheet>`;

  const zip = createZip({
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': relsXml,
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': workbookRelsXml,
    'xl/sharedStrings.xml': sharedStringsXml,
    'xl/worksheets/sheet1.xml': sheet1Xml,
  });

  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'workforce_import_template.xlsx',
    buffer: zip,
  };
}

module.exports = {
  validateEgyptianNationalId,
  validateEgyptianPhone,
  validateSalary,
  parseCsv,
  parseXlsx,
  extractZip,
  createZip,
  importWorkers,
  generateTemplate,
};
