import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Thin HTTP client for the Elaraby Connect backend.
///
/// Base URL defaults to:
/// 1. [overrideBaseUrl] if set programmatically.
/// 2. `--dart-define=API_BASE_URL=https://...` compile-time flag.
/// 3. Local emulator / simulator dev server (`10.0.2.2` on Android, `localhost` elsewhere).
class ApiClient {
  static final ApiClient instance = ApiClient._();
  ApiClient._();

  static const _kToken = 'api_token';
  static const _kNationalId = 'last_national_id';

  /// Compile-time environment variable: `--dart-define=API_BASE_URL=https://...`
  static const String _envBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  /// Point this at the deployed server for release builds or dynamic override.
  static String? overrideBaseUrl;

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  SharedPreferences? _prefs;
  String? _cachedToken;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();

    // Load token from hardware-backed secure storage.
    try {
      _cachedToken = await _secureStorage.read(key: _kToken);
    } catch (_) {
      _cachedToken = null;
    }

    // Seamless migration: if token was previously in plaintext SharedPreferences,
    // migrate to secure storage and clear from SharedPreferences.
    if (_cachedToken == null && _prefs?.containsKey(_kToken) == true) {
      final legacyToken = _prefs?.getString(_kToken);
      if (legacyToken != null && legacyToken.isNotEmpty) {
        _cachedToken = legacyToken;
        try {
          await _secureStorage.write(key: _kToken, value: legacyToken);
        } catch (_) {}
      }
      await _prefs?.remove(_kToken);
    }
  }

  /// Default live production backend deployed on Vercel
  static const String _defaultLiveUrl = 'https://server-six-xi-42.vercel.app/api';

  String get baseUrl {
    if (overrideBaseUrl != null) return overrideBaseUrl!;
    if (_envBaseUrl.isNotEmpty) return _envBaseUrl;
    return _defaultLiveUrl;
  }

  /// Resolves a server-relative path like `/uploads/x.png` to a full URL.
  String resolveUrl(String path) {
    if (path.startsWith('http')) return path;
    final root = baseUrl.endsWith('/api')
        ? baseUrl.substring(0, baseUrl.length - 4)
        : baseUrl;
    return '$root$path';
  }

  String? get token => _cachedToken;

  Future<void> setToken(String? value) async {
    _cachedToken = value;
    try {
      if (value == null) {
        await _secureStorage.delete(key: _kToken);
      } else {
        await _secureStorage.write(key: _kToken, value: value);
      }
    } catch (_) {}
    // Ensure plaintext key is never retained in SharedPreferences
    await _prefs?.remove(_kToken);
  }

  String? get lastNationalId => _prefs?.getString(_kNationalId);
  Future<void> setLastNationalId(String value) async =>
      _prefs?.setString(_kNationalId, value);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  /// Returns decoded JSON or null on any failure (offline, 4xx, 5xx).
  Future<Map<String, dynamic>?> get(
    String path, {
    Duration timeout = const Duration(seconds: 6),
  }) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl$path'),
        headers: _headers,
      ).timeout(timeout);
      if (res.statusCode >= 400) return null;
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> post(
    String path,
    Map<String, dynamic> body, {
    Duration timeout = const Duration(seconds: 6),
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl$path'),
        headers: _headers,
        body: jsonEncode(body),
      ).timeout(timeout);
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode >= 400) return {'_status': res.statusCode, ...json};
      return json;
    } catch (_) {
      return null;
    }
  }
}
