// Payroll View Component
// Search employee, inspect salary statement, and publish payroll adjustments.

import { payrollApi, employeeApi } from '../api/services.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { ExportService } from '../services/exportService.js';

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
      <div class="toolbar-container">
        <div>
          <h2 style="font-size: 20px; font-weight: 700; color: var(--text-main);">Payroll Administration</h2>
          <p style="font-size: 13px; color: var(--text-muted);">Manage official monthly compensation statements, allowances, and statutory deductions.</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-export-payroll">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export Payroll Report</span>
        </button>
      </div>

      <!-- Employee Selector -->
      <div class="card" style="margin-bottom: 24px;">
        <label class="form-label" style="margin-bottom: 8px;">Select Employee to View / Edit Statement</label>
        <div style="display: flex; gap: 12px; max-width: 500px;">
          <select class="form-select" id="payroll-employee-select">
            <option value="">Loading workforce...</option>
          </select>
          <button class="btn btn-primary" id="btn-load-payroll">
            <span>Inspect</span>
          </button>
        </div>
      </div>

      <!-- Payroll Statement Display Card -->
      <div id="payroll-details-wrapper">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="empty-state-title">No Employee Selected</div>
          <div class="empty-state-sub">Select an employee from the dropdown above to view or modify their compensation statement.</div>
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

    this.element.querySelector('#btn-load-payroll').onclick = () => {
      const select = this.element.querySelector('#payroll-employee-select');
      const empId = select.value;
      if (empId) {
        this.loadPayroll(empId);
      }
    };

    return this.element;
  }

  async loadEmployeesList() {
    try {
      const res = await employeeApi.list({ limit: 500 });
      this.cachedEmployees = res.employees || [];
      const select = this.element.querySelector('#payroll-employee-select');
      select.innerHTML = '<option value="">-- Choose an Employee --</option>';

      for (const e of this.cachedEmployees) {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = `${e.name} (${e.employeeCode || e.nationalId}) — ${e.factory || ''}`;
        select.appendChild(opt);
      }
    } catch (err) {
      toast.error('Failed to load employee list', err.message);
    }
  }

  async loadPayroll(employeeId) {
    const wrapper = this.element.querySelector('#payroll-details-wrapper');
    wrapper.innerHTML = `
      <div style="display: flex; justify-content: center; padding: 40px;">
        <div class="animate-spin" style="width: 24px; height: 24px; border: 2px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%;"></div>
      </div>
    `;

    try {
      const res = await payrollApi.get(employeeId);
      const payroll = res.payroll || null;
      this.currentPayroll = payroll;

      if (!payroll) {
        wrapper.innerHTML = `
          <div class="card" style="text-align: center; padding: 40px;">
            <div class="empty-state-title">No Payroll Record Found</div>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">No published salary statement exists for this employee.</p>
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

      wrapper.innerHTML = `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid var(--border-light); padding-bottom: 16px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 700; color: var(--navy-900);">Compensation Statement — ${payroll.period || 'Current Period'}</h3>
              <small style="color: var(--text-muted);">Payment Method: ${payroll.paymentMethod || 'Bank Transfer'}</small>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-edit-payroll">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <span>Update Statement</span>
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px;">
            <div style="background: var(--surface-subtle); padding: 14px; border-radius: var(--radius-sm);">
              <small style="color: var(--text-muted); display: block;">Basic Salary</small>
              <b style="font-size: 18px; color: var(--navy-900);">${basic.toLocaleString()} EGP</b>
            </div>

            <div style="background: var(--status-green-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--status-green-border);">
              <small style="color: #065F46; display: block;">Total Allowances</small>
              <b style="font-size: 18px; color: #065F46;">+${allow.toLocaleString()} EGP</b>
            </div>

            <div style="background: var(--status-red-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--status-red-border);">
              <small style="color: #991B1B; display: block;">Total Deductions</small>
              <b style="font-size: 18px; color: #991B1B;">-${deduct.toLocaleString()} EGP</b>
            </div>

            <div style="background: var(--primary-soft); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--primary-border);">
              <small style="color: var(--primary); display: block;">Net Payable Salary</small>
              <b style="font-size: 20px; color: var(--primary);">${net.toLocaleString()} EGP</b>
            </div>
          </div>
        </div>
      `;

      wrapper.querySelector('#btn-edit-payroll').onclick = () => this.openEditModal(employeeId);
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
        <input type="text" name="period" class="form-input" value="${p.period || '2026-03'}" required />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Basic Salary (EGP)</label>
          <input type="number" name="basicSalary" id="modal-basic" class="form-input" value="${p.basicSalary || 0}" min="0" required />
        </div>
        <div class="form-group">
          <label class="form-label">Allowances (EGP)</label>
          <input type="number" name="allowances" id="modal-allowances" class="form-input" value="${p.allowances || 0}" min="0" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Deductions (EGP)</label>
          <input type="number" name="deductions" id="modal-deductions" class="form-input" value="${p.deductions || 0}" min="0" required />
        </div>
        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select name="paymentMethod" class="form-select">
            <option value="Bank Transfer">Bank Transfer (CIB)</option>
            <option value="Vodafone Cash">Vodafone Cash</option>
            <option value="Cash Payroll">Cash Payroll Office</option>
          </select>
        </div>
      </div>
      <div style="padding: 12px; background: var(--surface-subtle); border-radius: var(--radius-sm); margin-top: 10px;">
        <small style="color: var(--text-muted); display: block;">Calculated Net Salary:</small>
        <b id="modal-calculated-net" style="font-size: 18px; color: var(--primary);">0 EGP</b>
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
      title: 'Update Compensation Statement',
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
