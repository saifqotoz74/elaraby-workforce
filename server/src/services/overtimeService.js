const dbModule = require('../db');
const repository = require('../db/repository');
const holidays = require('../utils/holidays');
const realtimeService = require('./realtimeService');
const { getCurrentTenantId } = require('../tenantContext');

function db() {
  return dbModule.data();
}

function save() {
  dbModule.save();
}

// Standard base hourly rate approximation if not set on employee (Monthly / 240 hrs)
const DEFAULT_HOURLY_RATE = 40; // 40 EGP/hr

/**
 * Resolves Overtime Rate Tier (Egyptian Labor Law & GCC standards)
 */
function getOvertimeRateTier(dateStr, timePeriod = 'day') {
  const isWk = holidays.isWeekend(dateStr);
  const holidayName = holidays.getHolidayName(dateStr);

  if (isWk || holidayName) {
    return {
      tier: 'holiday_rest',
      multiplier: 2.0,
      nameEn: holidayName ? `Official Holiday (${holidayName}) - 200%` : 'Rest Day - 200%',
      nameAr: holidayName ? `عطلة رسمية (${holidayName}) - 200%` : 'عطلة أسبوعية - 200%',
    };
  }

  if (timePeriod === 'night') {
    return {
      tier: 'night',
      multiplier: 1.7,
      nameEn: 'Nighttime Overtime (170%)',
      nameAr: 'عمل إضافي ليلي (170%)',
    };
  }

  return {
    tier: 'day',
    multiplier: 1.35,
    nameEn: 'Daytime Overtime (135%)',
    nameAr: 'عمل إضافي نهاري (135%)',
  };
}

/**
 * Calculates overtime pay for given hours, date, and time period
 */
function calculateOvertimePay({ hours, date, timePeriod = 'day', hourlyRate = DEFAULT_HOURLY_RATE, currency = 'EGP' }) {
  const numHours = parseFloat(hours) || 0;
  const tier = getOvertimeRateTier(date, timePeriod);
  const effectiveRate = hourlyRate * tier.multiplier;
  const totalAmount = Math.round(numHours * effectiveRate * 100) / 100;

  return {
    hours: numHours,
    baseHourlyRate: hourlyRate,
    multiplier: tier.multiplier,
    tierId: tier.tier,
    tierNameEn: tier.nameEn,
    tierNameAr: tier.nameAr,
    effectiveRate,
    totalAmount,
    currency,
  };
}

/**
 * Creates an overtime hours claim or planned overtime request with tenant scoping
 */
function createOvertimeClaim(employeeId, { date, hours, timePeriod = 'day', reason, productionLine, isPlanned = false }) {
  const currentTenant = getCurrentTenantId();
  const me = (db().employees || []).find((e) => e.id === employeeId);
  if (!me) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }

  const tenantId = me.tenantId || currentTenant || 'elaraby';
  const currency = tenantId === 'gulf_industrial' ? 'SAR' : (me.currency || 'EGP');

  const numHours = parseFloat(hours);
  if (!numHours || numHours <= 0 || numHours > 8) {
    const err = new Error('Overtime hours must be between 0.5 and 8 hours');
    err.statusCode = 422;
    throw err;
  }

  const calculation = calculateOvertimePay({
    hours: numHours,
    date,
    timePeriod,
    hourlyRate: me.hourlyRate || DEFAULT_HOURLY_RATE,
    currency,
  });

  db().overtimeClaims = db().overtimeClaims || [];
  const claimId = `OT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const claimRecord = {
    id: claimId,
    tenantId,
    employeeId,
    employeeName: me.name,
    employeeCode: me.employeeCode,
    factory: me.factory,
    department: me.department,
    productionLine: productionLine || me.department || 'Production Line A',
    date,
    hours: numHours,
    timePeriod,
    currency,
    isPlanned: Boolean(isPlanned),
    reason: reason || 'Production quota completion',
    calculation,
    status: 'pending_supervisor',
    supervisor: me.supervisor || 'Line Supervisor',
    createdAt: Date.now(),
    decidedAt: null,
    reviewer: null,
    notes: null,
  };

  db().overtimeClaims.unshift(claimRecord);
  save();

  // Async repository sync for PostgreSQL persistence
  try {
    repository.createOvertimeRequest({
      id: claimId,
      tenantId,
      employeeId,
      shiftDate: date,
      hours: numHours,
      reason: claimRecord.reason,
      status: 'pending',
    }).catch((e) => console.warn('[overtime:repo_sync_error]', e.message));
  } catch (_) {}

  try {
    realtimeService.broadcast('overtime.claim.created', {
      tenantId,
      claimId,
      employeeName: me.name,
      hours: numHours,
      date,
      totalAmount: calculation.totalAmount,
      currency,
    }, { tenantId });
  } catch (_) {}

  return claimRecord;
}

/**
 * Line Supervisor approves or rejects overtime claim with tenant isolation
 */
function decideOvertime(claimId, decision, { reviewer, notes = '' } = {}) {
  const currentTenant = getCurrentTenantId();
  db().overtimeClaims = db().overtimeClaims || [];
  const claim = db().overtimeClaims.find((c) => c.id === claimId);

  if (!claim) {
    const err = new Error('Overtime claim not found');
    err.statusCode = 404;
    throw err;
  }

  // Tenant scope check
  if (currentTenant && claim.tenantId && claim.tenantId !== currentTenant) {
    const err = new Error('Cross-tenant overtime modification forbidden');
    err.statusCode = 403;
    throw err;
  }

  if (claim.status !== 'pending_supervisor' && claim.status !== 'pending') {
    const err = new Error(`Overtime claim is already decided: ${claim.status}`);
    err.statusCode = 400;
    throw err;
  }

  if (decision === 'approve' || decision === 'approved') {
    claim.status = 'approved';

    // Integrate into employee's payroll record
    try {
      const payrollList = db().payrolls || [];
      const currentPayroll = payrollList.find((p) => p.employeeId === claim.employeeId);
      if (currentPayroll) {
        currentPayroll.overtimeAmount = (currentPayroll.overtimeAmount || 0) + claim.calculation.totalAmount;
        currentPayroll.netSalary =
          (currentPayroll.basicSalary || 0) +
          (currentPayroll.allowances || 0) +
          currentPayroll.overtimeAmount -
          (currentPayroll.deductions || 0);
      }
    } catch (_) {}
  } else {
    claim.status = 'rejected';
    claim.rejectionReason = notes;
  }

  claim.decidedAt = Date.now();
  claim.reviewer = reviewer || 'Line Supervisor';
  claim.notes = notes;

  // Audit logging
  db().auditLogs = db().auditLogs || [];
  db().auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    tenantId: claim.tenantId || 'elaraby',
    action: 'OVERTIME_DECIDED',
    actor: reviewer || 'Supervisor',
    claimId: claim.id,
    decision: claim.status,
    timestamp: Date.now(),
  });

  save();

  try {
    realtimeService.broadcast('overtime.claim.decided', {
      tenantId: claim.tenantId,
      claimId: claim.id,
      status: claim.status,
      employeeId: claim.employeeId,
      hours: claim.hours,
      totalAmount: claim.calculation.totalAmount,
    }, { tenantId: claim.tenantId });
  } catch (_) {}

  return claim;
}

/**
 * Returns overtime claims for an employee
 */
function getEmployeeOvertimeClaims(employeeId) {
  const currentTenant = getCurrentTenantId();
  const claims = db().overtimeClaims || [];
  return claims.filter((c) => c.employeeId === employeeId && (!c.tenantId || c.tenantId === currentTenant || !currentTenant));
}

module.exports = {
  getOvertimeRateTier,
  calculateOvertimePay,
  createOvertimeClaim,
  decideOvertime,
  getEmployeeOvertimeClaims,
};
