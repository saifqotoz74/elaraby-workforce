// Settings & System Health View
// Displays admin profile, role permissions, factory scope isolation, and server operational status.

import { store } from '../state/store.js';
import { authApi } from '../api/services.js';
import { toast } from '../components/Toast.js';
import { confirmDialog } from '../components/ConfirmDialog.js';

export class SettingsView {
  constructor(container) {
    this.container = container;
  }

  async mount() {
    this.render();
  }

  render() {
    const user = store.getUser() || {};
    const permissions = user.permissions || [];
    const role = user.role || 'GUEST';
    const factoryScope = user.factoryScope || user.factory || 'Global (All Facilities)';
    const isRealtime = store.state.realtimeConnected;

    this.container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--navy-900); margin: 0 0 4px 0;">
            Administration & Security Settings
          </h2>
          <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
            Account profile, role-based permissions matrix, factory scope isolation, and platform status.
          </p>
        </div>

        <button type="button" class="btn btn-danger" id="btn-settings-logout">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Sign Out of Session
        </button>
      </div>

      <div class="settings-grid">
        <!-- Account Card -->
        <div class="settings-card">
          <div class="settings-card-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Administrator Profile
          </div>

          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
            <div class="user-avatar" style="width: 54px; height: 54px; font-size: 20px;">
              ${(user.username || 'A')[0].toUpperCase()}
            </div>
            <div>
              <div style="font-size: 16px; font-weight: 700; color: var(--navy-900);">
                ${user.username || 'Admin User'}
              </div>
              <div style="font-size: 13px; color: var(--text-muted);">
                Role: <span class="badge badge-info" style="margin-left: 4px;">${role}</span>
              </div>
            </div>
          </div>

          <div style="border-top: 1px solid var(--border-light); padding-top: 16px;">
            <div style="font-size: 12.5px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Factory Jurisdiction Scope:</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--navy-900);">
              🏭 ${factoryScope}
            </div>
            <div style="font-size: 12px; color: var(--text-light); margin-top: 4px;">
              ${factoryScope.includes('Global') ? 'You have enterprise-wide clearance across all manufacturing plants.' : 'Mutations and reads are strictly restricted to your assigned facility.'}
            </div>
          </div>
        </div>

        <!-- System Health Card -->
        <div class="settings-card">
          <div class="settings-card-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--status-green);">
              <activity stroke="currentColor"></activity>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            System Status & Bridge
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13.5px; font-weight: 600;">Realtime SSE Stream:</span>
              <span class="badge ${isRealtime ? 'badge-success' : 'badge-warning'}">
                <span class="badge-dot"></span>
                ${isRealtime ? 'Connected (Active Push)' : 'Disconnected (Retrying)'}
              </span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13.5px; font-weight: 600;">CSRF Cookie Guard:</span>
              <span class="badge badge-success">Active (Strict SameSite)</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13.5px; font-weight: 600;">Mobile Realtime Sync:</span>
              <span class="badge badge-success">Bridge Enabled</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13.5px; font-weight: 600;">File Storage:</span>
              <span class="badge badge-neutral">Streaming Multipart (6MB)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Permissions Breakdown -->
      <div class="settings-card" style="margin-top: 20px;">
        <div class="settings-card-title">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--navy-900);">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Active Role Capabilities & Permissions
        </div>

        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
          The following cryptographic permissions are granted to your authenticated session:
        </p>

        <div class="perm-tag-cloud">
          ${permissions.length > 0 ? permissions.map((p) => `
            <span class="perm-tag">✓ ${p}</span>
          `).join('') : '<span style="color: var(--text-muted); font-size: 13px;">No explicit permissions listed (Session might be unauthenticated).</span>'}
        </div>
      </div>
    `;

    // Logout handler
    this.container.querySelector('#btn-settings-logout').addEventListener('click', async () => {
      const confirmed = await confirmDialog.confirm({
        title: 'Sign Out?',
        message: 'Are you sure you want to end your administrative session?',
        confirmText: 'Sign Out',
        danger: false,
      });

      if (confirmed) {
        try {
          await authApi.logout();
        } catch (_) {}
        store.clearUser();
        window.location.hash = '/login';
      }
    });
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
