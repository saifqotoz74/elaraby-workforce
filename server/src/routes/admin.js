// Admin API: HR dashboard operations with Enterprise Audit Logging & RBAC support.
// Guarded by requireAdmin.
const fs = require('fs');
const path = require('path');
const express = require('express');
const { data: db, save, nextId } = require('../db');
const { verifyHash, hash, signToken, requireAdmin } = require('../auth');
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
  const { username, password } = req.body || {};
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
  recordAuditLog(db(), {
    actor: username,
    action: 'admin_login_success',
    details: 'Admin authenticated successfully',
    ip: req.ip,
  });
  save();
  res.json({ token: signToken({ sub: username, scope: 'admin', role: 'superadmin' }) });
});

// Hash the configured password once per process for timing-safe compare.
let _adminHash = null;
function hashOnce(pass) {
  if (!_adminHash) _adminHash = hash(pass);
  return _adminHash;
}

router.use(requireAdmin);

// ---------- Audit Logs ----------
router.get('/audit-logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = (db().auditLogs || []).slice(0, limit);
  res.json({ auditLogs: logs, total: (db().auditLogs || []).length });
});

// ---------- Image upload (base64 JSON — no multipart dep needed) ----------
const ALLOWED_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

router.post('/upload', (req, res) => {
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
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `img_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
  res.json({ url: `/uploads/${filename}`, size: buf.length });
});

// ---------- Stats ----------
router.get('/stats', (req, res) => {
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
    .filter((r) => r.type === 'leave' && r.status === 'approved')
    .reduce((sum, r) => sum + (Number(r.days) || 1), 0);

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
router.get('/employees', (req, res) => {
  res.json({ employees: db().employees.map(employeeOut) });
});

router.post('/employees', (req, res) => {
  const { name, nationalId, employeeCode, factory, department, position, supervisor, phone, vacationBalance } =
    req.body || {};
  if (!name || !/^\d{14}$/.test(String(nationalId || ''))) {
    return res.status(400).json({ error: 'name_and_14_digit_national_id_required' });
  }
  if (db().employees.some((e) => e.nationalId === nationalId)) {
    return res.status(422).json({ error: 'national_id_already_exists' });
  }
  const employee = {
    id: `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name,
    nationalId,
    employeeCode: employeeCode || `EG-${Math.floor(10000 + Math.random() * 90000)}`,
    factory: factory || '10th of Ramadan',
    department: department || 'Production A',
    position: position || 'Operator',
    supervisor: supervisor || '—',
    phone: phone || '',
    vacationBalance: Number(vacationBalance) || 12,
    pinHash: null,
    active: true,
    createdAt: Date.now(),
  };
  db().employees.push(employee);
  recordAuditLog(db(), {
    actor: req.admin?.sub || 'admin',
    action: 'create_employee',
    targetId: employee.id,
    details: `Created employee ${employee.name} (${employee.employeeCode})`,
    ip: req.ip,
  });
  save();
  res.json({ employee: employeeOut(employee) });
});

router.put('/employees/:id', (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.id);
  if (!employee) return res.status(404).json({ error: 'not_found' });
  const allowed = ['name', 'employeeCode', 'factory', 'department', 'position', 'supervisor', 'phone'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) employee[key] = req.body[key];
  }
  if (req.body?.vacationBalance !== undefined) {
    employee.vacationBalance = Number(req.body.vacationBalance) || 0;
  }
  if (req.body?.resetPin) employee.pinHash = null;

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

router.post('/employees/:id/toggle', (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.id);
  if (!employee) return res.status(404).json({ error: 'not_found' });
  employee.active = !employee.active;
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
router.get('/requests', (req, res) => {
  const withEmployee = db().requests.map((r) => {
    const e = db().employees.find((emp) => emp.id === r.employeeId);
    return { ...r, employeeName: e?.name || '?', employeeCode: e?.employeeCode || '?' };
  });
  withEmployee.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ requests: withEmployee });
});

router.post('/requests/:id/decide', (req, res) => {
  const { status, reason } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status_must_be_approved_or_rejected' });
  }
  const request = db().requests.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'not_found' });
  if (request.status !== 'inReview') {
    return res.status(422).json({ error: 'already_decided' });
  }
  request.status = status;
  request.decisionReason = reason || null;
  request.decidedBy = req.admin?.sub || 'HR Admin';
  request.decidedAt = Date.now();
  request.summary =
    status === 'approved' ? 'Approved by HR' : `Rejected by HR${reason ? ` — ${reason}` : ''}`;

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
router.get('/payroll/:employeeId', (req, res) => {
  const record = db().payroll.find((p) => p.employeeId === req.params.employeeId);
  res.json({ payroll: record || null });
});

router.put('/payroll/:employeeId', (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'employee_not_found' });
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
router.get('/roster/:employeeId', (req, res) => {
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

router.put('/roster/:employeeId', (req, res) => {
  const employee = db().employees.find((e) => e.id === req.params.employeeId);
  if (!employee) return res.status(404).json({ error: 'employee_not_found' });
  const days = req.body?.days;
  if (!Array.isArray(days) || days.length !== 7 ||
      days.some((d) => !['morning', 'evening', 'night', 'off'].includes(d.shift))) {
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
  router.get(`/${name}`, (req, res) => {
    res.json({ items: [...db()[collection]].sort((a, b) => b.createdAt - a.createdAt) });
  });

  router.post(`/${name}`, (req, res) => {
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
        });
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

  router.delete(`/${name}/:id`, (req, res) => {
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
