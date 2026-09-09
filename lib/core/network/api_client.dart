import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../errors/app_error.dart';
import 'connectivity_service.dart';

/// Thin HTTP client for the Elaraby Connect backend.
///
/// Base URL defaults to:
/// 1. [overrideBaseUrl] if set programmatically.
/// 2. `--dart-define=API_BASE_URL=https://...` compile-time flag.
/// 3. Local emulator / simulator dev server (`10.0.2.2` on Android, `localhost` elsewhere).
class ApiClient {
  static final ApiClient instance = ApiClient._();
  ApiClient._();

  factory ApiClient.createForTesting({http.Client? mockClient}) {
    final clientInstance = ApiClient._();
    if (mockClient != null) {
      clientInstance.client = mockClient;
    }
    return clientInstance;
  }

  static const _kToken = 'api_token';
  static const _kNationalId = 'last_national_id';

  /// Compile-time environment variable: `--dart-define=API_BASE_URL=https://...` or `--dart-define=API_URL=https://...`
  static const String _envBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static const String _envApiUrl =
      String.fromEnvironment('API_URL', defaultValue: '');

  /// Point this at the deployed server for release builds or dynamic override.
  static String? overrideBaseUrl;

  /// Shared persistent HTTP client instance enabling TCP connection reuse (keep-alive).
  /// Can be overridden with a mock client for testing.
  http.Client client = http.Client();

  /// Global callback invoked whenever an API call receives a 401 Unauthorized (e.g. token_revoked)
  static void Function()? onSessionExpired;

  /// Programmatic flag to simulate offline mode in tests
  static bool offlineMockMode = false;

  /// Global callback invoked whenever network reachability status transitions
  static void Function(bool online)? onNetworkStateChanged;

  /// Most recent error caught during network operations
  AppError? lastError;

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  SharedPreferences? _prefs;
  String? _cachedToken;

  bool get _isTest {
    try {
      return Platform.environment.containsKey('FLUTTER_TEST');
    } on UnsupportedError {
      return false;
    }
  }

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();

    if (_isTest) {
      _cachedToken = _prefs?.getString(_kToken);
      return;
    }

    // Load token from hardware-backed secure storage.
    try {
      _cachedToken = await _secureStorage.read(key: _kToken);
    } on Exception catch (e) {
      debugPrint('ApiClient: Secure storage read error: $e');
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
        } on Exception catch (e) {
          debugPrint('ApiClient: Secure storage write error: $e');
        }
      }
      await _prefs?.remove(_kToken);
    }
  }

  /// Default live production backend deployed on Vercel
  static const String _defaultLiveUrl =
      'https://server-six-xi-42.vercel.app/api';

  String get baseUrl {
    if (overrideBaseUrl != null) return overrideBaseUrl!;
    if (_envBaseUrl.isNotEmpty) return _envBaseUrl;
    if (_envApiUrl.isNotEmpty) return _envApiUrl;
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
    if (_isTest) {
      if (value == null) {
        await _prefs?.remove(_kToken);
      } else {
        await _prefs?.setString(_kToken, value);
      }
      return;
    }
    try {
      if (value == null) {
        await _secureStorage.delete(key: _kToken);
      } else {
        await _secureStorage.write(key: _kToken, value: value);
      }
    } on Exception catch (e) {
      debugPrint('ApiClient: Secure storage write/delete error: $e');
    }
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

  /// Core HTTP dispatcher with typed domain error mapping and result encapsulation.
  Future<Result<Map<String, dynamic>, AppError>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
    Duration timeout = const Duration(seconds: 6),
  }) async {
    lastError = null;
    if (offlineMockMode || !ConnectivityService.instance.isOnline) {
      onNetworkStateChanged?.call(false);
      const err = NetworkError('Device is currently operating in offline mode');
      lastError = err;
      return const Result.failure(err);
    }

    try {
      final uri = Uri.parse('$baseUrl$path');
      final combinedHeaders = {..._headers, ...(extraHeaders ?? {})};
      final http.Response res;

      if (method.toUpperCase() == 'POST') {
        res = await client
            .post(
              uri,
              headers: combinedHeaders,
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(timeout);
      } else {
        res = await client
            .get(
              uri,
              headers: combinedHeaders,
            )
            .timeout(timeout);
      }

      onNetworkStateChanged?.call(true);

      Map<String, dynamic> json = {};
      if (res.body.isNotEmpty) {
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map<String, dynamic>) {
            json = decoded;
          }
        } on FormatException catch (fe) {
          final err = ValidationError(
            'Invalid server response format: ${fe.message}',
            cause: fe,
          );
          lastError = err;
          return Result.failure(err);
        }
      }

      if (res.statusCode == 401) {
        await setToken(null);
        onSessionExpired?.call();
        final err = UnauthorizedError(
          json['error'] as String? ?? 'Session expired or invalid credentials',
        );
        lastError = err;
        return Result.failure(err);
      }

      if (res.statusCode >= 400) {
        final err = AppError.fromResponse(res.statusCode, body: json);
        lastError = err;
        return Result.failure(err);
      }

      lastError = null;
      return Result.success(json);
    } catch (e, st) {
      final err = AppError.fromException(e, st);
      lastError = err;
      // Only signal offline state if this is genuinely a network interface/connectivity failure,
      // never for timeouts, format exceptions, or server-side drops.
      if (err.isOffline) {
        onNetworkStateChanged?.call(false);
      }
      return Result.failure(err);
    }
  }

  /// Returns decoded JSON or null on failure while recording typed [lastError].
  Future<Map<String, dynamic>?> get(
    String path, {
    Map<String, String>? extraHeaders,
    Duration timeout = const Duration(seconds: 6),
  }) async {
    final result = await request(
      'GET',
      path,
      extraHeaders: extraHeaders,
      timeout: timeout,
    );
    return result.isSuccess ? result.data : null;
  }

  /// Sends a POST request, returning JSON or structured error metadata on failure.
  Future<Map<String, dynamic>?> post(
    String path,
    Map<String, dynamic> body, {
    Duration timeout = const Duration(seconds: 6),
  }) async {
    final result = await request(
      'POST',
      path,
      body: body,
      timeout: timeout,
    );
    if (result.isSuccess) {
      return result.data;
    }

    final err = result.error!;
    return {
      '_status': err.statusCode ?? 500,
      'error': err.message,
      'code': err.code,
    };
  }
}
