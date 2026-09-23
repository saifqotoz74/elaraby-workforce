// Admin Sub-Router: Employee Management
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

// ---------- Employees ----------
router.get('/employees', requirePermission(PERMISSIONS.EMPLOYEE_READ), (req, res) => {
  res.json(employeeService.listEmployees(req.admin, req.query));
});

router.get('/employees/import-template', requirePermission(PERMISSIONS.EMPLOYEE_CREATE), (req, res, next) => {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const template = workerImportService.generateTemplate(format === 'csv' ? 'csv' : 'xlsx');
    res.setHeader('Content-Type', template.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
    res.send(template.buffer);
  } catch (err) {
    next(err);
  }
});

router.post('/employees/import-bulk', requirePermission(PERMISSIONS.EMPLOYEE_CREATE), subscriptionGuard, async (req, res, next) => {
  try {
    const tenantId = (req.admin?.tenantId || getCurrentTenantId() || 'elaraby').toString().trim().toLowerCase();

    // Check seat limit
    const d = db();
    const allTenants = [...Object.values(BUILTIN_TENANTS), ...(d.tenants || [])];
    const tenant = allTenants.find((t) => t.id === tenantId || t.slug === tenantId);
    const maxEmployees = tenant?.maxEmployees || null;

    if (maxEmployees && maxEmployees > 0) {
      const activeCount = (d.employees || []).filter(
        (e) => (e.tenantId || 'elaraby').toLowerCase() === tenantId && e.status !== 'terminated' && e.active !== false
      ).length;

      if (activeCount >= maxEmployees) {
        return res.status(403).json({
          error: 'seat_limit_exceeded',
          message: `Your organization's license allows a maximum of ${maxEmployees} active employees. Current count: ${activeCount}. Please contact your platform administrator to upgrade your subscription.`,
          currentCount: activeCount,
          maxAllowed: maxEmployees,
        });
      }
    }

    let fileBufferOrString = null;
    let filename = 'workers.csv';

    if (req.body && typeof req.body === 'object') {
      if (req.body.dataBase64) {
        fileBufferOrString = Buffer.from(req.body.dataBase64.replace(/^data:.*?;base64,/, ''), 'base64');
        filename = req.body.filename || 'workers.xlsx';
      } else if (req.body.csv) {
        fileBufferOrString = req.body.csv;
        filename = req.body.filename || 'workers.csv';
      } else if (req.body.file) {
        fileBufferOrString = Buffer.from(req.body.file, 'base64');
        filename = req.body.filename || 'workers.xlsx';
      }
    }

    if (!fileBufferOrString) {
      if (typeof req.body === 'string' && req.body.length > 0) {
        fileBufferOrString = req.body;
      } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        fileBufferOrString = req.body;
      }
    }

    if (!fileBufferOrString) {
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', (c) => chunks.push(c));
        req.on('end', resolve);
        req.on('error', reject);
      });
      if (chunks.length > 0) {
        fileBufferOrString = Buffer.concat(chunks);
      }
    }

    if (!fileBufferOrString) {
      return res.status(400).json({ error: 'file_required', message: 'No file or CSV data uploaded' });
    }

    const result = await workerImportService.importWorkers(req.admin, fileBufferOrString, {
      filename,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/employees/:id', requirePermission(PERMISSIONS.EMPLOYEE_READ), (req, res, next) => {
  try {
    const employee = employeeService.getEmployee(req.admin, req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'employee_not_found' });
    }
    res.json({ employee });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/employees', requirePermission(PERMISSIONS.EMPLOYEE_CREATE), subscriptionGuard, (req, res, next) => {
  try {
    // ── Seat Limit Enforcement ────────────────────────────────────────────────
    // Resolve the current tenant's seat cap from BUILTIN_TENANTS or db tenants.
    const tenantId = req.admin?.tenantId || null;
    if (tenantId) {
      const d = db();
      const allTenants = [...Object.values(BUILTIN_TENANTS), ...(d.tenants || [])];
      const tenant = allTenants.find((t) => t.id === tenantId || t.slug === tenantId);
      const maxEmployees = tenant?.maxEmployees || null;

      if (maxEmployees && maxEmployees > 0) {
        const activeCount = (d.employees || []).filter(
          (e) => e.tenantId === tenantId && e.status !== 'terminated' && e.active !== false
        ).length;

        if (activeCount >= maxEmployees) {
          return res.status(403).json({
            error: 'seat_limit_exceeded',
            message: `Your organization's license allows a maximum of ${maxEmployees} active employees. Current count: ${activeCount}. Please contact your platform administrator to upgrade your subscription.`,
            currentCount: activeCount,
            maxAllowed: maxEmployees,
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const employee = employeeService.createEmployee(req.admin, req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({ employee });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.put('/employees/:id', requirePermission(PERMISSIONS.EMPLOYEE_UPDATE), (req, res, next) => {
  try {
    const employee = employeeService.updateEmployee(req.admin, req.params.id, req.body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ employee });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/employees/:id/toggle', requirePermission(PERMISSIONS.EMPLOYEE_TOGGLE), (req, res, next) => {
  try {
    const employee = employeeService.toggleEmployee(req.admin, req.params.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ employee });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ---------- Requests ----------

module.exports = router;
