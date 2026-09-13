// Shifts & Roster View
// Provides a weekly 7-day schedule grid editor (Sunday-Saturday) with shift presets and scope isolation.

import { shiftApi, employeeApi } from '../api/services.js';
import { store } from '../state/store.js';
import { toast } from '../components/Toast.js';
import { ExportService } from '../services/exportService.js';
import { escapeHtml } from '../utils/sanitize.js';

const SHIFT_OPTIONS = [
  { value: 'morning', label: '🌅 Morning (07:00 - 15:30)', short: '🌅 Morning', class: 'shift-pill-morning', hours: 8.5 },
  { value: 'evening', label: '🌇 Evening (15:30 - 23:30)', short: '🌇 Evening', class: 'shift-pill-evening', hours: 8 },
  { value: 'night', label: '🌙 Night (23:30 - 07:30)', short: '🌙 Night', class: 'shift-pill-night', hours: 8 },
  { value: 'office', label: '🏢 Office (08:00 - 16:30)', short: '🏢 Office', class: 'shift-pill-office', hours: 8.5 },
  { value: 'off', label: '🏖️ Day Off (راحة أسبوعية)', short: '🏖️ Off', class: 'shift-pill-off', hours: 0 },
];

const DAY_NAMES = [
  { en: 'Sunday', ar: 'الأحد' },
  { en: 'Monday', ar: 'الإثنين' },
  { en: 'Tuesday', ar: 'الثلاثاء' },
  { en: 'Wednesday', ar: 'الأربعاء' },
  { en: 'Thursday', ar: 'الخميس' },
  { en: 'Friday', ar: 'الجمعة' },
  { en: 'Saturday', ar: 'السبت' },
];

export class ShiftsView {
  constructor(container) {
    this.container = container;
    this.employees = [];
    this.filteredEmployees = [];
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
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            Shift & Roster Management / إدارة الورديات والجداول
          </h2>
          <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
            Assign 7-day weekly shifts, rotate factory operators, and publish rosters.
          </p>
        </div>

        <button type="button" class="btn btn-secondary" id="btn-export-shifts">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Weekly Roster
        </button>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div style="display: grid; grid-template-columns: 240px 1fr auto; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Search Worker</label>
            <input type="text" id="shift-employee-filter" class="form-input" placeholder="Name or code..." />
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Select Employee</label>
            <select id="shift-employee-select" class="form-select">
              <option value="">-- Choose an employee --</option>
            </select>
          </div>

          <div id="roster-employee-details" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
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

    const exportBtn = this.container.querySelector('#btn-export-shifts');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          exportBtn.disabled = true;
          exportBtn.innerText = 'Exporting...';
          const res = await employeeApi.list({ limit: 1000 });
          const employees = res.employees || [];
          
          const shiftRows = [];
          for (const emp of employees) {
            try {
              const rRes = await shiftApi.get(emp.id);
              const days = rRes.days || [];
              const weekSummary = days.map(d => `${d.day || ''}: ${d.shift || 'off'}`).join(' | ');
              shiftRows.push({
                employeeCode: emp.employeeCode || emp.nationalId,
                name: emp.name,
                factory: emp.factory || '—',
                department: emp.department || '—',
                weekSchedule: weekSummary || 'Default Factory Shift Pattern'
              });
            } catch (_) {
              shiftRows.push({
                employeeCode: emp.employeeCode || emp.nationalId,
                name: emp.name,
                factory: emp.factory || '—',
                department: emp.department || '—',
                weekSchedule: 'Standard 3-Shift Pattern'
              });
            }
          }

          ExportService.exportToCsv('Elaraby_Weekly_Shift_Roster', [
            { key: 'employeeCode', label: 'Employee Code / كود الموظف' },
            { key: 'name', label: 'Full Name / الاسم' },
            { key: 'factory', label: 'Factory / المصنع' },
            { key: 'department', label: 'Department / القسم' },
            { key: 'weekSchedule', label: '7-Day Weekly Schedule / جدول الورديات الأسبوعي' }
          ], shiftRows);

          toast.success('Export Completed', `Successfully exported shift schedule for ${shiftRows.length} employees.`);
        } catch (err) {
          toast.error('Export Failed', err.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Weekly Roster
          `;
        }
      });
    }

    const select = this.container.querySelector('#shift-employee-select');
    select.addEventListener('change', (e) => {
      this.selectedEmployeeId = e.target.value;
      if (this.selectedEmployeeId) {
        this.loadRoster(this.selectedEmployeeId);
      } else {
        this.renderEmpty();
      }
    });

    const filterInput = this.container.querySelector('#shift-employee-filter');
    filterInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      this.populateSelect(q);
    });
  }

  populateSelect(searchQuery = '') {
    const select = this.container.querySelector('#shift-employee-select');
    if (!select) return;

    let list = this.employees;
    if (searchQuery) {
      list = list.filter(emp =>
        (emp.name || '').toLowerCase().includes(searchQuery) ||
        (emp.employeeCode || '').toLowerCase().includes(searchQuery) ||
        (emp.nationalId || '').includes(searchQuery)
      );
    }

    select.innerHTML = `
      <option value="">-- Choose an employee (${list.length} matches) --</option>
      ${list.map((emp) => `
        <option value="${emp.id}" ${emp.id === this.selectedEmployeeId ? 'selected' : ''}>
          ${escapeHtml(emp.name)} (${emp.employeeCode || emp.nationalId.slice(-4)}) — ${escapeHtml(emp.factory || '')}
        </option>
      `).join('')}
    `;
  }

  async loadEmployees() {
    try {
      const res = await employeeApi.list({ limit: 200 });
      this.employees = res.employees || [];
      this.populateSelect();
    } catch (err) {
      toast.error('Failed to load employees', err.message);
    }
  }

  async loadRoster(employeeId) {
    const editor = this.container.querySelector('#roster-editor-container');
    if (!editor) return;

    editor.innerHTML = `
      <div style="text-align: center; padding: 48px; color: var(--text-muted);">
        <div class="animate-spin" style="width: 28px; height: 28px; border: 2px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%; margin: 0 auto 12px;"></div>
        Loading roster schedule...
      </div>
    `;

    try {
      const rosterData = await shiftApi.get(employeeId);
      this.weekStart = rosterData.weekStart;

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
        <span class="badge badge-info">🏭 ${escapeHtml(emp.factory || 'Default Factory')}</span>
        <span class="badge badge-neutral">📂 ${escapeHtml(emp.department || 'Production')}</span>
        <span class="badge badge-neutral">💼 ${escapeHtml(emp.position || 'Operator')}</span>
      `;
    }

    const startDate = new Date(this.weekStart);

    editor.innerHTML = `
      <div class="card" style="box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light);">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="font-size: 17px; font-weight: 800; color: var(--text-main); margin: 0;">
                Week of ${this.weekStart}
              </h3>
              <span class="badge badge-primary">EGY Operational Week</span>
            </div>
            <span style="font-size: 12.5px; color: var(--text-muted);">
              Sunday through Saturday (الأحد - السبت)
            </span>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-standard">
              🏢 Standard Office
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-morning">
              🌅 All Morning
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-evening">
              🌇 All Evening
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-preset-night">
              🌙 All Night
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-preset-off" style="color: var(--text-muted);">
              🏖️ Reset Off
            </button>
          </div>
        </div>

        <div class="roster-grid">
          ${this.currentRoster.map((d, index) => {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + index);
            const dateFormatted = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const dayMeta = DAY_NAMES[index];
            const currentShiftObj = SHIFT_OPTIONS.find(o => o.value === d.shift) || SHIFT_OPTIONS[0];

            return `
              <div class="roster-day-card ${d.shift === 'off' ? 'is-off' : ''}" data-day="${index}">
                <div class="roster-day-title">${dayMeta.en}</div>
                <div style="font-size: 11px; color: var(--primary); font-weight: 700; margin-bottom: 2px;">${dayMeta.ar}</div>
                <div class="roster-day-date">${dateFormatted}</div>

                <div class="shift-badge-pill ${currentShiftObj.class}" id="shift-badge-${index}">
                  ${currentShiftObj.short}
                </div>

                <div class="shift-quick-pills">
                  <button type="button" class="shift-quick-pill-btn ${d.shift === 'morning' ? 'active' : ''}" data-day="${index}" data-shift="morning" title="Morning 07:00-15:30">🌅 M</button>
                  <button type="button" class="shift-quick-pill-btn ${d.shift === 'evening' ? 'active' : ''}" data-day="${index}" data-shift="evening" title="Evening 15:30-23:30">🌇 E</button>
                  <button type="button" class="shift-quick-pill-btn ${d.shift === 'night' ? 'active' : ''}" data-day="${index}" data-shift="night" title="Night 23:30-07:30">🌙 N</button>
                  <button type="button" class="shift-quick-pill-btn ${d.shift === 'office' ? 'active' : ''}" data-day="${index}" data-shift="office" title="Office 08:00-16:30">🏢 O</button>
                  <button type="button" class="shift-quick-pill-btn ${d.shift === 'off' ? 'active' : ''}" data-day="${index}" data-shift="off" title="Day Off">🏖️ Off</button>
                </div>

                <select class="shift-select" data-day-index="${index}" style="margin-top: 8px;">
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

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
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

    // Event listeners for select boxes
    const selects = editor.querySelectorAll('.shift-select');
    selects.forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const dayIdx = parseInt(e.target.dataset.dayIndex, 10);
        this.updateDayShift(dayIdx, e.target.value);
      });
    });

    // Event listeners for quick pills
    editor.querySelectorAll('.shift-quick-pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dayIdx = parseInt(btn.dataset.day, 10);
        const shiftVal = btn.dataset.shift;
        this.updateDayShift(dayIdx, shiftVal);
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
    editor.querySelector('#btn-preset-off')?.addEventListener('click', () => {
      this.applyPreset(['off', 'off', 'off', 'off', 'off', 'off', 'off']);
    });

    // Save
    editor.querySelector('#btn-save-roster')?.addEventListener('click', () => {
      this.saveRoster();
    });
  }

  updateDayShift(dayIdx, shiftValue) {
    this.currentRoster[dayIdx].shift = shiftValue;

    // Update select
    const sel = this.container.querySelector(`.shift-select[data-day-index="${dayIdx}"]`);
    if (sel) sel.value = shiftValue;

    // Update quick pill active states
    const dayCard = this.container.querySelector(`.roster-day-card[data-day="${dayIdx}"]`);
    if (dayCard) {
      if (shiftValue === 'off') {
        dayCard.classList.add('is-off');
      } else {
        dayCard.classList.remove('is-off');
      }

      dayCard.querySelectorAll('.shift-quick-pill-btn').forEach(b => {
        if (b.dataset.shift === shiftValue) b.classList.add('active');
        else b.classList.remove('active');
      });

      // Update badge
      const badge = dayCard.querySelector(`#shift-badge-${dayIdx}`);
      const shiftObj = SHIFT_OPTIONS.find(o => o.value === shiftValue) || SHIFT_OPTIONS[0];
      if (badge) {
        badge.className = `shift-badge-pill ${shiftObj.class}`;
        badge.textContent = shiftObj.short;
      }
    }

    this.updateSummary();
  }

  applyPreset(shifts) {
    shifts.forEach((shift, dayIndex) => {
      this.updateDayShift(dayIndex, shift);
    });
  }

  updateSummary() {
    const summary = this.container.querySelector('#roster-workdays-summary');
    if (!summary) return;

    let totalHours = 0;
    let working = 0;
    this.currentRoster.forEach(d => {
      const opt = SHIFT_OPTIONS.find(o => o.value === d.shift);
      if (d.shift !== 'off') {
        working++;
        totalHours += opt ? opt.hours : 8;
      }
    });
    const off = 7 - working;

    const compliance = totalHours <= 48
      ? '<span class="badge badge-success" style="margin-left: 8px;">✓ Legal Hours Compliant</span>'
      : '<span class="badge badge-warning" style="margin-left: 8px;">⚠️ Overtime Alert (>48h)</span>';

    summary.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span class="badge badge-neutral"><b>${working}</b> Working Days</span>
        <span class="badge badge-neutral"><b>${off}</b> Days Off</span>
        <span class="badge badge-info">⏱️ ~<b>${totalHours}</b> Total Scheduled Hours</span>
        ${compliance}
      </div>
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
