const TARDINESS_LADDER = {
  1: { type: 'warning', deductionFactor: 0 },
  2: { type: 'quarter_day', deductionFactor: 0.25 },
  3: { type: 'half_day', deductionFactor: 0.50 },
  4: { type: 'full_day', deductionFactor: 1.0 }
};

const ABSENCE_PENALTY_FACTOR = 2.0;
const PPE_VIOLATION_DEDUCTION_FACTOR = 0.5;
const PPE_VIOLATION_FIXED = 100;

function calculateProductionBonus(targetQty, actualQty, baseShiftRate) {
  if (actualQty >= targetQty * 1.20) return baseShiftRate * 0.20;
  if (actualQty >= targetQty * 1.00) return baseShiftRate * 0.10;
  return 0;
}

function calculateAttendanceBonus(tardinessCount, absenceCount) {
  if (tardinessCount === 0 && absenceCount === 0) return 500;
  return 0;
}

function calculateMonthlyAdjustments(tenantId, employeeId, { basicSalary, tardinessCount, unexcusedAbsenceDays, ppeViolationsCount, lineTargetAchieved }) {
  const dailyWage = basicSalary / 30;
  const deductions = [];
  const incentives = [];
  
  let totalDeductionsEgp = 0;
  let totalIncentivesEgp = 0;

  // Tardiness Deduction
  if (tardinessCount > 0) {
    const offenseLevel = Math.min(tardinessCount, 4);
    const rule = TARDINESS_LADDER[offenseLevel];
    const amount = rule.deductionFactor * dailyWage;
    if (amount > 0) {
      deductions.push({ reason: `Tardiness offense ${tardinessCount}`, amount, type: rule.type });
      totalDeductionsEgp += amount;
    } else {
      deductions.push({ reason: `Tardiness offense ${tardinessCount}`, amount: 0, type: rule.type });
    }
  }

  // Absence Deduction
  if (unexcusedAbsenceDays > 0) {
    const amount = unexcusedAbsenceDays * ABSENCE_PENALTY_FACTOR * dailyWage;
    deductions.push({ reason: 'Unexcused Absence', amount, type: 'absence_penalty' });
    totalDeductionsEgp += amount;
  }

  // PPE Violation Deduction
  if (ppeViolationsCount > 0) {
    const penaltyPerViolation = Math.max(PPE_VIOLATION_FIXED, PPE_VIOLATION_DEDUCTION_FACTOR * dailyWage);
    const amount = ppeViolationsCount * penaltyPerViolation;
    deductions.push({ reason: 'PPE Violation', amount, type: 'ppe_violation' });
    totalDeductionsEgp += amount;
  }

  // Productivity Bonus
  if (lineTargetAchieved) {
    const targetQty = lineTargetAchieved.targetQty || 100;
    const actualQty = lineTargetAchieved.actualQty || 0;
    const baseShiftRate = lineTargetAchieved.baseShiftRate || dailyWage;
    const bonus = calculateProductionBonus(targetQty, actualQty, baseShiftRate);
    if (bonus > 0) {
      incentives.push({ reason: 'Production Bonus', amount: bonus });
      totalIncentivesEgp += bonus;
    }
  }

  // Attendance Bonus
  const attendanceBonus = calculateAttendanceBonus(tardinessCount, unexcusedAbsenceDays);
  if (attendanceBonus > 0) {
    incentives.push({ reason: 'Perfect Attendance', amount: attendanceBonus });
    totalIncentivesEgp += attendanceBonus;
  }

  return {
    incentives,
    deductions,
    totalIncentivesEgp,
    totalDeductionsEgp,
    netAdjustmentEgp: totalIncentivesEgp - totalDeductionsEgp
  };
}

module.exports = {
  calculateProductionBonus,
  calculateAttendanceBonus,
  calculateMonthlyAdjustments
};
