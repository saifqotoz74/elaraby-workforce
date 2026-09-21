'use strict';

/**
 * Hikvision ISAPI Access Control Event & Command Parser
 *
 * Handles XML (EventNotificationAlert) and JSON (AccessControllerEvent) formats,
 * decodes Major 5 (Access Authorization) and Major 2 (Access Exception / APB) events,
 * extracts employee ID, card number, verify mode, punch direction, and door number,
 * and generates ISAPI RemoteControlDoor actuation payloads.
 */

const MAJOR_EVENTS = Object.freeze({
  ALARM: 1,
  EXCEPTION: 2,
  OPERATION: 3,
  EVENT: 4,
  ACCESS: 5,
});

const SUB_EVENTS_ACCESS = Object.freeze({
  CARD_PASSED: 1,
  FACE_PASSED: 24,
  FINGERPRINT_PASSED: 38,
  DYNAMIC_QR_PASSED: 47,
  LEGAL_FACE_CARD_PASSED: 75,
});

const SUB_EVENTS_EXCEPTION = Object.freeze({
  APB_VIOLATION: 8,
  INVALID_CARD: 9,
  CARD_EXPIRED: 10,
  FACE_FAILED: 25,
  BLACKLIST_CARD: 37,
});

const VERIFY_MODE_MAP = Object.freeze({
  card: 'RFID_CARD',
  rfid: 'RFID_CARD',
  face: 'FACE',
  facial: 'FACE',
  fingerprint: 'FINGERPRINT',
  finger: 'FINGERPRINT',
  qrcode: 'DYNAMIC_QR',
  pureqrcode: 'DYNAMIC_QR',
  qr: 'DYNAMIC_QR',
  pw: 'PASSWORD',
  password: 'PASSWORD',
});

class HikvisionIsapiParser {
  static MAJOR_EVENTS = MAJOR_EVENTS;
  static SUB_EVENTS_ACCESS = SUB_EVENTS_ACCESS;
  static SUB_EVENTS_EXCEPTION = SUB_EVENTS_EXCEPTION;
  static VERIFY_MODE_MAP = VERIFY_MODE_MAP;

  /**
   * Unified parser for ISAPI event notifications (JSON or XML).
   *
   * @param {string|Buffer|Object} rawBody
   * @param {string} [contentType='application/json']
   * @returns {Object}
   */
  static parseEvent(rawBody, contentType = 'application/json') {
    if (!rawBody) {
      return { isValid: false, error: 'EMPTY_BODY' };
    }

    let parsed = null;
    let bodyStr = '';

    if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
      parsed = rawBody;
      bodyStr = JSON.stringify(rawBody);
    } else {
      bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    }

    const cType = (contentType || '').toLowerCase();
    const trimmed = bodyStr.trim();

    if (!parsed) {
      if (cType.includes('json') || trimmed.startsWith('{')) {
        try {
          parsed = JSON.parse(bodyStr);
        } catch (_) {
          return { isValid: false, error: 'MALFORMED_JSON' };
        }
      } else if (cType.includes('xml') || trimmed.startsWith('<')) {
        // XML check: verify root tag closure
        const rootMatch = trimmed.match(/^<([A-Za-z0-9_]+)[\s>]/);
        if (!rootMatch) {
          return { isValid: false, error: 'MALFORMED_XML' };
        }
        const rootTag = rootMatch[1];
        if (!trimmed.includes(`</${rootTag}>`) && !trimmed.endsWith('/>')) {
          return { isValid: false, error: 'MALFORMED_XML' };
        }

        const getTag = (tag) => {
          const match = trimmed.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
          return match ? match[1].trim() : null;
        };

        const eventType = getTag('eventType') || 'AccessControllerEvent';
        const dateTime = getTag('dateTime') || new Date().toISOString();
        const majorEventType = parseInt(getTag('majorEventType') || '5', 10);
        const subEventType = parseInt(getTag('subEventType') || '75', 10);
        const employeeId = getTag('employeeNoString') || getTag('cardNo') || getTag('employeeId') || null;
        const name = getTag('name');
        const cardNo = getTag('cardNo');
        const attendanceStatus = getTag('attendanceStatus') || 'checkIn';
        const doorNo = parseInt(getTag('doorNo') || '1', 10);
        const currentVerifyMode = getTag('currentVerifyMode') || 'face';
        const pureQRCodeData = getTag('pureQRCodeData');
        const ipAddress = getTag('ipAddress');
        const macAddress = getTag('macAddress');

        parsed = {
          eventType,
          dateTime,
          ipAddress,
          macAddress,
          AccessControllerEvent: {
            majorEventType,
            subEventType,
            cardNo,
            name,
            employeeNoString: employeeId,
            attendanceStatus,
            doorNo,
            currentVerifyMode,
            pureQRCodeData,
          },
        };
      } else {
        return { isValid: false, error: 'UNSUPPORTED_CONTENT_TYPE' };
      }
    }

    const eventObj = parsed.AccessControllerEvent || parsed;
    const eventType = parsed.eventType || 'AccessControllerEvent';
    const isAccessEvent = eventType === 'AccessControllerEvent';

    const majorEventType = Number(eventObj.majorEventType ?? parsed.majorEventType ?? 5);
    const subEventType = Number(eventObj.subEventType ?? parsed.subEventType ?? 75);

    const rawStatus = (eventObj.attendanceStatus || parsed.attendanceStatus || '').toLowerCase();
    const punchType = rawStatus.includes('out') ? 'check-out' : 'check-in';
    const direction = punchType === 'check-out' ? 'OUT' : 'IN';

    const rawMode = (eventObj.currentVerifyMode || parsed.currentVerifyMode || '').toLowerCase();
    let verifyMode = 'FACE';
    if (rawMode.includes('qr')) verifyMode = 'DYNAMIC_QR';
    else if (rawMode.includes('card') || rawMode.includes('rfid')) verifyMode = 'RFID_CARD';
    else if (rawMode.includes('finger')) verifyMode = 'FINGERPRINT';
    else if (rawMode.includes('pw') || rawMode.includes('pass')) verifyMode = 'PASSWORD';

    const isGranted = majorEventType === 5 && [1, 24, 38, 47, 75].includes(subEventType);
    const empId = eventObj.employeeNoString || eventObj.employeeId || eventObj.cardNo || parsed.employeeNoString || parsed.employeeId || null;
    const qrData = eventObj.pureQRCodeData || parsed.pureQRCodeData || null;
    const doorNo = Number(eventObj.doorNo ?? parsed.doorNo ?? 1);

    return {
      isValid: true,
      eventType,
      isAccessEvent,
      eventTime: new Date(parsed.dateTime || eventObj.dateTime || Date.now()),
      majorEventType,
      subEventType,
      isAuthorized: isGranted,
      status: isGranted ? 'GRANTED' : 'DENIED',
      employeeId: empId,
      employeeCode: empId,
      name: eventObj.name || parsed.name || null,
      cardNo: eventObj.cardNo || parsed.cardNo || null,
      punchType,
      direction,
      verifyMode,
      doorNo,
      qrData,
      ipAddress: parsed.ipAddress || null,
      macAddress: parsed.macAddress || null,
      rawPayload: rawBody,
    };
  }

  /**
   * Generates JSON payload for ISAPI PUT /ISAPI/AccessControl/RemoteControl/door/<doorNo>
   *
   * @param {'open'|'close'|'alwaysOpen'|'alwaysClose'} [cmd='open']
   * @returns {string} JSON string
   */
  static createRemoteControlPayload(cmd = 'open') {
    const allowed = ['open', 'close', 'alwaysOpen', 'alwaysClose'];
    if (!allowed.includes(cmd)) {
      throw new Error(`Invalid door command: ${cmd}. Allowed: ${allowed.join(', ')}`);
    }
    return JSON.stringify({
      RemoteControlDoor: {
        cmd,
      },
    });
  }

  /**
   * Builds remote door actuation object for ISAPI (object form).
   *
   * @param {'open'|'close'|'alwaysOpen'|'alwaysClose'} [cmd='open']
   * @returns {Object}
   */
  static buildRemoteDoorCommand(cmd = 'open') {
    const allowed = ['open', 'close', 'alwaysOpen', 'alwaysClose'];
    if (!allowed.includes(cmd)) {
      throw new Error(`Invalid remote control door command '${cmd}'. Allowed: ${allowed.join(', ')}`);
    }
    return {
      RemoteControlDoor: {
        cmd,
      },
    };
  }
}

// Backward-compatible function exports
function parseHikvisionJsonEvent(data) {
  return HikvisionIsapiParser.parseEvent(data, 'application/json');
}

function parseHikvisionXmlEvent(xmlString) {
  return HikvisionIsapiParser.parseEvent(xmlString, 'application/xml');
}

function buildRemoteDoorCommand(cmd) {
  return HikvisionIsapiParser.buildRemoteDoorCommand(cmd);
}

function createRemoteControlPayload(cmd) {
  return HikvisionIsapiParser.createRemoteControlPayload(cmd);
}

module.exports = {
  HikvisionIsapiParser,
  MAJOR_EVENTS,
  SUB_EVENTS_ACCESS,
  SUB_EVENTS_EXCEPTION,
  VERIFY_MODE_MAP,
  parseHikvisionJsonEvent,
  parseHikvisionXmlEvent,
  buildRemoteDoorCommand,
  createRemoteControlPayload,
};
