// Workforce OS - HR Admin Dashboard
// Native ES Module Application Bootstrap & Lifecycle Manager

import { store } from './state/store.js';
import { Router } from './router/router.js';
import { AppShell } from './components/AppShell.js';
import { toast } from './components/Toast.js';
import { initRealtimeBridge, closeRealtimeBridge } from './realtime/sseConsumer.js';
import { authApi } from './api/services.js';

// Views
import { LoginView } from './views/LoginView.js';
import { DashboardView } from './views/DashboardView.js';
import { EmployeesView } from './views/EmployeesView.js';
import { LeaveView } from './views/LeaveView.js';
import { PayrollView } from './views/PayrollView.js';
import { ShiftsView } from './views/ShiftsView.js';
import { AnnouncementsView } from './views/AnnouncementsView.js';
import { ConcernsView } from './views/ConcernsView.js';
import { AuditView } from './views/AuditView.js';
import { SettingsView } from './views/SettingsView.js';
import { TenantsView } from './views/TenantsView.js';
import { TransportView } from './views/TransportView.js';
import { ReportsView } from './views/ReportsView.js';
import { AnalyticsView } from './views/AnalyticsView.js';
import { RosterView } from './views/RosterView.js';
import { HseView } from './views/HseView.js';
import { IncentivesView } from './views/IncentivesView.js';

class App {
  constructor() {
    this.rootEl = document.getElementById('app');
    this.appShell = null;
    this.currentView = null;
    this.router = new Router();
  }

  init() {
    this.setupRoutes();
    this.setupGlobalEvents();

    if (store.isAuthenticated()) {
      initRealtimeBridge();
    }

    this.router.start();
    window.__appMounted = true;
  }

  setupGlobalEvents() {
    window.addEventListener('admin:unauthorized', () => {
      closeRealtimeBridge();
      store.clearUser();
      this.router.navigate('/login');
    });
  }

  ensureShell() {
    if (this.appShell && this.rootEl.contains(this.appShell.element)) {
      return this.appShell;
    }

    this.rootEl.innerHTML = '';
    this.appShell = new AppShell({
      onNavigate: (route) => this.router.navigate(`/${route}`),
      onLogout: async () => {
        try {
          await authApi.logout();
        } catch (_) {}
        closeRealtimeBridge();
        store.clearUser();
        this.router.navigate('/login');
      },
    });

    this.rootEl.appendChild(this.appShell.render());
    return this.appShell;
  }

  renderView(ViewClass, title, routeKey, params = {}) {
    const shell = this.ensureShell();
    shell.setActiveRoute(routeKey);

    if (this.currentView && typeof this.currentView.destroy === 'function') {
      try {
        this.currentView.destroy();
      } catch (err) {
        console.warn('Error destroying view:', err);
      }
    }

    const container = document.createElement('div');
    container.className = `view-wrapper view-${routeKey}`;
    shell.setContent(container, title);

    this.currentView = new ViewClass(container, params);
    this.currentView.mount().catch((err) => {
      console.error(`Error mounting view ${routeKey}:`, err);
      toast.error('Navigation Error', err.message);
    });
  }

  setupRoutes() {
    // 1. Authentication Login
    this.router.addRoute('/login', () => {
      if (this.currentView && typeof this.currentView.destroy === 'function') {
        this.currentView.destroy();
      }
      this.appShell = null;
      this.rootEl.innerHTML = '';

      const container = document.createElement('div');
      this.rootEl.appendChild(container);

      this.currentView = new LoginView(container, {
        onSuccess: () => {
          initRealtimeBridge();
          this.router.navigate('/dashboard');
        },
      });
      this.currentView.mount();
    });

    // 2. Dashboard
    this.router.addRoute('/dashboard', () => {
      this.renderView(DashboardView, 'Executive Dashboard', 'dashboard');
    });

    // 2b. Executive BI Analytics & Statistics
    this.router.addRoute('/analytics', () => {
      this.renderView(AnalyticsView, 'Executive Analytics & BI', 'analytics');
    });

    this.router.addRoute('/roster', () => {
      this.renderView(RosterView, 'AI Roster Solver', 'roster');
    });

    this.router.addRoute('/hse', () => {
      this.renderView(HseView, 'Safety & HSE Management', 'hse');
    }, 'hse.read');

    this.router.addRoute('/incentives', () => {
      this.renderView(IncentivesView, 'Incentives & Penalties', 'incentives');
    }, 'payroll.read');

    // 3. Employees
    this.router.addRoute('/employees', () => {
      this.renderView(EmployeesView, 'Workforce Directory', 'employees');
    }, 'employee.read');

    // 4. Leave Requests
    this.router.addRoute('/leave', () => {
      this.renderView(LeaveView, 'Leave & Absence Management', 'leave');
    }, 'leave.read');

    // 5. Shift Rosters
    this.router.addRoute('/shifts', () => {
      this.renderView(ShiftsView, 'Shift Scheduling & Rosters', 'shifts');
    }, 'shift.read');

    // 5b. Live Attendance & Geofencing Monitor
    this.router.addRoute('/attendance', () => {
      this.renderView(ShiftsView, 'Live Attendance & Geofencing', 'attendance', { tab: 'attendance' });
    }, 'shift.read');

    // 6. Payroll
    this.router.addRoute('/payroll', () => {
      this.renderView(PayrollView, 'Payroll & Compensation', 'payroll');
    }, 'payroll.read');

    // 6b. Emergency Loans & Advances
    this.router.addRoute('/loans', () => {
      this.renderView(PayrollView, 'Loans & Salary Advances', 'loans', { tab: 'loans' });
    }, 'payroll.read');

    // 7. Announcements & Content
    this.router.addRoute('/announcements', () => {
      this.renderView(AnnouncementsView, 'Broadcasts & Communications', 'announcements');
    }, 'announcement.read');

    // 8. Workplace Concerns
    this.router.addRoute('/concerns', () => {
      this.renderView(ConcernsView, 'Safety & Anonymous Reports', 'concerns');
    }, 'concerns.read');

    // 9. Audit Logs
    this.router.addRoute('/audit', () => {
      this.renderView(AuditView, 'Audit Trail & Compliance', 'audit');
    }, 'audit.read');

    // 10. Settings
    this.router.addRoute('/settings', () => {
      this.renderView(SettingsView, 'Administration & Settings', 'settings');
    });

    // 11. Platform Super-Admin Tenants Management
    this.router.addRoute('/tenants', () => {
      this.renderView(TenantsView, 'Tenant Organizations & White-Label Management', 'tenants');
    });

    // 12. Transport & Fleet Logistics
    this.router.addRoute('/transport', () => {
      this.renderView(TransportView, 'Fleet & Shuttle Logistics', 'transport');
    });

    // 13. Executive Reports & Enterprise Integrations
    this.router.addRoute('/reports', () => {
      this.renderView(ReportsView, 'Executive Reports & Enterprise Integrations', 'reports');
    });
    this.router.addRoute('/reports/analytics', () => {
      this.renderView(ReportsView, 'Executive Analytics', 'reports', { tab: 'analytics' });
    });
    this.router.addRoute('/reports/bank', () => {
      this.renderView(ReportsView, 'Bank Payroll & WPS', 'reports', { tab: 'bank' });
    });
    this.router.addRoute('/reports/integrations', () => {
      this.renderView(ReportsView, 'ERP & Biometrics Gateway', 'reports', { tab: 'integrations' });
    });
  }
}

// Bootstrap on DOM Ready or immediately if DOM is already parsed
function bootstrap() {
  try {
    const app = new App();
    app.init();
  } catch (err) {
    console.error('Fatal initialization error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

