// Admin Sub-Router: Authentication & Platform Core
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { data: db, save } = require('../../db');
const { verifyHash, hash, signToken, requireAdmin } = require('../../auth');
const { ROLES, PERMISSIONS, requirePermission, hasPermission, checkScope } = require('../../rbac');
const { guard, registerFailure, clearFailures } = require('../../rateLimit');

const realtimeService = require('../../services/realtimeService');
const auditService = require('../../services/auditService');
const employeeService = require('../../services/employeeService');
const leaveService = require('../../services/leaveService');
const payrollService = require('../../services/payrollService');
const shiftService = require('../../services/shiftService');
const overtimeService = require('../../services/overtimeService');
const attendanceService = require('../../services/attendanceService');
const announcementService = require('../../services/announcementService');
const uploadService = require('../../services/uploadService');
const transportService = require('../../services/transportService');
const loanService = require('../../services/loanService');
const erp = require('../../integrations/erp');
const biometrics = require('../../integrations/biometrics');
const { reconcileEmployees, reconcilePayroll, reconcileAttendance } = require('../../integrations/reconciliation/reconciliationEngine');
const pdfService = require('../../services/pdfService');
const alertService = require('../../services/alertService');
const { BankingGateway, BankingReconciliationEngine } = require('../../integrations/banking');
const accessControl = require('../../integrations/access_control');
const predictiveAnalytics = require('../../services/predictiveAnalyticsService');
const analyticsAggregationService = require('../../services/analyticsAggregationService');
const rosterSolverService = require('../../services/rosterSolverService');
const hseService = require('../../services/hseService');
const incentivesDeductionsService = require('../../services/incentivesDeductionsService');
const subscriptionService = require('../../services/subscriptionService');
const { subscriptionGuard } = require('../../middleware/subscriptionGuard');
const workerImportService = require('../../services/workerImportService');
const { BUILTIN_TENANTS } = require('../tenant');
const { getCurrentTenantId } = require('../../tenantContext');

function ensureSeedAdmin(database) {
  database.adminUsers = database.adminUsers || [];
  if (database.adminUsers.length === 0) {
    const defaultUser = (process.env.ADMIN_USER || 'admin').trim();
    const defaultPass = (process.env.ADMIN_PASS || 'elaraby2026').trim();
    database.adminUsers.push({
      id: 'admin_sys_1',
      username: defaultUser,
      passwordHash: hash(defaultPass),
      role: ROLES.SUPER_ADMIN,
      name: 'مدير النظام (العربي)',
      active: true,
      createdAt: Date.now(),
    });
    save();
  }
}

// ---------- Authentication & Cookie Session Handlers ----------
router.post('/login', (req, res) => {
  const { username, password, role, scopeFactory, scopeDepartment } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  const currentDb = db();
  ensureSeedAdmin(currentDb);

  const admin = (currentDb.adminUsers || []).find(
    (u) => u.username && u.username.toLowerCase() === cleanUser && u.active !== false
  );

  const isPasswordValid = Boolean(admin && admin.passwordHash && verifyHash(cleanPass, admin.passwordHash));

  if (!admin || !isPasswordValid) {
    const lockedForSecs = registerFailure(currentDb, `admin:${req.ip}`);
    auditService.recordAuditLog(currentDb, {
      actor: username || 'unknown',
      role: role || 'unknown',
      action: 'admin_login_failed',
      details: 'Failed admin login attempt',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    save();
    if (lockedForSecs > 0) {
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: lockedForSecs });
    }
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  clearFailures(currentDb, `admin:${req.ip}`);

  let userRole = ROLES.SUPER_ADMIN;
  if (role) {
    if (Object.values(ROLES).includes(role)) {
      userRole = role;
    } else {
      return res.status(400).json({ error: 'invalid_role' });
    }
  }
  const payload = {
    sub: admin.username,
    scope: 'admin',
    role: userRole,
    scopeFactory: scopeFactory ? String(scopeFactory).trim() : null,
    scopeDepartment: scopeDepartment ? String(scopeDepartment).trim() : null,
  };
  const token = signToken(payload);
  const csrfToken = crypto.randomBytes(32).toString('hex');

  const isSecure = process.env.NODE_ENV === 'production';
  const cookieFlags = `Path=/; SameSite=Strict; Max-Age=${30 * 24 * 3600}${isSecure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [
    `admin_session=${encodeURIComponent(token)}; HttpOnly; ${cookieFlags}`,
    `csrf_token=${encodeURIComponent(csrfToken)}; ${cookieFlags}`,
  ]);

  auditService.recordAuditLog(db(), {
    actor: username,
    role: userRole,
    action: 'admin_login_success',
    details: `Admin authenticated successfully (role: ${userRole})`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  save();

  res.json({
    ok: true,
    token,
    role: userRole,
    csrfToken,
    scopeFactory: payload.scopeFactory,
    scopeDepartment: payload.scopeDepartment,
  });
});

router.post('/logout', (req, res) => {
  const isSecure = process.env.NODE_ENV === 'production';
  const clearFlags = `Path=/; SameSite=Strict; Max-Age=0${isSecure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [
    `admin_session=; HttpOnly; ${clearFlags}`,
    `csrf_token=; ${clearFlags}`,
  ]);
  auditService.recordAuditLog(db(), {
    actor: 'admin',
    role: 'admin',
    action: 'admin_logout',
    details: 'Admin logged out and session destroyed',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  save();
  res.json({ ok: true, message: 'logged_out' });
});


// Guard authenticated routes
router.use(requireAdmin);

// ---------- Realtime SSE Stream ----------
router.get('/realtime', (req, res) => {
  realtimeService.subscribe(req, res, req.admin);
});

// ---------- Audit Logs ----------
router.get('/audit-logs', requirePermission(PERMISSIONS.AUDIT_READ), (req, res) => {
  res.json(auditService.getAuditLogs(req.query));
});

// ---------- Uploads: Streaming Multipart & Base64 Dual Support ----------
router.post(['/upload', '/upload-file'], requirePermission(PERMISSIONS.UPLOAD_IMAGE), async (req, res, next) => {
  const meta = { ip: req.ip, userAgent: req.headers['user-agent'] };
  try {
    const contentType = req.headers['content-type'] || '';
    let result;
    if (contentType.includes('multipart/form-data')) {
      result = await uploadService.handleMultipartUpload(req);
    } else {
      result = await uploadService.handleBase64Upload(req.body || {});
    }

    auditService.recordAuditLog(db(), {
      actor: req.admin?.sub || 'admin',
      role: req.admin?.role || 'superadmin',
      action: 'upload_image',
      entity: 'file',
      entityId: result.filename,
      after: result,
      details: `Uploaded image ${result.filename} (${result.size} bytes)`,
      ...meta,
    });
    save();

    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ---------- Anonymous Concerns (HR Safety & Compliance) ----------
router.get('/concerns', requirePermission(PERMISSIONS.CONCERNS_READ), (req, res) => {
  const d = db();
  res.json({ concerns: d.concerns || [] });
});

// ---------- Stats ----------
router.get('/stats', requirePermission(PERMISSIONS.STATS_READ), (req, res) => {
  const d = db();
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Requests over last 7 days with status distribution
  const requestsByDay = [];
  for (let i = 6; i >= 0; i--) {
    const start = today.getTime() - i * dayMs;
    const end = start + dayMs;
    const dateObj = new Date(start);
    const label = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const fullDate = dateObj.toISOString().split('T')[0];
    const dayReqs = d.requests.filter((r) => r.createdAt >= start && r.createdAt < end);
    requestsByDay.push({
      label,
      date: fullDate,
      count: dayReqs.length,
      approved: dayReqs.filter((r) => r.status === 'approved').length,
      rejected: dayReqs.filter((r) => r.status === 'rejected').length,
      inReview: dayReqs.filter((r) => r.status === 'inReview').length,
    });
  }

  // 2. Requests by Category / Type
  const byTypeMap = {};
  for (const r of d.requests) {
    const typeKey = String(r.type || 'other').toLowerCase();
    if (!byTypeMap[typeKey]) {
      byTypeMap[typeKey] = { type: typeKey, count: 0, approved: 0, rejected: 0, inReview: 0 };
    }
    byTypeMap[typeKey].count++;
    if (r.status === 'approved') byTypeMap[typeKey].approved++;
    else if (r.status === 'rejected') byTypeMap[typeKey].rejected++;
    else byTypeMap[typeKey].inReview++;
  }

  const totalReqCount = d.requests.length || 1;
  const requestsByType = Object.values(byTypeMap)
    .sort((a, b) => b.count - a.count)
    .map((item) => ({
      ...item,
      label: item.type.charAt(0).toUpperCase() + item.type.slice(1),
      percentage: Math.round((item.count / totalReqCount) * 100),
    }));

  // 3. Workforce Distribution by Factory
  const factoryMap = {};
  for (const e of d.employees) {
    const fName = (e.factory || 'Main Headquarters').trim();
    if (!factoryMap[fName]) {
      factoryMap[fName] = { name: fName, count: 0, activeCount: 0 };
    }
    factoryMap[fName].count++;
    if (e.active !== false) factoryMap[fName].activeCount++;
  }
  const totalEmpCount = d.employees.length || 1;
  const byFactory = Object.values(factoryMap)
    .sort((a, b) => b.count - a.count)
    .map((f) => ({
      ...f,
      percentage: Math.round((f.count / totalEmpCount) * 100),
    }));

  // 4. Workforce Distribution by Department
  const deptMap = {};
  for (const e of d.employees) {
    const dName = (e.department || 'Operations').trim();
    if (!deptMap[dName]) {
      deptMap[dName] = { name: dName, count: 0 };
    }
    deptMap[dName].count++;
  }
  const byDepartment = Object.values(deptMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((dept) => ({
      ...dept,
      percentage: Math.round((dept.count / totalEmpCount) * 100),
    }));

  // 5. Vacation Balances & Days Taken
  const balances = d.employees.map((e) => Number(e.vacationBalance) || 0);
  const totalVacationBalance = balances.reduce((a, b) => a + b, 0);
  const avgVacationBalance = balances.length
    ? Math.round((totalVacationBalance / balances.length) * 10) / 10
    : 0;
  const vacationDaysTaken = d.requests
    .filter((r) => String(r.type || '').toLowerCase() === 'leave' && r.status === 'approved')
    .reduce((sum, r) => sum + (Number(r.days ?? r.details?.days) || 1), 0);

  // 6. Payroll & Compensation Financials
  const payrollList = d.payroll || [];
  const totalBaseSalary = payrollList.reduce((sum, p) => sum + (Number(p.baseSalary) || 0), 0);
  const totalAllowances = payrollList.reduce((sum, p) => sum + (Number(p.allowances) || 0), 0);
  const totalDeductions = payrollList.reduce((sum, p) => sum + (Number(p.deductions) || 0), 0);
  const totalNetSalary = payrollList.reduce((sum, p) => {
    const net = Number(p.netSalary) || ((Number(p.baseSalary) || 0) + (Number(p.allowances) || 0) - (Number(p.deductions) || 0));
    return sum + net;
  }, 0);
  const publishedPayrollCount = payrollList.filter((p) => p.isPublished).length;
  const avgNetSalary = payrollList.length ? Math.round(totalNetSalary / payrollList.length) : 0;
  const payrollPublishRate = payrollList.length ? Math.round((publishedPayrollCount / payrollList.length) * 100) : 0;

  // 7. Shifts & Rostering Health
  const rosterList = d.roster || [];
  const shiftCounts = { morning: 0, evening: 0, night: 0, off: 0 };
  let totalShiftSlots = 0;
  let totalWeeklyHours = 0;
  for (const r of rosterList) {
    let daysArray = [];
    if (Array.isArray(r.days)) {
      daysArray = r.days;
    } else if (r.days && typeof r.days === 'object') {
      daysArray = Object.entries(r.days).map(([dayKey, val]) => {
        if (typeof val === 'string') return { day: dayKey, shift: val, hours: 8 };
        return val || {};
      });
    }
    for (const day of daysArray) {
      const shift = String(day.shift || 'morning').toLowerCase();
      if (shiftCounts[shift] !== undefined) {
        shiftCounts[shift]++;
      } else {
        shiftCounts.morning++;
      }
      totalShiftSlots++;
      if (shift !== 'off') {
        totalWeeklyHours += (Number(day.hours) || 8);
      }
    }
  }
  const shiftPercentages = {
    morning: totalShiftSlots ? Math.round((shiftCounts.morning / totalShiftSlots) * 100) : 0,
    evening: totalShiftSlots ? Math.round((shiftCounts.evening / totalShiftSlots) * 100) : 0,
    night: totalShiftSlots ? Math.round((shiftCounts.night / totalShiftSlots) * 100) : 0,
    off: totalShiftSlots ? Math.round((shiftCounts.off / totalShiftSlots) * 100) : 0,
  };

  // 8. Trips & Social Welfare
  const tripsList = d.trips || [];
  const totalTripSeats = tripsList.reduce((sum, t) => sum + (Number(t.totalSeats) || 0), 0);
  const tripsBooked = tripsList.reduce((sum, t) => sum + (Number(t.bookedSeats) || 0), 0);
  const tripFillRate = totalTripSeats ? Math.round((tripsBooked / totalTripSeats) * 100) : 0;
  const popularTrips = tripsList.slice(0, 4).map((t) => ({
    title: t.title || 'Trip',
    destination: t.destination || '',
    bookedSeats: Number(t.bookedSeats) || 0,
    totalSeats: Number(t.totalSeats) || 0,
    fillRate: Number(t.totalSeats) ? Math.round(((Number(t.bookedSeats) || 0) / Number(t.totalSeats)) * 100) : 0,
  }));

  // 9. Recent Activity Stream
  const recentActivity = [...d.requests]
    .sort((a, b) => (b.decidedAt || b.createdAt) - (a.decidedAt || a.createdAt))
    .slice(0, 10)
    .map((r) => {
      const e = d.employees.find((emp) => emp.id === r.employeeId);
      return {
        kind: 'request',
        title: r.title,
        who: e?.name || 'Employee',
        factory: e?.factory || '',
        department: e?.department || '',
        status: r.status,
        type: r.type,
        at: r.decidedAt || r.createdAt,
      };
    });

  // 10. Live OTPs & Security Audit Metrics
  const auditLogs = d.auditLogs || [];
  const otpLogs = auditLogs.filter((a) => a.action === 'OTP_REQUESTED');
  const recentOtps = otpLogs
    .slice(0, 12)
    .map((a) => {
      const ageMs = now - (a.timestamp || now);
      const isExpired = ageMs >= (5 * 60 * 1000);
      return {
        id: a.id,
        employeeName: a.actor || a.details,
        nationalId: a.nationalId || '',
        phone: a.phone || '',
        code: a.otpCode || (a.details?.match(/\[\s*(\d{4,6})\s*\]/) ? a.details.match(/\[\s*(\d{4,6})\s*\]/)[1] : '******'),
        timestamp: a.timestamp,
        isExpired,
      };
    });

  const activeOtpsCount = recentOtps.filter((o) => !o.isExpired).length;
  const otpRequests24h = otpLogs.filter((a) => (now - a.timestamp) < dayMs).length;

  const activeEmp = d.employees.filter((e) => e.active !== false).length;
  const inReviewCount = d.requests.filter((r) => r.status === 'inReview').length;
  const approvedCount = d.requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = d.requests.filter((r) => r.status === 'rejected').length;
  const decidedCount = approvedCount + rejectedCount;
  const approvalRate = decidedCount > 0 ? Math.round((approvedCount / decidedCount) * 100) : 100;

  res.json({
    // Core Counts
    employees: d.employees.length,
    activeEmployees: activeEmp,
    inactiveEmployees: d.employees.length - activeEmp,
    activeRate: d.employees.length ? Math.round((activeEmp / d.employees.length) * 100) : 100,

    // Requests & Leave
    totalRequests: d.requests.length,
    pendingRequests: inReviewCount,
    approvedRequests: approvedCount,
    rejectedRequests: rejectedCount,
    approvalRate,
    requestsByDay,
    requestsByType,
    byType: byTypeMap,
    vacationDaysTaken,
    avgVacationBalance,
    totalVacationBalance,

    // Workforce Demographics
    byFactory,
    byDepartment,

    // Financials & Payroll
    payroll: {
      totalEmployees: payrollList.length,
      totalBaseSalary,
      totalAllowances,
      totalDeductions,
      totalNetSalary,
      avgNetSalary,
      publishedCount: publishedPayrollCount,
      publishRate: payrollPublishRate,
    },

    // Operations & Rostering
    roster: {
      totalRostered: rosterList.length,
      shiftCounts,
      shiftPercentages,
      totalWeeklyHours,
    },

    // Welfare, Trips & Social
    trips: {
      totalTrips: tripsList.length,
      totalTripSeats,
      tripsBooked,
      tripFillRate,
      popularTrips,
    },
    tripsBooked,

    // Broadcasts & Engagement
    announcements: (d.announcements || []).length,
    news: (d.news || []).length,
    benefits: (d.benefits || []).length,
    concernsCount: (d.concerns || []).length,
    openConcerns: (d.concerns || []).filter((c) => c.status !== 'resolved' && c.status !== 'closed').length,
    unreadNotifications: (d.notifications || []).filter((n) => !n.read).length,

    // Security & OTPs
    security: {
      totalAuditLogs: auditLogs.length,
      activeOtpsCount,
      otpRequests24h,
    },
    recentOtps,

    // Activity Stream
    recentActivity,
  });
});

router.get('/metrics', requirePermission(PERMISSIONS.AUDIT_READ), (req, res) => {
  const memory = process.memoryUsage();
  const database = db();
  res.json({
    ok: true,
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMb: Math.round(memory.rss / (1024 * 1024) * 100) / 100,
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024) * 100) / 100,
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024) * 100) / 100,
      externalMb: Math.round(memory.external / (1024 * 1024) * 100) / 100,
    },
    cluster: {
      mode: process.env.REDIS_URL ? 'distributed_redis' : 'standalone_inprocess',
      activeSseClients: realtimeService.getActiveClientCount(),
    },
    database: {
      employeesCount: database.employees?.length || 0,
      requestsCount: database.requests?.length || 0,
      announcementsCount: database.announcements?.length || 0,
      auditLogsCount: (database.logs?.length || 0) + (database.auditLogs?.length || 0),
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      env: process.env.NODE_ENV || 'development',
    },
    health: 'OPTIMAL'
  });
});

// ---------- Fleet & Transport Control Room ----------

router.get('/alerts', requireAdmin, (req, res) => {
  try {
    const result = alertService.getAlerts(req.query, req.admin);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.put('/alerts/:id/read', requireAdmin, (req, res) => {
  try {
    const result = alertService.markAlertAsRead(req.params.id, req.admin);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/alerts/mark-all-read', requireAdmin, (req, res) => {
  try {
    const result = alertService.markAllAlertsAsRead(req.admin, req.body || req.query);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------- AI Predictive Rostering & Smart Balancing ----------

router.get('/subscription/status', requireAdmin, (req, res) => {
  try {
    const tenantId = req.admin?.tenantId || null;
    if (!tenantId) {
      return res.json({
        status: 'none',
        daysUntilExpiry: null,
        expiresAt: null,
        plan: null,
        seatCount: null,
        gracePeriodEndsAt: null,
        message: 'No subscription record (open/free tier)',
      });
    }

    const status = subscriptionService.getSubscriptionStatus(tenantId);
    return res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

module.exports = router;
module.exports.ensureSeedAdmin = ensureSeedAdmin;
