// Sidebar Component

import { store } from '../state/store.js';

export class Sidebar {
  constructor({ onNavigate, onLogout }) {
    this.onNavigate = onNavigate;
    this.onLogout = onLogout;
    this.element = null;
  }

  render() {
    this.element = document.createElement('aside');
    this.element.className = 'app-sidebar';

    const user = store.state.user || {};
    const role = user.role || 'superadmin';
    const tenantBrandName = user.tenantName || window.ACTIVE_TENANT_NAME || 'Elaraby Connect';
    const tenantBrandInitials = tenantBrandName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'EC';

    this.element.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-logo">${tenantBrandInitials}</div>
        <div class="sidebar-brand-text">
          <b>${tenantBrandName}</b>
          <small>HR Administration</small>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section-title">Core Operations</div>
        
        <button class="nav-link" data-route="dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>Dashboard</span>
        </button>

        <button class="nav-link" data-route="employees">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Employees</span>
        </button>

        <button class="nav-link" data-route="leave">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Leave Requests</span>
          <span class="nav-counter" id="sidebar-leave-counter" style="display: none;">0</span>
        </button>

        <button class="nav-link" data-route="shifts">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Shift Roster</span>
        </button>

        <button class="nav-link" data-route="payroll">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span>Payroll</span>
        </button>

        <div class="nav-section-title">Communication & Governance</div>

        <button class="nav-link" data-route="announcements">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Announcements</span>
        </button>

        <button class="nav-link" data-route="concerns">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Workplace Safety</span>
        </button>

        <button class="nav-link" data-route="audit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>Audit Logs</span>
        </button>

        <button class="nav-link" data-route="settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Settings</span>
        </button>

        ${role === 'superadmin' ? `
          <div class="nav-section-title">Platform Super-Admin</div>
          <button class="nav-link" data-route="tenants" style="color: var(--primary); font-weight: 700;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 3h6v4H9z"/></svg>
            <span>Tenant Companies</span>
          </button>
        ` : ''}
      </nav>

      <div class="sidebar-footer">
        <button class="btn btn-ghost btn-sm" id="sidebar-logout-btn" style="width: 100%; justify-content: flex-start; color: #EF4444;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Sign Out</span>
        </button>
      </div>
    `;

    // Attach click listeners
    const buttons = this.element.querySelectorAll('.nav-link');
    for (const btn of buttons) {
      btn.onclick = () => {
        const route = btn.dataset.route;
        this.setActive(route);
        if (this.onNavigate) this.onNavigate(route);
      };
    }

    const logoutBtn = this.element.querySelector('#sidebar-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        if (this.onLogout) this.onLogout();
      };
    }

    return this.element;
  }

  setActive(route) {
    if (!this.element) return;
    const buttons = this.element.querySelectorAll('.nav-link');
    for (const btn of buttons) {
      if (btn.dataset.route === route) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  updatePendingBadge(count) {
    if (!this.element) return;
    const badge = this.element.querySelector('#sidebar-leave-counter');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }
}
