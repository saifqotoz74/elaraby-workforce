// Dashboard View Component

import { statsApi } from '../api/services.js';
import { store } from '../state/store.js';
import { createStatusBadge } from '../components/StatusBadge.js';

export class DashboardView {
  constructor(containerOrOpts, opts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
      this.onNavigate = opts?.onNavigate;
    } else {
      this.container = null;
      this.onNavigate = containerOrOpts?.onNavigate;
    }
    this.element = null;
    this.refreshHandler = null;
  }

  async mount() {
    const el = this.render();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(el);
    }
    await this.loadData();
    return el;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'animate-fade-in';

    this.element.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--navy-900);">Workforce Overview</h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin-top: 2px;">Real-time workforce health, attendance metrics, and pending actions.</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="dash-refresh-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Refresh</span>
          </button>
          <button class="btn btn-primary btn-sm" id="dash-goto-requests">
            <span>Review Requests</span>
          </button>
        </div>
      </div>

      <!-- KPI Stats Grid -->
      <div class="stats-grid" id="stats-container">
        <div class="stat-card">
          <div class="stat-card-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="stat-value" id="stat-active-emp">—</div>
          <div class="stat-label">Active Workforce</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="stat-value" id="stat-pending-req">—</div>
          <div class="stat-label">Pending Leave Requests</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="stat-value" id="stat-approved-req">—</div>
          <div class="stat-label">Approved Requests</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-icon red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="stat-value" id="stat-vacation-days">—</div>
          <div class="stat-label">Vacation Days Consumed</div>
        </div>
      </div>

      <!-- Content Grid: Requests Trend & Recent Activity -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-top: 24px;">
        <div class="card" style="background: var(--surface-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 22px;">
          <h3 style="font-size: 15px; font-weight: 700; color: var(--navy-900); margin-bottom: 16px;">Daily Request Submissions (Last 7 Days)</h3>
          <div id="requests-chart-bars" style="display: flex; align-items: flex-end; gap: 14px; height: 160px; padding: 10px 0;">
            <!-- Bars will be inserted dynamically -->
          </div>
        </div>

        <div class="card" style="background: var(--surface-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 22px;">
          <h3 style="font-size: 15px; font-weight: 700; color: var(--navy-900); margin-bottom: 16px;">Recent Operational Activity</h3>
          <div id="recent-activity-list" style="display: flex; flex-direction: column; gap: 12px;">
            <div style="color: var(--text-muted); font-size: 13px;">Loading recent actions...</div>
          </div>
        </div>
      </div>
    `;

    this.element.querySelector('#dash-refresh-btn').onclick = () => this.loadStats();
    this.element.querySelector('#dash-goto-requests').onclick = () => {
      if (this.onNavigate) this.onNavigate('leave');
    };

    // Auto-refresh when realtime events trigger
    this.refreshHandler = () => this.loadStats();
    window.addEventListener('realtime:leave.request.created', this.refreshHandler);
    window.addEventListener('realtime:leave.request.approved', this.refreshHandler);
    window.addEventListener('realtime:employee.created', this.refreshHandler);

    this.loadStats();
    return this.element;
  }

  async loadStats() {
    try {
      const stats = await statsApi.get();
      store.setStats(stats);
      this.populateStats(stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  populateStats(s) {
    if (!this.element) return;
    this.element.querySelector('#stat-active-emp').textContent = `${s.activeEmployees || 0} / ${s.employees || 0}`;
    this.element.querySelector('#stat-pending-req').textContent = s.pendingRequests || 0;
    this.element.querySelector('#stat-approved-req').textContent = s.approvedRequests || 0;
    this.element.querySelector('#stat-vacation-days').textContent = s.vacationDaysTaken || 0;

    // Render bars
    const chartContainer = this.element.querySelector('#requests-chart-bars');
    chartContainer.innerHTML = '';
    const days = s.requestsByDay || [];
    const maxCount = Math.max(...days.map((d) => d.count), 1);

    for (const d of days) {
      const col = document.createElement('div');
      col.style.flex = '1';
      col.style.display = 'flex';
      col.style.flexDirection = 'column';
      col.style.alignItems = 'center';
      col.style.gap = '6px';
      col.style.height = '100%';
      col.style.justifyContent = 'flex-end';

      const pct = Math.max(8, Math.round((d.count / maxCount) * 100));
      col.innerHTML = `
        <span style="font-size: 11px; font-weight: 700; color: var(--navy-900);">${d.count}</span>
        <div style="width: 100%; max-width: 32px; height: ${pct}%; background: linear-gradient(180deg, var(--primary), #3B82F6); border-radius: 6px 6px 0 0; transition: height 0.3s ease;"></div>
        <span style="font-size: 11px; color: var(--text-muted);">${d.label}</span>
      `;
      chartContainer.appendChild(col);
    }

    // Render Recent Activity
    const actContainer = this.element.querySelector('#recent-activity-list');
    actContainer.innerHTML = '';
    const recent = s.recentActivity || [];
    if (recent.length === 0) {
      actContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">No recent activity recorded.</div>`;
    } else {
      for (const a of recent.slice(0, 6)) {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.fontSize = '12.5px';
        item.style.padding = '8px 0';
        item.style.borderBottom = '1px solid var(--border-light)';

        item.innerHTML = `
          <div>
            <b style="color: var(--navy-900); display: block;">${a.title || 'Request'}</b>
            <span style="color: var(--text-muted); font-size: 11.5px;">${a.who || 'Employee'}</span>
          </div>
          <div>${createStatusBadge(a.status)}</div>
        `;
        actContainer.appendChild(item);
      }
    }
  }

  destroy() {
    if (this.refreshHandler) {
      window.removeEventListener('realtime:leave.request.created', this.refreshHandler);
      window.removeEventListener('realtime:leave.request.approved', this.refreshHandler);
      window.removeEventListener('realtime:employee.created', this.refreshHandler);
    }
  }
}
