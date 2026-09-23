// Employee Sub-Router: Transport Fleet, Realtime SSE, Kiosk & HSE
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

router.get('/transport/my-commute', requireAuth, (req, res) => {
  try {
    const commute = transportService.getEmployeeCommute(req.employeeId);
    res.json(commute);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/transport/routes', requireAuth, (req, res) => {
  try {
    const { factory, shift } = req.query;
    const routes = transportService.getRoutes({ factory, shift });
    res.json({ routes });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/select-stop', requireAuth, (req, res) => {
  try {
    const { routeId, stopId } = req.body || {};
    if (!routeId || !stopId) {
      return res.status(400).json({ error: 'routeId_and_stopId_required' });
    }
    const result = transportService.selectPickupStop(req.employeeId, { routeId, stopId });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/request-transfer', requireAuth, (req, res) => {
  try {
    const { targetRouteId, targetStopId, date, reason } = req.body || {};
    if (!targetRouteId) {
      return res.status(400).json({ error: 'targetRouteId_required' });
    }
    const transfer = transportService.requestRouteTransfer(req.employeeId, {
      targetRouteId,
      targetStopId,
      date,
      reason,
    });
    res.json({ ok: true, transfer });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/transport/boarding-pass', requireAuth, (req, res) => {
  try {
    const pass = transportService.generateBoardingPass(req.employeeId);
    res.json(pass);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/report-incident', requireAuth, (req, res) => {
  try {
    const { routeId, type, message, delayMinutes } = req.body || {};
    if (!routeId || !message) {
      return res.status(400).json({ error: 'routeId_and_message_required' });
    }
    const me = (db().employees || []).find((e) => e.id === req.employeeId);
    const alert = transportService.reportRouteAlert({
      routeId,
      type,
      message,
      delayMinutes,
      reportedBy: me?.name || 'Employee Passenger',
    });
    res.json({ ok: true, alert });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/transport/alerts', requireAuth, (req, res) => {
  try {
    const { routeId } = req.query;
    const alerts = transportService.getActiveAlerts(routeId);
    res.json({ alerts });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/opt-out', requireAuth, (req, res) => {
  try {
    const { optOut } = req.body || {};
    const result = transportService.toggleCommuteOptOut(req.employeeId, { optOut });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/transport/proximity-status', requireAuth, (req, res) => {
  try {
    const status = transportService.getProximityStatus(req.employeeId);
    res.json(status);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------- Driver Cockpit & In-Vehicle Controls ----------
router.get('/transport/driver/manifest', requireAuth, (req, res) => {
  try {
    const { routeId } = req.query;
    const targetRouteId = routeId || transportService.getEmployeeAssignment(req.employeeId)?.assignedRouteId || 'route_101';
    const manifest = transportService.getRouteManifest(targetRouteId);
    res.json(manifest);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/driver/board-manual', requireAuth, (req, res) => {
  try {
    const { employeeId, routeId } = req.body || {};
    if (!employeeId || !routeId) {
      return res.status(400).json({ error: 'employeeId_and_routeId_required' });
    }
    const boarding = transportService.manualBoardPassenger(req.employeeId, { employeeId, routeId });
    res.json({ ok: true, boarding });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/driver/depart-stop', requireAuth, (req, res) => {
  try {
    const { routeId, stopId } = req.body || {};
    if (!routeId || !stopId) {
      return res.status(400).json({ error: 'routeId_and_stopId_required' });
    }
    const result = transportService.advanceStopDeparture(req.employeeId, { routeId, stopId });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/driver/complete-run', requireAuth, (req, res) => {
  try {
    const { routeId } = req.body || {};
    if (!routeId) {
      return res.status(400).json({ error: 'routeId_required' });
    }
    const result = transportService.completeRouteArrival(req.employeeId, { routeId });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------- Realtime SSE Event Stream ----------
router.get('/realtime/stream', (req, res) => {
  const header = req.headers.authorization || '';
  const queryToken = req.query.token;
  const token = header.startsWith('Bearer ') ? header.slice(7) : queryToken;
  const payload = verifyToken(token);
  if (!payload || payload.scope !== 'employee') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  subscribe(req, res, payload);
});

// ---------- Kiosk ----------
// GET /api/employee/kiosk/overview
router.get('/kiosk/overview', requireAuth, async (req, res) => {
  try {
    const me = req.employee || db().employees.find((e) => e.id === req.employeeId);
    const employeeCode = me?.employeeCode || '';
    const overview = await kioskService.getKioskOverview(employeeCode);
    res.json({ success: true, data: overview });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

// POST /api/employee/kiosk/stoppage
router.post('/kiosk/stoppage', requireAuth, async (req, res) => {
  try {
    const me = req.employee || db().employees.find((e) => e.id === req.employeeId);
    const employeeCode = me?.employeeCode || '';
    const { machineId, reason } = req.body;
    if (!machineId || !reason) return res.status(400).json({ success: false, message: 'machineId and reason required' });
    const result = await kioskService.reportStoppage(machineId, reason, employeeCode);
    res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

// POST /api/employee/kiosk/resolve-stoppage
router.post('/kiosk/resolve-stoppage', requireAuth, async (req, res) => {
  try {
    const { machineId } = req.body;
    if (!machineId) return res.status(400).json({ success: false, message: 'machineId required' });
    const result = await kioskService.resolveStoppage(machineId);
    res.json({ success: true, data: result });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

// ---------- HSE Safety Routes ----------
router.get('/hse/summary', requireAuth, async (req, res) => {
  try {
    const summary = await hseService.getHseSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

router.get('/hse/permits', requireAuth, async (req, res) => {
  try {
    const permits = await hseService.listPermits({ employeeId: req.employeeId });
    res.json({ success: true, data: permits });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

router.post('/hse/permits', requireAuth, async (req, res) => {
  try {
    const permit = await hseService.createPermit(req.employeeId, req.body);
    res.json({ success: true, data: permit });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

router.post('/hse/incidents', requireAuth, async (req, res) => {
  try {
    const incident = await hseService.reportIncident(req.employeeId, req.body);
    res.json({ success: true, data: incident });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});


module.exports = router;
