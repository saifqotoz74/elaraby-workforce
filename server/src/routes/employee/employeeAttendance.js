// Employee Sub-Router: Attendance, Roster & Shifts
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { data: db, save, nextId, transaction, indexes } = require('../../db');
const {
  createOtp,
  verifyOtp,
  hash,
  verifyHash,
  signToken,
  verifyToken,
  requireAuth,
} = require('../../auth');
const { guard, registerFailure, clearFailures } = require('../../rateLimit');
const twilio = require('../../twilio');
const fcm = require('../../fcm');
const { notify } = require('../../notify');
const { broadcast, subscribe } = require('../../services/realtimeService');
const payrollService = require('../../services/payrollService');
const loanService = require('../../services/loanService');
const uploadService = require('../../services/uploadService');
const shiftService = require('../../services/shiftService');
const overtimeService = require('../../services/overtimeService');
const attendanceService = require('../../services/attendanceService');
const transportService = require('../../services/transportService');
const analyticsAggregationService = require('../../services/analyticsAggregationService');
const { calculateWorkingDays } = require('../../utils/holidays');
const kioskService = require('../../services/kioskService');
const hseService = require('../../services/hseService');
const incentivesDeductionsService = require('../../services/incentivesDeductionsService');
const isDev = process.env.NODE_ENV !== 'production';
const {
  currentWeekStartKey,
  resolveWeekRoster,
  resolveTodayShift,
  SHIFT_PRESETS,
} = require('./shiftHelpers');

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

// ---------- Extended Multi-Week Roster ----------
router.get('/shifts/roster', requireAuth, (req, res) => {
  const me = db().employees.find((e) => e.id === req.employeeId);
  if (!me) return res.status(404).json({ error: 'employee_not_found' });
  const weeks = shiftService.getMultiWeekRoster(me);
  const todayShift = shiftService.resolveShiftForDate(me, new Date());
  res.json({ weeks, todayShift });
});

// ---------- Shift Swap Peer Discovery ----------
router.get('/shifts/colleagues', requireAuth, (req, res) => {
  const date = req.query.date || shiftService.toDateKey(new Date());
  const colleagues = shiftService.getEligibleSwapColleagues(req.employeeId, date);
  res.json({ date, colleagues });
});

// ---------- Shift Swaps: Create & Peer Response ----------
router.post('/shifts/swap', requireAuth, (req, res) => {
  try {
    const swap = shiftService.createSwapRequest(req.employeeId, req.body);
    res.status(201).json({ ok: true, swap });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message, code: err.code });
  }
});

router.post('/shifts/swap/:id/respond', requireAuth, (req, res) => {
  try {
    const swap = shiftService.respondSwapRequest(req.employeeId, req.params.id, req.body.decision);
    res.json({ ok: true, swap });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

router.get('/shifts/swaps', requireAuth, (req, res) => {
  const swaps = shiftService.getEmployeeSwaps(req.employeeId);
  res.json({ swaps });
});

// ---------- Overtime Engine Endpoints ----------
router.post('/overtime/claim', requireAuth, (req, res) => {
  try {
    const claim = overtimeService.createOvertimeClaim(req.employeeId, req.body);
    res.status(201).json({ ok: true, claim });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

router.get('/overtime/claims', requireAuth, (req, res) => {
  const claims = overtimeService.getEmployeeOvertimeClaims(req.employeeId);
  res.json({ claims });
});

router.get('/overtime/preview', requireAuth, (req, res) => {
  const me = db().employees.find((e) => e.id === req.employeeId);
  const calculation = overtimeService.calculateOvertimePay({
    hours: req.query.hours || 1,
    date: req.query.date || shiftService.toDateKey(new Date()),
    timePeriod: req.query.timePeriod || 'day',
    hourlyRate: me?.hourlyRate || 40,
  });
  res.json({ calculation });
});

// ---------- Factory Attendance & QR Punch Endpoints ----------
router.post('/attendance/punch', requireAuth, (req, res) => {
  try {
    const punch = attendanceService.recordPunch(req.employeeId, req.body);
    analyticsAggregationService.invalidateCache(req.tenantId || req.user?.tenantId);
    res.status(201).json({ ok: true, punch });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

router.post('/attendance/bulk-sync', requireAuth, (req, res) => {
  try {
    const punches = Array.isArray(req.body) ? req.body : (req.body?.punches || []);
    const result = attendanceService.bulkSyncPunches(req.employeeId, punches);
    analyticsAggregationService.invalidateCache(req.tenantId || req.user?.tenantId);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

router.get('/attendance/today', requireAuth, (req, res) => {
  const state = attendanceService.getTodayPunchState(req.employeeId, req.query.date);
  res.json(state);
});

// ---------- Push tokens ----------

module.exports = router;
