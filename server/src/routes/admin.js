// Admin API Master Router: HR Dashboard operations aggregated across modular domain services.
// Decomposed into dedicated domain sub-routers under server/src/routes/admin/
// Preserves 100% of existing API contracts, RBAC permissions, and AsyncLocalStorage tenant context.

const express = require('express');
const subscriptionService = require('../services/subscriptionService');
const { BUILTIN_TENANTS } = require('./tenant');

// Start daily subscription expiry alert scheduler (non-blocking)
subscriptionService.startAlertScheduler();

const router = express.Router();

// Mount Domain Sub-Routers
const adminAuthRoutes = require('./admin/adminAuth');
const adminEmployeesRoutes = require('./admin/adminEmployees');
const adminPayrollRoutes = require('./admin/adminPayroll');
const adminAttendanceRoutes = require('./admin/adminAttendance');
const adminOperationsRoutes = require('./admin/adminOperations');

router.use(adminAuthRoutes);
router.use(adminEmployeesRoutes);
router.use(adminPayrollRoutes);
router.use(adminAttendanceRoutes);
router.use(adminOperationsRoutes);

// Export router with backwards-compatible helper attachments
router.ensureSeedAdmin = adminAuthRoutes.ensureSeedAdmin;
module.exports = router;
module.exports.ensureSeedAdmin = adminAuthRoutes.ensureSeedAdmin;
module.exports.BUILTIN_TENANTS = BUILTIN_TENANTS;
