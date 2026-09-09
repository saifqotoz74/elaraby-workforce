// Shifts & Roster View
// Provides a weekly 7-day schedule grid editor (Sunday-Saturday) with shift presets and scope isolation.

import { shiftApi, employeeApi } from '../api/services.js';
import { store } from '../state/store.js';
import { toast } from '../components/Toast.js';

const SHIFT_OPTIONS = [
  { value: 'morning', label: '🌅 Morning (07:00 - 15:30)' },
  { value: 'evening', label: '🌇 Evening (15:30 - 23:30)' },
  { value: 'night', label: '🌙 Night (23:30 - 07:30)' },
  { value: 'office', label: '🏢 Office (08:00 - 16:30)' },
  { value: 'off', label: '🏖️ Day Off' },
];

const DAY_NAMES = [
  'Sunday (الأحد)',
  'Monday (الإثنين)',
  'Tuesday (الثلاثاء)',
  'Wednesday (الأربعاء)',
  'Thursday (الخميس)',
  'Friday (الجمعة)',
  'Saturday (السبت)',
];

export class ShiftsView {
  constructor(container) {
    this.container = container;
    this.employees = [];
    this.selectedEmployeeId = null;
    this.currentRoster = null;
    this.weekStart = null;
    this.isLoading = false;
  }

  async mount() {
    this.renderSkeleton();
    await this.loadEmployees();
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--navy-900); margin: 0 0 4px 0;">
            Shift & Roster Management
          </h2>
          <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
            Assign 7-day weekly shifts, rotate factory operators, and publish rosters.
          </p>
        </div>
      </div>

      <div class="roster-card">
        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
          <div class="form-group" style="min-width: 300px; margin-bottom: 0; flex: 1;">
            <label class="form-label">Select Employee</label>
            <select id="shift-employee-select" class="form-select">
              <option value="">-- Choose an employee --</option>
            </select>
          </div>
          <div id="roster-employee-details" style="display: flex; gap: 16px; align-items: center; padding-top: 18px;">
            <!-- Employee metadata badge -->
          </div>
        </div>
      </div>

      <div id="roster-editor-container">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="empty-state-title">No Employee Selected</div>
          <div class="empty-state-sub">Please select an employee from the dropdown above to view or update their weekly roster.</div>
        </div>
      </div>
    `;

    const select = this.container.querySelector('#shift-employee-select');
    select.addEventListener('change', (e) => {
      this.selectedEmployeeId = e.target.value;
      if (this.selectedEmployeeId) {
        this.loadRoster(this.selectedEmployeeId);
      } else {
        this.renderEmpty();
      }
    });
  }

  async loadEmployees() {
    try {
      const res = await employeeApi.list({ limit: 100 });
      this.employees = res.employees || [];
      const select = this.container.querySelector('#shift-employee-select');
      if (select) {
        select.innerHTML = `
          <option value="">-- Choose an employee (${this.employees.length} available) --</option>
          ${this.employees.map((emp) => `
            <option value="${emp.id}">${emp.name} (${emp.employeeCode || emp.nationalId.slice(-4)}) - ${emp.factory || ''}</option>
          `).join('')}
        `;
      }
    } catch (err) {
      toast.error('Failed to load employees', err.message);
    }
  }

  async loadRoster(employeeId) {
    const editor = this.container.querySelector('#roster-editor-container');
    if (!editor) return;

    editor.innerHTML = `
      <div style="text-align: center; padding: 48px; color: var(--text-muted);">
        Loading roster schedule...
      </div>
    `;

    try {
      const rosterData = await shiftApi.get(employeeId);
      this.weekStart = rosterData.weekStart;

      // Default to office/off or default morning if no existing record
      if (!rosterData.days || rosterData.days.length !== 7) {
        this.currentRoster = [
          { dayIndex: 0, shift: 'office' },
          { dayIndex: 1, shift: 'office' },
          { dayIndex: 2, shift: 'office' },
          { dayIndex: 3, shift: 'office' },
          { dayIndex: 4, shift: 'office' },
          { dayIndex: 5, shift: 'off' },
          { dayIndex: 6, shift: 'off' },
        ];
      } else {
        this.currentRoster = rosterData.days;
      }

      this.renderEditor();
    } catch (err) {
      toast.error('Failed to load roster', err.message);
      editor.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title" style="color: var(--status-red);">Error Loading Schedule</div>
          <div class="empty-state-sub">${err.message}</div>
        </div>
      `;
    }
  }

  renderEditor() {
    const editor = this.container.querySelector('#roster-editor-container');
    if (!editor) return;

    const emp = this.employees.find((e) => e.id === this.selectedEmployeeId);
    const detailsWrap = this.container.querySelector('#roster-employee-details');
    if (detailsWrap && emp) {
      detailsWrap.innerHTML = `
        <span class="badge badge-info">🏭 ${emp.factory || 'Default Factory'}</span>
        <span class="badge badge-neutral">📂 ${emp.department || 'Production'}</span>
        <span class="badge badge-neutral">💼 ${emp.position || 'Operator'}</span>
      `;
    }

    const startDate = new Date(this.weekStart);

    editor.innerHTML = `
      <div class="roster-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 20px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: var(--navy-900); margin: 0 0 4px 0;">
              Week of ${this.weekStart}
            </h3>
            <span style="font-size: 12.5px; color: var(--text-muted);">
              Middle East Work Week (Sunday - Saturday)
            </span>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-standard">
              Standard Office
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-morning">
              All Morning
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-evening">
              All Evening
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-night">
              All Night
            </button>
          </div>
        </div>

        <div class="roster-grid">
          ${this.currentRoster.map((d, index) => {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + index);
            const dateFormatted = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return `
              <div class="roster-day-card" data-day="${index}">
                <div class="roster-day-title">${DAY_NAMES[index].split(' ')[0]}</div>
                <div class="roster-day-date">${dateFormatted}</div>
                <select class="shift-select" data-day-index="${index}">
                  ${SHIFT_OPTIONS.map((opt) => `
                    <option value="${opt.value}" ${d.shift === opt.value ? 'selected' : ''}>
                      ${opt.label}
                    </option>
                  `).join('')}
                </select>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border-light);">
          <div style="font-size: 13px; color: var(--text-muted);" id="roster-workdays-summary">
            <!-- Count of working days vs off -->
          </div>

          ${store.hasPermission('SHIFT_UPDATE') ? `
            <button type="button" class="btn btn-primary" id="btn-save-roster">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Save Weekly Schedule
            </button>
          ` : `
            <span class="badge badge-warning">Read-Only Permission</span>
          `}
        </div>
      </div>
    `;

    this.updateSummary();

    // Event listeners
    const selects = editor.querySelectorAll('.shift-select');
    selects.forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const dayIdx = parseInt(e.target.dataset.dayIndex, 10);
        this.currentRoster[dayIdx].shift = e.target.value;
        this.updateSummary();
      });
    });

    // Presets
    editor.querySelector('#btn-preset-standard')?.addEventListener('click', () => {
      this.applyPreset(['office', 'office', 'office', 'office', 'office', 'off', 'off']);
    });
    editor.querySelector('#btn-preset-morning')?.addEventListener('click', () => {
      this.applyPreset(['morning', 'morning', 'morning', 'morning', 'morning', 'off', 'off']);
    });
    editor.querySelector('#btn-preset-evening')?.addEventListener('click', () => {
      this.applyPreset(['evening', 'evening', 'evening', 'evening', 'evening', 'off', 'off']);
    });
    editor.querySelector('#btn-preset-night')?.addEventListener('click', () => {
      this.applyPreset(['night', 'night', 'night', 'night', 'night', 'off', 'off']);
    });

    // Save
    editor.querySelector('#btn-save-roster')?.addEventListener('click', () => {
      this.saveRoster();
    });
  }

  applyPreset(shifts) {
    this.currentRoster = shifts.map((shift, dayIndex) => ({ dayIndex, shift }));
    const selects = this.container.querySelectorAll('.shift-select');
    selects.forEach((sel, idx) => {
      sel.value = shifts[idx];
    });
    this.updateSummary();
  }

  updateSummary() {
    const summary = this.container.querySelector('#roster-workdays-summary');
    if (!summary) return;

    const working = this.currentRoster.filter((d) => d.shift !== 'off').length;
    const off = 7 - working;
    summary.innerHTML = `
      <b>Schedule Summary:</b> <span>${working} Working Days</span> • <span>${off} Days Off</span>
    `;
  }

  async saveRoster() {
    if (!this.selectedEmployeeId) return;

    const saveBtn = this.container.querySelector('#btn-save-roster');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';
    }

    try {
      await shiftApi.update(this.selectedEmployeeId, { days: this.currentRoster });
      toast.success('Roster Saved', 'Weekly schedule successfully updated.');
    } catch (err) {
      toast.error('Save Failed', err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save Weekly Schedule
        `;
      }
    }
  }

  renderEmpty() {
    const detailsWrap = this.container.querySelector('#roster-employee-details');
    if (detailsWrap) detailsWrap.innerHTML = '';

    const editor = this.container.querySelector('#roster-editor-container');
    if (editor) {
      editor.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="empty-state-title">No Employee Selected</div>
          <div class="empty-state-sub">Please select an employee from the dropdown above to view or update their weekly roster.</div>
        </div>
      `;
    }
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
