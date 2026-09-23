// Admin Sub-Router: Operations, Workflows, Transport, Hardware & HSE
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

router.get('/requests', requirePermission(PERMISSIONS.LEAVE_READ), (req, res) => {
  res.json(leaveService.listRequests(req.admin, req.query));
});

router.post('/requests/:id/decide', (req, res, next) => {
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

  try {
    const request = leaveService.decideRequest(req.admin, req.params.id, { status, reason }, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ request });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/requests/:id/stages/:stage/decide', async (req, res, next) => {
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

  try {
    const request = leaveService.decideApprovalStage(
      req.admin,
      req.params.id,
      { stage: req.params.stage, status, reason },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.json({ request });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ---------- Shift Swaps Supervisor Decision & Queries ----------

router.get('/transport/fleet', requireAdmin, (req, res) => {
  try {
    const routes = transportService.getRoutes();
    const fleet = routes.map((r) => {
      const telemetry = transportService.getRouteTelemetry(r.id);
      return {
        route: r,
        telemetry,
      };
    });
    res.json({ ok: true, fleet });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/board', (req, res) => {
  try {
    const { qrToken, driverId } = req.body || {};
    if (!qrToken) {
      return res.status(400).json({ error: 'qrToken_required' });
    }
    const boarding = transportService.verifyBoardingPass(driverId, qrToken);
    res.json({ ok: true, boarding });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transport/alerts', requireAdmin, (req, res) => {
  try {
    const { routeId, type, message, delayMinutes } = req.body || {};
    if (!routeId || !message) {
      return res.status(400).json({ error: 'routeId_and_message_required' });
    }
    const alert = transportService.reportRouteAlert({
      routeId,
      type,
      message,
      delayMinutes,
      reportedBy: req.admin?.sub || 'Admin Control Room',
    });
    res.json({ ok: true, alert });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/transport/routes', requireAdmin, (req, res) => {
  try {
    const routes = transportService.getRoutes();
    res.json({ ok: true, routes });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/transport/manifest/:routeId', requireAdmin, (req, res) => {
  try {
    const manifest = transportService.getRouteManifest(req.params.routeId);
    res.json({ ok: true, manifest });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------- Loans & Salary Advances Administration ----------

router.get('/integrations/status', requireAdmin, (req, res) => {
  try {
    const activeAdapter = erp.getActiveAdapter();
    const isConfigured = erp.isConfigured();
    const biometricAdapter = biometrics.getAdapter();

    res.json({
      ok: true,
      erp: {
        activeProvider: (process.env.ERP_PROVIDER || 'mock').toUpperCase(),
        adapterName: activeAdapter.constructor?.name || 'MockErpAdapter',
        configured: isConfigured,
        supportedAdapters: [
          { name: 'SAP S/4HANA (OData v4)', code: 'sap', configured: Boolean(process.env.SAP_ODATA_URL) },
          { name: 'Oracle Cloud HCM REST', code: 'oracle', configured: Boolean(process.env.ORACLE_HCM_URL) },
          { name: 'Enterprise Generic REST', code: 'rest', configured: Boolean(process.env.ERP_BASE_URL) },
          { name: 'Enterprise Sandbox Simulator', code: 'mock', configured: true },
        ],
        lastSync: new Date().toISOString(),
      },
      biometrics: {
        activeDevice: 'ZKTeco Time & Attendance Controller (TCP/IP)',
        driver: biometricAdapter.constructor?.name || 'MockBiometricAdapter',
        status: 'ONLINE',
        lastHeartbeat: new Date().toISOString(),
        queuedPunches: 0,
      },
      reconciliation: {
        status: 'READY',
        lastAudit: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/integrations/sync', requireAdmin, async (req, res) => {
  try {
    const { domain = 'employees', options = {} } = req.body || {};
    const result = await erp.sync(domain, options);

    auditService.recordAuditLog(db(), {
      actor: req.admin?.sub || req.admin?.username || 'admin',
      role: req.admin?.role || 'superadmin',
      action: 'ERP_MANUAL_SYNC',
      entity: 'erp_gateway',
      entityId: domain,
      details: `Manual sync completed for ${domain} (${result.count || 0} records).`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      tenantId: req.tenantId || req.admin?.tenantId || 'elaraby',
    });
    save();

    realtimeService.broadcast('realtime:erp.synced', {
      domain,
      timestamp: Date.now(),
      recordsCount: result.count || 0,
    });

    res.json({
      ok: true,
      domain,
      result,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/integrations/reconciliation', requireAdmin, async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.tenantId || 'elaraby';
    const database = db();
    const internalEmployees = (database.employees || []).filter((e) => {
      const eTenant = e.tenantId || (e.workEmail && e.workEmail.includes('elsewedy') ? 'elsewedy' : e.workEmail && e.workEmail.includes('tmg') ? 'tmg' : 'elaraby');
      return (eTenant === tenantId || req.admin?.role === 'superadmin') && checkScope(req.admin, e);
    });

    const externalRes = await erp.sync('employees');
    const externalRecords = externalRes.records || [];

    const recResult = reconcileEmployees(externalRecords, internalEmployees);

    res.json({
      ok: true,
      reconciliation: {
        totalInternal: internalEmployees.length,
        totalExternal: externalRecords.length,
        missingInInternal: recResult.missingInInternal,
        missingInExternal: recResult.missingInExternal,
        discrepancies: recResult.discrepancies,
        matchedCount: Math.max(0, internalEmployees.length - recResult.missingInExternal.length),
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/integrations/reconciliation/resolve', requireAdmin, (req, res) => {
  try {
    const { action, employeeId, field, value, externalData } = req.body || {};
    const database = db();

    if (action === 'sync_field' && employeeId && field) {
      const emp = database.employees.find((e) => e.id === employeeId);
      if (!emp) return res.status(404).json({ error: 'employee_not_found' });
      const beforeValue = emp[field];
      emp[field] = value;
      emp.updatedAt = new Date().toISOString();
      auditService.recordAuditLog(database, {
        actor: req.admin?.sub || req.admin?.username || 'admin',
        role: req.admin?.role || 'superadmin',
        action: 'ERP_RECONCILIATION_RESOLVE',
        entity: 'employee',
        entityId: employeeId,
        before: { [field]: beforeValue },
        after: { [field]: value },
        details: `ERP Reconciliation resolved field ${field} to "${value}" on employee ${employeeId}`,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        tenantId: req.tenantId || req.admin?.tenantId || 'elaraby',
      });
      save();
      return res.json({ ok: true, resolved: true, employee: emp });
    }

    if (action === 'import_missing' && externalData) {
      const newEmp = {
        id: `emp_erp_${Date.now()}`,
        name: externalData.name || 'ERP Synced Employee',
        nationalId: externalData.nationalId,
        department: externalData.department || 'Operations',
        factory: externalData.factory || 'Qwesna Complex',
        position: 'Operations Specialist',
        baseSalary: 8000,
        vacationBalance: externalData.vacationBalance || 21,
        active: true,
        tenantId: req.tenantId || 'elaraby',
        createdAt: new Date().toISOString(),
      };
      database.employees.push(newEmp);
      auditService.recordAuditLog(database, {
        actor: req.admin?.sub || req.admin?.username || 'admin',
        role: req.admin?.role || 'superadmin',
        action: 'ERP_RECONCILIATION_IMPORT',
        entity: 'employee',
        entityId: newEmp.id,
        after: newEmp,
        details: `ERP Reconciliation imported new employee ${newEmp.name} (${newEmp.nationalId})`,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        tenantId: newEmp.tenantId,
      });
      save();
      return res.json({ ok: true, imported: true, employee: newEmp });
    }

    res.status(400).json({ error: 'invalid_resolution_action' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/integrations/export/schema', requireAdmin, (req, res) => {
  try {
    const system = (req.query.system || req.query.provider || 'sap').toLowerCase().trim();
    const entity = (req.query.entity || req.query.domain || 'employees').toLowerCase().trim();
    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const database = db();

    if (!['sap', 'oracle'].includes(system)) {
      return res.status(400).json({ error: 'invalid_system', message: `System must be 'sap' or 'oracle', got '${system}'` });
    }

    if (!['employees', 'attendance', 'payroll'].includes(entity)) {
      return res.status(400).json({ error: 'invalid_entity', message: `Entity must be 'employees', 'attendance', or 'payroll', got '${entity}'` });
    }

    let records = [];
    if (entity === 'employees') {
      records = (database.employees || []).filter((e) => {
        const eTenant = e.tenantId || (e.workEmail && e.workEmail.includes('elsewedy') ? 'elsewedy' : e.workEmail && e.workEmail.includes('tmg') ? 'tmg' : 'elaraby');
        return (eTenant === tenantId || req.admin?.role === 'superadmin') && checkScope(req.admin, e);
      });
    } else if (entity === 'attendance') {
      const allowedEmployees = new Set(
        (database.employees || [])
          .filter((e) => {
            const eTenant = e.tenantId || (e.workEmail && e.workEmail.includes('elsewedy') ? 'elsewedy' : e.workEmail && e.workEmail.includes('tmg') ? 'tmg' : 'elaraby');
            return (eTenant === tenantId || req.admin?.role === 'superadmin') && checkScope(req.admin, e);
          })
          .map((e) => e.id)
      );
      records = (database.attendanceRecords || []).filter((r) => {
        const rTenant = r.tenantId || 'elaraby';
        return (rTenant === tenantId || req.admin?.role === 'superadmin') && (allowedEmployees.size === 0 || allowedEmployees.has(r.employeeId));
      });
    } else if (entity === 'payroll') {
      const allowedEmployees = new Set(
        (database.employees || [])
          .filter((e) => {
            const eTenant = e.tenantId || (e.workEmail && e.workEmail.includes('elsewedy') ? 'elsewedy' : e.workEmail && e.workEmail.includes('tmg') ? 'tmg' : 'elaraby');
            return (eTenant === tenantId || req.admin?.role === 'superadmin') && checkScope(req.admin, e);
          })
          .map((e) => e.id)
      );
      records = (database.payroll || []).filter((p) => {
        return allowedEmployees.size === 0 || allowedEmployees.has(p.employeeId);
      });
    }

    const exported = erp.exportSchema(system, entity, records, tenantId);

    res.json({
      ok: true,
      system: exported.system,
      entity: exported.entity,
      count: exported.count,
      schemaVersion: exported.schemaVersion,
      records: exported.records,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/integrations/reconciliation/payroll', requireAdmin, (req, res) => {
  try {
    const { externalPayroll, externalSummaries } = req.body || {};
    const externalRecords = Array.isArray(req.body)
      ? req.body
      : (Array.isArray(externalPayroll) ? externalPayroll : (Array.isArray(externalSummaries) ? externalSummaries : []));

    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const database = db();

    const allowedEmployees = new Set(
      (database.employees || [])
        .filter((e) => {
          const eTenant = e.tenantId || (e.workEmail && e.workEmail.includes('elsewedy') ? 'elsewedy' : e.workEmail && e.workEmail.includes('tmg') ? 'tmg' : 'elaraby');
          return (eTenant === tenantId || req.admin?.role === 'superadmin') && checkScope(req.admin, e);
        })
        .map((e) => e.id)
    );

    const internalPayroll = (database.payroll || []).filter((p) => {
      return allowedEmployees.size === 0 || allowedEmployees.has(p.employeeId);
    });

    const result = reconcilePayroll(externalRecords, internalPayroll);

    auditService.recordAuditLog(database, {
      actor: req.admin?.sub || req.admin?.username || 'admin',
      role: req.admin?.role || 'superadmin',
      action: 'ERP_RECONCILIATION_PAYROLL',
      entity: 'payroll',
      entityId: `rec_pay_${Date.now()}`,
      details: `Payroll reconciliation: ${result.matchedCount} matched, ${result.mismatchCount} discrepancies, ${result.missingInInternalCount} missing in internal.`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      tenantId,
    });
    save();

    const auditLogId = database.auditLogs?.[0]?.id || `audit_${Date.now()}`;

    res.json({
      ok: true,
      matchedCount: result.matchedCount,
      mismatchCount: result.mismatchCount,
      discrepancies: result.discrepancies,
      auditLogId,
      totalCompared: result.totalExternal,
      isSynchronized: result.isSynchronized,
      missingInInternal: result.missingInInternal,
      missingInExternal: result.missingInExternal,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/integrations/reconciliation/attendance', requireAdmin, (req, res) => {
  try {
    const { externalAttendance, externalPunches } = req.body || {};
    const externalRecords = Array.isArray(req.body)
      ? req.body
      : (Array.isArray(externalAttendance) ? externalAttendance : (Array.isArray(externalPunches) ? externalPunches : []));

    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const database = db();

    const allowedEmployees = new Set(
      (database.employees || [])
        .filter((e) => {
          const eTenant = e.tenantId || (e.workEmail && e.workEmail.includes('elsewedy') ? 'elsewedy' : e.workEmail && e.workEmail.includes('tmg') ? 'tmg' : 'elaraby');
          return (eTenant === tenantId || req.admin?.role === 'superadmin') && checkScope(req.admin, e);
        })
        .map((e) => e.id)
    );

    const internalAttendance = (database.attendanceRecords || []).filter((r) => {
      const rTenant = r.tenantId || 'elaraby';
      return (rTenant === tenantId || req.admin?.role === 'superadmin') && (allowedEmployees.size === 0 || allowedEmployees.has(r.employeeId));
    });

    const result = reconcileAttendance(externalRecords, internalAttendance);

    auditService.recordAuditLog(database, {
      actor: req.admin?.sub || req.admin?.username || 'admin',
      role: req.admin?.role || 'superadmin',
      action: 'ERP_RECONCILIATION_ATTENDANCE',
      entity: 'attendance',
      entityId: `rec_att_${Date.now()}`,
      details: `Attendance reconciliation: ${result.matchedCount} matched, ${result.mismatchCount} discrepancies, ${result.missingInInternalCount} missing in internal.`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      tenantId,
    });
    save();

    const auditLogId = database.auditLogs?.[0]?.id || `audit_${Date.now()}`;

    res.json({
      ok: true,
      matchedCount: result.matchedCount,
      mismatchCount: result.mismatchCount,
      discrepancies: result.discrepancies,
      auditLogId,
      totalCompared: result.totalExternal,
      isSynchronized: result.isSynchronized,
      missingInInternal: result.missingInInternal,
      missingInExternal: result.missingInExternal,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------- Automated Manager Alerts & Notification Engine ----------

router.get('/access-control/devices', requireAdmin, (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const devices = accessControl.getDevices(req.admin?.role === 'superadmin' ? null : tenantId);
    res.json({ ok: true, devices });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/access-control/devices/:id/heartbeat', requireAdmin, (req, res) => {
  try {
    const { latencyMs = 15, isSuccess = true } = req.body || {};
    const updated = accessControl.recordHeartbeat(req.params.id, latencyMs, isSuccess);
    if (!updated) return res.status(404).json({ error: 'Device not found' });
    res.json({ ok: true, device: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/access-control/emergency-override', requireAdmin, (req, res) => {
  try {
    const { factory = 'all', action = 'UNLOCK_ALL' } = req.body || {};
    const tenantId = req.body.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const result = accessControl.emergencyOverride({
      tenantId,
      factory,
      action,
      adminId: req.admin?.sub || req.admin?.username || 'admin',
    });

    auditService.recordAuditLog(db(), {
      actor: req.admin?.sub || req.admin?.username || 'admin',
      role: req.admin?.role || 'superadmin',
      action: `ACCESS_CONTROL_OVERRIDE_${action}`,
      entity: 'access_control',
      details: `Emergency override ${action} executed for factory ${factory} across ${result.affectedDeviceCount} devices. Execution: ${result.executionLatencyMs}ms.`,
    });

    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/access-control/emergency-state', requireAdmin, (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const state = accessControl.getEmergencyState(tenantId);
    res.json({ ok: true, state });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/access-control/apb/validate', requireAdmin, (req, res) => {
  try {
    const { employeeId, direction = 'IN', gateId = 'GATE_1', mode = 'strict', timestamp } = req.body || {};
    const tenantId = req.body.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const result = accessControl.validateAntiPassback({
      tenantId,
      employeeId,
      direction,
      gateId,
      mode,
      timestamp,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/access-control/apb/reset', requireAdmin, (req, res) => {
  try {
    const { employeeId, resetState = 'OUT', reason = 'Manual Reset' } = req.body || {};
    const tenantId = req.body.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const result = accessControl.resetAntiPassbackState(tenantId, employeeId, resetState, reason);

    auditService.recordAuditLog(db(), {
      actor: req.admin?.sub || req.admin?.username || 'admin',
      role: req.admin?.role || 'superadmin',
      action: 'ACCESS_CONTROL_APB_RESET',
      entity: 'access_control',
      details: `Reset APB state for ${employeeId} to ${resetState}. Reason: ${reason}`,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/access-control/apb/violations', requireAdmin, (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.tenantId || req.admin?.tenantId || 'elaraby';
    const violations = accessControl.getAntiPassbackViolations(req.admin?.role === 'superadmin' ? null : tenantId);
    res.json({ ok: true, count: violations.length, violations });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/access-control/events/hikvision', (req, res) => {
  try {
    const parsed = accessControl.parseHikvisionJsonEvent(req.body);
    res.json({ ok: true, received: true, event: parsed });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ---------- AI Predictive Analytics ----------

router.get('/hse/summary', requireAdmin, requirePermission('hse.read'), async (req, res) => {
  try {
    const summary = await hseService.getHseSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

router.get('/hse/permits', requireAdmin, requirePermission('hse.read'), async (req, res) => {
  try {
    const permits = await hseService.listPermits(req.query);
    res.json({ success: true, data: permits });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

router.post('/hse/permits/:id/decide', requireAdmin, requirePermission('hse.approve'), async (req, res) => {
  try {
    const { decision, reason } = req.body;
    if (!decision) return res.status(400).json({ success: false, message: 'decision_required' });
    const reviewer = req.admin?.sub || req.admin?.name || 'HSE Officer';
    const updated = await hseService.decidePermit(req.params.id, decision, { reviewer, reason });
    if (!updated) return res.status(404).json({ success: false, message: 'permit_not_found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

router.get('/hse/incidents', requireAdmin, requirePermission('hse.read'), async (req, res) => {
  try {
    const incidents = await hseService.listIncidents();
    res.json({ success: true, data: incidents });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

router.post('/hse/ppe-inspection', requireAdmin, requirePermission('hse.read'), async (req, res) => {
  try {
    const { line, checklist } = req.body;
    const record = await hseService.submitPpeInspection(line, checklist);
    res.json({ success: true, data: record });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

// ---------- Incentives & Deductions Admin Routes ----------

module.exports = router;
