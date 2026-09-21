'use strict';

// server/src/integrations/banking/BankingReconciliationEngine.js
// Central Bank of Egypt (CBE) & Commercial Banking Disbursement Reconciliation Engine
// Ingests bank feedback records, updates payroll state, categorizes outcomes, and creates audit logs.

const { transaction } = require('../../db');
const { recordAuditLog } = require('../../services/auditService');

/**
 * Utility: rounds a monetary value to 2 decimal places to prevent floating point inaccuracies.
 * @param {number|string} val
 * @returns {number}
 */
function round2(val) {
  const num = Number(val || 0);
  return Math.round(num * 100) / 100;
}

/**
 * Utility: normalizes status strings from various bank gateways.
 * @param {string} rawStatus
 * @returns {'PROCESSED'|'REJECTED'|'INVALID_ACCOUNT'|'UNKNOWN'}
 */
function normalizeStatus(rawStatus) {
  const s = String(rawStatus || '').trim().toUpperCase();
  if (['PROCESSED', 'SETTLED', 'PAID', 'SUCCESS', 'COMPLETED', 'OK'].includes(s)) {
    return 'PROCESSED';
  }
  if (['REJECTED', 'FAILED', 'DECLINED', 'INSUFFICIENT_FUNDS', 'REVERSED', 'CANCELLED'].includes(s)) {
    return 'REJECTED';
  }
  if (['INVALID_ACCOUNT', 'ACCOUNT_CLOSED', 'INVALID_IBAN', 'BENEFICIARY_MISMATCH', 'INVALID_ACCOUNT_NUMBER', 'ACCOUNT_NOT_FOUND'].includes(s)) {
    return 'INVALID_ACCOUNT';
  }
  return 'UNKNOWN';
}

/**
 * Resolves an employee record from a given employee identifier.
 * Searches id, employeeCode, and nationalId with case-insensitive matching.
 */
function resolveEmployee(employees, employeeCode, tenantId) {
  if (!employeeCode || !Array.isArray(employees)) return null;
  const cleanCode = String(employeeCode).trim().toLowerCase();

  return employees.find((emp) => {
    if (tenantId && emp.tenantId && emp.tenantId !== tenantId) return false;
    const matchId = emp.id && String(emp.id).trim().toLowerCase() === cleanCode;
    const matchCode = emp.employeeCode && String(emp.employeeCode).trim().toLowerCase() === cleanCode;
    const matchNat = emp.nationalId && String(emp.nationalId).trim() === cleanCode;
    return matchId || matchCode || matchNat;
  });
}

/**
 * Resolves the relevant payroll slip for an employee.
 * Matches period if supplied, or falls back to latest record.
 */
function resolvePayrollRecord(payrollRecords, employeeId, period) {
  if (!employeeId || !Array.isArray(payrollRecords)) return null;
  const empPayrolls = payrollRecords.filter((p) => p.employeeId === employeeId);
  if (empPayrolls.length === 0) return null;

  if (period) {
    const cleanPeriod = String(period).trim().toLowerCase();
    const periodMatch = empPayrolls.find((p) => {
      const pStr = String(p.period || '').trim().toLowerCase();
      const pEn = String(p.periodEn || '').trim().toLowerCase();
      const pAr = String(p.periodAr || '').trim().toLowerCase();
      return pStr === cleanPeriod || pEn === cleanPeriod || pAr === cleanPeriod;
    });
    if (periodMatch) return periodMatch;
  }

  // Prioritize pending/dispatched records first, then newest by updatedAt
  const pending = empPayrolls.find((p) => p.disbursementStatus !== 'matched' && p.disbursementStatus !== 'settled');
  if (pending) return pending;

  return empPayrolls.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}

class BankingReconciliationEngine {
  /**
   * Pure categorization function (no database mutations).
   * Useful for testing and preview diffing.
   */
  static categorize({ batchReference, bankCode, feedbackRecords = [], period, employees = [], payrollRecords = [], tenantId }) {
    const matched = [];
    const rejected = [];
    const invalidAccounts = [];
    const discrepancies = [];

    for (const record of feedbackRecords) {
      const empCode = record.employeeCode || record.employeeId || record.nationalId;
      const recAmount = round2(record.amount);
      const rawStatus = record.status || record.bankStatus;
      const normStatus = normalizeStatus(rawStatus);
      const bankRef = record.bankReference || record.transactionReference || null;
      const reasonCode = record.rejectionReason || record.bankReasonCode || null;

      // 1. Resolve employee
      const employee = resolveEmployee(employees, empCode, tenantId);
      if (!employee) {
        // Check if there is a payroll record referencing this employeeCode as employeeId directly
        const orphanPayroll = resolvePayrollRecord(payrollRecords, empCode, period);
        if (orphanPayroll) {
          // Payroll exists even if employee directory lacks full profile
          if (normStatus === 'REJECTED') {
            rejected.push({
              employeeCode: empCode,
              employeeId: empCode,
              payrollId: orphanPayroll.id || null,
              name: empCode,
              amount: recAmount,
              bankReference: bankRef,
              rejectionReason: reasonCode || 'Disbursement rejected by bank clearinghouse',
              record,
            });
            continue;
          }
          if (normStatus === 'INVALID_ACCOUNT') {
            invalidAccounts.push({
              employeeCode: empCode,
              employeeId: empCode,
              payrollId: orphanPayroll.id || null,
              name: empCode,
              accountNumber: record.accountNumber || null,
              bankReference: bankRef,
              rejectionReason: reasonCode || 'Invalid beneficiary bank account or IBAN',
              record,
            });
            continue;
          }
          if (normStatus === 'PROCESSED') {
            const expectedNet = round2(orphanPayroll.netSalary !== undefined ? orphanPayroll.netSalary : (orphanPayroll.baseSalary || 0));
            const delta = round2(Math.abs(recAmount - expectedNet));
            if (delta <= 0.01) {
              matched.push({
                employeeCode: empCode,
                employeeId: empCode,
                payrollId: orphanPayroll.id || null,
                name: empCode,
                netSalary: expectedNet,
                disbursedAmount: recAmount,
                bankReference: bankRef || batchReference,
                record,
              });
            } else {
              discrepancies.push({
                employeeCode: empCode,
                employeeId: empCode,
                payrollId: orphanPayroll.id || null,
                name: empCode,
                reason: 'AMOUNT_MISMATCH',
                message: `Amount mismatch: bank disbursed ${recAmount} EGP vs expected ${expectedNet} EGP (delta: ${round2(recAmount - expectedNet)})`,
                expectedAmount: expectedNet,
                receivedAmount: recAmount,
                delta: round2(recAmount - expectedNet),
                bankReference: bankRef,
                record,
              });
            }
            continue;
          }
        }

        discrepancies.push({
          employeeCode: empCode,
          reason: 'EMPLOYEE_NOT_FOUND',
          message: `Employee code "${empCode}" not found in workforce directory`,
          amount: recAmount,
          status: rawStatus,
          bankReference: bankRef,
        });
        continue;
      }

      // 2. Resolve payroll record
      const payroll = resolvePayrollRecord(payrollRecords, employee.id, period);
      if (!payroll) {
        discrepancies.push({
          employeeCode: empCode,
          employeeId: employee.id,
          name: employee.name,
          reason: 'PAYROLL_RECORD_NOT_FOUND',
          message: `No payroll statement found for employee "${employee.name}" (${employee.id})`,
          amount: recAmount,
          status: rawStatus,
          bankReference: bankRef,
        });
        continue;
      }

      // 3. Evaluate by status
      if (normStatus === 'REJECTED') {
        rejected.push({
          employeeCode: empCode,
          employeeId: employee.id,
          payrollId: payroll.id || null,
          name: employee.name,
          amount: recAmount,
          bankReference: bankRef,
          rejectionReason: reasonCode || 'Disbursement rejected by bank clearinghouse',
          record,
        });
        continue;
      }

      if (normStatus === 'INVALID_ACCOUNT') {
        invalidAccounts.push({
          employeeCode: empCode,
          employeeId: employee.id,
          payrollId: payroll.id || null,
          name: employee.name,
          accountNumber: record.accountNumber || employee.iban || null,
          bankReference: bankRef,
          rejectionReason: reasonCode || 'Invalid beneficiary bank account or IBAN',
          record,
        });
        continue;
      }

      if (normStatus === 'PROCESSED') {
        const expectedNet = round2(payroll.netSalary !== undefined ? payroll.netSalary : (payroll.baseSalary || 0));
        const delta = round2(Math.abs(recAmount - expectedNet));

        if (delta <= 0.01) {
          matched.push({
            employeeCode: empCode,
            employeeId: employee.id,
            payrollId: payroll.id || null,
            name: employee.name,
            netSalary: expectedNet,
            disbursedAmount: recAmount,
            bankReference: bankRef || batchReference,
            record,
          });
        } else {
          discrepancies.push({
            employeeCode: empCode,
            employeeId: employee.id,
            payrollId: payroll.id || null,
            name: employee.name,
            reason: 'AMOUNT_MISMATCH',
            message: `Amount mismatch: bank disbursed ${recAmount} EGP vs expected ${expectedNet} EGP (delta: ${round2(recAmount - expectedNet)})`,
            expectedAmount: expectedNet,
            receivedAmount: recAmount,
            delta: round2(recAmount - expectedNet),
            bankReference: bankRef,
            record,
          });
        }
        continue;
      }

      // Unrecognized status
      discrepancies.push({
        employeeCode: empCode,
        employeeId: employee.id,
        payrollId: payroll.id || null,
        name: employee.name,
        reason: 'INVALID_RETURN_STATUS',
        message: `Unrecognized bank return status "${rawStatus}"`,
        amount: recAmount,
        status: rawStatus,
        bankReference: bankRef,
      });
    }

    return {
      batchReference,
      bankCode,
      matched,
      rejected,
      invalidAccounts,
      discrepancies,
      counts: {
        matchedCount: matched.length,
        rejectedCount: rejected.length,
        invalidAccountCount: invalidAccounts.length,
        discrepancyCount: discrepancies.length,
      },
    };
  }

  /**
   * Executes full reconciliation within an atomic database transaction.
   * Mutates payroll and employee records, logs tamper-proof audit trail,
   * and returns compliant response envelope.
   */
  static reconcileDisbursementBatch({
    batchReference,
    batchId,
    bankCode,
    bank,
    feedbackRecords,
    returns,
    period,
    tenantId = 'elaraby',
    admin = null,
    ip = null,
    userAgent = null,
  }) {
    const rawBatch = batchReference || batchId;
    if (!rawBatch || typeof rawBatch !== 'string' || !rawBatch.trim()) {
      const err = new Error('batchReference is required and must be a non-empty string');
      err.statusCode = 400;
      err.code = 'missing_batch_reference';
      throw err;
    }

    const rawBank = bankCode || bank;
    if (!rawBank || typeof rawBank !== 'string' || !rawBank.trim()) {
      const err = new Error('bankCode is required (e.g. cib, nbe, qnb, misr, cbe_wps)');
      err.statusCode = 400;
      err.code = 'missing_bank_code';
      throw err;
    }

    const records = feedbackRecords !== undefined ? feedbackRecords : (returns !== undefined ? returns : []);
    if (!Array.isArray(records)) {
      const err = new Error('feedbackRecords must be an array');
      err.statusCode = 400;
      err.code = 'invalid_feedback_records';
      throw err;
    }

    const cleanBatch = rawBatch.trim();
    const cleanBank = rawBank.trim().toLowerCase();
    const nowIso = new Date().toISOString();

    // Execute state mutations inside database snapshot transaction
    return transaction((state) => {
      state.payroll = state.payroll || [];
      state.employees = state.employees || [];

      // Defensively deduplicate employees by ID to satisfy relational uniqueness constraints
      const seenEmpIds = new Set();
      state.employees = state.employees.filter((emp) => {
        if (!emp || !emp.id) return false;
        if (seenEmpIds.has(emp.id)) return false;
        seenEmpIds.add(emp.id);
        return true;
      });

      // Run categorization against current database state
      const result = BankingReconciliationEngine.categorize({
        batchReference: cleanBatch,
        bankCode: cleanBank,
        feedbackRecords: records,
        period,
        employees: state.employees,
        payrollRecords: state.payroll,
        tenantId,
      });

      // 1. Apply Matched updates
      for (const item of result.matched) {
        const pRecord = state.payroll.find((p) =>
          (item.payrollId ? p.id === item.payrollId : p.employeeId === item.employeeId)
        );
        if (pRecord) {
          pRecord.disbursementStatus = 'matched';
          pRecord.bankReference = item.bankReference;
          pRecord.processedAt = nowIso;
          pRecord.rejectionReason = null;
          pRecord.discrepancyReason = null;
          pRecord.updatedAt = Date.now();
        }
      }

      // 2. Apply Rejected updates
      for (const item of result.rejected) {
        const pRecord = state.payroll.find((p) =>
          (item.payrollId ? p.id === item.payrollId : p.employeeId === item.employeeId)
        );
        if (pRecord) {
          pRecord.disbursementStatus = 'rejected';
          pRecord.bankReference = item.bankReference || cleanBatch;
          pRecord.processedAt = nowIso;
          pRecord.rejectionReason = item.rejectionReason;
          pRecord.discrepancyReason = null;
          pRecord.updatedAt = Date.now();
        }
      }

      // 3. Apply Invalid Account updates
      for (const item of result.invalidAccounts) {
        const pRecord = state.payroll.find((p) =>
          (item.payrollId ? p.id === item.payrollId : p.employeeId === item.employeeId)
        );
        if (pRecord) {
          pRecord.disbursementStatus = 'invalid_account';
          pRecord.bankReference = item.bankReference || cleanBatch;
          pRecord.processedAt = nowIso;
          pRecord.rejectionReason = item.rejectionReason;
          pRecord.discrepancyReason = null;
          pRecord.updatedAt = Date.now();
        }
        // Flag employee profile if found
        const emp = state.employees.find((e) => e.id === item.employeeId);
        if (emp) {
          emp.bankingError = item.rejectionReason;
          emp.updatedAt = nowIso;
        }
      }

      // 4. Apply Discrepancy updates
      for (const item of result.discrepancies) {
        if (item.employeeId || item.payrollId) {
          const pRecord = state.payroll.find((p) =>
            (item.payrollId ? p.id === item.payrollId : p.employeeId === item.employeeId)
          );
          if (pRecord) {
            pRecord.disbursementStatus = 'discrepancy';
            pRecord.bankReference = item.bankReference || cleanBatch;
            pRecord.processedAt = nowIso;
            pRecord.discrepancyReason = item.message;
            pRecord.discrepancyDetails = {
              reason: item.reason,
              expectedAmount: item.expectedAmount,
              receivedAmount: item.receivedAmount,
              delta: item.delta,
            };
            pRecord.updatedAt = Date.now();
          }
        }
      }

      // 5. Create immutable audit log entry
      const auditEntry = recordAuditLog(state, {
        actor: admin?.sub || admin?.username || 'admin',
        role: admin?.role || 'superadmin',
        action: 'BANKING_DISBURSEMENT_RECONCILIATION',
        entity: 'payroll',
        entityId: cleanBatch,
        before: {
          batchReference: cleanBatch,
          bankCode: cleanBank,
          recordsSubmitted: records.length,
        },
        after: {
          batchReference: cleanBatch,
          bankCode: cleanBank,
          totalProcessed: records.length,
          matchedCount: result.counts.matchedCount,
          rejectedCount: result.counts.rejectedCount,
          invalidAccountCount: result.counts.invalidAccountCount,
          discrepancyCount: result.counts.discrepancyCount,
        },
        details: `Banking reconciliation completed for batch "${cleanBatch}" (${cleanBank.toUpperCase()}): ${result.counts.matchedCount} matched, ${result.counts.rejectedCount} rejected, ${result.counts.invalidAccountCount} invalid accounts, ${result.counts.discrepancyCount} discrepancies.`,
        ip,
        userAgent,
        tenantId,
      });

      // 6. Proactive manager alert if rejections or invalid accounts occurred
      if (result.counts.rejectedCount > 0 || result.counts.invalidAccountCount > 0) {
        try {
          const alertService = require('../../services/alertService');
          if (alertService && alertService.createAlert) {
            alertService.createAlert({
              tenantId,
              type: alertService.ALERT_TYPES?.SYSTEM || 'system',
              title: `Banking Disbursement Alert: ${cleanBatch}`,
              message: `Disbursement batch ${cleanBatch} (${cleanBank.toUpperCase()}) flagged ${result.counts.rejectedCount} rejections and ${result.counts.invalidAccountCount} invalid accounts.`,
              severity: result.counts.rejectedCount > 5 ? 'critical' : 'warning',
              entityType: 'payroll',
              entityId: cleanBatch,
              metadata: {
                batchReference: cleanBatch,
                bankCode: cleanBank,
                rejectedCount: result.counts.rejectedCount,
                invalidAccountCount: result.counts.invalidAccountCount,
              },
            });
          }
        } catch (_) {
          // Non-fatal
        }
      }

      return {
        success: true,
        ok: true,
        batchReference: cleanBatch,
        bankCode: cleanBank,
        totalProcessed: records.length,
        matchedCount: result.counts.matchedCount,
        rejectedCount: result.counts.rejectedCount,
        invalidAccountCount: result.counts.invalidAccountCount,
        discrepancyCount: result.counts.discrepancyCount,
        auditLogId: auditEntry ? auditEntry.id : `audit_${Date.now()}`,
        summary: {
          matched: result.matched,
          rejected: result.rejected,
          invalidAccounts: result.invalidAccounts,
          discrepancies: result.discrepancies,
        },
        reconciledAt: nowIso,
      };
    });
  }
}

module.exports = BankingReconciliationEngine;
