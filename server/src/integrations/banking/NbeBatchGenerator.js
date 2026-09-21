'use strict';

const BaseBankBatchGenerator = require('./BaseBankBatchGenerator');

/**
 * NbeBatchGenerator
 * Generates National Bank of Egypt (NBE / البنك الأهلي المصري) salary disbursement batches
 * in 200-byte fixed-width ACH format and Al Ahly Net Corporate CSV format.
 * CBE Code: 0003 | SWIFT: NBEGEGCX
 */
class NbeBatchGenerator extends BaseBankBatchGenerator {
  constructor() {
    super({
      bankCode: 'nbe',
      bankName: 'National Bank of Egypt (NBE)',
      cbeIdentifier: '0003',
      swiftCode: 'NBEGEGCX',
    });
  }

  /**
   * Generates 200-byte fixed-width NBE disbursement batch file.
   * @param {Object} options
   * @returns {string} CRLF-delimited fixed-width file content
   */
  generateFixedWidth(options = {}) {
    const {
      records = [],
      facilityCode = 'EGY-CORP-01',
      corporateIban = 'EG440003000000000123456789012',
      batchReference = `BATCH-NBE-${this.formatDate()}-001`,
      period = new Date().toISOString().slice(0, 7),
      valueDate = new Date(),
    } = options;

    const totalNetEgp = records.reduce((sum, r) => sum + (Number(r.netSalary) || 0), 0);
    const dateStr = this.formatDate(valueDate);

    // 1. Header Record (01) - 200 bytes
    const header = this.assertRecordLength(
      '01' +
      '0003' +
      this.padString(facilityCode, 10) +
      this.padString(corporateIban, 29) +
      this.padString(dateStr, 8) +
      this.padNumber(records.length, 8) +
      this.toPiastres(totalNetEgp, 18) +
      'EGP' +
      this.padString(batchReference, 30) +
      ' '.repeat(88),
      200,
      'NBE Header (01)'
    );

    // 2. Detail Records (02) - 200 bytes each
    const details = records.map((rec, idx) => {
      const seq = idx + 1;
      const natIdStr = String(rec.nationalId || '00000000000000').replace(/\D/g, '');
      const natId = this.padNumber(natIdStr, 14);

      const basic = Number(rec.basicSalary) || 0;
      const allowances = Number(rec.allowances) || 0;
      const deductions = Number(rec.deductions) || 0;
      const net = Number(rec.netSalary) || 0;

      const detailRecord =
        '02' +
        this.padNumber(seq, 6) +
        natId +
        this.padString(rec.employeeCode || `EMP-${1000 + seq}`, 16) +
        this.padString(rec.name || '', 50) +
        this.padString(rec.iban || rec.accountNumber || '', 29) +
        this.toPiastres(net, 15) +
        this.toPiastres(basic, 12) +
        this.toPiastres(allowances, 12) +
        this.toPiastres(deductions, 12) +
        'EGP' +
        this.padString(period, 10) +
        ' '.repeat(19);

      return this.assertRecordLength(detailRecord, 200, `NBE Detail (02) row ${seq}`);
    });

    // 3. Trailer Record (99) - 200 bytes
    const trailer = this.assertRecordLength(
      '99' +
      this.padNumber(records.length, 8) +
      this.toPiastres(totalNetEgp, 18) +
      ' '.repeat(172),
      200,
      'NBE Trailer (99)'
    );

    return [header, ...details, trailer].join('\r\n') + '\r\n';
  }

  /**
   * Generates Al Ahly Net Corporate CSV batch.
   * Preserves 100% compatibility with existing test assertions.
   * @param {Object} options
   * @returns {string} UTF-8 BOM prefixed CSV string
   */
  generateCsv(options = {}) {
    const {
      records = [],
      period = new Date().toISOString().slice(0, 7),
    } = options;

    const headerLine = 'Employee Code,National ID,Employee Name,Department,Bank Name,IBAN / Account,Currency,Basic Salary,Allowances,Deductions,Net Salary,Payment Period';

    const rows = records.map((emp, idx) => {
      const basic = Number(emp.basicSalary) || 0;
      const allowances = Number(emp.allowances) || 0;
      const deductions = Number(emp.deductions) || 0;
      const net = Number(emp.netSalary) || 0;
      const fakeIban = `EG${String(99000000000000000000000000 + idx).slice(0, 27)}`;
      const iban = emp.iban || emp.accountNumber || fakeIban;

      return [
        this.escapeCsv(emp.employeeCode || `EMP-${1000 + idx}`),
        this.escapeCsv(emp.nationalId || '29801011234567'),
        this.escapeCsv(emp.name || `Employee ${idx + 1}`),
        this.escapeCsv(emp.department || 'Operations'),
        this.escapeCsv('National Bank of Egypt (NBE)'),
        this.escapeCsv(iban),
        this.escapeCsv('EGP'),
        basic,
        allowances,
        deductions,
        net,
        this.escapeCsv(period),
      ].join(',');
    });

    return '\uFEFF' + [headerLine, ...rows].join('\r\n');
  }
}

module.exports = NbeBatchGenerator;
