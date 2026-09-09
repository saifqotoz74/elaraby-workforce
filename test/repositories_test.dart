import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/data_sources/local_storage_data_source.dart';
import 'package:elaraby_workforce/core/repositories/session_repository.dart';
import 'package:elaraby_workforce/core/repositories/settings_repository.dart';
import 'package:elaraby_workforce/core/repositories/drafts_repository.dart';
import 'package:elaraby_workforce/core/repositories/auth_repository.dart';
import 'package:elaraby_workforce/core/repositories/profile_repository.dart';
import 'package:elaraby_workforce/core/repositories/salary_repository.dart';
import 'package:elaraby_workforce/core/repositories/requests_repository.dart';
import 'package:elaraby_workforce/core/providers/repository_providers.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences prefs;
  late LocalStorageDataSource storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    storage = LocalStorageDataSource(prefs: prefs);
  });

  group('Phase 3 - Repositories & Architecture Tests', () {
    test('SessionRepository manages onboarding and token state', () async {
      final sessionRepo = SessionRepositoryImpl(storage: storage);
      expect(sessionRepo.isOnboarded, false);

      await sessionRepo.setOnboarded(true);
      expect(sessionRepo.isOnboarded, true);

      await sessionRepo.setNationalId('29801011234567');
      expect(sessionRepo.nationalId, '29801011234567');

      await sessionRepo.saveToken('jwt_test_token_123');
      expect(await sessionRepo.getToken(), 'jwt_test_token_123');

      await sessionRepo.clearSession();
      expect(sessionRepo.isOnboarded, false);
      expect(await sessionRepo.getToken(), null);
    });

    test('SettingsRepository reads and writes user preferences', () async {
      final settingsRepo = SettingsRepositoryImpl(storage: storage);
      expect(settingsRepo.biometricEnabled, true);
      expect(settingsRepo.salaryProtectionEnabled, false);
      expect(settingsRepo.themeMode, 'system');

      await settingsRepo.setSetting('salary_protection', true);
      expect(settingsRepo.salaryProtectionEnabled, true);

      await settingsRepo.setThemeMode('dark');
      expect(settingsRepo.themeMode, 'dark');

      await settingsRepo.setLocaleCode('ar');
      expect(settingsRepo.localeCode, 'ar');
    });

    test('DraftsRepository saves, retrieves and clears form drafts', () async {
      final draftsRepo = DraftsRepositoryImpl(storage: storage);
      expect(draftsRepo.getDraft('leave_request'), null);

      final testDraft = {
        'leaveType': 'Annual Leave',
        'days': 3,
        'reason': 'Family vacation'
      };
      await draftsRepo.saveDraft('leave_request', testDraft);

      final retrieved = draftsRepo.getDraft('leave_request');
      expect(retrieved, isNotNull);
      expect(retrieved!['leaveType'], 'Annual Leave');
      expect(retrieved['days'], 3);

      await draftsRepo.clearDraft('leave_request');
      expect(draftsRepo.getDraft('leave_request'), null);
    });

    test('ProfileRepository updates profile and vacation balance', () async {
      final profileRepo = ProfileRepositoryImpl(storage: storage);
      expect(profileRepo.vacationDaysRemaining, 12);

      await profileRepo.deductVacationDays(3);
      expect(profileRepo.vacationDaysRemaining, 9);

      await profileRepo.addVacationDays(2);
      expect(profileRepo.vacationDaysRemaining, 11);

      await profileRepo.setVacationBalance(15);
      expect(profileRepo.vacationDaysRemaining, 15);

      final newProfile = const EmployeeProfile(
        name: 'Saif Hossam',
        employeeCode: 'EG-99999',
      );
      await profileRepo.saveProfile(newProfile);
      expect(profileRepo.profile.name, 'Saif Hossam');
      expect(profileRepo.profile.employeeCode, 'EG-99999');
    });

    test('SalaryRepository tracks gate lockout and failed attempts', () async {
      final salaryRepo = SalaryRepositoryImpl(storage: storage);
      expect(salaryRepo.salaryGateFailedAttempts, 0);
      expect(salaryRepo.salaryGateLockoutUntil, 0);

      await salaryRepo.setSalaryGateFailedAttempts(2);
      expect(salaryRepo.salaryGateFailedAttempts, 2);

      final lockoutTime = DateTime.now().millisecondsSinceEpoch + 60000;
      await salaryRepo.setSalaryGateLockoutUntil(lockoutTime);
      expect(salaryRepo.salaryGateLockoutUntil, lockoutTime);

      await salaryRepo.resetSalaryGateLockout();
      expect(salaryRepo.salaryGateFailedAttempts, 0);
      expect(salaryRepo.salaryGateLockoutUntil, 0);
    });

    test('AuthRepository sets and verifies PIN hashes', () async {
      final authRepo = AuthRepositoryImpl(storage: storage);
      expect(await authRepo.hasPin(), false);

      await authRepo.setPin('1234');
      expect(await authRepo.hasPin(), true);
      expect(await authRepo.verifyPin('1234'), true);
      expect(await authRepo.verifyPin('0000'), false);
    });

    test('Riverpod ProviderContainer resolves all repository providers', () {
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
      );

      final sessionRepo = container.read(sessionRepositoryProvider);
      final settingsRepo = container.read(settingsRepositoryProvider);
      final draftsRepo = container.read(draftsRepositoryProvider);
      final authRepo = container.read(authRepositoryProvider);
      final profileRepo = container.read(profileRepositoryProvider);
      final salaryRepo = container.read(salaryRepositoryProvider);
      final requestsRepo = container.read(requestsRepositoryProvider);

      expect(sessionRepo, isA<SessionRepository>());
      expect(settingsRepo, isA<SettingsRepository>());
      expect(draftsRepo, isA<DraftsRepository>());
      expect(authRepo, isA<AuthRepository>());
      expect(profileRepo, isA<ProfileRepository>());
      expect(salaryRepo, isA<SalaryRepository>());
      expect(requestsRepo, isA<RequestsRepository>());
    });
  });
}
