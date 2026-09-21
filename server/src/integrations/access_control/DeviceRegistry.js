'use strict';

/**
 * Access Control Device Registry
 *
 * Manages the inventory, configuration, and telemetry state of industrial
 * turnstiles, speed-gates, and facial recognition terminals across factories.
 */

const DEFAULT_DEVICES = [
  {
    id: 'DEV_QSN_GATE_1',
    tenantId: 'elaraby',
    name: 'مجمع قويسنا - بوابة 1 رئيسية (دخول)',
    factory: 'مجمع مصانع قويسنا',
    ipAddress: '192.168.10.51',
    port: 4370,
    protocol: 'zkteco_tcp',
    direction: 'IN',
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 12,
    rollingLatencyEma: 14.5,
    consecutiveFailures: 0,
    packetLossRate: 0,
  },
  {
    id: 'DEV_QSN_GATE_2',
    tenantId: 'elaraby',
    name: 'مجمع قويسنا - بوابة 2 خروج',
    factory: 'مجمع مصانع قويسنا',
    ipAddress: '192.168.10.52',
    port: 4370,
    protocol: 'zkteco_tcp',
    direction: 'OUT',
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 15,
    rollingLatencyEma: 16.0,
    consecutiveFailures: 0,
    packetLossRate: 0,
  },
  {
    id: 'DEV_BNH_GATE_1',
    tenantId: 'elaraby',
    name: 'مصنع بنها - بوابة الدخول الذكية MinMoe',
    factory: 'مصنع بنها للإلكترونيات',
    ipAddress: '192.168.20.101',
    port: 80,
    protocol: 'hikvision_isapi',
    direction: 'IN',
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 8,
    rollingLatencyEma: 9.2,
    consecutiveFailures: 0,
    packetLossRate: 0,
  },
  {
    id: 'DEV_10R_GATE_1',
    tenantId: 'elsewedy',
    name: 'العاشر من رمضان - بوابة خط الكابلات',
    factory: 'مجمع مصانع العاشر من رمضان',
    ipAddress: '192.168.30.12',
    port: 4370,
    protocol: 'zkteco_tcp',
    direction: 'IN',
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 18,
    rollingLatencyEma: 20.1,
    consecutiveFailures: 0,
    packetLossRate: 0,
  },
];

class DeviceRegistry {
  constructor() {
    this.devices = new Map();
    this._initDefaults();
  }

  _initDefaults() {
    for (const d of DEFAULT_DEVICES) {
      this.devices.set(d.id, { ...d });
    }
  }

  /**
   * Registers or updates a device in the registry.
   *
   * @param {Object} device
   * @returns {Object}
   */
  registerDevice(device) {
    if (!device || !device.id) {
      throw new Error('Device object with id is required');
    }

    const existing = this.devices.get(device.id) || {};
    const merged = {
      id: device.id,
      tenantId: device.tenantId || existing.tenantId || 'elaraby',
      name: device.name || existing.name || device.id,
      factory: device.factory || existing.factory || 'Quesna',
      ipAddress: device.ipAddress || existing.ipAddress || '192.168.1.100',
      port: device.port || existing.port || (device.protocol === 'hikvision_isapi' ? 80 : 4370),
      protocol: device.protocol || existing.protocol || 'zkteco_tcp',
      direction: device.direction || existing.direction || 'BIDIRECTIONAL',
      status: existing.status || 'ONLINE',
      lastHeartbeat: existing.lastHeartbeat || new Date().toISOString(),
      latencyMs: existing.latencyMs ?? 15,
      rollingLatencyEma: existing.rollingLatencyEma ?? 15,
      consecutiveFailures: existing.consecutiveFailures ?? 0,
      packetLossRate: existing.packetLossRate ?? 0,
      gateMode: existing.gateMode || 'NORMAL',
      ...device,
    };

    this.devices.set(device.id, merged);
    return merged;
  }

  /**
   * Retrieves a device by its ID.
   */
  getDeviceById(id) {
    return this.devices.get(id) || null;
  }

  /**
   * Lists devices, optionally filtered by tenantId.
   */
  getDevices(tenantId = null) {
    const all = Array.from(this.devices.values());
    if (!tenantId || tenantId === 'all') return all;
    return all.filter((d) => d.tenantId.toLowerCase() === tenantId.toLowerCase());
  }

  /**
   * Updates partial fields of a device.
   */
  updateDevice(id, patch = {}) {
    const dev = this.devices.get(id);
    if (!dev) return null;
    const updated = { ...dev, ...patch };
    this.devices.set(id, updated);
    return updated;
  }

  /**
   * Resets registry to default seeds.
   */
  reset() {
    this.devices.clear();
    this._initDefaults();
  }
}

// Singleton instance
const defaultRegistry = new DeviceRegistry();

module.exports = {
  DeviceRegistry,
  defaultRegistry,
  DEFAULT_DEVICES,
};
