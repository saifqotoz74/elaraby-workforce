// Topbar Component — Executive Command Header

import { store } from '../state/store.js';
import { superAdminApi, alertApi } from '../api/services.js';

export class Topbar {
  constructor({ onToggleSidebar, onOpenCommandPalette, onNavigate } = {}) {
    this.onToggleSidebar = onToggleSidebar;
    this.onOpenCommandPalette = onOpenCommandPalette;
    this.onNavigate = onNavigate;
    this.element = null;
    this.clockInterval = null;
    this.alerts = [];
    this.unreadAlertsCount = 0;
    this.isAlertsOpen = false;
    this.alertListener = null;
    this.outsideClickListener = null;
    this.escapeListener = null;
  }

  render() {
    this.element = document.createElement('header');
    this.element.className = 'app-topbar';

    const user = store.state.user || {};
    const username = user.sub || 'Admin';
    const role = (user.role || 'superadmin').toUpperCase().replace('_', ' ');
    const factory = user.scopeFactory ? ` • ${user.scopeFactory}` : '';

    const currentTheme = document.documentElement.getAttribute('data-theme') || 
      localStorage.getItem('admin_theme') || 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    if (currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    const currentLang = localStorage.getItem('admin_lang') || 'en';
    if (currentLang === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'ar');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', 'en');
    }

    // Determine Cairo active shift
    const nowCairo = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const cairoHour = nowCairo.getHours();
    let shiftText = '🌅 Morning Shift';
    if (cairoHour >= 16) shiftText = '🌇 Evening Shift';
    if (cairoHour < 8) shiftText = '🌙 Night Shift';

    this.element.innerHTML = `
      <div class="topbar-left">
        <button class="topbar-menu-btn" aria-label="Toggle Navigation">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <h1 class="topbar-page-title" id="topbar-title">Dashboard</h1>

        <!-- Spotlight Command Bar Trigger -->
        <button class="topbar-command-trigger" id="topbar-command-btn" title="Quick Search & Actions (Ctrl+K)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span style="font-size: 13px;">Search or jump to...</span>
          <span class="kbd-badge" style="margin-left: 6px;">Ctrl K</span>
        </button>
      </div>

      <div class="topbar-right">
        <!-- Live Shift Indicator -->
        <div class="topbar-clock" id="topbar-shift-badge" title="Active Factory Operational Shift">
          <span>${shiftText}</span>
          <span style="color: var(--text-light);">•</span>
          <span class="clock-time" id="topbar-live-clock">--:--:--</span>
        </div>

        <!-- Language Switcher Toggle (EN / AR) -->
        <button class="btn btn-secondary btn-icon" id="topbar-lang-toggle" title="Switch Language (العربية / English)" style="border-radius: var(--radius-pill); padding: 6px 12px; font-size: 12.5px; display: flex; align-items: center; gap: 6px;">
          <span>🌐</span>
          <span id="lang-toggle-text" style="font-weight: 700;">${currentLang === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        <!-- Theme Toggle (Light / Dark) -->
        <button class="btn btn-secondary btn-icon" id="topbar-theme-toggle" title="Toggle Theme (Light/Dark)" style="border-radius: var(--radius-pill); padding: 6px 12px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
          <span id="theme-toggle-icon">${currentTheme === 'dark' ? '☀️' : '🌙'}</span>
          <span id="theme-toggle-text" style="font-size: 12px; font-weight: 600;">${currentTheme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        <!-- Manager Alerts & Exception Bell Dropdown -->
        <div class="topbar-alerts-container" id="topbar-alerts-container">
          <button class="topbar-alerts-btn" id="topbar-alerts-btn" title="Manager Alerts & Operational Exceptions" aria-haspopup="true" aria-expanded="false">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span class="topbar-alerts-badge" id="topbar-alerts-badge" style="display: none;">0</span>
          </button>
          
          <div class="topbar-alerts-dropdown" id="topbar-alerts-dropdown" style="display: none;">
            <div class="topbar-alerts-header">
              <div class="topbar-alerts-title">
                <span>🚨 Manager Alerts</span>
                <span class="badge badge-secondary badge-pill" id="topbar-alerts-count-badge" style="font-size: 11px;">0 unread</span>
              </div>
              <button class="btn btn-ghost btn-xs" id="topbar-alerts-mark-all" style="font-size: 11px; font-weight: 600;">
                Mark all read
              </button>
            </div>
            <div class="topbar-alerts-list" id="topbar-alerts-list">
              <div class="topbar-alerts-empty">
                <div class="topbar-alerts-empty-icon">✓</div>
                <div class="topbar-alerts-empty-text">No active alerts. All operations normal.</div>
              </div>
            </div>
            <div class="topbar-alerts-footer">
              <a href="#/audit" id="topbar-alerts-view-all">View Audit Trail & Exceptions →</a>
            </div>
          </div>
        </div>

        <!-- Realtime Live Sync Badge -->
        <div class="realtime-indicator" id="topbar-realtime-badge">
          <span class="realtime-dot"></span>
          <span>Live Sync</span>
        </div>

        <!-- Active Multi-Tenant Context Selector -->
        <div class="topbar-tenant-box" style="display: flex; align-items: center; gap: 6px;">
          <select id="topbar-tenant-select" class="form-select" style="padding: 4px 10px; height: 34px; font-size: 12px; font-weight: 700; border-radius: var(--radius-pill); background: var(--surface-subtle); border: 1px solid var(--border-light); cursor: pointer;" title="Active Tenant Organization Context">
            <option value="all">🌐 All Organizations</option>
            <option value="elaraby">🏢 Elaraby Group</option>
            <option value="elsewedy">🏢 Elsewedy Electric</option>
          </select>
        </div>

        <!-- User Profile Badge -->
        <div class="user-profile-badge" id="topbar-user-badge" title="Authenticated Administrator">
          <div class="user-avatar">${username.slice(0, 2).toUpperCase()}</div>
          <div class="user-meta">
            <b>${username}</b>
            <span>${role}${factory}</span>
          </div>
        </div>
      </div>
    `;

    // Live Clock Ticker (Cairo Timezone)
    const clockEl = this.element.querySelector('#topbar-live-clock');
    const updateClock = () => {
      try {
        const cairoTime = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Cairo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date());
        if (clockEl) clockEl.textContent = cairoTime;
      } catch (_) {
        const d = new Date();
        if (clockEl) clockEl.textContent = d.toTimeString().split(' ')[0];
      }
    };
    updateClock();
    this.clockInterval = setInterval(updateClock, 1000);

    // Command palette trigger
    const cmdBtn = this.element.querySelector('#topbar-command-btn');
    if (cmdBtn) {
      cmdBtn.onclick = () => {
        if (this.onOpenCommandPalette) this.onOpenCommandPalette();
      };
    }

    // Language switcher toggle
    const langBtn = this.element.querySelector('#topbar-lang-toggle');
    if (langBtn) {
      langBtn.onclick = () => {
        const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
        const newLang = isRtl ? 'en' : 'ar';
        document.documentElement.setAttribute('dir', newLang === 'ar' ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', newLang);
        localStorage.setItem('admin_lang', newLang);
        const textEl = this.element.querySelector('#lang-toggle-text');
        if (textEl) textEl.textContent = newLang === 'ar' ? 'English' : 'العربية';

        // Dispatch language change event so views can react if needed
        window.dispatchEvent(new CustomEvent('admin:language.changed', { detail: { lang: newLang } }));
      };
    }

    // Theme toggle
    const themeToggleBtn = this.element.querySelector('#topbar-theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.onclick = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        if (newTheme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
        localStorage.setItem('admin_theme', newTheme);
        const iconEl = this.element.querySelector('#theme-toggle-icon');
        const textEl = this.element.querySelector('#theme-toggle-text');
        if (iconEl) iconEl.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        if (textEl) textEl.textContent = newTheme === 'dark' ? 'Light' : 'Dark';
      };
    }

    // Manager Alerts Interactions
    const alertsBtn = this.element.querySelector('#topbar-alerts-btn');
    if (alertsBtn) {
      alertsBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleAlertsDropdown();
      };
    }

    const markAllBtn = this.element.querySelector('#topbar-alerts-mark-all');
    if (markAllBtn) {
      markAllBtn.onclick = async (e) => {
        e.stopPropagation();
        await this.markAllAlertsRead();
      };
    }

    const viewAllLink = this.element.querySelector('#topbar-alerts-view-all');
    if (viewAllLink) {
      viewAllLink.onclick = () => {
        this.toggleAlertsDropdown(false);
      };
    }

    this.outsideClickListener = (e) => {
      const container = this.element?.querySelector('#topbar-alerts-container');
      if (container && !container.contains(e.target) && this.isAlertsOpen) {
        this.toggleAlertsDropdown(false);
      }
    };
    document.addEventListener('click', this.outsideClickListener);

    this.alertListener = (e) => {
      const newAlert = e.detail;
      if (newAlert) {
        this.handleIncomingAlert(newAlert);
      }
    };
    window.addEventListener('realtime:manager.alert', this.alertListener);

    // Initial alert load
    this.loadAlerts();

    // Active Tenant Switcher
    const tenantSelect = this.element.querySelector('#topbar-tenant-select');
    if (tenantSelect) {
      tenantSelect.value = localStorage.getItem('admin_active_tenant') || 'all';
      tenantSelect.onchange = (e) => {
        const val = e.target.value;
        if (val === 'all') {
          localStorage.removeItem('admin_active_tenant');
        } else {
          localStorage.setItem('admin_active_tenant', val);
        }
        window.location.reload();
      };
      this.loadTenants();
    }

    const menuBtn = this.element.querySelector('.topbar-menu-btn');
    if (menuBtn) {
      menuBtn.onclick = () => {
        if (this.onToggleSidebar) this.onToggleSidebar();
      };
    }

    return this.element;
  }

  async loadAlerts() {
    try {
      const res = await alertApi.list({ limit: 15 });
      this.alerts = res.alerts || [];
      this.unreadAlertsCount = typeof res.unreadCount === 'number' 
        ? res.unreadCount 
        : this.alerts.filter(a => !a.isRead).length;
      this.updateAlertsUI();
    } catch (_) {
      // Graceful degradation when offline or logged out
    }
  }

  handleIncomingAlert(alert) {
    if (!alert) return;
    this.alerts.unshift(alert);
    if (this.alerts.length > 30) this.alerts.pop();
    this.unreadAlertsCount += 1;
    this.updateAlertsUI();
  }

  toggleAlertsDropdown(force) {
    this.isAlertsOpen = typeof force === 'boolean' ? force : !this.isAlertsOpen;
    const dropdown = this.element?.querySelector('#topbar-alerts-dropdown');
    const btn = this.element?.querySelector('#topbar-alerts-btn');
    if (dropdown) {
      dropdown.style.display = this.isAlertsOpen ? 'flex' : 'none';
    }
    if (btn) {
      btn.setAttribute('aria-expanded', String(this.isAlertsOpen));
    }
  }

  updateAlertsUI() {
    const badge = this.element?.querySelector('#topbar-alerts-badge');
    const countBadge = this.element?.querySelector('#topbar-alerts-count-badge');
    if (badge) {
      if (this.unreadAlertsCount > 0) {
        badge.textContent = this.unreadAlertsCount > 99 ? '99+' : this.unreadAlertsCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
    if (countBadge) {
      countBadge.textContent = `${this.unreadAlertsCount} unread`;
    }
    this.renderAlertsList();
  }

  renderAlertsList() {
    const listContainer = this.element?.querySelector('#topbar-alerts-list');
    if (!listContainer) return;

    if (!this.alerts || this.alerts.length === 0) {
      listContainer.innerHTML = `
        <div class="topbar-alerts-empty">
          <div class="topbar-alerts-empty-icon">✓</div>
          <div class="topbar-alerts-empty-text">No active alerts. All operations normal.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    for (const alert of this.alerts) {
      const item = document.createElement('div');
      item.className = `topbar-alert-item ${!alert.isRead ? 'unread' : ''}`;

      let icon = '🔔';
      let iconClass = 'info';
      if (alert.type === 'geofence_breach') {
        icon = '🚨';
        iconClass = 'critical';
      } else if (alert.type === 'emergency_loan') {
        icon = '⚠️';
        iconClass = 'warning';
      } else if (alert.type === 'audit_event') {
        icon = '🛡️';
        iconClass = alert.severity === 'critical' ? 'critical' : 'warning';
      }

      const timeAgo = this.formatRelativeTime(alert.createdAt);
      const tenantTag = alert.tenantId ? `<span class="badge badge-secondary badge-pill" style="font-size: 10px; text-transform: uppercase;">${alert.tenantId}</span>` : '';

      item.innerHTML = `
        <div class="topbar-alert-icon ${iconClass}">${icon}</div>
        <div class="topbar-alert-content">
          <div class="topbar-alert-item-title">${this.escapeHtml(alert.title || 'Manager Alert')}</div>
          <div class="topbar-alert-item-msg">${this.escapeHtml(alert.message || '')}</div>
          <div class="topbar-alert-item-meta">
            <span>${timeAgo}</span>
            ${tenantTag}
            ${!alert.isRead ? '<span class="topbar-alert-unread-dot" title="Unread"></span>' : ''}
          </div>
        </div>
      `;

      item.onclick = async () => {
        await this.onAlertClicked(alert);
      };

      listContainer.appendChild(item);
    }
  }

  async onAlertClicked(alert) {
    if (!alert.isRead) {
      try {
        await alertApi.markRead(alert.id);
        alert.isRead = true;
        this.unreadAlertsCount = Math.max(0, this.unreadAlertsCount - 1);
        this.updateAlertsUI();
      } catch (_) {}
    }

    this.toggleAlertsDropdown(false);

    if (alert.type === 'emergency_loan') {
      window.location.hash = '#/loans';
    } else if (alert.type === 'geofence_breach') {
      window.location.hash = '#/attendance';
    } else {
      window.location.hash = '#/audit';
    }
  }

  async markAllAlertsRead() {
    try {
      await alertApi.markAllRead();
      this.alerts.forEach(a => { a.isRead = true; });
      this.unreadAlertsCount = 0;
      this.updateAlertsUI();
    } catch (_) {}
  }

  formatRelativeTime(dateStr) {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async loadTenants() {
    const tenantSelect = this.element?.querySelector('#topbar-tenant-select');
    if (!tenantSelect) return;
    try {
      const res = await superAdminApi.listTenants();
      const tenants = res.tenants || [];
      if (tenants.length > 0) {
        const currentVal = localStorage.getItem('admin_active_tenant') || 'all';
        tenantSelect.innerHTML = `<option value="all">🌐 All Organizations</option>`;
        for (const t of tenants) {
          const opt = document.createElement('option');
          opt.value = t.slug || t.id;
          opt.textContent = `🏢 ${t.brandName || t.name || t.slug}`;
          tenantSelect.appendChild(opt);
        }
        tenantSelect.value = currentVal;
      }
    } catch (_) {
      // Graceful fallback to static options if non-superadmin or offline
    }
  }

  setTitle(title) {
    if (!this.element) return;
    const titleEl = this.element.querySelector('#topbar-title');
    if (titleEl) titleEl.textContent = title;
  }

  setRealtimeStatus(connected) {
    if (!this.element) return;
    const badge = this.element.querySelector('#topbar-realtime-badge');
    if (badge) {
      if (connected) {
        badge.style.display = 'flex';
        badge.querySelector('span:last-child').textContent = 'Live Sync';
        badge.style.color = 'var(--status-green)';
        badge.style.backgroundColor = 'var(--status-green-soft)';
        badge.style.borderColor = 'var(--status-green-border)';
        badge.querySelector('.realtime-dot').style.backgroundColor = 'var(--status-green)';
      } else {
        badge.querySelector('span:last-child').textContent = 'Connecting...';
        badge.style.color = 'var(--status-amber)';
        badge.style.backgroundColor = 'var(--status-amber-soft)';
        badge.style.borderColor = 'var(--status-amber-border)';
        badge.querySelector('.realtime-dot').style.backgroundColor = 'var(--status-amber)';
      }
    }
  }

  destroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    if (this.alertListener) {
      window.removeEventListener('realtime:manager.alert', this.alertListener);
      this.alertListener = null;
    }
    if (this.outsideClickListener) {
      document.removeEventListener('click', this.outsideClickListener);
      this.outsideClickListener = null;
    }
  }
}


