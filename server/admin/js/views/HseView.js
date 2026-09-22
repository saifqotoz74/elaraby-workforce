// Health, Safety & Environment (HSE) Admin View Component
// Native ES Module with real-time KPI metrics, permits management, and incident tracking.

import { hseApi } from '../api/services.js';
import { confirmDialog, promptDialog } from '../components/ConfirmDialog.js';
import { toast } from '../components/Toast.js';
import { escapeHtml } from '../utils/sanitize.js';

export class HseView {
  constructor(containerOrOpts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
    } else {
      this.container = null;
    }
    this.element = document.createElement('div');
    this.element.className = 'hse-view animate-fade-in';
    this.activeTab = 'permits';
    this.summary = {
      daysWithoutLti: 0,
      activePermitsCount: 0,
      openIncidentsCount: 0,
      complianceScore: 100,
    };
    this.permits = [];
    this.incidents = [];
    this.isLoading = false;
    this.decidingPermitId = null;
  }

  async mount() {
    this.render();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(this.element);
    }
    this.bindEvents();
    await this.loadData();
    return this.element;
  }

  destroy() {}

  async loadData() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.setLoadingState(true);

    try {
      const [summaryRes, permitsRes, incidentsRes] = await Promise.all([
        hseApi.getSummary().catch((err) => {
          console.warn('Failed to load HSE summary:', err);
          return { success: false, data: null };
        }),
        hseApi.listPermits().catch((err) => {
          console.warn('Failed to load permits:', err);
          return { success: false, data: [] };
        }),
        hseApi.listIncidents().catch((err) => {
          console.warn('Failed to load incidents:', err);
          return { success: false, data: [] };
        }),
      ]);

      const sumData = summaryRes?.data || summaryRes;
      if (sumData && typeof sumData === 'object') {
        this.summary = {
          daysWithoutLti: sumData.daysWithoutLti ?? 0,
          activePermitsCount: sumData.activePermitsCount ?? 0,
          openIncidentsCount: sumData.openIncidentsCount ?? 0,
          complianceScore: sumData.complianceScore ?? 100,
        };
      }

      this.permits = Array.isArray(permitsRes?.data)
        ? permitsRes.data
        : (Array.isArray(permitsRes) ? permitsRes : []);

      this.incidents = Array.isArray(incidentsRes?.data)
        ? incidentsRes.data
        : (Array.isArray(incidentsRes) ? incidentsRes : []);

      this.renderKpis();
      this.renderPermitsTable();
      this.renderIncidentsTable();
    } catch (err) {
      console.error('Failed to load HSE data:', err);
      toast.error('خطأ في تحميل البيانات', err.message || 'فشل في تحميل بيانات السلامة والصحة المهنية');
    } finally {
      this.isLoading = false;
      this.setLoadingState(false);
    }
  }

  setLoadingState(loading) {
    const refreshBtn = this.element.querySelector('#btn-refresh-hse');
    if (refreshBtn) {
      refreshBtn.disabled = loading;
      const text = refreshBtn.querySelector('span');
      if (text) text.textContent = loading ? 'جاري التحميل...' : 'تحديث / Refresh';
    }
  }

  bindEvents() {
    const tabPermitsBtn = this.element.querySelector('#tab-btn-permits');
    const tabIncidentsBtn = this.element.querySelector('#tab-btn-incidents');
    const refreshBtn = this.element.querySelector('#btn-refresh-hse');

    if (tabPermitsBtn && tabIncidentsBtn) {
      tabPermitsBtn.addEventListener('click', () => this.switchTab('permits'));
      tabIncidentsBtn.addEventListener('click', () => this.switchTab('incidents'));
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }
  }

  switchTab(tab) {
    this.activeTab = tab;
    const permitsTab = this.element.querySelector('#permits-tab');
    const incidentsTab = this.element.querySelector('#incidents-tab');
    const tabPermitsBtn = this.element.querySelector('#tab-btn-permits');
    const tabIncidentsBtn = this.element.querySelector('#tab-btn-incidents');

    if (tab === 'permits') {
      if (permitsTab) permitsTab.style.display = 'block';
      if (incidentsTab) incidentsTab.style.display = 'none';
      if (tabPermitsBtn) {
        tabPermitsBtn.className = 'tab-btn btn btn-primary';
      }
      if (tabIncidentsBtn) {
        tabIncidentsBtn.className = 'tab-btn btn btn-secondary';
      }
    } else {
      if (permitsTab) permitsTab.style.display = 'none';
      if (incidentsTab) incidentsTab.style.display = 'block';
      if (tabPermitsBtn) {
        tabPermitsBtn.className = 'tab-btn btn btn-secondary';
      }
      if (tabIncidentsBtn) {
        tabIncidentsBtn.className = 'tab-btn btn btn-primary';
      }
    }
  }

  renderKpis() {
    const daysEl = this.element.querySelector('#kpi-lti-days');
    const permitsEl = this.element.querySelector('#kpi-active-permits');
    const incidentsEl = this.element.querySelector('#kpi-open-incidents');
    const complianceEl = this.element.querySelector('#kpi-ppe-compliance');

    if (daysEl) daysEl.textContent = `${this.summary.daysWithoutLti} days`;
    if (permitsEl) permitsEl.textContent = `${this.summary.activePermitsCount}`;
    if (incidentsEl) incidentsEl.textContent = `${this.summary.openIncidentsCount}`;
    if (complianceEl) complianceEl.textContent = `${this.summary.complianceScore}%`;
  }

  renderPermitsTable() {
    const tbody = this.element.querySelector('#permits-tbody');
    if (!tbody) return;

    if (this.permits.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
            لا توجد تصاريح عمل مسجلة حالياً / No permits found
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.permits.map((p) => {
      const isPending = p.status === 'pending';
      const isApproved = p.status === 'approved';
      const isRejected = p.status === 'rejected';

      let statusBadge = '<span class="badge badge-warning">قيد الانتظار / Pending</span>';
      if (isApproved) {
        statusBadge = '<span class="badge badge-success">معتمد / Approved</span>';
      } else if (isRejected) {
        statusBadge = '<span class="badge badge-danger">مرفوض / Rejected</span>';
      }

      const isCurrentBusy = this.decidingPermitId === p.id;
      let actionButtons = '—';
      if (isPending) {
        actionButtons = `
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-success btn-approve-permit" data-id="${escapeHtml(p.id)}" type="button" ${isCurrentBusy ? 'disabled' : ''}>
              ${isCurrentBusy ? '...' : 'اعتماد'}
            </button>
            <button class="btn btn-sm btn-danger btn-reject-permit" data-id="${escapeHtml(p.id)}" type="button" ${isCurrentBusy ? 'disabled' : ''}>
              ${isCurrentBusy ? '...' : 'رفض'}
            </button>
          </div>
        `;
      } else if (p.reviewer) {
        actionButtons = `<small style="color: var(--text-muted);">${escapeHtml(p.reviewer)}</small>`;
      }

      const validUntilStr = p.validUntil
        ? new Date(p.validUntil).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
        : '—';

      return `
        <tr data-permit-row="${escapeHtml(p.id)}">
          <td><strong>${escapeHtml(p.id)}</strong></td>
          <td>${escapeHtml(p.type || 'Standard')}</td>
          <td>${escapeHtml(p.line || '—')}</td>
          <td>${statusBadge}</td>
          <td>${escapeHtml(validUntilStr)}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    }).join('');

    // Bind permit decision buttons
    tbody.querySelectorAll('.btn-approve-permit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.handleDecidePermit(id, 'approved');
      });
    });

    tbody.querySelectorAll('.btn-reject-permit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.handleDecidePermit(id, 'rejected');
      });
    });
  }

  async handleDecidePermit(permitId, decision) {
    if (this.decidingPermitId) return;

    let reason = '';
    if (decision === 'rejected') {
      reason = await promptDialog({
        title: 'رفض تصريح العمل / Reject Permit',
        message: `يرجى تحديد سبب رفض التصريح (${permitId}):`,
        placeholder: 'سبب الرفض...',
        required: true,
        confirmText: 'تأكيد الرفض',
        cancelText: 'إلغاء',
      });
      if (!reason) return;
    } else {
      const confirmed = await confirmDialog({
        title: 'اعتماد تصريح العمل / Approve Permit',
        message: `هل أنت متأكد من اعتماد تصريح العمل رقم (${permitId})؟`,
        confirmText: 'اعتماد التصريح',
        cancelText: 'إلغاء',
      });
      if (!confirmed) return;
      reason = 'Approved by HSE Officer';
    }

    try {
      this.decidingPermitId = permitId;
      this.renderPermitsTable();

      const res = await hseApi.decidePermit(permitId, decision, reason);
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to update permit');
      }

      toast.success(
        decision === 'approved' ? 'تم اعتماد التصريح' : 'تم رفض التصريح',
        `تم تحديث تصريح العمل ${permitId} بنجاح.`
      );
      await this.loadData();
    } catch (err) {
      console.error('Failed to decide permit:', err);
      toast.error('فشل الإجراء', err.message || 'تعذر تحديث تصريح العمل');
      this.decidingPermitId = null;
      this.renderPermitsTable();
    }
  }

  renderIncidentsTable() {
    const tbody = this.element.querySelector('#incidents-tbody');
    if (!tbody) return;

    if (this.incidents.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
            لا توجد بلاغات أو حوادث مسجلة حالياً / No incidents recorded
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.incidents.map((i) => {
      const sev = (i.severity || 'medium').toLowerCase();
      let sevClass = 'pill-medium';
      let sevColor = '#f59e0b';
      if (sev === 'critical' || sev === 'high') {
        sevClass = 'pill-high';
        sevColor = '#ef4444';
      } else if (sev === 'low') {
        sevClass = 'pill-low';
        sevColor = '#10b981';
      }

      const injuryHtml = i.injuryReported
        ? '<span class="badge badge-danger">نعم / Injury Reported</span>'
        : '<span class="badge badge-neutral">لا / No</span>';

      const dateStr = i.createdAt
        ? new Date(i.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
        : '—';

      return `
        <tr>
          <td><strong>${escapeHtml(i.id)}</strong></td>
          <td>${escapeHtml(i.title || i.description || 'Incident')}</td>
          <td>${escapeHtml(i.line || '—')}</td>
          <td><span class="pill ${sevClass}" style="color: ${sevColor}; font-weight: bold;">${escapeHtml(i.severity || 'Medium')}</span></td>
          <td>${injuryHtml}</td>
          <td>${escapeHtml(dateStr)}</td>
        </tr>
      `;
    }).join('');
  }

  render() {
    this.element.innerHTML = `
      <div class="toolbar-container" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            HSE Dashboard / السلامة والصحة المهنية
          </h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin: 0;">
            Real-time shop-floor safety surveillance, work permits management, and incident response.
          </p>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-hse" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>تحديث / Refresh</span>
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card" style="padding: 1.25rem; background: var(--bg-card); border-radius: 8px; border-left: 4px solid var(--status-green);">
          <small style="color: var(--text-muted); display: block; font-weight: 600;">Days Without LTI / أيام بلا إصابات</small>
          <strong id="kpi-lti-days" style="font-size: 22px; color: var(--text-main); font-weight: 800;">${this.summary.daysWithoutLti} days</strong>
        </div>
        <div class="card" style="padding: 1.25rem; background: var(--bg-card); border-radius: 8px; border-left: 4px solid var(--status-yellow);">
          <small style="color: var(--text-muted); display: block; font-weight: 600;">Active Permits / تصاريح معلقة</small>
          <strong id="kpi-active-permits" style="font-size: 22px; color: var(--status-yellow); font-weight: 800;">${this.summary.activePermitsCount}</strong>
        </div>
        <div class="card" style="padding: 1.25rem; background: var(--bg-card); border-radius: 8px; border-left: 4px solid var(--status-red);">
          <small style="color: var(--text-muted); display: block; font-weight: 600;">Open Incidents / بلاغات مفتوحة</small>
          <strong id="kpi-open-incidents" style="font-size: 22px; color: var(--status-red); font-weight: 800;">${this.summary.openIncidentsCount}</strong>
        </div>
        <div class="card" style="padding: 1.25rem; background: var(--bg-card); border-radius: 8px; border-left: 4px solid var(--primary);">
          <small style="color: var(--text-muted); display: block; font-weight: 600;">PPE Compliance / التزام مهمات الوقاية</small>
          <strong id="kpi-ppe-compliance" style="font-size: 22px; color: var(--primary); font-weight: 800;">${this.summary.complianceScore}%</strong>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs" style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
        <button class="tab-btn btn btn-primary" id="tab-btn-permits" type="button">تصاريح العمل (Permits)</button>
        <button class="tab-btn btn btn-secondary" id="tab-btn-incidents" type="button">الحوادث والبلاغات (Incidents)</button>
      </div>

      <!-- Permits Tab Content -->
      <div class="tab-content" id="permits-tab">
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Permit ID / رقم التصريح</th>
                <th>Type / نوع التصريح</th>
                <th>Line / خط الإنتاج</th>
                <th>Status / الحالة</th>
                <th>Valid Until / صالح حتى</th>
                <th>Action / الإجراء</th>
              </tr>
            </thead>
            <tbody id="permits-tbody">
              <tr><td colspan="6" style="text-align: center; padding: 24px;">جاري تحميل التصاريح...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Incidents Tab Content -->
      <div class="tab-content" id="incidents-tab" style="display: none;">
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Incident ID / رقم البلاغ</th>
                <th>Title / Description</th>
                <th>Line / خط الإنتاج</th>
                <th>Severity / الخطورة</th>
                <th>Injury / إصابة عمل</th>
                <th>Date / التاريخ</th>
              </tr>
            </thead>
            <tbody id="incidents-tbody">
              <tr><td colspan="6" style="text-align: center; padding: 24px;">جاري تحميل البلاغات...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    return this.element;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { HseView };
}
