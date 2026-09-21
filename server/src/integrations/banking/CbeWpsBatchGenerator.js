'use strict';

const BaseBankBatchGenerator = require('./BaseBankBatchGenerator');

/**
 * CbeWpsBatchGenerator
 * Generates Central Bank of Egypt (CBE) Wages Protection System (WPS) standard batch files.
 * Pipe-delimited records (01 header, 02 detail) with CRLF line endings.
 */
class CbeWpsBatchGenerator extends BaseBankBatchGenerator {
  constructor() {
    super({
      bankCode: 'cbe_wps',
      bankName: 'Central Bank of Egypt (WPS)',
      cbeIdentifier: '0000',
      swiftCode: 'CBEGEGCX',
    });
  }

  /**
   * Generates CBE WPS standard pipe-delimited batch file.
   * @param {Object} options
   * @param {Array<Object>} options.records
   * @param {string} [options.facilityCode='EGY-CORP-01']
   * @param {string} [options.corporateIban='EG440003000000000123456789012']
   * @param {string} [options.period]
   * @param {Date|string} [options.valueDate]
   * @returns {string} Pipe-delimited CRLF string
   */
  generatePipeDelimited(options = {}) {
    const {
      records = [],
      facilityCode = 'EGY-CORP-01',
      corporateIban = 'EG440003000000000123456789012',
      period = new Date().toISOString().slice(0, 7),
      valueDate = new Date(),
    } = options;

    let totalAmount = 0;
    const nowStr = this.formatTimestamp(valueDate);

    const detailRows = records.map((emp, idx) => {
      const basic = Number(emp.basicSalary !== undefined ? emp.basicSalary : 7500);
      const allowances = Number(emp.allowances?.total !== undefined ? emp.allowances.total : (typeof emp.allowances === 'number' ? emp.allowances : Math.round(basic * 0.22)));
      const deductions = Number(emp.deductions?.total !== undefined ? emp.deductions.total : (typeof emp.deductions === 'number' ? emp.deductions : Math.round(basic * 0.08)));
      const net = Number(emp.netSalary !== undefined ? emp.netSalary : (basic + allowances - deductions));
      totalAmount += net;

      const fakeIban = `EG${String(99000000000000000000000000 + idx).slice(0, 27)}`;
      const iban = emp.iban || emp.accountNumber || fakeIban;
      const natId = emp.nationalId || '29801011234567';
      const name = emp.name || emp.employeeName || `Employee ${idx + 1}`;

      return `02|${natId}|${iban}|${name}|${basic}|${allowances}|${deductions}|${net}|EGP|SALARY`;
    });

    const header = `01|${facilityCode}|${corporateIban}|${period}|${records.length}|${totalAmount}|EGP|${nowStr}`;
    return [header, ...detailRows].join('\r\n');
  }

  /**
   * Alias for generatePipeDelimited to satisfy generic interface.
   */
  generateFixedWidth(options = {}) {
    return this.generatePipeDelimited(options);
  }

  /**
   * Generates CSV representation of WPS data.
   */
  generateCsv(options = {}) {
    const {
      records = [],
      facilityCode = 'EGY-CORP-01',
      corporateIban = 'EG440003000000000123456789012',
      period = new Date().toISOString().slice(0, 7),
    } = options;

    const headerLine = 'Record Type,Facility Code,Corporate IBAN,National ID,Beneficiary IBAN,Beneficiary Name,Basic Salary,Allowances,Deductions,Net Salary,Currency,Period';

    const rows = records.map((r, idx) => {
      const basic = Number(r.basicSalary !== undefined ? r.basicSalary : 7500);
      const allowances = Number(r.allowances?.total !== undefined ? r.allowances.total : (typeof r.allowances === 'number' ? r.allowances : Math.round(basic * 0.22)));
      const deductions = Number(r.deductions?.total !== undefined ? r.deductions.total : (typeof r.deductions === 'number' ? r.deductions : Math.round(basic * 0.08)));
      const net = Number(r.netSalary !== undefined ? r.netSalary : (basic + allowances - deductions));

      const fakeIban = `EG${String(99000000000000000000000000 + idx).slice(0, 27)}`;
      const iban = r.iban || r.accountNumber || fakeIban;

      return [
        '02',
        this.escapeCsv(facilityCode),
        this.escapeCsv(corporateIban),
        this.escapeCsv(r.nationalId || '29801011234567'),
        this.escapeCsv(iban),
        this.escapeCsv(r.name || r.employeeName || `Employee ${idx + 1}`),
        basic,
        allowances,
        deductions,
        net,
        this.escapeCsv('EGP'),
        this.escapeCsv(period),
      ].join(',');
    });

    return '\uFEFF' + [headerLine, ...rows].join('\r\n');
  }
}

module.exports = CbeWpsBatchGenerator;
