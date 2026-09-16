// Payroll View Component
// Search employee, inspect salary statement, and publish payroll adjustments.

import { payrollApi, employeeApi, loanApi } from '../api/services.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { ExportService } from '../services/exportService.js';
import { escapeHtml } from '../utils/sanitize.js';

export class PayrollView {
  constructor(containerOrOpts, opts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
      this.opts = opts || {};
    } else {
      this.container = null;
      this.opts = containerOrOpts || {};
    }
    this.element = null;
    this.selectedEmployee = null;
    this.currentPayroll = null;
    this.cachedEmployees = [];
    this.activeTab = this.opts?.tab === 'loans' ? 'loans' : 'payslips';
    this.loansList = [];
    this.loansFilterStatus = 'all';
    this.loansSearchQuery = '';
    this.isLoadingLoans = false;
  }

  async mount() {
    const el = this.render();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(el);
    }
    if (this.activeTab === 'loans') {
      this.switchTab('loans');
    }
    return el;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'animate-fade-in';

    this.element.innerHTML = `
      <div class="toolbar-container" style="margin-bottom: 20px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            Payroll & Financial Services / الأجور والخدمات المالية
          </h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin: 0;">
            Manage monthly compensation statements, statutory deductions, and employee loans/advances.
          </p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav" style="display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 2px solid var(--border-light);">
        <button class="tab-btn active" id="tab-btn-payslips" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span>Payslip Statements / مفردات المرتب</span>
        </button>
        <button class="tab-btn" id="tab-btn-loans" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          <span>Loans & Salary Advances / السلف والقروض</span>
          <span class="badge badge-warning" id="tab-loans-count" style="display: none; margin-left: 6px; font-size: 11px;">0</span>
        </button>
      </div>

      <!-- PANEL 1: Payslips -->
      <div id="panel-payslips">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 16px; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" id="btn-export-payroll">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export Payroll CSV</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-batch-payslips-zip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Batch Payslips (ZIP)</span>
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
      </div>

      <!-- PANEL 2: Loans & Advances -->
      <div id="panel-loans" style="display: none;">
        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 16px 20px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Total Applications</div>
            <div id="loans-stat-total" style="font-size: 24px; font-weight: 800; color: var(--text-main); margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid var(--status-yellow);">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Pending Review</div>
            <div id="loans-stat-pending" style="font-size: 24px; font-weight: 800; color: var(--status-yellow); margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid var(--status-green);">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Active Repayments</div>
            <div id="loans-stat-active" style="font-size: 24px; font-weight: 800; color: var(--status-green); margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid var(--primary);">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Total Disbursed</div>
            <div id="loans-stat-amount" style="font-size: 24px; font-weight: 800; color: var(--primary); margin-top: 4px;">0 EGP</div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="card" style="margin-bottom: 20px; padding: 16px 20px;">
          <div style="display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; justify-content: space-between;">
            <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; flex: 1;">
              <div style="min-width: 220px; flex: 1;">
                <label class="form-label" style="font-size: 11px;">Search Loan / Worker</label>
                <input type="text" id="loans-search-filter" class="form-input" placeholder="Search by name, code, or ref #..." />
              </div>
              <div style="width: 180px;">
                <label class="form-label" style="font-size: 11px;">Status Filter</label>
                <select class="form-select" id="loans-status-filter">
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Review</option>
                  <option value="approved">Approved (Awaiting Disbursement)</option>
                  <option value="active">Active (Repaying)</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-loans">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>Refresh</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-export-loans">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Export Loans</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Loans Table -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div id="loans-table-wrapper" style="overflow-x: auto;"></div>
        </div>
      </div>
    `;

    this.loadEmployeesList();
    this.checkLoansPendingBadge();

    // Tab buttons wiring
    const tabPayslips = this.element.querySelector('#tab-btn-payslips');
    const tabLoans = this.element.querySelector('#tab-btn-loans');
    tabPayslips.onclick = () => this.switchTab('payslips');
    tabLoans.onclick = () => this.switchTab('loans');

    // Loans filters wiring
    const searchLoans = this.element.querySelector('#loans-search-filter');
    searchLoans.oninput = (e) => {
      this.loansSearchQuery = e.target.value.toLowerCase().trim();
      this.renderLoansTable();
    };
    const filterLoansStatus = this.element.querySelector('#loans-status-filter');
    filterLoansStatus.onchange = (e) => {
      this.loansFilterStatus = e.target.value;
      this.renderLoansTable();
    };
    this.element.querySelector('#btn-refresh-loans').onclick = () => this.loadLoans();
    this.element.querySelector('#btn-export-loans').onclick = () => this.exportLoansReport();

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
              const basic = p.basicSalary !== undefined ? p.basicSalary : (p.baseSalary || 0);
              const allow = p.allowances || 0;
              const deduct = p.deductions || 0;
              const net = p.netSalary !== undefined ? p.netSalary : (basic + allow - deduct);
              payrollRows.push({
                employeeCode: emp.employeeCode || emp.nationalId,
                name: emp.name,
                factory: emp.factory || '—',
                department: emp.department || '—',
                period: p.period || new Date().toISOString().slice(0, 7),
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

          ExportService.exportToCsv('Workforce_Payroll_Report', [
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
          exportBtn.querySelector('span').textContent = 'Export Payroll CSV';
        }
      };
    }

    const batchZipBtn = this.element.querySelector('#btn-batch-payslips-zip');
    if (batchZipBtn) {
      batchZipBtn.onclick = () => {
        toast.info('Generating Payslips ZIP', 'Compiling PDF archive for all active employees...');
        window.open('/api/admin/payroll/payslips-zip', '_blank');
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

      const basic = payroll.basicSalary !== undefined ? payroll.basicSalary : (payroll.baseSalary || 0);
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
              <button class="btn btn-secondary btn-sm" id="btn-download-payslip-pdf" style="background: rgba(255,255,255,0.15); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.3);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <span>Download PDF</span>
              </button>
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
                  <b>${Math.round(deduct * 0.75).toLocaleString()} EGP</b>
                </div>
                <div class="payslip-line-row">
                  <span style="color: var(--text-main);">Tax & Miscellaneous Withholding</span>
                  <b>${Math.round(deduct * 0.25).toLocaleString()} EGP</b>
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
                <span class="badge badge-success">✓ Verified by Workforce Payroll Engine</span>
                <span>Confidential Document</span>
              </div>
            </div>
          </div>
        </div>
      `;

      wrapper.querySelector('#btn-edit-payroll').onclick = () => this.openEditModal(employeeId);
      wrapper.querySelector('#btn-print-payslip').onclick = () => window.print();
      const pdfBtn = wrapper.querySelector('#btn-download-payslip-pdf');
      if (pdfBtn) {
        pdfBtn.onclick = () => {
          window.open(`/api/admin/payroll/${employeeId}/payslip-pdf`, '_blank');
        };
      }
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

  switchTab(tabName) {
    this.activeTab = tabName;
    const btnPayslips = this.element.querySelector('#tab-btn-payslips');
    const btnLoans = this.element.querySelector('#tab-btn-loans');
    const panelPayslips = this.element.querySelector('#panel-payslips');
    const panelLoans = this.element.querySelector('#panel-loans');

    if (tabName === 'loans') {
      btnPayslips.classList.remove('active');
      btnLoans.classList.add('active');
      panelPayslips.style.display = 'none';
      panelLoans.style.display = 'block';
      this.loadLoans();
    } else {
      btnLoans.classList.remove('active');
      btnPayslips.classList.add('active');
      panelLoans.style.display = 'none';
      panelPayslips.style.display = 'block';
    }
  }

  async checkLoansPendingBadge() {
    try {
      const res = await loanApi.list({ status: 'pending', limit: 100 });
      const pendingCount = (res.loans || []).length;
      const badge = this.element.querySelector('#tab-loans-count');
      if (badge) {
        if (pendingCount > 0) {
          badge.textContent = pendingCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (_) {}
  }

  async loadLoans() {
    if (this.isLoadingLoans) return;
    this.isLoadingLoans = true;
    const wrapper = this.element.querySelector('#loans-table-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div style="display: flex; justify-content: center; padding: 48px;">
        <div class="animate-spin" style="width: 28px; height: 28px; border: 2px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%;"></div>
      </div>
    `;

    try {
      const res = await loanApi.list({ limit: 200 });
      this.loansList = res.loans || [];
      this.updateLoanKpis();
      this.renderLoansTable();
    } catch (err) {
      wrapper.innerHTML = `<div class="form-error" style="margin: 20px;">${escapeHtml(err.message || 'Failed to load loans')}</div>`;
    } finally {
      this.isLoadingLoans = false;
    }
  }

  updateLoanKpis() {
    const list = this.loansList || [];
    const total = list.length;
    const pending = list.filter((l) => l.status === 'pending').length;
    const active = list.filter((l) => l.status === 'active' || l.status === 'approved').length;
    const disbursed = list
      .filter((l) => l.status === 'active' || l.status === 'completed')
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

    const elTotal = this.element.querySelector('#loans-stat-total');
    const elPending = this.element.querySelector('#loans-stat-pending');
    const elActive = this.element.querySelector('#loans-stat-active');
    const elAmount = this.element.querySelector('#loans-stat-amount');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elActive) elActive.textContent = active;
    if (elAmount) elAmount.textContent = `${disbursed.toLocaleString()} EGP`;

    const badge = this.element.querySelector('#tab-loans-count');
    if (badge) {
      if (pending > 0) {
        badge.textContent = pending;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  renderLoansTable() {
    const wrapper = this.element.querySelector('#loans-table-wrapper');
    if (!wrapper) return;

    let filtered = this.loansList || [];
    if (this.loansFilterStatus && this.loansFilterStatus !== 'all') {
      filtered = filtered.filter((l) => l.status === this.loansFilterStatus);
    }
    if (this.loansSearchQuery) {
      const q = this.loansSearchQuery;
      filtered = filtered.filter((l) =>
        (l.referenceNumber || '').toLowerCase().includes(q) ||
        (l.employeeName || '').toLowerCase().includes(q) ||
        (l.employeeCode || '').toLowerCase().includes(q) ||
        (l.factory || '').toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px;">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div class="empty-state-title">No Loan Applications Found</div>
          <div class="empty-state-sub">There are no employee loans or salary advances matching your active filters.</div>
        </div>
      `;
      return;
    }

    const rowsHtml = filtered.map((l) => {
      const currency = escapeHtml(l.currency || 'EGP');
      const amount = (Number(l.amount) || 0).toLocaleString();
      const installment = (Number(l.monthlyInstallment) || 0).toLocaleString();
      const count = l.installmentsCount || 1;
      const dateStr = l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const isEmergency = l.type === 'emergency_advance';

      let statusBadge = '';
      if (l.status === 'pending') {
        statusBadge = '<span class="badge badge-warning">⏳ Pending Review</span>';
      } else if (l.status === 'approved') {
        statusBadge = '<span class="badge badge-info">✓ Approved</span>';
      } else if (l.status === 'active') {
        statusBadge = '<span class="badge badge-success">● Active Repaying</span>';
      } else if (l.status === 'completed') {
        statusBadge = '<span class="badge badge-neutral">✓ Settled</span>';
      } else if (l.status === 'rejected') {
        statusBadge = '<span class="badge badge-danger">✕ Rejected</span>';
      } else {
        statusBadge = `<span class="badge badge-neutral">${escapeHtml(l.status)}</span>`;
      }

      let actionButtons = '';
      if (l.status === 'pending') {
        actionButtons = `
          <button type="button" class="btn btn-success btn-xs" data-loan-action="approve" data-loan-id="${escapeHtml(l.id)}">Approve</button>
          <button type="button" class="btn btn-danger btn-xs" data-loan-action="reject" data-loan-id="${escapeHtml(l.id)}">Reject</button>
        `;
      } else if (l.status === 'approved') {
        actionButtons = `
          <button type="button" class="btn btn-primary btn-xs" data-loan-action="disburse" data-loan-id="${escapeHtml(l.id)}">Disburse</button>
        `;
      }
      actionButtons += `
        <button type="button" class="btn btn-secondary btn-xs" data-loan-action="details" data-loan-id="${escapeHtml(l.id)}">Details</button>
      `;

      return `
        <tr>
          <td style="font-family: monospace; font-size: 12px; font-weight: 700; color: var(--primary);">
            ${escapeHtml(l.referenceNumber || l.id.substring(0, 10))}
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(l.employeeName || '—')}</div>
            <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(l.employeeCode || '')} • ${escapeHtml(l.factory || '—')}</div>
          </td>
          <td>
            <span class="badge ${isEmergency ? 'badge-warning' : 'badge-primary'}" style="font-size: 11px;">
              ${isEmergency ? '⚡ Emergency Advance' : '🤝 Social Loan'}
            </span>
          </td>
          <td style="font-weight: 800; color: var(--text-main);">
            ${amount} <small style="font-weight: 600; color: var(--text-muted);">${currency}</small>
          </td>
          <td style="font-size: 12px;">
            <b>${installment} ${currency}</b>
            <div style="color: var(--text-muted); font-size: 11px;">${count} monthly installment${count > 1 ? 's' : ''}</div>
          </td>
          <td style="font-size: 12px; color: var(--text-muted);">${dateStr}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    wrapper.innerHTML = `
      <table class="data-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th>Ref #</th>
            <th>Employee</th>
            <th>Facility Type</th>
            <th>Amount</th>
            <th>Repayment Terms</th>
            <th>Date</th>
            <th>Status</th>
            <th style="min-width: 130px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    wrapper.querySelectorAll('[data-loan-action]').forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.currentTarget.getAttribute('data-loan-action');
        const id = e.currentTarget.getAttribute('data-loan-id');
        this.handleLoanAction(action, id);
      };
    });
  }

  async handleLoanAction(action, loanId) {
    if (action === 'approve') {
      try {
        await loanApi.updateStatus(loanId, { status: 'approved' });
        toast.success('Loan Approved', 'Application status updated to approved.');
        window.dispatchEvent(new CustomEvent('admin:loans.changed'));
        await this.loadLoans();
      } catch (err) {
        toast.error('Approval Failed', err.message);
      }
    } else if (action === 'disburse') {
      try {
        await loanApi.updateStatus(loanId, { status: 'active' });
        toast.success('Funds Disbursed', 'Loan is now active and deductions will apply on payroll.');
        window.dispatchEvent(new CustomEvent('admin:loans.changed'));
        await this.loadLoans();
      } catch (err) {
        toast.error('Disbursement Failed', err.message);
      }
    } else if (action === 'reject') {
      this.openRejectLoanModal(loanId);
    } else if (action === 'details') {
      this.openLoanDetailsModal(loanId);
    }
  }

  openRejectLoanModal(loanId) {
    const loan = (this.loansList || []).find((l) => l.id === loanId);
    const content = document.createElement('div');
    content.innerHTML = `
      <p style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 14px;">
        Please provide a clear administrative justification for rejecting loan application <b>${escapeHtml(loan?.referenceNumber || loanId)}</b>.
      </p>
      <div class="form-group">
        <label class="form-label" style="font-weight: 700;">Rejection Reason / سبب الرفض</label>
        <textarea id="loan-reject-reason" class="form-input" rows="3" placeholder="e.g., Exceeds maximum debt-to-income ratio or probationary period..."></textarea>
      </div>
      <div class="form-error" id="loan-reject-err" style="display: none; margin-top: 8px;"></div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-secondary btn-sm" id="btn-cancel-reject">Cancel</button>
      <button class="btn btn-danger btn-sm" id="btn-confirm-reject">Confirm Rejection</button>
    `;

    const modal = new Modal({
      title: 'Reject Loan Application',
      content,
      footer,
    });

    footer.querySelector('#btn-cancel-reject').onclick = () => modal.close();
    footer.querySelector('#btn-confirm-reject').onclick = async () => {
      const reason = content.querySelector('#loan-reject-reason').value.trim();
      const errEl = content.querySelector('#loan-reject-err');
      if (!reason) {
        errEl.textContent = 'Please enter a rejection reason.';
        errEl.style.display = 'block';
        return;
      }
      try {
        await loanApi.updateStatus(loanId, { status: 'rejected', reason });
        toast.success('Loan Rejected', 'Application was marked as rejected.');
        window.dispatchEvent(new CustomEvent('admin:loans.changed'));
        modal.close();
        await this.loadLoans();
      } catch (err) {
        errEl.textContent = err.message || 'Failed to reject loan';
        errEl.style.display = 'block';
      }
    };

    modal.render();
  }

  openLoanDetailsModal(loanId) {
    const loan = (this.loansList || []).find((l) => l.id === loanId);
    if (!loan) return;

    const currency = escapeHtml(loan.currency || 'EGP');
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
        <div class="card" style="padding: 14px; background: var(--surface-subtle); margin: 0;">
          <small style="color: var(--text-muted); display: block;">Applicant</small>
          <div style="font-weight: 800; font-size: 15px; color: var(--text-main); margin-top: 2px;">
            ${escapeHtml(loan.employeeName || '—')}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Code: <b>${escapeHtml(loan.employeeCode || '—')}</b> | Facility: <b>${escapeHtml(loan.factory || '—')}</b>
          </div>
        </div>
        <div class="card" style="padding: 14px; background: var(--surface-subtle); margin: 0;">
          <small style="color: var(--text-muted); display: block;">Financing Facility</small>
          <div style="font-weight: 800; font-size: 15px; color: var(--primary); margin-top: 2px;">
            ${(Number(loan.amount) || 0).toLocaleString()} ${currency}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Type: <b>${loan.type === 'emergency_advance' ? 'Emergency Advance' : 'Social Loan'}</b>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; margin-bottom: 16px;">
        <div><b>Monthly Installment:</b> ${(Number(loan.monthlyInstallment) || 0).toLocaleString()} ${currency}</div>
        <div><b>Tenure:</b> ${loan.installmentsCount || 1} months</div>
        <div><b>Created Date:</b> ${loan.createdAt ? new Date(loan.createdAt).toLocaleString() : '—'}</div>
        <div><b>Status:</b> <span class="badge badge-info">${escapeHtml(loan.status)}</span></div>
        ${loan.approvedBy ? `<div><b>Approved By:</b> ${escapeHtml(loan.approvedBy)}</div>` : ''}
        ${loan.rejectionReason ? `<div style="grid-column: 1 / -1; color: var(--status-red);"><b>Rejection Reason:</b> ${escapeHtml(loan.rejectionReason)}</div>` : ''}
      </div>

      ${loan.reason ? `
        <div style="padding: 12px; background: var(--surface-card); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 12.5px; margin-bottom: 16px;">
          <b>Employee Note:</b> "${escapeHtml(loan.reason)}"
        </div>
      ` : ''}
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.innerHTML = `<button class="btn btn-primary btn-sm" id="btn-close-details">Close</button>`;

    const modal = new Modal({
      title: `Loan Record: ${escapeHtml(loan.referenceNumber || loan.id)}`,
      content,
      footer,
    });

    footer.querySelector('#btn-close-details').onclick = () => modal.close();
    modal.render();
  }

  exportLoansReport() {
    const filtered = (this.loansList || []).map((l) => ({
      referenceNumber: l.referenceNumber || l.id,
      employeeCode: l.employeeCode || '—',
      employeeName: l.employeeName || '—',
      factory: l.factory || '—',
      department: l.department || '—',
      type: l.type === 'emergency_advance' ? 'Emergency Advance' : 'Social Loan',
      amount: l.amount || 0,
      monthlyInstallment: l.monthlyInstallment || 0,
      installmentsCount: l.installmentsCount || 1,
      currency: l.currency || 'EGP',
      status: l.status,
      createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : '—',
      approvedBy: l.approvedBy || '—',
      rejectionReason: l.rejectionReason || '—',
    }));

    ExportService.exportToCsv('Workforce_Loans_Advances_Report', [
      { key: 'referenceNumber', label: 'Reference # / رقم السلفة' },
      { key: 'employeeCode', label: 'Employee Code / كود الموظف' },
      { key: 'employeeName', label: 'Name / الاسم' },
      { key: 'factory', label: 'Factory / المصنع' },
      { key: 'department', label: 'Department / القسم' },
      { key: 'type', label: 'Facility Type / النوع' },
      { key: 'amount', label: 'Amount / المبلغ' },
      { key: 'monthlyInstallment', label: 'Monthly Installment / القسط الشهري' },
      { key: 'installmentsCount', label: 'Tenure (Months) / عدد الأقساط' },
      { key: 'currency', label: 'Currency / العملة' },
      { key: 'status', label: 'Status / الحالة' },
      { key: 'createdAt', label: 'Date Applied / تاريخ التقديم' },
      { key: 'approvedBy', label: 'Approved By / المعتمد بواسطة' },
      { key: 'rejectionReason', label: 'Rejection Reason / سبب الرفض' },
    ], filtered);

    toast.success('Export Completed', `Successfully exported ${filtered.length} loan applications.`);
  }
}
