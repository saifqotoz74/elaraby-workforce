// Announcements & Content View
// Manages Announcements, News, Benefits, and Trips with image uploads, realtime sync, and tabbed navigation.

import { contentApi, uploadApi } from '../api/services.js';
import { store } from '../state/store.js';
import { toast } from '../components/Toast.js';
import { Modal } from '../components/Modal.js';
import { confirmDialog } from '../components/ConfirmDialog.js';

export class AnnouncementsView {
  constructor(container) {
    this.container = container;
    this.activeTab = 'announcements'; // 'announcements' | 'news' | 'benefits' | 'trips'
    this.items = [];
    this.isLoading = false;

    this.onRealtimeCreate = (e) => {
      if (this.activeTab === 'announcements') {
        this.loadContent();
      }
    };
    this.onRealtimeDelete = (e) => {
      if (this.activeTab === 'announcements') {
        this.loadContent();
      }
    };
  }

  async mount() {
    this.renderSkeleton();
    window.addEventListener('realtime:announcement.created', this.onRealtimeCreate);
    window.addEventListener('realtime:announcement.deleted', this.onRealtimeDelete);
    await this.loadContent();
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--navy-900); margin: 0 0 4px 0;">
            Broadcasts & Corporate Content
          </h2>
          <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
            Publish company-wide announcements, news articles, employee benefits, and social trips.
          </p>
        </div>

        <button type="button" class="btn btn-primary" id="btn-create-content">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span id="create-btn-label">New Announcement</span>
        </button>
      </div>

      <div class="tabs-nav">
        <button type="button" class="tab-btn active" data-tab="announcements">
          📢 Announcements
        </button>
        <button type="button" class="tab-btn" data-tab="news">
          📰 Company News
        </button>
        <button type="button" class="tab-btn" data-tab="benefits">
          🎁 Benefits & Perks
        </button>
        <button type="button" class="tab-btn" data-tab="trips">
          🚌 Trips & Activities
        </button>
      </div>

      <div id="content-list-container">
        <!-- Dynamic list / table injected here -->
      </div>
    `;

    // Tab clicks
    const tabs = this.container.querySelectorAll('.tab-btn');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = tab.dataset.tab;
        this.updateCreateButtonLabel();
        this.loadContent();
      });
    });

    // Create button
    this.container.querySelector('#btn-create-content').addEventListener('click', () => {
      this.openCreateModal();
    });
  }

  updateCreateButtonLabel() {
    const label = this.container.querySelector('#create-btn-label');
    if (!label) return;
    const map = {
      announcements: 'New Announcement',
      news: 'New News Item',
      benefits: 'New Benefit',
      trips: 'New Trip',
    };
    label.innerText = map[this.activeTab] || 'Create Item';
  }

  async loadContent() {
    const listWrap = this.container.querySelector('#content-list-container');
    if (!listWrap) return;

    listWrap.innerHTML = `
      <div style="text-align: center; padding: 48px; color: var(--text-muted);">
        Loading ${this.activeTab}...
      </div>
    `;

    try {
      let res;
      if (this.activeTab === 'announcements') res = await contentApi.listAnnouncements();
      else if (this.activeTab === 'news') res = await contentApi.listNews();
      else if (this.activeTab === 'benefits') res = await contentApi.listBenefits();
      else if (this.activeTab === 'trips') res = await contentApi.listTrips();

      this.items = res?.items || (Array.isArray(res) ? res : []);
      this.renderItems();
    } catch (err) {
      toast.error('Failed to load content', err.message);
      listWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title" style="color: var(--status-red);">Error Loading Items</div>
          <div class="empty-state-sub">${err.message}</div>
        </div>
      `;
    }
  }

  renderItems() {
    const listWrap = this.container.querySelector('#content-list-container');
    if (!listWrap) return;

    if (!this.items || this.items.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <div class="empty-state-title">No ${this.activeTab} found</div>
          <div class="empty-state-sub">Use the button above to publish your first ${this.activeTab.slice(0, -1)}.</div>
        </div>
      `;
      return;
    }

    listWrap.innerHTML = `
      <div class="table-container">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 70px;">Media</th>
                <th>Title / Details</th>
                <th>Category / Date</th>
                ${this.activeTab === 'trips' ? '<th>Seats / Cost</th>' : ''}
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.items.map((item) => `
                <tr data-id="${item.id}">
                  <td>
                    ${item.imageUrl ? `
                      <img src="${item.imageUrl}" style="width: 48px; height: 38px; border-radius: 4px; object-fit: cover; border: 1px solid var(--border-light);" alt="Preview">
                    ` : `
                      <div style="width: 48px; height: 38px; border-radius: 4px; background-color: var(--surface-subtle); display: flex; align-items: center; justify-content: center; color: var(--text-light); font-size: 11px;">
                        No Pic
                      </div>
                    `}
                  </td>
                  <td>
                    <div style="font-weight: 700; color: var(--navy-900); font-size: 14px; margin-bottom: 2px;">
                      ${item.title || item.name || 'Untitled'}
                    </div>
                    <div style="font-size: 12.5px; color: var(--text-muted); max-width: 480px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${item.body || item.description || item.subtitle || '—'}
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 12px; font-weight: 600; color: #475569;">
                      ${item.important ? '<span class="badge badge-warning" style="margin-right: 6px;">Urgent</span>' : ''}
                      ${item.category || item.tag || 'General'}
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-light); margin-top: 2px;">
                      ${item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </div>
                  </td>
                  ${this.activeTab === 'trips' ? `
                    <td>
                      <span class="badge badge-info">💺 ${item.bookedSeats || 0} / ${item.totalSeats || 50}</span>
                      <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
                        ${item.price ? `${item.price} EGP` : 'Free'}
                      </div>
                    </td>
                  ` : ''}
                  <td style="text-align: right;">
                    <button type="button" class="btn btn-ghost btn-sm btn-delete-item" data-id="${item.id}" data-title="${item.title || item.name || ''}" style="color: var(--status-red);">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Hook delete buttons
    listWrap.querySelectorAll('.btn-delete-item').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        const title = btn.dataset.title || 'this item';
        const confirmed = await confirmDialog.confirm({
          title: `Delete ${this.activeTab.slice(0, -1)}?`,
          message: `Are you sure you want to permanently delete "${title}"? This action is tracked in the audit trail.`,
          confirmText: 'Delete Permanently',
          danger: true,
        });

        if (confirmed) {
          await this.deleteItem(id);
        }
      });
    });
  }

  async deleteItem(id) {
    try {
      if (this.activeTab === 'announcements') await contentApi.deleteAnnouncement(id);
      else if (this.activeTab === 'news') await contentApi.deleteNews(id);
      else if (this.activeTab === 'benefits') await contentApi.deleteBenefit(id);
      else if (this.activeTab === 'trips') await contentApi.deleteTrip(id);

      toast.success('Item Deleted', 'Content removed successfully.');
      await this.loadContent();
    } catch (err) {
      toast.error('Deletion Failed', err.message);
    }
  }

  openCreateModal() {
    let uploadedImageUrl = '';

    const modal = new Modal({
      title: `Publish New ${this.activeTab.slice(0, -1)}`,
      wide: true,
      content: `
        <form id="create-content-form">
          <div class="form-group">
            <label class="form-label">Title <span class="req">*</span></label>
            <input type="text" id="content-title" class="form-input" placeholder="e.g. Annual Ramadan Working Hours Schedule" required />
          </div>

          <div class="form-group">
            <label class="form-label">Details / Content <span class="req">*</span></label>
            <textarea id="content-body" class="form-textarea" rows="4" placeholder="Enter the full description or announcement message..." required></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Category</label>
              <input type="text" id="content-category" class="form-input" placeholder="HR, Operations, Health, Social" />
            </div>

            ${this.activeTab === 'announcements' ? `
              <div class="form-group" style="display: flex; flex-direction: column; justify-content: center;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13.5px; font-weight: 600; margin-top: 18px;">
                  <input type="checkbox" id="content-important" style="width: 18px; height: 18px;" />
                  <span>Mark as Urgent Broadcast (Sends Push Notification)</span>
                </label>
              </div>
            ` : ''}

            ${this.activeTab === 'trips' ? `
              <div class="form-group">
                <label class="form-label">Total Seats Available</label>
                <input type="number" id="content-seats" class="form-input" value="50" min="1" max="500" />
              </div>
            ` : ''}
          </div>

          <div class="form-group">
            <label class="form-label">Attach Cover Image (Optional, max 6MB)</label>
            <div class="file-dropzone" id="file-dropzone">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--primary); margin-bottom: 6px;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <div style="font-size: 13px; font-weight: 600; color: var(--navy-900);">Click or drag image to upload</div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">Supported: PNG, JPEG, WebP (Streaming validation)</div>
              <input type="file" id="file-input" accept="image/png, image/jpeg, image/webp" style="display: none;" />
            </div>
            <div id="upload-status" style="margin-top: 8px; font-size: 12px;"></div>
            <div id="file-preview-area" class="file-preview-wrap" style="display: none;">
              <img id="preview-img" src="" alt="Preview" />
            </div>
          </div>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn-secondary" id="btn-modal-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="btn-modal-submit">Publish Broadcast</button>
      `,
    });

    modal.open();

    const form = modal.element.querySelector('#create-content-form');
    const dropzone = modal.element.querySelector('#file-dropzone');
    const fileInput = modal.element.querySelector('#file-input');
    const uploadStatus = modal.element.querySelector('#upload-status');
    const previewArea = modal.element.querySelector('#file-preview-area');
    const previewImg = modal.element.querySelector('#preview-img');

    // Upload handling
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      uploadStatus.innerHTML = `<span style="color: var(--primary);">Uploading & validating image (${(file.size / 1024).toFixed(0)} KB)...</span>`;
      try {
        const uploadRes = await uploadApi.uploadFile(file);
        uploadedImageUrl = uploadRes.url;
        uploadStatus.innerHTML = `<span style="color: var(--status-green);">✓ Uploaded successfully</span>`;
        previewImg.src = uploadedImageUrl;
        previewArea.style.display = 'inline-block';
      } catch (err) {
        uploadStatus.innerHTML = `<span style="color: var(--status-red);">✗ Upload failed: ${err.message}</span>`;
      }
    });

    modal.element.querySelector('#btn-modal-cancel').addEventListener('click', () => modal.close());

    modal.element.querySelector('#btn-modal-submit').addEventListener('click', async () => {
      const title = modal.element.querySelector('#content-title').value.trim();
      const body = modal.element.querySelector('#content-body').value.trim();
      const category = modal.element.querySelector('#content-category')?.value.trim() || 'General';
      const important = modal.element.querySelector('#content-important')?.checked || false;
      const totalSeats = parseInt(modal.element.querySelector('#content-seats')?.value, 10) || 50;

      if (!title || !body) {
        toast.warning('Required Fields', 'Please provide a title and details.');
        return;
      }

      const payload = {
        title,
        body,
        description: body,
        category,
        imageUrl: uploadedImageUrl || undefined,
        important,
        totalSeats,
      };

      try {
        if (this.activeTab === 'announcements') await contentApi.createAnnouncement(payload);
        else if (this.activeTab === 'news') await contentApi.createNews(payload);
        else if (this.activeTab === 'benefits') await contentApi.createBenefit(payload);
        else if (this.activeTab === 'trips') await contentApi.createTrip(payload);

        toast.success('Published', `${this.activeTab.slice(0, -1)} published successfully.`);
        modal.close();
        await this.loadContent();
      } catch (err) {
        toast.error('Publication Failed', err.message);
      }
    });
  }

  destroy() {
    window.removeEventListener('realtime:announcement.created', this.onRealtimeCreate);
    window.removeEventListener('realtime:announcement.deleted', this.onRealtimeDelete);
    this.container.innerHTML = '';
  }
}
