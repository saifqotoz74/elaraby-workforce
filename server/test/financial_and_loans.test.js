const assert = require('assert');
const { data: db } = require('../src/db');
const { seed } = require('../src/seed');
const payrollService = require('../src/services/payrollService');
const loanService = require('../src/services/loanService');

db().loans = (db().loans || []).filter((l) => l.employeeId !== 'emp_2');
seed(db());

console.log('=============================================================');
console.log('--- FINANCIAL SUITE & LOAN ADVANCE TEST SUITE ---');
console.log('=============================================================\n');

// 1. Historical Payroll Test
console.log('--- 1. Historical Payroll & Itemized Statements ---');
const mayPayroll = payrollService.getPayroll(null, 'emp_1', { period: 'May 2026' });
assert.ok(mayPayroll, 'May 2026 statement should exist for emp_1');
assert.strictEqual(mayPayroll.period, 'May 2026');
assert.strictEqual(mayPayroll.basicSalary, 8500);
assert.strictEqual(mayPayroll.overtimeAmount, 450);

const latestPayroll = payrollService.getPayroll(null, 'emp_1');
assert.ok(latestPayroll, 'Latest statement should exist for emp_1');
assert.strictEqual(latestPayroll.period, 'August 2026');
assert.strictEqual(latestPayroll.netSalary, 9260);

const history = payrollService.getPayrollHistory(null, 'emp_1');
assert.ok(Array.isArray(history), 'History should be an array');
assert.ok(history.length >= 4, 'emp_1 should have at least 4 historical payroll periods');
console.log(`✔ Historical payroll retrieved successfully (${history.length} periods for emp_1).`);

// 2. Loan Eligibility Test
console.log('\n--- 2. Loan Eligibility Calculation ---');
const eligibility = loanService.getLoanEligibility('emp_1');
assert.strictEqual(eligibility.employeeId, 'emp_1');
assert.ok(eligibility.netSalary > 0, 'Net salary must be greater than 0');
assert.strictEqual(eligibility.maxEmergencyAdvance, Math.round(eligibility.netSalary * 0.5));
assert.strictEqual(eligibility.maxSocialLoan, Math.round(eligibility.netSalary * 3.0));
console.log(`✔ Loan eligibility calculated correctly: Max Advance: ${eligibility.maxEmergencyAdvance} EGP, Max Social Loan: ${eligibility.maxSocialLoan} EGP.`);

// 3. Loan Application Rules
console.log('\n--- 3. Loan Application Business Rules & Validation ---');

// Applying for Social Loan for emp_2
const emp2Eligibility = loanService.getLoanEligibility('emp_2');
assert.ok(emp2Eligibility.canApplySocialLoan, 'emp_2 should be eligible for social loan');

const appliedLoan = loanService.applyLoan('emp_2', {
  type: loanService.LOAN_TYPES.SOCIAL_LOAN,
  amount: 15000,
  installmentsCount: 6,
  purpose: 'marriage',
  notes: 'مساعدة زواج',
});

assert.ok(appliedLoan, 'Social loan should be created');
assert.ok(appliedLoan.referenceNumber.startsWith('LN-'), 'Reference number should follow format LN-YYYY-XXXX');
assert.strictEqual(appliedLoan.amount, 15000);
assert.strictEqual(appliedLoan.installmentsCount, 6);
assert.strictEqual(appliedLoan.monthlyInstallment, 2500);
assert.strictEqual(appliedLoan.repaymentSchedule.length, 6);
assert.strictEqual(appliedLoan.status, 'active');
console.log(`✔ Social loan applied successfully: ${appliedLoan.referenceNumber} (${appliedLoan.amount} EGP over ${appliedLoan.installmentsCount} months).`);

// Verify limit enforcement: applying exceeding amount should throw 422
assert.throws(() => {
  loanService.applyLoan('emp_2', {
    type: loanService.LOAN_TYPES.EMERGENCY_ADVANCE,
    amount: 50000, // Exceeds limit
    installmentsCount: 2,
  });
}, /exceeds maximum emergency limit/i, 'Should reject amount exceeding max emergency advance');
console.log('✔ Exceeding emergency loan limit strictly rejected with 422 error.');

// Verify installment count rules: emergency advance must be 1 or 2 months
assert.throws(() => {
  loanService.applyLoan('emp_2', {
    type: loanService.LOAN_TYPES.EMERGENCY_ADVANCE,
    amount: 1000,
    installmentsCount: 5, // Invalid for emergency advance
  });
}, /repaid in 1 or 2 months/i, 'Should reject invalid installment count for emergency advance');
console.log('✔ Invalid installment count for emergency advance strictly rejected.');

console.log('\n=============================================================');
console.log('ALL FINANCIAL SUITE & LOAN ADVANCE TESTS PASSED (0 FAILURES)');
console.log('=============================================================\n');
