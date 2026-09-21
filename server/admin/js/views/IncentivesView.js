class IncentivesView {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'incentives-view';
  }

  render() {
    this.element.innerHTML = `
      <h2>Incentives & Deductions</h2>
      <div class="kpi-summary" style="display: flex; gap: 1rem;">
        <div class="card">Total Incentives: 50,000 EGP</div>
        <div class="card">Total Deductions: 5,000 EGP</div>
        <div class="card">Net Adjustment: 45,000 EGP</div>
      </div>
      <div class="card rules-card">
        <h3>Disciplinary Ladder Rules</h3>
        <ul>
          <li>1st offense (late <15 min): warning</li>
          <li>2nd offense (late 15-60 min): 0.25 daily wage</li>
        </ul>
      </div>
      <table class="data-table">
        <tr><th>Emp Code</th><th>Department</th><th>Reason</th><th>Amount</th></tr>
        <tr><td>EMP001</td><td>Production</td><td>Perfect Attendance</td><td>+500</td></tr>
      </table>
      <button class="btn-primary">ترحيل للرواتب</button>
    `;
    return this.element;
  }
}

if (typeof module !== 'undefined') {
  module.exports = IncentivesView;
}
