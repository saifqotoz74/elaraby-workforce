// Administrative Input Validators & Vacation Balance Safety Guards
// Strictly enforces business constraints, preventing corrupt state or unconstrained balance mutations.

const MAX_VACATION_BALANCE = Number(process.env.MAX_VACATION_BALANCE) || 60;
const VALID_SHIFTS = ['morning', 'evening', 'night', 'office', 'off'];

function validateVacationBalance(val) {
  if (val === undefined || val === null || val === '') {
    return { ok: false, error: 'vacation_balance_required' };
  }
  const num = Number(val);
  if (!Number.isFinite(num)) {
    return { ok: false, error: 'vacation_balance_must_be_number' };
  }
  if (num < 0) {
    return { ok: false, error: 'vacation_balance_cannot_be_negative' };
  }
  if (num > MAX_VACATION_BALANCE) {
    return { ok: false, error: `vacation_balance_exceeds_maximum_${MAX_VACATION_BALANCE}` };
  }
  // Allow at most 1 decimal place (e.g. 12.5 days for half-day increments)
  const decimalPart = (String(num).split('.')[1] || '').length;
  if (decimalPart > 1) {
    return { ok: false, error: 'vacation_balance_max_one_decimal_place' };
  }
  return { ok: true, value: num };
}

function validateEmployeeCreate(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'request_body_required' };
  }
  const { name, nationalId, phone, vacationBalance } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return { ok: false, error: 'valid_name_required_2_to_100_chars' };
  }

  const cleanNat = String(nationalId || '').trim();
  if (!/^\d{14}$/.test(cleanNat)) {
    return { ok: false, error: 'name_and_14_digit_national_id_required' };
  }

  if (phone) {
    const cleanPhone = String(phone).trim().replace(/[\s-]/g, '');
    if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
      return { ok: false, error: 'invalid_phone_number_format' };
    }
  }

  let finalBalance = 12;
  if (vacationBalance !== undefined && vacationBalance !== null) {
    const balCheck = validateVacationBalance(vacationBalance);
    if (!balCheck.ok) return balCheck;
    finalBalance = balCheck.value;
  }

  return {
    ok: true,
    data: {
      name: name.trim(),
      nationalId: cleanNat,
      employeeCode: body.employeeCode ? String(body.employeeCode).trim() : null,
      factory: body.factory ? String(body.factory).trim() : '10th of Ramadan',
      department: body.department ? String(body.department).trim() : 'Production A',
      position: body.position ? String(body.position).trim() : 'Operator',
      supervisor: body.supervisor ? String(body.supervisor).trim() : '—',
      phone: body.phone ? String(body.phone).trim() : '',
      vacationBalance: finalBalance,
    },
  };
}

function validateEmployeeUpdate(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'request_body_required' };
  }
  const sanitized = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100) {
      return { ok: false, error: 'valid_name_required_2_to_100_chars' };
    }
    sanitized.name = body.name.trim();
  }

  if (body.phone !== undefined) {
    const cleanPhone = String(body.phone).trim().replace(/[\s-]/g, '');
    if (cleanPhone && !/^\+?\d{8,15}$/.test(cleanPhone)) {
      return { ok: false, error: 'invalid_phone_number_format' };
    }
    sanitized.phone = cleanPhone;
  }

  if (body.vacationBalance !== undefined) {
    const balCheck = validateVacationBalance(body.vacationBalance);
    if (!balCheck.ok) return balCheck;
    sanitized.vacationBalance = balCheck.value;
  }

  const stringFields = ['employeeCode', 'factory', 'department', 'position', 'supervisor'];
  for (const field of stringFields) {
    if (body[field] !== undefined) {
      sanitized[field] = String(body[field]).trim();
    }
  }

  if (body.resetPin === true) {
    sanitized.resetPin = true;
  }

  return { ok: true, data: sanitized };
}

function validatePayrollUpdate(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'request_body_required' };
  }
  const { period, basicSalary, allowances, deductions } = body;
  if (!period || typeof period !== 'string' || !period.trim()) {
    return { ok: false, error: 'period_required' };
  }

  const basic = Number(basicSalary || 0);
  const allow = Number(allowances || 0);
  const deduct = Number(deductions || 0);

  if (!Number.isFinite(basic) || basic < 0) return { ok: false, error: 'basic_salary_must_be_non_negative' };
  if (!Number.isFinite(allow) || allow < 0) return { ok: false, error: 'allowances_must_be_non_negative' };
  if (!Number.isFinite(deduct) || deduct < 0) return { ok: false, error: 'deductions_must_be_non_negative' };

  return {
    ok: true,
    data: {
      period: period.trim(),
      basicSalary: basic,
      allowances: allow,
      deductions: deduct,
      paidOn: body.paidOn ? String(body.paidOn).trim() : '',
      paymentMethod: body.paymentMethod ? String(body.paymentMethod).trim() : 'Bank Transfer',
    },
  };
}

function validateRosterUpdate(body) {
  const days = body?.days;
  if (!Array.isArray(days) || days.length !== 7) {
    return { ok: false, error: 'days_must_be_array_of_7_shifts' };
  }
  for (let i = 0; i < 7; i++) {
    const item = days[i];
    if (!item || typeof item !== 'object' || !VALID_SHIFTS.includes(item.shift)) {
      return { ok: false, error: `invalid_shift_at_day_index_${i}` };
    }
  }
  return {
    ok: true,
    data: {
      days: days.map((d, i) => ({ dayIndex: i, shift: d.shift })),
    },
  };
}

module.exports = {
  MAX_VACATION_BALANCE,
  VALID_SHIFTS,
  validateVacationBalance,
  validateEmployeeCreate,
  validateEmployeeUpdate,
  validatePayrollUpdate,
  validateRosterUpdate,
};
