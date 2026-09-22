export class IncentivesView {
  constructor(container) {
    this.container = container;
    this.element = document.createElement('div');
    this.element.className = 'incentives-view';
  }

  async mount() {
    this.render();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(this.element);
    }
    return this.element;
  }

  destroy() {}

  render() {
    this.element.innerHTML = `
      <h2>Incentives & Deductions</h2>
      <div class="kpi-summary" style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card" style="padding: 1rem; background: var(--bg-card); border-radius: 8px;">Total Incentives: <strong>50,000 EGP</strong></div>
        <div class="card" style="padding: 1rem; background: var(--bg-card); border-radius: 8px;">Total Deductions: <strong>5,000 EGP</strong></div>
        <div class="card" style="padding: 1rem; background: var(--bg-card); border-radius: 8px;">Net Adjustment: <strong>45,000 EGP</strong></div>
      </div>
      <div class="card rules-card" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-card); border-radius: 8px;">
        <h3 style="margin-top: 0;">Disciplinary Ladder Rules</h3>
        <ul style="margin-bottom: 0;">
          <li>1st offense (late &lt;15 min): warning</li>
          <li>2nd offense (late 15-60 min): 0.25 daily wage</li>
        </ul>
      </div>
      <table class="data-table" style="width: 100%; margin-bottom: 1.5rem;">
        <thead>
          <tr><th>Emp Code</th><th>Department</th><th>Reason</th><th>Amount</th></tr>
        </thead>
        <tbody>
          <tr><td>EMP001</td><td>Production</td><td>Perfect Attendance</td><td>+500 EGP</td></tr>
        </tbody>
      </table>
      <button class="btn btn-primary" type="button">ترحيل للرواتب</button>
    `;
    return this.element;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { IncentivesView };
}
