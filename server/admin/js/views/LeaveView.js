// Leave & Requests View Component
// Comprehensive requests management with approval workflows, prompt dialogs for reasons, and realtime sync.

import { leaveApi } from '../api/services.js';
import { DataTable } from '../components/DataTable.js';
import { renderPagination } from '../components/Pagination.js';
import { confirmDialog, promptDialog } from '../components/ConfirmDialog.js';
import { createStatusBadge } from '../components/StatusBadge.js';
import { toast } from '../components/Toast.js';
import { ExportService } from '../services/exportService.js';
import { escapeHtml } from '../utils/sanitize.js';

export class LeaveView {
  constructor(containerOrOpts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
    } else {
      this.container = null;
    }
    this.element = null;
    this.page = 1;
    this.limit = 15;
    this.statusFilter = '';
    this.typeFilter = '';
    this.table = null;
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
          <h2 style="font-size: 20px; font-weight: 700; color: var(--text-main);">Leave & Exception Requests</h2>
          <p style="font-size: 13px; color: var(--text-muted);">Review, approve, or reject employee annual leaves, sick leaves, and mission requests.</p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="btn btn-secondary btn-sm" id="btn-export-leave">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export to Excel</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-leave">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="toolbar-container" style="margin-bottom: 14px;">
        <div class="toolbar-left">
          <select class="form-select" id="leave-status-filter" style="width: 170px;">
            <option value="">All Statuses</option>
            <option value="inReview" selected>In Review (Pending)</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select class="form-select" id="leave-type-filter" style="width: 170px;">
            <option value="">All Request Types</option>
            <option value="Leave">Annual Leave</option>
            <option value="Sick Leave">Sick Leave</option>
            <option value="Mission">Mission</option>
          </select>
        </div>
      </div>

      <!-- Table Wrapper -->
      <div id="leave-table-wrapper"></div>
      <div id="leave-pagination-wrapper"></div>
    `;

    this.table = new DataTable({
      columns: [
        {
          header: 'Employee',
          render: (r) => `
            <div>
              <b style="color: var(--navy-900); display: block;">${escapeHtml(r.employeeName || '—')}</b>
              <small style="color: var(--text-muted); font-size: 11px;">${escapeHtml(r.employeeCode || r.employeeId)}</small>
            </div>
          `,
        },
        {
          header: 'Type',
          render: (r) => `<span class="badge badge-neutral">${escapeHtml(r.type || 'Leave')}</span>`,
        },
        {
          header: 'Title / Reason',
          render: (r) => `
            <div>
              <span style="font-weight: 600;">${escapeHtml(r.title || 'Leave Request')}</span>
              ${r.decisionReason ? `<small style="display: block; color: var(--status-red); font-size: 11px;">Note: ${escapeHtml(r.decisionReason)}</small>` : ''}
            </div>
          `,
        },
        {
          header: 'Duration',
          render: (r) => {
            const days = r.details?.days ?? r.days ?? 1;
            return `<b>${days}</b> <small style="color: var(--text-muted);">day${days > 1 ? 's' : ''}</small>`;
          },
        },
        {
          header: 'Date Submitted',
          render: (r) => {
            const d = new Date(r.createdAt || Date.now());
            return `<small style="color: var(--text-muted);">${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small>`;
          },
        },
        {
          header: 'Status',
          render: (r) => createStatusBadge(r.status),
        },
        {
          header: 'Actions',
          render: (r) => {
            if (r.status !== 'inReview') {
              return `<small style="color: var(--text-light); font-size: 12px;">Decided by ${r.decidedBy || 'HR'}</small>`;
            }

            const wrap = document.createElement('div');
            wrap.className = 'table-actions';

            const approveBtn = document.createElement('button');
            approveBtn.className = 'btn btn-success btn-sm';
            approveBtn.textContent = 'Approve';
            approveBtn.onclick = () => this.handleApprove(r);

            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'btn btn-danger btn-sm';
            rejectBtn.textContent = 'Reject';
            rejectBtn.onclick = () => this.handleReject(r);

            wrap.appendChild(approveBtn);
            wrap.appendChild(rejectBtn);
            return wrap;
          },
        },
      ],
      emptyMessage: 'No leave requests matching the selected criteria.',
    });

    this.element.querySelector('#leave-table-wrapper').appendChild(this.table.render());

    // Filter Listeners
    this.statusFilter = 'inReview';
    const statusSelect = this.element.querySelector('#leave-status-filter');
    statusSelect.onchange = (e) => {
      this.statusFilter = e.target.value;
      this.page = 1;
      this.loadRequests();
    };

    const typeSelect = this.element.querySelector('#leave-type-filter');
    typeSelect.onchange = (e) => {
      this.typeFilter = e.target.value;
      this.page = 1;
      this.loadRequests();
    };

    const exportBtn = this.element.querySelector('#btn-export-leave');
    if (exportBtn) {
      exportBtn.onclick = async () => {
        try {
          exportBtn.disabled = true;
          exportBtn.querySelector('span').textContent = 'Exporting...';
          const res = await leaveApi.list({ limit: 1000, status: this.statusFilter, type: this.typeFilter });
          const requests = res.requests || [];
          ExportService.exportToCsv('Elaraby_Leave_Requests', [
            { key: 'id', label: 'Request ID / رقم الطلب' },
            { key: 'employeeName', label: 'Employee Name / اسم الموظف' },
            { key: 'employeeCode', label: 'Employee Code / كود الموظف' },
            { key: 'type', label: 'Type / النوع' },
            { key: 'title', label: 'Title & Details / التفاصيل' },
            { key: 'requestedDays', label: 'Days / عدد الأيام', formatter: (val, r) => val || r.days || 1 },
            { key: 'status', label: 'Status / الحالة' },
            { key: 'decisionReason', label: 'Rejection Reason / سبب الرفض' },
            { key: 'createdAt', label: 'Created At / تاريخ التقديم', formatter: (val) => val ? new Date(val).toLocaleString('ar-EG') : '—' },
            { key: 'decidedAt', label: 'Decision Date / تاريخ القرار', formatter: (val) => val ? new Date(val).toLocaleString('ar-EG') : '—' }
          ], requests);
          toast.success('Export Completed', `Successfully exported ${requests.length} records.`);
        } catch (err) {
          toast.error('Export Failed', err.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.querySelector('span').textContent = 'Export to Excel';
        }
      };
    }

    this.element.querySelector('#btn-refresh-leave').onclick = () => this.loadRequests();

    // Realtime Events
    this.refreshHandler = () => this.loadRequests();
    window.addEventListener('realtime:leave.request.created', this.refreshHandler);
    window.addEventListener('realtime:leave.request.approved', this.refreshHandler);
    window.addEventListener('realtime:leave.request.rejected', this.refreshHandler);

    this.loadRequests();
    return this.element;
  }

  async loadRequests() {
    this.table.update([], true);
    try {
      const res = await leaveApi.list({
        page: this.page,
        limit: this.limit,
        status: this.statusFilter,
        type: this.typeFilter,
      });

      const list = res.requests || [];
      this.table.update(list, false);

      const pagWrapper = this.element.querySelector('#leave-pagination-wrapper');
      pagWrapper.innerHTML = '';
      if (res.totalPages > 1) {
        const pag = renderPagination({
          page: res.page,
          totalPages: res.totalPages,
          total: res.total,
          onPageChange: (p) => {
            this.page = p;
            this.loadRequests();
          },
        });
        if (pag) pagWrapper.appendChild(pag);
      }
    } catch (err) {
      toast.error('Failed to load requests', err.message);
    }
  }

  async handleApprove(req) {
    const confirmed = await confirmDialog({
      title: 'Approve Request?',
      message: `Are you sure you want to approve <b>${req.title}</b> for employee <b>${req.employeeName}</b>?`,
      confirmText: 'Approve Leave',
    });

    if (confirmed) {
      try {
        await leaveApi.decide(req.id, { status: 'approved' });
        toast.success('Approved', `Request approved successfully.`);
        this.loadRequests();
      } catch (err) {
        toast.error('Approval Failed', err.message);
      }
    }
  }

  async handleReject(req) {
    const reason = await promptDialog({
      title: 'Reject Request',
      message: `Specify reason for rejecting <b>${req.title}</b> (the employee's vacation balance will be refunded if applicable):`,
      placeholder: 'e.g. Operational conflict, insufficient staffing',
      confirmText: 'Reject Leave',
      required: true,
    });

    if (reason !== null) {
      try {
        await leaveApi.decide(req.id, { status: 'rejected', reason });
        toast.warning('Rejected', `Request rejected and balance refunded if applicable.`);
        this.loadRequests();
      } catch (err) {
        toast.error('Rejection Failed', err.message);
      }
    }
  }

  destroy() {
    if (this.refreshHandler) {
      window.removeEventListener('realtime:leave.request.created', this.refreshHandler);
      window.removeEventListener('realtime:leave.request.approved', this.refreshHandler);
      window.removeEventListener('realtime:leave.request.rejected', this.refreshHandler);
    }
  }
}
