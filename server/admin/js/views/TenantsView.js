// TenantsView - Enterprise Brand Studio & Platform Multi-Tenant Customizer
// Provides interactive live mobile phone mockup, logo management, factory geofences,
// and real-time synchronization to active workforce devices.

import { superAdminApi, uploadApi } from '../api/services.js';
import { toast } from '../components/Toast.js';
import { escapeHtml } from '../utils/sanitize.js';

export class TenantsView {
  constructor(container) {
    this.container = container;
    this.tenants = [];
    this.searchQuery = '';
    this.statusFilter = '';
    this.previewMode = 'welcome'; // 'welcome' | 'home' | 'payslip'
    this.currentFactoryGeofences = [];
    this.uploadedLogoFile = null;
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
            🏢 Enterprise Multi-Tenant & Brand Studio
          </h2>
          <p style="color: var(--text-muted); font-size: 14px; margin: 0;">
            Real-Time White-Label Customizer: Provision companies, tailor visual themes with live smartphone mockup, and manage geofenced factory zones.
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
            + Provision Brand Studio
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
        <input type="text" id="tenant-search-input" class="form-input" placeholder="Search company by name, slug, CR, tax or hotline..." style="flex: 1; max-width: 380px;">
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
                <th style="padding: 12px 16px;">CR & Tax Card</th>
                <th style="padding: 12px 16px;">Active Modules</th>
                <th style="padding: 12px 16px;">Factories & Geofences</th>
                <th style="padding: 12px 16px;">Workers</th>
                <th style="padding: 12px 16px;">Status</th>
                <th style="padding: 12px 16px; text-align: right;">Studio Actions</th>
              </tr>
            </thead>
            <tbody id="tenants-table-body">
              <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                  Loading enterprise tenants...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Two-Column Enterprise Brand Studio Modal -->
      <div id="tenant-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 20px;">
        <div class="card" style="width: 100%; max-width: 1120px; max-height: 94vh; overflow-y: auto; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.45); border-radius: 20px;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #0B63B4, #3B82F6); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                🎨
              </div>
              <div>
                <h3 id="modal-tenant-title" style="margin: 0; font-size: 19px; font-weight: 800; color: var(--navy-900);">
                  Enterprise Brand Studio & Live Mobile Customizer
                </h3>
                <p style="margin: 0; font-size: 12px; color: var(--text-muted);">
                  Customize branding, typography, official tax letterhead, and factory geofences with instant real-time device preview.
                </p>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-close-tenant-modal" style="font-size: 22px; line-height: 1;">&times;</button>
          </div>

          <div class="brand-studio-layout">
            <!-- Left Column: Studio Form Configuration -->
            <div class="brand-studio-form-col">
              <form id="tenant-form">
                <input type="hidden" id="form-tenant-mode" value="create">

                <!-- 1. Corporate Identity -->
                <div style="background: var(--bg-subtle); padding: 14px 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                  <div style="font-size: 13px; font-weight: 800; color: var(--navy-900); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>🏢</span> Corporate Identity & Localization
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                      <label class="form-label">Company Code / Slug *</label>
                      <input type="text" id="form-tenant-slug" class="form-input" placeholder="e.g. elsewedy" required>
                      <small style="color: var(--text-muted); font-size: 10.5px;">Code used by workers to connect.</small>
                    </div>
                    <div>
                      <label class="form-label">Name (English) *</label>
                      <input type="text" id="form-tenant-name" class="form-input" placeholder="e.g. Elsewedy Electric" required>
                    </div>
                    <div>
                      <label class="form-label">Name (Arabic) *</label>
                      <input type="text" id="form-tenant-name-ar" class="form-input" placeholder="e.g. السويدي إليكتريك" required dir="rtl">
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px;">
                    <div>
                      <label class="form-label">Corporate Subtitle / Activity</label>
                      <input type="text" id="form-tenant-subtitle" class="form-input" placeholder="e.g. Energy & Cables Infrastructure">
                    </div>
                    <div>
                      <label class="form-label">Support Hotline</label>
                      <input type="text" id="form-tenant-hotline" class="form-input" placeholder="e.g. 16244">
                    </div>
                    <div>
                      <label class="form-label">Currency</label>
                      <select id="form-tenant-currency" class="form-select">
                        <option value="EGP">EGP (جم)</option>
                        <option value="SAR">SAR (ر.س)</option>
                        <option value="AED">AED (د.إ)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- 2. Visual Theming & Logo Studio -->
                <div style="background: var(--bg-subtle); padding: 14px 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                  <div style="font-size: 13px; font-weight: 800; color: var(--navy-900); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>🎨</span> Visual Theming & Logo Studio
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;">
                    <div>
                      <label class="form-label">Primary Brand Color *</label>
                      <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="color" id="form-tenant-color-picker" value="#0B63B4" style="width: 44px; height: 38px; border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; padding: 2px;">
                        <input type="text" id="form-tenant-color-hex" class="form-input" value="#0B63B4" style="flex: 1; font-family: monospace; font-weight: 700;">
                      </div>
                    </div>
                    <div>
                      <label class="form-label">Identity Strategy</label>
                      <select id="form-tenant-auth-mode" class="form-select">
                        <option value="egyptian_national_id">🇪🇬 Egyptian National ID (14 digits)</option>
                        <option value="gulf_iqama">🇸🇦 Gulf Iqama / National ID (10 digits)</option>
                        <option value="generic_employee_code">🏢 Corporate Employee Code</option>
                      </select>
                    </div>
                  </div>

                  <!-- Logo Upload & Monogram Box -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div>
                      <label class="form-label">Corporate Logo Image</label>
                      <div class="logo-dropzone" id="logo-dropzone">
                        <input type="file" id="logo-file-input" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display: none;">
                        <div id="dropzone-prompt" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--primary)" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                          <span style="font-size: 11.5px; font-weight: 600; color: var(--navy-800);">Click or drag & drop Logo</span>
                          <span style="font-size: 10px; color: var(--text-muted);">PNG, SVG, or WebP up to 6MB</span>
                        </div>
                        <div id="dropzone-preview" style="display: none; align-items: center; gap: 10px;">
                          <img id="logo-preview-img" src="" style="width: 44px; height: 44px; object-fit: contain; border-radius: 8px; background: white; padding: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);">
                          <div style="text-align: left;">
                            <div id="logo-filename" style="font-size: 11.5px; font-weight: 700; color: var(--navy-900);">logo.png</div>
                            <button type="button" id="btn-remove-logo" class="btn btn-ghost btn-sm" style="padding: 2px 6px; font-size: 11px; color: #EF4444;">Remove</button>
                          </div>
                        </div>
                      </div>
                      <input type="hidden" id="form-tenant-logo-url" value="">
                    </div>

                    <div>
                      <label class="form-label">Monogram Shield Fallback</label>
                      <div style="display: flex; align-items: center; gap: 12px; background: white; padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); height: 96px;">
                        <div id="monogram-shield-preview" style="width: 52px; height: 52px; border-radius: 12px; background: #0B63B4; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                          EG
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
                          Generated automatically from uppercase brand initials when no custom image logo is attached.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 3. Legal Registry & Tax Letterhead -->
                <div style="background: var(--bg-subtle); padding: 14px 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                  <div style="font-size: 13px; font-weight: 800; color: var(--navy-900); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>📜</span> Legal Registration & Document Letterhead
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 8px;">
                    <div>
                      <label class="form-label">Commercial Registry (CR) Number *</label>
                      <input type="text" id="form-tenant-cr" class="form-input" placeholder="e.g. EG-284910, 104821" required>
                    </div>
                    <div>
                      <label class="form-label">Tax Card Registration *</label>
                      <input type="text" id="form-tenant-tax" class="form-input" placeholder="e.g. EG-284-910-112" required>
                    </div>
                  </div>
                  <small style="color: var(--text-muted); font-size: 11px;">These official legal identifiers are printed on corporate payslips, leaves, and official employee certificates.</small>
                </div>

                <!-- 4. Operational Zones & Geofencing -->
                <div style="background: var(--bg-subtle); padding: 14px 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                  <div style="font-size: 13px; font-weight: 800; color: var(--navy-900); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>📍</span> Industrial Complexes & Geofencing
                  </div>
                  <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap: 8px; margin-bottom: 10px;">
                    <input type="text" id="new-factory-name" class="form-input" placeholder="Complex Name (e.g. 10th of Ramadan)">
                    <input type="number" step="0.0001" id="new-factory-lat" class="form-input" placeholder="GPS Lat (30.2981)">
                    <input type="number" step="0.0001" id="new-factory-lng" class="form-input" placeholder="GPS Lng (31.7428)">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-add-factory" style="white-space: nowrap;">+ Add Zone</button>
                  </div>
                  <div class="factory-chip-container" id="factory-chips-list">
                    <!-- Dynamic chips -->
                  </div>
                </div>

                <!-- 5. Module Subscriptions -->
                <div style="margin-bottom: 20px;">
                  <label class="form-label" style="margin-bottom: 8px; display: block; font-weight: 800;">
                    Functional Module Gates
                  </label>
                  <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; background: var(--bg-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
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
                      <input type="checkbox" id="feat-buses" checked> Fleet Buses
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                      <input type="checkbox" id="feat-concerns" checked> Whistleblower
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
                  <button type="submit" class="btn btn-primary" id="btn-save-tenant">Save & Broadcast Live</button>
                </div>
              </form>
            </div>

            <!-- Right Column: Live Reactive Smartphone Mockup Canvas -->
            <div class="brand-studio-preview-col">
              <div class="mockup-mode-switcher">
                <button type="button" class="mockup-mode-btn active" data-mode="welcome">📱 Welcome</button>
                <button type="button" class="mockup-mode-btn" data-mode="home">🏠 Home</button>
                <button type="button" class="mockup-mode-btn" data-mode="payslip">📄 Payslip</button>
              </div>

              <!-- Smartphone Chassis -->
              <div class="phone-chassis">
                <div class="phone-notch">
                  <div class="phone-camera-lens"></div>
                </div>
                
                <div class="phone-status-bar">
                  <span>9:41</span>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    <span style="font-size: 9px;">5G</span>
                    <span style="font-size: 10px;">📶</span>
                    <span style="font-size: 10px;">🔋</span>
                  </div>
                </div>

                <div class="phone-screen" id="mockup-screen-content">
                  <!-- Rendered dynamically by updatePhoneMockup() -->
                </div>

                <div class="phone-home-indicator"></div>
              </div>

              <div style="margin-top: 10px; font-size: 11px; color: var(--text-muted); text-align: center;">
                ✨ Live Real-time Sync Preview
              </div>
            </div>
          </div>
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
      this.updatePhoneMockup();
    };

    const closeModal = () => {
      modalOverlay.style.display = 'none';
      this.uploadedLogoFile = null;
    };

    if (openBtn) openBtn.onclick = () => openModal('create');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Color picker synchronization
    const colorPicker = this.container.querySelector('#form-tenant-color-picker');
    const colorHex = this.container.querySelector('#form-tenant-color-hex');
    if (colorPicker && colorHex) {
      colorPicker.oninput = (e) => {
        colorHex.value = e.target.value.toUpperCase();
        this.updatePhoneMockup();
      };
      colorHex.oninput = (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          colorPicker.value = val;
        }
        this.updatePhoneMockup();
      };
    }

    // Form live change listeners for instant mockup updates
    const inputsToWatch = [
      '#form-tenant-name', '#form-tenant-name-ar', '#form-tenant-subtitle',
      '#form-tenant-cr', '#form-tenant-tax', '#form-tenant-currency',
      '#feat-payroll', '#feat-vacations', '#feat-shifts', '#feat-buses',
      '#feat-concerns', '#feat-surveys', '#feat-trips', '#feat-medical'
    ];
    inputsToWatch.forEach((selector) => {
      const el = this.container.querySelector(selector);
      if (el) {
        el.addEventListener('input', () => this.updatePhoneMockup());
        el.addEventListener('change', () => this.updatePhoneMockup());
      }
    });

    // Preview Mode Switcher (Welcome / Home / Payslip)
    const modeBtns = this.container.querySelectorAll('.mockup-mode-btn');
    modeBtns.forEach((btn) => {
      btn.onclick = () => {
        modeBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.previewMode = btn.dataset.mode;
        this.updatePhoneMockup();
      };
    });

    // Logo Dropzone & File Input
    const dropzone = this.container.querySelector('#logo-dropzone');
    const fileInput = this.container.querySelector('#logo-file-input');
    const removeLogoBtn = this.container.querySelector('#btn-remove-logo');

    if (dropzone && fileInput) {
      dropzone.onclick = (e) => {
        if (e.target !== removeLogoBtn) fileInput.click();
      };
      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      };
      dropzone.ondragleave = () => dropzone.classList.remove('dragover');
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleLogoFile(e.dataTransfer.files[0]);
        }
      };
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleLogoFile(e.target.files[0]);
        }
      };
    }

    if (removeLogoBtn) {
      removeLogoBtn.onclick = (e) => {
        e.stopPropagation();
        this.clearLogo();
      };
    }

    // Factory Location Add / Remove
    const addFactoryBtn = this.container.querySelector('#btn-add-factory');
    if (addFactoryBtn) {
      addFactoryBtn.onclick = () => {
        const nameInput = this.container.querySelector('#new-factory-name');
        const latInput = this.container.querySelector('#new-factory-lat');
        const lngInput = this.container.querySelector('#new-factory-lng');
        const name = (nameInput.value || '').trim();
        if (!name) return;

        const lat = parseFloat(latInput.value) || 30.0444;
        const lng = parseFloat(lngInput.value) || 31.2357;

        this.currentFactoryGeofences.push({
          id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name,
          lat,
          lng,
          radiusMeters: 800,
        });

        nameInput.value = '';
        latInput.value = '';
        lngInput.value = '';
        this.renderFactoryChips();
      };
    }

    // Form Submission
    const form = this.container.querySelector('#tenant-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleSubmit(() => closeModal());
      };
    }
  }

  handleLogoFile(file) {
    this.uploadedLogoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      this.container.querySelector('#form-tenant-logo-url').value = dataUrl;
      const previewImg = this.container.querySelector('#logo-preview-img');
      const filenameEl = this.container.querySelector('#logo-filename');
      if (previewImg) previewImg.src = dataUrl;
      if (filenameEl) filenameEl.textContent = file.name;
      this.container.querySelector('#dropzone-prompt').style.display = 'none';
      this.container.querySelector('#dropzone-preview').style.display = 'flex';
      this.updatePhoneMockup();
    };
    reader.readAsDataURL(file);
  }

  clearLogo() {
    this.uploadedLogoFile = null;
    this.container.querySelector('#form-tenant-logo-url').value = '';
    this.container.querySelector('#logo-file-input').value = '';
    this.container.querySelector('#dropzone-prompt').style.display = 'flex';
    this.container.querySelector('#dropzone-preview').style.display = 'none';
    this.updatePhoneMockup();
  }

  renderFactoryChips() {
    const list = this.container.querySelector('#factory-chips-list');
    if (!list) return;

    if (this.currentFactoryGeofences.length === 0) {
      list.innerHTML = `<span style="font-size: 11.5px; color: var(--text-muted);">No factory zones configured.</span>`;
      return;
    }

    list.innerHTML = this.currentFactoryGeofences.map((fz, idx) => `
      <div class="factory-chip">
        <span>📍 ${escapeHtml(fz.name || fz.nameAr || 'Zone')}</span>
        <small style="color: #64748B; font-size: 10px;">(${fz.lat?.toFixed(2) || '0'}, ${fz.lng?.toFixed(2) || '0'})</small>
        <span class="factory-chip-remove" data-idx="${idx}">&times;</span>
      </div>
    `).join('');

    list.querySelectorAll('.factory-chip-remove').forEach((btn) => {
      btn.onclick = (e) => {
        const idx = parseInt(btn.dataset.idx, 10);
        this.currentFactoryGeofences.splice(idx, 1);
        this.renderFactoryChips();
      };
    });
  }

  getBrandInitials(name) {
    if (!name) return 'EC';
    const clean = name.trim().replace(/[^a-zA-Z\s]/g, '');
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  updatePhoneMockup() {
    const screen = this.container.querySelector('#mockup-screen-content');
    if (!screen) return;

    const name = this.container.querySelector('#form-tenant-name')?.value || 'Elaraby Group';
    const nameAr = this.container.querySelector('#form-tenant-name-ar')?.value || 'مجموعة العربي';
    const primaryColor = this.container.querySelector('#form-tenant-color-hex')?.value || '#0B63B4';
    const subtitle = this.container.querySelector('#form-tenant-subtitle')?.value || 'Workforce Platform';
    const cr = this.container.querySelector('#form-tenant-cr')?.value || 'EG-104821';
    const tax = this.container.querySelector('#form-tenant-tax')?.value || 'EG-102-993-841';
    const currency = this.container.querySelector('#form-tenant-currency')?.value || 'EGP';
    const logoUrl = this.container.querySelector('#form-tenant-logo-url')?.value;
    const initials = this.getBrandInitials(name);

    // Update monogram preview in form
    const monogramEl = this.container.querySelector('#monogram-shield-preview');
    if (monogramEl) {
      monogramEl.textContent = initials;
      monogramEl.style.background = primaryColor;
    }

    const hasBuses = this.container.querySelector('#feat-buses')?.checked !== false;
    const hasTrips = this.container.querySelector('#feat-trips')?.checked !== false;
    const hasPayroll = this.container.querySelector('#feat-payroll')?.checked !== false;
    const hasShifts = this.container.querySelector('#feat-shifts')?.checked !== false;

    if (this.previewMode === 'welcome') {
      screen.innerHTML = `
        <div style="padding: 24px 18px; display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
          <!-- Top Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${logoUrl ? `
                <img src="${logoUrl}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 8px;">
              ` : `
                <div style="width: 32px; height: 32px; border-radius: 8px; background: ${primaryColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;">
                  ${initials}
                </div>
              `}
              <span style="font-weight: 800; font-size: 14px; color: ${primaryColor}; letter-spacing: 0.5px;">${escapeHtml(name.split(' ')[0].toUpperCase())}</span>
            </div>
            <div style="background: white; padding: 4px 10px; border-radius: 14px; font-size: 10px; font-weight: 700; color: #1E293B; border: 1px solid #E2E8F0;">
              العربية 🌐
            </div>
          </div>

          <!-- Hero Branding Card -->
          <div style="text-align: center; margin: 30px 0;">
            ${logoUrl ? `
              <img src="${logoUrl}" style="width: 64px; height: 64px; object-fit: contain; margin-bottom: 14px;">
            ` : `
              <div style="width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg, ${primaryColor}, #3B82F6); color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 24px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); margin-bottom: 14px;">
                ${initials}
              </div>
            `}
            <h3 style="margin: 0 0 4px 0; font-size: 17px; font-weight: 800; color: #0F172A;">${escapeHtml(name)}</h3>
            <div style="font-size: 13px; color: #64748B; font-weight: 600; margin-bottom: 6px;">${escapeHtml(nameAr)}</div>
            <p style="font-size: 11px; color: #94A3B8; margin: 0; line-height: 1.4;">${escapeHtml(subtitle)}</p>
          </div>

          <!-- Actions -->
          <div>
            <button type="button" style="width: 100%; padding: 13px; border-radius: 14px; background: ${primaryColor}; color: white; font-weight: 700; font-size: 13.5px; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; margin-bottom: 8px;">
              تسجيل الدخول / Get Started
            </button>
            <div style="font-size: 10px; color: #94A3B8; text-align: center;">
              منصة العمل المؤسسية الرسمية • Official Platform
            </div>
          </div>
        </div>
      `;
    } else if (this.previewMode === 'home') {
      screen.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%;">
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, ${primaryColor}, #1E293B); padding: 16px 16px 24px 16px; color: white; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px;">
                  ${initials}
                </div>
                <div style="font-size: 13px; font-weight: 800;">${escapeHtml(name.split(' ')[0])} Connect</div>
              </div>
              <span style="font-size: 14px;">🔔</span>
            </div>
            <div style="font-size: 11px; opacity: 0.85;">مرحباً بعودتك 👋</div>
            <div style="font-size: 15px; font-weight: 800;">م. أحمد محمود</div>
          </div>

          <!-- Quick Actions Grid -->
          <div style="padding: 14px 14px; flex: 1;">
            <div style="font-size: 11.5px; font-weight: 800; color: #334155; margin-bottom: 10px; text-transform: uppercase;">
              الخدمات السريعة (Quick Actions)
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              ${hasPayroll ? `
                <div style="background: white; padding: 10px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
                  <span style="font-size: 18px;">💵</span>
                  <div style="font-size: 11px; font-weight: 700; color: #1E293B; margin-top: 4px;">قسيمة الراتب</div>
                </div>
              ` : ''}
              ${hasShifts ? `
                <div style="background: white; padding: 10px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
                  <span style="font-size: 18px;">⏱️</span>
                  <div style="font-size: 11px; font-weight: 700; color: #1E293B; margin-top: 4px;">جدول الورديات</div>
                </div>
              ` : ''}
              ${hasBuses ? `
                <div style="background: white; padding: 10px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
                  <span style="font-size: 18px;">🚌</span>
                  <div style="font-size: 11px; font-weight: 700; color: #1E293B; margin-top: 4px;">حافلات المصنع</div>
                </div>
              ` : ''}
              ${hasTrips ? `
                <div style="background: white; padding: 10px; border-radius: 12px; border: 1px solid #E2E8F0; text-align: center;">
                  <span style="font-size: 18px;">🏖️</span>
                  <div style="font-size: 11px; font-weight: 700; color: #1E293B; margin-top: 4px;">رحلات الصيف</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    } else if (this.previewMode === 'payslip') {
      screen.innerHTML = `
        <div style="padding: 14px 12px; font-size: 11px;">
          <!-- Corporate Letterhead -->
          <div style="background: white; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0; border-top: 4px solid ${primaryColor}; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div>
                <div style="font-weight: 800; font-size: 12px; color: ${primaryColor};">${escapeHtml(name)}</div>
                <div style="font-size: 10px; color: #64748B;">${escapeHtml(nameAr)}</div>
                <div style="font-size: 8.5px; color: #94A3B8; margin-top: 2px;">س.ت: ${escapeHtml(cr)} • ضريبية: ${escapeHtml(tax)}</div>
              </div>
              <div style="width: 28px; height: 28px; border-radius: 6px; background: ${primaryColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 10px;">
                ${initials}
              </div>
            </div>
          </div>

          <!-- Payslip Breakdown -->
          <div style="background: white; padding: 12px; border-radius: 12px; border: 1px solid #E2E8F0;">
            <div style="font-weight: 800; font-size: 11.5px; color: #1E293B; margin-bottom: 8px; border-bottom: 1px solid #F1F5F9; padding-bottom: 4px;">
              بيان راتب شهر سبتمبر 2026
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #64748B;">الراتب الأساسي:</span>
              <span style="font-weight: 700;">8,500 ${escapeHtml(currency)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #64748B;">بدل طبيعة عمل:</span>
              <span style="font-weight: 700; color: #10B981;">+1,200 ${escapeHtml(currency)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #E2E8F0; padding-bottom: 6px;">
              <span style="color: #64748B;">التأمينات والضرائب:</span>
              <span style="font-weight: 700; color: #EF4444;">-650 ${escapeHtml(currency)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(11,99,180,0.06); padding: 6px 8px; border-radius: 8px;">
              <span style="font-weight: 800; color: ${primaryColor}; font-size: 11.5px;">صافي الراتب:</span>
              <span style="font-weight: 900; color: ${primaryColor}; font-size: 13px;">9,050 ${escapeHtml(currency)}</span>
            </div>
          </div>

          <!-- Official Verification Seal -->
          <div style="margin-top: 10px; text-align: center; background: white; padding: 8px; border-radius: 8px; border: 1px solid #E2E8F0;">
            <div style="font-size: 9px; color: #64748B;">مستند رسمي صادر إلكترونياً ومعتمد</div>
            <div style="font-size: 8px; color: #94A3B8;">HMAC-SHA256: VALIDATED • QR ACTIVE</div>
          </div>
        </div>
      `;
    }
  }

  populateModal(mode = 'create', tenant = null) {
    const isEdit = mode === 'edit' && tenant != null;
    this.container.querySelector('#form-tenant-mode').value = mode;
    this.container.querySelector('#modal-tenant-title').textContent = isEdit
      ? `Brand Studio: ${tenant.name}`
      : 'Provision New Enterprise Brand';

    const slugInput = this.container.querySelector('#form-tenant-slug');
    slugInput.value = isEdit ? (tenant.slug || tenant.id) : '';
    slugInput.disabled = isEdit;

    this.container.querySelector('#form-tenant-name').value = isEdit ? (tenant.name || '') : '';
    this.container.querySelector('#form-tenant-name-ar').value = isEdit ? (tenant.nameAr || '') : '';
    this.container.querySelector('#form-tenant-subtitle').value = isEdit ? (tenant.corporateSubtitle || tenant.brand?.corporateSubtitle || '') : '';
    this.container.querySelector('#form-tenant-cr').value = isEdit ? (tenant.crNumber || tenant.brand?.crNumber || '') : '';
    this.container.querySelector('#form-tenant-tax').value = isEdit ? (tenant.taxNumber || tenant.brand?.taxNumber || '') : '';
    this.container.querySelector('#form-tenant-hotline').value = isEdit ? (tenant.brand?.supportHotline || '') : '';
    this.container.querySelector('#form-tenant-currency').value = isEdit ? (tenant.currency || tenant.brand?.currency || 'EGP') : 'EGP';
    this.container.querySelector('#form-tenant-auth-mode').value = isEdit ? (tenant.authMode || 'egyptian_national_id') : 'egyptian_national_id';

    const primaryColor = isEdit ? (tenant.brand?.primaryColor || '#0B63B4') : '#0B63B4';
    this.container.querySelector('#form-tenant-color-picker').value = primaryColor;
    this.container.querySelector('#form-tenant-color-hex').value = primaryColor;

    // Logo setup
    const logoUrl = isEdit ? (tenant.brand?.logoUrl || '') : '';
    this.container.querySelector('#form-tenant-logo-url').value = logoUrl;
    if (logoUrl) {
      const previewImg = this.container.querySelector('#logo-preview-img');
      const filenameEl = this.container.querySelector('#logo-filename');
      if (previewImg) previewImg.src = logoUrl;
      if (filenameEl) filenameEl.textContent = 'Current Logo';
      this.container.querySelector('#dropzone-prompt').style.display = 'none';
      this.container.querySelector('#dropzone-preview').style.display = 'flex';
    } else {
      this.clearLogo();
    }

    // Geofences & factory locations setup
    this.currentFactoryGeofences = [];
    if (isEdit) {
      if (Array.isArray(tenant.factoryGeofences) && tenant.factoryGeofences.length > 0) {
        this.currentFactoryGeofences = JSON.parse(JSON.stringify(tenant.factoryGeofences));
      } else if (Array.isArray(tenant.factoryLocations)) {
        this.currentFactoryGeofences = tenant.factoryLocations.map((loc, idx) => ({
          id: `zone_${idx}`,
          name: loc,
          lat: 30.0444 + (idx * 0.05),
          lng: 31.2357 + (idx * 0.05),
          radiusMeters: 800,
        }));
      }
    }
    this.renderFactoryChips();

    // Module toggles
    const feats = isEdit ? (tenant.features || {}) : {};
    this.container.querySelector('#feat-payroll').checked = feats.hasPayroll !== false;
    this.container.querySelector('#feat-vacations').checked = feats.hasVacations !== false;
    this.container.querySelector('#feat-shifts').checked = feats.hasShifts !== false;
    this.container.querySelector('#feat-buses').checked = feats.hasBuses !== false;
    this.container.querySelector('#feat-concerns').checked = feats.hasWhistleblower !== false;
    this.container.querySelector('#feat-surveys').checked = feats.hasSurveys !== false;
    this.container.querySelector('#feat-trips').checked = feats.hasSummerTrips !== false;
    this.container.querySelector('#feat-medical').checked = feats.hasMedicalNetwork !== false;

    this.updatePhoneMockup();
  }

  async handleSubmit(onSuccess) {
    const mode = this.container.querySelector('#form-tenant-mode').value;
    const slug = this.container.querySelector('#form-tenant-slug').value.trim().toLowerCase();
    const name = this.container.querySelector('#form-tenant-name').value.trim();
    const nameAr = this.container.querySelector('#form-tenant-name-ar').value.trim();
    const primaryColor = this.container.querySelector('#form-tenant-color-hex').value.trim();
    const hotline = this.container.querySelector('#form-tenant-hotline').value.trim();
    const authMode = this.container.querySelector('#form-tenant-auth-mode').value;
    const crNumber = this.container.querySelector('#form-tenant-cr').value.trim();
    const taxNumber = this.container.querySelector('#form-tenant-tax').value.trim();
    const corporateSubtitle = this.container.querySelector('#form-tenant-subtitle').value.trim();
    const currency = this.container.querySelector('#form-tenant-currency').value;
    let logoUrl = this.container.querySelector('#form-tenant-logo-url').value;

    // If an image file was dropped, upload it first
    if (this.uploadedLogoFile) {
      try {
        const uploadRes = await uploadApi.uploadFile(this.uploadedLogoFile);
        if (uploadRes && (uploadRes.url || uploadRes.filename)) {
          logoUrl = uploadRes.url || `/uploads/${uploadRes.filename}`;
        }
      } catch (err) {
        toast.error('Logo Upload Failed', err.message);
      }
    }

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

    const factoryLocations = this.currentFactoryGeofences.map((f) => f.name || f.nameAr);

    const payload = {
      slug,
      name,
      nameAr,
      crNumber,
      taxNumber,
      corporateSubtitle,
      currency,
      factoryLocations,
      factoryGeofences: this.currentFactoryGeofences,
      brand: {
        primaryColor,
        supportHotline: hotline || '19319',
        logoUrl: logoUrl || null,
        crNumber,
        taxNumber,
        corporateSubtitle,
        currency,
        factoryLocations,
      },
      features,
      authMode,
    };

    try {
      if (mode === 'create') {
        await superAdminApi.createTenant(payload);
        toast.success('Company Provisioned', `Tenant "${name}" successfully registered!`);
      } else {
        await superAdminApi.updateTenant(slug, payload);
        toast.success('Brand Studio Saved', `Tenant "${name}" configuration saved and broadcast live!`);
      }
      onSuccess();
      await this.loadTenants();
    } catch (err) {
      toast.error('Brand Studio Error', err.message);
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
        (t.crNumber || t.brand?.crNumber || '').toLowerCase().includes(q) ||
        (t.taxNumber || t.brand?.taxNumber || '').toLowerCase().includes(q) ||
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
      const initials = this.getBrandInitials(t.name);
      const isActive = t.status !== 'inactive';
      const employeeCount = t.employeeCount || 0;
      const crNumber = t.crNumber || t.brand?.crNumber || 'N/A';
      const taxNumber = t.taxNumber || t.brand?.taxNumber || 'N/A';
      const factoriesCount = (t.factoryLocations || t.brand?.factoryLocations || []).length;
      const activeFeats = Object.entries(t.features || {}).filter(([_, v]) => v).length;

      return `
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px;">
          <td style="padding: 12px 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 9px; background: ${brandColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.12);">
                ${initials}
              </div>
              <div>
                <div style="font-weight: 700; color: var(--navy-900); font-size: 13.5px;">${escapeHtml(t.name)}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(t.nameAr || '')}</div>
              </div>
            </div>
          </td>
          <td style="padding: 12px 16px;">
            <code style="background: var(--bg-subtle); padding: 3px 6px; border-radius: 4px; font-size: 11.5px; color: var(--primary); font-weight: 700;">
              ${escapeHtml(t.slug || t.id)}
            </code>
          </td>
          <td style="padding: 12px 16px;">
            <div style="font-weight: 600; font-size: 12px; color: var(--navy-800);">CR: ${escapeHtml(crNumber)}</div>
            <div style="font-size: 10.5px; color: var(--text-muted);">Tax: ${escapeHtml(taxNumber)}</div>
          </td>
          <td style="padding: 12px 16px;">
            <span class="badge" style="background: #E0E7FF; color: #4338CA; font-size: 11px;">
              ${activeFeats} Modules Active
            </span>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-weight: 600; font-size: 12px; color: var(--text-dark);">
              📍 ${factoriesCount} Complexes
            </span>
          </td>
          <td style="padding: 12px 16px; font-weight: 600;">
            ${employeeCount}
          </td>
          <td style="padding: 12px 16px;">
            <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}" style="font-size: 11px;">
              ${isActive ? 'Active' : 'Suspended'}
            </span>
          </td>
          <td style="padding: 12px 16px; text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-sm btn-edit-tenant" data-slug="${escapeHtml(t.slug || t.id)}">
                🎨 Brand Studio
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
