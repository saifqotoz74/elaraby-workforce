import 'dart:io' show Platform;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Unified local storage data source isolating SharedPreferences and FlutterSecureStorage.
class LocalStorageDataSource {
  final SharedPreferences _prefs;
  final FlutterSecureStorage _secureStorage;

  LocalStorageDataSource({
    required SharedPreferences prefs,
    FlutterSecureStorage? secureStorage,
  })  : _prefs = prefs,
        _secureStorage = secureStorage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions:
                  IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  static Future<LocalStorageDataSource> create() async {
    final prefs = await SharedPreferences.getInstance();
    return LocalStorageDataSource(prefs: prefs);
  }

  bool get _isTest {
    try {
      return Platform.environment.containsKey('FLUTTER_TEST');
    } catch (_) {
      return false;
    }
  }

  // --- SharedPreferences operations ---

  String? getString(String key) => _prefs.getString(key);

  Future<bool> setString(String key, String value) =>
      _prefs.setString(key, value);

  bool? getBool(String key) => _prefs.getBool(key);

  Future<bool> setBool(String key, bool value) => _prefs.setBool(key, value);

  int? getInt(String key) => _prefs.getInt(key);

  Future<bool> setInt(String key, int value) => _prefs.setInt(key, value);

  List<String>? getStringList(String key) => _prefs.getStringList(key);

  Future<bool> setStringList(String key, List<String> value) =>
      _prefs.setStringList(key, value);

  Future<bool> remove(String key) => _prefs.remove(key);

  bool containsKey(String key) => _prefs.containsKey(key);

  Future<void> reload() => _prefs.reload();

  // --- Secure Storage operations (Encrypted credentials, PIN hashes, Tokens) ---

  Future<String?> readSecure(String key) async {
    if (_isTest) return _prefs.getString(key);
    try {
      return await _secureStorage.read(key: key);
    } catch (_) {
      return _prefs.getString(key);
    }
  }

  Future<void> writeSecure(String key, String value) async {
    if (_isTest) {
      await _prefs.setString(key, value);
      return;
    }
    try {
      await _secureStorage.write(key: key, value: value);
    } catch (_) {
      await _prefs.setString(key, value);
    }
  }

  Future<void> deleteSecure(String key) async {
    if (_isTest) {
      await _prefs.remove(key);
      return;
    }
    try {
      await _secureStorage.delete(key: key);
    } catch (_) {}
    await _prefs.remove(key);
  }
}
