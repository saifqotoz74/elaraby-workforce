const crypto = require('crypto');
const dbModule = require('../db');
const repository = require('../db/repository');
const shiftService = require('./shiftService');
const realtimeService = require('./realtimeService');
const alertService = require('./alertService');
const { getCurrentTenantId } = require('../tenantContext');

function db() {
  return dbModule.data();
}

function save() {
  dbModule.save();
}

const QR_SECRET = process.env.ATTENDANCE_SECRET || 'elaraby-secure-punch-token-secret-2026';

// Multi-Tenant Institutional Factory Geofences
const TENANT_FACTORIES = {
  elaraby: {
    '10th of Ramadan': {
      id: '10th of Ramadan',
      nameAr: 'مجمع مصانع العاشر من رمضان',
      nameEn: '10th of Ramadan Complex',
      lat: 30.298,
      lng: 31.742,
      radiusMeters: 750,
    },
    Quesna: {
      id: 'Quesna',
      nameAr: 'مجمع قويسنا الصناعي',
      nameEn: 'Quesna Industrial Complex',
      lat: 30.5898,
      lng: 31.1578,
      radiusMeters: 800,
    },
    Benha: {
      id: 'Benha',
      nameAr: 'مصانع بنها للإلكترونيات',
      nameEn: 'Benha Electronics Facility',
      lat: 30.466,
      lng: 31.1834,
      radiusMeters: 650,
    },
  },
  elsewedy: {
    tenth_ramadan: {
      id: 'tenth_ramadan',
      nameAr: 'العاشر من رمضان قطاع الكابلات',
      nameEn: '10th of Ramadan Cable Complex',
      lat: 30.2981,
      lng: 31.7428,
      radiusMeters: 900,
    },
    sokhna: {
      id: 'sokhna',
      nameAr: 'العين السخنة للمحولات',
      nameEn: 'Ain Sokhna Transformers Hub',
      lat: 29.6200,
      lng: 32.3400,
      radiusMeters: 750,
    },
    sadat: {
      id: 'sadat',
      nameAr: 'السادات للمهمات الكهربائية',
      nameEn: 'Sadat Electrical Plant',
      lat: 30.3700,
      lng: 30.5200,
      radiusMeters: 800,
    },
  },
  ghabbour: {
    abu_rawash: {
      id: 'abu_rawash',
      nameAr: 'أبو رواش لتجميع الحافلات',
      nameEn: 'Abu Rawash Bus Assembly',
      lat: 30.0400,
      lng: 31.0600,
      radiusMeters: 800,
    },
    sadat_auto: {
      id: 'sadat_auto',
      nameAr: 'السادات لصناعة السيارات',
      nameEn: 'Sadat Automotive Plant',
      lat: 30.3700,
      lng: 30.5200,
      radiusMeters: 850,
    },
    qalyoub: {
      id: 'qalyoub',
      nameAr: 'قليوب لقطع الغيار',
      nameEn: 'Qalyoub Parts Depot',
      lat: 30.1800,
      lng: 31.2100,
      radiusMeters: 600,
    },
  },
  tmg: {
    madinaty: {
      id: 'madinaty',
      nameAr: 'مدينتي - إدارة المرافق',
      nameEn: 'Madinaty Operations & Facilities',
      lat: 30.1000,
      lng: 31.6200,
      radiusMeters: 1200,
    },
    noor_city: {
      id: 'noor_city',
      nameAr: 'مدينة نور - العاصمة الإدارية',
      nameEn: 'Noor City Operations Hub',
      lat: 30.1400,
      lng: 31.7000,
      radiusMeters: 1000,
    },
    rehab: {
      id: 'rehab',
      nameAr: 'الرحاب - الصيانة الحضرية',
      nameEn: 'Al Rehab Urban Maintenance',
      lat: 30.0600,
      lng: 31.4900,
      radiusMeters: 800,
    },
  },
  gulf_industrial: {
    jubail: {
      id: 'jubail',
      nameAr: 'الجبيل - مجمع البتروكيماويات',
      nameEn: 'Jubail Petrochemical Complex',
      lat: 27.0100,
      lng: 49.6600,
      radiusMeters: 1200,
    },
    yanbu: {
      id: 'yanbu',
      nameAr: 'ينبع للخدمات الصناعية',
      nameEn: 'Yanbu Industrial Plant',
      lat: 24.0900,
      lng: 38.0600,
      radiusMeters: 1000,
    },
    dammam: {
      id: 'dammam',
      nameAr: 'الدمام اللوجستية',
      nameEn: 'Dammam Logistics Center',
      lat: 26.4300,
      lng: 50.1000,
      radiusMeters: 900,
    },
  },
};

// Fallback compatibility alias for Elaraby
const FACTORIES = TENANT_FACTORIES.elaraby;

/**
 * Returns the factory geofences map for a given tenant ID
 */
function getTenantGeofences(tenantId = 'elaraby') {
  const normTenant = (tenantId || 'elaraby').toString().trim().toLowerCase();
  return TENANT_FACTORIES[normTenant] || TENANT_FACTORIES.elaraby;
}

/**
 * Haversine formula to calculate distance in meters between two coordinates
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Generates rotating time-decaying QR token for attendance turnstile/scanner
 */
function generateAttendanceQrToken(employeeId) {
  const now = Date.now();
  const payload = `${employeeId}:${now}:${Math.random().toString(36).substring(2, 8)}`;
  const hmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').substring(0, 16);
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

/**
 * Validates rotating QR token
 */
function verifyAttendanceQrToken(token, expectedEmployeeId) {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parts = raw.split(':');
    if (parts.length < 4) return { valid: false, reason: 'invalid_format' };

    const [empId, timestampStr, nonce, receivedHmac] = parts;
    if (expectedEmployeeId && empId !== expectedEmployeeId) {
      return { valid: false, reason: 'employee_mismatch' };
    }

    const payload = `${empId}:${timestampStr}:${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').substring(0, 16);

    if (receivedHmac !== expectedHmac) {
      return { valid: false, reason: 'signature_invalid' };
    }

    // Token expires after 5 minutes
    const tokenTime = parseInt(timestampStr, 10);
    if (Date.now() - tokenTime > 5 * 60 * 1000) {
      return { valid: false, reason: 'token_expired' };
    }

    return { valid: true, employeeId: empId, timestamp: tokenTime };
  } catch (_) {
    return { valid: false, reason: 'parse_error' };
  }
}

/**
 * Generates an offline token signed for today to punch in low-service metal hangars
 */
function generateOfflineToken(employeeId, dateKey = shiftService.toDateKey(new Date())) {
  const payload = `OFFLINE:${employeeId}:${dateKey}`;
  const sig = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').substring(0, 16);
  return `${payload}:${sig}`;
}

/**
 * Evaluates GPS coordinates against an organization's active factory geofences.
 */
function evaluateGeofence(tenantId, factoryPreference, lat, lng) {
  if (lat === undefined || lat === null || lng === undefined || lng === null || lat === '' || lng === '') {
    return { withinGeofence: true, distanceMeters: 0, geofenceId: null };
  }

  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return { withinGeofence: false, distanceMeters: Infinity, geofenceId: null, isInvalidCoordinates: true };
  }

  const geofences = getTenantGeofences(tenantId);
  const fenceList = Object.values(geofences);

  if (fenceList.length === 0) {
    return { withinGeofence: true, distanceMeters: 0, geofenceId: null };
  }

  // Find closest factory geofence
  let closest = null;
  let minDistance = Infinity;

  for (const fence of fenceList) {
    const d = calculateDistanceMeters(numLat, numLng, fence.lat, fence.lng);
    if (d < minDistance) {
      minDistance = d;
      closest = fence;
    }
  }

  return {
    withinGeofence: minDistance <= (closest?.radiusMeters || 600),
    distanceMeters: minDistance,
    geofenceId: closest?.id || null,
    factoryName: closest?.nameAr || closest?.nameEn || 'Factory',
  };
}

/**
 * Records a factory Punch-In or Punch-Out with strict tenant scoping.
 */
function recordPunch(employeeId, { type = 'in', lat, lng, qrToken, timestamp = Date.now(), isOffline = false, strict = false } = {}) {
  const currentTenant = getCurrentTenantId();
  const me = (db().employees || []).find((e) => e.id === employeeId);
  if (!me) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }

  const tenantId = me.tenantId || currentTenant || 'elaraby';
  const dateKey = shiftService.toDateKey(new Date(timestamp));

  // Geofence check against tenant factories
  const geofenceResult = evaluateGeofence(tenantId, me.factory, lat, lng);

  // If tenant enforces strict geofence rejection
  if (strict && !geofenceResult.withinGeofence && !isOffline) {
    try {
      alertService.createAlert({
        tenantId,
        type: alertService.ALERT_TYPES.GEOFENCE_BREACH,
        title: 'Geofence Breach Blocked',
        message: `Punch attempt by ${me.name} (${me.employeeCode || me.id}) was rejected: ${geofenceResult.distanceMeters}m outside registered geofence at ${geofenceResult.factoryName}.`,
        severity: alertService.ALERT_SEVERITIES.CRITICAL,
        entityType: 'attendance',
        entityId: `ATT-BREACH-${Date.now()}-${me.id}`,
        metadata: {
          employeeId: me.id,
          employeeName: me.name,
          employeeCode: me.employeeCode || null,
          factory: me.factory,
          punchType: type,
          lat,
          lng,
          distanceMeters: geofenceResult.distanceMeters,
          geofenceId: geofenceResult.geofenceId,
          strictRejection: true,
        },
      });
    } catch (alertErr) {
      console.warn('[attendanceService:strict_alert_error]', alertErr.message);
    }

    const err = new Error(`Location is outside registered factory geofence (${geofenceResult.distanceMeters}m away).`);
    err.statusCode = 403;
    err.code = 'OUT_OF_GEOFENCE';
    throw err;
  }

  // Determine punctuality
  const scheduledShift = shiftService.resolveShiftForDate(me, new Date(timestamp));
  let punctuality = 'on_time';
  let delayMinutes = 0;

  if (type === 'in' && !scheduledShift.isOff) {
    const punchDate = new Date(timestamp);
    const scheduledStart = new Date(punchDate);
    scheduledStart.setHours(scheduledShift.startHour, 0, 0, 0);

    const diffMinutes = Math.round((punchDate.getTime() - scheduledStart.getTime()) / 60000);
    if (diffMinutes > 15) {
      punctuality = 'late';
      delayMinutes = diffMinutes;
    } else if (diffMinutes > 0) {
      punctuality = 'grace_period';
      delayMinutes = diffMinutes;
    } else {
      punctuality = 'on_time';
    }
  }

  db().attendanceRecords = db().attendanceRecords || [];
  const punchId = `PCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const punchEntry = {
    id: punchId,
    tenantId,
    employeeId,
    employeeName: me.name,
    date: dateKey,
    type, // 'in' or 'out'
    timestamp,
    timeFormatted: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    geofence: geofenceResult,
    isOutOfBounds: !geofenceResult.withinGeofence,
    punctuality,
    delayMinutes,
    scheduledShift: scheduledShift.id,
    isOffline: Boolean(isOffline),
  };

  db().attendanceRecords.unshift(punchEntry);
  save();

  if (!geofenceResult.withinGeofence && !isOffline) {
    try {
      alertService.createAlert({
        tenantId,
        type: alertService.ALERT_TYPES.GEOFENCE_BREACH,
        title: 'Geofence Breach Detected',
        message: `Employee ${me.name} (${me.employeeCode || me.id}) punched ${type === 'in' ? 'in' : 'out'} ${geofenceResult.distanceMeters}m outside registered geofence at ${geofenceResult.factoryName}.`,
        severity: alertService.ALERT_SEVERITIES.WARNING,
        entityType: 'attendance',
        entityId: punchEntry.id,
        metadata: {
          punchId: punchEntry.id,
          employeeId: me.id,
          employeeName: me.name,
          employeeCode: me.employeeCode || null,
          factory: me.factory,
          punchType: type,
          lat,
          lng,
          distanceMeters: geofenceResult.distanceMeters,
          geofenceId: geofenceResult.geofenceId,
          strictRejection: false,
        },
      });
    } catch (alertErr) {
      console.warn('[attendanceService:soft_alert_error]', alertErr.message);
    }
  }

  // Async repository sync for PostgreSQL persistence
  try {
    repository.recordPunch({
      id: punchId,
      tenantId,
      employeeId,
      punchType: type === 'in' ? 'check_in' : 'check_out',
      punchedAt: new Date(timestamp),
      lat,
      lng,
      geofenceId: geofenceResult.geofenceId,
      isOutOfBounds: !geofenceResult.withinGeofence,
      distanceMeters: geofenceResult.distanceMeters,
      verificationMode: qrToken ? 'qr' : (isOffline ? 'manual' : 'gps'),
    }).catch((e) => console.warn('[attendance:repo_sync_error]', e.message));
  } catch (_) {}

  try {
    realtimeService.broadcast('attendance.punch.recorded', {
      tenantId,
      employeeId,
      employeeName: me.name,
      type,
      punctuality,
      date: dateKey,
      isOutOfBounds: !geofenceResult.withinGeofence,
    }, { tenantId });
  } catch (_) {}

  return punchEntry;
}

/**
 * Returns today's live punch status for the mobile screen
 */
function getTodayPunchState(employeeId, dateKey = shiftService.toDateKey(new Date())) {
  const currentTenant = getCurrentTenantId();
  const me = (db().employees || []).find((e) => e.id === employeeId);
  const tenantId = me?.tenantId || currentTenant || 'elaraby';

  const records = (db().attendanceRecords || []).filter(
    (r) => r.employeeId === employeeId && r.date === dateKey && (!r.tenantId || r.tenantId === tenantId),
  );

  const punchIn = records.slice().reverse().find((r) => r.type === 'in') || null;
  const punchOut = records.find((r) => r.type === 'out') || null;

  let status = 'not_checked_in';
  let workingMinutes = 0;

  if (punchIn && !punchOut) {
    status = 'checked_in';
    workingMinutes = Math.max(0, Math.round((Date.now() - punchIn.timestamp) / 60000));
  } else if (punchIn && punchOut) {
    status = 'checked_out';
    workingMinutes = Math.max(0, Math.round((punchOut.timestamp - punchIn.timestamp) / 60000));
  }

  const shift = me ? shiftService.resolveShiftForDate(me, new Date()) : null;
  const tenantFences = getTenantGeofences(tenantId);
  const primaryFence = (me?.factory && tenantFences[me.factory]) ? tenantFences[me.factory] : Object.values(tenantFences)[0];

  return {
    date: dateKey,
    tenantId,
    status,
    punchIn,
    punchOut,
    workingMinutes,
    scheduledShift: shift,
    qrToken: generateAttendanceQrToken(employeeId),
    offlineToken: generateOfflineToken(employeeId, dateKey),
    factoryGeofence: primaryFence || null,
  };
}

/**
 * Retrieve today's attendance records and overview for HR Admin dashboard.
 */
function getAdminTodayAttendance({ tenantId, factory, limit = 100 } = {}) {
  const currentTenant = tenantId || getCurrentTenantId();
  const dateKey = shiftService.toDateKey(new Date());
  let records = db().attendanceRecords || [];
  if (currentTenant && currentTenant !== 'all') {
    records = records.filter((r) => !r.tenantId || r.tenantId === currentTenant);
  }
  if (factory && factory !== 'all') {
    records = records.filter((r) => r.factory === factory);
  }
  const todayRecords = records.filter((r) => r.date === dateKey);

  const totalPunches = todayRecords.length;
  const inPunches = todayRecords.filter((r) => r.type === 'in');
  const outOfGeofencePunches = todayRecords.filter((r) => r.isOutOfBounds === true || r.withinGeofence === false);
  const latePunches = todayRecords.filter((r) => r.punctuality === 'late');

  const enrichedRecords = todayRecords.map((r) => {
    const emp = (db().employees || []).find((e) => e.id === r.employeeId);
    return {
      ...r,
      employeeName: r.employeeName || emp?.name || r.employeeId,
      employeeCode: emp?.employeeCode || '—',
      factory: r.factory || emp?.factory || '—',
      department: r.department || emp?.department || '—',
      withinGeofence: r.isOutOfBounds !== undefined ? !r.isOutOfBounds : (r.withinGeofence !== false),
    };
  });

  return {
    date: dateKey,
    tenantId: currentTenant,
    stats: {
      totalPunches,
      activePresent: inPunches.length,
      outOfGeofenceCount: outOfGeofencePunches.length,
      lateCount: latePunches.length,
    },
    records: enrichedRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit),
  };
}

module.exports = {
  FACTORIES,
  TENANT_FACTORIES,
  getTenantGeofences,
  calculateDistanceMeters,
  generateAttendanceQrToken,
  verifyAttendanceQrToken,
  generateOfflineToken,
  recordPunch,
  getTodayPunchState,
  getAdminTodayAttendance,
};
