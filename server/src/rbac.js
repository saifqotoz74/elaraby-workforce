// Granular Role-Based Access Control (RBAC) & Scope Guard Engine
// Defines institutional HR roles, operational permissions, and scope isolation.

const ROLES = {
  SUPER_ADMIN: 'superadmin',
  HR_OFFICER: 'hr_officer',
  PAYROLL_OFFICER: 'payroll_officer',
  SHIFT_SUPERVISOR: 'shift_supervisor',
  ANNOUNCEMENT_MANAGER: 'announcement_manager',
  AUDITOR: 'auditor',
};

const PERMISSIONS = {
  // Employees
  EMPLOYEE_READ: 'employee.read',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_TOGGLE: 'employee.toggle',

  // Leave & Requests
  LEAVE_READ: 'leave.read',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_REJECT: 'leave.reject',

  // Payroll
  PAYROLL_READ: 'payroll.read',
  PAYROLL_UPDATE: 'payroll.update',

  // Shifts / Roster
  SHIFT_READ: 'shift.read',
  SHIFT_UPDATE: 'shift.update',

  // Announcements & Content
  ANNOUNCEMENT_READ: 'announcement.read',
  ANNOUNCEMENT_CREATE: 'announcement.create',
  ANNOUNCEMENT_DELETE: 'announcement.delete',
  CONTENT_MANAGE: 'content.manage',

  // Audit & System
  STATS_READ: 'stats.read',
  AUDIT_READ: 'audit.read',
  CONCERNS_READ: 'concerns.read',
  UPLOAD_IMAGE: 'upload.image',
};

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.HR_OFFICER]: [
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.EMPLOYEE_UPDATE,
    PERMISSIONS.EMPLOYEE_TOGGLE,
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_REJECT,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.STATS_READ,
    PERMISSIONS.CONCERNS_READ,
    PERMISSIONS.UPLOAD_IMAGE,
  ],
  [ROLES.PAYROLL_OFFICER]: [
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.PAYROLL_UPDATE,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.STATS_READ,
  ],
  [ROLES.SHIFT_SUPERVISOR]: [
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.SHIFT_READ,
    PERMISSIONS.SHIFT_UPDATE,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.STATS_READ,
  ],
  [ROLES.ANNOUNCEMENT_MANAGER]: [
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.ANNOUNCEMENT_CREATE,
    PERMISSIONS.ANNOUNCEMENT_DELETE,
    PERMISSIONS.CONTENT_MANAGE,
    PERMISSIONS.UPLOAD_IMAGE,
    PERMISSIONS.STATS_READ,
  ],
  [ROLES.AUDITOR]: [
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.STATS_READ,
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.ANNOUNCEMENT_READ,
  ],
};

function hasPermission(role, permission) {
  if (!role) return false;
  if (role === ROLES.SUPER_ADMIN || role === 'admin') return true;
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(permission);
}

function requirePermission(permission) {
  return (req, res, next) => {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const role = admin.role || ROLES.SUPER_ADMIN;
    if (!hasPermission(role, permission)) {
      return res.status(403).json({
        error: 'forbidden_permission_required',
        requiredPermission: permission,
        currentRole: role,
      });
    }
    next();
  };
}

/**
 * Validates that an administrative actor has authorization over an employee's organizational scope
 * (Factory / Department isolation). Superadmin is unrestricted.
 */
function checkScope(admin, employee) {
  if (!admin || !employee) return true;
  const role = admin.role || ROLES.SUPER_ADMIN;
  if (role === ROLES.SUPER_ADMIN || role === 'admin') return true;

  if (admin.tenantId && employee.tenantId && admin.tenantId !== employee.tenantId) {
    return false;
  }
  if (admin.scopeFactory && employee.factory && admin.scopeFactory !== employee.factory) {
    return false;
  }
  if (admin.scopeDepartment && employee.department && admin.scopeDepartment !== employee.department) {
    return false;
  }
  return true;
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  requirePermission,
  checkScope,
};
