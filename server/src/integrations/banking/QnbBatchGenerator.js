'use strict';

const BaseBankBatchGenerator = require('./BaseBankBatchGenerator');

/**
 * QnbBatchGenerator
 * Generates QNB ALAHLI (قطر الوطني الأهلي) salary disbursement batches
 * in 200-byte fixed-width ACH format and QNB Corporate Direct Credit CSV format.
 * CBE Code: 0037 | SWIFT: QNBAEGCX
 */
class QnbBatchGenerator extends BaseBankBatchGenerator {
  constructor() {
    super({
      bankCode: 'qnb',
      bankName: 'QNB ALAHLI',
      cbeIdentifier: '0037',
      swiftCode: 'QNBAEGCX',
    });
  }

  /**
   * Generates 200-byte fixed-width QNB ALAHLI disbursement batch file.
   * @param {Object} options
   * @returns {string} CRLF-delimited fixed-width file content
   */
  generateFixedWidth(options = {}) {
    const {
      records = [],
      facilityCode = 'CORP01',
      corporateIban = 'EG440003000000000123456789012',
      batchReference = `QNB_SAL_${this.formatDate()}_001`,
      valueDate = new Date(),
    } = options;

    const totalNetEgp = records.reduce((sum, r) => sum + (Number(r.netSalary) || 0), 0);
    const dateStr = this.formatDate(valueDate);

    // 1. Header Record (01) - 200 bytes
    const header = this.assertRecordLength(
      '01' +
      this.padString(facilityCode, 8) +
      this.padString(corporateIban, 29) +
      this.padString(dateStr, 8) +
      this.padNumber(records.length, 8) +
      this.toPiastres(totalNetEgp, 18) +
      'EGP' +
      this.padString(batchReference, 24) +
      ' '.repeat(100),
      200,
      'QNB Header (01)'
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
        this.padString(rec.employeeCode || `EMP-${1000 + seq}`, 12) +
        this.padString(rec.name || '', 50) +
        this.padString(rec.iban || rec.accountNumber || '', 29) +
        '0037' +
        this.toPiastres(net, 15) +
        this.toPiastres(basic, 12) +
        this.toPiastres(allowances, 12) +
        this.toPiastres(deductions, 12) +
        'EGP' +
        this.padString('MONTHLY SALARY DISBURSE', 24) +
        ' '.repeat(5);

      return this.assertRecordLength(detailRecord, 200, `QNB Detail (02) row ${seq}`);
    });

    // 3. Trailer Record (99) - 200 bytes
    const trailer = this.assertRecordLength(
      '99' +
      this.padNumber(records.length, 8) +
      this.toPiastres(totalNetEgp, 18) +
      ' '.repeat(172),
      200,
      'QNB Trailer (99)'
    );

    return [header, ...details, trailer].join('\r\n');
  }

  /**
   * Generates QNB Corporate Direct Credit CSV batch.
   * @param {Object} options
   * @returns {string} UTF-8 BOM prefixed CSV string
   */
  generateCsv(options = {}) {
    const {
      records = [],
      period = new Date().toISOString().slice(0, 7),
      valueDate = new Date(),
    } = options;

    const dateStr = this.formatDate(valueDate);
    const headerLine = 'Seq,Customer Reference,Beneficiary Name,Beneficiary IBAN,Bank Code,National ID,Basic Salary,Allowances,Deductions,Net Salary,Currency,Value Date,Description';

    const rows = records.map((r, idx) => {
      const seq = idx + 1;
      const basic = Number(r.basicSalary) || 0;
      const allowances = Number(r.allowances) || 0;
      const deductions = Number(r.deductions) || 0;
      const net = Number(r.netSalary) || 0;
      const iban = r.iban || r.accountNumber || '';

      return [
        seq,
        this.escapeCsv(r.employeeCode || `EMP-${1000 + idx}`),
        this.escapeCsv(r.name || ''),
        this.escapeCsv(iban),
        this.escapeCsv('0037'),
        this.escapeCsv(r.nationalId || '00000000000000'),
        this.formatDecimal(basic, 2),
        this.formatDecimal(allowances, 2),
        this.formatDecimal(deductions, 2),
        this.formatDecimal(net, 2),
        this.escapeCsv('EGP'),
        this.escapeCsv(dateStr),
        this.escapeCsv(`MONTHLY SALARY ${period}`),
      ].join(',');
    });

    return '\uFEFF' + [headerLine, ...rows].join('\r\n');
  }
}

module.exports = QnbBatchGenerator;
