// Login View Component
// Secure cookie session login with credential validation and role selection

import { authApi } from '../api/services.js';
import { store } from '../state/store.js';

export class LoginView {
  constructor(containerOrOpts, opts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
      this.onSuccess = opts?.onSuccess;
    } else {
      this.container = null;
      this.onSuccess = containerOrOpts?.onSuccess;
    }
    this.element = null;
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
    this.element.className = 'login-view-container';

    this.element.innerHTML = `
      <div class="login-card-window">
        <div class="login-header-logo">
          <div class="login-logo-badge">EC</div>
          <div>
            <h1 style="font-size: 20px; font-weight: 700; color: var(--navy-900);">Elaraby Connect</h1>
            <p style="font-size: 13px; color: var(--text-muted);">Enterprise HR Administration</p>
          </div>
        </div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-username">Admin Username</label>
            <input type="text" id="login-username" class="form-input" value="admin" required autocomplete="username" />
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password" />
          </div>

          <div class="form-group">
            <label class="form-label" for="login-role">Operational Role (Mock / RBAC Test)</label>
            <select id="login-role" class="form-select">
              <option value="superadmin">Super Admin (Unrestricted)</option>
              <option value="hr_officer">HR Officer (Employees, Leaves & Operations)</option>
              <option value="payroll_officer">Payroll Officer (Salaries & Statements)</option>
              <option value="shift_supervisor">Shift Supervisor (Rosters & Work Schedules)</option>
              <option value="announcement_manager">Announcement Manager (Content & Broadcasts)</option>
              <option value="auditor">Internal Auditor (Compliance & Logs)</option>
            </select>
          </div>

          <div class="form-error" id="login-error" style="display: none; margin-bottom: 14px;"></div>

          <button type="submit" class="btn btn-primary" id="login-submit-btn" style="width: 100%; padding: 12px;">
            <span>Sign In to Dashboard</span>
          </button>
        </form>
      </div>
    `;

    const form = this.element.querySelector('#login-form');
    const errEl = this.element.querySelector('#login-error');
    const submitBtn = this.element.querySelector('#login-submit-btn');

    form.onsubmit = async (e) => {
      e.preventDefault();
      errEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <div class="animate-spin" style="width: 16px; height: 16px; border: 2px solid #FFFFFF; border-top-color: transparent; border-radius: 50%;"></div>
        <span>Authenticating...</span>
      `;

      const username = form.querySelector('#login-username').value.trim();
      const password = form.querySelector('#login-password').value;
      const role = form.querySelector('#login-role').value;

      try {
        const result = await authApi.login({ username, password, role });
        // Store CSRF token globally for quick access
        window.__CSRF_TOKEN__ = result.csrfToken;

        store.setUser({
          sub: username,
          role: result.role,
          scopeFactory: result.scopeFactory,
          scopeDepartment: result.scopeDepartment,
        });

        if (this.onSuccess) this.onSuccess();
      } catch (err) {
        errEl.textContent = err.data?.error === 'invalid_credentials' ? 'Invalid admin credentials.' : (err.message || 'Login failed.');
        errEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In to Dashboard</span>`;
      }
    };

    return this.element;
  }
}
