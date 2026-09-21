const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateMonthlyAdjustments } = require('../src/services/incentivesDeductionsService');

test('Test 1: 1st tardiness issues written warning with 0 deduction', () => {
  const result = calculateMonthlyAdjustments(1, 1, { basicSalary: 3000, tardinessCount: 1, unexcusedAbsenceDays: 0, ppeViolationsCount: 0 });
  assert.equal(result.deductions[0].type, 'warning');
  assert.equal(result.deductions[0].amount, 0);
  assert.equal(result.totalDeductionsEgp, 0);
});

test('Test 2: 2nd tardiness deducts 25% of daily wage', () => {
  const result = calculateMonthlyAdjustments(1, 1, { basicSalary: 3000, tardinessCount: 2, unexcusedAbsenceDays: 0, ppeViolationsCount: 0 });
  // daily wage = 100, 25% = 25
  assert.equal(result.deductions[0].type, 'quarter_day');
  assert.equal(result.deductions[0].amount, 25);
  assert.equal(result.totalDeductionsEgp, 25);
});

test('Test 3: 4th tardiness deducts 100% of daily wage', () => {
  const result = calculateMonthlyAdjustments(1, 1, { basicSalary: 3000, tardinessCount: 4, unexcusedAbsenceDays: 0, ppeViolationsCount: 0 });
  // daily wage = 100
  assert.equal(result.deductions[0].type, 'full_day');
  assert.equal(result.deductions[0].amount, 100);
});

test('Test 4: Unexcused absence deducts wage + rest day penalty', () => {
  const result = calculateMonthlyAdjustments(1, 1, { basicSalary: 3000, tardinessCount: 0, unexcusedAbsenceDays: 1, ppeViolationsCount: 0 });
  // daily wage = 100, 2.0 * 100 = 200
  assert.equal(result.deductions[0].type, 'absence_penalty');
  assert.equal(result.deductions[0].amount, 200);
});

test('Test 5: Overachieving line target yields 20% productivity incentive', () => {
  const result = calculateMonthlyAdjustments(1, 1, { 
    basicSalary: 3000, tardinessCount: 1, unexcusedAbsenceDays: 0, ppeViolationsCount: 0, 
    lineTargetAchieved: { targetQty: 100, actualQty: 125, baseShiftRate: 100 }
  });
  assert.equal(result.incentives[0].amount, 20); // 20% of 100
});

test('Test 6: Zero tardiness and zero absence yields 500 EGP attendance bonus', () => {
  const result = calculateMonthlyAdjustments(1, 1, { basicSalary: 3000, tardinessCount: 0, unexcusedAbsenceDays: 0, ppeViolationsCount: 0 });
  assert.equal(result.incentives[0].amount, 500);
  assert.equal(result.incentives[0].reason, 'Perfect Attendance');
});

test('Test 7: Net adjustment calculation reconciles bonuses minus deductions', () => {
  const result = calculateMonthlyAdjustments(1, 1, { 
    basicSalary: 3000, tardinessCount: 2, unexcusedAbsenceDays: 0, ppeViolationsCount: 0,
    lineTargetAchieved: { targetQty: 100, actualQty: 125, baseShiftRate: 100 }
  });
  assert.equal(result.totalDeductionsEgp, 25);
  assert.equal(result.totalIncentivesEgp, 20);
  assert.equal(result.netAdjustmentEgp, -5);
});
