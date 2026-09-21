'use strict';

/**
 * BaseBankBatchGenerator
 * Abstract base class for Central Bank of Egypt (CBE) and Egyptian commercial bank batch file generators.
 * Provides standard utility methods for field padding, piastres conversion, timestamp formatting,
 * CSV quoting, and 200-byte record length invariant assertions.
 */
class BaseBankBatchGenerator {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.bankCode='generic']
   * @param {string} [options.bankName='General Banking']
   * @param {string} [options.cbeIdentifier='0000']
   * @param {string} [options.swiftCode='']
   */
  constructor(options = {}) {
    this.bankCode = options.bankCode || 'generic';
    this.bankName = options.bankName || 'General Banking';
    this.cbeIdentifier = options.cbeIdentifier || '0000';
    this.swiftCode = options.swiftCode || '';
  }

  /**
   * Left-aligns a value, truncates if exceeding target length, and right-pads with padChar.
   * @param {string|number} value
   * @param {number} length
   * @param {string} [padChar=' ']
   * @returns {string}
   */
  padString(value, length, padChar = ' ') {
    const raw = (value === null || value === undefined) ? '' : String(value);
    let str = raw;
    let byteLen = Buffer.byteLength(str, 'utf8');

    if (byteLen > length) {
      let truncated = '';
      let currentBytes = 0;
      for (const ch of str) {
        const chBytes = Buffer.byteLength(ch, 'utf8');
        if (currentBytes + chBytes > length) {
          break;
        }
        truncated += ch;
        currentBytes += chBytes;
      }
      str = truncated;
      byteLen = currentBytes;
    }

    const padByteLen = Buffer.byteLength(padChar, 'utf8') || 1;
    const paddingNeeded = Math.max(0, Math.floor((length - byteLen) / padByteLen));
    let result = str + padChar.repeat(paddingNeeded);
    const remaining = length - Buffer.byteLength(result, 'utf8');
    if (remaining > 0) {
      result += ' '.repeat(remaining);
    }
    return result;
  }

  /**
   * Right-aligns an integer number, left-pads with '0', truncates to last N digits if exceeding.
   * @param {number|string} value
   * @param {number} length
   * @returns {string}
   */
  padNumber(value, length) {
    const num = Math.round(Number(value) || 0);
    const str = String(Math.max(0, num));
    if (str.length > length) {
      return str.slice(str.length - length);
    }
    return str.padStart(length, '0');
  }

  /**
   * Converts an amount in Egyptian Pounds (EGP) to Egyptian Piastres (قرش),
   * where 1 EGP = 100 Piastres, right-aligned and zero-padded.
   * @param {number|string} amountInEgp
   * @param {number} length
   * @returns {string}
   */
  toPiastres(amountInEgp, length) {
    const piastres = Math.round((Number(amountInEgp) || 0) * 100);
    return this.padNumber(piastres, length);
  }

  /**
   * Formats a number to a fixed-point decimal string.
   * @param {number|string} value
   * @param {number} [decimals=2]
   * @returns {string}
   */
  formatDecimal(value, decimals = 2) {
    return (Number(value) || 0).toFixed(decimals);
  }

  /**
   * Formats a date into YYYYMMDD string.
   * @param {Date|string|number} [date=new Date()]
   * @returns {string}
   */
  formatDate(date = new Date()) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  /**
   * Formats a timestamp into YYYYMMDDHHMMSS string.
   * @param {Date|string|number} [date=new Date()]
   * @returns {string}
   */
  formatTimestamp(date = new Date()) {
    const d = new Date(date);
    const datePart = this.formatDate(d);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${datePart}${hh}${mm}${ss}`;
  }

  /**
   * Escapes a CSV column value with quotes if it contains commas, quotes, or newlines.
   * @param {string|number} value
   * @returns {string}
   */
  escapeCsv(value) {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  }

  /**
   * Asserts that a fixed-width record is exactly expectedLength characters (bytes).
   * @param {string} record
   * @param {number} [expectedLength=200]
   * @param {string} [recordType='Record']
   * @returns {string}
   */
  assertRecordLength(record, expectedLength = 200, recordType = 'Record') {
    const byteLen = Buffer.byteLength(record, 'utf8');
    if (byteLen !== expectedLength) {
      throw new Error(
        `[${this.bankCode.toUpperCase()}] ${recordType} length violation: expected exactly ${expectedLength} bytes, got ${byteLen} (record: "${record.slice(0, 30)}...")`
      );
    }
    return record;
  }
}

module.exports = BaseBankBatchGenerator;
