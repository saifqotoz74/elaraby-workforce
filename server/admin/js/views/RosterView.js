import { rosterSolverApi } from '../api/services.js';
import { store } from '../state/store.js';
import { toast } from '../components/Toast.js';

export class RosterView {
  constructor(container, opts = {}) {
    this.container = container;
    this.element = null;
    this.entries = [];
    this.stats = null;
    this.isLoading = false;
    
    // Default to the current week's Sunday
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day; // adjust when day is sunday
    const sunday = new Date(now.setDate(diff));
    this.weekStart = sunday.toISOString().substring(0, 10);
  }

  async mount() {
    this.render();
    await this.loadData();
    return this.element;
  }

  destroy() {
    // cleanup if needed
  }

  async loadData() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.updateLoader(true);

    try {
      const res = await rosterSolverApi.getWeek(this.weekStart);
      this.entries = res.data || [];
      this.calculateStats();
      this.renderContent();
    } catch (err) {
      console.error('Failed to load roster:', err);
      toast.error('خطأ', err.message || 'فشل في تحميل الجدول الزمني.');
    } finally {
      this.isLoading = false;
      this.updateLoader(false);
    }
  }

  async solveRoster() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.updateLoader(true);

    try {
      const res = await rosterSolverApi.solve({ weekStart: this.weekStart, includeSaturday: false });
      if (res.success) {
        toast.success('نجاح', 'تم توليد الجدول بنجاح.');
        this.entries = res.data.roster || [];
        this.calculateStats();
        this.renderContent();
      }
    } catch (err) {
      console.error('Failed to solve roster:', err);
      toast.error('خطأ', err.message || 'فشل في توليد الجدول.');
    } finally {
      this.isLoading = false;
      this.updateLoader(false);
    }
  }

  updateLoader(show) {
    const loader = this.element?.querySelector('#roster-loader');
    if (loader) {
      loader.style.display = show ? 'flex' : 'none';
    }
  }

  calculateStats() {
    this.stats = { A: 0, B: 0, C: 0, OFF: 0, LEAVE: 0 };
    for (const r of this.entries) {
      if (this.stats[r.shift] !== undefined) {
        this.stats[r.shift]++;
      }
    }
  }

  changeWeek(offset) {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + (offset * 7));
    this.weekStart = d.toISOString().substring(0, 10);
    const dateLabel = this.element.querySelector('#roster-week-label');
    if (dateLabel) {
      dateLabel.textContent = this.weekStart;
    }
    this.loadData();
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'roster-view animate-fade-in';
    this.element.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 style="font-size: 24px; font-weight: 800; color: var(--text-main); margin: 0;">الجدول الزمني الذكي (AI Roster)</h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin: 6px 0 0 0;">توليد وإدارة جداول الورديات وتطبيق قوانين العمل</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-body, #F8FAFC); padding: 4px; border-radius: 8px; border: 1px solid var(--border-color);">
            <button id="prev-week-btn" class="btn btn-ghost btn-sm">السابق</button>
            <span id="roster-week-label" style="font-weight: bold; min-width: 90px; text-align: center;">${this.weekStart}</span>
            <button id="next-week-btn" class="btn btn-ghost btn-sm">التالي</button>
          </div>
          <button id="solve-roster-btn" class="btn btn-primary btn-sm">
            <span>توليد الجدول</span>
          </button>
          <button id="export-roster-btn" class="btn btn-secondary btn-sm">
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div id="roster-stats-container" style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;"></div>

      <div style="position: relative; min-height: 400px;">
        <div id="roster-loader" style="display: none; justify-content: center; align-items: center; position: absolute; inset: 0; background: rgba(255,255,255,0.7); z-index: 10;">
          <div class="spinner"></div>
        </div>
        <div id="roster-grid-container" style="overflow-x: auto; background: var(--card-bg, #fff); border-radius: 12px; border: 1px solid var(--border-color); padding: 16px;">
        </div>
      </div>
    `;

    this.attachEventListeners();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(this.element);
    }
  }

  attachEventListeners() {
    this.element.querySelector('#prev-week-btn').onclick = () => this.changeWeek(-1);
    this.element.querySelector('#next-week-btn').onclick = () => this.changeWeek(1);
    this.element.querySelector('#solve-roster-btn').onclick = () => this.solveRoster();
    this.element.querySelector('#export-roster-btn').onclick = () => {
      const url = rosterSolverApi.getExportUrl(this.weekStart, 'csv');
      window.open(url, '_blank');
    };
  }

  renderContent() {
    this.renderStats();
    this.renderGrid();
  }

  renderStats() {
    const container = this.element.querySelector('#roster-stats-container');
    if (!container || !this.stats) return;
    const { A, B, C, OFF, LEAVE } = this.stats;
    const total = A + B + C + OFF + LEAVE;
    
    container.innerHTML = `
      <div style="padding: 10px 16px; background: #E0F2FE; color: #0284C7; border-radius: 8px; font-size: 13px; font-weight: bold;">الوردية A: ${A}</div>
      <div style="padding: 10px 16px; background: #DCFCE7; color: #16A34A; border-radius: 8px; font-size: 13px; font-weight: bold;">الوردية B: ${B}</div>
      <div style="padding: 10px 16px; background: #F3E8FF; color: #9333EA; border-radius: 8px; font-size: 13px; font-weight: bold;">الوردية C: ${C}</div>
      <div style="padding: 10px 16px; background: #F1F5F9; color: #475569; border-radius: 8px; font-size: 13px; font-weight: bold;">راحة (OFF): ${OFF}</div>
      <div style="padding: 10px 16px; background: #FEF9C3; color: #CA8A04; border-radius: 8px; font-size: 13px; font-weight: bold;">إجازة (LEAVE): ${LEAVE}</div>
    `;
  }

  renderGrid() {
    const container = this.element.querySelector('#roster-grid-container');
    if (!container) return;

    if (this.entries.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">لا توجد بيانات للجدول في هذا الأسبوع. اضغط على "توليد الجدول".</div>';
      return;
    }

    // Group by employee
    const empMap = {};
    for (const r of this.entries) {
      if (!empMap[r.employeeCode]) {
        empMap[r.employeeCode] = { name: r.employeeName, department: r.department, code: r.employeeCode, days: [] };
      }
      empMap[r.employeeCode].days.push(r);
    }

    const employees = Object.values(empMap);
    // Assuming uniform days
    const weekDates = employees[0].days.sort((a,b) => new Date(a.date) - new Date(b.date)).map(d => d.date);

    const shiftColors = {
      A: { bg: '#E0F2FE', text: '#0284C7' },
      B: { bg: '#DCFCE7', text: '#16A34A' },
      C: { bg: '#F3E8FF', text: '#9333EA' },
      OFF: { bg: '#F1F5F9', text: '#475569' },
      LEAVE: { bg: '#FEF9C3', text: '#CA8A04' }
    };

    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
            <th style="padding: 12px; text-align: right; min-width: 150px;">الموظف</th>
            ${weekDates.map(d => `<th style="padding: 12px;">${d}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${employees.map(emp => {
            emp.days.sort((a,b) => new Date(a.date) - new Date(b.date));
            return `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px; text-align: right;">
                  <div style="font-weight: 700; color: var(--text-main);">${emp.name}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${emp.code} - ${emp.department}</div>
                </td>
                ${emp.days.map(d => {
                  const color = shiftColors[d.shift] || shiftColors.OFF;
                  return `
                    <td style="padding: 12px;">
                      <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; background: ${color.bg}; color: ${color.text}; font-weight: bold; min-width: 40px;">
                        ${d.shift}
                      </span>
                    </td>
                  `;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = tableHTML;
  }
}
