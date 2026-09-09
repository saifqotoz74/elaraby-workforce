import 'dart:convert';
import '../data_sources/local_storage_data_source.dart';
import '../network/backend.dart';
import '../storage/local_store.dart';

abstract class ProfileRepository {
  EmployeeProfile get profile;
  bool get hasSavedProfile;
  Future<void> saveProfile(EmployeeProfile profile);
  Future<void> syncProfile();
  int get vacationDaysRemaining;
  Future<void> setVacationBalance(int days);
  Future<void> deductVacationDays(int days);
  Future<void> addVacationDays(int days);
}

class ProfileRepositoryImpl implements ProfileRepository {
  final LocalStorageDataSource _storage;
  final Backend _backend;
  static const _kProfile = 'employee_profile';
  static const _kVacationDays = 'vacation_days_remaining';
  static const defaultVacationDays = 12;
  EmployeeProfile _profile = const EmployeeProfile();

  ProfileRepositoryImpl({
    required LocalStorageDataSource storage,
    Backend? backend,
  })  : _storage = storage,
        _backend = backend ?? Backend.instance {
    _loadInitial();
  }

  void _loadInitial() {
    final raw = _storage.getString(_kProfile);
    if (raw != null) {
      try {
        _profile =
            EmployeeProfile.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } catch (_) {}
    }
  }

  @override
  EmployeeProfile get profile => _profile;

  @override
  bool get hasSavedProfile => _storage.containsKey(_kProfile);

  @override
  Future<void> saveProfile(EmployeeProfile profile) async {
    _profile = profile;
    await _storage.setString(_kProfile, jsonEncode(profile.toJson()));
  }

  @override
  Future<void> syncProfile() => _backend.syncProfile();

  @override
  int get vacationDaysRemaining =>
      _storage.getInt(_kVacationDays) ?? defaultVacationDays;

  @override
  Future<void> setVacationBalance(int days) =>
      _storage.setInt(_kVacationDays, days < 0 ? 0 : days);

  @override
  Future<void> deductVacationDays(int days) async {
    final remaining = vacationDaysRemaining - days;
    await _storage.setInt(_kVacationDays, remaining < 0 ? 0 : remaining);
  }

  @override
  Future<void> addVacationDays(int days) async {
    final remaining = vacationDaysRemaining + days;
    await _storage.setInt(_kVacationDays, remaining);
  }
}
