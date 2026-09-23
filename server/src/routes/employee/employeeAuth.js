// Employee Sub-Router: Authentication, PIN & Profile
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
  const employee = db().employees.find((e) => {
    if (!e.active) return false;
    if (e.tenantId && e.tenantId.toLowerCase() !== targetTenant) return false;
    const empNat = String(e.nationalId || '').replace(/\D/g, '');
    const empPhone = String(e.phone || '').replace(/\D/g, '');
    const empCode = String(e.employeeCode || '').trim();
    const normalizedQuery = digits.replace(/^20/, '0');
    const normalizedEmpPhone = empPhone.replace(/^20/, '0');
    return empNat === digits || empPhone === digits || (digits.length >= 10 && normalizedEmpPhone === normalizedQuery) || (empCode && empCode.toLowerCase() === query.toLowerCase());
  });

  if (!employee) {
    // Constant-time mitigation against timing attacks on enumeration
    crypto.scryptSync(digits, 'timing_mitigation_salt_2026', 16);
    return res.json({ found: false });
  }

  const effectiveNationalId = employee.nationalId;
  if (guard(db(), `otp:${effectiveNationalId}`, res)) return;
  if (guard(db(), `otp_ip:${req.ip}`, res)) return;
  registerFailure(db(), `otp_ip:${req.ip}`);

  const code = createOtp(db(), effectiveNationalId);

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
    const realtimeService = require('../../services/realtimeService');
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

  // devCode is available when SMS is not configured or in non-production environments
  const includeDevCode = !smsSent || process.env.NODE_ENV !== 'production';

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
  if (guard(db(), `otp_verify:${nationalId}`, res)) return;
  const targetTenant = (req.tenantId || 'elaraby').toLowerCase();
  const employee = db().employees.find((e) => e.nationalId === nationalId && (e.tenantId || 'elaraby').toLowerCase() === targetTenant);
  if (!employee || !employee.active) return res.status(404).json({ error: 'not_found' });

  let isVerified = false;

  // 1. Firebase Phone Auth Token Verification (Google Enterprise Phone Auth)
  if (firebaseIdToken) {
    try {
      const { verifyFirebaseIdToken } = require('../../firebaseAuth');
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
    const result = verifyOtp(db(), nationalId, String(code || ''));
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
  const targetTenant = (req.tenantId || 'elaraby').toLowerCase();
  const employee = db().employees.find((e) => e.nationalId === nationalId && (e.tenantId || 'elaraby').toLowerCase() === targetTenant);
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
  if (guard(db(), `pin:${nationalId}`, res)) return;
  const targetTenant = (req.tenantId || 'elaraby').toLowerCase();
  const employee = db().employees.find((e) => {
    if (e.nationalId !== nationalId) return false;
    const empTenant = (e.tenantId || 'elaraby').toLowerCase();
    return empTenant === targetTenant;
  });
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

module.exports = router;
module.exports.publicEmployee = publicEmployee;
