'use strict';

const BaseBankBatchGenerator = require('./BaseBankBatchGenerator');

/**
 * BanqueMisrBatchGenerator
 * Generates Banque Misr (بنك مصر) salary disbursement batches
 * in 200-byte fixed-width ACH format and BM Online Corporate CSV format.
 * CBE Code: 0002 | SWIFT: BMISEGCX
 */
class BanqueMisrBatchGenerator extends BaseBankBatchGenerator {
  constructor() {
    super({
      bankCode: 'misr',
      bankName: 'Banque Misr',
      cbeIdentifier: '0002',
      swiftCode: 'BMISEGCX',
    });
  }

  /**
   * Generates 200-byte fixed-width Banque Misr disbursement batch file.
   * @param {Object} options
   * @returns {string} CRLF-delimited fixed-width file content
   */
  generateFixedWidth(options = {}) {
    const {
      records = [],
      facilityCode = 'EGY-CORP-01',
      corporateIban = 'EG440003000000000123456789012',
      batchReference = `BM-BATCH-${this.formatDate()}-001`,
      valueDate = new Date(),
    } = options;

    const totalNetEgp = records.reduce((sum, r) => sum + (Number(r.netSalary) || 0), 0);
    const dateStr = this.formatDate(valueDate);

    // 1. Header Record (01) - 200 bytes
    const header = this.assertRecordLength(
      '01' +
      this.padString(facilityCode, 10) +
      this.padString(corporateIban, 29) +
      this.padString(dateStr, 8) +
      this.padNumber(records.length, 8) +
      this.toPiastres(totalNetEgp, 18) +
      'EGP' +
      this.padString(batchReference, 20) +
      ' '.repeat(102),
      200,
      'Banque Misr Header (01)'
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
      const dept = rec.department || rec.factory || 'Operations';

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
        this.padString(dept, 20) +
        ' '.repeat(9);

      return this.assertRecordLength(detailRecord, 200, `Banque Misr Detail (02) row ${seq}`);
    });

    // 3. Trailer Record (99) - 200 bytes
    const trailer = this.assertRecordLength(
      '99' +
      this.padNumber(records.length, 8) +
      this.toPiastres(totalNetEgp, 18) +
      ' '.repeat(172),
      200,
      'Banque Misr Trailer (99)'
    );

    return [header, ...details, trailer].join('\r\n') + '\r\n';
  }

  /**
   * Generates Banque Misr CSV batch.
   * @param {Object} options
   * @returns {string} UTF-8 BOM prefixed CSV string
   */
  generateCsv(options = {}) {
    const {
      records = [],
      period = new Date().toISOString().slice(0, 7),
    } = options;

    const headerLine = 'Line No,National ID,Employee Code,Employee Name,IBAN / Card Number,Bank Code,Basic Salary,Allowances,Deductions,Net Salary,Currency,Payment Month,Notes';

    const rows = records.map((r, idx) => {
      const seq = idx + 1;
      const basic = Number(r.basicSalary) || 0;
      const allowances = Number(r.allowances) || 0;
      const deductions = Number(r.deductions) || 0;
      const net = Number(r.netSalary) || 0;
      const iban = r.iban || r.accountNumber || '';

      return [
        seq,
        this.escapeCsv(r.nationalId || '00000000000000'),
        this.escapeCsv(r.employeeCode || `EMP-${1000 + idx}`),
        this.escapeCsv(r.name || ''),
        this.escapeCsv(iban),
        this.escapeCsv('0002'),
        this.formatDecimal(basic, 2),
        this.formatDecimal(allowances, 2),
        this.formatDecimal(deductions, 2),
        this.formatDecimal(net, 2),
        this.escapeCsv('EGP'),
        this.escapeCsv(period),
        this.escapeCsv(`SALARY DISBURSEMENT`),
      ].join(',');
    });

    return '\uFEFF' + [headerLine, ...rows].join('\r\n');
  }
}

module.exports = BanqueMisrBatchGenerator;
