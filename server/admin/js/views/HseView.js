class HseView {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'hse-view';
  }

  render() {
    this.element.innerHTML = `
      <h2>HSE Dashboard</h2>
      <div class="kpi-summary" style="display: flex; gap: 1rem;">
        <div class="card">Days Without LTI: 142 days</div>
        <div class="card">Active Permits: 5</div>
        <div class="card">Open Incidents: 2</div>
        <div class="card">PPE Compliance: 98%</div>
      </div>
      <div class="tabs">
        <button class="tab-btn">Permits</button>
        <button class="tab-btn">Incidents</button>
      </div>
      <div class="tab-content" id="permits-tab">
        <table>
          <tr><th>Permit ID</th><th>Type</th><th>Action</th></tr>
          <tr><td>PTW-001</td><td>Hot Work</td><td>
            <button>Approve</button> <button>Reject</button>
          </td></tr>
        </table>
      </div>
      <div class="tab-content" id="incidents-tab" style="display: none;">
        <table>
          <tr><th>Incident ID</th><th>Severity</th></tr>
          <tr><td>INC-001</td><td><span class="pill pill-high">High</span></td></tr>
        </table>
      </div>
    `;
    return this.element;
  }
}

if (typeof module !== 'undefined') {
  module.exports = HseView;
}
