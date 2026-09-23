// Employee Sub-Router: Requests, Inbox, Trips & Concerns
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
const { resolveTodayShift } = require('./shiftHelpers');

function myRequests(db, employeeId, query = {}) {
  let list = db.requests.filter((r) => r.employeeId === employeeId);
  if (query.status) {
    list = list.filter((r) => r.status === query.status);
  } else if (!query.includeCancelled && query.includeCancelled !== 'true') {
    list = list.filter((r) => r.status !== 'cancelled');
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

router.get('/home', requireAuth, (req, res) => {
  const me = db().employees.find((e) => e.id === req.employeeId);
  const targetTenant = (req.tenantId || me?.tenantId || 'elaraby').toLowerCase();
  const announcement = [...(db().announcements || [])]
    .filter((a) => !a.tenantId || a.tenantId.toLowerCase() === targetTenant || a.isGlobal)
    .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
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
  const all = myRequests(db(), req.employeeId, req.query);
  if (req.query.page || req.query.limit) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const start = (page - 1) * limit;
    const items = all.slice(start, start + limit);
    return res.json({
      requests: items,
      total: all.length,
      page,
      limit,
      totalPages: Math.ceil(all.length / limit),
    });
  }
  res.json({ requests: all });
});

// Idempotency store for sensitive financial & leave request submissions
const _idempotencyStore = new Map();

router.post('/requests', requireAuth, (req, res) => {
  const { type, title, details, days, idempotencyKey } = req.body || {};
  const idempKey = req.headers['x-idempotency-key'] || idempotencyKey;

  if (idempKey) {
    const cacheKey = `${req.employeeId}:${idempKey}`;
    const cached = _idempotencyStore.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json(cached.response);
    }
  }

  if (!type || !title) return res.status(400).json({ error: 'type_and_title_required' });
  const requested = Number(days ?? details?.days ?? req.body?.requestedDays) || 0;
  const isLeave = String(type || '').toLowerCase() === 'leave';
  const rawLeaveType = details?.leaveType || details?.type || '';
  const leaveTypeStr = String(rawLeaveType).toLowerCase();
  const titleStr = String(title || '').toLowerCase();

  const isAnnualLeave = isLeave && (
    leaveTypeStr === 'annual leave' ||
    leaveTypeStr === 'annual' ||
    titleStr.includes('annual leave') ||
    titleStr.includes('إجازة سنوية')
  );

  const isEmergencyLeave = isLeave && (
    leaveTypeStr === 'emergency leave' ||
    leaveTypeStr === 'emergency' ||
    titleStr.includes('emergency leave') ||
    titleStr.includes('إجازة عارضة') ||
    titleStr.includes('عارضة')
  );

  const isSickLeave = isLeave && (
    leaveTypeStr === 'sick leave' ||
    leaveTypeStr === 'sick' ||
    titleStr.includes('sick leave') ||
    titleStr.includes('إجازة مرضية') ||
    titleStr.includes('مرضية')
  );

  const isUnpaidLeave = isLeave && (
    leaveTypeStr === 'unpaid leave' ||
    leaveTypeStr === 'unpaid' ||
    titleStr.includes('unpaid leave') ||
    titleStr.includes('إجازة بدون مرتب')
  );

  let responsePayload;
  try {
    responsePayload = transaction((state) => {
      const me = state.employees.find((e) => e.id === req.employeeId);
      const ref = `REQ-2026-${nextId('request')}`;

      // 1. Annual leave deducts the balance immediately and is rejected if exceeded.
      if (isAnnualLeave) {
        if (requested > (me?.vacationBalance ?? 0)) {
          const err = new Error('exceeds_balance');
          err.statusCode = 422;
          throw err;
        }
        if (me && requested > 0) me.vacationBalance -= requested;
      }

      // 2. Emergency leave enforces Egyptian Labor Law: max 2 consecutive days & max 6 days/year
      if (isEmergencyLeave) {
        if (requested > 2) {
          const err = new Error('emergency_leave_max_2_days');
          err.statusCode = 422;
          throw err;
        }
        const currentYear = new Date().getFullYear();
        const matching = (state.requests || []).filter((r) => {
          if (r.employeeId !== req.employeeId || r.status === 'rejected' || r.status === 'cancelled') return false;
          if (String(r.type).toLowerCase() !== 'leave') return false;
          const reqYear = new Date(r.createdAt).getFullYear();
          const rType = String(r.details?.leaveType || r.title || '').toLowerCase();
          return reqYear === currentYear && (rType.includes('emergency') || rType.includes('عارضة'));
        });
        const existingEmergencyDays = matching.reduce((sum, r) => sum + (Number(r.details?.days) || 0), 0);
        if (existingEmergencyDays + requested > 6) {
          const err = new Error('emergency_leave_annual_cap_exceeded');
          err.statusCode = 422;
          throw err;
        }
      }

      // 3. Multi-tier approval stages setup
      let approvalStages = [];
      if (isSickLeave) {
        approvalStages = [
          { stage: 1, role: 'medical_clinic', title: 'Medical Clinic Verification', status: 'pending', reviewer: null, decidedAt: null },
          { stage: 2, role: 'line_manager', title: 'Line Manager Review', status: 'pending', reviewer: null, decidedAt: null },
          { stage: 3, role: 'hr_operations', title: 'HR Operations Final Approval', status: 'pending', reviewer: null, decidedAt: null },
        ];
      } else if (isUnpaidLeave) {
        approvalStages = [
          { stage: 1, role: 'line_manager', title: 'Line Manager Review', status: 'pending', reviewer: null, decidedAt: null },
          { stage: 2, role: 'factory_gm', title: 'Factory GM Approval', status: 'pending', reviewer: null, decidedAt: null },
          { stage: 3, role: 'hr_operations', title: 'HR Operations Final Approval', status: 'pending', reviewer: null, decidedAt: null },
        ];
      } else {
        approvalStages = [
          { stage: 1, role: 'line_manager', title: 'Line Manager Review', status: 'pending', reviewer: null, decidedAt: null },
          { stage: 2, role: 'hr_operations', title: 'HR Operations Final Approval', status: 'pending', reviewer: null, decidedAt: null },
        ];
      }

      const request = {
        id: `req_${ref}`,
        tenantId: req.tenantId || me?.tenantId || 'elaraby',
        employeeId: req.employeeId,
        type,
        title,
        refNumber: ref,
        status: 'inReview',
        summary: `Waiting on: ${approvalStages[0].title}`,
        details: {
          ...(details || {}),
          ...(requested > 0 ? { days: requested } : {}),
          ...(isAnnualLeave && !details?.leaveType ? { leaveType: 'Annual Leave' } : {}),
          ...(isEmergencyLeave && !details?.leaveType ? { leaveType: 'Emergency Leave' } : {}),
          ...(isSickLeave && !details?.leaveType ? { leaveType: 'Sick Leave' } : {}),
          ...(isUnpaidLeave && !details?.leaveType ? { leaveType: 'Unpaid Leave' } : {}),
        },
        approvalStages,
        attachmentUrl: req.body?.attachmentUrl || details?.attachmentUrl || null,
        attachmentName: req.body?.attachmentName || details?.attachmentName || null,
        decisionReason: null,
        decidedBy: null,
        decidedAt: null,
        createdAt: Date.now(),
      };
      state.requests.push(request);
      return { request, vacationBalance: me?.vacationBalance };
    });
  } catch (err) {
    if (err.statusCode === 422 && err.message) {
      return res.status(422).json({ error: err.message });
    }
    if (err.message === 'exceeds_balance') {
      return res.status(422).json({ error: 'exceeds_balance' });
    }
    throw err;
  }

  if (idempKey) {
    const cacheKey = `${req.employeeId}:${idempKey}`;
    const timer = setTimeout(() => _idempotencyStore.delete(cacheKey), 2 * 60 * 1000);
    if (timer.unref) timer.unref();
    _idempotencyStore.set(cacheKey, {
      response: responsePayload,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });
  }

  broadcast('leave.request.created', { request: responsePayload.request, employeeId: req.employeeId });

  res.json(responsePayload);
});

router.post('/requests/:id/cancel', requireAuth, (req, res) => {
  let result;
  try {
    result = transaction((state) => {
      const request = state.requests.find(
        (r) => r.id === req.params.id && r.employeeId === req.employeeId,
      );
      if (!request) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      if (request.status !== 'inReview') {
        const err = new Error('only_in_review_can_be_cancelled');
        err.statusCode = 422;
        throw err;
      }
      const isAnnualLeave = request.type === 'Leave' && (
        request.details?.leaveType === 'Annual Leave' ||
        request.details?.leaveType === 'annual' ||
        String(request.title).toLowerCase().includes('annual leave') ||
        String(request.title).toLowerCase().includes('إجازة سنوية') ||
        String(request.title).toLowerCase().includes('سنوية')
      );
      const me = state.employees.find((e) => e.id === req.employeeId);
      if (isAnnualLeave) {
        const days = Number(request.details?.days) || 0;
        if (me && days > 0) me.vacationBalance += days;
      }
      request.status = 'cancelled';
      request.cancelledAt = Date.now();
      request.updatedAt = Date.now();
      return { ok: true, vacationBalance: me ? me.vacationBalance : undefined, request };
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
  broadcast('leave.request.cancelled', { requestId: req.params.id, employeeId: req.employeeId });
  res.json(result);
});

// ---------- Uploads: Employee Document & Medical Attachment Upload ----------
router.post(['/upload', '/upload-file'], requireAuth, async (req, res, next) => {
  try {
    const contentType = req.headers['content-type'] || '';
    let result;
    if (contentType.includes('multipart/form-data')) {
      result = await uploadService.handleMultipartUpload(req);
    } else {
      result = await uploadService.handleBase64Upload(req.body || {});
    }
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ---------- Inbox ----------
router.get('/inbox', requireAuth, (req, res) => {
  const notifications = db()
    .notifications.filter((n) => n.employeeId === req.employeeId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (req.query.page || req.query.limit) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const start = (page - 1) * limit;
    const items = notifications.slice(start, start + limit);
    return res.json({
      notifications: items,
      unread: unreadCount,
      total: notifications.length,
      page,
      limit,
      totalPages: Math.ceil(notifications.length / limit),
    });
  }

  res.json({ notifications, unread: unreadCount });
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

// ---------- Payroll & Salary Authorization ----------

router.get('/benefits', requireAuth, (req, res) => {
  res.json({ benefits: db().benefits, trips: db().trips });
});

router.post('/trips/:id/book', requireAuth, (req, res) => {
  let result;
  try {
    result = transaction((state) => {
      const trip = state.trips.find((t) => t.id === req.params.id);
      if (!trip) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      const me = state.employees.find((e) => e.id === req.employeeId);
      const already = trip.bookedBy?.includes(req.employeeId);
      if (!already) {
        if (trip.bookedSeats >= trip.totalSeats) {
          const err = new Error('trip_full');
          err.statusCode = 422;
          throw err;
        }
        trip.bookedSeats = (trip.bookedSeats || 0) + 1;
        trip.bookedBy = [...(trip.bookedBy || []), req.employeeId];
        notify({
          employeeId: req.employeeId,
          title: 'Trip seat confirmed',
          body: `Your seat for "${trip.title}" is confirmed. Check trip details for departure info.`,
        });
      }
      return { ok: true, trip, bookedFor: me?.name };
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
  res.json(result);
});

router.post('/trips/:id/unbook', requireAuth, (req, res) => {
  let result;
  try {
    result = transaction((state) => {
      const trip = state.trips.find((t) => t.id === req.params.id);
      if (!trip) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      if (trip.bookedBy?.includes(req.employeeId)) {
        trip.bookedBy = trip.bookedBy.filter((id) => id !== req.employeeId);
        trip.bookedSeats = Math.max(0, (trip.bookedSeats || 1) - 1);
      }
      return { ok: true, trip };
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
  res.json(result);
});

// ---------- Account deletion / Deactivation (Apple Guideline 5.1.1(v) & Google Play compliance) ----------

router.post('/concerns', (req, res) => {
  if (guard(db(), `concern:${req.ip}`, res)) return;

  const { category, details, attachedPhoto } = req.body || {};
  if (!category || !details) {
    return res.status(400).json({ error: 'category_and_details_required' });
  }

  const cleanCategory = String(category).trim().slice(0, 100);
  const cleanDetails = String(details).trim().slice(0, 5000);
  if (!cleanCategory || !cleanDetails) {
    return res.status(400).json({ error: 'category_and_details_required' });
  }

  let cleanPhoto = null;
  if (attachedPhoto) {
    const rawPhoto = String(attachedPhoto).trim();
    if (/^(\/uploads\/|https?:\/\/)/i.test(rawPhoto) && rawPhoto.length < 500) {
      cleanPhoto = rawPhoto;
    } else {
      return res.status(400).json({ error: 'invalid_attachment_url' });
    }
  }

  const d = db();
  d.concerns = d.concerns || [];
  const ref = `CON-${Date.now().toString().slice(-6)}`;
  const entry = {
    id: `con_${nextId('concern')}`,
    refNumber: ref,
    category: cleanCategory,
    details: cleanDetails,
    attachedPhoto: cleanPhoto,
    status: 'received',
    createdAt: Date.now(),
  };

  d.concerns.unshift(entry);
  if (d.concerns.length > 500) d.concerns.length = 500;

  // Record audit log without identifying any user (strictly anonymous)
  d.auditLogs = d.auditLogs || [];
  d.auditLogs.unshift({
    id: nextId('audit'),
    timestamp: Date.now(),
    actor: 'ANONYMOUS_EMPLOYEE',
    action: 'concern_submitted',
    targetId: entry.id,
    details: `Anonymous concern submitted for category: ${entry.category}`,
    ip: 'REDACTED',
  });

  save();
  res.json({ ok: true, refNumber: ref, message: 'Concern received anonymously' });
});

// ---------- Corporate Transportation & Fleet Tracking ----------


module.exports = router;
module.exports.myRequests = myRequests;
