// Employee-facing API: auth (OTP + PIN), profile, requests, inbox, content.
const express = require('express');
const { data: db, save, nextId } = require('../db');
const {
  createOtp,
  verifyOtp,
  hash,
  verifyHash,
  signToken,
  verifyToken,
  requireAuth,
} = require('../auth');
const { guard, registerFailure, clearFailures } = require('../rateLimit');
const twilio = require('../twilio');
const fcm = require('../fcm');
const { notify } = require('../notify');

const router = express.Router();
const isDev = process.env.NODE_ENV !== 'production';

function publicEmployee(e) {
  return {
    id: e.id,
    name: e.name,
    nationalId: e.nationalId,
    employeeCode: e.employeeCode,
    factory: e.factory,
    department: e.department,
    position: e.position,
    supervisor: e.supervisor,
    phone: e.phone,
    vacationBalance: e.vacationBalance,
    hasPin: !!e.pinHash,
  };
}

function myRequests(db, employeeId) {
  return db.requests
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---------- App Version / Force Update (Public) ----------
router.get(['/app/version', '/app-version'], (req, res) => {
  const config = db().appVersionConfig || {
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    currentVersion: '1.0.0',
    forceUpdate: false,
    title: 'تحديث جديد متوفر',
    titleEn: 'Update Available',
    message: 'يتوفر إصدار جديد من تطبيق العربي كونكت. يرجى التحديث لمتابعة استخدام التطبيق بكفاءة وأمان.',
    messageEn: 'A new version of Elaraby Connect is available. Please update to continue using the application securely.',
    updateUrl: 'https://server-six-xi-42.vercel.app',
  };
  res.json(config);
});

// ---------- Auth ----------
router.post('/auth/otp', async (req, res) => {
  const { nationalId, phone, identifier } = req.body || {};
  const query = String(identifier || nationalId || phone || '').trim();
  const digits = query.replace(/\D/g, '');

  if (digits.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid National ID or Phone Number' });
  }

  const employee = db().employees.find((e) => {
    if (!e.active) return false;
    const empNat = String(e.nationalId || '').replace(/\D/g, '');
    const empPhone = String(e.phone || '').replace(/\D/g, '');
    return empNat === digits ||
           empPhone === digits ||
           empPhone.endsWith(digits) ||
           (digits.length >= 10 && empPhone.includes(digits.slice(-10)));
  });

  if (!employee) {
    return res.json({ found: false });
  }

  const effectiveNationalId = employee.nationalId;
  if (guard(db(), `otp:${effectiveNationalId}`, res)) return;
  if (guard(db(), `otp_ip:${req.ip}`, res)) return;
  registerFailure(db(), `otp_ip:${req.ip}`);

  const code = createOtp(db(), effectiveNationalId);
  clearFailures(db(), `otp_ip:${req.ip}`);

  // Record in audit logs so HR admin can always see active OTP in real time
  db().auditLogs = db().auditLogs || [];
  db().auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    action: 'OTP_REQUESTED',
    details: `Verification code generated for ${employee.name} (${effectiveNationalId}) [Phone: ${employee.phone}]: ${code}`,
    admin: 'SYSTEM',
    ip: req.ip,
    timestamp: Date.now(),
  });
  if (db().auditLogs.length > 500) db().auditLogs.length = 500;
  save();

  // Twilio configured -> real SMS (code never leaves the server).
  // Otherwise dev mode: return the code so the emulator flow works.
  const smsSent = await twilio.sendSms(
    employee.phone,
    `Elaraby Connect: your verification code is ${code}. It expires in 5 minutes.`,
  );

  // Mask phone for user feedback: e.g. "+20 122 ••••• 79"
  const rawPhone = String(employee.phone || '').trim();
  let maskedPhone = rawPhone;
  const digitsOnly = rawPhone.replace(/\D/g, '');
  if (digitsOnly.length >= 10) {
    const prefix = rawPhone.startsWith('+') ? rawPhone.slice(0, 3) + ' ' : '';
    const part1 = digitsOnly.slice(-10, -7);
    const part2 = digitsOnly.slice(-2);
    maskedPhone = `${prefix}${part1} ••••• ${part2}`;
  }

  res.json({
    found: true,
    hasPin: !!employee.pinHash,
    phone: employee.phone,
    maskedPhone,
    employeeName: employee.name,
    smsSent: !!smsSent,
    ...(isDev || !smsSent ? { devCode: code } : {}),
  });
});

router.post('/auth/otp/verify', (req, res) => {
  const { nationalId, code } = req.body || {};
  if (guard(db(), `otp_verify:${nationalId}`, res)) return;
  const employee = db().employees.find((e) => e.nationalId === nationalId);
  if (!employee || !employee.active) return res.status(404).json({ error: 'not_found' });
  if (!verifyOtp(db(), nationalId, String(code || ''))) {
    const lockedForSecs = registerFailure(db(), `otp_verify:${nationalId}`);
    if (lockedForSecs > 0) {
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: lockedForSecs });
    }
    return res.status(401).json({ error: 'invalid_code' });
  }
  clearFailures(db(), `otp_verify:${nationalId}`);
  clearFailures(db(), `otp:${nationalId}`);
  const resetToken = signToken({ sub: employee.id, nationalId: employee.nationalId, scope: 'pin_reset' });
  save();
  res.json({ ok: true, employee: publicEmployee(employee), resetToken });
});

router.post('/auth/pin', (req, res) => {
  const { nationalId, pin, resetToken } = req.body || {};
  if (!/^\d{4}$/.test(String(pin || ''))) {
    return res.status(400).json({ error: 'pin_must_be_4_digits' });
  }
  const employee = db().employees.find((e) => e.nationalId === nationalId);
  if (!employee) return res.status(404).json({ error: 'not_found' });

  // Security guard: If PIN is already set, require valid pin_reset token or employee auth
  if (employee.pinHash) {
    const authHeader = req.headers.authorization;
    const token = resetToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
    const verified = token ? verifyToken(token) : null;
    if (!verified || (verified.sub !== employee.id && verified.nationalId !== employee.nationalId)) {
      return res.status(403).json({ error: 'pin_already_set_requires_verification' });
    }
  }

  employee.pinHash = hash(pin);
  save();
  res.json({ ok: true });
});

router.post('/auth/pin/verify', (req, res) => {
  const { nationalId, pin } = req.body || {};
  if (guard(db(), `pin:${nationalId}`, res)) return;
  const employee = db().employees.find((e) => e.nationalId === nationalId);
  if (!employee || !employee.active || !employee.pinHash) {
    return res.status(401).json({ error: 'invalid_pin' });
  }
  if (!verifyHash(pin, employee.pinHash)) {
    const lockedForSecs = registerFailure(db(), `pin:${nationalId}`);
    if (lockedForSecs > 0) {
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: lockedForSecs });
    }
    return res.status(401).json({ error: 'invalid_pin' });
  }
  clearFailures(db(), `pin:${nationalId}`);
  const token = signToken({ sub: employee.id, scope: 'employee' });
  res.json({ ok: true, token, employee: publicEmployee(employee) });
});

router.post('/auth/pin/change', requireAuth, (req, res) => {
  const { currentPin, newPin } = req.body || {};
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (guard(db(), `pin_change:${req.employeeId}`, res)) return;
  if (!employee || !verifyHash(String(currentPin || ''), employee.pinHash)) {
    const lockedForSecs = registerFailure(db(), `pin_change:${req.employeeId}`);
    if (lockedForSecs > 0) {
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: lockedForSecs });
    }
    return res.status(401).json({ error: 'invalid_pin' });
  }
  clearFailures(db(), `pin_change:${req.employeeId}`);
  if (!/^\d{4}$/.test(String(newPin || ''))) {
    return res.status(400).json({ error: 'pin_must_be_4_digits' });
  }
  employee.pinHash = hash(newPin);
  save();
  res.json({ ok: true });
});

// ---------- Profile ----------
router.get('/me', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee) return res.status(404).json({ error: 'not_found' });
  res.json({ employee: publicEmployee(employee) });
});

// ---------- Shift Presets & Resolution ----------
const SHIFT_PRESETS = {
  morning: {
    time: '07:00 AM – 03:00 PM',
    timeEn: '07:00 AM – 03:00 PM',
    timeAr: '07:00 ص – 03:00 م',
    name: 'Morning Shift',
    nameEn: 'Morning Shift',
    nameAr: 'الوردية الأولى (صباحية)',
    offDuty: false,
  },
  evening: {
    time: '03:00 PM – 11:00 PM',
    timeEn: '03:00 PM – 11:00 PM',
    timeAr: '03:00 م – 11:00 م',
    name: 'Evening Shift',
    nameEn: 'Evening Shift',
    nameAr: 'الوردية الثانية (مسائية)',
    offDuty: false,
  },
  night: {
    time: '11:00 PM – 07:00 AM',
    timeEn: '11:00 PM – 07:00 AM',
    timeAr: '11:00 م – 07:00 ص',
    name: 'Night Shift',
    nameEn: 'Night Shift',
    nameAr: 'الوردية الثالثة (ليلية)',
    offDuty: false,
  },
  office: {
    time: '08:30 AM – 04:30 PM',
    timeEn: '08:30 AM – 04:30 PM',
    timeAr: '08:30 ص – 04:30 م',
    name: 'Office Hours',
    nameEn: 'Office Hours',
    nameAr: 'الدوام الإداري العام',
    offDuty: false,
  },
  off: {
    time: 'Rest Day',
    timeEn: 'Rest Day',
    timeAr: 'عطلة أسبوعية',
    name: 'Off Duty',
    nameEn: 'Off Duty',
    nameAr: 'يوم راحة أسبوعية',
    offDuty: true,
  },
};

function currentWeekStartKey() {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
}

function resolveEmployeeShiftForDay(employee, dayIndex, customShift) {
  let shiftKey = customShift;
  if (!shiftKey) {
    const isRestDay = dayIndex === 5 || dayIndex === 6; // Friday or Saturday
    if (isRestDay) {
      shiftKey = 'off';
    } else {
      const isPR = String(employee?.department || '').includes('Public Relations') ||
                   String(employee?.department || '').includes('العلاقات العامة');
      shiftKey = isPR ? 'office' : 'morning';
    }
  }
  const preset = SHIFT_PRESETS[shiftKey] || SHIFT_PRESETS.morning;
  const lineText = employee
    ? `${employee.factory || 'Elaraby Group'} • ${employee.department || 'Operations'}`
    : 'Elaraby Workforce';

  return {
    shiftKey,
    name: preset.nameEn,
    shiftName: preset.nameEn,
    shiftNameAr: preset.nameAr,
    time: preset.timeEn,
    timeEn: preset.timeEn,
    timeAr: preset.timeAr,
    line: lineText,
    lineAr: lineText,
    offDuty: preset.offDuty,
  };
}

function resolveTodayShift(employee) {
  if (!employee) return null;
  const now = new Date();
  const dayIndex = now.getDay();
  const weekStart = currentWeekStartKey();
  const rosterList = db().roster || [];
  const record = rosterList.find(
    (r) => r.employeeId === employee.id && (r.weekStart === weekStart || !r.weekStart),
  );
  const customShift = record?.days?.find((d) => d.dayIndex === dayIndex)?.shift;
  return {
    ...resolveEmployeeShiftForDay(employee, dayIndex, customShift),
    date: now.toISOString().slice(0, 10),
    dayIndex,
  };
}

function resolveWeekRoster(employee, record) {
  const now = new Date();
  const dayIndexToday = now.getDay();
  return Array.from({ length: 7 }).map((_, i) => {
    const customShift = record?.days?.find((d) => d.dayIndex === i)?.shift;
    const resolved = resolveEmployeeShiftForDay(employee, i, customShift);
    return {
      dayIndex: i,
      shift: resolved.shiftKey,
      ...resolved,
      isToday: i === dayIndexToday,
    };
  });
}

// ---------- Home ----------
router.get('/home', requireAuth, (req, res) => {
  const me = db().employees.find((e) => e.id === req.employeeId);
  const announcement = [...db().announcements].sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  const news = [...db().news].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const todayShift = resolveTodayShift(me);
  res.json({
    announcement,
    news,
    metrics: { vacationBalance: me ? me.vacationBalance : 0 },
    todayShift,
  });
});

// ---------- Requests ----------
router.get('/requests', requireAuth, (req, res) => {
  res.json({ requests: myRequests(db(), req.employeeId) });
});

router.post('/requests', requireAuth, (req, res) => {
  const { type, title, details, days } = req.body || {};
  if (!type || !title) return res.status(400).json({ error: 'type_and_title_required' });
  const me = db().employees.find((e) => e.id === req.employeeId);
  const ref = `REQ-2026-${nextId('request')}`;

  const requested = Number(days ?? details?.days) || 0;
  const isAnnualLeave = type === 'Leave' && (
    details?.leaveType === 'Annual Leave' ||
    details?.leaveType === 'annual' ||
    String(title).toLowerCase().includes('annual leave')
  );

  // Annual leave deducts the balance immediately and is rejected if exceeded.
  if (isAnnualLeave) {
    if (requested > (me?.vacationBalance ?? 0)) {
      return res.status(422).json({ error: 'exceeds_balance' });
    }
    if (me && requested > 0) me.vacationBalance -= requested;
  }

  const request = {
    id: `req_${ref}`,
    employeeId: req.employeeId,
    type,
    title,
    refNumber: ref,
    status: 'inReview',
    summary: 'Waiting on: Line Manager Approval',
    details: {
      ...(details || {}),
      ...(requested > 0 ? { days: requested } : {}),
      ...(isAnnualLeave && !details?.leaveType ? { leaveType: 'Annual Leave' } : {}),
    },
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: Date.now(),
  };
  db().requests.push(request);
  save();
  res.json({ request, vacationBalance: me?.vacationBalance });
});

router.post('/requests/:id/cancel', requireAuth, (req, res) => {
  const request = db().requests.find(
    (r) => r.id === req.params.id && r.employeeId === req.employeeId,
  );
  if (!request) return res.status(404).json({ error: 'not_found' });
  if (request.status !== 'inReview') {
    return res.status(422).json({ error: 'only_in_review_can_be_cancelled' });
  }
  // Annual leave refunds the balance when cancelled.
  const isAnnualLeave = request.type === 'Leave' && (
    request.details?.leaveType === 'Annual Leave' ||
    request.details?.leaveType === 'annual' ||
    String(request.title).toLowerCase().includes('annual leave')
  );
  if (isAnnualLeave) {
    const me = db().employees.find((e) => e.id === req.employeeId);
    const days = Number(request.details?.days) || 0;
    if (me && days > 0) me.vacationBalance += days;
  }
  db().requests = db().requests.filter((r) => r.id !== request.id);
  save();
  res.json({ ok: true });
});

// ---------- Inbox ----------
router.get('/inbox', requireAuth, (req, res) => {
  const notifications = db()
    .notifications.filter((n) => n.employeeId === req.employeeId)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
});

router.post('/inbox/read', requireAuth, (req, res) => {
  const ids = new Set(req.body?.ids || []);
  for (const n of db().notifications) {
    if (n.employeeId === req.employeeId && (ids.size === 0 || ids.has(n.id))) {
      n.read = true;
    }
  }
  save();
  res.json({ ok: true });
});

// ---------- Payroll ----------
router.get('/payroll', requireAuth, (req, res) => {
  const record = db().payroll.find((p) => p.employeeId === req.employeeId);
  // Default demo statement until HR publishes one from the dashboard.
  res.json({
    payroll: record || {
      period: 'July 2026',
      basicSalary: 7000,
      allowances: 950,
      deductions: 200,
      paidOn: 'Jul 28, 2026',
      paymentMethod: 'Bank Transfer (CIB)',
    },
  });
});

// ---------- Roster (current week, Sunday-based) ----------
router.get('/roster', requireAuth, (req, res) => {
  const me = db().employees.find((e) => e.id === req.employeeId);
  const weekStart = currentWeekStartKey();
  const record = (db().roster || []).find(
    (r) => r.employeeId === req.employeeId && (r.weekStart === weekStart || !r.weekStart),
  );
  const days = resolveWeekRoster(me, record);
  const todayShift = resolveTodayShift(me);
  res.json({ weekStart, days, todayShift });
});

// ---------- Push tokens ----------
router.post('/fcm-token', requireAuth, (req, res) => {
  const token = String(req.body?.token || '');
  if (!token) return res.status(400).json({ error: 'token_required' });
  const dbd = db();
  dbd.fcmTokens = (dbd.fcmTokens || []).filter(
    (t) => !(t.employeeId === req.employeeId && t.token === token),
  );
  dbd.fcmTokens.push({ employeeId: req.employeeId, token, updatedAt: Date.now() });
  save();
  res.json({ ok: true, pushEnabled: fcm.isConfigured() });
});

// ---------- Benefits & trips ----------
router.get('/benefits', requireAuth, (req, res) => {
  res.json({ benefits: db().benefits, trips: db().trips });
});

router.post('/trips/:id/book', requireAuth, (req, res) => {
  const trip = db().trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'not_found' });
  const me = db().employees.find((e) => e.id === req.employeeId);
  const already = trip.bookedBy?.includes(req.employeeId);
  if (!already) {
    if (trip.bookedSeats >= trip.totalSeats) {
      return res.status(422).json({ error: 'trip_full' });
    }
    trip.bookedSeats = (trip.bookedSeats || 0) + 1;
    trip.bookedBy = [...(trip.bookedBy || []), req.employeeId];
    notify({
      employeeId: req.employeeId,
      title: 'Trip seat confirmed',
      body: `Your seat for "${trip.title}" is confirmed. Check trip details for departure info.`,
    });
    save();
  }
  res.json({ ok: true, trip, bookedFor: me?.name });
});

router.post('/trips/:id/unbook', requireAuth, (req, res) => {
  const trip = db().trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'not_found' });
  if (trip.bookedBy?.includes(req.employeeId)) {
    trip.bookedBy = trip.bookedBy.filter((id) => id !== req.employeeId);
    trip.bookedSeats = Math.max(0, (trip.bookedSeats || 1) - 1);
    save();
  }
  res.json({ ok: true, trip });
});

// ---------- Account deletion / Deactivation (Apple Guideline 5.1.1(v) & Google Play compliance) ----------
router.post('/employee/delete-account', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee) return res.status(404).json({ error: 'employee_not_found' });

  employee.deletionRequested = true;
  employee.deletionRequestedAt = Date.now();
  employee.pinHash = null; // revoke credentials

  // Revoke FCM tokens
  if (db().fcmTokens) {
    db().fcmTokens = db().fcmTokens.filter((t) => t.employeeId !== req.employeeId);
  }

  // Record audit log
  if (!db().auditLogs) db().auditLogs = [];
  db().auditLogs.unshift({
    id: nextId('audit'),
    timestamp: Date.now(),
    actor: `employee:${employee.employeeCode}`,
    action: 'account_deletion_requested',
    targetId: employee.id,
    details: `Employee ${employee.name} (${employee.employeeCode}) requested account erasure`,
    ip: req.ip,
  });

  save();
  res.json({ ok: true, message: 'Account deletion request processed' });
});

module.exports = router;
