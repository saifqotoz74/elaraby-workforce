// Incentives & Deductions Admin View Component
// Native ES Module with real-time monthly adjustments calculation and payroll posting.

import { incentivesApi } from '../api/services.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { toast } from '../components/Toast.js';
import { escapeHtml } from '../utils/sanitize.js';

export class IncentivesView {
  constructor(containerOrOpts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
    } else {
      this.container = null;
    }
    this.element = document.createElement('div');
    this.element.className = 'incentives-view animate-fade-in';
    this.adjustments = [];
    this.selectedPeriod = new Date().toISOString().slice(0, 7);
    this.isLoading = false;
    this.isPosting = false;
    this.totalIncentives = 0;
    this.totalDeductions = 0;
    this.netAdjustment = 0;
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
      const res = await incentivesApi.getSummary();
      const list = Array.isArray(res?.data)
        ? res.data
        : (Array.isArray(res) ? res : []);

      this.adjustments = list;
      this.calculateTotals();
      this.renderKpis();
      this.renderTable();
    } catch (err) {
      console.error('Failed to load incentives data:', err);
      toast.error('خطأ في تحميل الحوافز والجزاءات', err.message || 'تعذر جلب بيانات التعديلات');
    } finally {
      this.isLoading = false;
      this.setLoadingState(false);
    }
  }

  calculateTotals() {
    let inc = 0;
    let ded = 0;
    let net = 0;

    for (const item of this.adjustments) {
      inc += Number(item.totalIncentivesEgp) || 0;
      ded += Number(item.totalDeductionsEgp) || 0;
      net += Number(item.netAdjustmentEgp) || (Number(item.totalIncentivesEgp) || 0) - (Number(item.totalDeductionsEgp) || 0);
    }

    this.totalIncentives = inc;
    this.totalDeductions = ded;
    this.netAdjustment = net;
  }

  setLoadingState(loading) {
    const refreshBtn = this.element.querySelector('#btn-refresh-incentives');
    if (refreshBtn) {
      refreshBtn.disabled = loading;
      const text = refreshBtn.querySelector('span');
      if (text) text.textContent = loading ? 'جاري التحميل...' : 'تحديث / Refresh';
    }
  }

  bindEvents() {
    const refreshBtn = this.element.querySelector('#btn-refresh-incentives');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }

    const postBtn = this.element.querySelector('#btn-post-to-payroll');
    if (postBtn) {
      postBtn.addEventListener('click', () => this.handlePostToPayroll());
    }

    const periodInput = this.element.querySelector('#incentives-period-select');
    if (periodInput) {
      periodInput.addEventListener('change', (e) => {
        this.selectedPeriod = e.target.value;
      });
    }
  }

  async handlePostToPayroll() {
    if (this.isPosting) return;

    const confirmed = await confirmDialog({
      title: 'ترحيل الحوافز والجزاءات للرواتب / Post to Payroll',
      message: `هل أنت متأكد من ترحيل تعديلات شهر (${this.selectedPeriod}) لجميع الموظفين إلى مسير الرواتب؟ سيتم تحديث استحقاقات وبدلات الموظفين مباشرة.`,
      confirmText: 'تأكيد الترحيل للرواتب',
      cancelText: 'إلغاء',
    });

    if (!confirmed) return;

    const postBtn = this.element.querySelector('#btn-post-to-payroll');
    this.isPosting = true;
    if (postBtn) {
      postBtn.disabled = true;
      postBtn.textContent = 'جاري الترحيل... / Posting...';
    }

    try {
      const res = await incentivesApi.postToPayroll({ period: this.selectedPeriod });
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to post adjustments');
      }

      const count = res?.data?.postedCount ?? res?.count ?? this.adjustments.length;
      toast.success(
        'تم الترحيل بنجاح',
        `تم ترحيل تعديلات الحوافز والجزاءات لـ ${count} موظف إلى مسير رواتب ${this.selectedPeriod}.`
      );

      await this.loadData();
    } catch (err) {
      console.error('Failed to post to payroll:', err);
      toast.error('فشل الترحيل للرواتب', err.message || 'تعذر ترحيل التعديلات إلى مسير الرواتب');
    } finally {
      this.isPosting = false;
      if (postBtn) {
        postBtn.disabled = false;
        postBtn.textContent = 'ترحيل للرواتب / Post to Payroll';
      }
    }
  }

  renderKpis() {
    const incEl = this.element.querySelector('#kpi-total-incentives');
    const dedEl = this.element.querySelector('#kpi-total-deductions');
    const netEl = this.element.querySelector('#kpi-net-adjustment');

    if (incEl) incEl.textContent = `${this.totalIncentives.toLocaleString()} EGP`;
    if (dedEl) dedEl.textContent = `${this.totalDeductions.toLocaleString()} EGP`;
    if (netEl) {
      const sign = this.netAdjustment >= 0 ? '+' : '';
      netEl.textContent = `${sign}${this.netAdjustment.toLocaleString()} EGP`;
      netEl.style.color = this.netAdjustment >= 0 ? 'var(--status-green)' : 'var(--status-red)';
    }
  }

  renderTable() {
    const tbody = this.element.querySelector('#incentives-tbody');
    if (!tbody) return;

    if (this.adjustments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
            لا توجد سجلات تعديلات للموظفين حالياً / No adjustment records found
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.adjustments.map((item) => {
      const incentivesList = (item.incentives || [])
        .map((inc) => `<span class="badge badge-success">+${(Number(inc.amount) || 0).toLocaleString()} (${escapeHtml(inc.reason || '')})</span>`)
        .join(' ');

      const deductionsList = (item.deductions || [])
        .map((ded) => `<span class="badge badge-danger">-${(Number(ded.amount) || 0).toLocaleString()} (${escapeHtml(ded.reason || '')})</span>`)
        .join(' ');

      const netAmount = Number(item.netAdjustmentEgp) || ((Number(item.totalIncentivesEgp) || 0) - (Number(item.totalDeductionsEgp) || 0));
      const netSign = netAmount >= 0 ? '+' : '';
      const netColor = netAmount >= 0 ? 'var(--status-green)' : 'var(--status-red)';

      return `
        <tr>
          <td><strong>${escapeHtml(item.employeeCode || item.employeeId || '—')}</strong></td>
          <td>${escapeHtml(item.name || '—')}</td>
          <td>${escapeHtml(item.department || '—')}</td>
          <td>${incentivesList || '<span style="color: var(--text-muted);">—</span>'}</td>
          <td>${deductionsList || '<span style="color: var(--text-muted);">—</span>'}</td>
          <td style="color: var(--status-green); font-weight: 700;">+${(Number(item.totalIncentivesEgp) || 0).toLocaleString()} EGP</td>
          <td style="color: var(--status-red); font-weight: 700;">-${(Number(item.totalDeductionsEgp) || 0).toLocaleString()} EGP</td>
          <td style="color: ${netColor}; font-weight: 800;">${netSign}${netAmount.toLocaleString()} EGP</td>
        </tr>
      `;
    }).join('');
  }

  render() {
    this.element.innerHTML = `
      <div class="toolbar-container" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            Incentives & Deductions / الحوافز والجزاءات
          </h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin: 0;">
            Automated production bonuses, disciplinary ladder deductions, and automated payroll posting.
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 12.5px; font-weight: 600; color: var(--text-muted);">شهر الاستحقاق:</label>
            <input type="month" id="incentives-period-select" class="form-input" style="padding: 4px 8px; width: 150px;" value="${this.selectedPeriod}" />
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-incentives" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>تحديث / Refresh</span>
          </button>
          <button class="btn btn-primary btn-sm" id="btn-post-to-payroll" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>ترحيل للرواتب / Post to Payroll</span>
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card" style="padding: 1.25rem; background: var(--bg-card); border-radius: 8px; border-left: 4px solid var(--status-green);">
          <small style="color: var(--text-muted); display: block; font-weight: 600;">Total Incentives / إجمالي الحوافز</small>
          <strong id="kpi-total-incentives" style="font-size: 22px; color: var(--status-green); font-weight: 800;">${this.totalIncentives.toLocaleString()} EGP</strong>
        </div>
        <div class="card" style="padding: 1.25rem; background: var(--bg-card); border-radius: 8px; border-left: 4px solid var(--status-red);">
          <small style="color: var(--text-muted); display: block; font-weight: 600;">Total Deductions / إجمالي الاستقطاعات</small>
          <strong id="kpi-total-deductions" style="font-size: 22px; color: var(--status-red); font-weight: 800;">${this.totalDeductions.toLocaleString()} EGP</strong>
        </div>
        <div class="card" style="padding: 1.25rem; background: var(--bg-card); border-radius: 8px; border-left: 4px solid var(--primary);">
          <small style="color: var(--text-muted); display: block; font-weight: 600;">Net Adjustment / صافي التعديل</small>
          <strong id="kpi-net-adjustment" style="font-size: 22px; color: var(--primary); font-weight: 800;">+${this.netAdjustment.toLocaleString()} EGP</strong>
        </div>
      </div>

      <!-- Disciplinary Ladder Reference Card -->
      <div class="card rules-card" style="margin-bottom: 1.5rem; padding: 1rem 1.25rem; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-light);">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: var(--text-main);">
          قواعد لائحة الجزاءات ونسب الخصم (Egyptian Labor Law Disciplinary Ladder)
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; font-size: 12.5px; color: var(--text-muted);">
          <div>• تأخير للمرة الأولى (&lt;15 دقيقة): <strong>إنذار كتابي</strong></div>
          <div>• تأخير للمرة الثانية (15-60 دقيقة): <strong>خصم 0.25 يوم</strong></div>
          <div>• غياب بدون إذن: <strong>خصم مضاعف (200% من الأجر اليومي)</strong></div>
          <div>• مخالفة مهمات السلامة (PPE): <strong>خصم 0.5 يوم (أو 100 ج.م كحد أدنى)</strong></div>
        </div>
      </div>

      <!-- Adjustments Data Table -->
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 1.5rem;">
        <table class="data-table" style="width: 100%;">
          <thead>
            <tr>
              <th>Emp Code / الكود</th>
              <th>Name / الموظف</th>
              <th>Department / القسم</th>
              <th>Incentives / الحوافز</th>
              <th>Deductions / الجزاءات</th>
              <th>Total Inc. / الحوافز</th>
              <th>Total Ded. / الاستقطاعات</th>
              <th>Net / الصافي</th>
            </tr>
          </thead>
          <tbody id="incentives-tbody">
            <tr><td colspan="8" style="text-align: center; padding: 24px;">جاري حساب وتجميع الحوافز والجزاءات...</td></tr>
          </tbody>
        </table>
      </div>
    `;
    return this.element;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { IncentivesView };
}
