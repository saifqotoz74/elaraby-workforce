'use strict';

/**
 * Access Control Gateway Express Routes
 *
 * Exposes endpoints for:
 * - POST /api/admin/access-control/emergency-override (<50ms SLA)
 * - GET  /api/admin/access-control/devices (turnstile health telemetry)
 * - POST /api/admin/access-control/apb/reset (admin APB reset)
 * - POST /api/admin/access-control/apb/validate (APB punch validation)
 * - GET  /api/admin/access-control/apb/violations (APB violation audit log)
 * - POST /api/integrations/access_control/verify-qr (rotating QR pass verification)
 * - POST /api/admin/access-control/devices/:id/heartbeat (telemetry heartbeat update)
 */

const express = require('express');
const { requireAdmin } = require('../auth');
const {
  EmergencyOverrideService,
  defaultRegistry,
  defaultMonitor,
  AntiPassbackEngine,
  RotatingQrService,
  HikvisionIsapiParser,
} = require('../integrations/access_control');

const router = express.Router();

function getTenantId(req) {
  return (
    req.body?.tenantId ||
    req.query?.tenantId ||
    req.headers?.['x-tenant-id'] ||
    req.tenantId ||
    req.admin?.tenantId ||
    'elaraby'
  );
}

// ---------------------------------------------------------------------------
// 1. Emergency Gate Override (<50ms SLA)
// ---------------------------------------------------------------------------
router.post(
  [
    '/emergency-override',
    '/access-control/emergency-override',
    '/admin/access-control/emergency-override',
    '/api/admin/access-control/emergency-override',
  ],
  requireAdmin,
  async (req, res) => {
    try {
      const {
        factory = 'all',
        factoryId,
        action = 'UNLOCK_ALL',
        autoRevertSeconds = 3600,
        deviceCount,
      } = req.body || {};

      const tenantId = getTenantId(req);
      const adminId = req.admin?.sub || req.admin?.username || 'admin';

      const result = await EmergencyOverrideService.executeOverride({
        tenantId,
        factory: factoryId || factory,
        factoryId: factoryId || factory,
        action,
        triggeredBy: adminId,
        adminId,
        autoRevertSeconds,
        deviceCount,
      });

      res.status(200).json(result);
    } catch (err) {
      res.status(err.statusCode || 400).json({ ok: false, error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// 2. Turnstile Devices Telemetry & Health
// ---------------------------------------------------------------------------
router.get(
  [
    '/devices',
    '/access-control/devices',
    '/admin/access-control/devices',
    '/api/admin/access-control/devices',
  ],
  requireAdmin,
  (req, res) => {
    try {
      const tenantId = req.admin?.role === 'superadmin' && !req.query.tenantId ? null : getTenantId(req);
      const devices = defaultRegistry.getDevices(tenantId);
      res.status(200).json({ ok: true, devices });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// 3. Heartbeat Recording Endpoint
// ---------------------------------------------------------------------------
router.post(
  [
    '/devices/:id/heartbeat',
    '/access-control/devices/:id/heartbeat',
    '/admin/access-control/devices/:id/heartbeat',
    '/api/admin/access-control/devices/:id/heartbeat',
  ],
  requireAdmin,
  (req, res) => {
    try {
      const { latencyMs = 15, isSuccess = true } = req.body || {};
      const updated = defaultMonitor.recordHeartbeat(req.params.id, latencyMs, isSuccess);
      if (!updated) {
        return res.status(404).json({ ok: false, error: 'Device not found' });
      }
      res.status(200).json({ ok: true, device: updated });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// 4. Anti-Passback Admin Reset
// ---------------------------------------------------------------------------
router.post(
  [
    '/apb/reset',
    '/access-control/apb/reset',
    '/admin/access-control/apb/reset',
    '/api/admin/access-control/apb/reset',
  ],
  requireAdmin,
  (req, res) => {
    try {
      const { employeeId, resetState = 'OUT', reason = 'Manual Reset' } = req.body || {};
      if (!employeeId) {
        return res.status(400).json({ ok: false, error: 'employeeId is required' });
      }

      const tenantId = getTenantId(req);
      const result = AntiPassbackEngine.resetAntiPassbackState(tenantId, employeeId, resetState, reason);

      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// 5. Anti-Passback Punch Validation
// ---------------------------------------------------------------------------
router.post(
  [
    '/apb/validate',
    '/access-control/apb/validate',
    '/admin/access-control/apb/validate',
    '/api/admin/access-control/apb/validate',
  ],
  requireAdmin,
  (req, res) => {
    try {
      const {
        employeeId,
        direction = 'IN',
        gateId = 'GATE_1',
        mode = 'strict',
        timestamp,
        zoneId,
      } = req.body || {};

      const tenantId = getTenantId(req);
      const result = AntiPassbackEngine.validatePunch({
        tenantId,
        zoneId,
        employeeId,
        direction,
        gateId,
        mode,
        timestamp,
      });

      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// 6. Anti-Passback Violations Audit Log
// ---------------------------------------------------------------------------
router.get(
  [
    '/apb/violations',
    '/access-control/apb/violations',
    '/admin/access-control/apb/violations',
    '/api/admin/access-control/apb/violations',
  ],
  requireAdmin,
  (req, res) => {
    try {
      const tenantId = req.admin?.role === 'superadmin' && !req.query.tenantId ? null : getTenantId(req);
      const violations = AntiPassbackEngine.getViolations(tenantId);
      res.status(200).json({ ok: true, count: violations.length, violations });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// 7. Verify Rotating QR Gate-Pass Token
// ---------------------------------------------------------------------------
router.post(
  [
    '/verify-qr',
    '/access-control/verify-qr',
    '/integrations/access_control/verify-qr',
    '/api/integrations/access_control/verify-qr',
  ],
  (req, res) => {
    try {
      const { token, qrData, expectedEmployeeId } = req.body || {};
      const targetToken = token || qrData;
      if (!targetToken) {
        return res.status(400).json({ ok: false, valid: false, reason: 'EMPTY_TOKEN' });
      }

      const tenantId = getTenantId(req);
      const result = RotatingQrService.verifyGatePassToken({
        token: targetToken,
        expectedEmployeeId,
        tenantId,
      });

      if (!result.valid) {
        return res.status(200).json({ ok: false, ...result });
      }

      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, valid: false, error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// 8. Emergency State Query
// ---------------------------------------------------------------------------
router.get(
  [
    '/emergency-state',
    '/access-control/emergency-state',
    '/admin/access-control/emergency-state',
    '/api/admin/access-control/emergency-state',
  ],
  requireAdmin,
  (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const state = EmergencyOverrideService.getEmergencyState(tenantId);
      res.status(200).json({ ok: true, state });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// 9. Hikvision Webhook Ingestion
// ---------------------------------------------------------------------------
router.post(
  [
    '/hikvision/event',
    '/access-control/hikvision/event',
    '/integrations/access_control/hikvision/event',
    '/api/integrations/access_control/hikvision/event',
  ],
  (req, res) => {
    try {
      const parsed = HikvisionIsapiParser.parseEvent(
        req.body,
        req.headers['content-type'] || 'application/json',
      );
      res.status(200).json({ ok: true, event: parsed });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
);

module.exports = router;
