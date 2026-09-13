// Audit Logs & Compliance Trail View
// Displays immutable audit history with before/after state diff inspection and filtering.

import { auditApi } from '../api/services.js';
import { toast } from '../components/Toast.js';
import { Modal } from '../components/Modal.js';
import { Pagination } from '../components/Pagination.js';
import { ExportService } from '../services/exportService.js';
import { escapeHtml } from '../utils/sanitize.js';

export class AuditView {
  constructor(container) {
    this.container = container;
    this.logs = [];
    this.total = 0;
    this.currentPage = 1;
    this.pageSize = 20;
    this.filterAction = '';
    this.filterActor = '';
    this.paginationComponent = null;
  }

  async mount() {
    this.renderSkeleton();
    await this.loadLogs();
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            Security Audit Trail & Compliance
          </h2>
          <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
            Tamper-evident logs of administrative actions, balance adjustments, and system mutations.
          </p>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <button type="button" class="btn btn-secondary" id="btn-export-audit">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Log
          </button>
          <button type="button" class="btn btn-secondary" id="btn-refresh-audit">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Refresh Log
          </button>
        </div>
      </div>

      <div class="toolbar-container">
        <div class="toolbar-left">
          <input type="text" id="audit-actor-input" class="form-input" placeholder="Filter by Actor / Username..." style="min-width: 220px;" />

          <select id="audit-action-filter" class="form-select" style="min-width: 200px;">
            <option value="">All Actions</option>
            <option value="admin_login">Admin Login</option>
            <option value="create_employee">Create Employee</option>
            <option value="update_employee">Update Employee</option>
            <option value="toggle_employee_active">Toggle Status</option>
            <option value="approve_request">Approve Leave</option>
            <option value="reject_request">Reject Leave</option>
            <option value="update_payroll">Update Payroll</option>
            <option value="update_roster">Update Roster</option>
            <option value="create_announcements">Create Announcement</option>
            <option value="delete_announcements">Delete Announcement</option>
          </select>
        </div>

        <div class="toolbar-right">
          <span id="audit-total-badge" class="badge badge-neutral">0 Entries</span>
        </div>
      </div>

      <div class="table-container">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 170px;">Timestamp</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity / Target</th>
                <th>Details</th>
                <th style="text-align: right;">Inspect</th>
              </tr>
            </thead>
            <tbody id="audit-table-body">
              <!-- Logs injected here -->
            </tbody>
          </table>
        </div>
        <div id="audit-pagination-container"></div>
      </div>
    `;

    this.container.querySelector('#btn-refresh-audit').addEventListener('click', () => {
      this.currentPage = 1;
      this.loadLogs();
    });

    const exportBtn = this.container.querySelector('#btn-export-audit');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          exportBtn.disabled = true;
          exportBtn.innerText = 'Exporting...';
          const params = { page: 1, limit: 1000 };
          if (this.filterAction) params.action = this.filterAction;
          if (this.filterActor) params.actor = this.filterActor;
          const res = await auditApi.list(params);
          const logs = res.logs || res.auditLogs || [];

          ExportService.exportToCsv('Elaraby_Security_Audit_Trail', [
            { key: 'timestamp', label: 'Timestamp / الوقت', formatter: (val) => new Date(val).toISOString() },
            { key: 'actor', label: 'Actor / المستخدم' },
            { key: 'role', label: 'Role / الصلاحية' },
            { key: 'action', label: 'Action / الإجراء' },
            { key: 'target', label: 'Target / الهدف', formatter: (val, r) => val || r.entityId || '—' },
            { key: 'details', label: 'Details / التفاصيل' },
            { key: 'ip', label: 'IP Address' },
            { key: 'userAgent', label: 'User Agent' }
          ], logs);

          toast.success('Export Completed', `Successfully exported ${logs.length} audit records.`);
        } catch (err) {
          toast.error('Export Failed', err.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Log
          `;
        }
      });
    }

    this.container.querySelector('#audit-actor-input').addEventListener('change', (e) => {
      this.filterActor = e.target.value.trim();
      this.currentPage = 1;
      this.loadLogs();
    });

    this.container.querySelector('#audit-action-filter').addEventListener('change', (e) => {
      this.filterAction = e.target.value;
      this.currentPage = 1;
      this.loadLogs();
    });
  }

  async loadLogs() {
    const tbody = this.container.querySelector('#audit-table-body');
    const badge = this.container.querySelector('#audit-total-badge');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);">
          Loading audit trail records...
        </td>
      </tr>
    `;

    try {
      const params = {
        page: this.currentPage,
        limit: this.pageSize,
      };
      if (this.filterAction) params.action = this.filterAction;
      if (this.filterActor) params.actor = this.filterActor;

      const res = await auditApi.list(params);
      this.logs = res.logs || res.auditLogs || [];
      this.total = res.total || 0;

      if (badge) badge.innerText = `${this.total} Total Entries`;
      this.renderTable();
      this.renderPagination(res.totalPages || 1);
    } catch (err) {
      toast.error('Failed to load audit logs', err.message);
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px; color: var(--status-red);">
            Error loading audit trail: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  renderTable() {
    const tbody = this.container.querySelector('#audit-table-body');
    if (!tbody) return;

    if (this.logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px; color: var(--text-muted);">
            No audit log records match the selected filter.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.logs.map((log) => {
      const dateStr = log.timestamp
        ? new Date(log.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '—';

      const actionBadgeClass = log.action.includes('delete') || log.action.includes('reject')
        ? 'badge-danger'
        : log.action.includes('create') || log.action.includes('approve')
        ? 'badge-success'
        : 'badge-info';

      return `
        <tr>
          <td style="font-family: monospace; font-size: 11.5px; color: var(--text-muted);">
            ${escapeHtml(dateStr)}
          </td>
          <td>
            <b>${escapeHtml(log.actor || 'system')}</b>
          </td>
          <td>
            <span class="badge badge-neutral" style="font-size: 11px;">${escapeHtml(log.role || '—')}</span>
          </td>
          <td>
            <span class="badge ${actionBadgeClass}">${escapeHtml(log.action)}</span>
          </td>
          <td style="font-family: monospace; font-size: 12px;">
            ${escapeHtml(log.entity || '—')} ${log.entityId ? `#${escapeHtml(log.entityId)}` : ''}
          </td>
          <td style="font-size: 12.5px; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(log.details || '—')}
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-secondary btn-sm btn-inspect-log" data-log-id="${escapeHtml(log.id)}">
              Inspect
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-inspect-log').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.logId;
        const entry = this.logs.find((l) => l.id === id);
        if (entry) this.openDetailModal(entry);
      });
    });
  }

  renderPagination(totalPages) {
    const container = this.container.querySelector('#audit-pagination-container');
    if (!container) return;

    this.paginationComponent = new Pagination(container, {
      currentPage: this.currentPage,
      totalPages: totalPages,
      totalItems: this.total,
      pageSize: this.pageSize,
      onPageChange: (newPage) => {
        this.currentPage = newPage;
        this.loadLogs();
      },
    });
    this.paginationComponent.render();
  }

  openDetailModal(entry) {
    const modal = new Modal({
      title: `Audit Entry: ${escapeHtml(entry.action)} (${escapeHtml(entry.id)})`,
      wide: true,
      content: `
        <div style="margin-bottom: 16px; display: flex; gap: 20px; font-size: 13px; flex-wrap: wrap;">
          <div><b>Actor:</b> ${escapeHtml(entry.actor)} (${escapeHtml(entry.role || 'Unknown')})</div>
          <div><b>Timestamp:</b> ${escapeHtml(new Date(entry.timestamp).toISOString())}</div>
          <div><b>IP Address:</b> <code>${escapeHtml(entry.ip || '—')}</code></div>
          <div><b>User Agent:</b> <span style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(entry.userAgent || '—')}</span></div>
        </div>

        <div style="margin-bottom: 14px; font-size: 13.5px;">
          <b>Audit Description:</b> <span>${escapeHtml(entry.details || 'No description recorded.')}</span>
        </div>

        <div class="audit-diff-grid">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--status-amber); margin-bottom: 6px;">BEFORE STATE:</div>
            <pre class="audit-details-code">${escapeHtml(entry.before ? JSON.stringify(entry.before, null, 2) : 'null (None / Initial Creation)')}</pre>
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--status-green); margin-bottom: 6px;">AFTER STATE:</div>
            <pre class="audit-details-code">${escapeHtml(entry.after ? JSON.stringify(entry.after, null, 2) : 'null (Deleted)')}</pre>
          </div>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-secondary" id="btn-close-audit-modal">Close</button>
      `,
    });

    modal.open();
    modal.element.querySelector('#btn-close-audit-modal').addEventListener('click', () => modal.close());
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
