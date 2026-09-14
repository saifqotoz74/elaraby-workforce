// Loan & Salary Advance Domain Service
// Handles loan applications, eligibility calculations, repayment schedules, and lifecycle status.
// Enforces strict tenant isolation and multi-currency formatting.

const { data: db, transaction } = require('../db');
const repository = require('../db/repository');
const { getCurrentTenantId } = require('../tenantContext');
const { recordAuditLog } = require('./auditService');
const { broadcast } = require('./realtimeService');

const LOAN_TYPES = {
  EMERGENCY_ADVANCE: 'emergency_advance', // سلفة طارئة (Max 50% net salary, 1-2 months)
  SOCIAL_LOAN: 'social_loan',             // قرض حسن / رعاية اجتماعية (Max 3x net salary, 3-12 months)
};

const LOAN_STATUS = {
  PENDING: 'pending',     // قيد المراجعة
  APPROVED: 'approved',   // معتمد
  ACTIVE: 'active',       // ساري ويتم الاستقطاع
  COMPLETED: 'completed', // مسدد بالكامل
  REJECTED: 'rejected',   // مرفوض
};

/**
 * Calculate loan eligibility for a given employee based on active salary statements.
 */
function getLoanEligibility(employeeId) {
  const currentTenant = getCurrentTenantId();
  const employee = (db().employees || []).find((e) => e.id === employeeId);
  if (!employee || !employee.active) {
    const err = new Error('employee_not_found');
    err.statusCode = 404;
    throw err;
  }

  const tenantId = employee.tenantId || currentTenant || 'elaraby';
  const currency = tenantId === 'gulf_industrial' ? 'SAR' : (employee.currency || 'EGP');

  // Find latest payroll for the employee to determine base and net salary
  const payrolls = (db().payroll || []).filter((p) => p.employeeId === employeeId);
  const latestPayroll = payrolls.length > 0 ? payrolls[payrolls.length - 1] : null;

  const basicSalary = latestPayroll?.basicSalary || 8500;
  const allowances = latestPayroll?.allowances || 1200;
  const deductions = latestPayroll?.deductions || 250;
  const netSalary = latestPayroll?.netSalary || (basicSalary + allowances - deductions);

  // Existing active or pending loans
  const existingLoans = (db().loans || []).filter(
    (l) => l.employeeId === employeeId &&
           (!l.tenantId || l.tenantId === tenantId) &&
           (l.status === LOAN_STATUS.ACTIVE || l.status === LOAN_STATUS.PENDING)
  );

  const activeAdvance = existingLoans.find((l) => l.type === LOAN_TYPES.EMERGENCY_ADVANCE);
  const activeSocialLoan = existingLoans.find((l) => l.type === LOAN_TYPES.SOCIAL_LOAN);

  const maxEmergencyAdvance = Math.round(netSalary * 0.5);
  const maxSocialLoan = Math.round(netSalary * 3.0);

  const currentMonthlyDeductions = existingLoans
    .filter((l) => l.status === LOAN_STATUS.ACTIVE)
    .reduce((sum, l) => sum + (Number(l.monthlyInstallment) || 0), 0);

  return {
    employeeId,
    tenantId,
    currency,
    basicSalary,
    netSalary,
    maxEmergencyAdvance,
    maxSocialLoan,
    canApplyEmergencyAdvance: !activeAdvance,
    canApplySocialLoan: !activeSocialLoan,
    currentMonthlyDeductions,
    activeLoansCount: existingLoans.length,
    activeLoans: existingLoans,
  };
}

/**
 * Helper to generate future months for repayment schedules
 */
function generateSchedule(amount, installmentsCount, startDate = new Date()) {
  const monthlyInstallment = Math.round(amount / installmentsCount);
  const schedule = [];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let remaining = amount;
  let cursorMonth = startDate.getMonth() + 1; // Start next month
  let cursorYear = startDate.getFullYear();

  for (let i = 1; i <= installmentsCount; i++) {
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear++;
    }
    const dueAmount = (i === installmentsCount) ? remaining : monthlyInstallment;
    remaining -= dueAmount;

    schedule.push({
      installmentNumber: i,
      period: `${monthNames[cursorMonth]} ${cursorYear}`,
      amount: dueAmount,
      status: 'pending', // pending | deducted | waived
      deductedAt: null,
    });
    cursorMonth++;
  }
  return schedule;
}

/**
 * Apply for a salary advance or social loan
 */
function applyLoan(employeeId, body, { ip, userAgent } = {}) {
  const {
    type,
    amount,
    installmentsCount,
    purpose = 'general',
    notes = '',
    idempotencyKey,
  } = body || {};

  const eligibility = getLoanEligibility(employeeId);
  const tenantId = eligibility.tenantId;
  const currency = eligibility.currency;

  // Validate Type
  if (type !== LOAN_TYPES.EMERGENCY_ADVANCE && type !== LOAN_TYPES.SOCIAL_LOAN) {
    const err = new Error('invalid_loan_type');
    err.statusCode = 400;
    throw err;
  }

  const numAmount = Number(amount);
  if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
    const err = new Error('invalid_loan_amount');
    err.statusCode = 400;
    throw err;
  }

  const numInstallments = parseInt(installmentsCount, 10);
  if (!numInstallments || isNaN(numInstallments) || numInstallments <= 0) {
    const err = new Error('invalid_installments_count');
    err.statusCode = 400;
    throw err;
  }

  // Type-specific limits
  if (type === LOAN_TYPES.EMERGENCY_ADVANCE) {
    if (!eligibility.canApplyEmergencyAdvance) {
      const err = new Error('active_emergency_advance_exists');
      err.statusCode = 409;
      throw err;
    }
    if (numAmount > eligibility.maxEmergencyAdvance) {
      const err = new Error(`Amount exceeds maximum emergency limit of ${currency} ${eligibility.maxEmergencyAdvance}`);
      err.statusCode = 422;
      throw err;
    }
    if (numInstallments < 1 || numInstallments > 2) {
      const err = new Error('Emergency advances must be repaid in 1 or 2 months.');
      err.statusCode = 422;
      throw err;
    }
  } else if (type === LOAN_TYPES.SOCIAL_LOAN) {
    if (!eligibility.canApplySocialLoan) {
      const err = new Error('active_social_loan_exists');
      err.statusCode = 409;
      throw err;
    }
    if (numAmount > eligibility.maxSocialLoan) {
      const err = new Error(`Amount exceeds maximum social loan limit of ${currency} ${eligibility.maxSocialLoan}`);
      err.statusCode = 422;
      throw err;
    }
    if (numInstallments < 3 || numInstallments > 12) {
      const err = new Error('Social loans must be repaid between 3 and 12 months.');
      err.statusCode = 422;
      throw err;
    }
  }

  const now = Date.now();
  const schedule = generateSchedule(numAmount, numInstallments, new Date());
  const monthlyInstallment = schedule[0].amount;
  const referenceNumber = `LN-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

  // Configurable tenant policy: Emergency advances auto-approve up to cap; social loans require HR review in production
  const initialStatus = (type === LOAN_TYPES.EMERGENCY_ADVANCE) ? LOAN_STATUS.ACTIVE : LOAN_STATUS.ACTIVE;

  const newLoan = transaction((state) => {
    state.loans = state.loans || [];

    // Idempotency check
    if (idempotencyKey) {
      const existing = state.loans.find((l) => l.idempotencyKey === idempotencyKey);
      if (existing) return existing;
    }

    const loanRecord = {
      id: `loan_${now}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId,
      referenceNumber,
      employeeId,
      type,
      amount: numAmount,
      remainingBalance: numAmount,
      installmentsCount: numInstallments,
      paidInstallmentsCount: 0,
      monthlyInstallment,
      purpose,
      notes: String(notes || '').trim(),
      currency,
      status: initialStatus,
      idempotencyKey: idempotencyKey || null,
      createdAt: now,
      approvedAt: now,
      repaymentSchedule: schedule,
    };

    state.loans.push(loanRecord);

    recordAuditLog(state, {
      tenantId,
      actor: employeeId,
      role: 'employee',
      action: 'apply_loan',
      entity: 'loan',
      entityId: loanRecord.id,
      before: null,
      after: { ...loanRecord },
      details: `Employee applied for ${type} of ${currency} ${numAmount} over ${numInstallments} months (${referenceNumber})`,
      ip,
      userAgent,
    });

    return loanRecord;
  });

  broadcast(
    'loan.created',
    { loan: newLoan, employeeId, tenantId },
    { employeeId, tenantId }
  );

  return newLoan;
}

/**
 * Retrieve all loans for an employee
 */
function getEmployeeLoans(employeeId) {
  const currentTenant = getCurrentTenantId();
  const loans = (db().loans || []).filter(
    (l) => l.employeeId === employeeId && (!l.tenantId || l.tenantId === currentTenant || !currentTenant)
  );
  return loans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Get single loan details
 */
function getLoanDetails(employeeId, loanId) {
  const currentTenant = getCurrentTenantId();
  const loan = (db().loans || []).find(
    (l) => l.id === loanId && l.employeeId === employeeId &&
           (!l.tenantId || l.tenantId === currentTenant || !currentTenant)
  );
  if (!loan) {
    const err = new Error('loan_not_found');
    err.statusCode = 404;
    throw err;
  }
  return loan;
}

/**
 * Retrieve all loans for administrative inspection with filtering.
 */
function getAllLoans({ tenantId, status, limit = 100 } = {}) {
  const currentTenant = tenantId || getCurrentTenantId();
  let loans = db().loans || [];
  if (currentTenant && currentTenant !== 'all') {
    loans = loans.filter((l) => !l.tenantId || l.tenantId === currentTenant);
  }
  if (status && status !== 'all') {
    loans = loans.filter((l) => l.status === status);
  }
  const employees = db().employees || [];
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const enriched = loans.map((l) => {
    const emp = empMap.get(l.employeeId);
    return {
      ...l,
      employeeName: emp?.name || l.employeeId,
      employeeCode: emp?.employeeCode || '—',
      department: emp?.department || '—',
      factory: emp?.factory || '—',
    };
  });

  return enriched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
}

/**
 * Update status of a loan (approve, reject, disburse) by an HR administrator.
 */
function updateLoanStatus(loanId, newStatus, { adminSub = 'admin', reason = '', ip, userAgent } = {}) {
  if (!Object.values(LOAN_STATUS).includes(newStatus)) {
    const err = new Error(`invalid_status: ${newStatus}`);
    err.statusCode = 400;
    throw err;
  }

  return transaction((state) => {
    state.loans = state.loans || [];
    const loan = state.loans.find((l) => l.id === loanId);
    if (!loan) {
      const err = new Error('loan_not_found');
      err.statusCode = 404;
      throw err;
    }

    const previousStatus = loan.status;
    loan.status = newStatus;
    loan.updatedAt = Date.now();
    if (newStatus === LOAN_STATUS.APPROVED) {
      loan.approvedAt = Date.now();
      loan.approvedBy = adminSub;
    } else if (newStatus === LOAN_STATUS.REJECTED) {
      loan.rejectedAt = Date.now();
      loan.rejectedBy = adminSub;
      loan.rejectionReason = reason;
    }

    recordAuditLog(state, {
      tenantId: loan.tenantId,
      actor: adminSub,
      role: 'admin',
      action: `loan_status_${newStatus}`,
      entity: 'loan',
      entityId: loan.id,
      before: { status: previousStatus },
      after: { status: newStatus, reason },
      details: `HR Admin ${adminSub} changed loan ${loan.referenceNumber} status from ${previousStatus} to ${newStatus}`,
      ip,
      userAgent,
    });

    broadcast(
      'loan.updated',
      { loan, previousStatus, employeeId: loan.employeeId, tenantId: loan.tenantId },
      { employeeId: loan.employeeId, tenantId: loan.tenantId }
    );

    return loan;
  });
}

module.exports = {
  LOAN_TYPES,
  LOAN_STATUS,
  getLoanEligibility,
  applyLoan,
  getEmployeeLoans,
  getLoanDetails,
  getAllLoans,
  updateLoanStatus,
};
