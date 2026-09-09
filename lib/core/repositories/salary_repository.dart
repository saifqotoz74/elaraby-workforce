import '../data_sources/local_storage_data_source.dart';
import '../network/backend.dart';

abstract class SalaryRepository {
  Future<String?> unlockSalary(String pin);
  Future<Map<String, dynamic>?> fetchPayroll(
      {String? pin, String? salaryToken});
  int get salaryGateFailedAttempts;
  Future<void> setSalaryGateFailedAttempts(int count);
  int get salaryGateLockoutUntil;
  Future<void> setSalaryGateLockoutUntil(int epochMs);
  Future<void> resetSalaryGateLockout();
}

class SalaryRepositoryImpl implements SalaryRepository {
  final LocalStorageDataSource _storage;
  final Backend _backend;
  static const _kFails = 'salary_gate_fails';
  static const _kLockoutUntil = 'salary_gate_lockout_until';

  SalaryRepositoryImpl({
    required LocalStorageDataSource storage,
    Backend? backend,
  })  : _storage = storage,
        _backend = backend ?? Backend.instance;

  @override
  Future<String?> unlockSalary(String pin) => _backend.unlockSalary(pin);

  @override
  Future<Map<String, dynamic>?> fetchPayroll(
          {String? pin, String? salaryToken}) =>
      _backend.fetchPayroll(pin: pin, salaryToken: salaryToken);

  @override
  int get salaryGateFailedAttempts => _storage.getInt(_kFails) ?? 0;

  @override
  Future<void> setSalaryGateFailedAttempts(int count) =>
      _storage.setInt(_kFails, count);

  @override
  int get salaryGateLockoutUntil => _storage.getInt(_kLockoutUntil) ?? 0;

  @override
  Future<void> setSalaryGateLockoutUntil(int epochMs) =>
      _storage.setInt(_kLockoutUntil, epochMs);

  @override
  Future<void> resetSalaryGateLockout() async {
    await _storage.remove(_kFails);
    await _storage.remove(_kLockoutUntil);
  }
}
