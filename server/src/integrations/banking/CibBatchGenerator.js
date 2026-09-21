'use strict';

const BaseBankBatchGenerator = require('./BaseBankBatchGenerator');

/**
 * CibBatchGenerator
 * Generates Commercial International Bank (CIB Egypt) salary disbursement batches
 * in 200-byte fixed-width ACH format and CIB Business Online Direct Credit CSV format.
 * CBE Code: 0024 | SWIFT: CIBEEGCX
 */
class CibBatchGenerator extends BaseBankBatchGenerator {
  constructor() {
    super({
      bankCode: 'cib',
      bankName: 'Commercial International Bank (CIB)',
      cbeIdentifier: '0024',
      swiftCode: 'CIBEEGCX',
    });
  }

  /**
   * Generates 200-byte fixed-width CIB disbursement batch file.
   * @param {Object} options
   * @param {Array<Object>} options.records - Array of payroll disbursement records
   * @param {string} [options.facilityCode='EGY-CORP-01'] - Corporate client facility ID
   * @param {string} [options.corporateIban='EG440003000000000123456789012'] - Corporate debit IBAN
   * @param {string} [options.batchReference] - Unique batch identifier
   * @param {string} [options.period] - Payroll period (e.g. '2026-09')
   * @param {Date|string} [options.valueDate] - Execution date
   * @returns {string} CRLF-delimited fixed-width file content
   */
  generateFixedWidth(options = {}) {
    const {
      records = [],
      facilityCode = 'EGY-CORP-01',
      corporateIban = 'EG440003000000000123456789012',
      batchReference = `BATCH-CIB-${this.formatDate()}-001`,
      period = new Date().toISOString().slice(0, 7),
      valueDate = new Date(),
    } = options;

    const totalNetEgp = records.reduce((sum, r) => sum + (Number(r.netSalary) || 0), 0);
    const dateStr = this.formatDate(valueDate);
    const timestampStr = this.formatTimestamp(valueDate);

    // 1. Header Record (01) - 200 bytes
    const header = this.assertRecordLength(
      '01' +
      this.padString(facilityCode, 10) +
      this.padString(corporateIban, 29) +
      this.padString(dateStr, 8) +
      this.padNumber(records.length, 8) +
      this.toPiastres(totalNetEgp, 18) +
      'EGP' +
      this.padString(timestampStr, 14) +
      this.padString(batchReference, 28) +
      ' '.repeat(80),
      200,
      'CIB Header (01)'
    );

    // 2. Detail Records (02) - 200 bytes each
    let nationalIdControlSum = 0;
    const details = records.map((rec, idx) => {
      const seq = idx + 1;
      const natIdStr = String(rec.nationalId || '00000000000000').replace(/\D/g, '');
      const natId = this.padNumber(natIdStr, 14);
      const last4 = parseInt(natId.slice(-4), 10) || 0;
      nationalIdControlSum += last4;

      const basic = Number(rec.basicSalary) || 0;
      const allowances = Number(rec.allowances) || 0;
      const deductions = Number(rec.deductions) || 0;
      const net = Number(rec.netSalary) || 0;
      const narrative = this.padString(`SALARY ${period || ''}`.trim(), 30);

      const detailRecord =
        '02' +
        this.padNumber(seq, 6) +
        natId +
        this.padString(rec.employeeCode || `EMP-${1000 + seq}`, 15) +
        this.padString(rec.name || '', 50) +
        this.padString(rec.iban || rec.accountNumber || '', 29) +
        this.toPiastres(basic, 12) +
        this.toPiastres(allowances, 12) +
        this.toPiastres(deductions, 12) +
        this.toPiastres(net, 15) +
        'EGP' +
        narrative;

      return this.assertRecordLength(detailRecord, 200, `CIB Detail (02) row ${seq}`);
    });

    // 3. Trailer Record (99) - 200 bytes
    const trailer = this.assertRecordLength(
      '99' +
      this.padNumber(records.length, 8) +
      this.toPiastres(totalNetEgp, 18) +
      this.padNumber(nationalIdControlSum, 16) +
      ' '.repeat(156),
      200,
      'CIB Trailer (99)'
    );

    return [header, ...details, trailer].join('\r\n') + '\r\n';
  }

  /**
   * Generates CIB Direct Credit CSV batch.
   * @param {Object} options
   * @returns {string} UTF-8 BOM prefixed CSV string
   */
  generateCsv(options = {}) {
    const {
      records = [],
      batchReference = `BATCH-CIB-${this.formatDate()}-001`,
      period = new Date().toISOString().slice(0, 7),
      valueDate = new Date(),
    } = options;

    const dateStr = this.formatDate(valueDate);
    const headerLine = 'Transaction Reference,Employee Code,National ID,Beneficiary Name,Beneficiary IBAN,Bank Code,Basic Salary,Allowances,Deductions,Net Salary,Currency,Payment Date,Remarks';

    const rows = records.map((r, idx) => {
      const basic = Number(r.basicSalary) || 0;
      const allowances = Number(r.allowances) || 0;
      const deductions = Number(r.deductions) || 0;
      const net = Number(r.netSalary) || 0;
      const iban = r.iban || r.accountNumber || '';

      return [
        this.escapeCsv(batchReference),
        this.escapeCsv(r.employeeCode || `EMP-${1000 + idx}`),
        this.escapeCsv(r.nationalId || '00000000000000'),
        this.escapeCsv(r.name || ''),
        this.escapeCsv(iban),
        this.escapeCsv('0024'),
        this.formatDecimal(basic, 2),
        this.formatDecimal(allowances, 2),
        this.formatDecimal(deductions, 2),
        this.formatDecimal(net, 2),
        this.escapeCsv('EGP'),
        this.escapeCsv(dateStr),
        this.escapeCsv(`SALARY ${period}`),
      ].join(',');
    });

    return '\uFEFF' + [headerLine, ...rows].join('\r\n');
  }
}

module.exports = CibBatchGenerator;
