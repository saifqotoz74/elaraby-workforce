// AppShell Component
// Assembles the Sidebar, Topbar, Content Container, Responsive Drawer, and Command Palette.

import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';
import { CommandPalette } from './CommandPalette.js';
import { store } from '../state/store.js';
import { loanApi } from '../api/services.js';

export class AppShell {
  constructor({ onNavigate, onLogout }) {
    this.onNavigate = onNavigate;
    this.onLogout = onLogout;

    this.commandPalette = new CommandPalette({
      onNavigate: (route) => {
        if (this.onNavigate) this.onNavigate(route);
      },
      onAction: (action) => this.handleCommandAction(action),
    });

    this.sidebar = new Sidebar({
      onNavigate: (route) => {
        this.closeMobileSidebar();
        if (this.onNavigate) this.onNavigate(route);
      },
      onLogout,
    });

    this.topbar = new Topbar({
      onToggleSidebar: () => this.toggleMobileSidebar(),
      onOpenCommandPalette: () => this.commandPalette.open(),
      onNavigate: (route) => {
        if (this.onNavigate) this.onNavigate(route);
      },
    });

    this.element = null;
    this.contentContainer = null;
    this.overlay = null;

    // Listen to store updates for realtime status
    store.subscribe((state) => {
      this.topbar.setRealtimeStatus(state.realtimeConnected);
      if (state.stats?.pendingRequests !== undefined) {
        this.sidebar.updatePendingBadge(state.stats.pendingRequests);
      }
    });

    this.refreshLoansBadge();
    window.addEventListener('realtime:loan.created', () => this.refreshLoansBadge());
    window.addEventListener('realtime:loan.updated', () => this.refreshLoansBadge());
    window.addEventListener('admin:loans.changed', () => this.refreshLoansBadge());
  }

  async refreshLoansBadge() {
    try {
      const res = await loanApi.list({ status: 'pending', limit: 100 });
      const pendingCount = (res.loans || []).length;
      this.sidebar.updatePendingLoansBadge(pendingCount);
    } catch (_) {}
  }

  handleCommandAction(action) {
    if (action === 'toggle-theme') {
      const themeBtn = document.querySelector('#topbar-theme-toggle');
      if (themeBtn) themeBtn.click();
    } else if (action === 'toggle-lang') {
      const langBtn = document.querySelector('#topbar-lang-toggle');
      if (langBtn) langBtn.click();
    } else if (action === 'add-employee') {
      if (this.onNavigate) this.onNavigate('employees');
      setTimeout(() => {
        const btn = document.querySelector('#btn-add-employee');
        if (btn) btn.click();
      }, 150);
    } else if (action === 'new-announcement') {
      if (this.onNavigate) this.onNavigate('announcements');
      setTimeout(() => {
        const btn = document.querySelector('#btn-create-content') || document.querySelector('#btn-new-announcement');
        if (btn) btn.click();
      }, 150);
    } else if (action === 'export-excel') {
      if (this.onNavigate) this.onNavigate('employees');
      setTimeout(() => {
        const btn = document.querySelector('#btn-export-employees');
        if (btn) btn.click();
      }, 150);
    } else if (action === 'review-loans') {
      if (this.onNavigate) this.onNavigate('loans');
    } else if (action === 'view-attendance') {
      if (this.onNavigate) this.onNavigate('attendance');
    } else if (action === 'export-bank') {
      if (this.onNavigate) this.onNavigate('reports/bank');
    } else if (action === 'sync-erp') {
      if (this.onNavigate) this.onNavigate('reports/integrations');
    }
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'app-shell';

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    this.overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(4, 13, 26, 0.5); backdrop-filter: blur(4px); z-index: 90; display: none;';
    this.overlay.onclick = () => this.closeMobileSidebar();

    const mainArea = document.createElement('div');
    mainArea.className = 'app-main';

    this.contentContainer = document.createElement('main');
    this.contentContainer.className = 'app-content';
    this.contentContainer.id = 'app-content-root';

    mainArea.appendChild(this.topbar.render());
    mainArea.appendChild(this.contentContainer);

    this.element.appendChild(this.sidebar.render());
    this.element.appendChild(mainArea);
    this.element.appendChild(this.overlay);

    return this.element;
  }

  setContent(viewElement, title = '') {
    if (!this.contentContainer) return;
    this.topbar.setTitle(title);
    this.contentContainer.innerHTML = '';
    if (viewElement instanceof HTMLElement) {
      this.contentContainer.appendChild(viewElement);
    }
  }

  setActiveRoute(route) {
    this.sidebar.setActive(route);
  }

  toggleMobileSidebar() {
    const sb = this.sidebar.element;
    if (!sb) return;
    sb.classList.toggle('open');
    if (this.overlay) {
      this.overlay.style.display = sb.classList.contains('open') ? 'block' : 'none';
    }
  }

  closeMobileSidebar() {
    const sb = this.sidebar.element;
    if (sb) sb.classList.remove('open');
    if (this.overlay) this.overlay.style.display = 'none';
  }
}

