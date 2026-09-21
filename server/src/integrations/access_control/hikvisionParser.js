'use strict';

/**
 * Hikvision ISAPI Access Control Event Parser
 * Parses JSON and XML event streams from MinMoe terminals & speed-gates.
 */

/**
 * Parses JSON AccessControllerEvent payload from Hikvision ISAPI.
 */
function parseHikvisionJsonEvent(data) {
  const payload = typeof data === 'string' ? JSON.parse(data) : data;
  const ace = payload.AccessControllerEvent || payload;

  const majorEventType = Number(ace.majorEventType ?? payload.majorEventType ?? 5);
  const subEventType = Number(ace.subEventType ?? payload.subEventType ?? 75);

  const rawStatus = (ace.attendanceStatus || payload.attendanceStatus || '').toLowerCase();
  const direction = rawStatus.includes('out') ? 'OUT' : 'IN';

  const verifyModeMap = {
    card: 'RFID_CARD',
    face: 'FACE',
    fingerprint: 'FINGERPRINT',
    qrcode: 'DYNAMIC_QR',
    pureqrcode: 'DYNAMIC_QR',
    pw: 'PASSWORD',
  };

  const rawMode = (ace.currentVerifyMode || '').toLowerCase();
  const verifyMode = verifyModeMap[rawMode] || 'FACE';

  const employeeCode = ace.employeeNoString || ace.cardNo || payload.employeeNoString || null;
  const qrData = ace.pureQRCodeData || payload.pureQRCodeData || null;
  const doorNo = Number(ace.doorNo ?? payload.doorNo ?? 1);

  return {
    source: 'HIKVISION_ISAPI_JSON',
    ipAddress: payload.ipAddress || null,
    macAddress: payload.macAddress || null,
    dateTime: payload.dateTime || new Date().toISOString(),
    majorEventType,
    subEventType,
    isAuthorized: majorEventType === 5,
    employeeCode,
    employeeName: ace.name || null,
    cardNo: ace.cardNo || null,
    doorNo,
    direction,
    verifyMode,
    qrData,
    rawPayload: payload,
  };
}

/**
 * Parses XML EventNotificationAlert payload from Hikvision ISAPI using pure regex without external DOM dependencies.
 */
function parseHikvisionXmlEvent(xmlString) {
  if (typeof xmlString !== 'string') {
    xmlString = xmlString.toString('utf8');
  }

  function getTag(tag, xml) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? match[1].trim() : null;
  }

  const ipAddress = getTag('ipAddress', xmlString);
  const macAddress = getTag('macAddress', xmlString);
  const dateTime = getTag('dateTime', xmlString) || new Date().toISOString();
  const majorEventType = Number(getTag('majorEventType', xmlString) || 5);
  const subEventType = Number(getTag('subEventType', xmlString) || 75);
  const employeeCode = getTag('employeeNoString', xmlString) || getTag('cardNo', xmlString);
  const employeeName = getTag('name', xmlString);
  const cardNo = getTag('cardNo', xmlString);
  const rawStatus = (getTag('attendanceStatus', xmlString) || '').toLowerCase();
  const direction = rawStatus.includes('out') ? 'OUT' : 'IN';
  const qrData = getTag('pureQRCodeData', xmlString);
  const doorNo = Number(getTag('doorNo', xmlString) || 1);
  const currentVerifyMode = (getTag('currentVerifyMode', xmlString) || 'face').toLowerCase();

  const verifyMode = currentVerifyMode.includes('qr')
    ? 'DYNAMIC_QR'
    : currentVerifyMode.includes('card')
    ? 'RFID_CARD'
    : currentVerifyMode.includes('finger')
    ? 'FINGERPRINT'
    : 'FACE';

  return {
    source: 'HIKVISION_ISAPI_XML',
    ipAddress,
    macAddress,
    dateTime,
    majorEventType,
    subEventType,
    isAuthorized: majorEventType === 5,
    employeeCode,
    employeeName,
    cardNo,
    doorNo,
    direction,
    verifyMode,
    qrData,
    rawPayload: xmlString,
  };
}

/**
 * Builds remote door actuation payload for ISAPI.
 */
function buildRemoteDoorCommand(cmd = 'open') {
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

module.exports = {
  parseHikvisionJsonEvent,
  parseHikvisionXmlEvent,
  buildRemoteDoorCommand,
};
