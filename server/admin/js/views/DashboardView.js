// Dashboard View Component — Executive Workforce Analytics & Control Center

import { statsApi, metricsApi } from '../api/services.js';
import { store } from '../state/store.js';
import { createStatusBadge } from '../components/StatusBadge.js';
import { toast } from '../components/Toast.js';

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
    this.otpHandler = null;
    this.metricsTimer = null;
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

  async loadData() {
    return this.loadStats();
  }

  formatEGP(val) {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num) + ' EGP';
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'animate-fade-in';

    this.element.innerHTML = `
      <!-- Top Title & Action Controls -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-size: 24px; font-weight: 800; color: var(--navy-900); letter-spacing: -0.02em;">Executive Workforce Analytics</h2>
            <span class="realtime-indicator" style="font-size: 11.5px; padding: 2px 9px;">
              <span class="realtime-dot animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p style="font-size: 13.5px; color: var(--text-muted); margin-top: 3px;">
            Real-time enterprise overview, factory distributions, payroll commitments, and active credentials.
          </p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" id="dash-refresh-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Refresh</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="dash-goto-workforce">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Workforce</span>
          </button>
          <button class="btn btn-primary btn-sm" id="dash-goto-requests">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Review Requests</span>
          </button>
        </div>
      </div>

      <!-- Quick Metrics Ribbon -->
      <div style="display: flex; gap: 10px; margin-bottom: 22px; flex-wrap: wrap;" id="quick-metrics-ribbon">
        <div class="metric-chip">
          <span style="color: var(--status-green);">●</span>
          <span>Active Workforce: <b id="ribbon-active-rate">—%</b></span>
        </div>
        <div class="metric-chip">
          <span style="color: var(--primary);">●</span>
          <span>Approval Rate: <b id="ribbon-approval-rate">—%</b></span>
        </div>
        <div class="metric-chip">
          <span style="color: #9333EA;">●</span>
          <span>Net Payroll Pool: <b id="ribbon-payroll-pool">—</b></span>
        </div>
        <div class="metric-chip">
          <span style="color: var(--status-amber);">●</span>
          <span>Active OTPs: <b id="ribbon-active-otps">—</b></span>
        </div>
      </div>

      <!-- 8-Card Executive KPI Stats Grid -->
      <div class="stats-grid" id="stats-container">
        <!-- 1. Total Workforce -->
        <div class="stat-card">
          <div class="stat-card-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="stat-value" id="stat-active-emp">—</div>
          <div class="stat-label">Total Workforce</div>
          <div class="stat-meta" id="stat-active-emp-meta">Active Staff Rate: —</div>
        </div>

        <!-- 2. Pending Requests -->
        <div class="stat-card">
          <div class="stat-card-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="stat-value" id="stat-pending-req">—</div>
          <div class="stat-label">Pending Leave Requests</div>
          <div class="stat-meta" id="stat-pending-req-meta">Requires HR Review</div>
        </div>

        <!-- 3. Approved Requests -->
        <div class="stat-card">
          <div class="stat-card-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="stat-value" id="stat-approved-req">—</div>
          <div class="stat-label">Approved Requests</div>
          <div class="stat-meta" id="stat-approved-req-meta">Approval Rate: —</div>
        </div>

        <!-- 4. Vacation Days Taken -->
        <div class="stat-card">
          <div class="stat-card-icon red">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="stat-value" id="stat-vacation-days">—</div>
          <div class="stat-label">Vacation Days Taken</div>
          <div class="stat-meta" id="stat-vacation-days-meta">Avg Balance: — days/emp</div>
        </div>

        <!-- 5. Monthly Net Payroll Pool -->
        <div class="stat-card">
          <div class="stat-card-icon purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div class="stat-value" id="stat-payroll-net">—</div>
          <div class="stat-label">Monthly Net Payroll</div>
          <div class="stat-meta" id="stat-payroll-net-meta">Avg Salary: —</div>
        </div>

        <!-- 6. Rostered Shifts & Working Hours -->
        <div class="stat-card">
          <div class="stat-card-icon teal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
          </div>
          <div class="stat-value" id="stat-shifts-rostered">—</div>
          <div class="stat-label">Rostered Personnel</div>
          <div class="stat-meta" id="stat-shifts-meta">Weekly Hours: — hrs</div>
        </div>

        <!-- 7. Welfare & Trip Bookings -->
        <div class="stat-card">
          <div class="stat-card-icon orange">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <div class="stat-value" id="stat-trips-booked">—</div>
          <div class="stat-label">Trip Seats Booked</div>
          <div class="stat-meta" id="stat-trips-meta">Capacity Fill: —%</div>
        </div>

        <!-- 8. Broadcasts & Engagement -->
        <div class="stat-card">
          <div class="stat-card-icon indigo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="stat-value" id="stat-broadcasts">—</div>
          <div class="stat-label">Broadcasts & Comms</div>
          <div class="stat-meta" id="stat-broadcasts-meta">Announcements & News</div>
        </div>
      </div>

      <!-- Live Verification Codes (OTP / SMS Fallback Monitor) -->
      <div class="analytics-card" style="margin-top: 24px; border-left: 4px solid var(--primary);">
        <div class="analytics-card-header">
          <div>
            <h3 class="analytics-card-title">
              <span>🔐 Live Verification Codes (OTP / SMS Fallback)</span>
              <span class="badge badge-primary" style="font-size: 11px; padding: 2px 8px;">Realtime Stream</span>
            </h3>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 3px 0 0 0;">
              Temporary 4-6 digit authorization codes generated for employee mobile login & PIN reset (valid 5 min).
            </p>
          </div>
          <div id="otp-stats-badge" style="font-size: 12px; font-weight: 600; color: var(--text-muted);">
            Active in memory: <b style="color: var(--status-green);" id="otp-active-counter">0</b>
          </div>
        </div>
        <div id="live-otp-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
          <div style="color: var(--text-muted); font-size: 13px;">No recent OTP requests.</div>
        </div>
      </div>

      <!-- Section 1: Request Trends & Category Breakdown -->
      <div class="analytics-grid-2">
        <!-- 7-Day Request Volume -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span>Daily Request Submissions (Last 7 Days)</span>
            </h3>
            <span class="badge badge-primary" style="font-size: 11px;">7-Day Velocity</span>
          </div>
          <div id="requests-chart-bars" style="display: flex; align-items: flex-end; gap: 14px; height: 180px; padding: 10px 0; border-bottom: 1px solid var(--border-light); margin-bottom: 14px;">
            <!-- Dynamic Bars -->
          </div>
          <div style="display: flex; justify-content: space-around; font-size: 11.5px; color: var(--text-muted); padding-top: 4px;">
            <span><span style="color: var(--primary);">■</span> Total Submissions</span>
            <span><span style="color: var(--status-green);">■</span> Approved Decisions</span>
            <span><span style="color: var(--status-red);">■</span> Rejected</span>
          </div>
        </div>

        <!-- Requests by Category Breakdown -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              <span>Requests by Category & Purpose</span>
            </h3>
            <span class="badge" style="background: var(--surface-bg); color: var(--text-muted); font-size: 11px;">Breakdown</span>
          </div>
          <div id="requests-by-type-list" style="display: flex; flex-direction: column; gap: 12px;">
            <div style="color: var(--text-muted); font-size: 13px;">Loading category distributions...</div>
          </div>
        </div>
      </div>

      <!-- Section 2: Factory Allocations & Shift Coverage -->
      <div class="analytics-grid-2">
        <!-- Factory & Complex Allocation -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>Factory & Complex Headcount Distribution</span>
            </h3>
            <span class="badge badge-success" style="font-size: 11px;">Facilities</span>
          </div>
          <div id="factory-distribution-list" style="display: flex; flex-direction: column; gap: 14px;">
            <div style="color: var(--text-muted); font-size: 13px;">Loading facility headcounts...</div>
          </div>
        </div>

        <!-- Operational Shift Coverage -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
              <span>Shift Roster & Operational Coverage</span>
            </h3>
            <span class="badge badge-primary" style="font-size: 11px;">Roster Health</span>
          </div>
          <div id="shift-distribution-content">
            <!-- Shift Progress Multi-Bars & Summary -->
            <div style="display: flex; gap: 10px; margin-bottom: 16px;" id="shift-summary-badges">
              <!-- Dynamically populated -->
            </div>
            <div id="shift-breakdown-rows" style="display: flex; flex-direction: column; gap: 12px;">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Payroll Financials & Welfare Trips -->
      <div class="analytics-grid-2">
        <!-- Payroll Financial Commitment -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              <span>Payroll Financial Commitment & Compensation</span>
            </h3>
            <span class="badge badge-primary" style="font-size: 11px;">Monthly Pool</span>
          </div>
          <div id="payroll-financials-container" style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Dynamically populated -->
          </div>
        </div>

        <!-- Employee Welfare & Popular Trips -->
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <span>Corporate Trips & Employee Welfare</span>
            </h3>
            <span class="badge badge-success" style="font-size: 11px;">Social Engagement</span>
          </div>
          <div id="trips-welfare-container" style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Dynamically populated -->
          </div>
        </div>
      </div>

      <!-- Section 4: Recent Operational Activity Stream -->
      <div class="analytics-card" style="margin-top: 24px;">
        <div class="analytics-card-header">
          <h3 class="analytics-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span>Recent Operational Activity Stream</span>
          </h3>
          <button class="btn btn-secondary btn-sm" id="dash-view-all-activity">View Leave Requests</button>
        </div>
        <div id="recent-activity-list" style="display: flex; flex-direction: column; gap: 8px;">
          <div style="color: var(--text-muted); font-size: 13px;">Loading recent operational events...</div>
        </div>
      </div>

      <!-- Section 5: Enterprise APM & System Health Diagnostics -->
      <div class="analytics-card" style="margin-top: 24px; border-left: 4px solid var(--status-green);">
        <div class="analytics-card-header">
          <h3 class="analytics-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            <span>Enterprise System Diagnostics & APM Health</span>
          </h3>
          <span class="badge badge-success" id="apm-health-badge">🟢 HEALTHY (Optimal)</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;" id="apm-metrics-grid">
          <div style="background: var(--surface-subtle); padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            <small style="color: var(--text-muted); display: block; font-size: 11px;">Server Uptime</small>
            <b id="apm-uptime" style="font-size: 14px; color: var(--text-main);">Loading...</b>
          </div>
          <div style="background: var(--surface-subtle); padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            <small style="color: var(--text-muted); display: block; font-size: 11px;">Node.js Heap Memory</small>
            <b id="apm-memory" style="font-size: 14px; color: var(--text-main);">Loading...</b>
          </div>
          <div style="background: var(--surface-subtle); padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            <small style="color: var(--text-muted); display: block; font-size: 11px;">Active Realtime SSE Clients</small>
            <b id="apm-sse" style="font-size: 14px; color: var(--primary);">Loading...</b>
          </div>
          <div style="background: var(--surface-subtle); padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            <small style="color: var(--text-muted); display: block; font-size: 11px;">Cluster Architecture Mode</small>
            <b id="apm-cluster" style="font-size: 14px; color: var(--text-main);">Standalone</b>
          </div>
        </div>
      </div>
    `;

    // Event handlers
    this.element.querySelector('#dash-refresh-btn').onclick = () => this.loadStats();
    this.element.querySelector('#dash-goto-workforce').onclick = () => {
      if (this.onNavigate) this.onNavigate('employees');
    };
    this.element.querySelector('#dash-goto-requests').onclick = () => {
      if (this.onNavigate) this.onNavigate('leave');
    };
    this.element.querySelector('#dash-view-all-activity').onclick = () => {
      if (this.onNavigate) this.onNavigate('leave');
    };

    // Auto-refresh when realtime events trigger
    this.refreshHandler = () => this.loadStats();
    this.otpHandler = (e) => {
      const data = e.detail || {};
      toast.info('🔐 Verification Requested', `Authentication code requested for ${data.employeeName || 'Employee'}`);
      this.loadStats();
    };

    window.addEventListener('realtime:leave.request.created', this.refreshHandler);
    window.addEventListener('realtime:leave.request.approved', this.refreshHandler);
    window.addEventListener('realtime:employee.created', this.refreshHandler);
    window.addEventListener('realtime:otp.requested', this.otpHandler);

    this.loadStats();
    return this.element;
  }

  async loadStats() {
    try {
      const stats = await statsApi.get();
      store.setStats(stats);
      this.populateStats(stats);

      // Fetch and populate APM diagnostics
      try {
        const m = await metricsApi.get();
        if (m && m.ok) {
          const uptimeHrs = Math.floor(m.uptimeSeconds / 3600);
          const uptimeMins = Math.floor((m.uptimeSeconds % 3600) / 60);
          const uptimeStr = uptimeHrs > 0 ? `${uptimeHrs}h ${uptimeMins}m` : `${uptimeMins}m`;

          const uptimeEl = this.element.querySelector('#apm-uptime');
          const memEl = this.element.querySelector('#apm-memory');
          const sseEl = this.element.querySelector('#apm-sse');
          const clusterEl = this.element.querySelector('#apm-cluster');

          if (uptimeEl) uptimeEl.textContent = `${uptimeStr} (${m.uptimeSeconds}s)`;
          if (memEl) memEl.textContent = `${m.memory.heapUsedMb} MB / ${m.memory.heapTotalMb} MB`;
          if (sseEl) sseEl.textContent = `${m.cluster.activeSseClients} Connected`;
          if (clusterEl) clusterEl.textContent = m.cluster.mode === 'distributed_redis' ? 'Distributed (Redis)' : 'Standalone (In-Process)';
        }
      } catch (_) {
        // Fallback for non-superadmin roles without audit permissions
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  populateStats(s) {
    if (!this.element) return;

    // 1. Quick Metrics Ribbon
    const activeRate = s.activeRate ?? (s.employees ? Math.round((s.activeEmployees / s.employees) * 100) : 100);
    const approvalRate = s.approvalRate ?? 100;
    const netPool = s.payroll?.totalNetSalary ? this.formatEGP(s.payroll.totalNetSalary) : '—';
    const activeOtps = s.security?.activeOtpsCount ?? (s.recentOtps || []).filter((o) => !o.isExpired).length;

    this.element.querySelector('#ribbon-active-rate').textContent = `${activeRate}%`;
    this.element.querySelector('#ribbon-approval-rate').textContent = `${approvalRate}%`;
    this.element.querySelector('#ribbon-payroll-pool').textContent = netPool;
    this.element.querySelector('#ribbon-active-otps').textContent = `${activeOtps} Active`;

    // 2. 8 KPI Cards
    this.element.querySelector('#stat-active-emp').textContent = `${s.activeEmployees || 0} / ${s.employees || 0}`;
    this.element.querySelector('#stat-active-emp-meta').textContent = `Active Workforce: ${activeRate}%`;

    this.element.querySelector('#stat-pending-req').textContent = s.pendingRequests || 0;
    this.element.querySelector('#stat-pending-req-meta').textContent = `${s.totalRequests || (s.pendingRequests + s.approvedRequests + s.rejectedRequests || 0)} Total Submissions`;

    this.element.querySelector('#stat-approved-req').textContent = s.approvedRequests || 0;
    this.element.querySelector('#stat-approved-req-meta').textContent = `Approval Rate: ${approvalRate}%`;

    this.element.querySelector('#stat-vacation-days').textContent = `${s.vacationDaysTaken || 0} Days`;
    this.element.querySelector('#stat-vacation-days-meta').textContent = `Avg Balance: ${s.avgVacationBalance || 0} days/emp`;

    this.element.querySelector('#stat-payroll-net').textContent = s.payroll?.totalNetSalary ? this.formatEGP(s.payroll.totalNetSalary) : '—';
    this.element.querySelector('#stat-payroll-net-meta').textContent = `Published: ${s.payroll?.publishedCount || 0} statements`;

    this.element.querySelector('#stat-shifts-rostered').textContent = s.roster?.totalRostered ? `${s.roster.totalRostered} Staff` : '—';
    this.element.querySelector('#stat-shifts-meta').textContent = `Weekly: ${s.roster?.totalWeeklyHours || 0} hrs logged`;

    this.element.querySelector('#stat-trips-booked').textContent = `${s.tripsBooked || s.trips?.tripsBooked || 0} Seats`;
    this.element.querySelector('#stat-trips-meta').textContent = `Fill Rate: ${s.trips?.tripFillRate || 0}%`;

    const totalComms = (s.announcements || 0) + (s.news || 0) + (s.benefits || 0);
    this.element.querySelector('#stat-broadcasts').textContent = totalComms;
    this.element.querySelector('#stat-broadcasts-meta').textContent = `${s.announcements || 0} Broadcasts · ${s.news || 0} News`;

    // 3. Live OTP Monitor
    const otpContainer = this.element.querySelector('#live-otp-container');
    const otpActiveCounter = this.element.querySelector('#otp-active-counter');
    if (otpContainer) {
      otpContainer.innerHTML = '';
      const otps = s.recentOtps || [];
      const activeCount = otps.filter((o) => !o.isExpired).length;
      if (otpActiveCounter) otpActiveCounter.textContent = activeCount;

      if (otps.length === 0) {
        otpContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; grid-column: 1/-1; padding: 12px 0;">No active or recent OTP verification requests.</div>`;
      } else {
        for (const item of otps) {
          const card = document.createElement('div');
          card.style.cssText = 'background: var(--surface-alt); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;';

          const timeAgo = item.timestamp ? Math.max(0, Math.floor((Date.now() - item.timestamp) / 60000)) : 0;
          const timeText = timeAgo === 0 ? 'Just now' : `${timeAgo}m ago`;
          const isExpired = item.isExpired || timeAgo >= 5;

          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <b style="color: var(--navy-900); font-size: 13.5px; display: block;">${item.employeeName || 'Employee'}</b>
                <small style="color: var(--text-muted); font-size: 11.5px;">${item.phone || item.nationalId || '—'}</small>
              </div>
              <span class="badge ${isExpired ? 'badge-danger' : 'badge-success'}" style="font-size: 10.5px;">
                ${isExpired ? 'Expired' : timeText}
              </span>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 8px; padding: 8px 12px; margin-top: 4px;">
              <span style="font-size: 18px; font-weight: 800; letter-spacing: 3px; color: var(--primary); font-family: monospace;">${item.code || '------'}</span>
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11px;" title="Copy OTP">
                Copy
              </button>
            </div>
          `;

          const copyBtn = card.querySelector('button');
          if (copyBtn && item.code) {
            copyBtn.onclick = () => {
              navigator.clipboard?.writeText(item.code);
              toast.success('Copied', `OTP code ${item.code} copied to clipboard.`);
            };
          }

          otpContainer.appendChild(card);
        }
      }
    }

    // 4. Daily Request Velocity Chart
    const chartContainer = this.element.querySelector('#requests-chart-bars');
    if (chartContainer) {
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

        const pct = Math.max(10, Math.round((d.count / maxCount) * 100));
        col.innerHTML = `
          <span style="font-size: 11px; font-weight: 700; color: var(--navy-900);">${d.count}</span>
          <div style="width: 100%; max-width: 34px; height: ${pct}%; background: linear-gradient(180deg, var(--primary), #3B82F6); border-radius: 6px 6px 0 0; transition: height 0.3s ease; box-shadow: 0 2px 6px rgba(11, 99, 180, 0.2);" title="${d.label}: ${d.count} requests (${d.approved || 0} approved, ${d.rejected || 0} rejected)"></div>
          <span style="font-size: 11px; font-weight: 600; color: var(--text-muted);">${d.label}</span>
        `;
        chartContainer.appendChild(col);
      }
    }

    // 5. Requests by Category Breakdown
    const typeListContainer = this.element.querySelector('#requests-by-type-list');
    if (typeListContainer) {
      typeListContainer.innerHTML = '';
      const types = s.requestsByType || [];
      if (types.length === 0) {
        typeListContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">No requests recorded yet.</div>`;
      } else {
        const colors = ['#0B63B4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];
        types.slice(0, 5).forEach((t, idx) => {
          const color = colors[idx % colors.length];
          const item = document.createElement('div');
          item.className = 'breakdown-item';
          item.innerHTML = `
            <div class="breakdown-header">
              <span class="breakdown-name">${t.label || t.type}</span>
              <span class="breakdown-stats">${t.count} (${t.percentage}%)</span>
            </div>
            <div class="breakdown-track">
              <div class="breakdown-fill" style="width: ${t.percentage}%; background-color: ${color};"></div>
            </div>
          `;
          typeListContainer.appendChild(item);
        });
      }
    }

    // 6. Factory & Complex Headcount Distribution
    const factoryContainer = this.element.querySelector('#factory-distribution-list');
    if (factoryContainer) {
      factoryContainer.innerHTML = '';
      const factories = s.byFactory || [];
      if (factories.length === 0) {
        factoryContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">No factory data available.</div>`;
      } else {
        const fColors = ['#0B63B4', '#10B981', '#3B82F6', '#F59E0B', '#6366F1'];
        factories.forEach((f, idx) => {
          const col = fColors[idx % fColors.length];
          const item = document.createElement('div');
          item.className = 'breakdown-item';
          item.innerHTML = `
            <div class="breakdown-header">
              <span class="breakdown-name">🏭 ${f.name}</span>
              <span class="breakdown-stats">${f.count} Staff (${f.percentage}%)</span>
            </div>
            <div class="breakdown-track">
              <div class="breakdown-fill" style="width: ${f.percentage}%; background-color: ${col};"></div>
            </div>
          `;
          factoryContainer.appendChild(item);
        });
      }
    }

    // 7. Shifts & Rostering Health
    const shiftSummaryBadges = this.element.querySelector('#shift-summary-badges');
    const shiftBreakdownRows = this.element.querySelector('#shift-breakdown-rows');
    if (shiftBreakdownRows && s.roster) {
      const counts = s.roster.shiftCounts || { morning: 0, evening: 0, night: 0, off: 0 };
      const pcts = s.roster.shiftPercentages || { morning: 0, evening: 0, night: 0, off: 0 };

      if (shiftSummaryBadges) {
        shiftSummaryBadges.innerHTML = `
          <div class="metric-chip" style="flex: 1; justify-content: center;">
            <span>🌅 Morning: <b>${pcts.morning}%</b></span>
          </div>
          <div class="metric-chip" style="flex: 1; justify-content: center;">
            <span>🌇 Evening: <b>${pcts.evening}%</b></span>
          </div>
          <div class="metric-chip" style="flex: 1; justify-content: center;">
            <span>🌙 Night: <b>${pcts.night}%</b></span>
          </div>
        `;
      }

      shiftBreakdownRows.innerHTML = `
        <div class="breakdown-item">
          <div class="breakdown-header">
            <span class="breakdown-name">🌅 Morning Shift (08:00 - 16:00)</span>
            <span class="breakdown-stats">${counts.morning} slots (${pcts.morning}%)</span>
          </div>
          <div class="breakdown-track">
            <div class="breakdown-fill" style="width: ${pcts.morning}%; background-color: #3B82F6;"></div>
          </div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-header">
            <span class="breakdown-name">🌇 Evening Shift (16:00 - 00:00)</span>
            <span class="breakdown-stats">${counts.evening} slots (${pcts.evening}%)</span>
          </div>
          <div class="breakdown-track">
            <div class="breakdown-fill" style="width: ${pcts.evening}%; background-color: #F59E0B;"></div>
          </div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-header">
            <span class="breakdown-name">🌙 Night Shift (00:00 - 08:00)</span>
            <span class="breakdown-stats">${counts.night} slots (${pcts.night}%)</span>
          </div>
          <div class="breakdown-track">
            <div class="breakdown-fill" style="width: ${pcts.night}%; background-color: #6366F1;"></div>
          </div>
        </div>
      `;
    }

    // 8. Payroll Financials
    const payrollContainer = this.element.querySelector('#payroll-financials-container');
    if (payrollContainer && s.payroll) {
      const p = s.payroll;
      payrollContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: var(--surface-bg); padding: 12px; border-radius: var(--radius-sm);">
            <div style="font-size: 11.5px; color: var(--text-muted);">Base Salary Pool</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--navy-900);">${this.formatEGP(p.totalBaseSalary)}</div>
          </div>
          <div style="background: var(--surface-bg); padding: 12px; border-radius: var(--radius-sm);">
            <div style="font-size: 11.5px; color: var(--text-muted);">Total Allowances</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--status-green);">${this.formatEGP(p.totalAllowances)}</div>
          </div>
          <div style="background: var(--surface-bg); padding: 12px; border-radius: var(--radius-sm);">
            <div style="font-size: 11.5px; color: var(--text-muted);">Total Deductions</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--status-red);">${this.formatEGP(p.totalDeductions)}</div>
          </div>
          <div style="background: var(--surface-bg); padding: 12px; border-radius: var(--radius-sm);">
            <div style="font-size: 11.5px; color: var(--text-muted);">Average Net / Employee</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--primary);">${this.formatEGP(p.avgNetSalary)}</div>
          </div>
        </div>
        <div style="margin-top: 6px;">
          <div class="breakdown-header">
            <span class="breakdown-name">Statement Publication Rate</span>
            <span class="breakdown-stats">${p.publishedCount} / ${p.totalEmployees} (${p.publishRate}%)</span>
          </div>
          <div class="breakdown-track">
            <div class="breakdown-fill" style="width: ${p.publishRate}%; background-color: var(--primary);"></div>
          </div>
        </div>
      `;
    }

    // 9. Welfare & Trips Breakdown
    const tripsContainer = this.element.querySelector('#trips-welfare-container');
    if (tripsContainer && s.trips) {
      const pop = s.trips.popularTrips || [];
      if (pop.length === 0) {
        tripsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">No active corporate welfare trips organized.</div>`;
      } else {
        tripsContainer.innerHTML = '';
        pop.forEach((t) => {
          const item = document.createElement('div');
          item.className = 'breakdown-item';
          item.innerHTML = `
            <div class="breakdown-header">
              <span class="breakdown-name">🚌 ${t.title} (${t.destination || 'Egypt'})</span>
              <span class="breakdown-stats">${t.bookedSeats}/${t.totalSeats} seats (${t.fillRate}%)</span>
            </div>
            <div class="breakdown-track">
              <div class="breakdown-fill" style="width: ${t.fillRate}%; background-color: ${t.fillRate >= 90 ? 'var(--status-red)' : 'var(--status-green)'};"></div>
            </div>
          `;
          tripsContainer.appendChild(item);
        });
      }
    }

    // 10. Recent Activity List
    const actContainer = this.element.querySelector('#recent-activity-list');
    if (actContainer) {
      actContainer.innerHTML = '';
      const recent = s.recentActivity || [];
      if (recent.length === 0) {
        actContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">No recent operational activity recorded.</div>`;
      } else {
        for (const a of recent.slice(0, 6)) {
          const item = document.createElement('div');
          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.justifyContent = 'space-between';
          item.style.fontSize = '12.5px';
          item.style.padding = '10px 0';
          item.style.borderBottom = '1px solid var(--border-light)';

          const timeAgo = a.at ? Math.max(0, Math.floor((Date.now() - a.at) / 60000)) : 0;
          const timeText = timeAgo === 0 ? 'Just now' : `${timeAgo}m ago`;

          item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary-soft); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
                ${(a.who || 'E').charAt(0)}
              </div>
              <div>
                <b style="color: var(--navy-900); display: block;">${a.title || 'Request'}</b>
                <span style="color: var(--text-muted); font-size: 11.5px;">${a.who || 'Employee'} · ${a.factory || 'HQ'} · ${timeText}</span>
              </div>
            </div>
            <div>${createStatusBadge(a.status)}</div>
          `;
          actContainer.appendChild(item);
        }
      }
    }
  }

  destroy() {
    if (this.refreshHandler) {
      window.removeEventListener('realtime:leave.request.created', this.refreshHandler);
      window.removeEventListener('realtime:leave.request.approved', this.refreshHandler);
      window.removeEventListener('realtime:employee.created', this.refreshHandler);
    }
    if (this.otpHandler) {
      window.removeEventListener('realtime:otp.requested', this.otpHandler);
    }
  }
}
