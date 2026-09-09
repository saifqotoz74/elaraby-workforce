// Concerns & Workplace Safety View
// Manages anonymous workplace health, safety, and compliance reports from employees.

import { concernsApi } from '../api/services.js';
import { toast } from '../components/Toast.js';

export class ConcernsView {
  constructor(container) {
    this.container = container;
    this.concerns = [];
    this.filterCategory = '';
  }

  async mount() {
    this.renderSkeleton();
    await this.loadConcerns();
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--navy-900); margin: 0 0 4px 0;">
            Workplace Concerns & Safety Reports
          </h2>
          <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
            Anonymous reports submitted by factory and office employees for compliance, safety, and ethics.
          </p>
        </div>

        <button type="button" class="btn btn-secondary" id="btn-refresh-concerns">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Refresh
        </button>
      </div>

      <div class="toolbar-container">
        <div class="toolbar-left">
          <select id="concern-category-filter" class="form-select" style="min-width: 220px;">
            <option value="">All Categories</option>
            <option value="Safety">Safety & Hazards</option>
            <option value="Health">Occupational Health</option>
            <option value="Ethics">Ethics & Compliance</option>
            <option value="Harassment">Workplace Environment</option>
            <option value="Facilities">Facilities & Equipment</option>
            <option value="Other">Other Issues</option>
          </select>
        </div>

        <div class="toolbar-right">
          <span id="concerns-counter" class="badge badge-neutral">0 Reports</span>
        </div>
      </div>

      <div id="concerns-list-container">
        <!-- Injected cards -->
      </div>
    `;

    this.container.querySelector('#btn-refresh-concerns').addEventListener('click', () => {
      this.loadConcerns();
    });

    this.container.querySelector('#concern-category-filter').addEventListener('change', (e) => {
      this.filterCategory = e.target.value.toLowerCase();
      this.renderCards();
    });
  }

  async loadConcerns() {
    const listWrap = this.container.querySelector('#concerns-list-container');
    if (!listWrap) return;

    listWrap.innerHTML = `
      <div style="text-align: center; padding: 48px; color: var(--text-muted);">
        Loading anonymous reports...
      </div>
    `;

    try {
      const res = await concernsApi.list();
      this.concerns = res.concerns || [];
      this.renderCards();
    } catch (err) {
      toast.error('Failed to load concerns', err.message);
      listWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title" style="color: var(--status-red);">Error Loading Concerns</div>
          <div class="empty-state-sub">${err.message}</div>
        </div>
      `;
    }
  }

  renderCards() {
    const listWrap = this.container.querySelector('#concerns-list-container');
    const counter = this.container.querySelector('#concerns-counter');
    if (!listWrap) return;

    let filtered = this.concerns;
    if (this.filterCategory) {
      filtered = filtered.filter((c) =>
        (c.category || '').toLowerCase().includes(this.filterCategory)
      );
    }

    if (counter) {
      counter.innerText = `${filtered.length} Reports`;
    }

    if (filtered.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <div class="empty-state-title">No Concerns Reported</div>
          <div class="empty-state-sub">No safety or compliance reports found matching your criteria.</div>
        </div>
      `;
      return;
    }

    listWrap.innerHTML = filtered.map((c) => {
      const dateStr = c.createdAt
        ? new Date(c.createdAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Unknown date';

      return `
        <div class="concern-card">
          <div class="concern-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="concern-ref">${c.refNumber || c.id}</span>
              <span class="badge badge-warning">${c.category || 'General'}</span>
              <span class="badge badge-info">Anonymous Submission</span>
            </div>
            <div class="concern-meta">
              🕒 ${dateStr}
            </div>
          </div>

          <div class="concern-body">${c.details || 'No details provided.'}</div>

          ${c.attachedPhoto ? `
            <div>
              <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Attached Photo Evidence:</div>
              <a href="${c.attachedPhoto}" target="_blank" rel="noopener noreferrer">
                <img src="${c.attachedPhoto}" class="concern-photo-preview" alt="Concern Attachment" />
              </a>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
