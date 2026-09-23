// Dashboard View Component — Executive Workforce Analytics & Control Center

import { statsApi, metricsApi, subscriptionApi } from '../api/services.js';
import { store } from '../state/store.js';
import { createStatusBadge } from '../components/StatusBadge.js';
import { toast } from '../components/Toast.js';

export class DashboardView {
  constructor(containerOrOpts, opts) {
    const fallbackNav = (route) => {
      window.location.hash = `#/${String(route).replace(/^\//, '')}`;
    };
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
      this.onNavigate = opts?.onNavigate || fallbackNav;
    } else {
      this.container = null;
      this.onNavigate = containerOrOpts?.onNavigate || fallbackNav;
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
      <!-- Subscription Lifecycle Alert Banner -->
      <div id="subscription-alert-container"></div>

      <!-- Executive Hero & Command Header -->
      <div class="dash-hero-container">
        <div class="dash-header-row">
          <div class="dash-title-group">
            <h2>
              <span>Executive Workforce Analytics</span>
              <span class="realtime-indicator" style="font-size: 11px; padding: 2px 10px; font-weight: 700;">
                <span class="realtime-dot animate-pulse"></span>
                Live Sync
              </span>
            </h2>
            <p>
              <span>Enterprise operations, factory rosters, payroll commitments & live security stream.</span>
            </p>
          </div>

          <!-- Executive Quick Action Bar -->
          <div class="dash-action-hub">
            <button type="button" class="dash-refresh-circle" id="dash-refresh-btn" title="Refresh Latest Metrics">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <a href="#/employees" class="dash-action-btn-primary" id="dash-act-add-emp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>+ New Employee</span>
            </a>
            <a href="#/leave" class="dash-action-btn-accent" id="dash-goto-requests">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Review Leaves</span>
            </a>
            <a href="#/attendance" class="dash-action-btn-subtle" id="dash-act-attendance">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
              <span>Attendance</span>
            </a>
            <a href="#/loans" class="dash-action-btn-subtle" id="dash-act-loans">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              <span>Loans</span>
            </a>
            <a href="#/reports" class="dash-action-btn-subtle" id="dash-act-reports">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              <span>Reports</span>
            </a>
            <a href="#/announcements" class="dash-action-btn-subtle" id="dash-act-broadcast">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Broadcast</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Executive Segmented Nav Tabs -->
      <div class="dash-nav-segmented" id="dash-nav-tabs">
        <button type="button" class="dash-nav-pill active" data-dash-tab="overview">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>العمليات والمؤشرات (Overview)</span>
        </button>
        <button type="button" class="dash-nav-pill" data-dash-tab="payroll">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          <span>الرواتب والمزايا (Payroll & Welfare)</span>
        </button>
        <button type="button" class="dash-nav-pill" data-dash-tab="facilities">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>المصانع وتوزيع العمل (Facilities)</span>
        </button>
        <button type="button" class="dash-nav-pill" data-dash-tab="security">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>أكواد التحقق والأمان (Security & OTP)</span>
          <span class="pill-badge" id="tab-otp-badge">0</span>
        </button>
        <button type="button" class="dash-nav-pill" data-dash-tab="apm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>صحة النظام والخوادم (APM Health)</span>
        </button>
      </div>

      <!-- ================= TAB 1: OVERVIEW & OPERATIONS ================= -->
      <div class="dash-panel active" id="panel-overview">
        <!-- 4-Card Hero KPI Grid -->
        <div class="kpi-grid-4">
          <!-- 1. Total Workforce -->
          <div class="kpi-card-v2 kpi-blue">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="kpi-icon-bubble blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <span class="stat-trend up" id="stat-active-emp-trend">Active</span>
            </div>
            <div class="kpi-num-large" id="stat-active-emp">—</div>
            <div class="kpi-title-sub">Total Workforce</div>
            <div class="kpi-meta-footer">
              <span id="stat-active-emp-meta">Active Staff Rate: —</span>
              <span style="color: var(--primary); font-weight: 600;">● Live</span>
            </div>
          </div>

          <!-- 2. Pending Requests -->
          <div class="kpi-card-v2 kpi-amber">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="kpi-icon-bubble amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <span class="stat-trend neutral" id="stat-pending-req-trend">Action Req</span>
            </div>
            <div class="kpi-num-large" id="stat-pending-req">—</div>
            <div class="kpi-title-sub">Pending Leaves & Requests</div>
            <div class="kpi-meta-footer">
              <span id="stat-pending-req-meta">Requires Review</span>
              <span style="color: var(--status-amber); font-weight: 600;">● Pending</span>
            </div>
          </div>

          <!-- 3. Approved Requests -->
          <div class="kpi-card-v2 kpi-green">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="kpi-icon-bubble green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <span class="stat-trend up" id="stat-approved-req-trend">Optimal</span>
            </div>
            <div class="kpi-num-large" id="stat-approved-req">—</div>
            <div class="kpi-title-sub">Approved Submissions</div>
            <div class="kpi-meta-footer">
              <span id="stat-approved-req-meta">Approval Rate: —</span>
              <span style="color: var(--status-green); font-weight: 600;">● Confirmed</span>
            </div>
          </div>

          <!-- 4. Monthly Net Payroll Pool -->
          <div class="kpi-card-v2 kpi-purple">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="kpi-icon-bubble purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <span class="stat-trend up">Disbursed</span>
            </div>
            <div class="kpi-num-large" id="stat-payroll-net">—</div>
            <div class="kpi-title-sub">Monthly Net Payroll Pool</div>
            <div class="kpi-meta-footer">
              <span id="stat-payroll-net-meta">Published: —</span>
              <span style="color: var(--status-purple); font-weight: 600;">● CBE WPS</span>
            </div>
          </div>
        </div>

        <!-- 2-Column Analytics Grid -->
        <div class="analytics-grid-2">
          <!-- 7-Day Request Volume SVG Chart -->
          <div class="analytics-card">
            <div class="analytics-card-header">
              <h3 class="analytics-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <span>حركة الطلبات اليومية (Daily Request Submissions - 7 Days)</span>
              </h3>
              <span class="badge badge-primary" style="font-size: 11px;">7-Day Velocity</span>
            </div>
            <div id="requests-chart-bars" style="height: 190px; padding: 6px 0; border-bottom: 1px solid var(--border-light); margin-bottom: 14px;">
              <!-- Dynamic SVG Chart populated by JS -->
            </div>
            <div style="display: flex; justify-content: space-around; font-size: 11.5px; color: var(--text-muted); padding-top: 4px;">
              <span><span style="color: var(--primary);">■</span> إجمالي الطلبات</span>
              <span><span style="color: var(--status-green);">■</span> معتمدة (Approved)</span>
              <span><span style="color: var(--status-red);">■</span> مرفوضة (Rejected)</span>
            </div>
          </div>

          <!-- Operational Shift Coverage -->
          <div class="analytics-card">
            <div class="analytics-card-header">
              <h3 class="analytics-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                <span>تغطية الورديات والمناوبات (Operational Shift Roster)</span>
              </h3>
              <span class="badge badge-primary" style="font-size: 11px;">Roster Health</span>
            </div>
            <div id="shift-distribution-content">
              <div style="display: flex; gap: 10px; margin-bottom: 16px;" id="shift-summary-badges"></div>
              <div id="shift-breakdown-rows" style="display: flex; flex-direction: column; gap: 12px;"></div>
            </div>
          </div>
        </div>

        <!-- Recent Operational Activity Stream -->
        <div class="analytics-card" style="margin-top: 24px;">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <span>سجل الأنشطة الإدارية الحديثة (Recent Operational Stream)</span>
            </h3>
            <a href="#/leave" class="btn btn-secondary btn-sm" id="dash-view-all-activity" style="text-decoration: none;">View All Leaves →</a>
          </div>
          <div id="recent-activity-list" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="color: var(--text-muted); font-size: 13px;">Loading operational stream...</div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 2: PAYROLL & WELFARE ================= -->
      <div class="dash-panel" id="panel-payroll">
        <div style="display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap;" id="quick-metrics-ribbon">
          <div class="metric-chip">
            <span style="color: var(--status-green);">●</span>
            <span>نسبة القوى العاملة النشطة: <b id="ribbon-active-rate">—%</b></span>
          </div>
          <div class="metric-chip">
            <span style="color: var(--primary);">●</span>
            <span>نسبة اعتماد الإجازات: <b id="ribbon-approval-rate">—%</b></span>
          </div>
          <div class="metric-chip">
            <span style="color: var(--status-purple);">●</span>
            <span>صافي محفظة الأجور: <b id="ribbon-payroll-pool">—</b></span>
          </div>
          <div class="metric-chip">
            <span style="color: var(--status-amber);">●</span>
            <span>أكواد التحقق النشطة: <b id="ribbon-active-otps">—</b></span>
          </div>
        </div>

        <div class="analytics-grid-2">
          <!-- Payroll Financial Commitment -->
          <div class="analytics-card">
            <div class="analytics-card-header">
              <h3 class="analytics-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <span>التزامات الأجور والبدلات (Payroll Financial Commitments)</span>
              </h3>
              <span class="badge badge-primary" style="font-size: 11px;">Monthly Pool</span>
            </div>
            <div id="payroll-financials-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
          </div>

          <!-- Employee Welfare & Popular Trips -->
          <div class="analytics-card">
            <div class="analytics-card-header">
              <h3 class="analytics-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                <span>الرعاية الاجتماعية والرحلات (Corporate Trips & Welfare)</span>
              </h3>
              <span class="badge badge-success" style="font-size: 11px;">Social Engagement</span>
            </div>
            <div id="trips-welfare-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
          </div>
        </div>

        <!-- Vacation Balances Summary Card -->
        <div class="analytics-card" style="margin-top: 24px;">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>أرصدة الإجازات المستهلكة (Vacation Days Consumed)</span>
            </h3>
            <span class="badge badge-secondary" style="font-size: 11px;">Workforce Balances</span>
          </div>
          <div style="display: flex; align-items: baseline; gap: 14px; padding: 8px 0;">
            <div style="font-size: 32px; font-weight: 800; color: var(--text-main);" id="stat-vacation-days">—</div>
            <div style="font-size: 13.5px; color: var(--text-muted);" id="stat-vacation-days-meta">Avg Balance: — days/emp</div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 3: FACILITIES & COVERAGE ================= -->
      <div class="dash-panel" id="panel-facilities">
        <div class="analytics-grid-2">
          <!-- Factory & Complex Allocation -->
          <div class="analytics-card">
            <div class="analytics-card-header">
              <h3 class="analytics-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span>توزيع العمالة بالمجمعات والمصانع (Headcount Distribution)</span>
              </h3>
              <span class="badge badge-success" style="font-size: 11px;">Facilities</span>
            </div>
            <div id="factory-distribution-list" style="display: flex; flex-direction: column; gap: 14px;"></div>
          </div>

          <!-- Requests by Category Breakdown -->
          <div class="analytics-card">
            <div class="analytics-card-header">
              <h3 class="analytics-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                <span>تصنيفات الطلبات والإجازات (Requests by Category)</span>
              </h3>
              <span class="badge" style="background: var(--surface-bg); color: var(--text-muted); font-size: 11px;">Breakdown</span>
            </div>
            <div id="requests-by-type-list" style="display: flex; flex-direction: column; gap: 14px;"></div>
          </div>
        </div>

        <!-- Shifts & Broadcasts Meta Footer Cards -->
        <div class="analytics-grid-2" style="margin-top: 24px;">
          <div class="analytics-card">
            <div class="analytics-card-header">
              <h3 class="analytics-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                <span>إجمالي العمالة المجدولة (Rostered Personnel)</span>
              </h3>
            </div>
            <div style="font-size: 28px; font-weight: 800; color: var(--text-main);" id="stat-shifts-rostered">—</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;" id="stat-shifts-meta">Weekly Hours: —</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-card-header">
              <h3 class="analytics-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>التعميمات والأخبار النشطة (Active Broadcasts)</span>
              </h3>
            </div>
            <div style="font-size: 28px; font-weight: 800; color: var(--text-main);" id="stat-broadcasts">—</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;" id="stat-broadcasts-meta">Announcements & News</div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 4: SECURITY & LIVE OTPS ================= -->
      <div class="dash-panel" id="panel-security">
        <div class="analytics-card" style="border-left: 4px solid var(--primary);">
          <div class="analytics-card-header" style="flex-wrap: wrap; gap: 14px;">
            <div>
              <h3 class="analytics-card-title">
                <span>🔐 مركز مراقبة أكواد التحقق (Live OTP / SMS Fallback Monitor)</span>
                <span class="badge badge-primary" style="font-size: 11px; padding: 2px 8px;">Realtime Stream</span>
              </h3>
              <p style="font-size: 13px; color: var(--text-muted); margin: 3px 0 0 0;">
                أكواد التحقق المؤقتة لتسجيل دخول وتعيين الرقم السري للموظفين عبر تطبيق الموبايل (صلاحية الكود 5 دقائق).
              </p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <input type="text" class="form-input" id="otp-live-search" placeholder="بحث بالاسم أو الهاتف..." style="width: 240px; padding: 7px 14px; font-size: 12.5px; border-radius: var(--radius-pill);" />
              <div id="otp-stats-badge" style="font-size: 12.5px; font-weight: 700; color: var(--text-muted); background: var(--surface-subtle); padding: 6px 12px; border-radius: var(--radius-pill);">
                النشطة حالياً: <b style="color: var(--status-green);" id="otp-active-counter">0</b>
              </div>
            </div>
          </div>
          <div id="live-otp-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 16px;">
            <div style="color: var(--text-muted); font-size: 13px;">No recent OTP requests.</div>
          </div>
        </div>
      </div>

      <!-- ================= TAB 5: APM & SYSTEM DIAGNOSTICS ================= -->
      <div class="dash-panel" id="panel-apm">
        <div class="analytics-card" style="border-left: 4px solid var(--status-green);">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
              <span>تشخيص الخوادم وأداء النظام (Enterprise APM & Server Health)</span>
            </h3>
            <span class="badge badge-success" id="apm-health-badge">🟢 HEALTHY (Optimal)</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 14px;" id="apm-metrics-grid">
            <div style="background: var(--surface-subtle); padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
              <small style="color: var(--text-muted); display: block; font-size: 11.5px; margin-bottom: 4px;">وقت تشغيل الخادم (Uptime)</small>
              <b id="apm-uptime" style="font-size: 15px; color: var(--text-main);">Loading...</b>
            </div>
            <div style="background: var(--surface-subtle); padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
              <small style="color: var(--text-muted); display: block; font-size: 11.5px; margin-bottom: 4px;">ذاكرة الخادم (Node.js Heap)</small>
              <b id="apm-memory" style="font-size: 15px; color: var(--text-main);">Loading...</b>
            </div>
            <div style="background: var(--surface-subtle); padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
              <small style="color: var(--text-muted); display: block; font-size: 11.5px; margin-bottom: 4px;">المتصلين بالبث الحي (Active SSE)</small>
              <b id="apm-sse" style="font-size: 15px; color: var(--primary);">Loading...</b>
            </div>
            <div style="background: var(--surface-subtle); padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
              <small style="color: var(--text-muted); display: block; font-size: 11.5px; margin-bottom: 4px;">وضع المعمارية (Cluster Mode)</small>
              <b id="apm-cluster" style="font-size: 15px; color: var(--text-main);">Standalone</b>
            </div>
          </div>
        </div>
      </div>
    `;

    // Tab switching event handlers
    const tabBtns = this.element.querySelectorAll('.dash-nav-pill');
    const panels = this.element.querySelectorAll('.dash-panel');
    tabBtns.forEach((btn) => {
      btn.onclick = () => {
        const target = btn.dataset.dashTab;
        tabBtns.forEach((b) => b.classList.remove('active'));
        panels.forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = this.element.querySelector(`#panel-${target}`);
        if (panel) panel.classList.add('active');
        sessionStorage.setItem('admin_dash_tab', target);
      };
    });
    const savedTab = sessionStorage.getItem('admin_dash_tab');
    if (savedTab) {
      const activeBtn = this.element.querySelector(`[data-dash-tab="${savedTab}"]`);
      if (activeBtn) activeBtn.click();
    }

    // Event handlers
    const refreshBtn = this.element.querySelector('#dash-refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        const icon = refreshBtn.querySelector('svg');
        if (icon) {
          icon.style.transition = 'transform 0.6s ease';
          icon.style.transform = 'rotate(360deg)';
        }
        try {
          await this.loadStats();
          toast.success('Dashboard Refreshed', 'Workforce KPIs and live stats updated successfully.');
        } catch (err) {
          toast.error('Refresh Failed', err.message);
        } finally {
          setTimeout(() => {
            refreshBtn.disabled = false;
            if (icon) icon.style.transform = '';
          }, 600);
        }
      };
    }

    const addEmpBtn = this.element.querySelector('#dash-act-add-emp');
    if (addEmpBtn) {
      addEmpBtn.onclick = () => {
        sessionStorage.setItem('admin_auto_action', 'add-employee');
        if (typeof this.onNavigate === 'function') {
          this.onNavigate('employees');
        } else {
          window.location.hash = '#/employees';
        }
      };
    }

    const broadcastBtn = this.element.querySelector('#dash-act-broadcast');
    if (broadcastBtn) {
      broadcastBtn.onclick = () => {
        sessionStorage.setItem('admin_auto_action', 'new-announcement');
        if (typeof this.onNavigate === 'function') {
          this.onNavigate('announcements');
        } else {
          window.location.hash = '#/announcements';
        }
      };
    }

    const loansBtn = this.element.querySelector('#dash-act-loans');
    if (loansBtn) {
      loansBtn.onclick = () => {
        if (typeof this.onNavigate === 'function') {
          this.onNavigate('loans');
        } else {
          window.location.hash = '#/loans';
        }
      };
    }

    const attendanceBtn = this.element.querySelector('#dash-act-attendance');
    if (attendanceBtn) {
      attendanceBtn.onclick = () => {
        if (typeof this.onNavigate === 'function') {
          this.onNavigate('attendance');
        } else {
          window.location.hash = '#/attendance';
        }
      };
    }

    const reportsBtn = this.element.querySelector('#dash-act-reports');
    if (reportsBtn) {
      reportsBtn.onclick = () => {
        if (typeof this.onNavigate === 'function') {
          this.onNavigate('reports');
        } else {
          window.location.hash = '#/reports';
        }
      };
    }

    const reqBtn = this.element.querySelector('#dash-goto-requests');
    if (reqBtn) {
      reqBtn.onclick = () => {
        if (typeof this.onNavigate === 'function') {
          this.onNavigate('leave');
        } else {
          window.location.hash = '#/leave';
        }
      };
    }

    const viewAllAct = this.element.querySelector('#dash-view-all-activity');
    if (viewAllAct) {
      viewAllAct.onclick = () => {
        if (typeof this.onNavigate === 'function') {
          this.onNavigate('leave');
        } else {
          window.location.hash = '#/leave';
        }
      };
    }

    // Live search filter inside OTP container
    const otpSearch = this.element.querySelector('#otp-live-search');
    if (otpSearch) {
      otpSearch.oninput = () => {
        this.filterOtps(otpSearch.value);
      };
    }

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

  filterOtps(query) {
    const q = (query || '').trim().toLowerCase();
    const stats = store.state.stats || {};
    const otps = stats.recentOtps || [];
    if (!q) {
      this.renderOtps(otps);
    } else {
      const filtered = otps.filter((o) => {
        return (
          (o.employeeName && o.employeeName.toLowerCase().includes(q)) ||
          (o.phone && o.phone.includes(q)) ||
          (o.nationalId && o.nationalId.includes(q)) ||
          (o.code && o.code.includes(q))
        );
      });
      this.renderOtps(filtered);
    }
  }

  renderOtps(otps) {
    const otpContainer = this.element.querySelector('#live-otp-container');
    const otpActiveCounter = this.element.querySelector('#otp-active-counter');
    if (!otpContainer) return;

    otpContainer.innerHTML = '';
    const activeCount = otps.filter((o) => !o.isExpired).length;
    if (otpActiveCounter) otpActiveCounter.textContent = activeCount;

    if (otps.length === 0) {
      otpContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; grid-column: 1/-1; padding: 18px 0; text-align: center;">No matching verification codes found.</div>`;
      return;
    }

    for (const item of otps) {
      const card = document.createElement('div');
      card.className = 'otp-live-card';

      const elapsedMs = item.timestamp ? Math.max(0, Date.now() - item.timestamp) : 0;
      const timeAgo = Math.floor(elapsedMs / 60000);
      const timeText = timeAgo === 0 ? 'Just now' : `${timeAgo}m ago`;
      const isExpired = item.isExpired || timeAgo >= 5;
      const progressPct = isExpired ? 0 : Math.max(0, Math.min(100, Math.round(((300000 - elapsedMs) / 300000) * 100)));

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <b style="color: var(--text-main); font-size: 14px; display: block;">${item.employeeName || 'Workforce Member'}</b>
            <small style="color: var(--text-muted); font-size: 12px; font-family: monospace;">🇪🇬 ${item.phone || item.nationalId || '—'}</small>
          </div>
          <span class="badge ${isExpired ? 'badge-danger' : 'badge-success'}" style="font-size: 11px;">
            <span class="badge-dot"></span>
            ${isExpired ? 'Expired' : timeText}
          </span>
        </div>

        <div class="otp-code-box">
          <span class="otp-code-val">${item.code || '------'}</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-${item.code}" style="padding: 4px 10px; font-size: 11.5px; border-radius: var(--radius-xs);">
            Copy
          </button>
        </div>

        <div style="background: var(--surface-subtle); height: 4px; border-radius: var(--radius-pill); overflow: hidden;">
          <div class="otp-timer-bar" style="width: ${progressPct}%; background-color: ${isExpired ? 'var(--status-red)' : 'var(--status-green)'};"></div>
        </div>
      `;

      const copyBtn = card.querySelector(`#btn-copy-${item.code}`);
      if (copyBtn && item.code) {
        copyBtn.onclick = () => {
          navigator.clipboard?.writeText(item.code);
          copyBtn.textContent = 'Copied! ✓';
          copyBtn.style.color = 'var(--status-green)';
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.style.color = '';
          }, 2000);
          toast.success('Code Copied', `OTP verification code ${item.code} copied to clipboard.`);
        };
      }

      otpContainer.appendChild(card);
    }
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

      // Check subscription expiry warning / freeze
      try {
        const sub = await subscriptionApi.getStatus();
        this.renderSubscriptionBanner(sub);
      } catch (_) {
        // Fail safely if subscription check is unavailable
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  renderSubscriptionBanner(sub) {
    if (!this.element) return;
    const container = this.element.querySelector('#subscription-alert-container');
    if (!container || !sub) return;

    if (sub.status === 'warning') {
      const days = sub.daysUntilExpiry ?? 0;
      container.innerHTML = `
        <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-left: 5px solid #F59E0B; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 22px;">⚠️</span>
            <div>
              <div style="font-weight: 700; color: #92400E; font-size: 14.5px;">تنبيه انتهاء الاشتراك — باقي ${days} يوم</div>
              <div style="color: #B45309; font-size: 13px; margin-top: 2px;">
                ينتهي اشتراك باقة (${sub.plan || 'Enterprise'}) في <b>${sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString('ar-EG') : 'قريباً'}</b>. يرجى التواصل مع إدارة المنصة للتجديد قبل تجميد العمليات.
              </div>
            </div>
          </div>
          <span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px;">
            ${days} أيام متبقية
          </span>
        </div>
      `;
    } else if (sub.status === 'frozen') {
      container.innerHTML = `
        <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-left: 5px solid #EF4444; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 22px;">🔒</span>
            <div>
              <div style="font-weight: 700; color: #991B1B; font-size: 14.5px;">الاشتراك مجمد (وضع القراءة فقط — Read-Only Mode)</div>
              <div style="color: #B91C1C; font-size: 13px; margin-top: 2px;">
                انتهى اشتراك شركتك وتجاوز فترة السماح. تم قفل العمليات التحويلية (إضافة/تعديل). يرجى تجديد الاشتراك لاستعادة الصلاحيات.
              </div>
            </div>
          </div>
          <span class="badge" style="background: #FEE2E2; color: #991B1B; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px;">
            مجمد
          </span>
        </div>
      `;
    } else {
      container.innerHTML = '';
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

    // 3. Render OTPs
    this.renderOtps(s.recentOtps || []);

    // 4. Daily Request Velocity SVG Chart
    const chartContainer = this.element.querySelector('#requests-chart-bars');
    if (chartContainer) {
      const days = s.requestsByDay || [];
      const maxCount = Math.max(...days.map((d) => d.count), 1);
      const svgHeight = 150;
      const svgWidth = 500;
      const barWidth = 36;
      const step = svgWidth / Math.max(days.length, 1);

      let barsSvg = '';
      days.forEach((d, idx) => {
        const h = Math.max(8, Math.round((d.count / maxCount) * (svgHeight - 40)));
        const x = idx * step + (step - barWidth) / 2;
        const y = svgHeight - 24 - h;
        const textY = y - 6;
        const labelY = svgHeight - 6;

        barsSvg += `
          <g class="chart-col-group" cursor="pointer">
            <title>${d.label}: ${d.count} requests (${d.approved || 0} approved, ${d.rejected || 0} rejected)</title>
            <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="6" fill="url(#dashChartGradient)" filter="drop-shadow(0 2px 4px rgba(2,132,199,0.25))"></rect>
            <text x="${x + barWidth / 2}" y="${textY}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-main)">${d.count}</text>
            <text x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-muted)">${d.label}</text>
          </g>
        `;
      });

      chartContainer.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
          <defs>
            <linearGradient id="dashChartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0284C7"/>
              <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.85"/>
            </linearGradient>
          </defs>
          <line x1="0" y1="${svgHeight - 24}" x2="${svgWidth}" y2="${svgHeight - 24}" stroke="var(--border-light)" stroke-width="1"/>
          ${barsSvg}
        </svg>
      `;
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
