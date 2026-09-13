// Concerns & Workplace Safety View
// Manages anonymous workplace health, safety, and compliance reports from employees.

import { concernsApi } from '../api/services.js';
import { toast } from '../components/Toast.js';
import { Modal } from '../components/Modal.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';

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
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            Workplace Concerns & Safety Reports / البلاغات والسلامة المهنية
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
          Refresh Reports
        </button>
      </div>

      <div class="card" style="margin-bottom: 24px; padding: 16px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="concern-category-pills">
            <button type="button" class="btn btn-sm btn-primary category-pill" data-cat="">All Reports</button>
            <button type="button" class="btn btn-sm btn-secondary category-pill" data-cat="safety">🚨 Safety & Hazards</button>
            <button type="button" class="btn btn-sm btn-secondary category-pill" data-cat="health">🏥 Health & Medical</button>
            <button type="button" class="btn btn-sm btn-secondary category-pill" data-cat="ethics">⚖️ Ethics & Compliance</button>
            <button type="button" class="btn btn-sm btn-secondary category-pill" data-cat="facilities">🏭 Facilities</button>
            <button type="button" class="btn btn-sm btn-secondary category-pill" data-cat="harassment">👥 Workplace Environment</button>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge badge-success">🔒 100% Encrypted & Anonymous</span>
            <span id="concerns-counter" class="badge badge-neutral">0 Reports</span>
          </div>
        </div>
      </div>

      <div id="concerns-list-container">
        <!-- Injected cards -->
      </div>
    `;

    this.container.querySelector('#btn-refresh-concerns').addEventListener('click', () => {
      this.loadConcerns();
    });

    const pills = this.container.querySelectorAll('.category-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.className = 'btn btn-sm btn-secondary category-pill');
        pill.className = 'btn btn-sm btn-primary category-pill';
        this.filterCategory = pill.dataset.cat;
        this.renderCards();
      });
    });
  }

  async loadConcerns() {
    const listWrap = this.container.querySelector('#concerns-list-container');
    if (!listWrap) return;

    listWrap.innerHTML = `
      <div style="text-align: center; padding: 48px; color: var(--text-muted);">
        <div class="animate-spin" style="width: 28px; height: 28px; border: 2px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%; margin: 0 auto 12px;"></div>
        Loading anonymous safety reports...
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

      const safePhoto = sanitizeUrl(c.attachedPhoto);
      const catLower = (c.category || '').toLowerCase();
      
      let badgeClass = 'badge-info';
      if (catLower.includes('safety') || catLower.includes('hazard')) badgeClass = 'badge-danger';
      else if (catLower.includes('health')) badgeClass = 'badge-warning';
      else if (catLower.includes('ethics')) badgeClass = 'badge-primary';

      return `
        <div class="concern-card animate-fade-in">
          <div class="concern-header">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span class="concern-ref" title="Case Reference">${escapeHtml(c.refNumber || c.id)}</span>
              <span class="badge ${badgeClass}">${escapeHtml(c.category || 'General')}</span>
              <span class="badge badge-neutral">🔒 Anonymous Worker</span>
            </div>
            <div class="concern-meta">
              🕒 ${escapeHtml(dateStr)}
            </div>
          </div>

          <div class="concern-body">${escapeHtml(c.details || 'No details provided.')}</div>

          ${safePhoto ? `
            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-light);">
              <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span>📷 Attached Evidence Photo (Click to Enlarge):</span>
              </div>
              <img src="${safePhoto}" class="concern-photo-preview concern-photo-lightbox" data-src="${safePhoto}" alt="Concern Attachment" />
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Lightbox modal on photo click
    listWrap.querySelectorAll('.concern-photo-lightbox').forEach(img => {
      img.addEventListener('click', () => {
        const fullSrc = img.dataset.src;
        this.openLightbox(fullSrc);
      });
    });
  }

  openLightbox(photoUrl) {
    const modal = new Modal({
      title: 'Evidence Photo Viewer / فحص الصورة المرفقة',
      wide: true,
      content: `
        <div style="text-align: center; background: #0B1120; border-radius: var(--radius-md); padding: 16px; overflow: hidden;">
          <img src="${photoUrl}" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" alt="Evidence Fullscreen" />
        </div>
        <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; color: var(--text-muted);">Confidential Investigation Record</span>
          <a href="${photoUrl}" target="_blank" download class="btn btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Download High-Res</span>
          </a>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-primary" id="btn-close-lightbox">Close Viewer</button>
      `,
    });

    modal.open();
    modal.element.querySelector('#btn-close-lightbox').addEventListener('click', () => modal.close());
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
