// Elaraby Connect - HR Admin Dashboard
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

    // 6. Payroll
    this.router.addRoute('/payroll', () => {
      this.renderView(PayrollView, 'Payroll & Compensation', 'payroll');
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
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
