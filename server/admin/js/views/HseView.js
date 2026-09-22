export class HseView {
  constructor(container) {
    this.container = container;
    this.element = document.createElement('div');
    this.element.className = 'hse-view';
  }

  async mount() {
    this.render();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(this.element);
    }
    this.bindEvents();
    return this.element;
  }

  destroy() {}

  bindEvents() {
    const tabs = this.element.querySelectorAll('.tab-btn');
    const permitsTab = this.element.querySelector('#permits-tab');
    const incidentsTab = this.element.querySelector('#incidents-tab');

    if (tabs.length >= 2 && permitsTab && incidentsTab) {
      tabs[0].addEventListener('click', () => {
        permitsTab.style.display = 'block';
        incidentsTab.style.display = 'none';
      });
      tabs[1].addEventListener('click', () => {
        permitsTab.style.display = 'none';
        incidentsTab.style.display = 'block';
      });
    }
  }

  render() {
    this.element.innerHTML = `
      <h2>HSE Dashboard</h2>
      <div class="kpi-summary" style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card" style="padding: 1rem; background: var(--bg-card); border-radius: 8px;">Days Without LTI: <strong>142 days</strong></div>
        <div class="card" style="padding: 1rem; background: var(--bg-card); border-radius: 8px;">Active Permits: <strong>5</strong></div>
        <div class="card" style="padding: 1rem; background: var(--bg-card); border-radius: 8px;">Open Incidents: <strong>2</strong></div>
        <div class="card" style="padding: 1rem; background: var(--bg-card); border-radius: 8px;">PPE Compliance: <strong>98%</strong></div>
      </div>
      <div class="tabs" style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
        <button class="tab-btn btn btn-primary" type="button">تصاريح العمل (Permits)</button>
        <button class="tab-btn btn btn-secondary" type="button">الحوادث والبلاغات (Incidents)</button>
      </div>
      <div class="tab-content" id="permits-tab">
        <table class="data-table" style="width: 100%;">
          <thead>
            <tr><th>Permit ID</th><th>Type</th><th>Action</th></tr>
          </thead>
          <tbody>
            <tr><td>PTW-001</td><td>Hot Work</td><td>
              <button class="btn btn-sm btn-primary" type="button">اعتماد</button> <button class="btn btn-sm btn-secondary" type="button">رفض</button>
            </td></tr>
          </tbody>
        </table>
      </div>
      <div class="tab-content" id="incidents-tab" style="display: none;">
        <table class="data-table" style="width: 100%;">
          <thead>
            <tr><th>Incident ID</th><th>Severity</th></tr>
          </thead>
          <tbody>
            <tr><td>INC-001</td><td><span class="pill pill-high" style="color: #ef4444; font-weight: bold;">High</span></td></tr>
          </tbody>
        </table>
      </div>
    `;
    return this.element;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { HseView };
}
