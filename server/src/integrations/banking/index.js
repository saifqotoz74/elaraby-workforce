'use strict';

const BaseBankBatchGenerator = require('./BaseBankBatchGenerator');
const CibBatchGenerator = require('./CibBatchGenerator');
const NbeBatchGenerator = require('./NbeBatchGenerator');
const QnbBatchGenerator = require('./QnbBatchGenerator');
const BanqueMisrBatchGenerator = require('./BanqueMisrBatchGenerator');
const CbeWpsBatchGenerator = require('./CbeWpsBatchGenerator');
const HmacManifestSigner = require('./HmacManifestSigner');
const BankingReconciliationEngine = require('./BankingReconciliationEngine');

/**
 * BankingGateway
 * Facade providing unified access to Egyptian banking batch file generation,
 * cryptographic manifest signing, and disbursement feedback reconciliation.
 */
class BankingGateway {
  /**
   * Resolves the appropriate batch generator instance for a bank code.
   * @param {string} bankCode - 'cib' | 'nbe' | 'qnb' | 'misr' | 'wps_cbe' | 'cbe_wps'
   * @returns {BaseBankBatchGenerator}
   */
  static getGenerator(bankCode) {
    const code = String(bankCode || '').trim().toLowerCase();
    switch (code) {
      case 'cib':
        return new CibBatchGenerator();
      case 'nbe':
        return new NbeBatchGenerator();
      case 'qnb':
        return new QnbBatchGenerator();
      case 'misr':
      case 'banque_misr':
        return new BanqueMisrBatchGenerator();
      case 'wps_cbe':
      case 'cbe_wps':
      case 'cbe':
      case 'wps':
        return new CbeWpsBatchGenerator();
      default:
        // Default fallback to NBE generator for unrecognized standard bank codes
        return new NbeBatchGenerator();
    }
  }

  /**
   * Generates a complete disbursement batch, computes line count and totals,
   * and creates a tamper-evident HMAC-SHA256 manifest.
   *
   * @param {Object} options
   * @param {string} [options.bankCode='wps_cbe']
   * @param {string} [options.format] - 'fixed_width' | 'csv' | 'pipe_delimited'
   * @param {string} [options.fileType] - Alias for format
   * @param {Array<Object>} [options.payrollRecords]
   * @param {Array<Object>} [options.records]
   * @param {string} [options.batchReference]
   * @param {string} [options.period]
   * @param {string} [options.facilityCode='EGY-CORP-01']
   * @param {string} [options.corporateIban='EG440003000000000123456789012']
   * @param {string} [options.tenantId='elaraby']
   * @param {string} [options.secretKey]
   * @returns {{ rawContent: string, lineCount: number, totalAmount: number, manifest: Object, contentType: string, filename: string }}
   */
  static generateBatch(options = {}) {
    const rawBankCode = options.bankCode || 'wps_cbe';
    const cleanBankCode = String(rawBankCode).trim().toLowerCase();
    const generator = this.getGenerator(cleanBankCode);

    const records = options.payrollRecords || options.records || [];
    const period = options.period || new Date().toISOString().slice(0, 7);
    const tenantId = options.tenantId || 'elaraby';
    const facilityCode = options.facilityCode || 'EGY-CORP-01';
    const corporateIban = options.corporateIban || 'EG440003000000000123456789012';
    const batchReference =
      options.batchReference || `BATCH-${cleanBankCode.toUpperCase()}-${period.replace(/[-]/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // Determine target format:
    // If format/fileType explicitly specifies fixed_width / fixed, use fixed_width.
    // If wps_cbe, default is pipe_delimited (unless csv explicitly requested).
    // For nbe/cib/misr/qnb, default is csv for backward compatibility (unless fixed_width requested).
    const requestedFormat = (options.format || options.fileType || '').toLowerCase();
    const isWps = cleanBankCode === 'wps_cbe' || cleanBankCode === 'cbe_wps';

    let rawContent = '';
    let contentType = 'text/plain; charset=utf-8';
    let filename = '';
    let resolvedFormat = '';

    if (requestedFormat === 'fixed_width' || requestedFormat === 'fixed') {
      resolvedFormat = 'fixed_width';
      rawContent = generator.generateFixedWidth({
        records,
        facilityCode,
        corporateIban,
        batchReference,
        period,
      });
      contentType = 'text/plain; charset=utf-8';
      filename = `Payroll_${cleanBankCode.toUpperCase()}_${tenantId}_${period}.txt`;
    } else if (isWps) {
      resolvedFormat = 'pipe_delimited';
      rawContent = generator.generatePipeDelimited({
        records,
        facilityCode,
        corporateIban,
        period,
      });
      contentType = 'text/plain; charset=utf-8';
      filename = `WPS_CBE_${tenantId}_${period}.txt`;
    } else {
      resolvedFormat = 'csv';
      rawContent = generator.generateCsv({
        records,
        batchReference,
        period,
        facilityCode,
        corporateIban,
      });
      contentType = 'text/csv; charset=utf-8';
      filename = `Payroll_${cleanBankCode.toUpperCase()}_${tenantId}_${period}.csv`;
    }

    const totalAmount = records.reduce((sum, r) => {
      const net = Number(r.netSalary !== undefined ? r.netSalary : (r.baseSalary || 0));
      return sum + net;
    }, 0);

    const lineCount = records.length;

    // Generate tamper-evident HMAC-SHA256 cryptographic manifest
    const manifest = HmacManifestSigner.createManifest({
      payload: rawContent,
      batchReference,
      bankCode: cleanBankCode,
      lineCount,
      totalAmount,
      secretKey: options.secretKey,
      tenantId,
      currency: 'EGP',
    });

    return {
      rawContent,
      lineCount,
      totalAmount,
      manifest,
      contentType,
      filename,
      bankCode: cleanBankCode,
      format: resolvedFormat,
    };
  }
}

module.exports = {
  BaseBankBatchGenerator,
  CibBatchGenerator,
  NbeBatchGenerator,
  QnbBatchGenerator,
  BanqueMisrBatchGenerator,
  CbeWpsBatchGenerator,
  HmacManifestSigner,
  BankingReconciliationEngine,
  BankingGateway,
};
