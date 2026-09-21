'use strict';

/**
 * ZKTeco Standalone Turnstile & Access Control TCP Protocol Parser
 *
 * Implements binary framing, 16-bit one's complement checksum validation,
 * 40-byte ATTLOG attendance log decoding with packed bitfield timestamps,
 * and command packet creation (including CMD_UNLOCK).
 */

const MAGIC_TAG_LE = 0x5050827D; // [0x7D, 0x82, 0x50, 0x50] in little-endian

const OPCODES = Object.freeze({
  CMD_CONNECT: 1000,
  CMD_EXIT: 1001,
  CMD_ENABLEDEVICE: 1002,
  CMD_DISABLEDEVICE: 1003,
  CMD_RESTART: 1004,
  CMD_POWEROFF: 1005,
  CMD_ACK_OK: 2000,
  CMD_ACK_ERROR: 2001,
  CMD_ACK_DATA: 2002,
  CMD_ACK_RETRY: 2003,
  CMD_ACK_REPEAT: 2004,
  CMD_ACK_UNAUTH: 2005,
  CMD_PREPARE_DATA: 1500,
  CMD_DATA: 1501,
  CMD_FREE_DATA: 1502,
  CMD_ATTLOG_RRQ: 13,
  CMD_CLEAR_ATTLOG: 14,
  CMD_UNLOCK: 31,
  CMD_GET_TIME: 201,
  CMD_SET_TIME: 202,
  CMD_VERSION: 1100,
});

const VERIFY_MODE_MAP = Object.freeze({
  0: 'PASSWORD',
  1: 'FINGERPRINT',
  2: 'RFID_CARD',
  15: 'FACE',
  20: 'DYNAMIC_QR',
});

class ZkTecoParser {
  static MAGIC = MAGIC_TAG_LE;
  static MAGIC_TAG_LE = MAGIC_TAG_LE;
  static OPCODES = OPCODES;

  /**
   * Calculates 16-bit one's complement checksum across buffer (RFC 1071).
   * Bytes 2-3 (checksum field itself) are skipped.
   *
   * @param {Buffer} buffer - Header (8 bytes) + optional payload.
   * @returns {number} 16-bit unsigned integer checksum.
   */
  static calculateChecksum(buffer) {
    if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
    let sum = 0;
    const len = buffer.length;

    for (let i = 0; i < len; i += 2) {
      if (i === 2) continue; // Skip bytes 2-3 (checksum field)
      if (i + 1 < len) {
        sum += buffer.readUInt16LE(i);
      } else {
        sum += buffer[i]; // Odd trailing byte
      }
    }

    while (sum > 0xffff) {
      sum = (sum & 0xffff) + (sum >> 16);
    }

    return (~sum) & 0xffff;
  }

  /**
   * Decodes packed 32-bit timestamp into Date.
   * Formula:
   * second = t % 60; t = floor(t/60)
   * minute = t % 60; t = floor(t/60)
   * hour = t % 24; t = floor(t/24)
   * day = (t % 31) + 1; t = floor(t/31)
   * month = (t % 12); t = floor(t/12)
   * year = t + 2000
   *
   * @param {number} packedInt
   * @returns {Date}
   */
  static decodeTimestamp(packedInt) {
    let t = Number(packedInt);
    const second = t % 60;
    t = Math.floor(t / 60);
    const minute = t % 60;
    t = Math.floor(t / 60);
    const hour = t % 24;
    t = Math.floor(t / 24);
    const day = (t % 31) + 1;
    t = Math.floor(t / 31);
    const month = (t % 12);
    t = Math.floor(t / 12);
    const year = t + 2000;

    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  /**
   * Encodes a JavaScript Date into a ZKTeco 32-bit packed timestamp.
   *
   * @param {Date|string|number} date
   * @returns {number}
   */
  static encodeTimestamp(date = new Date()) {
    const d = new Date(date);
    const year = d.getUTCFullYear() - 2000;
    const month = d.getUTCMonth();
    const day = d.getUTCDate() - 1;
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    const second = d.getUTCSeconds();

    let t = year;
    t = t * 12 + month;
    t = t * 31 + day;
    t = t * 24 + hour;
    t = t * 60 + minute;
    t = t * 60 + second;
    return t;
  }

  /**
   * Creates a framed TCP packet for ZKTeco devices.
   * Outer Wrapper: Magic (4B) + Length uint32 LE (4B)
   * Inner Header: Opcode uint16 LE (2B) + Checksum uint16 LE (2B) + Session uint16 LE (2B) + Reply uint16 LE (2B)
   * Payload: variable
   *
   * @param {number} cmd - Command opcode
   * @param {number} sessionId - Session ID
   * @param {number} replyId - Packet sequence / reply ID
   * @param {Buffer|string|Array} payload - Command payload
   * @returns {Buffer}
   */
  static createTcpPacket(cmd, sessionId = 0, replyId = 0, payload = Buffer.alloc(0)) {
    if (!Buffer.isBuffer(payload)) {
      payload = Buffer.from(payload);
    }

    const innerLen = 8 + payload.length;
    const innerBuf = Buffer.alloc(innerLen);

    innerBuf.writeUInt16LE(cmd, 0);
    innerBuf.writeUInt16LE(0, 2); // Checksum temp 0
    innerBuf.writeUInt16LE(sessionId, 4);
    innerBuf.writeUInt16LE(replyId, 6);

    if (payload.length > 0) {
      payload.copy(innerBuf, 8);
    }

    const checksum = ZkTecoParser.calculateChecksum(innerBuf);
    innerBuf.writeUInt16LE(checksum, 2);

    const outerBuf = Buffer.alloc(8 + innerLen);
    outerBuf.writeUInt32LE(MAGIC_TAG_LE, 0);
    outerBuf.writeUInt32LE(innerLen, 4);
    innerBuf.copy(outerBuf, 8);

    return outerBuf;
  }

  /**
   * Generates CMD_UNLOCK (opcode 31) packet to actuate turnstile relay.
   *
   * @param {number} [doorIndex=1] - Door/relay index
   * @param {number} [durationMs=5000] - Open pulse duration in milliseconds
   * @param {number} [sessionId=0] - Session ID
   * @param {number} [replyId=0] - Reply ID
   * @returns {Buffer}
   */
  static createUnlockPacket(doorIndex = 1, durationMs = 5000, sessionId = 0, replyId = 0) {
    const payload = Buffer.alloc(4);
    payload.writeUInt8(doorIndex, 0);
    payload.writeUInt8(0, 1); // reserved
    payload.writeUInt16LE(Math.min(65535, durationMs), 2);
    return ZkTecoParser.createTcpPacket(OPCODES.CMD_UNLOCK, sessionId, replyId, payload);
  }

  /**
   * Parses an incoming ZKTeco TCP packet buffer.
   *
   * @param {Buffer} buffer
   * @returns {Object}
   */
  static parseTcpPacket(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) {
      return { isValid: false, error: 'BUFFER_TOO_SHORT', isChecksumValid: false };
    }

    const magic = buffer.readUInt32LE(0);
    if (magic !== MAGIC_TAG_LE) {
      return { isValid: false, error: 'INVALID_MAGIC_HEADER', isChecksumValid: false };
    }

    const innerLen = buffer.readUInt32LE(4);
    if (buffer.length < 8 + innerLen) {
      return { isValid: false, error: 'TRUNCATED_PACKET', isChecksumValid: false };
    }

    const inner = buffer.subarray(8, 8 + innerLen);
    const cmd = inner.readUInt16LE(0);
    const checksum = inner.readUInt16LE(2);
    const sessionId = inner.readUInt16LE(4);
    const replyId = inner.readUInt16LE(6);
    const payload = inner.subarray(8);

    const expectedChecksum = ZkTecoParser.calculateChecksum(inner);
    const isChecksumValid = checksum === expectedChecksum;
    if (!isChecksumValid) {
      return {
        isValid: false,
        error: 'CHECKSUM_MISMATCH',
        isChecksumValid: false,
        commandId: cmd,
        cmd,
        sessionId,
        replyId,
      };
    }

    const cmdName = Object.keys(OPCODES).find((k) => OPCODES[k] === cmd) || `CMD_UNKNOWN_${cmd}`;

    // Decode attendance records if payload contains 40-byte ATTLOG chunks
    const punches = [];
    if (payload.length >= 40 && payload.length % 40 === 0) {
      for (let offset = 0; offset < payload.length; offset += 40) {
        try {
          const rec = ZkTecoParser.parseAttLogRecord(payload, offset);
          punches.push({
            pin: String(rec.userPin),
            verifyMode: rec.verifyType,
            verifyModeName: rec.verifyMode,
            timestamp: new Date(rec.timestamp),
            punchType: rec.punchStatus === 1 || rec.punchStatus === 5 ? 'check-out' : 'check-in',
            direction: rec.direction,
            employeeCode: rec.employeeCode,
            workCode: rec.workCode,
          });
        } catch (_) {}
      }
    }

    return {
      isValid: true,
      hasOuter: true,
      commandId: cmd,
      cmd,
      cmdName,
      checksum,
      isChecksumValid: true,
      sessionId,
      replyId,
      payload,
      payloadLength: payload.length,
      punches,
    };
  }

  /**
   * Parses a single 40-byte ZKTeco attendance log binary record.
   * Layout:
   * 0..1: user PIN uint16 LE
   * 2: verify type uint8
   * 3: reserved uint8
   * 4..7: packed timestamp uint32 LE
   * 8: punch status uint8 (0: IN, 1: OUT, ...)
   * 9: work code uint8
   * 10..33: null-terminated badge / employee code string (24 bytes)
   * 34..39: reserved (6 bytes)
   *
   * @param {Buffer} buffer
   * @param {number} [offset=0]
   * @returns {Object}
   */
  static parseAttLogRecord(buffer, offset = 0) {
    if (!Buffer.isBuffer(buffer) || buffer.length < offset + 40) {
      throw new Error('Buffer too small for 40-byte ATTLOG record');
    }

    const rec = buffer.subarray(offset, offset + 40);
    const userPin = rec.readUInt16LE(0);
    const verifyType = rec.readUInt8(2);
    const packedTimestamp = rec.readUInt32LE(4);
    const punchStatus = rec.readUInt8(8);
    const workCode = rec.readUInt8(9);

    let empCodeEnd = 10;
    while (empCodeEnd < 34 && rec[empCodeEnd] !== 0) {
      empCodeEnd++;
    }
    const rawCode = rec.subarray(10, empCodeEnd).toString('utf8').trim();
    const employeeCode = rawCode || `EMP-${userPin}`;

    const punchDate = ZkTecoParser.decodeTimestamp(packedTimestamp);
    const direction = (punchStatus === 1 || punchStatus === 5) ? 'OUT' : 'IN';
    const punchType = direction === 'OUT' ? 'check-out' : 'check-in';

    return {
      userPin,
      pin: String(userPin),
      employeeCode,
      verifyType,
      verifyMode: VERIFY_MODE_MAP[verifyType] || 'OTHER',
      packedTimestamp,
      timestamp: punchDate.toISOString(),
      punchDate,
      punchStatus,
      punchType,
      direction,
      workCode,
    };
  }

  /**
   * Parses multiple 40-byte ATTLOG records from buffer.
   *
   * @param {Buffer} buffer
   * @returns {Array<Object>}
   */
  static parseAttLogChunk(buffer) {
    if (!Buffer.isBuffer(buffer)) return [];
    const records = [];
    const count = Math.floor(buffer.length / 40);
    for (let i = 0; i < count; i++) {
      records.push(ZkTecoParser.parseAttLogRecord(buffer, i * 40));
    }
    return records;
  }
}

// Backward-compatible function aliases
function calculateZkChecksum(buf) {
  return ZkTecoParser.calculateChecksum(buf);
}
function buildZkPacket(cmd, sessionId, replyId, payload) {
  return ZkTecoParser.createTcpPacket(cmd, sessionId, replyId, payload);
}
function parseZkPacket(buffer) {
  const res = ZkTecoParser.parseTcpPacket(buffer);
  if (!res.isValid) {
    throw new Error(res.error || 'Invalid ZKTeco packet');
  }
  return res;
}
function decodeZkTimestamp(packedInt) {
  return ZkTecoParser.decodeTimestamp(packedInt);
}
function encodeZkTimestamp(date) {
  return ZkTecoParser.encodeTimestamp(date);
}
function parseAttLogRecord(buffer, offset) {
  return ZkTecoParser.parseAttLogRecord(buffer, offset);
}
function parseAttLogChunk(buffer) {
  return ZkTecoParser.parseAttLogChunk(buffer);
}

module.exports = {
  ZkTecoParser,
  MAGIC_TAG_LE,
  OPCODES,
  VERIFY_MODE_MAP,
  calculateZkChecksum,
  buildZkPacket,
  parseZkPacket,
  decodeZkTimestamp,
  encodeZkTimestamp,
  parseAttLogRecord,
  parseAttLogChunk,
};
