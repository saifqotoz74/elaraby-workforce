import 'dart:convert';
import 'package:crypto/crypto.dart';
import '../data_sources/local_storage_data_source.dart';
import '../network/api_client.dart';
import '../network/backend.dart';

abstract class AuthRepository {
  Future<OtpResponse> requestOtp(String nationalIdOrPhone);
  Future<AuthResult> verifyOtp(String nationalId, String code);
  Future<bool> hasPin();
  Future<void> setPin(String pin, {String? nationalId});
  Future<bool> verifyPin(String pin);
  Future<AuthResult> changePin({
    required String currentPin,
    required String newPin,
  });
  Future<bool> deleteAccount({required String pin});
}

class AuthRepositoryImpl implements AuthRepository {
  final LocalStorageDataSource _storage;
  final ApiClient _apiClient;
  final Backend _backend;
  static const _kPinHash = 'pin_hash';
  String? _cachedPinHash;

  AuthRepositoryImpl({
    required LocalStorageDataSource storage,
    ApiClient? apiClient,
    Backend? backend,
  })  : _storage = storage,
        _apiClient = apiClient ?? ApiClient.instance,
        _backend = backend ?? Backend.instance;

  @override
  Future<OtpResponse> requestOtp(String nationalIdOrPhone) =>
      _backend.requestOtp(nationalIdOrPhone);

  @override
  Future<AuthResult> verifyOtp(String nationalId, String code) =>
      _backend.verifyOtp(nationalId, code);

  @override
  Future<bool> hasPin() async {
    if (_cachedPinHash != null) return true;
    _cachedPinHash = await _storage.readSecure(_kPinHash);
    return _cachedPinHash != null || _storage.getString(_kPinHash) != null;
  }

  @override
  Future<void> setPin(String pin, {String? nationalId}) async {
    final hashed = _hash(pin);
    _cachedPinHash = hashed;
    await _storage.writeSecure(_kPinHash, hashed);
    await _storage.remove(_kPinHash);

    // Sync to backend if nationalId is provided or stored
    final effectiveNat = nationalId ?? _apiClient.lastNationalId;
    if (effectiveNat != null && effectiveNat.isNotEmpty) {
      await _backend.setPin(effectiveNat, pin);
    }
  }

  @override
  Future<bool> verifyPin(String pin) async {
    final candidate = _hash(pin);
    final legacyCandidate = _legacyHash(pin);

    var stored = _cachedPinHash ?? await _storage.readSecure(_kPinHash);
    _cachedPinHash = stored;

    if (stored != null) {
      if (stored == candidate) return true;
      if (stored == legacyCandidate) {
        await setPin(pin);
        return true;
      }
      return false;
    }

    // Legacy fallback
    final legacyStored = _storage.getString(_kPinHash);
    if (legacyStored != null) {
      if (legacyStored == candidate || legacyStored == legacyCandidate) {
        await setPin(pin);
        return true;
      }
    }

    return false;
  }

  @override
  Future<AuthResult> changePin({
    required String currentPin,
    required String newPin,
  }) async {
    final res = await _backend.changePin(currentPin, newPin);
    if (res == AuthResult.success) {
      await setPin(newPin);
    }
    return res;
  }

  @override
  Future<bool> deleteAccount({required String pin}) =>
      _backend.deleteAccount(pin: pin);

  String _hash(String pin) {
    final salt = utf8.encode('elaraby_connect_workforce_secure_salt_v2');
    var hmac = Hmac(sha256, salt);
    var digest = hmac.convert(utf8.encode(pin)).bytes;
    for (var i = 0; i < 1000; i++) {
      digest = hmac.convert(digest).bytes;
    }
    return digest.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  String _legacyHash(String pin) =>
      sha256.convert(utf8.encode('elaraby_connect::$pin')).toString();
}
