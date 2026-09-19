// SAP SuccessFactors Enterprise ERP Connector
// Implements bidirectional OData v2/v4 mapping for:
// - PerPerson / PerPersonal (Employee & Personal Info)
// - EmpJob (Employment & Job Info)
// - EmployeeTime (Attendance & Time Records)
// - EmpCompensation / EmpPayCompRecurring (Compensation & Payroll)

const BaseErpAdapter = require('./BaseErpAdapter');

function formatSapDate(dateInput) {
  if (!dateInput) return `/Date(${Date.now()})/`;
  const ms = typeof dateInput === 'number' ? dateInput : new Date(dateInput).getTime();
  if (isNaN(ms)) return `/Date(${Date.now()})/`;
  return `/Date(${ms})/`;
}

function parseSapDate(sapDate) {
  if (!sapDate) return new Date().toISOString().split('T')[0];
  if (typeof sapDate === 'number') {
    const d = new Date(sapDate);
    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  }
  if (typeof sapDate === 'string') {
    const match = sapDate.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (match) {
      const d = new Date(parseInt(match[1], 10));
      return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    }
    const d = new Date(sapDate);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return String(sapDate);
}

function formatSapTime(timeInput) {
  if (!timeInput) return 'PT08H00M00S';
  const str = String(timeInput).trim();
  if (str.startsWith('PT')) return str;
  // match HH:MM or HH:MM:SS or HH:MM AM/PM
  const ampmMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const s = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
    const ampm = ampmMatch[4]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return `PT${hh}H${mm}M${ss}S`;
  }
  return 'PT08H00M00S';
}

function parseSapTime(sapTime) {
  if (!sapTime) return '08:00:00';
  const str = String(sapTime).trim();
  const match = str.match(/PT(\d{1,2})H(?:(\d{1,2})M)?(?:(\d{1,2})S)?/i);
  if (match) {
    const h = String(match[1] || '0').padStart(2, '0');
    const m = String(match[2] || '0').padStart(2, '0');
    const s = String(match[3] || '0').padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  return str;
}

class SapSuccessFactorsConnector extends BaseErpAdapter {
  constructor(options = {}) {
    super('sap_successfactors');
    this.options = options;
    this.schemaVersion = 'OData v4 / SF-2026';
  }

  isConfigured() {
    return !!(
      process.env.SAP_ODATA_URL &&
      process.env.SAP_CLIENT_ID &&
      (process.env.SAP_CLIENT_SECRET || process.env.SAP_API_KEY)
    );
  }

  // =========================================================================
  // 1. Employee / Personal Info (PerPerson)
  // =========================================================================

  toSapPerPerson(internalEmployee) {
    if (!internalEmployee) return null;
    const emp = internalEmployee;
    const nameParts = String(emp?.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const personId = emp.metadata?.sapPersonId || parseInt(String(emp.employeeCode || emp.id || '10001').replace(/\D/g, ''), 10) || 10001;

    return {
      personIdExternal: emp.employeeCode || emp.id,
      personId: personId,
      personalInfoNav: {
        firstName,
        lastName,
        formalName: emp.nameAr || emp.name || '',
        gender: emp.gender || 'U',
        customString1: emp.nationalId || '',
      },
      emailNav: {
        emailAddress: emp.workEmail || emp.email || '',
      },
      phoneNav: {
        phoneNumber: emp.phone || '',
      },
      formalName: emp.nameAr || emp.name || '',
      customString1: emp.nationalId || '',
      emailAddress: emp.workEmail || emp.email || '',
      phoneNumber: emp.phone || '',
    };
  }

  toSapEmpJob(internalEmployee) {
    if (!internalEmployee) return null;
    const emp = internalEmployee;
    return {
      userId: emp.employeeCode || emp.id,
      startDate: formatSapDate(emp.hireDate),
      department: emp.department || 'Operations',
      location: emp.factory || 'Quesna',
      position: emp.position || 'Staff',
      costCenter: emp.costCenter || 'CC-MFG-01',
      managerId: emp.supervisor || '',
      company: emp.tenantId || 'elaraby',
      emplStatus: emp.active !== false ? 'A' : 'T',
    };
  }

  toInternalEmployee(sapPerPerson = {}, sapEmpJob = {}) {
    if (!sapPerPerson && !sapEmpJob) return null;
    const p = sapPerPerson || {};
    const j = sapEmpJob || {};

    const pNav = p.personalInfoNav || {};
    const emailNav = p.emailNav || {};
    const phoneNav = p.phoneNav || {};

    const externalId = p.personIdExternal || j.userId || String(p.personId || '');
    const fullName = p.formalName || pNav.formalName || (pNav.firstName ? `${pNav.firstName} ${pNav.lastName || ''}`.trim() : '') || p.name || 'SAP Employee';
    const nationalId = p.customString1 || pNav.customString1 || p.nationalId || '';
    const workEmail = p.emailAddress || emailNav.emailAddress || p.workEmail || '';
    const phone = p.phoneNumber || phoneNav.phoneNumber || p.phone || '';
    const gender = p.gender || pNav.gender || 'U';

    const department = j.department || p.department || 'Operations';
    const factory = j.location || p.factory || 'Quesna';
    const position = j.position || p.position || 'Specialist';
    const costCenter = j.costCenter || p.costCenter || 'CC-MFG-01';
    const supervisor = j.managerId || p.supervisor || null;
    const tenantId = j.company || p.tenantId || 'elaraby';
    const active = j.emplStatus ? (j.emplStatus === 'A') : (p.emplStatus ? p.emplStatus === 'A' : (p.active !== false));
    const hireDate = j.startDate ? parseSapDate(j.startDate) : (p.hireDate ? parseSapDate(p.hireDate) : new Date().toISOString().split('T')[0]);

    return {
      id: externalId,
      employeeCode: externalId,
      name: fullName,
      nameAr: p.formalName || pNav.formalName || fullName,
      nationalId,
      workEmail,
      phone,
      gender,
      department,
      factory,
      position,
      costCenter,
      supervisor,
      tenantId,
      active,
      hireDate,
      metadata: {
        sapPersonId: p.personId || null,
        sapSystem: 'SuccessFactors',
      },
    };
  }

  // =========================================================================
  // 2. Attendance & Time Records (EmployeeTime)
  // =========================================================================

  toSapEmployeeTime(internalAttendance) {
    if (!internalAttendance) return null;
    const att = internalAttendance;
    const externalCode = att.id || att.punchId || `ET-${Date.now()}`;
    const dateStr = att.date || (att.timestamp ? new Date(att.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

    const hours = att.hoursWorked !== undefined
      ? Number(att.hoursWorked)
      : (att.workingMinutes !== undefined ? Number((att.workingMinutes / 60).toFixed(2)) : 8.0);

    const checkInTime = att.checkIn || att.startTime || (att.type === 'in' ? att.timeFormatted : '08:00:00');
    const checkOutTime = att.checkOut || att.endTime || (att.type === 'out' ? att.timeFormatted : '17:00:00');

    return {
      externalCode,
      userId: att.employeeId,
      timeType: att.timeType || (att.type === 'out' || att.type === 'in' ? 'REGULAR' : (att.type || 'REGULAR')),
      startDate: formatSapDate(dateStr),
      startTime: formatSapTime(checkInTime),
      endTime: formatSapTime(checkOutTime),
      quantityInHours: hours,
      approvalStatus: att.status || (att.approvalStatus || 'APPROVED'),
    };
  }

  toInternalAttendance(sapEmployeeTime) {
    if (!sapEmployeeTime) return null;
    const s = sapEmployeeTime;
    const hours = parseFloat(s.quantityInHours) || 8.0;
    const workingMinutes = Math.round(hours * 60);

    return {
      id: s.externalCode,
      punchId: s.externalCode,
      employeeId: s.userId,
      date: parseSapDate(s.startDate),
      checkIn: parseSapTime(s.startTime),
      checkOut: parseSapTime(s.endTime),
      hoursWorked: hours,
      workingMinutes,
      type: s.timeType || 'REGULAR',
      status: s.approvalStatus || 'APPROVED',
      source: 'sap_successfactors',
    };
  }

  // =========================================================================
  // 3. Compensation & Payroll (EmpCompensation / EmpPayCompRecurring)
  // =========================================================================

  toSapEmpCompensation(internalPayroll) {
    if (!internalPayroll) return null;
    const p = internalPayroll;
    const currency = p.currency || 'EGP';
    const basicSalary = Number(p.basicSalary || 0);
    const allowances = Number(p.allowances || 0);
    const deductions = Number(p.deductions || 0);
    const netSalary = p.netSalary !== undefined ? Number(p.netSalary) : (basicSalary + allowances - deductions);

    return {
      userId: p.employeeId,
      startDate: formatSapDate(p.period ? new Date(p.period).getTime() : Date.now()),
      currencyCode: currency,
      frequency: 'MON',
      basicSalary,
      allowances,
      deductions,
      netSalary,
      period: p.period || 'Current',
      payComponents: [
        {
          payComponent: 'BASE_SALARY',
          paycompvalue: basicSalary,
          currencyCode: currency,
          frequency: 'MON',
        },
        {
          payComponent: 'ALLOWANCES',
          paycompvalue: allowances,
          currencyCode: currency,
          frequency: 'MON',
        },
        {
          payComponent: 'DEDUCTIONS',
          paycompvalue: deductions,
          currencyCode: currency,
          frequency: 'MON',
        },
        {
          payComponent: 'NET_SALARY',
          paycompvalue: netSalary,
          currencyCode: currency,
          frequency: 'MON',
        },
      ],
    };
  }

  toInternalPayroll(sapEmpCompensation) {
    if (!sapEmpCompensation) return null;
    const s = sapEmpCompensation;
    let basicSalary = 0;
    let allowances = 0;
    let deductions = 0;
    let netSalary = 0;
    const currency = s.currencyCode || s.currency || 'EGP';

    if (Array.isArray(s.payComponents) && s.payComponents.length > 0) {
      for (const comp of s.payComponents) {
        if (!comp) continue;
        const val = Number(comp.paycompvalue || 0);
        const name = String(comp.payComponent || '').toUpperCase();
        if (name === 'BASE_SALARY' || name === 'BASIC_SALARY') basicSalary = val;
        else if (name === 'ALLOWANCES' || name === 'HOUSING' || name === 'TRANS') allowances += val;
        else if (name === 'DEDUCTIONS' || name === 'LOAN_DEDUCT' || name === 'TAX') deductions += val;
        else if (name === 'NET_SALARY') netSalary = val;
      }
    } else {
      basicSalary = Number(s.basicSalary || 0);
      allowances = Number(s.allowances || 0);
      deductions = Number(s.deductions || 0);
      netSalary = Number(s.netSalary || 0);
    }

    if (!basicSalary && s.basicSalary) basicSalary = Number(s.basicSalary);
    if (!allowances && s.allowances) allowances = Number(s.allowances);
    if (!deductions && s.deductions) deductions = Number(s.deductions);
    if (!netSalary) {
      netSalary = s.netSalary !== undefined ? Number(s.netSalary) : (basicSalary + allowances - deductions);
    }
    netSalary = Math.round(netSalary * 100) / 100;

    return {
      employeeId: s.userId || s.employeeId,
      period: s.period ? String(s.period) : parseSapDate(s.startDate),
      basicSalary: Math.round(basicSalary * 100) / 100,
      allowances: Math.round(allowances * 100) / 100,
      deductions: Math.round(deductions * 100) / 100,
      netSalary,
      currency,
      source: 'sap_successfactors',
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
        const perPerson = this.toSapPerPerson(r);
        const empJob = this.toSapEmpJob(r);
        return {
          ...perPerson,
          empJobNav: empJob,
        };
      });
    } else if (cleanEntity === 'attendance' || cleanEntity === 'timerecords' || cleanEntity === 'time') {
      exported = safeRecords.map((r) => this.toSapEmployeeTime(r));
    } else if (cleanEntity === 'payroll' || cleanEntity === 'compensation') {
      exported = safeRecords.map((r) => this.toSapEmpCompensation(r));
    } else {
      throw new Error(`Unsupported SAP export entity: ${entity}`);
    }

    return {
      system: 'sap',
      entity: cleanEntity,
      count: exported.length,
      schemaVersion: this.schemaVersion,
      records: exported,
    };
  }

  // Standard Adapter Compatibility Methods
  async fetchEmployees(options = {}) {
    if (!this.isConfigured()) {
      return { records: [], count: 0, error: 'sap_not_configured' };
    }
    return { records: [], count: 0, source: 'sap_successfactors' };
  }

  async fetchLeaveBalances() {
    if (!this.isConfigured()) return [];
    return [];
  }

  async pushLeaveApproval(leaveRequest) {
    if (!this.isConfigured()) return { success: false, error: 'sap_not_configured' };
    return { success: true, externalReferenceId: `SF_LEAVE_${Date.now()}` };
  }

  async fetchPayrollSummaries() {
    if (!this.isConfigured()) return { summaries: [], count: 0 };
    return { summaries: [], count: 0 };
  }
}

module.exports = SapSuccessFactorsConnector;
