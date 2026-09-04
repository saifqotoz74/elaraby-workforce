// Employee-facing API: auth (OTP + PIN), profile, requests, inbox, content.
const express = require('express');
const { data: db, save, nextId } = require('../db');
const {
  createOtp,
  verifyOtp,
  hash,
  verifyHash,
  signToken,
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

// ---------- Auth ----------
router.post('/auth/otp', async (req, res) => {
  const { nationalId } = req.body || {};
  if (!/^\d{14}$/.test(String(nationalId || ''))) {
    return res.status(400).json({ error: 'National ID must be 14 digits' });
  }
  if (guard(db(), `otp:${nationalId}`, res)) return;
  if (guard(db(), `otp_ip:${req.ip}`, res)) return;
  registerFailure(db(), `otp_ip:${req.ip}`);
  const employee = db().employees.find((e) => e.nationalId === nationalId);
  if (!employee || !employee.active) {
    return res.json({ found: false });
  }
  const code = createOtp(db(), nationalId);
  clearFailures(db(), `otp_ip:${req.ip}`);
  save();

  // Twilio configured -> real SMS (code never leaves the server).
  // Otherwise dev mode: return the code so the emulator flow works.
  const smsSent = await twilio.sendSms(
    employee.phone,
    `Elaraby Connect: your verification code is ${code}. It expires in 5 minutes.`,
  );
  if (smsSent) {
    return res.json({ found: true, hasPin: !!employee.pinHash, smsSent: true });
  }
  res.json({ found: true, hasPin: !!employee.pinHash, ...(isDev ? { devCode: code } : {}) });
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
  save();
  res.json({ ok: true, employee: publicEmployee(employee) });
});

router.post('/auth/pin', (req, res) => {
  const { nationalId, pin } = req.body || {};
  if (!/^\d{4}$/.test(String(pin || ''))) {
    return res.status(400).json({ error: 'pin_must_be_4_digits' });
  }
  const employee = db().employees.find((e) => e.nationalId === nationalId);
  if (!employee) return res.status(404).json({ error: 'not_found' });
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

// ---------- Home ----------
router.get('/home', requireAuth, (req, res) => {
  const me = db().employees.find((e) => e.id === req.employeeId);
  const announcement = [...db().announcements].sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  const news = [...db().news].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  res.json({
    announcement,
    news,
    metrics: { vacationBalance: me ? me.vacationBalance : 0 },
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

  // Annual leave deducts the balance immediately and is rejected if exceeded.
  if (type === 'Leave' && details?.leaveType === 'Annual Leave') {
    const requested = Number(days) || 0;
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
    details: details || {},
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
  if (request.type === 'Leave' && request.details?.leaveType === 'Annual Leave') {
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
const SHIFT_PRESETS = {
  morning: { time: '06:00 AM – 02:00 PM', name: 'Morning Shift', offDuty: false },
  evening: { time: '02:00 PM – 10:00 PM', name: 'Evening Shift', offDuty: false },
  night: { time: '10:00 PM – 06:00 AM', name: 'Night Shift', offDuty: false },
  off: { time: 'Rest Day', name: 'Off Duty', offDuty: true },
};

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
function currentWeekStartKey() {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
}

router.get('/roster', requireAuth, (req, res) => {
  const weekStart = currentWeekStartKey();
  const record = db().roster.find(
    (r) => r.employeeId === req.employeeId && r.weekStart === weekStart,
  );
  const days = record
    ? record.days.map((d) => ({ shift: d.shift, ...SHIFT_PRESETS[d.shift] }))
    : null;
  res.json({ weekStart, days }); // days == null -> app uses its default pattern
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
