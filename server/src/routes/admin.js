// Admin API: HR dashboard operations with Enterprise Audit Logging & RBAC support.
// Guarded by requireAdmin.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { data: db, save, nextId, transaction, indexes } = require('../db');
const { verifyHash, hash, signToken, requireAdmin } = require('../auth');
const { ROLES, PERMISSIONS, requirePermission, checkScope, hasPermission } = require('../rbac');
const { guard, registerFailure, clearFailures } = require('../rateLimit');
const { notify } = require('../notify');

const router = express.Router();
const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const UPLOADS_DIR = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', '..', 'uploads');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'elaraby2026';

function employeeOut(e) {
  return { ...e, pinHash: undefined };
}

// Enterprise Audit Logging Helper
function recordAuditLog(d, { actor, action, targetId, details, ip }) {
  if (!d.auditLogs) d.auditLogs = [];
  const entry = {
    id: nextId('audit'),
    timestamp: Date.now(),
    actor: actor || 'admin',
    action,
    targetId: targetId ? String(targetId) : null,
    details: details || null,
    ip: ip || null,
  };
  d.auditLogs.unshift(entry);
  if (d.auditLogs.length > 1000) d.auditLogs.length = 1000;
  return entry;
}

router.post('/login', (req, res) => {
  const { username, password, role, scopeFactory, scopeDepartment } = req.body || {};
  if (guard(db(), `admin:${req.ip}`, res)) return;
  if (username !== ADMIN_USER || !verifyHash(String(password || ''), hashOnce(ADMIN_PASS))) {
    const lockedForSecs = registerFailure(db(), `admin:${req.ip}`);
    recordAuditLog(db(), {
      actor: username || 'unknown',
      action: 'admin_login_failed',
      details: 'Failed admin login attempt',
      ip: req.ip,
    });
    save();
    if (lockedForSecs > 0) {
      return res.status(429).json({ error: 'too_many_attempts', retryAfter: lockedForSecs });
    }
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  clearFailures(db(), `admin:${req.ip}`);

  const userRole = role || ROLES.SUPER_ADMIN;
  const payload = {
    sub: username,
    scope: 'admin',
    role: userRole,
    scopeFactory: scopeFactory || null,
    scopeDepartment: scopeDepartment || null,
  };
  const token = signToken(payload);
  const csrfToken = crypto.randomBytes(32).toString('hex');

  const isSecure = process.env.NODE_ENV === 'production';
  const cookieFlags = `Path=/; SameSite=Strict; Max-Age=${30 * 24 * 3600}${isSecure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [
    `admin_session=${encodeURIComponent(token)}; HttpOnly; ${cookieFlags}`,
    `csrf_token=${encodeURIComponent(csrfToken)}; ${cookieFlags}`,
  ]);

  recordAuditLog(db(), {
    actor: username,
    action: 'admin_login_success',
    details: `Admin authenticated successfully (role: ${userRole})`,
    ip: req.ip,
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
  recordAuditLog(db(), {
    actor: 'admin',
    action: 'admin_logout',
    details: 'Admin logged out and session destroyed',
    ip: req.ip,
  });
  save();
  res.json({ ok: true, message: 'logged_out' });
});

// Hash the configured password once per process for timing-safe compare.
let _adminHash = null;
function hashOnce(pass) {
  if (!_adminHash) _adminHash = hash(pass);
  return _adminHash;
}

router.use(requireAdmin);

// ---------- Audit Logs ----------
router.get('/audit-logs', requirePermission(PERMISSIONS.AUDIT_READ), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = (db().auditLogs || []).slice(0, limit);
  res.json({ auditLogs: logs, total: (db().auditLogs || []).length });
});

// ---------- Image upload (base64 JSON — no multipart dep needed) ----------
const ALLOWED_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

function isValidImage(buf, ext) {
  if (!buf || buf.length < 12) return false;
  if (ext === 'png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  }
  if (ext === 'webp') {
    return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

router.post('/upload', requirePermission(PERMISSIONS.UPLOAD_IMAGE), (req, res) => {
  let { name, dataBase64 } = req.body || {};
  if (!name || !dataBase64) return res.status(400).json({ error: 'name_and_data_required' });
  const dataUrlMatch = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataBase64);
  if (dataUrlMatch) {
    dataBase64 = dataUrlMatch[2];
  }
  const ext = String(name).split('.').pop().toLowerCase();
  if (!ALLOWED_EXT[ext]) {
    return res.status(415).json({ error: 'only_png_jpg_webp_allowed' });
  }
  const buf = Buffer.from(dataBase64, 'base64');
  if (buf.length === 0) return res.status(400).json({ error: 'empty_file' });
  if (buf.length > 6 * 1024 * 1024) {
    return res.status(413).json({ error: 'max_6mb' });
  }
  if (!isValidImage(buf, ext)) {
    return res.status(400).json({ error: 'invalid_image_data' });
  }
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `img_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
  res.json({ url: `/uploads/${filename}`, size: buf.length });
});

// ---------- Anonymous Concerns (HR Safety & Compliance) ----------
router.get('/concerns', requirePermission(PERMISSIONS.CONCERNS_READ), (req, res) => {
  const d = db();
  res.json({ concerns: d.concerns || [] });
});

// ---------- Stats ----------
router.get('/stats', requirePermission(PERMISSIONS.STATS_READ), (req, res) => {
  const d = db();
  const dayMs = 24 * 3600 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Requests per day over the last 7 days.
  const requestsByDay = [];
  for (let i = 6; i >= 0; i--) {
    const start = today.getTime() - i * dayMs;
    const end = start + dayMs;
    const label = new Date(start).toLocaleDateString('en-US', { weekday: 'short' });
    const count = d.requests.filter((r) => r.createdAt >= start && r.createdAt < end).length;
    requestsByDay.push({ label, count });
  }

  // Requests by type.
  const byType = {};
  for (const r of d.requests) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }

  const balances = d.employees.map((e) => e.vacationBalance || 0);
  const vacationDaysTaken = d.requests
    .filter((r) => String(r.type || '').toLowerCase() === 'leave' && r.status === 'approved')
    .reduce((sum, r) => sum + (Number(r.days ?? r.details?.days) || 1), 0);

  const recentActivity = [...d.requests]
    .sort((a, b) => (b.decidedAt || b.createdAt) - (a.decidedAt || a.createdAt))
    .slice(0, 8)
    .map((r) => {
      const e = d.employees.find((emp) => emp.id === r.employeeId);
      return {
        kind: 'request',
        title: r.title,
        who: e?.name || '?',
        status: r.status,
        at: r.decidedAt || r.createdAt,
      };
    });

  res.json({
    employees: d.employees.length,
    activeEmployees: d.employees.filter((e) => e.active).length,
    pendingRequests: d.requests.filter((r) => r.status === 'inReview').length,
    approvedRequests: d.requests.filter((r) => r.status === 'approved').length,
    rejectedRequests: d.requests.filter((r) => r.status === 'rejected').length,
    announcements: d.announcements.length,
    unreadNotifications: d.notifications.filter((n) => !n.read).length,
    requestsByDay,
    requestsByType: byType,
    avgVacationBalance: balances.length
      ? Math.round((balances.reduce((a, b) => a + b, 0) / balances.length) * 10) / 10
      : 0,
    vacationDaysTaken,
    tripsBooked: d.trips.reduce((sum, t) => sum + (t.bookedSeats || 0), 0),
    recentActivity,
  });
});

// ---------- Employees ----------
router.get('/employees', requirePermission(PERMISSIONS.EMPLOYEE_READ), (req, res) => {
  const all = db()
    .employees.filter((e) => checkScope(req.admin, e))
    .map(employeeOut);
  if (req.query.page || req.query.limit) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const start = (page - 1) * limit;
    const items = all.slice(start, start + limit);
    return res.json({
      employees: items,
      total: all.length,
      page,
      limit,
      totalPages: Math.ceil(all.length / limit),
    });
  }
  res.json({ employees: all });
});

router.post('/employees', requirePermission(PERMISSIONS.EMPLOYEE_CREATE), (req, res) => {
  const { name, nationalId, employeeCode, factory, department, position, supervisor, phone, vacationBalance } =
    req.body || {};
  if (!name || !/^\d{14}$/.test(String(nationalId || ''))) {
    return res.status(400).json({ error: 'name_and_14_digit_national_id_required' });
  }
  const targetFactory = factory || '10th of Ramadan';
  const targetDepartment = department || 'Production A';
  if (!checkScope(req.admin, { factory: targetFactory, department: targetDepartment })) {
    return res.status(403).json({ error: 'forbidden_outside_factory_scope' });
  }
  let employee;
  try {
    employee = transaction((state) => {
      if (state.employees.some((e) => e.nationalId === nationalId)) {
        const err = new Error('national_id_already_exists');
        err.statusCode = 422;
        throw err;
      }
      const newEmp = {
        id: `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name,
        nationalId,
        employeeCode: employeeCode || `EG-${Math.floor(10000 + Math.random() * 90000)}`,
        factory: targetFactory,
        department: targetDepartment,
        position: position || 'Operator',
        supervisor: supervisor || '—',
        phone: phone || '',
        vacationBalance: Number(vacationBalance) || 12,
        pinHash: null,
        active: true,
        createdAt: Date.now(),
      };
      state.employees.push(newEmp);
      recordAuditLog(state, {
        actor: req.admin?.sub || 'admin',
        action: 'create_employee',
        targetId: newEmp.id,
        details: `Created employee ${newEmp.name} (${newEmp.employeeCode})`,
        ip: req.ip,
      });
      return newEmp;
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
  res.json({ employee: employeeOut(employee) });
});

router.put('/employees/:id', requirePermission(PERMISSIONS.EMPLOYEE_UPDATE), (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.id);
  if (!employee) return res.status(404).json({ error: 'not_found' });
  if (!checkScope(req.admin, employee)) {
    return res.status(403).json({ error: 'forbidden_outside_factory_scope' });
  }
  const allowed = ['name', 'employeeCode', 'factory', 'department', 'position', 'supervisor', 'phone'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) employee[key] = req.body[key];
  }
  if (req.body?.vacationBalance !== undefined) {
    employee.vacationBalance = Number(req.body.vacationBalance) || 0;
  }
  if (req.body?.resetPin) {
    employee.pinHash = null;
    employee.tokenVersion = (employee.tokenVersion || 0) + 1;
  }

  recordAuditLog(db(), {
    actor: req.admin?.sub || 'admin',
    action: 'update_employee',
    targetId: employee.id,
    details: `Updated employee ${employee.name} (${employee.employeeCode})`,
    ip: req.ip,
  });
  save();
  res.json({ employee: employeeOut(employee) });
});

router.post('/employees/:id/toggle', requirePermission(PERMISSIONS.EMPLOYEE_TOGGLE), (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.id);
  if (!employee) return res.status(404).json({ error: 'not_found' });
  if (!checkScope(req.admin, employee)) {
    return res.status(403).json({ error: 'forbidden_outside_factory_scope' });
  }
  employee.active = !employee.active;
  employee.tokenVersion = (employee.tokenVersion || 0) + 1;
  recordAuditLog(db(), {
    actor: req.admin?.sub || 'admin',
    action: employee.active ? 'activate_employee' : 'deactivate_employee',
    targetId: employee.id,
    details: `${employee.active ? 'Activated' : 'Deactivated'} employee ${employee.name}`,
    ip: req.ip,
  });
  save();
  res.json({ employee: employeeOut(employee) });
});

// ---------- Requests ----------
router.get('/requests', requirePermission(PERMISSIONS.LEAVE_READ), (req, res) => {
  const withEmployee = db()
    .requests.map((r) => {
      const e = db().employees.find((emp) => emp.id === r.employeeId);
      return { ...r, employee: e, employeeName: e?.name || '?', employeeCode: e?.employeeCode || '?' };
    })
    .filter((r) => !r.employee || checkScope(req.admin, r.employee))
    .map(({ employee, ...rest }) => rest);
  withEmployee.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ requests: withEmployee });
});

router.post('/requests/:id/decide', (req, res) => {
  const { status, reason } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status_must_be_approved_or_rejected' });
  }
  const requiredPerm = status === 'approved' ? PERMISSIONS.LEAVE_APPROVE : PERMISSIONS.LEAVE_REJECT;
  if (!hasPermission(req.admin?.role, requiredPerm)) {
    return res.status(403).json({
      error: 'forbidden_permission_required',
      requiredPermission: requiredPerm,
      currentRole: req.admin?.role,
    });
  }
  let request;
  try {
    request = transaction((state) => {
      const reqItem = state.requests.find((r) => r.id === req.params.id);
      if (!reqItem) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      const employee = state.employees.find((e) => e.id === reqItem.employeeId);
      if (employee && !checkScope(req.admin, employee)) {
        const err = new Error('forbidden_outside_factory_scope');
        err.statusCode = 403;
        throw err;
      }
      if (reqItem.status !== 'inReview') {
        const err = new Error('already_decided');
        err.statusCode = 422;
        throw err;
      }
      reqItem.status = status;
      reqItem.decisionReason = reason || null;
      reqItem.decidedBy = req.admin?.sub || 'HR Admin';
      reqItem.decidedAt = Date.now();
      reqItem.summary =
        status === 'approved' ? 'Approved by HR' : `Rejected by HR${reason ? ` — ${reason}` : ''}`;

      // If HR rejects an Annual Leave request, refund the employee's deducted vacation days.
      if (status === 'rejected') {
        const isAnnualLeave = reqItem.type === 'Leave' && (
          reqItem.details?.leaveType === 'Annual Leave' ||
          reqItem.details?.leaveType === 'annual' ||
          String(reqItem.title).toLowerCase().includes('annual leave')
        );
        if (isAnnualLeave) {
          const emp = state.employees.find((e) => e.id === reqItem.employeeId);
          const days = Number(reqItem.details?.days ?? reqItem.days) || 0;
          if (emp && days > 0) {
            emp.vacationBalance = (emp.vacationBalance || 0) + days;
          }
        }
      }
      return reqItem;
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }

  const title =
    status === 'approved'
      ? `Request Approved — ${request.title}`
      : `Request Rejected — ${request.title}`;
  notify({
    employeeId: request.employeeId,
    title,
    body: status === 'approved'
      ? 'Your request has been approved by HR.'
      : (reason || 'Your request was rejected by HR.'),
  });

  recordAuditLog(db(), {
    actor: req.admin?.sub || 'admin',
    action: `request_${status}`,
    targetId: request.id,
    details: `${status === 'approved' ? 'Approved' : 'Rejected'} request "${request.title}" (Employee ID: ${request.employeeId})`,
    ip: req.ip,
  });
  save();
  res.json({ request });
});

// ---------- Payroll ----------
router.get('/payroll/:employeeId', requirePermission(PERMISSIONS.PAYROLL_READ), (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.employeeId);
  if (employee && !checkScope(req.admin, employee)) {
    return res.status(403).json({ error: 'forbidden_outside_factory_scope' });
  }
  const record = db().payroll.find((p) => p.employeeId === req.params.employeeId);
  res.json({ payroll: record || null });
});

router.put('/payroll/:employeeId', requirePermission(PERMISSIONS.PAYROLL_UPDATE), (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'employee_not_found' });
  if (!checkScope(req.admin, employee)) {
    return res.status(403).json({ error: 'forbidden_outside_factory_scope' });
  }
  const { period, basicSalary, allowances, deductions, paidOn, paymentMethod } = req.body || {};
  if (!period) return res.status(400).json({ error: 'period_required' });
  let record = db().payroll.find((p) => p.employeeId === req.params.employeeId);
  if (!record) {
    record = { employeeId: req.params.employeeId };
    db().payroll.push(record);
  }
  Object.assign(record, {
    period,
    basicSalary: Number(basicSalary) || 0,
    allowances: Number(allowances) || 0,
    deductions: Number(deductions) || 0,
    paidOn: paidOn || '',
    paymentMethod: paymentMethod || 'Bank Transfer',
    updatedAt: Date.now(),
  });
  recordAuditLog(db(), {
    actor: req.admin?.sub || 'admin',
    action: 'update_payroll',
    targetId: employee.id,
    details: `Updated payroll for ${employee.name} (${period})`,
    ip: req.ip,
  });
  save();
  res.json({ payroll: record });
});

// ---------- Roster ----------
router.get('/roster/:employeeId', requirePermission(PERMISSIONS.SHIFT_READ), (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.employeeId);
  if (employee && !checkScope(req.admin, employee)) {
    return res.status(403).json({ error: 'forbidden_outside_factory_scope' });
  }
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  const weekStart = sunday.toISOString().slice(0, 10);
  const record = db().roster.find(
    (r) => r.employeeId === req.params.employeeId && r.weekStart === weekStart,
  );
  res.json({ weekStart, days: record?.days || null });
});

router.put('/roster/:employeeId', requirePermission(PERMISSIONS.SHIFT_UPDATE), (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'employee_not_found' });
  if (!checkScope(req.admin, employee)) {
    return res.status(403).json({ error: 'forbidden_outside_factory_scope' });
  }
  const days = req.body?.days;
  const validShifts = ['morning', 'evening', 'night', 'office', 'off'];
  if (!Array.isArray(days) || days.length !== 7 ||
      days.some((d) => !validShifts.includes(d.shift))) {
    return res.status(400).json({ error: 'days_must_be_7_valid_shifts' });
  }
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  const weekStart = sunday.toISOString().slice(0, 10);
  let record = db().roster.find(
    (r) => r.employeeId === req.params.employeeId && r.weekStart === weekStart,
  );
  if (!record) {
    record = { employeeId: req.params.employeeId, weekStart };
    db().roster.push(record);
  }
  record.days = days.map((d, i) => ({ dayIndex: i, shift: d.shift }));
  recordAuditLog(db(), {
    actor: req.admin?.sub || 'admin',
    action: 'update_roster',
    targetId: employee.id,
    details: `Updated weekly roster for ${employee.name} (Week: ${weekStart})`,
    ip: req.ip,
  });
  save();
  res.json({ roster: record });
});

// ---------- Content: announcements / news / benefits / trips ----------
function crudFor(name, collection) {
  const isAnnounce = collection === 'announcements';
  const readPerm = PERMISSIONS.ANNOUNCEMENT_READ;
  const createPerm = isAnnounce ? PERMISSIONS.ANNOUNCEMENT_CREATE : PERMISSIONS.CONTENT_MANAGE;
  const deletePerm = isAnnounce ? PERMISSIONS.ANNOUNCEMENT_DELETE : PERMISSIONS.CONTENT_MANAGE;

  router.get(`/${name}`, requirePermission(readPerm), (req, res) => {
    res.json({ items: [...db()[collection]].sort((a, b) => b.createdAt - a.createdAt) });
  });

  router.post(`/${name}`, requirePermission(createPerm), (req, res) => {
    const item = {
      id: `${name.slice(0, 3)}_${Date.now()}`,
      ...req.body,
      createdAt: Date.now(),
    };
    db()[collection].push(item);
    if (collection === 'announcements') {
      for (const e of db().employees.filter((e) => e.active)) {
        notify({
          employeeId: e.id,
          title: item.important ? 'Important Announcement' : 'New Announcement',
          body: item.title,
          imageUrl: item.imageUrl || null,
        }, false);
      }
    }
    recordAuditLog(db(), {
      actor: req.admin?.sub || 'admin',
      action: `create_${name}`,
      targetId: item.id,
      details: `Created new ${name}: ${item.title || item.name || item.id}`,
      ip: req.ip,
    });
    save();
    res.json({ item });
  });

  router.delete(`/${name}/:id`, requirePermission(deletePerm), (req, res) => {
    const item = db()[collection].find((x) => x.id === req.params.id);
    db()[collection] = db()[collection].filter((x) => x.id !== req.params.id);
    recordAuditLog(db(), {
      actor: req.admin?.sub || 'admin',
      action: `delete_${name}`,
      targetId: req.params.id,
      details: `Deleted ${name}: ${item?.title || req.params.id}`,
      ip: req.ip,
    });
    save();
    res.json({ ok: true });
  });
}

crudFor('announcements', 'announcements');
crudFor('news', 'news');
crudFor('benefits', 'benefits');
crudFor('trips', 'trips');

module.exports = router;
