// Topbar Component — Executive Command Header

import { store } from '../state/store.js';

export class Topbar {
  constructor({ onToggleSidebar, onOpenCommandPalette }) {
    this.onToggleSidebar = onToggleSidebar;
    this.onOpenCommandPalette = onOpenCommandPalette;
    this.element = null;
    this.clockInterval = null;
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
            <option value="ghabbour">🏢 GB Corp (Ghabbour)</option>
            <option value="tmg">🏢 Talaat Moustafa Group</option>
            <option value="gulf_industrial">🏢 Gulf Industrial Corp</option>
            <option value="generic">🏢 PR Connect (Neutral)</option>
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
    }

    const menuBtn = this.element.querySelector('.topbar-menu-btn');
    if (menuBtn) {
      menuBtn.onclick = () => {
        if (this.onToggleSidebar) this.onToggleSidebar();
      };
    }

    return this.element;
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
  }
}

