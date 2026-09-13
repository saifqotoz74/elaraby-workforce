// TenantsView - Platform Super-Admin Multi-Tenant & White-Label Management View
// Allows the platform owner to provision new companies, configure brand colors, toggle modules, and manage subscriptions.

import { superAdminApi } from '../api/services.js';
import { toast } from '../components/Toast.js';
import { escapeHtml } from '../utils/sanitize.js';

export class TenantsView {
  constructor(container) {
    this.container = container;
    this.tenants = [];
    this.searchQuery = '';
    this.statusFilter = '';
  }

  async mount() {
    this.renderSkeleton();
    await this.loadTenants();
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--navy-900); margin: 0 0 4px 0;">
            🏢 Platform Tenant Organizations
          </h2>
          <p style="color: var(--text-muted); font-size: 14px; margin: 0;">
            Enterprise White-Label Management: Provision client companies, brand theming, and module subscriptions.
          </p>
        </div>

        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-refresh-tenants">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Refresh
          </button>
          <button type="button" class="btn btn-primary" id="btn-open-provision-modal">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Provision New Company
          </button>
        </div>
      </div>

      <!-- Overview Stats Cards -->
      <div class="dashboard-metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="card" style="padding: 16px 20px; border-left: 4px solid var(--primary);">
          <div style="font-size: 12.5px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total Companies</div>
          <div id="stat-total-tenants" style="font-size: 26px; font-weight: 800; color: var(--navy-900); margin-top: 4px;">--</div>
        </div>
        <div class="card" style="padding: 16px 20px; border-left: 4px solid #10B981;">
          <div style="font-size: 12.5px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Active Subscriptions</div>
          <div id="stat-active-tenants" style="font-size: 26px; font-weight: 800; color: #10B981; margin-top: 4px;">--</div>
        </div>
        <div class="card" style="padding: 16px 20px; border-left: 4px solid #6366F1;">
          <div style="font-size: 12.5px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Managed Workforce</div>
          <div id="stat-total-workers" style="font-size: 26px; font-weight: 800; color: #6366F1; margin-top: 4px;">--</div>
        </div>
      </div>

      <!-- Filter Toolbar -->
      <div class="toolbar-container" style="display: flex; gap: 12px; margin-bottom: 16px;">
        <input type="text" id="tenant-search-input" class="form-input" placeholder="Search company by name, slug or hotline..." style="flex: 1; max-width: 380px;">
        <select id="tenant-status-filter" class="form-select" style="max-width: 180px;">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive / Suspended</option>
        </select>
      </div>

      <!-- Tenants Table Container -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="table-responsive">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: var(--bg-subtle); border-bottom: 1px solid var(--border-color); text-align: left; font-size: 12.5px;">
                <th style="padding: 12px 16px;">Company & Brand</th>
                <th style="padding: 12px 16px;">Slug / Code</th>
                <th style="padding: 12px 16px;">Identity Mode</th>
                <th style="padding: 12px 16px;">Active Modules</th>
                <th style="padding: 12px 16px;">Workers / License</th>
                <th style="padding: 12px 16px;">SMS Sender</th>
                <th style="padding: 12px 16px;">Status</th>
                <th style="padding: 12px 16px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="tenants-table-body">
              <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                  Loading tenant companies...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Provision / Edit Tenant Modal Container -->
      <div id="tenant-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(3px);">
        <div class="card" style="width: 90%; max-width: 640px; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <h3 id="modal-tenant-title" style="margin: 0; font-size: 18px; font-weight: 800; color: var(--navy-900);">
              Provision New Tenant Company
            </h3>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-close-tenant-modal" style="font-size: 18px; line-height: 1;">&times;</button>
          </div>

          <form id="tenant-form">
            <input type="hidden" id="form-tenant-mode" value="create">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;">
              <div>
                <label class="form-label">Company Slug (Unique ID) *</label>
                <input type="text" id="form-tenant-slug" class="form-input" placeholder="e.g. elsewedy, aramex" required>
                <small style="color: var(--text-muted); font-size: 11px;">Alphanumeric code used in mobile app.</small>
              </div>
              <div>
                <label class="form-label">Support Hotline</label>
                <input type="text" id="form-tenant-hotline" class="form-input" placeholder="e.g. 19319, 16244">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;">
              <div>
                <label class="form-label">Company Name (English) *</label>
                <input type="text" id="form-tenant-name" class="form-input" placeholder="e.g. Elsewedy Electric" required>
              </div>
              <div>
                <label class="form-label">Company Name (Arabic) *</label>
                <input type="text" id="form-tenant-name-ar" class="form-input" placeholder="e.g. السويدي إليكتريك" required>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;">
              <div>
                <label class="form-label">Primary Brand Color *</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <input type="color" id="form-tenant-color-picker" value="#0B63B4" style="width: 42px; height: 38px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; padding: 2px;">
                  <input type="text" id="form-tenant-color-hex" class="form-input" value="#0B63B4" style="flex: 1;">
                </div>
              </div>
              <div>
                <label class="form-label">Identity Verification Mode</label>
                <select id="form-tenant-auth-mode" class="form-select">
                  <option value="egyptian_national_id">Egyptian National ID (14 digits)</option>
                  <option value="gulf_iqama">Gulf Iqama / Residence (10 digits)</option>
                  <option value="generic_employee_code">Generic Employee Code (Alphanumeric)</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;">
              <div>
                <label class="form-label">SMS Sender ID</label>
                <input type="text" id="form-tenant-sms-sender" class="form-input" placeholder="e.g. ELSEWEDY, WORKFORCE">
              </div>
              <div>
                <label class="form-label">Max Employees License</label>
                <input type="number" id="form-tenant-max-emp" class="form-input" value="1000" min="10" step="10">
              </div>
            </div>

            <div style="margin-bottom: 20px;">
              <label class="form-label" style="margin-bottom: 8px; display: block;">Enabled Features & Modules</label>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; background: var(--bg-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                  <input type="checkbox" id="feat-payroll" checked> Payroll Slips
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                  <input type="checkbox" id="feat-vacations" checked> Leave & Vacations
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                  <input type="checkbox" id="feat-shifts" checked> Shift Schedules
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                  <input type="checkbox" id="feat-buses" checked> Company Transport
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                  <input type="checkbox" id="feat-concerns" checked> Whistleblower / Safety
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                  <input type="checkbox" id="feat-surveys" checked> Pulse Surveys
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                  <input type="checkbox" id="feat-trips" checked> Summer Trips
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                  <input type="checkbox" id="feat-medical" checked> Medical Network
                </label>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-tenant-modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-save-tenant">Save & Provision</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const refreshBtn = this.container.querySelector('#btn-refresh-tenants');
    if (refreshBtn) refreshBtn.onclick = () => this.loadTenants();

    const searchInput = this.container.querySelector('#tenant-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderTable();
      };
    }

    const statusFilter = this.container.querySelector('#tenant-status-filter');
    if (statusFilter) {
      statusFilter.onchange = (e) => {
        this.statusFilter = e.target.value;
        this.renderTable();
      };
    }

    // Modal controls
    const openBtn = this.container.querySelector('#btn-open-provision-modal');
    const modalOverlay = this.container.querySelector('#tenant-modal-overlay');
    const closeBtn = this.container.querySelector('#btn-close-tenant-modal');
    const cancelBtn = this.container.querySelector('#btn-cancel-tenant-modal');

    const openModal = (mode = 'create', tenantData = null) => {
      this.populateModal(mode, tenantData);
      modalOverlay.style.display = 'flex';
    };

    const closeModal = () => {
      modalOverlay.style.display = 'none';
    };

    if (openBtn) openBtn.onclick = () => openModal('create');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Color picker synchronization
    const colorPicker = this.container.querySelector('#form-tenant-color-picker');
    const colorHex = this.container.querySelector('#form-tenant-color-hex');
    if (colorPicker && colorHex) {
      colorPicker.oninput = (e) => { colorHex.value = e.target.value.toUpperCase(); };
      colorHex.oninput = (e) => {
        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
          colorPicker.value = e.target.value;
        }
      };
    }

    // Form submit
    const form = this.container.querySelector('#tenant-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit(closeModal);
      };
    }
  }

  populateModal(mode, t = null) {
    const title = this.container.querySelector('#modal-tenant-title');
    const modeInput = this.container.querySelector('#form-tenant-mode');
    const slugInput = this.container.querySelector('#form-tenant-slug');
    const nameInput = this.container.querySelector('#form-tenant-name');
    const nameArInput = this.container.querySelector('#form-tenant-name-ar');
    const hotlineInput = this.container.querySelector('#form-tenant-hotline');
    const colorPicker = this.container.querySelector('#form-tenant-color-picker');
    const colorHex = this.container.querySelector('#form-tenant-color-hex');
    const authModeSelect = this.container.querySelector('#form-tenant-auth-mode');
    const smsSenderInput = this.container.querySelector('#form-tenant-sms-sender');
    const maxEmpInput = this.container.querySelector('#form-tenant-max-emp');

    modeInput.value = mode;

    if (mode === 'edit' && t) {
      title.textContent = `Edit Tenant: ${t.name}`;
      slugInput.value = t.slug || t.id;
      slugInput.disabled = true; // Slug is immutable
      nameInput.value = t.name || '';
      nameArInput.value = t.nameAr || '';
      hotlineInput.value = t.brand?.supportHotline || '';
      const color = t.brand?.primaryColor || '#0B63B4';
      colorPicker.value = color;
      colorHex.value = color;
      authModeSelect.value = t.authMode || 'egyptian_national_id';
      smsSenderInput.value = t.smsSenderId || '';
      maxEmpInput.value = t.maxEmployees || 1000;

      const f = t.features || {};
      this.container.querySelector('#feat-payroll').checked = f.hasPayroll !== false;
      this.container.querySelector('#feat-vacations').checked = f.hasVacations !== false;
      this.container.querySelector('#feat-shifts').checked = f.hasShifts !== false;
      this.container.querySelector('#feat-buses').checked = f.hasBuses !== false;
      this.container.querySelector('#feat-concerns').checked = f.hasWhistleblower !== false;
      this.container.querySelector('#feat-surveys').checked = f.hasSurveys !== false;
      this.container.querySelector('#feat-trips').checked = f.hasSummerTrips !== false;
      this.container.querySelector('#feat-medical').checked = f.hasMedicalNetwork !== false;
    } else {
      title.textContent = 'Provision New Tenant Company';
      slugInput.value = '';
      slugInput.disabled = false;
      nameInput.value = '';
      nameArInput.value = '';
      hotlineInput.value = '';
      colorPicker.value = '#0B63B4';
      colorHex.value = '#0B63B4';
      authModeSelect.value = 'egyptian_national_id';
      smsSenderInput.value = '';
      maxEmpInput.value = '1000';

      this.container.querySelector('#feat-payroll').checked = true;
      this.container.querySelector('#feat-vacations').checked = true;
      this.container.querySelector('#feat-shifts').checked = true;
      this.container.querySelector('#feat-buses').checked = true;
      this.container.querySelector('#feat-concerns').checked = true;
      this.container.querySelector('#feat-surveys').checked = true;
      this.container.querySelector('#feat-trips').checked = true;
      this.container.querySelector('#feat-medical').checked = true;
    }
  }

  async handleFormSubmit(onSuccess) {
    const mode = this.container.querySelector('#form-tenant-mode').value;
    const slug = this.container.querySelector('#form-tenant-slug').value.trim().toLowerCase();
    const name = this.container.querySelector('#form-tenant-name').value.trim();
    const nameAr = this.container.querySelector('#form-tenant-name-ar').value.trim();
    const hotline = this.container.querySelector('#form-tenant-hotline').value.trim();
    const primaryColor = this.container.querySelector('#form-tenant-color-hex').value.trim();
    const authMode = this.container.querySelector('#form-tenant-auth-mode').value;
    const smsSenderId = this.container.querySelector('#form-tenant-sms-sender').value.trim();
    const maxEmployees = parseInt(this.container.querySelector('#form-tenant-max-emp').value, 10) || 1000;

    const features = {
      hasPayroll: this.container.querySelector('#feat-payroll').checked,
      hasVacations: this.container.querySelector('#feat-vacations').checked,
      hasShifts: this.container.querySelector('#feat-shifts').checked,
      hasBuses: this.container.querySelector('#feat-buses').checked,
      hasWhistleblower: this.container.querySelector('#feat-concerns').checked,
      hasSurveys: this.container.querySelector('#feat-surveys').checked,
      hasSummerTrips: this.container.querySelector('#feat-trips').checked,
      hasMedicalNetwork: this.container.querySelector('#feat-medical').checked,
    };

    const payload = {
      slug,
      name,
      nameAr,
      brand: {
        primaryColor,
        supportHotline: hotline || '19319',
      },
      features,
      authMode,
      smsSenderId: smsSenderId || name.slice(0, 11).toUpperCase(),
      maxEmployees,
    };

    try {
      if (mode === 'create') {
        await superAdminApi.createTenant(payload);
        toast.success('Company Provisioned', `Tenant "${name}" successfully registered!`);
      } else {
        await superAdminApi.updateTenant(slug, payload);
        toast.success('Company Updated', `Tenant "${name}" configuration saved!`);
      }
      onSuccess();
      await this.loadTenants();
    } catch (err) {
      toast.error('Provisioning Error', err.message);
    }
  }

  async loadTenants() {
    try {
      const res = await superAdminApi.listTenants();
      this.tenants = res.tenants || [];
      this.updateStats();
      this.renderTable();
    } catch (err) {
      toast.error('Failed to load tenants', err.message);
    }
  }

  updateStats() {
    const total = this.tenants.length;
    const active = this.tenants.filter((t) => t.status !== 'inactive').length;
    const workers = this.tenants.reduce((acc, t) => acc + (t.employeeCount || 0), 0);

    const totalEl = this.container.querySelector('#stat-total-tenants');
    const activeEl = this.container.querySelector('#stat-active-tenants');
    const workersEl = this.container.querySelector('#stat-total-workers');

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (workersEl) workersEl.textContent = workers.toLocaleString();
  }

  renderTable() {
    const tbody = this.container.querySelector('#tenants-table-body');
    if (!tbody) return;

    let filtered = this.tenants;

    if (this.statusFilter) {
      filtered = filtered.filter((t) => (t.status || 'active') === this.statusFilter);
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = filtered.filter((t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.nameAr || '').toLowerCase().includes(q) ||
        (t.slug || t.id || '').toLowerCase().includes(q) ||
        (t.brand?.supportHotline || '').includes(q)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No matching tenant companies found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((t) => {
      const brandColor = t.brand?.primaryColor || '#0B63B4';
      const initials = (t.name || 'EC').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const isActive = t.status !== 'inactive';
      const employeeCount = t.employeeCount || 0;
      const maxEmp = t.maxEmployees || 1000;

      // Active features count
      const activeFeats = Object.entries(t.features || {}).filter(([_, v]) => v).length;

      return `
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 13.5px;">
          <td style="padding: 12px 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 8px; background: ${brandColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${initials}
              </div>
              <div>
                <div style="font-weight: 700; color: var(--navy-900);">${escapeHtml(t.name)}</div>
                <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(t.nameAr || '')}</div>
              </div>
            </div>
          </td>
          <td style="padding: 12px 16px;">
            <code style="background: var(--bg-subtle); padding: 3px 6px; border-radius: 4px; font-size: 12px; color: var(--primary);">
              ${escapeHtml(t.slug || t.id)}
            </code>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 12px; color: var(--text-dark);">
              ${t.authMode === 'gulf_iqama' ? '🇸🇦 Gulf Iqama' : t.authMode === 'generic_employee_code' ? '🏢 Employee Code' : '🇪🇬 Egyptian National ID'}
            </span>
          </td>
          <td style="padding: 12px 16px;">
            <span class="badge" style="background: #E0E7FF; color: #4338CA; font-size: 11.5px;">
              ${activeFeats} Modules Active
            </span>
          </td>
          <td style="padding: 12px 16px;">
            <div style="font-weight: 600;">${employeeCount} / ${maxEmp}</div>
            <div style="font-size: 10.5px; color: var(--text-muted);">${Math.round((employeeCount / maxEmp) * 100)}% utilized</div>
          </td>
          <td style="padding: 12px 16px; font-weight: 600; color: var(--text-dark);">
            ${escapeHtml(t.smsSenderId || 'Default')}
          </td>
          <td style="padding: 12px 16px;">
            <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}" style="font-size: 11.5px;">
              ${isActive ? 'Active' : 'Suspended'}
            </span>
          </td>
          <td style="padding: 12px 16px; text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-sm btn-edit-tenant" data-slug="${escapeHtml(t.slug || t.id)}">
                Edit
              </button>
              ${t.id !== 'elaraby' ? `
                <button type="button" class="btn ${isActive ? 'btn-ghost' : 'btn-primary'} btn-sm btn-toggle-tenant" data-slug="${escapeHtml(t.slug || t.id)}" style="${isActive ? 'color: #EF4444;' : ''}">
                  ${isActive ? 'Suspend' : 'Activate'}
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row action listeners
    tbody.querySelectorAll('.btn-edit-tenant').forEach((btn) => {
      btn.onclick = () => {
        const slug = btn.dataset.slug;
        const tenant = this.tenants.find((t) => (t.slug || t.id) === slug);
        if (tenant) {
          this.populateModal('edit', tenant);
          this.container.querySelector('#tenant-modal-overlay').style.display = 'flex';
        }
      };
    });

    tbody.querySelectorAll('.btn-toggle-tenant').forEach((btn) => {
      btn.onclick = async () => {
        const slug = btn.dataset.slug;
        const tenant = this.tenants.find((t) => (t.slug || t.id) === slug);
        if (!tenant) return;

        const isCurrentlyActive = tenant.status !== 'inactive';
        const action = isCurrentlyActive ? 'suspend' : 'activate';

        if (confirm(`Are you sure you want to ${action} "${tenant.name}"?`)) {
          try {
            if (isCurrentlyActive) {
              await superAdminApi.deactivateTenant(slug);
              toast.info('Tenant Suspended', `Tenant ${tenant.name} has been marked inactive.`);
            } else {
              await superAdminApi.updateTenant(slug, { status: 'active' });
              toast.success('Tenant Activated', `Tenant ${tenant.name} is now active.`);
            }
            await this.loadTenants();
          } catch (err) {
            toast.error('Action Failed', err.message);
          }
        }
      };
    });
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
