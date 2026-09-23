// Employee-facing API Master Router: Aggregates domain sub-routers
// Decomposed into dedicated domain sub-routers under server/src/routes/employee/
// Preserves 100% of existing API contracts, rate limiting, and AsyncLocalStorage tenant context.

const express = require('express');
const router = express.Router();

const employeeAuthRoutes = require('./employee/employeeAuth');
const employeeRequestsRoutes = require('./employee/employeeRequests');
const employeeAttendanceRoutes = require('./employee/employeeAttendance');
const employeePayrollRoutes = require('./employee/employeePayroll');
const employeeOperationsRoutes = require('./employee/employeeOperations');

router.use(employeeAuthRoutes);
router.use(employeeRequestsRoutes);
router.use(employeeAttendanceRoutes);
router.use(employeePayrollRoutes);
router.use(employeeOperationsRoutes);

// Exports & Helper attachments
router.publicEmployee = employeeAuthRoutes.publicEmployee;
router.myRequests = employeeRequestsRoutes.myRequests;

module.exports = router;
module.exports.publicEmployee = employeeAuthRoutes.publicEmployee;
module.exports.myRequests = employeeRequestsRoutes.myRequests;
