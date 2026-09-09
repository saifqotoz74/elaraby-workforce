import '../data_sources/local_storage_data_source.dart';

abstract class SettingsRepository {
  bool getSetting(String key, {bool defaultValue = false});
  Future<void> setSetting(String key, bool value);
  String get themeMode;
  Future<void> setThemeMode(String mode);
  String? get localeCode;
  Future<void> setLocaleCode(String code);
  bool get biometricEnabled;
  bool get salaryProtectionEnabled;
  bool get notificationsEnabled;
}

class SettingsRepositoryImpl implements SettingsRepository {
  final LocalStorageDataSource _storage;
  static const _kSettingsPrefix = 'setting_';
  static const _kThemeMode = 'app_theme_mode';
  static const _kLocale = 'app_locale';

  SettingsRepositoryImpl({required LocalStorageDataSource storage})
      : _storage = storage;

  @override
  bool getSetting(String key, {bool defaultValue = false}) =>
      _storage.getBool('$_kSettingsPrefix$key') ?? defaultValue;

  @override
  Future<void> setSetting(String key, bool value) =>
      _storage.setBool('$_kSettingsPrefix$key', value);

  @override
  String get themeMode => _storage.getString(_kThemeMode) ?? 'system';

  @override
  Future<void> setThemeMode(String mode) =>
      _storage.setString(_kThemeMode, mode);

  @override
  String? get localeCode => _storage.getString(_kLocale);

  @override
  Future<void> setLocaleCode(String code) => _storage.setString(_kLocale, code);

  @override
  bool get biometricEnabled => getSetting('fingerprint', defaultValue: true);

  @override
  bool get salaryProtectionEnabled =>
      getSetting('salary_protection', defaultValue: false);

  @override
  bool get notificationsEnabled =>
      getSetting('notifications', defaultValue: true);
}
