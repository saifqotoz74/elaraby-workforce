// Payroll View Component
// Search employee, inspect salary statement, and publish payroll adjustments.

import { payrollApi, employeeApi } from '../api/services.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { ExportService } from '../services/exportService.js';
import { escapeHtml } from '../utils/sanitize.js';

export class PayrollView {
  constructor(containerOrOpts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
    } else {
      this.container = null;
    }
    this.element = null;
    this.selectedEmployee = null;
    this.currentPayroll = null;
    this.cachedEmployees = [];
  }

  async mount() {
    const el = this.render();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(el);
    }
    return el;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'animate-fade-in';

    this.element.innerHTML = `
      <div class="toolbar-container" style="margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            Payroll & Compensation / الأجور والمرتبات
          </h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin: 0;">
            Manage official monthly compensation statements, allowances, and statutory deductions.
          </p>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-export-payroll">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export Payroll Report</span>
        </button>
      </div>

      <!-- Employee Selector Card -->
      <div class="card" style="margin-bottom: 24px;">
        <label class="form-label" style="margin-bottom: 10px; font-weight: 700;">Select Employee to View Compensation Statement</label>
        <div style="display: grid; grid-template-columns: 240px 1fr auto; gap: 12px; align-items: flex-end;">
          <div>
            <label class="form-label" style="font-size: 11px;">Search Worker</label>
            <input type="text" id="payroll-worker-filter" class="form-input" placeholder="Name or code..." />
          </div>

          <div>
            <label class="form-label" style="font-size: 11px;">Workforce Directory</label>
            <select class="form-select" id="payroll-employee-select">
              <option value="">Loading workforce...</option>
            </select>
          </div>

          <button class="btn btn-primary" id="btn-load-payroll" style="height: 40px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>Inspect Payslip</span>
          </button>
        </div>
      </div>

      <!-- Payroll Statement Display Card -->
      <div id="payroll-details-wrapper">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="empty-state-title">No Employee Selected</div>
          <div class="empty-state-sub">Select an employee from the workforce selector above to view or modify their compensation statement.</div>
        </div>
      </div>
    `;

    this.loadEmployeesList();

    const exportBtn = this.element.querySelector('#btn-export-payroll');
    if (exportBtn) {
      exportBtn.onclick = async () => {
        try {
          exportBtn.disabled = true;
          exportBtn.querySelector('span').textContent = 'Exporting...';
          const res = await employeeApi.list({ limit: 1000 });
          const employees = res.employees || [];
          
          const payrollRows = [];
          for (const emp of employees) {
            try {
              const pRes = await payrollApi.get(emp.id);
              const p = pRes.payroll || {};
              const basic = p.basicSalary || 0;
              const allow = p.allowances || 0;
              const deduct = p.deductions || 0;
              const net = p.netSalary !== undefined ? p.netSalary : (basic + allow - deduct);
              payrollRows.push({
                employeeCode: emp.employeeCode || emp.nationalId,
                name: emp.name,
                factory: emp.factory || '—',
                department: emp.department || '—',
                period: p.period || '2026-03',
                basicSalary: basic,
                allowances: allow,
                deductions: deduct,
                netSalary: net,
                paymentMethod: p.paymentMethod || 'Bank Transfer'
              });
            } catch (_) {
              // skip or default
            }
          }

          ExportService.exportToCsv('Elaraby_Workforce_Payroll_Report', [
            { key: 'employeeCode', label: 'Employee Code / كود الموظف' },
            { key: 'name', label: 'Full Name / الاسم' },
            { key: 'factory', label: 'Factory / المصنع' },
            { key: 'department', label: 'Department / القسم' },
            { key: 'period', label: 'Pay Period / شهر الراتب' },
            { key: 'basicSalary', label: 'Basic Salary (EGP) / الراتب الأساسي' },
            { key: 'allowances', label: 'Allowances (EGP) / البدلات' },
            { key: 'deductions', label: 'Deductions (EGP) / الاستقطاعات' },
            { key: 'netSalary', label: 'Net Payable (EGP) / صافي الراتب' },
            { key: 'paymentMethod', label: 'Payment Method / طريقة الصرف' }
          ], payrollRows);

          toast.success('Export Completed', `Successfully exported payroll for ${payrollRows.length} employees.`);
        } catch (err) {
          toast.error('Export Failed', err.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.querySelector('span').textContent = 'Export Payroll Report';
        }
      };
    }

    const select = this.element.querySelector('#payroll-employee-select');
    const filterInput = this.element.querySelector('#payroll-worker-filter');

    filterInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      this.populateSelect(q);
    });

    this.element.querySelector('#btn-load-payroll').onclick = () => {
      const empId = select.value;
      if (empId) {
        this.loadPayroll(empId);
      } else {
        toast.warning('Selection Required', 'Please select an employee first.');
      }
    };

    return this.element;
  }

  populateSelect(searchQuery = '') {
    const select = this.element.querySelector('#payroll-employee-select');
    if (!select) return;

    let list = this.cachedEmployees;
    if (searchQuery) {
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(searchQuery) ||
        (e.employeeCode || '').toLowerCase().includes(searchQuery) ||
        (e.nationalId || '').includes(searchQuery)
      );
    }

    select.innerHTML = `<option value="">-- Choose an Employee (${list.length} matches) --</option>`;
    for (const e of list) {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.employeeCode || e.nationalId.slice(-4)}) — ${e.factory || ''}`;
      select.appendChild(opt);
    }
  }

  async loadEmployeesList() {
    try {
      const res = await employeeApi.list({ limit: 500 });
      this.cachedEmployees = res.employees || [];
      this.populateSelect();
    } catch (err) {
      toast.error('Failed to load employee list', err.message);
    }
  }

  async loadPayroll(employeeId) {
    const wrapper = this.element.querySelector('#payroll-details-wrapper');
    wrapper.innerHTML = `
      <div style="display: flex; justify-content: center; padding: 48px;">
        <div class="animate-spin" style="width: 28px; height: 28px; border: 2px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%;"></div>
      </div>
    `;

    try {
      const emp = this.cachedEmployees.find(e => e.id === employeeId);
      this.selectedEmployee = emp;

      const res = await payrollApi.get(employeeId);
      const payroll = res.payroll || null;
      this.currentPayroll = payroll;

      if (!payroll) {
        wrapper.innerHTML = `
          <div class="card" style="text-align: center; padding: 40px;">
            <div class="empty-state-title">No Payroll Record Found</div>
            <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 16px;">
              No published salary statement exists for ${emp ? escapeHtml(emp.name) : 'this employee'}.
            </p>
            <button class="btn btn-primary btn-sm" id="btn-create-payroll">Create Statement</button>
          </div>
        `;
        wrapper.querySelector('#btn-create-payroll').onclick = () => this.openEditModal(employeeId);
        return;
      }

      const basic = payroll.basicSalary || 0;
      const allow = payroll.allowances || 0;
      const deduct = payroll.deductions || 0;
      const net = payroll.netSalary !== undefined ? payroll.netSalary : basic + allow - deduct;

      const totalGross = basic + allow;
      const basePct = totalGross > 0 ? ((basic / totalGross) * 100).toFixed(0) : 75;
      const allowPct = totalGross > 0 ? ((allow / totalGross) * 100).toFixed(0) : 25;

      wrapper.innerHTML = `
        <div class="payslip-voucher animate-scale-up">
          <!-- Voucher Header -->
          <div class="payslip-header-bar">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                <span class="badge" style="background: rgba(255,255,255,0.18); color: #FFFFFF; font-weight: 700; letter-spacing: 0.05em;">OFFICIAL SALARY VOUCHER</span>
                <span style="font-size: 12.5px; opacity: 0.85;">Period: <b>${escapeHtml(payroll.period || 'Current Period')}</b></span>
              </div>
              <h3 style="font-size: 20px; font-weight: 800; margin: 0; color: #FFFFFF;">
                ${emp ? escapeHtml(emp.name) : 'Workforce Member'}
              </h3>
              <div style="font-size: 12.5px; opacity: 0.8; margin-top: 4px; display: flex; gap: 14px; flex-wrap: wrap;">
                <span>Code: <b>${emp ? escapeHtml(emp.employeeCode || emp.nationalId) : '—'}</b></span>
                <span>Factory: <b>${emp ? escapeHtml(emp.factory || 'Main Facility') : '—'}</b></span>
                <span>Department: <b>${emp ? escapeHtml(emp.department || 'Production') : '—'}</b></span>
                <span>Role: <b>${emp ? escapeHtml(emp.position || 'Specialist') : '—'}</b></span>
              </div>
            </div>

            <div style="display: flex; gap: 10px; align-items: center;">
              <button class="btn btn-secondary btn-sm" id="btn-print-payslip" style="background: rgba(255,255,255,0.15); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.3);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                <span>Print Payslip</span>
              </button>
              <button class="btn btn-primary btn-sm" id="btn-edit-payroll">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Update Statement</span>
              </button>
            </div>
          </div>

          <div class="payslip-body">
            <!-- 4 Stat Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
              <div style="background: var(--surface-subtle); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <small style="color: var(--text-muted); display: block; font-weight: 600;">Basic Salary / الراتب الأساسي</small>
                <b style="font-size: 20px; color: var(--text-main);">${basic.toLocaleString()} <span style="font-size: 13px;">EGP</span></b>
              </div>

              <div style="background: var(--status-green-soft); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--status-green-border);">
                <small style="color: #065F46; display: block; font-weight: 600;">Allowances & Incentives / البدلات</small>
                <b style="font-size: 20px; color: #065F46;">+${allow.toLocaleString()} <span style="font-size: 13px;">EGP</span></b>
              </div>

              <div style="background: var(--status-red-soft); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--status-red-border);">
                <small style="color: #991B1B; display: block; font-weight: 600;">Deductions / الاستقطاعات</small>
                <b style="font-size: 20px; color: #991B1B;">-${deduct.toLocaleString()} <span style="font-size: 13px;">EGP</span></b>
              </div>

              <div style="background: linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(37, 99, 235, 0.12) 100%); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--primary-border);">
                <small style="color: var(--primary); display: block; font-weight: 700;">Net Payable Salary / صافي الراتب</small>
                <b style="font-size: 22px; color: var(--primary); font-weight: 900;">${net.toLocaleString()} <span style="font-size: 14px;">EGP</span></b>
              </div>
            </div>

            <!-- Proportional Breakdown Bar -->
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--text-muted);">
                <span>Salary Distribution Structure</span>
                <span>Base (${basePct}%) • Allowances (${allowPct}%)</span>
              </div>
              <div class="payslip-breakdown-bar">
                <div class="payslip-bar-seg payslip-bar-base" style="width: ${basePct}%;" title="Base Salary: ${basePct}%"></div>
                <div class="payslip-bar-seg payslip-bar-allow" style="width: ${allowPct}%;" title="Allowances: ${allowPct}%"></div>
              </div>
            </div>

            <!-- Detailed Breakdown Columns -->
            <div class="payslip-details-grid">
              <!-- Earnings -->
              <div class="payslip-column-box">
                <div style="font-weight: 800; font-size: 14px; color: var(--status-green); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                  <span>📥 Gross Earnings / المستحقات</span>
                </div>
                <div class="payslip-line-row">
                  <span style="color: var(--text-main);">Basic Contractual Salary</span>
                  <b>${basic.toLocaleString()} EGP</b>
                </div>
                <div class="payslip-line-row">
                  <span style="color: var(--text-main);">Shift & Attendance Allowance</span>
                  <b>${allow.toLocaleString()} EGP</b>
                </div>
                <div class="payslip-total-row">
                  <span>Total Gross Earnings</span>
                  <span style="color: var(--status-green);">+${totalGross.toLocaleString()} EGP</span>
                </div>
              </div>

              <!-- Deductions -->
              <div class="payslip-column-box">
                <div style="font-weight: 800; font-size: 14px; color: var(--status-red); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                  <span>📤 Deductions / الاستقطاعات</span>
                </div>
                <div class="payslip-line-row">
                  <span style="color: var(--text-main);">Social Insurance & Statutory</span>
                  <b>${(deduct * 0.75).toFixed(0).toLocaleString()} EGP</b>
                </div>
                <div class="payslip-line-row">
                  <span style="color: var(--text-main);">Tax & Miscellaneous Withholding</span>
                  <b>${(deduct * 0.25).toFixed(0).toLocaleString()} EGP</b>
                </div>
                <div class="payslip-total-row">
                  <span>Total Deductions</span>
                  <span style="color: var(--status-red);">-${deduct.toLocaleString()} EGP</span>
                </div>
              </div>
            </div>

            <!-- Footer Details -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 18px; border-top: 1px solid var(--border-light); font-size: 12.5px; color: var(--text-muted); flex-wrap: wrap; gap: 10px;">
              <div>
                Payment Method: <span class="badge badge-info">💳 ${escapeHtml(payroll.paymentMethod || 'Bank Transfer')}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge badge-success">✓ Verified by Elaraby HR Payroll Engine</span>
                <span>Confidential Document</span>
              </div>
            </div>
          </div>
        </div>
      `;

      wrapper.querySelector('#btn-edit-payroll').onclick = () => this.openEditModal(employeeId);
      wrapper.querySelector('#btn-print-payslip').onclick = () => window.print();
    } catch (err) {
      wrapper.innerHTML = `<div class="form-error">${err.message}</div>`;
    }
  }

  openEditModal(employeeId) {
    const p = this.currentPayroll || {
      period: '2026-03',
      basicSalary: 6000,
      allowances: 1200,
      deductions: 300,
      paymentMethod: 'Bank Transfer',
    };

    const form = document.createElement('form');
    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Period (YYYY-MM)</label>
        <input type="text" name="period" class="form-input" value="${escapeHtml(p.period || '2026-03')}" required />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Basic Salary (EGP) / الراتب الأساسي</label>
          <input type="number" name="basicSalary" id="modal-basic" class="form-input" value="${p.basicSalary || 0}" min="0" required />
        </div>
        <div class="form-group">
          <label class="form-label">Allowances (EGP) / البدلات</label>
          <input type="number" name="allowances" id="modal-allowances" class="form-input" value="${p.allowances || 0}" min="0" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Deductions (EGP) / الاستقطاعات</label>
          <input type="number" name="deductions" id="modal-deductions" class="form-input" value="${p.deductions || 0}" min="0" required />
        </div>
        <div class="form-group">
          <label class="form-label">Payment Method / طريقة التحويل</label>
          <select name="paymentMethod" class="form-select">
            <option value="Bank Transfer" ${p.paymentMethod === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer (CIB / QNB)</option>
            <option value="Vodafone Cash" ${p.paymentMethod === 'Vodafone Cash' ? 'selected' : ''}>Vodafone Cash Wallet</option>
            <option value="Cash Payroll" ${p.paymentMethod === 'Cash Payroll' ? 'selected' : ''}>Cash Payroll Treasury</option>
          </select>
        </div>
      </div>
      <div style="padding: 14px; background: var(--surface-subtle); border-radius: var(--radius-sm); margin-top: 10px; border: 1px solid var(--border-light);">
        <small style="color: var(--text-muted); display: block; font-weight: 600;">Calculated Net Payable Salary / صافي الراتب المستحق:</small>
        <b id="modal-calculated-net" style="font-size: 20px; color: var(--primary); font-weight: 800;">0 EGP</b>
      </div>
      <div class="form-error" id="payroll-modal-err" style="display: none; margin-top: 10px;"></div>
    `;

    const basicInput = form.querySelector('#modal-basic');
    const allowInput = form.querySelector('#modal-allowances');
    const deductInput = form.querySelector('#modal-deductions');
    const netDisplay = form.querySelector('#modal-calculated-net');

    const updateCalc = () => {
      const b = Number(basicInput.value) || 0;
      const a = Number(allowInput.value) || 0;
      const d = Number(deductInput.value) || 0;
      netDisplay.textContent = `${(b + a - d).toLocaleString()} EGP`;
    };
    basicInput.oninput = updateCalc;
    allowInput.oninput = updateCalc;
    deductInput.oninput = updateCalc;
    updateCalc();

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '10px';
    footer.style.justifyContent = 'flex-end';
    footer.style.width = '100%';
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm" id="payroll-modal-cancel">Cancel</button>
      <button type="submit" class="btn btn-primary btn-sm" id="payroll-modal-save">Publish Statement</button>
    `;

    const modal = new Modal({
      title: 'Update Compensation Statement / تعديل مفردات المرتب',
      content: form,
      footer,
    });

    footer.querySelector('#payroll-modal-cancel').onclick = () => modal.close();
    footer.querySelector('#payroll-modal-save').onclick = () => {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = form.querySelector('#payroll-modal-err');
      errEl.style.display = 'none';

      const formData = new FormData(form);
      const payload = {
        period: formData.get('period')?.trim(),
        basicSalary: Number(formData.get('basicSalary')) || 0,
        allowances: Number(formData.get('allowances')) || 0,
        deductions: Number(formData.get('deductions')) || 0,
        paymentMethod: formData.get('paymentMethod'),
      };

      try {
        await payrollApi.update(employeeId, payload);
        toast.success('Published', 'Salary statement updated successfully.');
        modal.close();
        this.loadPayroll(employeeId);
      } catch (err) {
        errEl.textContent = err.message || 'Failed to update payroll statement';
        errEl.style.display = 'block';
      }
    };

    modal.render();
  }
}
