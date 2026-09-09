// Central Reactive Store for HR Admin Dashboard

const ROLE_PERMISSIONS = {
  superadmin: ['*'],
  admin: ['*'],
  hr_officer: [
    'employee.read', 'employee.create', 'employee.update', 'employee.toggle',
    'leave.read', 'leave.approve', 'leave.reject', 'announcement.read',
    'stats.read', 'concerns.read', 'upload.image',
  ],
  payroll_officer: [
    'employee.read', 'payroll.read', 'payroll.update', 'announcement.read', 'stats.read',
  ],
  shift_supervisor: [
    'employee.read', 'shift.read', 'shift.update', 'announcement.read', 'stats.read',
  ],
  announcement_manager: [
    'announcement.read', 'announcement.create', 'announcement.delete',
    'content.manage', 'upload.image', 'stats.read',
  ],
  auditor: [
    'audit.read', 'stats.read', 'employee.read', 'leave.read', 'announcement.read',
  ],
};

class Store {
  constructor() {
    this.state = {
      user: this.loadPersistedUser(),
      stats: null,
      realtimeConnected: false,
      activeRoute: 'dashboard',
    };
    this.listeners = new Set();
  }

  loadPersistedUser() {
    try {
      const stored = sessionStorage.getItem('admin_profile');
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    }
  }

  setUser(user) {
    this.state.user = user;
    if (user) {
      try {
        sessionStorage.setItem('admin_profile', JSON.stringify(user));
      } catch (_) {}
    } else {
      sessionStorage.removeItem('admin_profile');
    }
    this.notify();
  }

  clearUser() {
    this.setUser(null);
  }

  getUser() {
    return this.state.user;
  }

  isAuthenticated() {
    return !!this.state.user;
  }

  setStats(stats) {
    this.state.stats = stats;
    this.notify();
  }

  setRealtimeConnected(connected) {
    this.state.realtimeConnected = connected;
    this.notify();
  }

  setActiveRoute(route) {
    this.state.activeRoute = route;
    this.notify();
  }

  hasPermission(permission) {
    const role = this.state.user?.role || 'superadmin';
    if (role === 'superadmin' || role === 'admin') return true;
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.includes('*') || perms.includes(permission);
  }

  checkScope(employee) {
    const user = this.state.user;
    if (!user || !employee) return true;
    if (user.role === 'superadmin' || user.role === 'admin') return true;

    if (user.scopeFactory && employee.factory && user.scopeFactory !== employee.factory) {
      return false;
    }
    if (user.scopeDepartment && employee.department && user.scopeDepartment !== employee.department) {
      return false;
    }
    return true;
  }
}

export const store = new Store();
