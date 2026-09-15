// Employees View Component
// Comprehensive Workforce management with pagination, filtering, safe balance updates, and modals.

import { employeeApi } from '../api/services.js';
import { store } from '../state/store.js';
import { DataTable } from '../components/DataTable.js';
import { renderPagination } from '../components/Pagination.js';
import { Modal } from '../components/Modal.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { createStatusBadge } from '../components/StatusBadge.js';
import { toast } from '../components/Toast.js';
import { ExportService } from '../services/exportService.js';
import { escapeHtml } from '../utils/sanitize.js';

export class EmployeesView {
  constructor(containerOrOpts, opts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
      this.onNavigate = opts?.onNavigate;
    } else {
      this.container = null;
      this.onNavigate = containerOrOpts?.onNavigate;
    }
    this.element = null;
    this.page = 1;
    this.limit = 15;
    this.query = '';
    this.factory = '';
    this.table = null;
    this.paginationEl = null;
    this.refreshHandler = null;
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
    this.viewMode = 'table';
    this.statusFilter = '';

    this.element.innerHTML = `
      <div class="toolbar-container">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em;">Workforce Directory</h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin-top: 3px;">
            Manage employee profiles, credentials, factory placements, and vacation allocations.
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <!-- Table vs Cards View Toggle Switcher -->
          <div class="view-toggle-group">
            <button class="view-toggle-btn active" id="btn-view-table" title="Table View">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              <span>Table</span>
            </button>
            <button class="view-toggle-btn" id="btn-view-cards" title="Grid Cards View">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Cards</span>
            </button>
          </div>

          <button class="btn btn-secondary" id="btn-export-employees">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export to Excel</span>
          </button>
          <button class="btn btn-primary" id="btn-add-employee">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="toolbar-container" style="margin-bottom: 16px;">
        <div class="toolbar-left">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="emp-search-input" placeholder="Search by name, code, national ID, phone..." />
            <span class="kbd-badge">Live</span>
          </div>

          <select class="form-select" id="emp-factory-filter" style="width: 220px;">
            <option value="">🏭 All Facilities / كل المصانع</option>
          </select>

          <select class="form-select" id="emp-status-filter" style="width: 150px;">
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <!-- Views Container -->
      <div id="emp-table-wrapper"></div>
      <div id="emp-cards-wrapper" class="cards-grid" style="display: none;"></div>
      <div id="emp-pagination-wrapper"></div>
    `;

    // Initialize DataTable
    this.table = new DataTable({
      columns: [
        {
          header: 'Employee',
          render: (e) => `
            <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;" class="emp-row-clickable">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--grad-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;">
                ${escapeHtml(e.name?.charAt(0) || 'E')}
              </div>
              <div>
                <b style="color: var(--text-main); display: block;">${escapeHtml(e.name)}</b>
                <small style="color: var(--text-muted); font-size: 11.5px; font-family: monospace;">${escapeHtml(e.employeeCode || '—')}</small>
              </div>
            </div>
          `,
        },
        {
          header: 'National ID',
          render: (e) => `
            <div style="font-family: monospace; font-size: 13px; font-weight: 600;">
              ${escapeHtml(e.nationalId || '—')}
              ${e.phone ? `<small style="display: block; color: var(--text-muted); font-size: 11px;">📱 ${escapeHtml(e.phone)}</small>` : ''}
            </div>
          `,
        },
        {
          header: 'Factory & Department',
          render: (e) => `
            <div>
              <span class="badge badge-primary" style="font-size: 11px; padding: 2px 8px;">🏭 ${escapeHtml(e.factory || 'HQ')}</span>
              <small style="display: block; color: var(--text-muted); font-size: 11.5px; margin-top: 3px;">${escapeHtml(e.department || '—')}</small>
            </div>
          `,
        },
        {
          header: 'Position',
          field: 'position',
        },
        {
          header: 'Vacation Balance',
          render: (e) => `
            <span style="font-weight: 800; color: ${(e.vacationBalance ?? 0) <= 3 ? 'var(--status-red)' : 'var(--text-main)'};">
              ${e.vacationBalance ?? 0}
            </span> 
            <small style="color: var(--text-muted);">days</small>
          `,
        },
        {
          header: 'Status',
          render: (e) => createStatusBadge(e.active ? 'active' : 'inactive'),
        },
        {
          header: 'Actions',
          render: (e) => {
            const wrap = document.createElement('div');
            wrap.className = 'table-actions';

            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn btn-secondary btn-sm';
            viewBtn.textContent = 'View';
            viewBtn.title = 'View Full Profile';
            viewBtn.onclick = () => this.openProfileModal(e);

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-secondary btn-sm';
            editBtn.textContent = 'Edit';
            editBtn.onclick = () => this.openEditModal(e);

            const toggleBtn = document.createElement('button');
            toggleBtn.className = `btn ${e.active ? 'btn-danger' : 'btn-success'} btn-sm`;
            toggleBtn.textContent = e.active ? 'Deactivate' : 'Activate';
            toggleBtn.onclick = () => this.confirmToggle(e);

            wrap.appendChild(viewBtn);
            wrap.appendChild(editBtn);
            wrap.appendChild(toggleBtn);
            return wrap;
          },
        },
      ],
      emptyMessage: 'No employees matching the current filters.',
    });

    this.element.querySelector('#emp-table-wrapper').appendChild(this.table.render());

    // View Switcher Handlers
    const btnTable = this.element.querySelector('#btn-view-table');
    const btnCards = this.element.querySelector('#btn-view-cards');
    const tableWrapper = this.element.querySelector('#emp-table-wrapper');
    const cardsWrapper = this.element.querySelector('#emp-cards-wrapper');

    btnTable.onclick = () => {
      this.viewMode = 'table';
      btnTable.classList.add('active');
      btnCards.classList.remove('active');
      tableWrapper.style.display = 'block';
      cardsWrapper.style.display = 'none';
    };

    btnCards.onclick = () => {
      this.viewMode = 'cards';
      btnCards.classList.add('active');
      btnTable.classList.remove('active');
      tableWrapper.style.display = 'none';
      cardsWrapper.style.display = 'grid';
    };

    // Event Bindings
    this.element.querySelector('#btn-add-employee').onclick = () => this.openAddModal();

    const exportBtn = this.element.querySelector('#btn-export-employees');
    if (exportBtn) {
      exportBtn.onclick = async () => {
        try {
          exportBtn.disabled = true;
          exportBtn.querySelector('span').textContent = 'Exporting...';
          const res = await employeeApi.list({ limit: 1000, q: this.query, factory: this.factory });
          const employees = res.employees || [];
          ExportService.exportToCsv('Employees_Directory', [
            { key: 'employeeCode', label: 'Employee Code / كود الموظف' },
            { key: 'name', label: 'Full Name / الاسم' },
            { key: 'nationalId', label: 'National ID / الرقم القومي' },
            { key: 'phone', label: 'Phone / الهاتف' },
            { key: 'factory', label: 'Factory / المصنع' },
            { key: 'department', label: 'Department / القسم' },
            { key: 'position', label: 'Position / الوظيفة' },
            { key: 'vacationBalance', label: 'Vacation Balance / رصيد الإجازات' },
            { key: 'active', label: 'Status / الحالة', formatter: (val) => val ? 'Active / نشط' : 'Inactive / معطل' }
          ], employees);
          toast.success('Export Completed', `Successfully exported ${employees.length} records.`);
        } catch (err) {
          toast.error('Export Failed', err.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.querySelector('span').textContent = 'Export to Excel';
        }
      };
    }

    let debounceTimer;
    this.element.querySelector('#emp-search-input').oninput = (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.query = e.target.value.trim();
        this.page = 1;
        this.loadEmployees();
      }, 300);
    };

    this.element.querySelector('#emp-factory-filter').onchange = (e) => {
      this.factory = e.target.value;
      this.page = 1;
      this.loadEmployees();
    };

    this.element.querySelector('#emp-status-filter').onchange = (e) => {
      this.statusFilter = e.target.value;
      this.page = 1;
      this.loadEmployees();
    };

    this.refreshHandler = () => this.loadEmployees();
    window.addEventListener('realtime:employee.created', this.refreshHandler);
    window.addEventListener('realtime:employee.updated', this.refreshHandler);

    this.loadEmployees();
    return this.element;
  }

  renderCardsView(employees) {
    const cardsWrapper = this.element.querySelector('#emp-cards-wrapper');
    if (!cardsWrapper) return;
    cardsWrapper.innerHTML = '';

    if (employees.length === 0) {
      cardsWrapper.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-title">No employees found</div>
          <div class="empty-state-sub">Try changing your search query or factory filter.</div>
        </div>
      `;
      return;
    }

    for (const e of employees) {
      const card = document.createElement('div');
      card.className = 'emp-card';

      card.innerHTML = `
        <div>
          <div class="emp-card-header">
            <div class="emp-avatar">${escapeHtml(e.name?.charAt(0) || 'E')}</div>
            <div class="emp-info">
              <b>${escapeHtml(e.name)}</b>
              <small>${escapeHtml(e.position || 'Staff')} • ${escapeHtml(e.employeeCode || '—')}</small>
            </div>
          </div>

          <div style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
            <span class="badge badge-primary" style="font-size: 11px;">🏭 ${escapeHtml(e.factory || 'HQ')}</span>
            <span class="badge badge-neutral" style="font-size: 11px;">${escapeHtml(e.department || 'Operations')}</span>
            ${createStatusBadge(e.active ? 'active' : 'inactive')}
          </div>
        </div>

        <div class="emp-card-metrics">
          <div>
            <small style="color: var(--text-muted); font-size: 11px; display: block;">National ID</small>
            <b style="font-family: monospace; font-size: 12.5px; color: var(--text-main);">${escapeHtml(e.nationalId || '—')}</b>
          </div>
          <div>
            <small style="color: var(--text-muted); font-size: 11px; display: block;">Vacation Balance</small>
            <b style="font-size: 13.5px; color: ${(e.vacationBalance ?? 0) <= 3 ? 'var(--status-red)' : 'var(--primary)'};">
              ${e.vacationBalance ?? 0} days
            </b>
          </div>
        </div>

        <div class="emp-card-actions">
          <button class="btn btn-secondary btn-sm" id="card-btn-view-${e.id}">Profile</button>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" id="card-btn-edit-${e.id}">Edit</button>
            <button class="btn ${e.active ? 'btn-danger' : 'btn-success'} btn-sm" id="card-btn-toggle-${e.id}">
              ${e.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
      `;

      card.querySelector(`#card-btn-view-${e.id}`).onclick = () => this.openProfileModal(e);
      card.querySelector(`#card-btn-edit-${e.id}`).onclick = () => this.openEditModal(e);
      card.querySelector(`#card-btn-toggle-${e.id}`).onclick = () => this.confirmToggle(e);

      cardsWrapper.appendChild(card);
    }
  }

  async loadEmployees() {
    this.table.update([], true);
    try {
      const res = await employeeApi.list({
        page: this.page,
        limit: this.limit,
        q: this.query,
        factory: this.factory,
      });

      let list = res.employees || [];
      if (this.statusFilter === 'active') {
        list = list.filter((e) => e.active);
      } else if (this.statusFilter === 'inactive') {
        list = list.filter((e) => !e.active);
      }

      this.table.update(list, false);
      this.renderCardsView(list);
      this.populateFactoryFilter(res.employees || []);

      const pagWrapper = this.element.querySelector('#emp-pagination-wrapper');
      pagWrapper.innerHTML = '';
      if (res.totalPages > 1) {
        const pag = renderPagination({
          page: res.page,
          totalPages: res.totalPages,
          total: res.total,
          onPageChange: (newPage) => {
            this.page = newPage;
            this.loadEmployees();
          },
        });
        if (pag) pagWrapper.appendChild(pag);
      }
    } catch (err) {
      toast.error('Failed to load employees', err.message);
    }
  }

  populateFactoryFilter(employees = []) {
    const filterSelect = this.element?.querySelector('#emp-factory-filter');
    if (!filterSelect || this.hasPopulatedFactories) return;

    const currentVal = this.factory;
    const factories = new Set();
    for (const e of employees) {
      if (e.factory && e.factory.trim()) {
        factories.add(e.factory.trim());
      }
    }

    if (factories.size > 0) {
      this.hasPopulatedFactories = true;
      filterSelect.innerHTML = `<option value="">🏭 All Facilities / كل المصانع</option>`;
      Array.from(factories).sort().forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = `🏭 ${f}`;
        filterSelect.appendChild(opt);
      });
      filterSelect.value = currentVal;
    }
  }

  openProfileModal(e) {
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light);">
        <div style="width: 56px; height: 56px; border-radius: 16px; background: var(--grad-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);">
          ${escapeHtml(e.name?.charAt(0) || 'E')}
        </div>
        <div>
          <h3 style="font-size: 18px; font-weight: 800; color: var(--text-main); margin-bottom: 2px;">${escapeHtml(e.name)}</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin: 0;">${escapeHtml(e.position || 'Staff')} • Code: <b>${escapeHtml(e.employeeCode || '—')}</b></p>
        </div>
        <div style="margin-left: auto;">
          ${createStatusBadge(e.active ? 'active' : 'inactive')}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
        <div style="background: var(--surface-subtle); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
          <small style="color: var(--text-muted); display: block; font-size: 11px;">National ID / الرقم القومي</small>
          <b style="font-size: 13.5px; font-family: monospace; color: var(--text-main);">${escapeHtml(e.nationalId || '—')}</b>
        </div>
        <div style="background: var(--surface-subtle); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
          <small style="color: var(--text-muted); display: block; font-size: 11px;">Mobile Phone / الهاتف</small>
          <b style="font-size: 13.5px; font-family: monospace; color: var(--text-main);">🇪🇬 ${escapeHtml(e.phone || '—')}</b>
        </div>
        <div style="background: var(--surface-subtle); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
          <small style="color: var(--text-muted); display: block; font-size: 11px;">Factory Complex / المجمع الصناعي</small>
          <b style="font-size: 13.5px; color: var(--text-main);">🏭 ${escapeHtml(e.factory || 'HQ')}</b>
        </div>
        <div style="background: var(--surface-subtle); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
          <small style="color: var(--text-muted); display: block; font-size: 11px;">Department / الإدارة</small>
          <b style="font-size: 13.5px; color: var(--text-main);">${escapeHtml(e.department || 'Operations')}</b>
        </div>
      </div>

      <div style="background: var(--primary-soft); border: 1px solid var(--primary-border); padding: 14px 18px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span style="font-size: 12px; color: var(--primary); font-weight: 700; text-transform: uppercase;">Annual Vacation Allowance</span>
          <div style="font-size: 22px; font-weight: 800; color: var(--text-main);">${e.vacationBalance ?? 0} <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">Days Available</span></div>
        </div>
        <button class="btn btn-primary btn-sm" id="profile-modal-edit-bal">Adjust Balance</button>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.width = '100%';
    footer.innerHTML = `<button class="btn btn-secondary btn-sm" id="profile-close-btn">Close</button>`;

    const modal = new Modal({
      title: `Employee Dossier — ${e.name}`,
      content,
      footer,
      wide: true,
    });

    footer.querySelector('#profile-close-btn').onclick = () => modal.close();
    content.querySelector('#profile-modal-edit-bal').onclick = () => {
      modal.close();
      this.openEditModal(e);
    };
  }

  openAddModal() {
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Full Name <span class="req">*</span></label>
        <input type="text" name="name" class="form-input" placeholder="e.g. Ahmed Mahmoud" required />
      </div>
      <div class="form-group">
        <label class="form-label">14-Digit National ID <span class="req">*</span></label>
        <input type="text" name="nationalId" class="form-input" placeholder="29001011234567" maxlength="14" required />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Factory</label>
          <select name="factory" class="form-select">
            <option value="10th of Ramadan">10th of Ramadan</option>
            <option value="Qwesna">Qwesna</option>
            <option value="Benha">Benha</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Department</label>
          <input type="text" name="department" class="form-input" value="Production A" />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Position</label>
          <input type="text" name="position" class="form-input" value="Operator" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input type="text" name="phone" class="form-input" placeholder="01012345678" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Annual Vacation Balance (Days)</label>
        <input type="number" name="vacationBalance" class="form-input" value="14" min="0" max="60" step="0.5" />
        <span class="form-hint">Maximum allowable balance is 60 days.</span>
      </div>
      <div class="form-error" id="modal-form-err" style="display: none;"></div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '10px';
    footer.style.justifyContent = 'flex-end';
    footer.style.width = '100%';
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm" id="modal-cancel">Cancel</button>
      <button type="submit" class="btn btn-primary btn-sm" id="modal-submit">Create Employee</button>
    `;

    const modal = new Modal({
      title: 'Register New Employee',
      content: form,
      footer,
    });

    footer.querySelector('#modal-cancel').onclick = () => modal.close();
    footer.querySelector('#modal-submit').onclick = () => {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = form.querySelector('#modal-form-err');
      errEl.style.display = 'none';

      const formData = new FormData(form);
      const payload = {
        name: formData.get('name')?.trim(),
        nationalId: formData.get('nationalId')?.trim(),
        factory: formData.get('factory'),
        department: formData.get('department')?.trim(),
        position: formData.get('position')?.trim(),
        phone: formData.get('phone')?.trim(),
        vacationBalance: Number(formData.get('vacationBalance')) || 14,
      };

      try {
        await employeeApi.create(payload);
        toast.success('Success', `Employee ${payload.name} created successfully.`);
        modal.close();
        this.loadEmployees();
      } catch (err) {
        errEl.textContent = err.message || 'Failed to create employee';
        errEl.style.display = 'block';
      }
    };

    modal.render();
  }

  openEditModal(emp) {
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input type="text" name="name" class="form-input" value="${emp.name}" required />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Factory</label>
          <select name="factory" class="form-select">
            <option value="10th of Ramadan" ${emp.factory === '10th of Ramadan' ? 'selected' : ''}>10th of Ramadan</option>
            <option value="Qwesna" ${emp.factory === 'Qwesna' ? 'selected' : ''}>Qwesna</option>
            <option value="Benha" ${emp.factory === 'Benha' ? 'selected' : ''}>Benha</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Department</label>
          <input type="text" name="department" class="form-input" value="${emp.department || ''}" />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Position</label>
          <input type="text" name="position" class="form-input" value="${emp.position || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input type="text" name="phone" class="form-input" value="${emp.phone || ''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Vacation Balance (Days)</label>
        <input type="number" name="vacationBalance" class="form-input" value="${emp.vacationBalance ?? 0}" min="0" max="60" step="0.5" />
      </div>
      <div style="margin-top: 10px; padding: 10px; background: var(--surface-subtle); border-radius: var(--radius-sm);">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
          <input type="checkbox" name="resetPin" value="true" />
          <span>Reset Mobile App PIN (Forces employee to set a new PIN on next login)</span>
        </label>
      </div>
      <div class="form-error" id="edit-form-err" style="display: none; margin-top: 10px;"></div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '10px';
    footer.style.justifyContent = 'flex-end';
    footer.style.width = '100%';
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm" id="edit-cancel">Cancel</button>
      <button type="submit" class="btn btn-primary btn-sm" id="edit-submit">Save Changes</button>
    `;

    const modal = new Modal({
      title: `Edit Employee — ${emp.name}`,
      content: form,
      footer,
    });

    footer.querySelector('#edit-cancel').onclick = () => modal.close();
    footer.querySelector('#edit-submit').onclick = () => {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = form.querySelector('#edit-form-err');
      errEl.style.display = 'none';

      const formData = new FormData(form);
      const updates = {
        name: formData.get('name')?.trim(),
        factory: formData.get('factory'),
        department: formData.get('department')?.trim(),
        position: formData.get('position')?.trim(),
        phone: formData.get('phone')?.trim(),
        vacationBalance: Number(formData.get('vacationBalance')),
        resetPin: formData.get('resetPin') === 'true',
      };

      try {
        await employeeApi.update(emp.id, updates);
        toast.success('Updated', `Employee profile updated.`);
        modal.close();
        this.loadEmployees();
      } catch (err) {
        errEl.textContent = err.message || 'Failed to update';
        errEl.style.display = 'block';
      }
    };

    modal.render();
  }

  async confirmToggle(emp) {
    const action = emp.active ? 'deactivate' : 'activate';
    const confirmed = await confirmDialog({
      title: `${emp.active ? 'Deactivate' : 'Activate'} Employee?`,
      message: `Are you sure you want to ${action} <b>${emp.name}</b> (${emp.employeeCode})? ${
        emp.active ? 'The employee will immediately lose access to the mobile application.' : ''
      }`,
      confirmText: emp.active ? 'Deactivate' : 'Activate',
      danger: emp.active,
    });

    if (confirmed) {
      try {
        await employeeApi.toggle(emp.id);
        toast.success('Status Updated', `Employee ${action}d successfully.`);
        this.loadEmployees();
      } catch (err) {
        toast.error('Operation Failed', err.message);
      }
    }
  }

  destroy() {
    if (this.refreshHandler) {
      window.removeEventListener('realtime:employee.created', this.refreshHandler);
      window.removeEventListener('realtime:employee.updated', this.refreshHandler);
    }
  }
}
