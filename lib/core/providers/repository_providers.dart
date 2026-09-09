import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../data_sources/local_storage_data_source.dart';
import '../network/api_client.dart';
import '../network/backend.dart';
import '../repositories/auth_repository.dart';
import '../repositories/drafts_repository.dart';
import '../repositories/profile_repository.dart';
import '../repositories/requests_repository.dart';
import '../repositories/salary_repository.dart';
import '../repositories/session_repository.dart';
import '../repositories/settings_repository.dart';
import '../storage/local_store.dart';

/// Overridable SharedPreferences provider (useful in tests).
final sharedPreferencesProvider = Provider<SharedPreferences?>((ref) {
  return LocalStore.instance.rawPrefs;
});

final localStorageDataSourceProvider = Provider<LocalStorageDataSource>((ref) {
  final prefs =
      ref.watch(sharedPreferencesProvider) ?? LocalStore.instance.rawPrefs;
  if (prefs == null) {
    throw StateError(
        'sharedPreferencesProvider must be overridden or LocalStore.instance.init() called');
  }
  return LocalStorageDataSource(prefs: prefs);
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient.instance;
});

final backendProvider = Provider<Backend>((ref) {
  return Backend.instance;
});

final sessionRepositoryProvider = Provider<SessionRepository>((ref) {
  final storage = ref.watch(localStorageDataSourceProvider);
  return SessionRepositoryImpl(storage: storage);
});

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  final storage = ref.watch(localStorageDataSourceProvider);
  return SettingsRepositoryImpl(storage: storage);
});

final draftsRepositoryProvider = Provider<DraftsRepository>((ref) {
  final storage = ref.watch(localStorageDataSourceProvider);
  return DraftsRepositoryImpl(storage: storage);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final storage = ref.watch(localStorageDataSourceProvider);
  final client = ref.watch(apiClientProvider);
  final backend = ref.watch(backendProvider);
  return AuthRepositoryImpl(
    storage: storage,
    apiClient: client,
    backend: backend,
  );
});

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  final storage = ref.watch(localStorageDataSourceProvider);
  final backend = ref.watch(backendProvider);
  return ProfileRepositoryImpl(
    storage: storage,
    backend: backend,
  );
});

final salaryRepositoryProvider = Provider<SalaryRepository>((ref) {
  final storage = ref.watch(localStorageDataSourceProvider);
  final backend = ref.watch(backendProvider);
  return SalaryRepositoryImpl(
    storage: storage,
    backend: backend,
  );
});

final requestsRepositoryProvider = Provider<RequestsRepository>((ref) {
  final storage = ref.watch(localStorageDataSourceProvider);
  return RequestsRepositoryImpl(storage: storage);
});
