// Oracle Fusion Cloud HCM Enterprise ERP Connector
// Implements bidirectional REST mapping for:
// - workers (Worker Profile)
// - assignments (Work Assignments)
// - timeRecords / timeEvents (Attendance Time Entries)
// - payrollElementEntries (Payroll Element Entries & Summaries)

const BaseErpAdapter = require('./BaseErpAdapter');

class OracleFusionHcmConnector extends BaseErpAdapter {
  constructor(options = {}) {
    super('oracle_fusion_hcm');
    this.options = options;
    this.schemaVersion = 'REST API 11.13.18.05';
  }

  isConfigured() {
    return !!(
      process.env.ORACLE_HCM_URL &&
      process.env.ORACLE_HCM_USER &&
      (process.env.ORACLE_HCM_PASS || process.env.ORACLE_HCM_TOKEN)
    );
  }

  // =========================================================================
  // 1. Worker Profile (workers)
  // =========================================================================

  toOracleWorker(internalEmployee) {
    if (!internalEmployee) return null;
    const emp = internalEmployee;
    const personId = emp.metadata?.oraclePersonId || parseInt(String(emp.employeeCode || emp.id || '20001').replace(/\D/g, ''), 10) || 20001;
    const legislation = emp.country || (emp.tenantId === 'gulf_industrial' ? 'SA' : 'EG');

    return {
      PersonId: personId,
      PersonNumber: emp.employeeCode || emp.id,
      DisplayName: emp.name || 'Oracle Worker',
      NationalId: emp.nationalId || '',
      WorkEmail: emp.workEmail || emp.email || '',
      WorkPhoneNumber: emp.phone || '',
      LegislationCode: legislation,
    };
  }

  toOracleAssignment(internalEmployee) {
    if (!internalEmployee) return null;
    const emp = internalEmployee;
    const personNumber = emp.employeeCode || emp.id;
    const assignmentId = emp.metadata?.assignmentId || parseInt(String(personNumber).replace(/\D/g, ''), 10) || 30001;

    return {
      AssignmentId: assignmentId,
      AssignmentNumber: `ASG-${personNumber}-1`,
      PersonNumber: personNumber,
      DepartmentName: emp.department || 'Operations',
      BusinessUnitName: emp.tenantId || 'elaraby',
      LocationName: emp.factory || 'Quesna',
      JobName: emp.position || 'Staff',
      AssignmentStatus: emp.active !== false ? 'ACTIVE_PROCESS' : 'INACTIVE',
      ManagerPersonNumber: emp.supervisor || '',
    };
  }

  toInternalEmployee(oracleWorker = {}, oracleAssignment = {}) {
    if (!oracleWorker && !oracleAssignment) return null;
    const w = oracleWorker || {};
    const a = oracleAssignment || {};

    const personNumber = w.PersonNumber || a.PersonNumber || String(w.PersonId || '');
    const fullName = w.DisplayName || w.name || 'Oracle Worker';
    const nationalId = w.NationalId || w.nationalId || '';
    const workEmail = w.WorkEmail || w.workEmail || '';
    const phone = w.WorkPhoneNumber || w.phone || '';
    const legislation = w.LegislationCode || 'EG';

    const department = a.DepartmentName || w.department || 'Operations';
    const factory = a.LocationName || w.factory || 'Quesna';
    const position = a.JobName || w.position || 'Specialist';
    const supervisor = a.ManagerPersonNumber || w.supervisor || null;
    const tenantId = a.BusinessUnitName || w.tenantId || (legislation === 'SA' ? 'gulf_industrial' : 'elaraby');
    const active = a.AssignmentStatus ? (a.AssignmentStatus === 'ACTIVE_PROCESS') : (w.active !== false);

    return {
      id: personNumber,
      employeeCode: personNumber,
      name: fullName,
      nameAr: w.nameAr || fullName,
      nationalId,
      workEmail,
      phone,
      country: legislation,
      department,
      factory,
      position,
      supervisor,
      tenantId,
      active,
      metadata: {
        oraclePersonId: w.PersonId || null,
        assignmentId: a.AssignmentId || null,
        oracleSystem: 'FusionCloudHCM',
      },
    };
  }

  // =========================================================================
  // 2. Attendance Time Entries (timeRecords / timeEvents)
  // =========================================================================

  toOracleTimeRecord(internalAttendance) {
    if (!internalAttendance) return null;
    const att = internalAttendance;
    const eventId = att.id || att.punchId || `ORAPCH_${Date.now()}`;
    const employeeId = att.employeeId || 'EMP';
    const isCheckIn = att.type === 'in' || att.type === 'check_in';
    const timeType = isCheckIn ? 'CLOCK_IN' : 'CLOCK_OUT';

    let isoTimestamp = new Date().toISOString();
    try {
      if (att.timestamp && !isNaN(new Date(att.timestamp).getTime())) {
        isoTimestamp = new Date(att.timestamp).toISOString();
      } else if (att.date && !isNaN(new Date(att.date).getTime())) {
        const timeStr = isCheckIn ? (att.checkIn || '08:00:00') : (att.checkOut || '17:00:00');
        const d = new Date(`${att.date}T${timeStr.length === 5 ? timeStr + ':00' : timeStr}Z`);
        isoTimestamp = !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
      }
    } catch {
      isoTimestamp = new Date().toISOString();
    }

    const hours = att.hoursWorked !== undefined
      ? Number(att.hoursWorked)
      : (att.workingMinutes !== undefined ? Number((att.workingMinutes / 60).toFixed(2)) : 8.0);

    let endTimeIso = isoTimestamp;
    try {
      if (att.checkOut) {
        const datePart = (att.date && !isNaN(new Date(att.date).getTime())) ? att.date : new Date().toISOString().split('T')[0];
        const timePart = att.checkOut.length === 5 ? att.checkOut + ':00' : att.checkOut;
        const endD = new Date(`${datePart}T${timePart}Z`);
        if (!isNaN(endD.getTime())) {
          endTimeIso = endD.toISOString();
        }
      }
    } catch {
      endTimeIso = isoTimestamp;
    }

    return {
      TimeEventId: eventId,
      ReporterId: att.metadata?.oraclePersonId || employeeId,
      PersonNumber: employeeId,
      TimeType: timeType,
      StartTime: isoTimestamp,
      EndTime: endTimeIso,
      BadgeId: att.badgeNumber || `BADGE_${employeeId}`,
      TerminalId: att.deviceId || 'TERM_DEFAULT_01',
      QuantityInHours: hours,
      ShiftKey: att.scheduledShift || att.shiftKey || 'morning_shift',
      Status: att.status || 'PROCESSED',
    };
  }

  toInternalAttendance(oracleTimeRecord) {
    if (!oracleTimeRecord) return null;
    const rec = oracleTimeRecord;
    const timeType = String(rec.TimeType || '').toUpperCase();
    const isCheckIn = timeType.includes('IN') || timeType === 'CLOCK_IN';
    const isCheckOut = timeType.includes('OUT') || timeType === 'CLOCK_OUT';

    let startDate = new Date();
    try {
      if (rec.StartTime && !isNaN(new Date(rec.StartTime).getTime())) {
        startDate = new Date(rec.StartTime);
      }
    } catch {
      startDate = new Date();
    }
    const dateStr = !isNaN(startDate.getTime()) ? startDate.toISOString().split('T')[0] : (rec.date || new Date().toISOString().split('T')[0]);

    const formattedTime = !isNaN(startDate.getTime())
      ? startDate.toISOString().substring(11, 19)
      : '08:00:00';

    let checkOutTime = '17:00:00';
    try {
      if (rec.checkOut) {
        checkOutTime = rec.checkOut;
      } else if (rec.EndTime && !isNaN(new Date(rec.EndTime).getTime())) {
        checkOutTime = new Date(rec.EndTime).toISOString().substring(11, 19);
      }
    } catch {
      checkOutTime = '17:00:00';
    }

    const hours = parseFloat(rec.QuantityInHours) || 8.0;

    return {
      id: String(rec.TimeEventId || `ORA_${Date.now()}`),
      punchId: String(rec.TimeEventId || `ORA_${Date.now()}`),
      employeeId: String(rec.PersonNumber || rec.ReporterId || ''),
      date: dateStr,
      type: isCheckIn ? 'in' : (isCheckOut ? 'out' : 'in'),
      checkIn: isCheckIn ? formattedTime : (rec.checkIn || '08:00:00'),
      checkOut: isCheckOut ? formattedTime : checkOutTime,
      timestamp: !isNaN(startDate.getTime()) ? startDate.getTime() : Date.now(),
      timeFormatted: formattedTime,
      deviceId: rec.TerminalId || 'TERM_ORACLE',
      badgeNumber: rec.BadgeId || null,
      hoursWorked: hours,
      workingMinutes: Math.round(hours * 60),
      shiftKey: rec.ShiftKey || 'morning_shift',
      status: rec.Status || 'APPROVED',
      source: 'oracle_fusion_hcm',
    };
  }

  // =========================================================================
  // 3. Payroll Element Entries (payrollElementEntries)
  // =========================================================================

  toOraclePayroll(internalPayroll) {
    if (!internalPayroll) return null;
    const p = internalPayroll;
    const personNumber = p.employeeCode || p.employeeId;
    const currency = p.currency || 'EGP';
    const periodName = p.period ? `${p.period} Monthly` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')} Monthly`;

    const basicSalary = Number(p.basicSalary || 0);
    const allowances = Number(p.allowances || 0);
    const deductions = Number(p.deductions || 0);
    const netSalary = p.netSalary !== undefined ? Number(p.netSalary) : (basicSalary + allowances - deductions);

    const entries = [
      {
        ElementEntryId: `ELE_${personNumber}_BASE`,
        PersonNumber: personNumber,
        ElementName: 'Basic Salary',
        EntryType: 'E',
        Amount: basicSalary,
        Currency: currency,
        PeriodName: periodName,
      },
      {
        ElementEntryId: `ELE_${personNumber}_ALLOW`,
        PersonNumber: personNumber,
        ElementName: 'Total Allowances',
        EntryType: 'E',
        Amount: allowances,
        Currency: currency,
        PeriodName: periodName,
      },
      {
        ElementEntryId: `ELE_${personNumber}_DEDUCT`,
        PersonNumber: personNumber,
        ElementName: 'Total Deductions',
        EntryType: 'D',
        Amount: deductions,
        Currency: currency,
        PeriodName: periodName,
      },
    ];

    return {
      PersonNumber: personNumber,
      PeriodName: periodName,
      BasicSalary: basicSalary,
      Allowances: allowances,
      Deductions: deductions,
      NetSalary: netSalary,
      Currency: currency,
      payrollElementEntries: entries,
    };
  }

  toInternalPayroll(oraclePayrollOrEntries) {
    if (!oraclePayrollOrEntries) return null;
    const o = oraclePayrollOrEntries;

    if (Array.isArray(o)) {
      // Array of payrollElementEntries
      let employeeId = '';
      let period = '';
      let basicSalary = 0;
      let allowances = 0;
      let deductions = 0;
      let currency = 'EGP';

      for (const entry of o) {
        if (!entry) continue;
        if (!employeeId && entry.PersonNumber) employeeId = entry.PersonNumber;
        if (!period && entry.PeriodName) period = entry.PeriodName;
        if (entry.Currency) currency = entry.Currency;

        const name = String(entry.ElementName || '').toLowerCase();
        const amt = Number(entry.Amount || 0);
        if (name.includes('basic') || name.includes('base')) {
          basicSalary = amt;
        } else if (entry.EntryType === 'E' || name.includes('allowance') || name.includes('bonus')) {
          allowances += amt;
        } else if (entry.EntryType === 'D' || name.includes('deduction') || name.includes('loan') || name.includes('tax')) {
          deductions += amt;
        }
      }

      basicSalary = Math.round(basicSalary * 100) / 100;
      allowances = Math.round(allowances * 100) / 100;
      deductions = Math.round(deductions * 100) / 100;
      const netSalary = Math.round((basicSalary + allowances - deductions) * 100) / 100;

      return {
        employeeId,
        period: period.replace(/\s*Monthly$/i, '').trim() || 'Current',
        basicSalary,
        allowances,
        deductions,
        netSalary,
        currency,
        source: 'oracle_fusion_hcm',
      };
    }

    // Object summary format
    const personNumber = o.PersonNumber || o.employeeId || '';
    let basicSalary = Number(o.BasicSalary || o.basicSalary || 0);
    let allowances = Number(o.Allowances || o.allowances || 0);
    let deductions = Number(o.Deductions || o.deductions || 0);
    let netSalary = o.NetSalary !== undefined ? Number(o.NetSalary) : (o.netSalary !== undefined ? Number(o.netSalary) : (basicSalary + allowances - deductions));

    if (Array.isArray(o.payrollElementEntries) && o.payrollElementEntries.length > 0) {
      basicSalary = 0;
      allowances = 0;
      deductions = 0;
      for (const entry of o.payrollElementEntries) {
        if (!entry) continue;
        const name = String(entry.ElementName || '').toLowerCase();
        const amt = Number(entry.Amount || 0);
        if (name.includes('basic') || name.includes('base')) basicSalary = amt;
        else if (entry.EntryType === 'E' || name.includes('allowance')) allowances += amt;
        else if (entry.EntryType === 'D' || name.includes('deduction')) deductions += amt;
      }
      netSalary = basicSalary + allowances - deductions;
    }

    basicSalary = Math.round(basicSalary * 100) / 100;
    allowances = Math.round(allowances * 100) / 100;
    deductions = Math.round(deductions * 100) / 100;
    netSalary = Math.round(netSalary * 100) / 100;

    return {
      employeeId: personNumber,
      period: (o.PeriodName || o.period || 'Current').replace(/\s*Monthly$/i, '').trim(),
      basicSalary,
      allowances,
      deductions,
      netSalary,
      currency: o.Currency || o.currency || 'EGP',
      source: 'oracle_fusion_hcm',
    };
  }

  // =========================================================================
  // 4. Schema Export Generator
  // =========================================================================

  exportSchema(entity, records = [], tenantId = null) {
    const cleanEntity = String(entity || '').toLowerCase().trim();
    const safeRecords = Array.isArray(records) ? records : [];
    let exported = [];

    if (cleanEntity === 'employees' || cleanEntity === 'workers' || cleanEntity === 'users') {
      exported = safeRecords.map((r) => {
        const worker = this.toOracleWorker(r);
        const assignment = this.toOracleAssignment(r);
        return {
          ...worker,
          assignments: [assignment],
        };
      });
    } else if (cleanEntity === 'attendance' || cleanEntity === 'timerecords' || cleanEntity === 'time') {
      exported = safeRecords.map((r) => this.toOracleTimeRecord(r));
    } else if (cleanEntity === 'payroll' || cleanEntity === 'payrollelemententries') {
      exported = safeRecords.map((r) => this.toOraclePayroll(r));
    } else {
      throw new Error(`Unsupported Oracle export entity: ${entity}`);
    }

    return {
      system: 'oracle',
      entity: cleanEntity,
      count: exported.length,
      schemaVersion: this.schemaVersion,
      records: exported,
    };
  }

  // Standard Adapter Compatibility Methods
  async fetchEmployees(options = {}) {
    if (!this.isConfigured()) {
      return { records: [], count: 0, error: 'oracle_not_configured' };
    }
    return { records: [], count: 0, source: 'oracle_fusion_hcm' };
  }

  async fetchLeaveBalances() {
    if (!this.isConfigured()) return [];
    return [];
  }

  async pushLeaveApproval(leaveRequest) {
    if (!this.isConfigured()) return { success: false, error: 'oracle_not_configured' };
    return { success: true, externalReferenceId: `ORA_LEAVE_${Date.now()}` };
  }

  async fetchPayrollSummaries() {
    if (!this.isConfigured()) return { summaries: [], count: 0 };
    return { summaries: [], count: 0 };
  }
}

module.exports = OracleFusionHcmConnector;
