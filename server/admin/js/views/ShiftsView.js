// Shifts & Roster View
// Provides a weekly 7-day schedule grid editor (Sunday-Saturday) with shift presets and scope isolation.

import { shiftApi, employeeApi, attendanceApi } from '../api/services.js';
import { store } from '../state/store.js';
import { toast } from '../components/Toast.js';
import { Modal } from '../components/Modal.js';
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
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts;
    this.employees = [];
    this.filteredEmployees = [];
    this.selectedEmployeeId = null;
    this.currentRoster = null;
    this.weekStart = null;
    this.isLoading = false;
    this.activeTab = opts?.tab === 'attendance' ? 'attendance' : 'roster';
    this.attendanceRecords = [];
    this.attendanceStats = null;
    this.attendanceFilterFactory = 'all';
    this.attendanceSearchQuery = '';
    this.isLoadingAttendance = false;
  }

  async mount() {
    this.renderSkeleton();
    await this.loadEmployees();
    if (this.activeTab === 'attendance') {
      this.switchTab('attendance');
    }
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            Shifts & Attendance Management / إدارة الورديات والحضور
          </h2>
          <p style="color: var(--text-muted); font-size: 13.5px; margin: 0;">
            Assign 7-day weekly shifts, rotate operators, and monitor real-time geofenced attendance.
          </p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav" style="display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 2px solid var(--border-light);">
        <button class="tab-btn active" id="tab-btn-roster" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Weekly Roster / جداول الورديات</span>
        </button>
        <button class="tab-btn" id="tab-btn-attendance" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Live Attendance & Geofencing / الحضور الحي والنطاق الجغرافي</span>
          <span class="badge badge-success" id="tab-attendance-badge" style="display: none; margin-left: 6px; font-size: 11px;">0 Present</span>
        </button>
      </div>

      <!-- PANEL 1: Weekly Roster -->
      <div id="panel-roster">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
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
      </div>

      <!-- PANEL 2: Live Attendance & Geofencing Monitor -->
      <div id="panel-attendance" style="display: none;">
        <!-- Attendance Stats KPI -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 16px 20px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Total Punches Today</div>
            <div id="att-stat-total" style="font-size: 24px; font-weight: 800; color: var(--text-main); margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid var(--status-green);">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Active On-Site</div>
            <div id="att-stat-present" style="font-size: 24px; font-weight: 800; color: var(--status-green); margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid var(--status-yellow);">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Late Arrivals</div>
            <div id="att-stat-late" style="font-size: 24px; font-weight: 800; color: var(--status-yellow); margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid var(--status-red);">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Out-of-Geofence Punches</div>
            <div id="att-stat-breach" style="font-size: 24px; font-weight: 800; color: var(--status-red); margin-top: 4px;">0</div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="card" style="margin-bottom: 20px; padding: 16px 20px;">
          <div style="display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; justify-content: space-between;">
            <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; flex: 1;">
              <div style="min-width: 220px; flex: 1;">
                <label class="form-label" style="font-size: 11px;">Search Worker / Department</label>
                <input type="text" id="att-search-filter" class="form-input" placeholder="Search by name, code, or department..." />
              </div>
              <div style="width: 200px;">
                <label class="form-label" style="font-size: 11px;">Facility / Factory</label>
                <select class="form-select" id="att-factory-filter" style="width: 220px;">
                  <option value="all">🏭 All Facilities / كل المصانع</option>
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-attendance">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>Refresh</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-export-attendance">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Export Punches</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Attendance Punches Table -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div id="attendance-table-wrapper" style="overflow-x: auto;"></div>
        </div>
      </div>
    `;

    this.checkAttendanceBadge();

    // Tab buttons wiring
    const tabRoster = this.container.querySelector('#tab-btn-roster');
    const tabAttendance = this.container.querySelector('#tab-btn-attendance');
    tabRoster.onclick = () => this.switchTab('roster');
    tabAttendance.onclick = () => this.switchTab('attendance');

    // Attendance filters wiring
    const searchAtt = this.container.querySelector('#att-search-filter');
    searchAtt.oninput = (e) => {
      this.attendanceSearchQuery = e.target.value.toLowerCase().trim();
      this.renderAttendanceTable();
    };
    const filterFactory = this.container.querySelector('#att-factory-filter');
    filterFactory.onchange = (e) => {
      this.attendanceFilterFactory = e.target.value;
      this.loadAttendance();
    };
    this.container.querySelector('#btn-refresh-attendance').onclick = () => this.loadAttendance();
    this.container.querySelector('#btn-export-attendance').onclick = () => this.exportAttendanceReport();

    const exportBtn = this.container.querySelector('#btn-export-shifts');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          exportBtn.innerText = 'Exporting...';
          const filterVal = this.container.querySelector('#shift-employee-filter')?.value?.trim();
          const res = await employeeApi.list({ limit: 1000, ...(filterVal ? { q: filterVal } : {}) });
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

          ExportService.exportToCsv('Weekly_Shift_Roster', [
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

  switchTab(tabName) {
    this.activeTab = tabName;
    const btnRoster = this.container.querySelector('#tab-btn-roster');
    const btnAttendance = this.container.querySelector('#tab-btn-attendance');
    const panelRoster = this.container.querySelector('#panel-roster');
    const panelAttendance = this.container.querySelector('#panel-attendance');

    if (tabName === 'attendance') {
      btnRoster.classList.remove('active');
      btnAttendance.classList.add('active');
      panelRoster.style.display = 'none';
      panelAttendance.style.display = 'block';
      this.loadAttendance();
    } else {
      btnAttendance.classList.remove('active');
      btnRoster.classList.add('active');
      panelAttendance.style.display = 'none';
      panelRoster.style.display = 'block';
    }
  }

  async checkAttendanceBadge() {
    try {
      const res = await attendanceApi.getToday({ limit: 1 });
      const present = res.stats?.activePresent || 0;
      const badge = this.container.querySelector('#tab-attendance-badge');
      if (badge) {
        if (present > 0) {
          badge.textContent = `${present} On-Site`;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (_) {}
  }

  async loadAttendance() {
    if (this.isLoadingAttendance) return;
    this.isLoadingAttendance = true;
    const wrapper = this.container.querySelector('#attendance-table-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div style="display: flex; justify-content: center; padding: 48px;">
        <div class="animate-spin" style="width: 28px; height: 28px; border: 2px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%;"></div>
      </div>
    `;

    try {
      const params = { limit: 200 };
      if (this.attendanceFilterFactory && this.attendanceFilterFactory !== 'all') {
        params.factory = this.attendanceFilterFactory;
      }
      const res = await attendanceApi.getToday(params);
      this.attendanceStats = res.stats || {};
      this.attendanceRecords = res.records || [];
      this.populateAttendanceFactories();
      this.updateAttendanceKpis();
      this.renderAttendanceTable();
    } catch (err) {
      wrapper.innerHTML = `<div class="form-error" style="margin: 20px;">${escapeHtml(err.message || 'Failed to load attendance')}</div>`;
    } finally {
      this.isLoadingAttendance = false;
    }
  }

  populateAttendanceFactories() {
    const filter = this.container.querySelector('#att-factory-filter');
    if (!filter || this.hasPopulatedAttFactories) return;
    const currentVal = this.attendanceFilterFactory;
    const factories = new Set();
    for (const r of (this.attendanceRecords || [])) {
      if (r.factory && r.factory.trim()) factories.add(r.factory.trim());
    }
    for (const e of (this.employees || [])) {
      if (e.factory && e.factory.trim()) factories.add(e.factory.trim());
    }
    if (factories.size > 0) {
      this.hasPopulatedAttFactories = true;
      filter.innerHTML = `<option value="all">🏭 All Facilities / كل المصانع</option>`;
      Array.from(factories).sort().forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = `🏭 ${f}`;
        filter.appendChild(opt);
      });
      filter.value = currentVal;
    }
  }

  updateAttendanceKpis() {
    const s = this.attendanceStats || {};
    const elTotal = this.container.querySelector('#att-stat-total');
    const elPresent = this.container.querySelector('#att-stat-present');
    const elLate = this.container.querySelector('#att-stat-late');
    const elBreach = this.container.querySelector('#att-stat-breach');

    if (elTotal) elTotal.textContent = s.totalPunches || 0;
    if (elPresent) elPresent.textContent = s.activePresent || 0;
    if (elLate) elLate.textContent = s.lateCount || 0;
    if (elBreach) elBreach.textContent = s.outOfGeofenceCount || 0;

    const badge = this.container.querySelector('#tab-attendance-badge');
    if (badge) {
      if ((s.activePresent || 0) > 0) {
        badge.textContent = `${s.activePresent} On-Site`;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  renderAttendanceTable() {
    const wrapper = this.container.querySelector('#attendance-table-wrapper');
    if (!wrapper) return;

    let filtered = this.attendanceRecords || [];
    if (this.attendanceSearchQuery) {
      const q = this.attendanceSearchQuery;
      filtered = filtered.filter((r) =>
        (r.employeeName || '').toLowerCase().includes(q) ||
        (r.employeeCode || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.factory || '').toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px;">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="empty-state-title">No Punches Recorded Today</div>
          <div class="empty-state-sub">There are no attendance check-in or check-out events matching your criteria.</div>
        </div>
      `;
      return;
    }

    const rowsHtml = filtered.map((r) => {
      const isCheckIn = r.type === 'in';
      const timeStr = r.timeFormatted || (r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
      const isLate = r.punctuality === 'late';
      const isOut = r.withinGeofence === false;
      const mode = r.isOffline ? 'Offline Sync' : (r.geofence?.geofenceId ? 'GPS Turnstile' : 'Turnstile');

      return `
        <tr>
          <td style="font-size: 13px; font-weight: 700; color: var(--text-main);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge ${isCheckIn ? 'badge-success' : 'badge-neutral'}" style="font-size: 11px;">
                ${isCheckIn ? '🟢 Check IN' : '🔴 Check OUT'}
              </span>
              <span>${timeStr}</span>
            </div>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(r.employeeName || '—')}</div>
            <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(r.employeeCode || '')} • ${escapeHtml(r.department || '—')}</div>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 12.5px;">${escapeHtml(r.factory || '—')}</div>
            <small style="color: var(--text-muted);">${escapeHtml(mode)}</small>
          </td>
          <td>
            ${isLate
              ? `<span class="badge badge-warning">⚠️ Late (${r.delayMinutes || 15}m)</span>`
              : `<span class="badge badge-success">✓ On Time</span>`}
          </td>
          <td>
            ${isOut
              ? `<span class="badge badge-danger">⚠️ Out-of-Geofence (${r.geofence?.distanceMeters || 120}m)</span>`
              : `<span class="badge badge-success">✓ Geofence Verified</span>`}
          </td>
          <td>
            <button type="button" class="btn btn-secondary btn-xs" data-att-view-id="${escapeHtml(r.id || r.timestamp)}">
              Details
            </button>
          </td>
        </tr>
      `;
    }).join('');

    wrapper.innerHTML = `
      <table class="data-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th>Event & Time</th>
            <th>Employee</th>
            <th>Facility / Method</th>
            <th>Punctuality</th>
            <th>Geofence Compliance</th>
            <th style="width: 80px;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    wrapper.querySelectorAll('[data-att-view-id]').forEach((btn) => {
      btn.onclick = (e) => {
        const id = e.currentTarget.getAttribute('data-att-view-id');
        const punch = this.attendanceRecords.find((r) => String(r.id || r.timestamp) === String(id));
        if (punch) this.openPunchDetailsModal(punch);
      };
    });
  }

  openPunchDetailsModal(punch) {
    const content = document.createElement('div');
    const isCheckIn = punch.type === 'in';
    const isOut = punch.withinGeofence === false;
    const timeStr = punch.timestamp ? new Date(punch.timestamp).toLocaleString() : punch.timeFormatted;

    content.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
        <div class="card" style="padding: 14px; background: var(--surface-subtle); margin: 0;">
          <small style="color: var(--text-muted); display: block;">Operator</small>
          <div style="font-weight: 800; font-size: 15px; color: var(--text-main); margin-top: 2px;">
            ${escapeHtml(punch.employeeName || '—')}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Code: <b>${escapeHtml(punch.employeeCode || '—')}</b> | Dept: <b>${escapeHtml(punch.department || '—')}</b>
          </div>
        </div>
        <div class="card" style="padding: 14px; background: var(--surface-subtle); margin: 0;">
          <small style="color: var(--text-muted); display: block;">Punch Telemetry</small>
          <div style="font-weight: 800; font-size: 15px; color: var(--primary); margin-top: 2px;">
            ${isCheckIn ? '🟢 Check IN' : '🔴 Check OUT'}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            ${escapeHtml(timeStr)}
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; margin-bottom: 16px;">
        <div><b>Facility Site:</b> ${escapeHtml(punch.factory || '—')}</div>
        <div><b>Scheduled Shift:</b> ${escapeHtml(punch.scheduledShift || 'morning')}</div>
        <div><b>Punctuality:</b> ${punch.punctuality === 'late' ? `<span class="badge badge-warning">Late +${punch.delayMinutes || 15}m</span>` : '<span class="badge badge-success">On-Time</span>'}</div>
        <div><b>Geofence Status:</b> ${isOut ? `<span class="badge badge-danger">Breach (${punch.geofence?.distanceMeters || 120}m)</span>` : '<span class="badge badge-success">Verified Inside</span>'}</div>
        <div><b>Verification Mode:</b> ${punch.isOffline ? 'Offline Cryptographic Token' : 'GPS Radius Check'}</div>
        <div><b>Shift Reference:</b> ${escapeHtml(punch.scheduledShift || 'Standard')}</div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.innerHTML = `<button class="btn btn-primary btn-sm" id="btn-close-punch-modal">Close</button>`;

    const modal = new Modal({
      title: `Attendance Punch Telemetry: ${escapeHtml(punch.employeeName || '')}`,
      content,
      footer,
    });

    footer.querySelector('#btn-close-punch-modal').onclick = () => modal.close();
    modal.render();
  }

  exportAttendanceReport() {
    const filtered = (this.attendanceRecords || []).map((r) => ({
      timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : '—',
      date: r.date || '—',
      employeeCode: r.employeeCode || '—',
      employeeName: r.employeeName || '—',
      department: r.department || '—',
      factory: r.factory || '—',
      type: r.type === 'in' ? 'Check In' : 'Check Out',
      punctuality: r.punctuality || 'on_time',
      delayMinutes: r.delayMinutes || 0,
      withinGeofence: r.withinGeofence !== false ? 'Yes' : 'No',
      distanceMeters: r.geofence?.distanceMeters || 0,
      isOffline: r.isOffline ? 'Yes' : 'No',
    }));

    ExportService.exportToCsv('Workforce_Daily_Attendance_Punches', [
      { key: 'timestamp', label: 'Timestamp / الوقت' },
      { key: 'date', label: 'Date / التاريخ' },
      { key: 'employeeCode', label: 'Employee Code / كود الموظف' },
      { key: 'employeeName', label: 'Name / الاسم' },
      { key: 'department', label: 'Department / القسم' },
      { key: 'factory', label: 'Factory / المصنع' },
      { key: 'type', label: 'Punch Type / نوع البصمة' },
      { key: 'punctuality', label: 'Punctuality / الانضباط' },
      { key: 'delayMinutes', label: 'Delay (min) / التأخير بالدقائق' },
      { key: 'withinGeofence', label: 'In Geofence / داخل النطاق' },
      { key: 'distanceMeters', label: 'Distance (m) / المسافة' },
      { key: 'isOffline', label: 'Offline Punch / بصمة أوفلاين' },
    ], filtered);

    toast.success('Export Completed', `Exported ${filtered.length} attendance records.`);
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
