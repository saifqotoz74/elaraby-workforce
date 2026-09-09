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

    this.element.innerHTML = `
      <div class="toolbar-container">
        <div>
          <h2 style="font-size: 20px; font-weight: 700; color: var(--navy-900);">Workforce Directory</h2>
          <p style="font-size: 13px; color: var(--text-muted);">Manage employee profiles, credentials, department placement, and vacation balances.</p>
        </div>
        <button class="btn btn-primary" id="btn-add-employee">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Add Employee</span>
        </button>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="toolbar-container" style="margin-bottom: 14px;">
        <div class="toolbar-left">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="emp-search-input" placeholder="Search by name, code, national ID..." />
          </div>

          <select class="form-select" id="emp-factory-filter" style="width: 180px;">
            <option value="">All Factories</option>
            <option value="10th of Ramadan">10th of Ramadan</option>
            <option value="Qwesna">Qwesna</option>
            <option value="Benha">Benha</option>
          </select>
        </div>
      </div>

      <!-- Table Wrapper -->
      <div id="emp-table-wrapper"></div>
      <div id="emp-pagination-wrapper"></div>
    `;

    // Initialize DataTable
    this.table = new DataTable({
      columns: [
        {
          header: 'Employee',
          render: (e) => `
            <div>
              <b style="color: var(--navy-900); display: block;">${e.name}</b>
              <small style="color: var(--text-muted); font-size: 11px;">${e.employeeCode || '—'}</small>
            </div>
          `,
        },
        {
          header: 'National ID',
          field: 'nationalId',
        },
        {
          header: 'Factory & Department',
          render: (e) => `
            <div>
              <span>${e.factory || '—'}</span>
              <small style="display: block; color: var(--text-muted); font-size: 11px;">${e.department || '—'}</small>
            </div>
          `,
        },
        {
          header: 'Position',
          field: 'position',
        },
        {
          header: 'Vacation Balance',
          render: (e) => `<b>${e.vacationBalance ?? 0}</b> <small style="color: var(--text-muted);">days</small>`,
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

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-secondary btn-sm';
            editBtn.textContent = 'Edit';
            editBtn.onclick = () => this.openEditModal(e);

            const toggleBtn = document.createElement('button');
            toggleBtn.className = `btn ${e.active ? 'btn-danger' : 'btn-success'} btn-sm`;
            toggleBtn.textContent = e.active ? 'Deactivate' : 'Activate';
            toggleBtn.onclick = () => this.confirmToggle(e);

            wrap.appendChild(editBtn);
            wrap.appendChild(toggleBtn);
            return wrap;
          },
        },
      ],
      emptyMessage: 'No employees matching the current filters.',
    });

    this.element.querySelector('#emp-table-wrapper').appendChild(this.table.render());

    // Event Bindings
    this.element.querySelector('#btn-add-employee').onclick = () => this.openAddModal();

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

    this.refreshHandler = () => this.loadEmployees();
    window.addEventListener('realtime:employee.created', this.refreshHandler);
    window.addEventListener('realtime:employee.updated', this.refreshHandler);

    this.loadEmployees();
    return this.element;
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

      const list = res.employees || [];
      this.table.update(list, false);

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
