// Admin Sub-Router: Attendance, Roster & Shifts
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

router.use(requireAdmin);

router.get('/shifts/swaps', requirePermission(PERMISSIONS.SHIFT_READ), (req, res, next) => {
  try {
    const { status, factory, department } = req.query || {};
    const tenantId = req.tenantId || req.admin?.tenantId || 'elaraby';
    let swaps = db().shiftSwaps || [];

    swaps = swaps.filter((s) => {
      if (s.tenantId && s.tenantId !== tenantId && req.admin?.role !== 'superadmin') return false;
      if (status && status !== 'all' && s.status !== status) return false;
      return true;
    });

    const employees = db().employees || [];
    const enrichedSwaps = swaps.map((s) => {
      const empA = employees.find((e) => e.id === s.requesterEmployeeId || e.id === s.employeeId);
      const empB = employees.find((e) => e.id === s.targetEmployeeId);
      return {
        ...s,
        requesterName: s.requesterName || empA?.name || s.requesterEmployeeId,
        targetName: s.targetName || empB?.name || s.targetEmployeeId,
        factory: empA?.factory || '—',
        department: empA?.department || '—',
      };
    });

    const stats = {
      total: enrichedSwaps.length,
      pending: enrichedSwaps.filter((s) => s.status === 'supervisor_pending' || s.status === 'colleague_pending' || s.status === 'pending').length,
      approved: enrichedSwaps.filter((s) => s.status === 'approved').length,
      rejected: enrichedSwaps.filter((s) => String(s.status).includes('rejected') || String(s.status).includes('declined')).length,
    };

    res.json({ swaps: enrichedSwaps, stats });
  } catch (err) {
    next(err);
  }
});

router.post('/shifts/swap-direct', requirePermission(PERMISSIONS.SHIFT_UPDATE), (req, res, next) => {
  try {
    const { employeeAId, employeeBId, date, reason } = req.body || {};
    if (!employeeAId || !employeeBId || !date) {
      return res.status(400).json({ error: 'employeeAId, employeeBId, and date are required' });
    }

    const swapRecord = shiftService.createSwapRequest(employeeAId, {
      targetEmployeeId: employeeBId,
      date,
      reason: reason || 'Direct Supervisor Schedule Adjustment',
    });

    shiftService.respondSwapRequest(employeeBId, swapRecord.id, 'accept');
    const decided = shiftService.decideSwapSupervisor(
      req.admin?.username || 'admin',
      swapRecord.id,
      'approved',
      reason || 'Direct supervisor approval',
    );

    res.json({ ok: true, swap: decided });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

router.post('/shifts/swaps/:id/decide', (req, res, next) => {
  const { decision, notes } = req.body || {};
  try {
    const swap = shiftService.decideSwapSupervisor(
      req.admin?.username || 'admin',
      req.params.id,
      decision,
      notes,
    );
    res.json({ ok: true, swap });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ---------- Overtime Supervisor Decision & Queries ----------
router.get('/overtime', requirePermission(PERMISSIONS.SHIFT_READ), (req, res, next) => {
  try {
    const { status, factory, department, limit } = req.query || {};
    const tenantId = req.tenantId || req.admin?.tenantId || 'elaraby';
    let claims = db().overtimeClaims || [];

    const employees = db().employees || [];
    claims = claims.filter((c) => {
      if (c.tenantId && c.tenantId !== tenantId && req.admin?.role !== 'superadmin') return false;
      if (status && status !== 'all' && c.status !== status) return false;
      if (factory && factory !== 'all' && c.factory !== factory) return false;
      if (department && department !== 'all' && c.department !== department) return false;
      return true;
    });

    const enrichedClaims = claims.map((c) => {
      const emp = employees.find((e) => e.id === c.employeeId);
      return {
        ...c,
        employeeName: c.employeeName || emp?.name || c.employeeId,
        employeeCode: emp?.employeeCode || '—',
        factory: c.factory || emp?.factory || '—',
        department: c.department || emp?.department || '—',
      };
    });

    const stats = {
      total: enrichedClaims.length,
      pending: enrichedClaims.filter((c) => c.status === 'pending_supervisor' || c.status === 'pending').length,
      approved: enrichedClaims.filter((c) => c.status === 'approved').length,
      rejected: enrichedClaims.filter((c) => c.status === 'rejected').length,
    };

    let result = enrichedClaims;
    if (limit) {
      result = result.slice(0, parseInt(limit, 10));
    }

    res.json({ claims: result, stats });
  } catch (err) {
    next(err);
  }
});

router.post('/overtime/:id/decide', (req, res, next) => {
  const { decision, notes } = req.body || {};
  try {
    const claim = overtimeService.decideOvertime(req.params.id, decision, {
      reviewer: req.admin?.username || 'Supervisor',
      notes,
    });
    res.json({ ok: true, claim });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ---------- Payroll ----------
// ---------- Payroll: Batch Payslips ZIP Archive ----------
// MUST be registered BEFORE /payroll/:employeeId

router.get('/rosters', requirePermission(PERMISSIONS.SHIFT_READ), (req, res, next) => {
  try {
    const { factory, department, search, weekStart } = req.query || {};
    const targetWeekStart = weekStart || shiftService.getWeekStart();
    const database = db();
    let employees = database.employees || [];

    const tenantId = req.tenantId || req.admin?.tenantId || 'elaraby';
    employees = employees.filter((emp) => {
      const eTenant = emp.tenantId || (emp.workEmail && emp.workEmail.includes('elsewedy') ? 'elsewedy' : emp.workEmail && emp.workEmail.includes('tmg') ? 'tmg' : 'elaraby');
      if (eTenant !== tenantId && req.admin?.role !== 'superadmin') return false;
      if (factory && factory !== 'all' && emp.factory !== factory) return false;
      if (department && department !== 'all' && emp.department !== department) return false;
      if (search) {
        const q = search.toLowerCase().trim();
        const matchName = (emp.name || '').toLowerCase().includes(q);
        const matchCode = (emp.employeeCode || '').toLowerCase().includes(q);
        const matchNat = (emp.nationalId || '').includes(q);
        if (!matchName && !matchCode && !matchNat) return false;
      }
      return checkScope(req.admin, emp);
    });

    const sundayDate = new Date(targetWeekStart + 'T00:00:00');
    const rosterRecords = database.roster || [];

    const rosters = employees.map((emp) => {
      const saved = rosterRecords.find((r) => r.employeeId === emp.id && r.weekStart === targetWeekStart);
      if (saved && saved.days && saved.days.length === 7) {
        return {
          employeeId: emp.id,
          employee: {
            id: emp.id,
            name: emp.name,
            employeeCode: emp.employeeCode || (emp.nationalId ? emp.nationalId.slice(-4) : '—'),
            factory: emp.factory,
            department: emp.department,
            position: emp.position,
          },
          weekStart: targetWeekStart,
          days: saved.days,
          isCustom: true,
        };
      }

      const generated = shiftService.getRosterForWeek(emp, sundayDate);
      return {
        employeeId: emp.id,
        employee: {
          id: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode || (emp.nationalId ? emp.nationalId.slice(-4) : '—'),
          factory: emp.factory,
          department: emp.department,
          position: emp.position,
        },
        weekStart: targetWeekStart,
        days: generated.map((d, idx) => ({ dayIndex: idx, shift: d.shift, date: d.date })),
        isCustom: false,
      };
    });

    const conflictEval = shiftService.evaluateRosterConflicts(
      rosters.map((r) => {
        const shifts = {};
        const daysArr = r.days || [];
        const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        daysArr.forEach((d, idx) => {
          shifts[daysMap[idx] || `day_${idx}`] = d.shift || 'off';
        });
        return {
          employeeId: r.employeeId,
          employeeName: r.employee?.name,
          shifts,
        };
      })
    );

    res.json({
      ok: true,
      weekStart: targetWeekStart,
      rosters,
      conflicts: conflictEval.conflicts,
      dailyHeadcount: conflictEval.dailyHeadcount,
      lineBalanceScore: Math.max(80, Math.round(100 - conflictEval.conflicts.length * 5)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/roster/:employeeId', requirePermission(PERMISSIONS.SHIFT_READ), (req, res, next) => {
  try {
    const roster = shiftService.getRoster(req.admin, req.params.employeeId);
    res.json(roster);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.put('/roster/:employeeId', requirePermission(PERMISSIONS.SHIFT_UPDATE), (req, res, next) => {
  try {
    const roster = shiftService.updateRoster(req.admin, req.params.employeeId, req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ roster });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ---------- Content: announcements / news / benefits / trips ----------
function crudFor(name, collection) {
  const isAnnounce = collection === 'announcements';
  const readPerm = PERMISSIONS.ANNOUNCEMENT_READ;
  const createPerm = isAnnounce ? PERMISSIONS.ANNOUNCEMENT_CREATE : PERMISSIONS.CONTENT_MANAGE;
  const deletePerm = isAnnounce ? PERMISSIONS.ANNOUNCEMENT_DELETE : PERMISSIONS.CONTENT_MANAGE;

  router.get(`/${name}`, requirePermission(readPerm), (req, res) => {
    res.json(announcementService.listContent(collection, req.query));
  });

  router.post(`/${name}`, requirePermission(createPerm), (req, res) => {
    const item = announcementService.createContent(req.admin, collection, req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ item });
  });

  router.delete(`/${name}/:id`, requirePermission(deletePerm), (req, res, next) => {
    try {
      const result = announcementService.deleteContent(req.admin, collection, req.params.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      next(err);
    }
  });
}

crudFor('announcements', 'announcements');
crudFor('news', 'news');
crudFor('benefits', 'benefits');
crudFor('trips', 'trips');

// ---------- APM Metrics & System Telemetry ----------

router.get('/attendance/today', requireAdmin, (req, res) => {
  try {
    const { factory, tenantId, limit } = req.query || {};
    const attendance = attendanceService.getAdminTodayAttendance({
      factory,
      tenantId: tenantId || req.tenantId,
      limit: limit ? Number(limit) : 100,
    });
    res.json({ ok: true, ...attendance });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------- Executive Reports & Analytics Engine ----------

router.post('/rosters/auto-generate', requireAdmin, (req, res) => {
  try {
    const { factory, department, weekStart, lineQuotas } = req.body || {};
    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const result = shiftService.generateSmartRoster({
      tenantId,
      factory,
      department,
      weekStart,
      lineQuotas,
    });
    res.json({
      ok: true,
      generatedRosters: result.rosters,
      conflictsResolved: result.conflictsResolved,
      remainingConflicts: result.remainingConflicts,
      lineBalanceScore: result.lineBalanceScore,
      dailyHeadcount: result.dailyHeadcount,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/rosters/optimize', requireAdmin, (req, res) => {
  try {
    const { rosters, lineQuotas, weekStart } = req.body || {};
    const result = shiftService.optimizeRoster({ rosters, lineQuotas, weekStart });
    res.json({
      ok: true,
      optimizedRosters: result.optimizedRosters,
      adjustmentsMade: result.adjustmentsMade,
      totalConflictsRemaining: result.totalConflictsRemaining,
      remainingConflicts: result.remainingConflicts,
      lineBalanceScore: result.lineBalanceScore,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.put('/rosters/bulk', requireAdmin, (req, res) => {
  try {
    const { rosters } = req.body || {};
    const result = shiftService.bulkSaveRosters(req.admin, rosters, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true, updatedCount: result.updatedCount });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------- Access Control & IoT Turnstiles ----------

router.get('/analytics/predictive/absenteeism', requireAdmin, (req, res) => {
  try {
    const { factory = 'all', line = 'all', date } = req.query || {};
    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const forecast = predictiveAnalytics.predictShiftAbsenteeism({
      tenantId,
      factory,
      line,
      targetDate: date || new Date().toISOString().split('T')[0],
    });
    res.json(forecast);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/analytics/predictive/overtime-drift', requireAdmin, (req, res) => {
  try {
    const { month, budgetLimit } = req.query || {};
    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const drift = predictiveAnalytics.forecastOvertimeDrift({
      tenantId,
      month: month || new Date().toISOString().substring(0, 7),
      budgetLimitEgp: budgetLimit ? Number(budgetLimit) : 150000,
    });
    res.json(drift);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/analytics/predictive/recommend-backfill', requireAdmin, (req, res) => {
  try {
    const { factory = 'all', line = 'all', shift = 'morning', date, requiredCount = 2 } = req.body || {};
    const tenantId = req.body.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const recommendations = predictiveAnalytics.recommendCrewBackfill({
      tenantId,
      factory,
      line,
      shift,
      date: date || new Date().toISOString().split('T')[0],
      requiredCount: Number(requiredCount),
    });
    res.json(recommendations);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------- Executive Fast BI Analytics Ecosystem ----------

router.post('/roster/solve', requireAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenantId || req.tenantId || 'elaraby';
    const { weekStart, includeOvertime = false, includeSaturday = false } = req.body;
    if (!weekStart) return res.status(400).json({ success: false, message: 'weekStart required (ISO date)' });
    const result = rosterSolverService.solveRoster(tenantId, weekStart, { includeOvertime, includeSaturday });
    // Save to DB
    const database = db();
    database.roster = database.roster.filter(r => r.tenantId !== tenantId || !r.id.includes(weekStart.substring(0, 10)));
    database.roster.push(...result.roster);
    save();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/roster/week?weekStart=2026-09-21
router.get('/roster/week', requireAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenantId || req.tenantId || 'elaraby';
    const { weekStart } = req.query;
    if (!weekStart) return res.status(400).json({ success: false, message: 'weekStart query required' });
    const database = db();
    const weekPrefix = weekStart.substring(0, 10);
    const entries = database.roster.filter(r => r.tenantId === tenantId && r.id.includes(weekPrefix));
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/roster/export?weekStart=2026-09-21&format=csv
router.get('/roster/export', requireAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenantId || req.tenantId || 'elaraby';
    const { weekStart, format = 'csv' } = req.query;
    const database = db();
    const weekPrefix = weekStart.substring(0, 10);
    const entries = database.roster.filter(r => r.tenantId === tenantId && r.id.includes(weekPrefix));
    const employees = database.employees.filter(e => e.tenantId === tenantId || !e.tenantId);
    if (format === 'csv') {
      const csv = rosterSolverService.exportRosterToCsv(entries, employees);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=roster-${weekPrefix}.csv`);
      res.send(csv);
    } else {
      res.json({ success: true, data: entries });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- HSE Safety Admin Routes ----------

module.exports = router;
