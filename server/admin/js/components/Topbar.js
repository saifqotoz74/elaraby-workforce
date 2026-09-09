// Topbar Component

import { store } from '../state/store.js';

export class Topbar {
  constructor({ onToggleSidebar }) {
    this.onToggleSidebar = onToggleSidebar;
    this.element = null;
  }

  render() {
    this.element = document.createElement('header');
    this.element.className = 'app-topbar';

    const user = store.state.user || {};
    const username = user.sub || 'Admin';
    const role = (user.role || 'superadmin').toUpperCase().replace('_', ' ');
    const factory = user.scopeFactory ? ` • ${user.scopeFactory}` : '';

    this.element.innerHTML = `
      <div class="topbar-left">
        <button class="topbar-menu-btn" aria-label="Toggle Navigation">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <h1 class="topbar-page-title" id="topbar-title">Dashboard</h1>
      </div>

      <div class="topbar-right">
        <div class="realtime-indicator" id="topbar-realtime-badge">
          <span class="realtime-dot"></span>
          <span>Live Sync</span>
        </div>

        <div class="user-profile-badge">
          <div class="user-avatar">${username.slice(0, 2).toUpperCase()}</div>
          <div class="user-meta">
            <b>${username}</b>
            <span>${role}${factory}</span>
          </div>
        </div>
      </div>
    `;

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
}
