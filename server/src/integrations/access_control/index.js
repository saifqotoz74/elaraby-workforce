'use strict';

const {
  ZkTecoParser,
  MAGIC_TAG_LE,
  OPCODES,
  VERIFY_MODE_MAP: ZK_VERIFY_MODE_MAP,
  calculateZkChecksum,
  buildZkPacket,
  parseZkPacket,
  decodeZkTimestamp,
  encodeZkTimestamp,
  parseAttLogRecord,
  parseAttLogChunk,
} = require('./ZkTecoParser');

const {
  HikvisionIsapiParser,
  MAJOR_EVENTS,
  SUB_EVENTS_ACCESS,
  SUB_EVENTS_EXCEPTION,
  VERIFY_MODE_MAP: HIK_VERIFY_MODE_MAP,
  parseHikvisionJsonEvent,
  parseHikvisionXmlEvent,
  buildRemoteDoorCommand,
  createRemoteControlPayload,
} = require('./HikvisionIsapiParser');

const {
  AntiPassbackEngine,
  validateAntiPassback,
  getAntiPassbackState,
  resetAntiPassbackState,
  getAntiPassbackViolations,
  clearAntiPassbackStore,
} = require('./AntiPassbackEngine');

const {
  DeviceRegistry,
  defaultRegistry,
  DEFAULT_DEVICES,
} = require('./DeviceRegistry');

const {
  HeartbeatMonitor,
  TurnstileHealthMonitor,
  defaultMonitor,
  recordHeartbeat,
} = require('./HeartbeatMonitor');

const {
  EmergencyOverrideService,
  emergencyOverride,
  getEmergencyState,
} = require('./EmergencyOverrideService');

const {
  RotatingQrService,
  MASTER_QR_SECRET,
  generateRotatingQrGatePass,
  verifyRotatingQrGatePass,
} = require('./RotatingQrService');

// Helper accessors matching existing turnstileManager
function getDevices(tenantId = null) {
  return defaultRegistry.getDevices(tenantId);
}

function getDeviceById(id) {
  return defaultRegistry.getDeviceById(id);
}

module.exports = {
  // Core classes
  ZkTecoParser,
  HikvisionIsapiParser,
  AntiPassbackEngine,
  DeviceRegistry,
  defaultRegistry,
  HeartbeatMonitor,
  TurnstileHealthMonitor,
  EmergencyOverrideService,
  RotatingQrService,

  // ZKTeco protocol helpers & constants
  MAGIC_TAG_LE,
  OPCODES,
  ZK_VERIFY_MODE_MAP,
  calculateZkChecksum,
  buildZkPacket,
  parseZkPacket,
  decodeZkTimestamp,
  encodeZkTimestamp,
  parseAttLogRecord,
  parseAttLogChunk,

  // Hikvision ISAPI helpers & constants
  MAJOR_EVENTS,
  SUB_EVENTS_ACCESS,
  SUB_EVENTS_EXCEPTION,
  HIK_VERIFY_MODE_MAP,
  parseHikvisionJsonEvent,
  parseHikvisionXmlEvent,
  buildRemoteDoorCommand,
  createRemoteControlPayload,

  // Anti-Passback helpers
  validateAntiPassback,
  getAntiPassbackState,
  resetAntiPassbackState,
  getAntiPassbackViolations,
  clearAntiPassbackStore,

  // Device & Turnstile health telemetry
  DEFAULT_DEVICES,
  defaultMonitor,
  getDevices,
  getDeviceById,
  recordHeartbeat,

  // Emergency override
  emergencyOverride,
  getEmergencyState,

  // Rotating QR gate pass
  MASTER_QR_SECRET,
  generateRotatingQrGatePass,
  verifyRotatingQrGatePass,
};
