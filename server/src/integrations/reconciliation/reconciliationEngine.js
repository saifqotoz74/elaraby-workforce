// Enterprise External System Reconciliation Engine
// Audits and compares internal workforce records against external authoritative ERP/Biometric sources.

function cleanString(val) {
  return String(val || '').trim();
}

function parseTimeToMinutes(timeInput) {
  if (!timeInput) return null;
  const str = String(timeInput).trim();

  // Handle ISO 8601 string (e.g. 2026-09-19T08:00:00.000Z)
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
  }

  // Handle SAP PT format (e.g. PT08H30M00S)
  const ptMatch = str.match(/PT(\d{1,2})H(?:(\d{1,2})M)?/i);
  if (ptMatch) {
    const h = parseInt(ptMatch[1], 10);
    const m = ptMatch[2] ? parseInt(ptMatch[2], 10) : 0;
    return h * 60 + m;
  }

  // Handle standard HH:MM[:SS] with optional AM/PM
  const match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[4]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  return null;
}

function cleanPeriod(period) {
  return String(period || '')
    .toLowerCase()
    .replace(/\s*monthly$/i, '')
    .trim();
}

/**
 * Reconciles employee master data between external ERP and internal Workforce OS.
 */
function reconcileEmployees(externalRecords = [], internalEmployees = []) {
  const internalByNationalId = new Map();
  const internalById = new Map();

  for (const emp of internalEmployees) {
    if (emp.nationalId) internalByNationalId.set(String(emp.nationalId).trim(), emp);
    if (emp.id) internalById.set(emp.id, emp);
  }

  const externalByNatId = new Map();
  const missingInInternal = [];
  const discrepancies = [];

  for (const ext of externalRecords) {
    const cleanNat = String(ext.nationalId || '').trim();
    if (cleanNat) externalByNatId.set(cleanNat, ext);

    const match = internalByNationalId.get(cleanNat);
    if (!match) {
      missingInInternal.push({
        externalId: ext.externalId,
        nationalId: ext.nationalId,
        name: ext.name,
        department: ext.department,
        factory: ext.factory,
      });
    } else {
      // Check for discrepancies
      const diffs = [];
      if (typeof ext.vacationBalance === 'number' && match.vacationBalance !== ext.vacationBalance) {
        diffs.push({
          field: 'vacationBalance',
          internal: match.vacationBalance,
          external: ext.vacationBalance,
        });
      }
      if (ext.department && match.department !== ext.department) {
        diffs.push({
          field: 'department',
          internal: match.department,
          external: ext.department,
        });
      }
      if (diffs.length > 0) {
        discrepancies.push({
          employeeId: match.id,
          nationalId: cleanNat,
          name: match.name,
          diffs,
        });
      }
    }
  }

  const missingInExternal = [];
  for (const [natId, emp] of internalByNationalId.entries()) {
    if (emp.active && !externalByNatId.has(natId)) {
      missingInExternal.push({
        id: emp.id,
        nationalId: natId,
        name: emp.name,
        factory: emp.factory,
      });
    }
  }

  const isSynchronized = missingInInternal.length === 0 && discrepancies.length === 0;

  return {
    isSynchronized,
    totalExternal: externalRecords.length,
    totalInternal: internalEmployees.length,
    missingInInternalCount: missingInInternal.length,
    missingInInternal,
    missingInExternalCount: missingInExternal.length,
    missingInExternal,
    discrepanciesCount: discrepancies.length,
    discrepancies,
    reconciledAt: new Date().toISOString(),
  };
}

/**
 * Reconciles external ERP payroll records against internal Workforce OS payroll slips.
 * Compares: basicSalary, allowances, deductions, netSalary.
 * Detects discrepancies, calculates diff amounts, and logs mismatch reasons.
 */
function reconcilePayroll(externalPayroll = [], internalPayroll = []) {
  const extList = Array.isArray(externalPayroll) ? externalPayroll : [];
  const intList = Array.isArray(internalPayroll) ? internalPayroll : [];

  // Index internal payroll by employeeId and optional period
  const intByEmpAndPeriod = new Map();
  const intByEmp = new Map();

  for (const item of intList) {
    const empId = cleanString(item.employeeId || item.id);
    const period = cleanPeriod(item.period || item.periodName);
    if (empId) {
      if (period) {
        intByEmpAndPeriod.set(`${empId}:::${period}`, item);
      }
      if (!intByEmp.has(empId)) {
        intByEmp.set(empId, item);
      }
    }
  }

  const matchedExternalKeys = new Set();
  const missingInInternal = [];
  const discrepancies = [];
  let matchedCount = 0;

  for (const ext of extList) {
    const empId = cleanString(ext.employeeId || ext.externalId || ext.personNumber || ext.userId);
    const period = cleanPeriod(ext.period || ext.periodName || ext.PeriodName);
    const key = period ? `${empId}:::${period}` : empId;

    let match = period ? intByEmpAndPeriod.get(`${empId}:::${period}`) : null;
    if (!match) {
      match = intByEmp.get(empId);
    }

    if (!match) {
      missingInInternal.push({
        employeeId: empId,
        externalId: ext.externalId || ext.PersonNumber || null,
        period: ext.period || ext.PeriodName || null,
        basicSalary: Number(ext.basicSalary || ext.BasicSalary || ext.baseSalary || 0),
        netSalary: Number(ext.netSalary || ext.NetSalary || 0),
      });
      continue;
    }

    matchedExternalKeys.add(match);

    // Extract amounts with fallback to zero
    const extBasic = Number(ext.basicSalary !== undefined ? ext.basicSalary : (ext.BasicSalary !== undefined ? ext.BasicSalary : (ext.baseSalary || 0)));
    const intBasic = Number(match.basicSalary !== undefined ? match.basicSalary : (match.baseSalary || 0));

    const extAllow = Number(ext.allowances !== undefined ? ext.allowances : (ext.Allowances || 0));
    const intAllow = Number(match.allowances !== undefined ? match.allowances : 0);

    const extDeduct = Number(ext.deductions !== undefined ? ext.deductions : (ext.Deductions || 0));
    const intDeduct = Number(match.deductions !== undefined ? match.deductions : 0);

    const extNet = Number(ext.netSalary !== undefined ? ext.netSalary : (ext.NetSalary !== undefined ? ext.NetSalary : (extBasic + extAllow - extDeduct)));
    const intNet = Number(match.netSalary !== undefined ? match.netSalary : (intBasic + intAllow - intDeduct));

    const diffs = [];

    // Basic Salary check
    const basicDiff = Math.round((extBasic - intBasic) * 100) / 100;
    if (Math.abs(basicDiff) > 0.01) {
      diffs.push({
        field: 'basicSalary',
        internal: intBasic,
        external: extBasic,
        internalValue: intBasic,
        externalValue: extBasic,
        diff: basicDiff,
        reason: 'BASIC_SALARY_MISMATCH',
      });
    }

    // Allowances check
    const allowDiff = Math.round((extAllow - intAllow) * 100) / 100;
    if (Math.abs(allowDiff) > 0.01) {
      diffs.push({
        field: 'allowances',
        internal: intAllow,
        external: extAllow,
        internalValue: intAllow,
        externalValue: extAllow,
        diff: allowDiff,
        reason: 'ALLOWANCES_DISCREPANCY',
      });
    }

    // Deductions check
    const deductDiff = Math.round((extDeduct - intDeduct) * 100) / 100;
    if (Math.abs(deductDiff) > 0.01) {
      diffs.push({
        field: 'deductions',
        internal: intDeduct,
        external: extDeduct,
        internalValue: intDeduct,
        externalValue: extDeduct,
        diff: deductDiff,
        reason: 'DEDUCTIONS_DISCREPANCY',
      });
    }

    // Net Salary check
    const netDiff = Math.round((extNet - intNet) * 100) / 100;
    if (Math.abs(netDiff) > 0.01) {
      diffs.push({
        field: 'netSalary',
        internal: intNet,
        external: extNet,
        internalValue: intNet,
        externalValue: extNet,
        diff: netDiff,
        reason: 'NET_SALARY_MISMATCH',
      });
    }

    if (diffs.length > 0) {
      for (const d of diffs) {
        discrepancies.push({
          employeeId: empId,
          period: ext.period || ext.PeriodName || match.period || 'Current',
          field: d.field,
          internalValue: d.internalValue,
          externalValue: d.externalValue,
          diff: d.diff,
          reason: d.reason,
          diffs,
        });
      }
    } else {
      matchedCount++;
    }
  }

  const missingInExternal = [];
  for (const item of intList) {
    if (!matchedExternalKeys.has(item)) {
      missingInExternal.push({
        employeeId: item.employeeId,
        period: item.period || 'Current',
        basicSalary: item.basicSalary || item.baseSalary,
        netSalary: item.netSalary,
      });
    }
  }

  const mismatchCount = discrepancies.length;
  const isSynchronized = mismatchCount === 0 && missingInInternal.length === 0;

  return {
    isSynchronized,
    totalExternal: extList.length,
    totalInternal: intList.length,
    matchedCount,
    mismatchCount,
    missingInInternalCount: missingInInternal.length,
    missingInInternal,
    missingInExternalCount: missingInExternal.length,
    missingInExternal,
    discrepanciesCount: discrepancies.length,
    discrepancies,
    reconciledAt: new Date().toISOString(),
  };
}

/**
 * Reconciles external ERP attendance punches against internal attendance records.
 * Compares: check-in, check-out, hours worked, and shift codes.
 * Detects: MISSING_PUNCH, TIME_DEVIATION, SHIFT_CODE_MISMATCH, HOURS_MISMATCH.
 */
function reconcileAttendance(externalAttendance = [], internalAttendance = []) {
  const extList = Array.isArray(externalAttendance) ? externalAttendance : [];
  const intList = Array.isArray(internalAttendance) ? internalAttendance : [];

  // Group internal records by employeeId + date
  const intGroupMap = new Map();

  for (const rec of intList) {
    const empId = cleanString(rec.employeeId || rec.userId);
    const dateStr = cleanString(rec.date || (rec.timestamp ? new Date(rec.timestamp).toISOString().split('T')[0] : ''));
    if (!empId) continue;

    const groupKey = `${empId}:::${dateStr}`;
    let group = intGroupMap.get(groupKey);
    if (!group) {
      group = {
        employeeId: empId,
        date: dateStr,
        punches: [],
        checkIn: rec.checkIn || (rec.type === 'in' ? rec.timeFormatted : null),
        checkOut: rec.checkOut || (rec.type === 'out' ? rec.timeFormatted : null),
        shiftKey: rec.scheduledShift || rec.shiftKey || null,
        hoursWorked: rec.hoursWorked !== undefined ? Number(rec.hoursWorked) : (rec.workingMinutes ? Number((rec.workingMinutes / 60).toFixed(2)) : null),
        records: [rec],
      };
      intGroupMap.set(groupKey, group);
    } else {
      group.records.push(rec);
      if (rec.checkIn && !group.checkIn) group.checkIn = rec.checkIn;
      if (rec.type === 'in' && !group.checkIn) group.checkIn = rec.timeFormatted;
      if (rec.checkOut && !group.checkOut) group.checkOut = rec.checkOut;
      if (rec.type === 'out') group.checkOut = rec.timeFormatted;
      if (rec.scheduledShift && !group.shiftKey) group.shiftKey = rec.scheduledShift;
      if (rec.hoursWorked !== undefined && group.hoursWorked === null) group.hoursWorked = Number(rec.hoursWorked);
    }
    group.punches.push(rec);
  }

  const matchedInternalGroups = new Set();
  const missingInInternal = [];
  const discrepancies = [];
  let matchedCount = 0;

  for (const ext of extList) {
    const empId = cleanString(ext.employeeId || ext.PersonNumber || ext.userId);
    const dateStr = cleanString(ext.date || ext.startDate || (ext.StartTime ? ext.StartTime.split('T')[0] : ''));
    const groupKey = `${empId}:::${dateStr}`;

    let match = intGroupMap.get(groupKey);
    if (!match) {
      // Fallback: match by empId alone if only 1 internal group exists for employee
      for (const [k, grp] of intGroupMap.entries()) {
        if (grp.employeeId === empId) {
          match = grp;
          break;
        }
      }
    }

    if (!match) {
      discrepancies.push({
        employeeId: empId,
        date: dateStr,
        type: 'MISSING_PUNCH',
        reason: 'RECORD_MISSING_IN_INTERNAL',
        internalRecord: null,
        externalRecord: ext,
      });
      missingInInternal.push({
        employeeId: empId,
        date: dateStr,
        externalRecord: ext,
      });
      continue;
    }

    matchedInternalGroups.add(match);

    const diffs = [];

    // 1. Check-In Punch Comparison
    const extCheckIn = ext.checkIn || ext.startTime || (ext.TimeType === 'CLOCK_IN' ? ext.StartTime : null);
    const intCheckIn = match.checkIn;

    if (extCheckIn && !intCheckIn) {
      diffs.push({
        type: 'MISSING_PUNCH',
        field: 'checkIn',
        internal: null,
        external: extCheckIn,
        reason: 'MISSING_INTERNAL_CHECK_IN',
      });
    } else if (extCheckIn && intCheckIn) {
      const extMins = parseTimeToMinutes(extCheckIn);
      const intMins = parseTimeToMinutes(intCheckIn);
      if (extMins !== null && intMins !== null) {
        const delta = Math.abs(extMins - intMins);
        if (delta > 5) {
          diffs.push({
            type: 'TIME_DEVIATION',
            field: 'checkIn',
            internal: intCheckIn,
            external: extCheckIn,
            deltaMinutes: delta,
            reason: `Check-in time deviation: internal ${intCheckIn} vs external ${extCheckIn} (${delta}m difference)`,
          });
        }
      }
    }

    // 2. Check-Out Punch Comparison
    const extCheckOut = ext.checkOut || ext.endTime || (ext.TimeType === 'CLOCK_OUT' ? ext.EndTime : null);
    const intCheckOut = match.checkOut;

    if (extCheckOut && !intCheckOut) {
      diffs.push({
        type: 'MISSING_PUNCH',
        field: 'checkOut',
        internal: null,
        external: extCheckOut,
        reason: 'MISSING_INTERNAL_CHECK_OUT',
      });
    } else if (extCheckOut && intCheckOut) {
      const extMins = parseTimeToMinutes(extCheckOut);
      const intMins = parseTimeToMinutes(intCheckOut);
      if (extMins !== null && intMins !== null) {
        const delta = Math.abs(extMins - intMins);
        if (delta > 5) {
          diffs.push({
            type: 'TIME_DEVIATION',
            field: 'checkOut',
            internal: intCheckOut,
            external: extCheckOut,
            deltaMinutes: delta,
            reason: `Check-out time deviation: internal ${intCheckOut} vs external ${extCheckOut} (${delta}m difference)`,
          });
        }
      }
    }

    // 3. Shift Code Mismatch Comparison
    const extShift = cleanString(ext.shiftKey || ext.shiftCode || ext.scheduledShift || ext.ShiftKey);
    const intShift = cleanString(match.shiftKey);
    if (extShift && intShift && extShift.toLowerCase() !== intShift.toLowerCase()) {
      diffs.push({
        type: 'SHIFT_CODE_MISMATCH',
        field: 'shiftKey',
        internal: intShift,
        external: extShift,
        reason: `Shift code mismatch: internal schedule ${intShift} vs external ${extShift}`,
      });
    }

    // 4. Hours Worked Comparison
    const extHours = ext.hoursWorked !== undefined ? Number(ext.hoursWorked) : (ext.quantityInHours !== undefined ? Number(ext.quantityInHours) : null);
    const intHours = match.hoursWorked !== null ? Number(match.hoursWorked) : null;
    if (extHours !== null && intHours !== null) {
      const hoursDiff = Math.round(Math.abs(extHours - intHours) * 100) / 100;
      if (hoursDiff > 0.1) {
        diffs.push({
          type: 'HOURS_MISMATCH',
          field: 'hoursWorked',
          internal: intHours,
          external: extHours,
          diff: hoursDiff,
          reason: `Hours worked mismatch: internal ${intHours}h vs external ${extHours}h`,
        });
      }
    }

    if (diffs.length > 0) {
      for (const d of diffs) {
        discrepancies.push({
          employeeId: empId,
          date: dateStr,
          type: d.type,
          field: d.field,
          internalRecord: match.records[0] || match,
          externalRecord: ext,
          internalValue: d.internal,
          externalValue: d.external,
          reason: d.reason,
          diffs,
        });
      }
    } else {
      matchedCount++;
    }
  }

  const missingInExternal = [];
  for (const [k, grp] of intGroupMap.entries()) {
    if (!matchedInternalGroups.has(grp)) {
      missingInExternal.push({
        employeeId: grp.employeeId,
        date: grp.date,
        internalRecord: grp.records[0] || grp,
      });
    }
  }

  const mismatchCount = discrepancies.length;
  const isSynchronized = mismatchCount === 0 && missingInInternal.length === 0;

  return {
    isSynchronized,
    totalExternal: extList.length,
    totalInternal: intList.length,
    matchedCount,
    mismatchCount,
    missingInInternalCount: missingInInternal.length,
    missingInInternal,
    missingInExternalCount: missingInExternal.length,
    missingInExternal,
    discrepanciesCount: discrepancies.length,
    discrepancies,
    reconciledAt: new Date().toISOString(),
  };
}

module.exports = {
  reconcileEmployees,
  reconcilePayroll,
  reconcileAttendance,
};
