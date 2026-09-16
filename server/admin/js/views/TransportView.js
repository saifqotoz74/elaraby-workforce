// Fleet & Corporate Transportation Control Room View
// Real-time shuttle fleet monitoring, corridor passenger manifests, and traffic delay alerts.

import { transportApi } from '../api/services.js';
import { Modal } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { ExportService } from '../services/exportService.js';
import { escapeHtml } from '../utils/sanitize.js';

export class TransportView {
  constructor(containerOrOpts) {
    if (containerOrOpts instanceof HTMLElement) {
      this.container = containerOrOpts;
    } else {
      this.container = null;
    }
    this.element = null;
    this.fleetData = [];
    this.refreshTimer = null;
  }

  async mount() {
    const el = this.render();
    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(el);
    }
    await this.loadFleet();
    this.refreshTimer = setInterval(() => this.loadFleet(true), 15000);
    return el;
  }

  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'animate-fade-in';

    this.element.innerHTML = `
      <div class="toolbar-container" style="margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">
            Fleet & Corporate Transportation / أسطول وحافلات النقل المؤسسي
          </h2>
          <p style="font-size: 13.5px; color: var(--text-muted); margin: 0;">
            Live corporate shuttle tracking, corridor stops, passenger manifests, and delay alerts.
          </p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="btn-export-transport">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export Fleet Roster</span>
          </button>
          <button class="btn btn-primary btn-sm" id="btn-new-alert" style="background: var(--status-amber, #F59E0B); border-color: var(--status-amber, #F59E0B);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Broadcast Delay Alert</span>
          </button>
        </div>
      </div>

      <!-- Quick Metrics Ribbon -->
      <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-label">Active Corridors</div>
          <div class="stat-value" id="metric-total-routes">—</div>
          <div class="stat-sub">Registered bus lines</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Shuttles En Route</div>
          <div class="stat-value" id="metric-in-transit" style="color: var(--status-green);">—</div>
          <div class="stat-sub">Live telemetry reporting</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Assigned Riders</div>
          <div class="stat-value" id="metric-total-riders" style="color: var(--primary);">—</div>
          <div class="stat-sub">Shift workforce members</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Traffic Incidents</div>
          <div class="stat-value" id="metric-active-alerts" style="color: var(--status-amber, #F59E0B);">0</div>
          <div class="stat-sub">Broadcasted to commuters</div>
        </div>
      </div>

      <!-- Fleet Grid -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Corridor Telemetry & Active Shuttles</h3>
          <button class="btn btn-ghost btn-sm" id="btn-refresh-fleet" title="Refresh Telemetry">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span>Refresh</span>
          </button>
        </div>
        <div id="transport-fleet-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
            Loading fleet telemetry...
          </div>
        </div>
      </div>
    `;

    this.element.querySelector('#btn-refresh-fleet').onclick = () => this.loadFleet();
    this.element.querySelector('#btn-new-alert').onclick = () => this.openAlertModal();
    this.element.querySelector('#btn-export-transport').onclick = () => this.exportRoster();

    return this.element;
  }

  async loadFleet(silent = false) {
    try {
      const res = await transportApi.getFleet();
      this.fleetData = res.fleet || [];
      this.renderFleetGrid();
      this.updateMetrics();
    } catch (err) {
      if (!silent) {
        toast.error('Fleet Error', err.message || 'Failed to load transport fleet');
      }
    }
  }

  updateMetrics() {
    const totalRoutes = this.fleetData.length;
    let inTransitCount = 0;
    let totalRiders = 0;

    for (const item of this.fleetData) {
      if (item.telemetry && item.telemetry.status === 'in_transit') inTransitCount++;
      totalRiders += item.route.assignedCount || item.route.assignedRiders?.length || 0;
    }

    const setVal = (id, val) => {
      const el = this.element.querySelector(id);
      if (el) el.textContent = val;
    };

    setVal('#metric-total-routes', totalRoutes);
    setVal('#metric-in-transit', inTransitCount);
    setVal('#metric-total-riders', totalRiders);
  }

  renderFleetGrid() {
    const grid = this.element.querySelector('#transport-fleet-grid');
    if (!grid) return;

    if (this.fleetData.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          No active transport corridors found for this organization.
        </div>
      `;
      return;
    }

    grid.innerHTML = this.fleetData.map((item) => {
      const r = item.route;
      const t = item.telemetry || {};
      const isMoving = t.status === 'in_transit';
      const capPct = Math.min(100, Math.round(((r.assignedCount || 0) / (r.capacity || 50)) * 100));

      return `
        <div style="border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 16px; background: var(--surface); display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div>
                <span class="badge ${isMoving ? 'badge-success' : 'badge-info'}" style="font-size: 11px; margin-bottom: 4px; display: inline-block;">
                  ${isMoving ? '● IN TRANSIT' : '⏸ SCHEDULED'}
                </span>
                <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-main);">${escapeHtml(r.nameEn || r.id)}</h4>
                <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(r.nameAr || '')}</div>
              </div>
              <span class="badge" style="background: var(--surface-subtle); color: var(--primary); font-weight: 700;">
                ${escapeHtml(r.factory || 'Industrial')}
              </span>
            </div>

            <!-- Route Info Table -->
            <div style="font-size: 12.5px; margin: 12px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div>
                <span style="color: var(--text-muted); display: block; font-size: 11px;">Vehicle & Driver</span>
                <b>🚌 ${escapeHtml(r.busPlate || 'CA-4912')}</b> • ${escapeHtml(r.driverName || 'Driver')}
              </div>
              <div>
                <span style="color: var(--text-muted); display: block; font-size: 11px;">Stops & Speed</span>
                <b>${r.stops?.length || 0} stops</b> • ${t.speedKmh ? `${t.speedKmh} km/h` : 'Stopped'}
              </div>
              <div style="grid-column: 1 / -1; margin-top: 4px;">
                <span style="color: var(--text-muted); display: block; font-size: 11px;">Next Scheduled Stop</span>
                <b style="color: var(--primary);">${escapeHtml(t.currentStopName || r.stops?.[0]?.nameEn || 'Depot Departure')}</b>
                ${t.etaMinutes ? `<span class="badge badge-warning" style="margin-left: 6px;">ETA ${t.etaMinutes} mins</span>` : ''}
              </div>
            </div>

            <!-- Capacity Progress Bar -->
            <div style="margin: 12px 0;">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
                <span style="color: var(--text-muted);">Occupancy</span>
                <b>${r.assignedCount || 0} / ${r.capacity || 50} Seats (${capPct}%)</b>
              </div>
              <div style="width: 100%; height: 6px; background: var(--surface-subtle); border-radius: 3px; overflow: hidden;">
                <div style="width: ${capPct}%; height: 100%; background: ${capPct > 90 ? 'var(--status-red)' : 'var(--primary)'};"></div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-light);">
            <button class="btn btn-secondary btn-sm btn-inspect-manifest" data-id="${r.id}" style="flex: 1;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              <span>Manifest</span>
            </button>
            <button class="btn btn-ghost btn-sm btn-route-alert" data-id="${r.id}" style="color: var(--status-amber, #F59E0B);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Alert</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach button listeners
    grid.querySelectorAll('.btn-inspect-manifest').forEach((btn) => {
      btn.onclick = () => this.openManifestModal(btn.getAttribute('data-id'));
    });

    grid.querySelectorAll('.btn-route-alert').forEach((btn) => {
      btn.onclick = () => this.openAlertModal(btn.getAttribute('data-id'));
    });
  }

  async openManifestModal(routeId) {
    try {
      const res = await transportApi.getManifest(routeId);
      const manifest = res.manifest || {};
      const stops = manifest.stops || [];

      const modalContent = document.createElement('div');
      modalContent.innerHTML = `
        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 800;">Corridor Passenger Manifest / كشف ركاب الخط</h4>
          <div style="font-size: 13px; color: var(--text-muted);">
            Route <b>${escapeHtml(manifest.routeName || routeId)}</b> • Total Passengers: <b>${manifest.totalPassengers || 0}</b>
          </div>
        </div>

        <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">
          ${stops.length === 0 ? '<p style="color: var(--text-muted); text-align: center;">No assigned passengers along this route.</p>' : stops.map((stop) => `
            <div style="border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px; background: var(--surface-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <b style="font-size: 13px; color: var(--text-main);">📍 ${escapeHtml(stop.nameEn || stop.id)} (${escapeHtml(stop.nameAr || '')})</b>
                <span class="badge badge-info">${stop.passengers?.length || 0} Boarders</span>
              </div>
              ${(stop.passengers && stop.passengers.length > 0) ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px;">
                  ${stop.passengers.map((p) => `
                    <div style="font-size: 12px; background: var(--surface); padding: 6px 8px; border-radius: 4px; border: 1px solid var(--border-light);">
                      <b>${escapeHtml(p.name)}</b>
                      <div style="font-size: 10.5px; color: var(--text-muted);">${escapeHtml(p.employeeCode || '')} • ${escapeHtml(p.factory || '')}</div>
                    </div>
                  `).join('')}
                </div>
              ` : '<div style="font-size: 11.5px; color: var(--text-muted);">No boarders at this stop.</div>'}
            </div>
          `).join('')}
        </div>
      `;

      const modal = new Modal({
        title: 'Corridor Manifest Inspector',
        content: modalContent,
        footer: null,
      });
      modal.render();
    } catch (err) {
      toast.error('Manifest Error', err.message || 'Failed to load route manifest');
    }
  }

  openAlertModal(preselectedRouteId = null) {
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Select Corridor Line / خط السير</label>
        <select name="routeId" class="form-select" required>
          ${this.fleetData.map((item) => `
            <option value="${item.route.id}" ${item.route.id === preselectedRouteId ? 'selected' : ''}>
              ${escapeHtml(item.route.nameEn || item.route.id)} (${escapeHtml(item.route.factory || '')})
            </option>
          `).join('')}
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">Alert Category / نوع البلاغ</label>
          <select name="type" class="form-select">
            <option value="traffic_delay">🚦 Heavy Traffic Delay / تأخير مروري</option>
            <option value="breakdown">⚙️ Bus Mechanical Issue / عطل ميكانيكي</option>
            <option value="weather">🌧️ Severe Weather / أحوال جوية</option>
            <option value="route_change">🔄 Detour / تعديل مسار</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estimated Delay (Minutes)</label>
          <input type="number" name="delayMinutes" class="form-input" value="15" min="5" max="180" required />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Incident Message / نص التنبيه للركاب</label>
        <textarea name="message" class="form-input" rows="3" placeholder="Explain the situation clearly (e.g. Ring road congestion near Tagamoa exit)..." required></textarea>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '10px';
    footer.style.justifyContent = 'flex-end';
    footer.style.width = '100%';
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm" id="alert-modal-cancel">Cancel</button>
      <button type="submit" class="btn btn-primary btn-sm" style="background: var(--status-amber, #F59E0B); border-color: var(--status-amber, #F59E0B);">
        Broadcast Live Alert
      </button>
    `;

    const modal = new Modal({
      title: 'Broadcast Shuttle Delay Alert / إرسال إشعار تأخير حافلة',
      content: form,
      footer,
    });

    footer.querySelector('#alert-modal-cancel').onclick = () => modal.close();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = {
        routeId: formData.get('routeId'),
        type: formData.get('type'),
        delayMinutes: Number(formData.get('delayMinutes')) || 15,
        message: formData.get('message'),
      };

      try {
        await transportApi.reportAlert(payload);
        toast.success('Alert Dispatched', `Broadcasted to passengers on route ${payload.routeId}`);
        modal.close();
        this.loadFleet();
      } catch (err) {
        toast.error('Alert Failed', err.message || 'Could not dispatch alert');
      }
    };

    modal.render();
  }

  exportRoster() {
    const columns = [
      { key: 'routeId', label: 'Route ID' },
      { key: 'nameEn', label: 'Route Name (EN)' },
      { key: 'nameAr', label: 'Route Name (AR)' },
      { key: 'factory', label: 'Target Factory' },
      { key: 'busPlate', label: 'Bus Plate' },
      { key: 'driverName', label: 'Driver Name' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'assignedCount', label: 'Assigned Passengers' },
      { key: 'status', label: 'Current Status' },
    ];

    const rows = (this.fleetData || []).map(item => {
      const r = item.route || {};
      return {
        routeId: r.id || '—',
        nameEn: r.nameEn || '—',
        nameAr: r.nameAr || '—',
        factory: r.factory || '—',
        busPlate: r.busPlate || '—',
        driverName: r.driverName || '—',
        capacity: r.capacity || 0,
        assignedCount: r.assignedCount || r.assignedRiders?.length || 0,
        status: item.telemetry?.status || 'scheduled',
      };
    });

    const tenant = localStorage.getItem('admin_active_tenant') || 'Workforce';
    ExportService.exportToCsv(`${tenant}_Fleet_Roster`, columns, rows);
    toast.success('Exported', 'Transport fleet roster saved to CSV.');
  }

  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
