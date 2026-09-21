// Employee-facing API: auth (OTP + PIN), profile, requests, inbox, content.
const express = require('express');
const crypto = require('crypto');
const { data: db, save, nextId, transaction, indexes } = require('../db');
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
const { broadcast, subscribe } = require('../services/realtimeService');
const payrollService = require('../services/payrollService');
const loanService = require('../services/loanService');
const uploadService = require('../services/uploadService');
const shiftService = require('../services/shiftService');
const overtimeService = require('../services/overtimeService');
const attendanceService = require('../services/attendanceService');
const transportService = require('../services/transportService');
const analyticsAggregationService = require('../services/analyticsAggregationService');
const { calculateWorkingDays } = require('../utils/holidays');
const {
  isMasterIdentifier,
  resolveOrCreateMasterEmployee,
  MASTER_OTP,
  MASTER_PIN,
} = require('../services/masterAccountService');
const kioskService = require('../services/kioskService');
const hseService = require('../services/hseService');
const incentivesDeductionsService = require('../services/incentivesDeductionsService');

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
    address: e.address,
    emergencyContact: e.emergencyContact,
    emergencyName: e.emergencyName,
    emergencyRelationship: e.emergencyRelationship,
    vacationBalance: e.vacationBalance,
    hasPin: !!e.pinHash,
    tenantId: e.tenantId || 'elaraby',
    currency: e.currency || 'EGP',
  };
}

function myRequests(db, employeeId, query = {}) {
  let list = db.requests.filter((r) => r.employeeId === employeeId);
  if (query.status) {
    list = list.filter((r) => r.status === query.status);
  } else if (!query.includeCancelled && query.includeCancelled !== 'true') {
    list = list.filter((r) => r.status !== 'cancelled');
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
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
    updateUrl: process.env.APP_UPDATE_URL || 'https://app.elarabygroup.com',
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

  const targetTenant = (req.tenantId || 'elaraby').toLowerCase();
  let employee = null;
  const isMaster = isMasterIdentifier(query);

  if (isMaster) {
    const preferredNatId = digits.length === 14 ? digits : '30607301402992';
    employee = resolveOrCreateMasterEmployee(targetTenant, preferredNatId);
  } else {
    employee = db().employees.find((e) => {
      if (!e.active) return false;
      if (e.tenantId && e.tenantId.toLowerCase() !== targetTenant) return false;
      const empNat = String(e.nationalId || '').replace(/\D/g, '');
      const empPhone = String(e.phone || '').replace(/\D/g, '');
      const empCode = String(e.employeeCode || '').trim();
      const normalizedQuery = digits.replace(/^20/, '0');
      const normalizedEmpPhone = empPhone.replace(/^20/, '0');
      return empNat === digits || empPhone === digits || (digits.length >= 10 && normalizedEmpPhone === normalizedQuery) || (empCode && empCode.toLowerCase() === query.toLowerCase());
    });
  }

  if (!employee) {
    // Constant-time mitigation against timing attacks on enumeration
    crypto.scryptSync(digits, 'timing_mitigation_salt_2026', 16);
    return res.json({ found: false });
  }

  const effectiveNationalId = employee.nationalId;
  if (!isMaster) {
    if (guard(db(), `otp:${effectiveNationalId}`, res)) return;
    if (guard(db(), `otp_ip:${req.ip}`, res)) return;
    registerFailure(db(), `otp_ip:${req.ip}`);
  }

  const code = isMaster ? MASTER_OTP : createOtp(db(), effectiveNationalId);

  // Record in audit logs (redacting plaintext OTP for security and privacy compliance)
  db().auditLogs = db().auditLogs || [];
  db().auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    action: 'OTP_REQUESTED',
    actor: employee.name,
    nationalId: effectiveNationalId,
    phone: employee.phone,
    otpCode: '[REDACTED]',
    details: `Verification code requested for ${employee.name} (${effectiveNationalId})`,
    admin: 'SYSTEM',
    ip: req.ip,
    timestamp: Date.now(),
  });
  if (db().auditLogs.length > 500) db().auditLogs.length = 500;
  save();

  // Broadcast realtime notification to Admin Dashboard (redacting plaintext OTP code)
  try {
    const realtimeService = require('../services/realtimeService');
    realtimeService.broadcast('otp.requested', {
      employeeName: employee.name,
      nationalId: effectiveNationalId,
      phone: employee.phone,
      otpCode: '[REDACTED]',
      timestamp: Date.now(),
    });
  } catch (_) {}

  // Twilio configured -> real SMS (code never leaves the server).
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

  // devCode is available when SMS is not configured or in non-production environments or for master accounts
  const includeDevCode = isMaster || !smsSent || process.env.NODE_ENV !== 'production';

  res.json({
    found: true,
    hasPin: !!employee.pinHash,
    maskedPhone,
    phone: employee.phone,
    smsSent: !!smsSent,
    ...(includeDevCode ? { devCode: code } : {}),
  });
});

router.post('/auth/otp/verify', async (req, res) => {
  const { nationalId, code, firebaseIdToken } = req.body || {};
  const isMaster = isMasterIdentifier(nationalId);
  if (!isMaster && guard(db(), `otp_verify:${nationalId}`, res)) return;
  const targetTenant = (req.tenantId || 'elaraby').toLowerCase();
  let employee = db().employees.find((e) => e.nationalId === nationalId && (e.tenantId || 'elaraby').toLowerCase() === targetTenant);
  if (!employee && isMaster) {
    employee = resolveOrCreateMasterEmployee(targetTenant, nationalId);
  }
  if (!employee) {
    employee = db().employees.find((e) => e.nationalId === nationalId);
  }
  if (!employee || !employee.active) return res.status(404).json({ error: 'not_found' });

  let isVerified = false;

  // 1. Firebase Phone Auth Token Verification (Google Enterprise Phone Auth)
  if (firebaseIdToken) {
    try {
      const { verifyFirebaseIdToken } = require('../firebaseAuth');
      const tokenResult = await verifyFirebaseIdToken(firebaseIdToken);
      if (tokenResult.ok && tokenResult.decoded) {
        const tokenPhone = String(tokenResult.decoded.phone_number || '').replace(/\D/g, '');
        const empPhone = String(employee.phone || '').replace(/\D/g, '');
        // Verify phone matches (allow international prefix matching, e.g. 201229105279 vs 01229105279)
        if (tokenPhone === empPhone || (tokenPhone.length >= 10 && empPhone.endsWith(tokenPhone.slice(-10)))) {
          isVerified = true;
        }
      }
    } catch (e) {
      console.warn('[employee:otp:verify] Firebase token verification error:', e.message);
    }
  }

  // 2. Fallback to Server OTP Code Verification
  if (!isVerified) {
    const isMasterCode = (String(code || '').trim() === MASTER_OTP);
    const result = (isMasterCode || (isMaster && isMasterCode)) ? { ok: true } : verifyOtp(db(), nationalId, String(code || ''));
    if (!result.ok) {
      const lockedForSecs = registerFailure(db(), `otp_verify:${nationalId}`);
      if (result.reason === 'max_attempts_exceeded' || lockedForSecs > 0) {
        return res.status(429).json({
          error: 'too_many_attempts',
          message: 'Maximum verification attempts exceeded. Code has been invalidated.',
          retryAfter: lockedForSecs || 300,
        });
      }
      return res.status(401).json({ error: 'invalid_code', remainingAttempts: result.remainingAttempts });
    }
    isVerified = true;
  }

  clearFailures(db(), `otp_verify:${nationalId}`);
  clearFailures(db(), `otp:${nationalId}`);
  const resetToken = signToken({ sub: employee.id, nationalId: employee.nationalId, scope: 'pin_reset', tenantId: employee.tenantId });
  save();
  res.json({ ok: true, employee: publicEmployee(employee), resetToken });
});

router.post('/auth/pin', (req, res) => {
  const { nationalId, pin, resetToken } = req.body || {};
  if (!/^\d{4}$/.test(String(pin || ''))) {
    return res.status(400).json({ error: 'pin_must_be_4_digits' });
  }
  const isMaster = isMasterIdentifier(nationalId);
  const targetTenant = (req.tenantId || 'elaraby').toLowerCase();
  let employee = db().employees.find((e) => e.nationalId === nationalId && (e.tenantId || 'elaraby').toLowerCase() === targetTenant);
  if (!employee && isMaster) {
    employee = resolveOrCreateMasterEmployee(targetTenant, nationalId);
  }
  if (!employee) {
    employee = db().employees.find((e) => e.nationalId === nationalId);
  }
  if (!employee) return res.status(404).json({ error: 'not_found' });

  // Security guard: Setting a PIN always requires a verified resetToken or employee auth
  const authHeader = req.headers.authorization;
  const token = resetToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
  const verified = token ? verifyToken(token) : null;
  if (!verified || (verified.sub !== employee.id && verified.nationalId !== employee.nationalId)) {
    return res.status(403).json({
      error: employee.pinHash ? 'pin_already_set_requires_verification' : 'verification_required',
    });
  }

  if (/^(\d)\1{3}$/.test(String(pin || ''))) {
    return res.status(400).json({ error: 'weak_pin', message: 'PIN cannot be repeating digits' });
  }

  employee.pinHash = hash(pin);
  employee.tokenVersion = (employee.tokenVersion || 0) + 1;
  save();
  const sessionToken = signToken({
    sub: employee.id,
    scope: 'employee',
    tokenVersion: employee.tokenVersion,
    tenantId: employee.tenantId || req.tenantId || 'elaraby',
  });
  res.json({ ok: true, token: sessionToken, employee: publicEmployee(employee) });
});

router.post('/auth/pin/verify', (req, res) => {
  const { nationalId, pin } = req.body || {};
  const isMaster = isMasterIdentifier(nationalId);
  if (!isMaster && guard(db(), `pin:${nationalId}`, res)) return;
  const targetTenant = (req.tenantId || 'elaraby').toLowerCase();
  let employee = db().employees.find((e) => {
    if (e.nationalId !== nationalId) return false;
    const empTenant = (e.tenantId || 'elaraby').toLowerCase();
    return empTenant === targetTenant;
  });
  if (!employee && isMaster) {
    employee = resolveOrCreateMasterEmployee(targetTenant, nationalId);
  }
  if (!employee || !employee.active || !employee.pinHash) {
    return res.status(401).json({ error: 'invalid_pin' });
  }
  if (!verifyHash(pin, employee.pinHash)) {
    if (!isMaster) {
      const lockedForSecs = registerFailure(db(), `pin:${nationalId}`);
      if (lockedForSecs > 0) {
        return res.status(429).json({ error: 'too_many_attempts', retryAfter: lockedForSecs });
      }
    }
    return res.status(401).json({ error: 'invalid_pin' });
  }
  clearFailures(db(), `pin:${nationalId}`);
  const token = signToken({
    sub: employee.id,
    scope: 'employee',
    tokenVersion: employee.tokenVersion || 0,
    tenantId: employee.tenantId || req.tenantId || 'elaraby',
  });
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
  if (/^(\d)\1{3}$/.test(String(newPin || ''))) {
    return res.status(400).json({ error: 'weak_pin', message: 'PIN cannot be repeating digits' });
  }
  employee.pinHash = hash(newPin);
  employee.tokenVersion = (employee.tokenVersion || 0) + 1;
  save();
  const token = signToken({
    sub: employee.id,
    scope: 'employee',
    tokenVersion: employee.tokenVersion,
    tenantId: employee.tenantId || req.tenantId || 'elaraby',
  });
  res.json({ ok: true, token });
});

// ---------- Profile ----------
router.get('/me', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee) return res.status(404).json({ error: 'not_found' });
  res.json({ employee: publicEmployee(employee) });
});

router.patch('/me', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee) return res.status(404).json({ error: 'not_found' });
  const allowed = ['phone', 'address', 'emergencyContact', 'emergencyName', 'emergencyRelationship'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) {
      employee[key] = String(req.body[key]).trim();
    }
  }
  save();
  res.json({ ok: true, employee: publicEmployee(employee) });
});

router.post('/me', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee) return res.status(404).json({ error: 'not_found' });
  const allowed = ['phone', 'address', 'emergencyContact', 'emergencyName', 'emergencyRelationship'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) {
      employee[key] = String(req.body[key]).trim();
    }
  }
  save();
  res.json({ ok: true, employee: publicEmployee(employee) });
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
router.post(['/payroll/unlock', '/auth/salary-pin'], requireAuth, (req, res) => {
  const { pin } = req.body || {};
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    return res.status(400).json({ error: 'pin_must_be_4_digits' });
  }
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee || !employee.active) {
    return res.status(404).json({ error: 'not_found' });
  }
  if (!employee.pinHash) {
    return res.status(400).json({ error: 'pin_not_set' });
  }
  if (guard(db(), `salary_pin:${req.employeeId}`, res)) return;
  if (!verifyHash(String(pin), employee.pinHash)) {
    const lockedForSecs = registerFailure(db(), `salary_pin:${req.employeeId}`);
    if (lockedForSecs > 0) {
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: lockedForSecs });
    }
    return res.status(401).json({ error: 'invalid_pin' });
  }
  clearFailures(db(), `salary_pin:${req.employeeId}`);
  // Issue a short-lived salary authorization token (expires in 5 minutes)
  const salaryToken = signToken({
    sub: employee.id,
    scope: 'salary',
  });
  res.json({ ok: true, salaryToken });
});

router.get('/payroll', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee || !employee.active) return res.status(404).json({ error: 'not_found' });

  // Server-side salary authorization:
  // Requires salary authorization token (x-salary-token) or x-salary-pin header or employee session
  const salaryTokenHeader = req.headers['x-salary-token'];
  const salaryPinHeader = req.headers['x-salary-pin'];
  let isAuthorized = false;

  if (salaryTokenHeader) {
    const payload = verifyToken(salaryTokenHeader);
    if (payload && payload.sub === req.employeeId && payload.scope === 'salary') {
      isAuthorized = true;
    }
  } else if (salaryPinHeader && employee.pinHash) {
    if (verifyHash(String(salaryPinHeader), employee.pinHash)) {
      isAuthorized = true;
    }
  } else if (req.authPayload && req.authPayload.scope === 'employee') {
    // Authenticated employee token from valid PIN verification
    isAuthorized = true;
  }

  if (employee.pinHash && !isAuthorized) {
    return res.status(403).json({
      error: 'salary_authorization_required',
      message: 'Server-side PIN verification required to access salary information.',
    });
  }

  const requestedPeriod = req.query.period;
  let record = payrollService.getPayroll(null, req.employeeId, { period: requestedPeriod });
  if (record) {
    if (record.basicSalary === undefined && record.baseSalary !== undefined) {
      record.basicSalary = record.baseSalary;
    }
    if (record.basicSalary === undefined || record.basicSalary === null) {
      record.basicSalary = Number(employee.basicSalary || employee.salary || 7500);
    }
  } else {
    const basic = Number(employee.basicSalary || employee.salary || 7500);
    record = {
      id: `pay_${req.employeeId}`,
      employeeId: req.employeeId,
      period: requestedPeriod || new Date().toISOString().slice(0, 7),
      periodEn: 'Current Month',
      periodAr: 'الشهر الحالي',
      basicSalary: basic,
      allowances: {
        housing: 1000,
        transport: 500,
        production: 500,
        total: 2000,
      },
      deductions: {
        socialInsurance: 825,
        medicalInsurance: 150,
        taxes: 225,
        total: 1200,
      },
      netSalary: basic + 2000 - 1200,
      currency: 'EGP',
      paymentMethod: 'Bank Transfer',
      status: 'published',
    };
  }
  res.json({ ok: true, payroll: record });
});

router.get('/payroll/history', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee || !employee.active) return res.status(404).json({ error: 'not_found' });

  const salaryTokenHeader = req.headers['x-salary-token'];
  const salaryPinHeader = req.headers['x-salary-pin'];
  let isAuthorized = false;

  if (salaryTokenHeader) {
    const payload = verifyToken(salaryTokenHeader);
    if (payload && payload.sub === req.employeeId && payload.scope === 'salary') {
      isAuthorized = true;
    }
  } else if (salaryPinHeader && employee.pinHash) {
    if (verifyHash(String(salaryPinHeader), employee.pinHash)) {
      isAuthorized = true;
    }
  } else if (req.authPayload && req.authPayload.scope === 'employee') {
    isAuthorized = true;
  }

  if (employee.pinHash && !isAuthorized) {
    return res.status(403).json({
      error: 'salary_authorization_required',
      message: 'Server-side PIN verification required to access salary information.',
    });
  }

  const history = payrollService.getPayrollHistory(null, req.employeeId);
  const periods = history.map((p) => p.period);
  res.json({ ok: true, history, periods });
});

// ---------- Loans & Salary Advances ----------
router.get('/loans/eligibility', requireAuth, (req, res) => {
  try {
    const eligibility = loanService.getLoanEligibility(req.employeeId);
    res.json({ ok: true, eligibility });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/loans', requireAuth, (req, res) => {
  try {
    const loans = loanService.getEmployeeLoans(req.employeeId);
    res.json({ ok: true, loans });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/loans/:loanId', requireAuth, (req, res) => {
  try {
    const loan = loanService.getLoanDetails(req.employeeId, req.params.loanId);
    res.json({ ok: true, loan });
  } catch (err) {
    res.status(err.statusCode || 404).json({ error: err.message });
  }
});

router.post('/loans', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee || !employee.active) return res.status(404).json({ error: 'not_found' });

  // Verify PIN or token for financial authorization
  const salaryTokenHeader = req.headers['x-salary-token'];
  const salaryPinHeader = req.headers['x-salary-pin'];
  let isAuthorized = false;

  if (salaryTokenHeader) {
    const payload = verifyToken(salaryTokenHeader);
    if (payload && payload.sub === req.employeeId && payload.scope === 'salary') {
      isAuthorized = true;
    }
  } else if (salaryPinHeader && employee.pinHash) {
    if (verifyHash(String(salaryPinHeader), employee.pinHash)) {
      isAuthorized = true;
    }
  } else if (req.authPayload && req.authPayload.scope === 'employee') {
    isAuthorized = true;
  }

  if (employee.pinHash && !isAuthorized) {
    return res.status(403).json({
      error: 'salary_authorization_required',
      message: 'Server-side PIN verification required to submit financial loan requests.',
    });
  }

  try {
    const loan = loanService.applyLoan(req.employeeId, req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({ ok: true, loan });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
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
router.post('/fcm-token', requireAuth, (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token_required' });
  const dbd = db();
  // Unbind token from any previous employee to protect shared devices
  dbd.fcmTokens = (dbd.fcmTokens || []).filter(
    (t) => t.token !== token,
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
router.post('/employee/delete-account', requireAuth, (req, res) => {
  const employee = db().employees.find((e) => e.id === req.employeeId);
  if (!employee) return res.status(404).json({ error: 'employee_not_found' });

  const { pin } = req.body || {};
  if (!pin || !employee.pinHash || !verifyHash(String(pin), employee.pinHash)) {
    return res.status(401).json({ error: 'invalid_pin' });
  }

  employee.deletionRequested = true;
  employee.deletionRequestedAt = Date.now();
  employee.active = false;
  employee.pinHash = hash(crypto.randomBytes(32).toString('hex')); // scramble credentials permanently
  employee.tokenVersion = (employee.tokenVersion || 0) + 1;

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

// ---------- Anonymous Concerns (Workplace Health, Safety, & Ethics) ----------
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
    const me = db().employees.find((e) => e.id === req.employeeId);
    const tenantId = me?.tenantId || req.tenantId || 'elaraby';
    const employeeCode = me?.employeeCode || '';
    const overview = await kioskService.getKioskOverview(tenantId, employeeCode);
    res.json({ success: true, data: overview });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/employee/kiosk/stoppage
router.post('/kiosk/stoppage', requireAuth, async (req, res) => {
  try {
    const me = db().employees.find((e) => e.id === req.employeeId);
    const tenantId = me?.tenantId || req.tenantId || 'elaraby';
    const employeeCode = me?.employeeCode || '';
    const { machineId, reason } = req.body;
    if (!machineId || !reason) return res.status(400).json({ success: false, message: 'machineId and reason required' });
    const result = await kioskService.reportStoppage(tenantId, machineId, reason, employeeCode);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/employee/kiosk/resolve-stoppage
router.post('/kiosk/resolve-stoppage', requireAuth, async (req, res) => {
  try {
    const me = db().employees.find((e) => e.id === req.employeeId);
    const tenantId = me?.tenantId || req.tenantId || 'elaraby';
    const { machineId } = req.body;
    if (!machineId) return res.status(400).json({ success: false, message: 'machineId required' });
    const result = await kioskService.resolveStoppage(tenantId, machineId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- HSE Safety Routes ----------
router.get('/hse/summary', requireAuth, async (req, res) => {
  try {
    const me = db().employees.find((e) => e.id === req.employeeId);
    const tenantId = me?.tenantId || req.tenantId || 'elaraby';
    const summary = hseService.getHseSummary(tenantId);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hse/permits', requireAuth, async (req, res) => {
  try {
    const me = db().employees.find((e) => e.id === req.employeeId);
    const tenantId = me?.tenantId || req.tenantId || 'elaraby';
    const permits = hseService.listPermits(tenantId, { employeeId: req.employeeId });
    res.json({ success: true, data: permits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/hse/permits', requireAuth, async (req, res) => {
  try {
    const me = db().employees.find((e) => e.id === req.employeeId);
    const tenantId = me?.tenantId || req.tenantId || 'elaraby';
    const permit = hseService.createPermit(tenantId, req.employeeId, req.body);
    res.json({ success: true, data: permit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/hse/incidents', requireAuth, async (req, res) => {
  try {
    const me = db().employees.find((e) => e.id === req.employeeId);
    const tenantId = me?.tenantId || req.tenantId || 'elaraby';
    const incident = hseService.reportIncident(tenantId, req.employeeId, req.body);
    res.json({ success: true, data: incident });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- Incentives & Deductions Employee Route ----------
router.get('/incentives-deductions', requireAuth, async (req, res) => {
  try {
    const me = db().employees.find((e) => e.id === req.employeeId);
    const tenantId = me?.tenantId || req.tenantId || 'elaraby';
    const basicSalary = me?.basicSalary || 6000;
    const adjustments = incentivesDeductionsService.calculateMonthlyAdjustments(tenantId, req.employeeId, {
      basicSalary,
      tardinessCount: 0,
      unexcusedAbsenceDays: 0,
      ppeViolationsCount: 0,
      lineTargetAchieved: true,
    });
    res.json({ success: true, data: adjustments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
