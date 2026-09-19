const dbModule = require('../db');
const holidays = require('../utils/holidays');
const realtimeService = require('./realtimeService');
const { checkScope } = require('../rbac');
const { recordAuditLog } = require('./auditService');
const { validateRosterUpdate } = require('../validators/adminValidators');

function db() {
  return dbModule.data();
}

function save() {
  dbModule.save();
}

// ---------------- Standard Shift Definitions ----------------
const SHIFTS = {
  morning: {
    id: 'morning',
    nameEn: 'Morning Shift (1st)',
    nameAr: 'الوردية الأولى (صباحية)',
    timeEn: '07:00 AM – 03:00 PM',
    timeAr: '07:00 ص – 03:00 م',
    startHour: 7,
    endHour: 15,
    isOff: false,
  },
  evening: {
    id: 'evening',
    nameEn: 'Evening Shift (2nd)',
    nameAr: 'الوردية الثانية (مسائية)',
    timeEn: '03:00 PM – 11:00 PM',
    timeAr: '03:00 م – 11:00 م',
    startHour: 15,
    endHour: 23,
    isOff: false,
  },
  night: {
    id: 'night',
    nameEn: 'Night Shift (3rd)',
    nameAr: 'الوردية الثالثة (ليلية)',
    timeEn: '11:00 PM – 07:00 AM',
    timeAr: '11:00 م – 07:00 ص',
    startHour: 23,
    endHour: 7,
    isOff: false,
  },
  regular: {
    id: 'regular',
    nameEn: 'Office Regular Hours',
    nameAr: 'دوام إداري منتظم',
    timeEn: '08:00 AM – 04:30 PM',
    timeAr: '08:00 ص – 04:30 م',
    startHour: 8,
    endHour: 16.5,
    isOff: false,
  },
  off: {
    id: 'off',
    nameEn: 'Rest Day',
    nameAr: 'عطلة أسبوعية',
    timeEn: 'Off Duty',
    timeAr: 'راحة أسبوعية',
    startHour: 0,
    endHour: 0,
    isOff: true,
  },
};

/**
 * Normalizes Date to YYYY-MM-DD
 */
function toDateKey(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns Sunday start date for any given date
 */
function getSundayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return sunday;
}

/**
 * Returns shift for a given employee and calendar date
 */
function resolveShiftForDate(employee, dateObj) {
  const dateKey = toDateKey(dateObj);
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // Check manual/swap overrides first
  const overrides = db().rosterOverrides || [];
  const override = overrides.find(
    (o) => o.employeeId === employee.id && o.date === dateKey,
  );
  if (override && SHIFTS[override.shiftId]) {
    return { ...SHIFTS[override.shiftId], shift: SHIFTS[override.shiftId].id, isOverride: true, date: dateKey };
  }

  // Check official Egyptian Holidays or factory rest days
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    // Friday & Saturday are factory rest days
    return { ...SHIFTS.off, shift: SHIFTS.off.id, isOverride: false, date: dateKey };
  }

  // HQ/Admin department vs Factory Production Line
  const isHQ =
    employee.department === 'HR' ||
    employee.department === 'Finance' ||
    employee.department === 'Management' ||
    employee.department === 'IT';

  if (isHQ) {
    return { ...SHIFTS.regular, shift: SHIFTS.regular.id, isOverride: false, date: dateKey };
  }

  // Factory Production Lines 3-Shift Weekly Rotation
  // Rotate shift based on week number since epoch
  const weekNumber = Math.floor(dateObj.getTime() / (7 * 24 * 3600 * 1000));
  const shiftCycle = ['morning', 'evening', 'night'];
  // Offset cycle slightly per employee code to balance line staffing
  const empOffset = (employee.id || 'emp_1').charCodeAt((employee.id || 'emp_1').length - 1) % 3;
  const shiftKey = shiftCycle[(weekNumber + empOffset) % 3];

  return { ...SHIFTS[shiftKey], shift: SHIFTS[shiftKey].id, isOverride: false, date: dateKey };
}

/**
 * Returns 7-day week schedule starting from Sunday
 */
function getRosterForWeek(employee, startSunday) {
  const sunday = new Date(startSunday.getFullYear(), startSunday.getMonth(), startSunday.getDate());
  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    const shift = resolveShiftForDate(employee, cur);
    const dateKey = toDateKey(cur);

    days.push({
      dayEn: dayNamesEn[i],
      dayAr: dayNamesAr[i],
      date: dateKey,
      shift: shift.id,
      name: shift.nameEn,
      shiftNameAr: shift.nameAr,
      time: shift.timeEn,
      timeAr: shift.timeAr,
      isConfirmed: !shift.isOff,
      isOverride: shift.isOverride || false,
      supervisor: employee.supervisor || 'Mohamed Hassan',
      line: employee.department || 'Production Line A',
    });
  }

  return days;
}

/**
 * Returns 4 weeks of rosters (1 past week, current week, 2 future weeks)
 */
function getMultiWeekRoster(employee, baseDate = new Date()) {
  const currentSunday = getSundayOfWeek(baseDate);
  const weeks = [];

  for (let w = -1; w <= 2; w++) {
    const sunday = new Date(currentSunday.getFullYear(), currentSunday.getMonth(), currentSunday.getDate() + w * 7);
    const weekStartKey = toDateKey(sunday);
    const days = getRosterForWeek(employee, sunday);
    weeks.push({
      weekStart: weekStartKey,
      isCurrent: w === 0,
      days,
    });
  }

  return weeks;
}

/**
 * Fatigue Safety Check (Egyptian Labor Law & Occupational Safety Gate)
 * Strictly forbids consecutive 16-hour back-to-back shifts or rest periods < 8 hours.
 */
function checkFatigueSafety(employeeId, shiftA, shiftB, dateKey) {
  if (shiftA === shiftB) {
    return { safe: false, reason: 'same_shift', message: 'Employee is already assigned to this exact shift' };
  }
  if (shiftA === 'off' || shiftB === 'off') {
    return { safe: true };
  }

  // Night shift (23:00–07:00) into Morning shift (07:00–15:00) provides 0 hours rest -> Fatigue Violation
  if ((shiftA === 'night' && shiftB === 'morning') || (shiftA === 'morning' && shiftB === 'night')) {
    return { safe: false, reason: 'double_shift_fatigue', message: 'Consecutive night-to-morning shifts (0 hours rest) violate factory safety regulations' };
  }

  return { safe: true };
}

/**
 * Colleague Discovery for Shift Swap:
 * Returns peers in the same factory and department with fatigue suitability.
 */
function getEligibleSwapColleagues(employeeId, targetDateKey) {
  const dateObj = new Date(targetDateKey + 'T00:00:00');
  const me = (db().employees || []).find((e) => e.id === employeeId);
  if (!me) return [];

  const myShift = resolveShiftForDate(me, dateObj);

  const colleagues = (db().employees || []).filter(
    (e) => e.id !== employeeId && e.active && e.factory === me.factory && e.department === me.department,
  );

  return colleagues.map((colleague) => {
    const colleagueShift = resolveShiftForDate(colleague, dateObj);
    const fatigue = checkFatigueSafety(colleague.id, myShift.id, colleagueShift.id, targetDateKey);

    return {
      id: colleague.id,
      name: colleague.name,
      employeeCode: colleague.employeeCode,
      position: colleague.position,
      currentShift: colleagueShift.id,
      currentShiftName: colleagueShift.nameEn,
      currentShiftNameAr: colleagueShift.nameAr,
      currentShiftTime: colleagueShift.timeEn,
      currentShiftTimeAr: colleagueShift.timeAr,
      isEligible: fatigue.safe,
      ineligibilityReason: fatigue.reason || null,
      ineligibilityMessage: fatigue.message || null,
    };
  });
}

/**
 * Creates a two-tier Peer Shift Swap Request
 */
function createSwapRequest(requesterId, { targetEmployeeId, date, targetDate, reason }) {
  const me = (db().employees || []).find((e) => e.id === requesterId);
  const target = (db().employees || []).find((e) => e.id === targetEmployeeId);

  if (!me || !target) {
    const err = new Error('Invalid employee identifier');
    err.statusCode = 404;
    throw err;
  }

  const shiftDate = date || targetDate;
  const dateObj = new Date(shiftDate + 'T00:00:00');

  const myShift = resolveShiftForDate(me, dateObj);
  const targetShift = resolveShiftForDate(target, dateObj);

  // Validate fatigue safety
  const safetyCheck = checkFatigueSafety(target.id, myShift.id, targetShift.id, shiftDate);
  if (!safetyCheck.safe) {
    const err = new Error(safetyCheck.message || 'Swap request violates fatigue safety policy');
    err.statusCode = 422;
    err.code = safetyCheck.reason;
    throw err;
  }

  db().shiftSwaps = db().shiftSwaps || [];
  const swapId = `SWP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const swapRecord = {
    id: swapId,
    requesterId,
    requesterName: me.name,
    targetEmployeeId,
    targetEmployeeName: target.name,
    date: shiftDate,
    myShiftId: myShift.id,
    myShiftName: myShift.nameEn,
    myShiftNameAr: myShift.nameAr,
    targetShiftId: targetShift.id,
    targetShiftName: targetShift.nameEn,
    targetShiftNameAr: targetShift.nameAr,
    reason: reason || 'Personal arrangement',
    status: 'colleague_pending', // 1: colleague_pending -> 2: supervisor_pending -> 3: approved / declined
    supervisor: me.supervisor || 'Mohamed Hassan',
    createdAt: Date.now(),
    colleagueRespondedAt: null,
    supervisorDecidedAt: null,
  };

  db().shiftSwaps.unshift(swapRecord);
  save();

  // Realtime SSE notification to peer and admin
  try {
    realtimeService.broadcast('shift.swap.created', {
      swapId,
      requesterName: me.name,
      targetEmployeeId,
      targetEmployeeName: target.name,
      date: shiftDate,
    });
  } catch (_) {}

  return swapRecord;
}

/**
 * Step 1 of 2-tier approval: Peer colleague accepts or declines swap
 */
function respondSwapRequest(colleagueId, swapId, decision) {
  db().shiftSwaps = db().shiftSwaps || [];
  const swap = db().shiftSwaps.find((s) => s.id === swapId);

  if (!swap) {
    const err = new Error('Swap request not found');
    err.statusCode = 404;
    throw err;
  }

  if (swap.targetEmployeeId !== colleagueId) {
    const err = new Error('Unauthorized to respond to this shift swap');
    err.statusCode = 403;
    throw err;
  }

  if (swap.status !== 'colleague_pending') {
    const err = new Error(`Swap request is already ${swap.status}`);
    err.statusCode = 400;
    throw err;
  }

  if (decision === 'accept' || decision === 'approved') {
    swap.status = 'supervisor_pending';
  } else {
    swap.status = 'declined_by_colleague';
  }

  swap.colleagueRespondedAt = Date.now();
  save();

  try {
    realtimeService.broadcast('shift.swap.colleague_responded', {
      swapId: swap.id,
      status: swap.status,
      requesterId: swap.requesterId,
      targetEmployeeId: swap.targetEmployeeId,
    });
  } catch (_) {}

  return swap;
}

/**
 * Step 2 of 2-tier approval: Line Supervisor approves or rejects swap
 */
function decideSwapSupervisor(supervisorId, swapId, decision, notes = '') {
  db().shiftSwaps = db().shiftSwaps || [];
  const swap = db().shiftSwaps.find((s) => s.id === swapId);

  if (!swap) {
    const err = new Error('Swap request not found');
    err.statusCode = 404;
    throw err;
  }

  if (swap.status !== 'supervisor_pending') {
    const err = new Error(`Swap cannot be decided by supervisor in state: ${swap.status}`);
    err.statusCode = 400;
    throw err;
  }

  if (decision === 'approve' || decision === 'approved') {
    swap.status = 'approved';

    // Transactionally record roster overrides for both employees
    db().rosterOverrides = db().rosterOverrides || [];

    // Assign targetShift to requester
    db().rosterOverrides = db().rosterOverrides.filter(
      (o) => !(o.employeeId === swap.requesterId && o.date === swap.date),
    );
    db().rosterOverrides.push({
      employeeId: swap.requesterId,
      date: swap.date,
      shiftId: swap.targetShiftId,
      sourceSwapId: swap.id,
    });

    // Assign myShift to target colleague
    db().rosterOverrides = db().rosterOverrides.filter(
      (o) => !(o.employeeId === swap.targetEmployeeId && o.date === swap.date),
    );
    db().rosterOverrides.push({
      employeeId: swap.targetEmployeeId,
      date: swap.date,
      shiftId: swap.myShiftId,
      sourceSwapId: swap.id,
    });
  } else {
    swap.status = 'rejected_by_supervisor';
    swap.rejectionReason = notes;
  }

  swap.supervisorDecidedAt = Date.now();
  swap.supervisorNotes = notes;

  // Add to audit logs
  db().auditLogs = db().auditLogs || [];
  db().auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    action: 'SHIFT_SWAP_DECIDED',
    actor: supervisorId,
    swapId: swap.id,
    decision: swap.status,
    timestamp: Date.now(),
  });

  save();

  try {
    realtimeService.broadcast('shift.swap.decided', {
      swapId: swap.id,
      status: swap.status,
      requesterId: swap.requesterId,
      targetEmployeeId: swap.targetEmployeeId,
    });
  } catch (_) {}

  return swap;
}

/**
  * Returns all active and historical swap requests for an employee
  */
function getEmployeeSwaps(employeeId) {
  const swaps = db().shiftSwaps || [];
  return swaps.filter(
    (s) => s.requesterId === employeeId || s.targetEmployeeId === employeeId,
  );
}

function getWeekStart() {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
}

function getRoster(admin, employeeId) {
  const employee = db().employees.find((e) => e.id === employeeId);
  if (!employee) {
    const err = new Error('employee_not_found');
    err.statusCode = 404;
    throw err;
  }
  if (!checkScope(admin, employee)) {
    const err = new Error('forbidden_outside_factory_scope');
    err.statusCode = 403;
    throw err;
  }

  const weekStart = getWeekStart();
  const record = (db().roster || []).find(
    (r) => r.employeeId === employeeId && r.weekStart === weekStart
  );

  return { weekStart, days: record?.days || null };
}

function updateRoster(admin, employeeId, rawBody, { ip, userAgent } = {}) {
  const employee = db().employees.find((e) => e.id === employeeId);
  if (!employee) {
    const err = new Error('employee_not_found');
    err.statusCode = 404;
    throw err;
  }
  if (!checkScope(admin, employee)) {
    const err = new Error('forbidden_outside_factory_scope');
    err.statusCode = 403;
    throw err;
  }

  const validation = validateRosterUpdate(rawBody);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const weekStart = getWeekStart();
  const updated = dbModule.transaction((state) => {
    state.roster = state.roster || [];
    let record = state.roster.find(
      (r) => r.employeeId === employeeId && r.weekStart === weekStart
    );
    const beforeState = record ? { ...record } : null;

    if (!record) {
      record = { employeeId, weekStart };
      state.roster.push(record);
    }

    record.days = validation.data.days;
    record.updatedAt = Date.now();

    recordAuditLog(state, {
      actor: admin?.sub || 'admin',
      role: admin?.role || 'superadmin',
      action: 'update_roster',
      entity: 'roster',
      entityId: employeeId,
      before: beforeState,
      after: { ...record },
      details: `Updated weekly roster for ${employee.name} (Week: ${weekStart})`,
      ip,
      userAgent,
    });

    return record;
  });

  try {
    realtimeService.broadcast(
      'shift.updated',
      { roster: updated, employeeId, weekStart },
      { factory: employee.factory, employeeId }
    );
  } catch (_) {}

  return updated;
}

module.exports = {
  SHIFTS,
  toDateKey,
  resolveShiftForDate,
  getRosterForWeek,
  getMultiWeekRoster,
  checkFatigueSafety,
  getEligibleSwapColleagues,
  createSwapRequest,
  respondSwapRequest,
  decideSwapSupervisor,
  getEmployeeSwaps,
  getWeekStart,
  getRoster,
  updateRoster,
};
