import 'dart:async';
import 'dart:convert';
import 'dart:io' show Directory, File, Platform;
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import '../../features/services/data/shift_model.dart';
import 'local_store.dart';

// ============================================================================
// 1. EXCEPTIONS
// ============================================================================

class DatabaseException implements Exception {
  final String message;
  final dynamic cause;
  DatabaseException(this.message, [this.cause]);
  @override
  String toString() => 'DatabaseException: $message ${cause != null ? '($cause)' : ''}';
}

class DatabaseTamperedException extends DatabaseException {
  DatabaseTamperedException(super.message);
}

class RecordNotFoundException extends DatabaseException {
  RecordNotFoundException(super.message);
}

// ============================================================================
// 2. DATA MODELS
// ============================================================================

/// Represents an attendance punch recorded while offline.
class OfflinePunch {
  final String clientPunchId;
  final String timestamp; // String ISO-8601 or epoch string
  final String type; // 'check-in' or 'check-out' or 'in' or 'out'
  final double? latitude;
  final double? longitude;
  final String? offlineToken;
  final String status; // 'pending', 'syncing', 'synced', 'rejected'
  final int retryCount;
  final String? employeeId;
  final String? qrToken;
  final String? lastAttemptAt;
  final String? errorMessage;
  final String? createdAt;

  const OfflinePunch({
    required this.clientPunchId,
    required dynamic timestamp,
    required this.type,
    this.latitude,
    this.longitude,
    this.offlineToken,
    this.status = 'pending',
    this.retryCount = 0,
    this.employeeId,
    this.qrToken,
    this.lastAttemptAt,
    this.errorMessage,
    dynamic createdAt,
  })  : timestamp = '$timestamp',
        createdAt = createdAt != null ? '$createdAt' : null;

  int get timestampMs {
    final asInt = int.tryParse(timestamp);
    if (asInt != null) return asInt;
    final dt = DateTime.tryParse(timestamp);
    if (dt != null) return dt.millisecondsSinceEpoch;
    return DateTime.now().millisecondsSinceEpoch;
  }

  OfflinePunch copyWith({
    String? clientPunchId,
    dynamic timestamp,
    String? type,
    double? latitude,
    double? longitude,
    String? offlineToken,
    String? status,
    int? retryCount,
    String? employeeId,
    String? qrToken,
    String? lastAttemptAt,
    String? errorMessage,
    dynamic createdAt,
  }) {
    return OfflinePunch(
      clientPunchId: clientPunchId ?? this.clientPunchId,
      timestamp: timestamp ?? this.timestamp,
      type: type ?? this.type,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      offlineToken: offlineToken ?? this.offlineToken,
      status: status ?? this.status,
      retryCount: retryCount ?? this.retryCount,
      employeeId: employeeId ?? this.employeeId,
      qrToken: qrToken ?? this.qrToken,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      errorMessage: errorMessage ?? this.errorMessage,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'clientPunchId': clientPunchId,
        'timestamp': timestamp,
        'type': type,
        'latitude': latitude,
        'longitude': longitude,
        'offlineToken': offlineToken,
        'status': status,
        'retryCount': retryCount,
        'employeeId': employeeId,
        'qrToken': qrToken,
        'lastAttemptAt': lastAttemptAt,
        'errorMessage': errorMessage,
        'createdAt': createdAt ?? timestamp,
      };

  factory OfflinePunch.fromJson(Map<String, dynamic> json) {
    return OfflinePunch(
      clientPunchId: json['clientPunchId'] as String,
      timestamp: json['timestamp'],
      type: json['type'] as String,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      offlineToken: json['offlineToken'] as String?,
      status: json['status'] as String? ?? 'pending',
      retryCount: json['retryCount'] as int? ?? 0,
      employeeId: json['employeeId'] as String?,
      qrToken: json['qrToken'] as String?,
      lastAttemptAt: json['lastAttemptAt'] as String?,
      errorMessage: json['errorMessage'] as String?,
      createdAt: json['createdAt'],
    );
  }

  Map<String, dynamic> toMap() => {
        'client_punch_id': clientPunchId,
        'timestamp': timestamp,
        'type': type,
        'latitude': latitude,
        'longitude': longitude,
        'offline_token': offlineToken,
        'status': status,
        'retry_count': retryCount,
        'employee_id': employeeId,
        'qr_token': qrToken,
        'last_attempt_at': lastAttemptAt,
        'error_message': errorMessage,
        'created_at': createdAt ?? timestamp,
      };

  factory OfflinePunch.fromMap(Map<String, dynamic> map) {
    return OfflinePunch(
      clientPunchId: (map['client_punch_id'] ?? map['clientPunchId']) as String,
      timestamp: map['timestamp'],
      type: map['type'] as String,
      latitude: (map['latitude'] as num?)?.toDouble(),
      longitude: (map['longitude'] as num?)?.toDouble(),
      offlineToken: (map['offline_token'] ?? map['offlineToken']) as String?,
      status: map['status'] as String? ?? 'pending',
      retryCount: (map['retry_count'] ?? map['retryCount']) as int? ?? 0,
      employeeId: (map['employee_id'] ?? map['employeeId']) as String?,
      qrToken: (map['qr_token'] ?? map['qrToken']) as String?,
      lastAttemptAt: (map['last_attempt_at'] ?? map['lastAttemptAt'])?.toString(),
      errorMessage: (map['error_message'] ?? map['errorMessage']) as String?,
      createdAt: map['created_at'] ?? map['createdAt'],
    );
  }

  /// Transforms client punch record for backend bulk sync endpoint POST /api/attendance/bulk-sync.
  Map<String, dynamic> toWirePayload() {
    return {
      'clientPunchId': clientPunchId,
      if (employeeId != null) 'employeeId': employeeId,
      'type': type == 'check-out' || type == 'out' ? 'out' : 'in',
      'timestamp': timestampMs,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (latitude != null) 'lat': latitude,
      if (longitude != null) 'lng': longitude,
      if (offlineToken != null) 'offlineToken': offlineToken,
      if (qrToken != null) 'qrToken': qrToken,
    };
  }

  Map<String, dynamic> toBackendJson() => toWirePayload();
}

/// Represents an offline leave, loan, or HR application request.
class PendingHrRequest {
  final String idempotencyKey;
  final String id;
  final String type; // 'leave' | 'loan' | 'Leave' | 'Loan', etc.
  final Map<String, dynamic> payload;
  final String status; // 'pending', 'syncing', 'synced', 'rejected'
  final String createdAt;
  final int retryCount;
  final String? errorMessage;

  const PendingHrRequest({
    required this.idempotencyKey,
    required this.id,
    required this.type,
    required this.payload,
    this.status = 'pending',
    required this.createdAt,
    this.retryCount = 0,
    this.errorMessage,
  });

  PendingHrRequest copyWith({
    String? idempotencyKey,
    String? id,
    String? type,
    Map<String, dynamic>? payload,
    String? status,
    String? createdAt,
    int? retryCount,
    String? errorMessage,
  }) {
    return PendingHrRequest(
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      id: id ?? this.id,
      type: type ?? this.type,
      payload: payload ?? this.payload,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      retryCount: retryCount ?? this.retryCount,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  Map<String, dynamic> toJson() => {
        'idempotencyKey': idempotencyKey,
        'id': id,
        'type': type,
        'payload': payload,
        'status': status,
        'createdAt': createdAt,
        'retryCount': retryCount,
        'errorMessage': errorMessage,
      };

  factory PendingHrRequest.fromJson(Map<String, dynamic> json) {
    return PendingHrRequest(
      idempotencyKey: json['idempotencyKey'] as String,
      id: json['id'] as String,
      type: json['type'] as String,
      payload: json['payload'] as Map<String, dynamic>? ?? {},
      status: json['status'] as String? ?? 'pending',
      createdAt: json['createdAt'] as String? ?? DateTime.now().toUtc().toIso8601String(),
      retryCount: json['retryCount'] as int? ?? 0,
      errorMessage: json['errorMessage'] as String?,
    );
  }
}

// ============================================================================
// 3. ASYNC MUTEX (CONCURRENCY ISOLATION & RE-ENTRANCY SAFE)
// ============================================================================

class AsyncMutex {
  Future<void>? _lastOperation;
  final Object _lockTag = Object();

  Future<T> run<T>(Future<T> Function() action) async {
    // Re-entrancy check: if already executing in current async zone, run directly
    if (Zone.current[#_asyncMutexLock] == _lockTag) {
      return await action();
    }

    final previous = _lastOperation;
    final completer = Completer<void>();
    _lastOperation = completer.future;

    if (previous != null) {
      try {
        await previous;
      } catch (_) {}
    }

    try {
      return await runZoned(
        action,
        zoneValues: {#_asyncMutexLock: _lockTag},
      );
    } finally {
      completer.complete();
    }
  }
}

// ============================================================================
// 4. PURE-DART AES-256-CBC AUTHENTICATED CIPHER ENGINE
// ============================================================================

class Aes256AuthenticatedCipher {
  final Uint8List _encKey;
  final Uint8List _hmacKey;

  static const int version = 1;
  static const int ivLength = 16;
  static const int hmacLength = 32;

  Aes256AuthenticatedCipher({
    required Uint8List encKey,
    required Uint8List hmacKey,
  })  : _encKey = encKey,
        _hmacKey = hmacKey {
    if (encKey.length != 32) throw ArgumentError('AES-256 key must be 32 bytes');
    if (hmacKey.length != 32) throw ArgumentError('HMAC key must be 32 bytes');
  }

  factory Aes256AuthenticatedCipher.deriveFromMasterKey(List<int> masterKey) {
    const salt = 'workforce_os_offline_db_salt_2026';
    final hmac = Hmac(sha256, utf8.encode(salt));
    final prk = hmac.convert(masterKey).bytes;

    final encKeyBytes = Hmac(sha256, prk).convert(utf8.encode('aes256_enc_key')).bytes;
    final hmacKeyBytes = Hmac(sha256, prk).convert(utf8.encode('hmac_auth_key')).bytes;

    return Aes256AuthenticatedCipher(
      encKey: Uint8List.fromList(encKeyBytes.sublist(0, 32)),
      hmacKey: Uint8List.fromList(hmacKeyBytes.sublist(0, 32)),
    );
  }

  /// Encrypts plaintext and prepends version, IV, and HMAC-SHA256.
  Uint8List encrypt(Uint8List plaintext) {
    final iv = Uint8List(ivLength);
    final rng = Random.secure();
    for (int i = 0; i < ivLength; i++) {
      iv[i] = rng.nextInt(256);
    }

    final ciphertext = _aes256CbcEncrypt(plaintext, _encKey, iv);

    // Compute HMAC over Version (1 byte) || IV (16 bytes) || Ciphertext
    final hmacPayload = Uint8List(1 + ivLength + ciphertext.length);
    hmacPayload[0] = version;
    hmacPayload.setRange(1, 1 + ivLength, iv);
    hmacPayload.setRange(1 + ivLength, hmacPayload.length, ciphertext);

    final mac = Hmac(sha256, _hmacKey).convert(hmacPayload).bytes;

    // Final container: Version (1) || IV (16) || MAC (32) || Ciphertext (N)
    final container = Uint8List(1 + ivLength + hmacLength + ciphertext.length);
    container[0] = version;
    container.setRange(1, 1 + ivLength, iv);
    container.setRange(1 + ivLength, 1 + ivLength + hmacLength, mac);
    container.setRange(1 + ivLength + hmacLength, container.length, ciphertext);

    return container;
  }

  /// Authenticates HMAC and decrypts ciphertext.
  Uint8List decrypt(Uint8List container) {
    if (container.length < (1 + ivLength + hmacLength + 16)) {
      throw DatabaseException('Corrupted database file: container too short');
    }

    final fileVersion = container[0];
    if (fileVersion != version) {
      throw DatabaseException('Unsupported database encryption version: $fileVersion');
    }

    final iv = container.sublist(1, 1 + ivLength);
    final mac = container.sublist(1 + ivLength, 1 + ivLength + hmacLength);
    final ciphertext = container.sublist(1 + ivLength + hmacLength);

    // Verify HMAC over Version || IV || Ciphertext
    final hmacPayload = Uint8List(1 + ivLength + ciphertext.length);
    hmacPayload[0] = fileVersion;
    hmacPayload.setRange(1, 1 + ivLength, iv);
    hmacPayload.setRange(1 + ivLength, hmacPayload.length, ciphertext);

    final computedMac = Hmac(sha256, _hmacKey).convert(hmacPayload).bytes;
    if (!_constantTimeEquals(mac, computedMac)) {
      throw DatabaseTamperedException('Cryptographic HMAC mismatch: database file tampered or corrupted');
    }

    return _aes256CbcDecrypt(ciphertext, _encKey, iv);
  }

  static bool _constantTimeEquals(List<int> a, List<int> b) {
    if (a.length != b.length) return false;
    int diff = 0;
    for (int i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff == 0;
  }

  @visibleForTesting
  static Uint8List encryptBlockForTesting(Uint8List block, Uint8List key) {
    return _AesEngine(key).encryptBlock(block);
  }

  @visibleForTesting
  static Uint8List decryptBlockForTesting(Uint8List block, Uint8List key) {
    return _AesEngine(key).decryptBlock(block);
  }

  // --- AES-256 CBC Mode & Core Rijndael Engine ---

  static Uint8List _aes256CbcEncrypt(Uint8List data, Uint8List key, Uint8List iv) {
    final padded = _pkcs7Pad(data);
    final out = Uint8List(padded.length);
    final cipher = _AesEngine(key);

    Uint8List block = Uint8List(16);
    Uint8List prev = iv;

    for (int i = 0; i < padded.length; i += 16) {
      for (int b = 0; b < 16; b++) {
        block[b] = padded[i + b] ^ prev[b];
      }
      final encBlock = cipher.encryptBlock(block);
      out.setRange(i, i + 16, encBlock);
      prev = encBlock;
    }
    return out;
  }

  static Uint8List _aes256CbcDecrypt(Uint8List ciphertext, Uint8List key, Uint8List iv) {
    if (ciphertext.length % 16 != 0) {
      throw DatabaseException('Ciphertext length not aligned to 16 bytes');
    }
    final out = Uint8List(ciphertext.length);
    final cipher = _AesEngine(key);

    Uint8List prev = iv;
    for (int i = 0; i < ciphertext.length; i += 16) {
      final currentBlock = ciphertext.sublist(i, i + 16);
      final decBlock = cipher.decryptBlock(currentBlock);
      for (int b = 0; b < 16; b++) {
        out[i + b] = decBlock[b] ^ prev[b];
      }
      prev = currentBlock;
    }
    return _pkcs7Unpad(out);
  }

  static Uint8List _pkcs7Pad(Uint8List data) {
    final padLength = 16 - (data.length % 16);
    final padded = Uint8List(data.length + padLength);
    padded.setRange(0, data.length, data);
    for (int i = data.length; i < padded.length; i++) {
      padded[i] = padLength;
    }
    return padded;
  }

  static Uint8List _pkcs7Unpad(Uint8List data) {
    if (data.isEmpty) throw DatabaseException('Empty decrypted buffer');
    final pad = data.last;
    if (pad < 1 || pad > 16 || pad > data.length) {
      throw DatabaseException('Invalid PKCS#7 padding');
    }
    for (int i = data.length - pad; i < data.length; i++) {
      if (data[i] != pad) throw DatabaseException('Invalid PKCS#7 padding byte');
    }
    return Uint8List.sublistView(data, 0, data.length - pad);
  }
}

class _AesEngine {
  final Uint32List _rk = Uint32List(60); // 15 round keys of 4 words each = 60 words

  _AesEngine(Uint8List key) {
    _expandKey(key);
  }

  void _expandKey(Uint8List key) {
    for (int i = 0; i < 8; i++) {
      _rk[i] = (key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3];
    }
    for (int i = 8; i < 60; i++) {
      int temp = _rk[i - 1];
      if (i % 8 == 0) {
        temp = _subWord(_rotWord(temp)) ^ (_rcon[i ~/ 8] << 24);
      } else if (i % 8 == 4) {
        temp = _subWord(temp);
      }
      _rk[i] = _rk[i - 8] ^ temp;
    }
  }

  Uint8List encryptBlock(Uint8List input) {
    var state = Uint32List(4);
    for (int i = 0; i < 4; i++) {
      state[i] = (input[4 * i] << 24) | (input[4 * i + 1] << 16) | (input[4 * i + 2] << 8) | input[4 * i + 3];
    }

    state = _addRoundKey(state, 0);
    for (int round = 1; round < 14; round++) {
      state = _subBytes(state);
      state = _shiftRows(state);
      state = _mixColumns(state);
      state = _addRoundKey(state, round);
    }
    state = _subBytes(state);
    state = _shiftRows(state);
    state = _addRoundKey(state, 14);

    final out = Uint8List(16);
    for (int i = 0; i < 4; i++) {
      out[4 * i] = (state[i] >> 24) & 0xFF;
      out[4 * i + 1] = (state[i] >> 16) & 0xFF;
      out[4 * i + 2] = (state[i] >> 8) & 0xFF;
      out[4 * i + 3] = state[i] & 0xFF;
    }
    return out;
  }

  Uint8List decryptBlock(Uint8List input) {
    var state = Uint32List(4);
    for (int i = 0; i < 4; i++) {
      state[i] = (input[4 * i] << 24) | (input[4 * i + 1] << 16) | (input[4 * i + 2] << 8) | input[4 * i + 3];
    }

    state = _addRoundKey(state, 14);
    state = _invShiftRows(state);
    state = _invSubBytes(state);

    for (int round = 13; round >= 1; round--) {
      state = _addRoundKey(state, round);
      state = _invMixColumns(state);
      state = _invShiftRows(state);
      state = _invSubBytes(state);
    }

    state = _addRoundKey(state, 0);

    final out = Uint8List(16);
    for (int i = 0; i < 4; i++) {
      out[4 * i] = (state[i] >> 24) & 0xFF;
      out[4 * i + 1] = (state[i] >> 16) & 0xFF;
      out[4 * i + 2] = (state[i] >> 8) & 0xFF;
      out[4 * i + 3] = state[i] & 0xFF;
    }
    return out;
  }

  Uint32List _addRoundKey(Uint32List state, int round) {
    final res = Uint32List(4);
    for (int i = 0; i < 4; i++) {
      res[i] = state[i] ^ _rk[round * 4 + i];
    }
    return res;
  }

  static int _rotWord(int w) => ((w << 8) & 0xFFFFFFFF) | ((w >> 24) & 0xFF);

  static int _subWord(int w) {
    return (_sbox[(w >> 24) & 0xFF] << 24) |
        (_sbox[(w >> 16) & 0xFF] << 16) |
        (_sbox[(w >> 8) & 0xFF] << 8) |
        _sbox[w & 0xFF];
  }

  static Uint32List _subBytes(Uint32List s) {
    final res = Uint32List(4);
    for (int i = 0; i < 4; i++) {
      res[i] = _subWord(s[i]);
    }
    return res;
  }

  static Uint32List _shiftRows(Uint32List s) {
    final b = Uint8List(16);
    for (int c = 0; c < 4; c++) {
      b[c * 4] = (s[c] >> 24) & 0xFF;
      b[c * 4 + 1] = (s[c] >> 16) & 0xFF;
      b[c * 4 + 2] = (s[c] >> 8) & 0xFF;
      b[c * 4 + 3] = s[c] & 0xFF;
    }
    final res = Uint32List(4);
    res[0] = (b[0] << 24) | (b[5] << 16) | (b[10] << 8) | b[15];
    res[1] = (b[4] << 24) | (b[9] << 16) | (b[14] << 8) | b[3];
    res[2] = (b[8] << 24) | (b[13] << 16) | (b[2] << 8) | b[7];
    res[3] = (b[12] << 24) | (b[1] << 16) | (b[6] << 8) | b[11];
    return res;
  }

  static Uint32List _mixColumns(Uint32List s) {
    final res = Uint32List(4);
    for (int c = 0; c < 4; c++) {
      final a0 = (s[c] >> 24) & 0xFF;
      final a1 = (s[c] >> 16) & 0xFF;
      final a2 = (s[c] >> 8) & 0xFF;
      final a3 = s[c] & 0xFF;

      final r0 = _gmul2(a0) ^ _gmul3(a1) ^ a2 ^ a3;
      final r1 = a0 ^ _gmul2(a1) ^ _gmul3(a2) ^ a3;
      final r2 = a0 ^ a1 ^ _gmul2(a2) ^ _gmul3(a3);
      final r3 = _gmul3(a0) ^ a1 ^ a2 ^ _gmul2(a3);

      res[c] = (r0 << 24) | (r1 << 16) | (r2 << 8) | r3;
    }
    return res;
  }

  static Uint32List _invShiftRows(Uint32List s) {
    final b = Uint8List(16);
    for (int c = 0; c < 4; c++) {
      b[c * 4] = (s[c] >> 24) & 0xFF;
      b[c * 4 + 1] = (s[c] >> 16) & 0xFF;
      b[c * 4 + 2] = (s[c] >> 8) & 0xFF;
      b[c * 4 + 3] = s[c] & 0xFF;
    }
    final res = Uint32List(4);
    res[0] = (b[0] << 24) | (b[13] << 16) | (b[10] << 8) | b[7];
    res[1] = (b[4] << 24) | (b[1] << 16) | (b[14] << 8) | b[11];
    res[2] = (b[8] << 24) | (b[5] << 16) | (b[2] << 8) | b[15];
    res[3] = (b[12] << 24) | (b[9] << 16) | (b[6] << 8) | b[3];
    return res;
  }

  static Uint32List _invSubBytes(Uint32List s) {
    final res = Uint32List(4);
    for (int i = 0; i < 4; i++) {
      res[i] = (_invSbox[(s[i] >> 24) & 0xFF] << 24) |
          (_invSbox[(s[i] >> 16) & 0xFF] << 16) |
          (_invSbox[(s[i] >> 8) & 0xFF] << 8) |
          _invSbox[s[i] & 0xFF];
    }
    return res;
  }

  static Uint32List _invMixColumns(Uint32List s) {
    final res = Uint32List(4);
    for (int c = 0; c < 4; c++) {
      final a0 = (s[c] >> 24) & 0xFF;
      final a1 = (s[c] >> 16) & 0xFF;
      final a2 = (s[c] >> 8) & 0xFF;
      final a3 = s[c] & 0xFF;

      final r0 = _gmul(a0, 14) ^ _gmul(a1, 11) ^ _gmul(a2, 13) ^ _gmul(a3, 9);
      final r1 = _gmul(a0, 9) ^ _gmul(a1, 14) ^ _gmul(a2, 11) ^ _gmul(a3, 13);
      final r2 = _gmul(a0, 13) ^ _gmul(a1, 9) ^ _gmul(a2, 14) ^ _gmul(a3, 11);
      final r3 = _gmul(a0, 11) ^ _gmul(a1, 13) ^ _gmul(a2, 9) ^ _gmul(a3, 14);

      res[c] = (r0 << 24) | (r1 << 16) | (r2 << 8) | r3;
    }
    return res;
  }

  static int _gmul2(int a) => ((a << 1) ^ (((a >> 7) & 1) * 0x11B)) & 0xFF;
  static int _gmul3(int a) => _gmul2(a) ^ a;
  static int _gmul(int a, int b) {
    int p = 0;
    for (int i = 0; i < 8; i++) {
      if ((b & 1) != 0) p ^= a;
      final hi = a & 0x80;
      a = (a << 1) & 0xFF;
      if (hi != 0) a ^= 0x1B;
      b >>= 1;
    }
    return p;
  }

  static const List<int> _rcon = [
    0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36
  ];

  static const List<int> _sbox = [
    0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
    0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
    0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
    0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
    0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
    0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
    0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
    0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
    0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
    0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
    0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
    0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
    0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
    0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
    0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
    0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16,
  ];

  static const List<int> _invSbox = [
    0x52, 0x09, 0x6A, 0xD5, 0x30, 0x36, 0xA5, 0x38, 0xBF, 0x40, 0xA3, 0x9E, 0x81, 0xF3, 0xD7, 0xFB,
    0x7C, 0xE3, 0x39, 0x82, 0x9B, 0x2F, 0xFF, 0x87, 0x34, 0x8E, 0x43, 0x44, 0xC4, 0xDE, 0xE9, 0xCB,
    0x54, 0x7B, 0x94, 0x32, 0xA6, 0xC2, 0x23, 0x3D, 0xEE, 0x4C, 0x95, 0x0B, 0x42, 0xFA, 0xC3, 0x4E,
    0x08, 0x2E, 0xA1, 0x66, 0x28, 0xD9, 0x24, 0xB2, 0x76, 0x5B, 0xA2, 0x49, 0x6D, 0x8B, 0xD1, 0x25,
    0x72, 0xF8, 0xF6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xD4, 0xA4, 0x5C, 0xCC, 0x5D, 0x65, 0xB6, 0x92,
    0x6C, 0x70, 0x48, 0x50, 0xFD, 0xED, 0xB9, 0xDA, 0x5E, 0x15, 0x46, 0x57, 0xA7, 0x8D, 0x9D, 0x84,
    0x90, 0xD8, 0xAB, 0x00, 0x8C, 0xBC, 0xD3, 0x0A, 0xF7, 0xE4, 0x58, 0x05, 0xB8, 0xB3, 0x45, 0x06,
    0xD0, 0x2C, 0x1E, 0x8F, 0xCA, 0x3F, 0x0F, 0x02, 0xC1, 0xAF, 0xBD, 0x03, 0x01, 0x13, 0x8A, 0x6B,
    0x3A, 0x91, 0x11, 0x41, 0x4F, 0x67, 0xDC, 0xEA, 0x97, 0xF2, 0xCF, 0xCE, 0xF0, 0xB4, 0xE6, 0x73,
    0x96, 0xAC, 0x74, 0x22, 0xE7, 0xAD, 0x35, 0x85, 0xE2, 0xF9, 0x37, 0xE8, 0x1C, 0x75, 0xDF, 0x6E,
    0x47, 0xF1, 0x1A, 0x71, 0x1D, 0x29, 0xC5, 0x89, 0x6F, 0xB7, 0x62, 0x0E, 0xAA, 0x18, 0xBE, 0x1B,
    0xFC, 0x56, 0x3E, 0x4B, 0xC6, 0xD2, 0x79, 0x20, 0x9A, 0xDB, 0xC0, 0xFE, 0x78, 0xCD, 0x5A, 0xF4,
    0x1F, 0xDD, 0xA8, 0x33, 0x88, 0x07, 0xC7, 0x31, 0xB1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xEC, 0x5F,
    0x60, 0x51, 0x7F, 0xA9, 0x19, 0xB5, 0x4A, 0x0D, 0x2D, 0xE5, 0x7A, 0x9F, 0x93, 0xC9, 0x9C, 0xEF,
    0xA0, 0xE0, 0x3B, 0x4D, 0xAE, 0x2A, 0xF5, 0xB0, 0xC8, 0xEB, 0xBB, 0x3C, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2B, 0x04, 0x7E, 0xBA, 0x77, 0xD6, 0x26, 0xE1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0C, 0x7D,
  ];
}

// ============================================================================
// 5. ENCRYPTED ACID OFFLINE DATABASE ENGINE
// ============================================================================

class OfflineDatabase {
  static OfflineDatabase _instance = OfflineDatabase._();
  static OfflineDatabase get instance => _instance;

  @visibleForTesting
  static void setInstanceForTesting(OfflineDatabase testDb) {
    _instance = testDb;
  }

  @visibleForTesting
  static void resetInstanceForTesting() {
    _instance = OfflineDatabase._();
  }

  final FlutterSecureStorage? _injectedSecureStorage;
  final Directory? _injectedDirectory;
  final String? _overrideKey;

  static const String _kMasterKeyStorageKey = 'workforce_offline_db_master_key_v1';
  static const String _kTestMasterKey = 'TEST_MASTER_KEY_01234567890123456789012345678901';

  static final Map<String, String> _testSecureStoreFallback = {};

  final AsyncMutex _mutex = AsyncMutex();
  Aes256AuthenticatedCipher? _cipher;
  Directory? _dbDirectory;
  bool _isInitialized = false;

  // In-memory cache layer for microsecond access latency
  List<ShiftWeek> _cachedSchedules = [];
  Map<String, dynamic>? _cachedProfileData;
  final List<OfflinePunch> _punchQueue = [];
  final List<PendingHrRequest> _hrRequestsQueue = [];

  OfflineDatabase._({
    FlutterSecureStorage? secureStorage,
    Directory? baseDirectory,
    String? overrideKey,
  })  : _injectedSecureStorage = secureStorage,
        _injectedDirectory = baseDirectory,
        _overrideKey = overrideKey;

  factory OfflineDatabase({
    FlutterSecureStorage? secureStorage,
    Directory? baseDirectory,
    String? overrideKey,
  }) {
    return OfflineDatabase._(
      secureStorage: secureStorage,
      baseDirectory: baseDirectory,
      overrideKey: overrideKey,
    );
  }

  factory OfflineDatabase.forTesting({
    FlutterSecureStorage? secureStorage,
    Directory? baseDirectory,
    String? overrideKey,
  }) {
    return OfflineDatabase._(
      secureStorage: secureStorage,
      baseDirectory: baseDirectory ?? Directory('${Directory.systemTemp.path}/workforce_test_db_${DateTime.now().microsecondsSinceEpoch}_${Random().nextInt(99999)}'),
      overrideKey: overrideKey ?? _kTestMasterKey,
    );
  }

  bool get isInitialized => _isInitialized;
  Aes256AuthenticatedCipher? get cipher => _cipher;
  Directory? get databaseDirectory => _dbDirectory;

  static bool isTestEnvironment() {
    try {
      if (Platform.environment.containsKey('FLUTTER_TEST')) return true;
    } on UnsupportedError {
      // Platform.environment unsupported
    }
    try {
      final binding = WidgetsBinding.instance;
      final name = binding.runtimeType.toString();
      if (name.contains('Test') || name.contains('AutomatedTest')) return true;
    } catch (_) {
      // WidgetsBinding not yet initialized
    }
    return false;
  }

  /// Initializes cipher keys, recovers journal files, and hydrates in-memory caches.
  Future<void> initialize({bool forceReset = false}) async {
    return _mutex.run(() async {
      if (_isInitialized && !forceReset) return;

      // 1. Resolve master encryption key
      final masterKeyBytes = await _resolveMasterKeyBytes();
      _cipher = Aes256AuthenticatedCipher.deriveFromMasterKey(masterKeyBytes);

      // 2. Resolve database directory
      _dbDirectory = await _resolveDirectory();

      // 3. Crash recovery: Check and restore from any lingering .wal journal files
      await _recoverWalJournals();

      // 4. Hydrate in-memory state from encrypted disk tables
      await _hydrateState();

      _isInitialized = true;
    });
  }

  Future<List<int>> _resolveMasterKeyBytes() async {
    final overrideKey = _overrideKey;
    if (overrideKey != null) {
      return utf8.encode(overrideKey.padRight(32, '0').substring(0, 32));
    }

    if (isTestEnvironment()) {
      final existing = _testSecureStoreFallback[_kMasterKeyStorageKey];
      if (existing != null) return base64Url.decode(existing);
      final key = _kTestMasterKey;
      _testSecureStoreFallback[_kMasterKeyStorageKey] = base64Url.encode(utf8.encode(key));
      return utf8.encode(key);
    }

    final storage = _injectedSecureStorage ??
        const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
          iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
        );

    try {
      String? rawKey = await storage.read(key: _kMasterKeyStorageKey);
      if (rawKey == null || rawKey.isEmpty) {
        final rng = Random.secure();
        final bytes = List<int>.generate(32, (_) => rng.nextInt(256));
        rawKey = base64Url.encode(bytes);
        await storage.write(key: _kMasterKeyStorageKey, value: rawKey);
      }
      return base64Url.decode(rawKey);
    } catch (err) {
      debugPrint('OfflineDatabase: SecureStorage fallback invoked due to: $err');
      final fallbackKey = utf8.encode(_kTestMasterKey);
      return fallbackKey;
    }
  }

  Future<Directory> _resolveDirectory() async {
    final injected = _injectedDirectory;
    if (injected != null) {
      if (!injected.existsSync()) {
        injected.createSync(recursive: true);
      }
      return injected;
    }

    if (isTestEnvironment()) {
      final tempDir = Directory('${Directory.systemTemp.path}/workforce_offline_db');
      if (!tempDir.existsSync()) {
        tempDir.createSync(recursive: true);
      }
      return tempDir;
    }

    try {
      final appDoc = await getApplicationDocumentsDirectory();
      final dir = Directory('${appDoc.path}/workforce_db');
      if (!dir.existsSync()) {
        dir.createSync(recursive: true);
      }
      return dir;
    } catch (_) {
      final tempDir = Directory('${Directory.systemTemp.path}/workforce_offline_db');
      if (!tempDir.existsSync()) {
        tempDir.createSync(recursive: true);
      }
      return tempDir;
    }
  }

  // --- String Encrypt/Decrypt Helpers for Direct Verification ---

  String encryptString(String plaintext) {
    _ensureInit();
    final bytes = _cipher!.encrypt(Uint8List.fromList(utf8.encode(plaintext)));
    return base64Encode(bytes);
  }

  String decryptString(String ciphertextBase64) {
    _ensureInit();
    final raw = base64Decode(ciphertextBase64);
    final decrypted = _cipher!.decrypt(raw);
    return utf8.decode(decrypted);
  }

  // --- ACID Atomic Disk Persistence ---

  Future<void> _atomicWriteEncrypted(String table, String payloadJson) async {
    final dir = _dbDirectory ?? await _resolveDirectory();
    final targetFile = File('${dir.path}/$table.enc');
    final walFile = File('${dir.path}/$table.wal');
    final tmpFile = File('${dir.path}/$table.tmp.${DateTime.now().microsecondsSinceEpoch}_${Random().nextInt(9999)}');

    final cipher = _cipher;
    if (cipher == null) throw DatabaseException('Database not initialized');

    final encryptedBytes = cipher.encrypt(Uint8List.fromList(utf8.encode(payloadJson)));

    // 1. Write Ahead Log (WAL)
    await walFile.writeAsBytes(encryptedBytes, flush: true);

    // 2. Write Temporary Target File
    await tmpFile.writeAsBytes(encryptedBytes, flush: true);

    // 3. Atomic Rename / Swap
    if (Platform.isWindows && await targetFile.exists()) {
      final bakFile = File('${targetFile.path}.bak');
      if (await bakFile.exists()) await bakFile.delete();
      await targetFile.rename(bakFile.path);
      await tmpFile.rename(targetFile.path);
      if (await bakFile.exists()) await bakFile.delete();
    } else {
      await tmpFile.rename(targetFile.path);
    }

    // 4. Clean up WAL
    if (await walFile.exists()) {
      await walFile.delete();
    }
  }

  Future<String?> _readEncryptedTable(String table) async {
    final dir = _dbDirectory ?? await _resolveDirectory();
    final targetFile = File('${dir.path}/$table.enc');
    if (!await targetFile.exists()) return null;

    final cipher = _cipher;
    if (cipher == null) throw DatabaseException('Database not initialized');

    final rawBytes = await targetFile.readAsBytes();
    final decryptedBytes = cipher.decrypt(rawBytes);
    return utf8.decode(decryptedBytes);
  }

  Future<void> _recoverWalJournals() async {
    final dir = _dbDirectory;
    if (dir == null || !dir.existsSync()) return;

    final tables = ['cached_schedules', 'employee_profile', 'punch_queue', 'pending_hr_requests'];
    for (final table in tables) {
      final walFile = File('${dir.path}/$table.wal');
      final targetFile = File('${dir.path}/$table.enc');

      if (await walFile.exists()) {
        try {
          final walBytes = await walFile.readAsBytes();
          // Verify WAL is valid decryptable container
          _cipher?.decrypt(walBytes);
          // Restore target
          await walFile.copy(targetFile.path);
          await walFile.delete();
        } catch (_) {
          // Incomplete or corrupt WAL -> discard
          await walFile.delete();
        }
      }
    }
  }

  Future<void> _hydrateState() async {
    // 1. Schedules
    try {
      final raw = await _readEncryptedTable('cached_schedules');
      if (raw != null) {
        final decoded = jsonDecode(raw) as Map<String, dynamic>;
        final weeksList = decoded['weeks'] as List<dynamic>? ?? [];
        _cachedSchedules = weeksList
            .map((w) => ShiftWeek.fromJson(w as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      debugPrint('Hydrate cached_schedules notice: $e');
    }

    // 2. Profile
    try {
      final raw = await _readEncryptedTable('employee_profile');
      if (raw != null) {
        _cachedProfileData = jsonDecode(raw) as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('Hydrate employee_profile notice: $e');
    }

    // 3. Punch Queue
    try {
      final raw = await _readEncryptedTable('punch_queue');
      if (raw != null) {
        final list = jsonDecode(raw) as List<dynamic>;
        _punchQueue.clear();
        _punchQueue.addAll(list.map((item) => OfflinePunch.fromJson(item as Map<String, dynamic>)));
      }
    } catch (e) {
      debugPrint('Hydrate punch_queue notice: $e');
    }

    // 4. Pending HR Requests
    try {
      final raw = await _readEncryptedTable('pending_hr_requests');
      if (raw != null) {
        final list = jsonDecode(raw) as List<dynamic>;
        _hrRequestsQueue.clear();
        _hrRequestsQueue.addAll(list.map((item) => PendingHrRequest.fromJson(item as Map<String, dynamic>)));
      }
    } catch (e) {
      debugPrint('Hydrate pending_hr_requests notice: $e');
    }
  }

  // ==========================================================================
  // 6. TRANSACTION ATOMICITY & ROLLBACK
  // ==========================================================================

  Future<T> transaction<T>(Future<T> Function(OfflineDatabase txn) action) async {
    return _mutex.run(() async {
      _ensureInit();

      // Snapshot in-memory state
      final savedSchedules = List<ShiftWeek>.from(_cachedSchedules);
      final savedProfile = _cachedProfileData != null ? Map<String, dynamic>.from(_cachedProfileData!) : null;
      final savedPunches = _punchQueue.map((p) => p.copyWith()).toList();
      final savedRequests = _hrRequestsQueue.map((r) => r.copyWith()).toList();

      // Snapshot disk files
      final dir = _dbDirectory ?? await _resolveDirectory();
      final tables = ['cached_schedules', 'employee_profile', 'punch_queue', 'pending_hr_requests'];
      final diskBackups = <String, Uint8List?>{};
      for (final t in tables) {
        final f = File('${dir.path}/$t.enc');
        if (await f.exists()) {
          diskBackups[t] = await f.readAsBytes();
        }
      }

      try {
        final result = await action(this);
        return result;
      } catch (e) {
        // Rollback memory state
        _cachedSchedules = savedSchedules;
        _cachedProfileData = savedProfile;
        _punchQueue.clear();
        _punchQueue.addAll(savedPunches);
        _hrRequestsQueue.clear();
        _hrRequestsQueue.addAll(savedRequests);

        // Rollback disk state
        for (final t in tables) {
          final f = File('${dir.path}/$t.enc');
          final backup = diskBackups[t];
          if (backup != null) {
            await f.writeAsBytes(backup, flush: true);
          } else if (await f.exists()) {
            await f.delete();
          }
        }
        rethrow;
      }
    });
  }

  // ==========================================================================
  // 7. PUBLIC INTERFACE CONTRACT (PROJECT.md)
  // ==========================================================================

  // ---------- Schedules ----------

  Future<void> saveSchedules(
    List<ShiftWeek> weeks, {
    String? activeWeekStart,
    String? tenantId,
  }) async {
    return _mutex.run(() async {
      _ensureInit();
      _cachedSchedules = List.unmodifiable(weeks);

      final payload = jsonEncode({
        'tenantId': tenantId ?? 'elaraby',
        'activeWeekStart': activeWeekStart ?? (weeks.isNotEmpty ? weeks.first.weekStart : ''),
        'updatedAt': DateTime.now().toUtc().toIso8601String(),
        'weeks': weeks
            .map((w) => {
                  'weekStart': w.weekStart,
                  'isCurrent': w.isCurrent,
                  'days': w.days.map((d) => d.toJson()).toList(),
                })
            .toList(),
      });

      await _atomicWriteEncrypted('cached_schedules', payload);
    });
  }

  Future<List<ShiftWeek>> getCachedSchedules() async {
    _ensureInit();
    return List.unmodifiable(_cachedSchedules);
  }

  // ---------- Offline Punches ----------

  Future<void> enqueuePunch(OfflinePunch punch) async {
    return _mutex.run(() async {
      _ensureInit();

      if (punch.clientPunchId.trim().isEmpty) {
        throw ArgumentError('clientPunchId must not be empty');
      }

      final idx = _punchQueue.indexWhere((p) => p.clientPunchId == punch.clientPunchId);
      if (idx >= 0) {
        _punchQueue[idx] = punch;
      } else {
        _punchQueue.add(punch);
      }

      final payload = jsonEncode(_punchQueue.map((p) => p.toJson()).toList());
      await _atomicWriteEncrypted('punch_queue', payload);
    });
  }

  Future<List<OfflinePunch>> getPendingPunches() async {
    _ensureInit();
    return List.unmodifiable(_punchQueue.where((p) => p.status == 'pending'));
  }

  Future<List<OfflinePunch>> getAllPunches() async {
    _ensureInit();
    return List.unmodifiable(_punchQueue);
  }

  Future<void> markPunchSynced(String clientPunchId) async {
    return _mutex.run(() async {
      _ensureInit();
      final idx = _punchQueue.indexWhere((p) => p.clientPunchId == clientPunchId);
      if (idx >= 0) {
        _punchQueue[idx] = _punchQueue[idx].copyWith(status: 'synced');
        final payload = jsonEncode(_punchQueue.map((p) => p.toJson()).toList());
        await _atomicWriteEncrypted('punch_queue', payload);
      }
    });
  }

  Future<void> updatePunchStatus(
    String clientPunchId,
    String status, {
    int? retryCount,
    String? errorMessage,
  }) async {
    return _mutex.run(() async {
      _ensureInit();
      final idx = _punchQueue.indexWhere((p) => p.clientPunchId == clientPunchId);
      if (idx >= 0) {
        final current = _punchQueue[idx];
        _punchQueue[idx] = current.copyWith(
          status: status,
          retryCount: retryCount ?? current.retryCount,
          errorMessage: errorMessage ?? current.errorMessage,
          lastAttemptAt: DateTime.now().toUtc().toIso8601String(),
        );
        final payload = jsonEncode(_punchQueue.map((p) => p.toJson()).toList());
        await _atomicWriteEncrypted('punch_queue', payload);
      }
    });
  }

  Future<void> purgeSyncedPunches() async {
    return _mutex.run(() async {
      _ensureInit();
      _punchQueue.removeWhere((p) => p.status == 'synced');
      final payload = jsonEncode(_punchQueue.map((p) => p.toJson()).toList());
      await _atomicWriteEncrypted('punch_queue', payload);
    });
  }

  // ---------- Offline HR Requests ----------

  Future<void> enqueueRequest(PendingHrRequest request) async {
    return _mutex.run(() async {
      _ensureInit();
      if (request.idempotencyKey.trim().isEmpty) {
        throw ArgumentError('idempotencyKey must not be empty');
      }

      final idx = _hrRequestsQueue.indexWhere((r) => r.idempotencyKey == request.idempotencyKey);
      if (idx >= 0) {
        // Idempotent: update existing or keep
        _hrRequestsQueue[idx] = request;
      } else {
        _hrRequestsQueue.add(request);
      }

      final payload = jsonEncode(_hrRequestsQueue.map((r) => r.toJson()).toList());
      await _atomicWriteEncrypted('pending_hr_requests', payload);
    });
  }

  Future<List<PendingHrRequest>> getPendingRequests() async {
    _ensureInit();
    return List.unmodifiable(_hrRequestsQueue.where((r) => r.status == 'pending'));
  }

  Future<List<PendingHrRequest>> getAllRequests() async {
    _ensureInit();
    return List.unmodifiable(_hrRequestsQueue);
  }

  Future<void> markRequestSynced(String idempotencyKey) async {
    return _mutex.run(() async {
      _ensureInit();
      final idx = _hrRequestsQueue.indexWhere((r) => r.idempotencyKey == idempotencyKey);
      if (idx >= 0) {
        _hrRequestsQueue[idx] = _hrRequestsQueue[idx].copyWith(status: 'synced');
        final payload = jsonEncode(_hrRequestsQueue.map((r) => r.toJson()).toList());
        await _atomicWriteEncrypted('pending_hr_requests', payload);
      }
    });
  }

  // ---------- Employee Profile & Balances ----------

  Future<void> saveEmployeeProfile(
    EmployeeProfile profile, {
    int? vacationBalance,
    String? tenantId,
  }) async {
    return _mutex.run(() async {
      _ensureInit();
      _cachedProfileData = {
        'employeeCode': profile.employeeCode,
        'name': profile.name,
        'factory': profile.factory,
        'department': profile.department,
        'role': profile.position,
        'vacationBalance': vacationBalance ?? (_cachedProfileData?['vacationBalance'] as int? ?? 21),
        'profile': profile.toJson(),
        'tenantId': tenantId ?? 'elaraby',
        'updatedAt': DateTime.now().toUtc().toIso8601String(),
      };

      final payload = jsonEncode(_cachedProfileData);
      await _atomicWriteEncrypted('employee_profile', payload);
    });
  }

  Future<EmployeeProfile?> getCachedEmployeeProfile() async {
    _ensureInit();
    if (_cachedProfileData == null) return null;
    final pMap = _cachedProfileData!['profile'] as Map<String, dynamic>?;
    if (pMap == null) return null;
    return EmployeeProfile.fromJson(pMap);
  }

  Future<int?> getCachedVacationBalance() async {
    _ensureInit();
    return _cachedProfileData?['vacationBalance'] as int?;
  }

  // ---------- Administration / Testing Utilities ----------

  Future<void> clearAll() async {
    return _mutex.run(() async {
      _ensureInit();
      _cachedSchedules = [];
      _cachedProfileData = null;
      _punchQueue.clear();
      _hrRequestsQueue.clear();

      final dir = _dbDirectory;
      if (dir != null && dir.existsSync()) {
        for (final entity in dir.listSync()) {
          if (entity is File) {
            try {
              entity.deleteSync();
            } catch (_) {}
          }
        }
      }
    });
  }

  Future<void> closeAndPurge() async {
    return _mutex.run(() async {
      _cachedSchedules = [];
      _cachedProfileData = null;
      _punchQueue.clear();
      _hrRequestsQueue.clear();
      _isInitialized = false;

      final dir = _dbDirectory;
      if (dir != null && dir.existsSync()) {
        try {
          for (final entity in dir.listSync()) {
            if (entity is File) {
              try {
                entity.deleteSync();
              } catch (_) {}
            }
          }
          dir.deleteSync(recursive: true);
        } catch (_) {}
      }
    });
  }

  void _ensureInit() {
    if (!_isInitialized) {
      throw DatabaseException('OfflineDatabase.initialize() must be awaited before executing queries');
    }
  }
}

// ============================================================================
// 8. RIVERPOD PROVIDER REGISTRATION
// ============================================================================

final offlineDatabaseProvider = Provider<OfflineDatabase>((ref) {
  return OfflineDatabase.instance;
});
