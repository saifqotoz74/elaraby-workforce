import '../data_sources/local_storage_data_source.dart';

abstract class SessionRepository {
  bool get isOnboarded;
  Future<void> setOnboarded(bool value);
  String? get nationalId;
  Future<void> setNationalId(String id);
  Future<String?> getToken();
  Future<void> saveToken(String token);
  Future<void> clearSession();
}

class SessionRepositoryImpl implements SessionRepository {
  final LocalStorageDataSource _storage;
  static const _kOnboarded = 'onboarded';
  static const _kNationalId = 'last_national_id';
  static const _kAuthToken = 'auth_token';

  SessionRepositoryImpl({required LocalStorageDataSource storage})
      : _storage = storage;

  @override
  bool get isOnboarded => _storage.getBool(_kOnboarded) ?? false;

  @override
  Future<void> setOnboarded(bool value) async =>
      _storage.setBool(_kOnboarded, value);

  @override
  String? get nationalId => _storage.getString(_kNationalId);

  @override
  Future<void> setNationalId(String id) async =>
      _storage.setString(_kNationalId, id);

  @override
  Future<String?> getToken() => _storage.readSecure(_kAuthToken);

  @override
  Future<void> saveToken(String token) =>
      _storage.writeSecure(_kAuthToken, token);

  @override
  Future<void> clearSession() async {
    await _storage.deleteSecure(_kAuthToken);
    await _storage.deleteSecure('pin_hash');
    await _storage.remove('employee_profile');
    await _storage.remove(_kOnboarded);
    await _storage.remove('survey_submitted');
    await _storage.remove('inbox_read_ids');
    await _storage.remove('request_ref_counter');
    await _storage.remove('salary_gate_fails');
    await _storage.remove('salary_gate_lockout_until');
    await _storage.reload();
  }
}
