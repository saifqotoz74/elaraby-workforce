import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/data_sources/local_storage_data_source.dart';
import 'package:elaraby_workforce/core/repositories/requests_repository.dart';
import 'package:elaraby_workforce/core/repositories/salary_repository.dart';
import 'package:elaraby_workforce/core/repositories/settings_repository.dart';
import 'package:elaraby_workforce/core/state/ui_state.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/theme/app_theme.dart';
import 'package:elaraby_workforce/features/profile/presentation/controllers/settings_controller.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';
import 'package:elaraby_workforce/features/services/presentation/controllers/requests_controller.dart';
import 'package:elaraby_workforce/features/services/presentation/controllers/salary_controller.dart';

class FakeSalaryRepository implements SalaryRepository {
  bool shouldSucceed = true;
  String? validPin = '1234';
  int _attempts = 0;
  int _lockout = 0;

  @override
  int get salaryGateFailedAttempts => _attempts;

  @override
  Future<void> setSalaryGateFailedAttempts(int count) async {
    _attempts = count;
  }

  @override
  int get salaryGateLockoutUntil => _lockout;

  @override
  Future<void> setSalaryGateLockoutUntil(int epochMs) async {
    _lockout = epochMs;
  }

  @override
  Future<void> resetSalaryGateLockout() async {
    _attempts = 0;
    _lockout = 0;
  }

  @override
  Future<String?> unlockSalary(String pin) async {
    if (pin == validPin) return 'valid-salary-token-999';
    return null;
  }

  @override
  Future<Map<String, dynamic>?> fetchPayroll(
      {String? salaryToken, String? pin}) async {
    if (!shouldSucceed) {
      return {'ok': false, 'error': 'Server unavailable'};
    }
    if (salaryToken == 'valid-salary-token-999' || pin == validPin) {
      return {
        'ok': true,
        'payroll': {
          'period': 'July 2026',
          'basicSalary': 9500,
          'allowances': 1800,
          'deductions': 650,
          'paidOn': '28 Jul 2026',
          'paymentMethod': 'Bank Transfer',
        }
      };
    }
    return {'ok': false, 'error': 'Unauthorized salary access'};
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('UiState State Machine Tests', () {
    test('loading state properties', () {
      const state = UiState<String>.loading();
      expect(state.isLoading, isTrue);
      expect(state.isSuccess, isFalse);
      expect(state.hasData, isFalse);
      expect(state.data, isNull);
      expect(state.errorMessage, isNull);
    });

    test('success state properties', () {
      const state = UiState<String>.success('hello');
      expect(state.isLoading, isFalse);
      expect(state.isSuccess, isTrue);
      expect(state.hasData, isTrue);
      expect(state.data, equals('hello'));
      expect(state.errorMessage, isNull);
    });

    test('empty state properties', () {
      const state = UiState<List<int>>.empty();
      expect(state.isEmpty, isTrue);
      expect(state.isLoading, isFalse);
      expect(state.hasData, isFalse);
      expect(state.data, isNull);
    });

    test('error state without null error handling', () {
      const state = UiState<String>.error('Network timeout',
          code: 'TIMEOUT', previousData: 'cached');
      expect(state.isError, isTrue);
      expect(state.errorMessage, equals('Network timeout'));
      expect(state.errorCode, equals('TIMEOUT'));
      expect(state.hasData, isTrue);
      expect(state.data, equals('cached'));
    });

    test('refreshing state preserves data', () {
      const state = UiState<int>.refreshing(42);
      expect(state.isRefreshing, isTrue);
      expect(state.hasData, isTrue);
      expect(state.data, equals(42));
    });

    test('offline state preserves cached data', () {
      const state = UiState<String>.offline('offline-data');
      expect(state.isOffline, isTrue);
      expect(state.hasData, isTrue);
      expect(state.data, equals('offline-data'));
    });

    test('when pattern matching exhaustive coverage', () {
      const state = UiState<int>.success(100);
      final result = state.when(
        loading: (d) => 'loading',
        success: (d) => 'success:$d',
        error: (e, c, p) => 'error:$e',
        empty: () => 'empty',
        refreshing: (d) => 'refreshing:$d',
        offline: (d) => 'offline:$d',
      );
      expect(result, equals('success:100'));
    });
  });

  group('SettingsNotifier Riverpod State Tests', () {
    late SharedPreferences prefs;
    late LocalStorageDataSource storage;
    late SettingsRepository repo;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
      await LocalStore.instance.init();
      storage = LocalStorageDataSource(prefs: prefs);
      repo = SettingsRepositoryImpl(storage: storage);
    });

    test('SettingsNotifier updates toggles and theme mode reactivity',
        () async {
      final notifier = SettingsNotifier(repo);

      expect(notifier.state.biometricEnabled, isTrue);
      expect(notifier.state.salaryProtectionEnabled, isFalse);

      await notifier.setBiometric(false);
      expect(notifier.state.biometricEnabled, isFalse);
      expect(repo.biometricEnabled, isFalse);

      await notifier.setSalaryProtection(true);
      expect(notifier.state.salaryProtectionEnabled, isTrue);
      expect(repo.salaryProtectionEnabled, isTrue);

      await notifier.setNotifications(false);
      expect(notifier.state.notificationsEnabled, isFalse);
      expect(repo.notificationsEnabled, isFalse);

      await notifier.updateTheme(ThemeMode.dark);
      expect(notifier.state.themeMode, equals('dark'));
      expect(AppTheme.themeModeNotifier.value, equals(ThemeMode.dark));
    });
  });

  group('RequestsNotifier Riverpod State Tests', () {
    late SharedPreferences prefs;
    late LocalStorageDataSource storage;
    late RequestsRepository repo;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
      await LocalStore.instance.init();
      storage = LocalStorageDataSource(prefs: prefs);
      repo = RequestsRepositoryImpl(storage: storage);
      await repo.load();
    });

    test('RequestsNotifier loads requests and reflects UiState transitions',
        () async {
      final notifier = RequestsNotifier(repo);
      await notifier.loadRequests();

      expect(notifier.state.hasData || notifier.state.isEmpty, isTrue);

      final initialCount = notifier.state.data?.length ?? 0;
      final newReq = EmployeeRequest(
        id: 'req-test-1',
        type: 'Leave',
        title: 'Emergency Leave',
        refNumber: '9999',
        date: '09 Sep 2026',
        status: RequestStatus.inReview,
        details: {'Days': '1'},
        summary: 'Emergency dental leave',
      );

      notifier.addRequest(newReq, days: 1);
      expect(notifier.state.isSuccess, isTrue);
      expect(notifier.state.data!.length, equals(initialCount + 1));
      expect(notifier.state.data!.any((r) => r.id == 'req-test-1'), isTrue);

      final cancelled = await notifier.cancelRequest('req-test-1');
      expect(cancelled, isTrue);
      expect(notifier.state.data!.any((r) => r.id == 'req-test-1'), isFalse);
    });
  });

  group('SalaryNotifier Riverpod State Tests', () {
    late FakeSalaryRepository fakeRepo;

    setUp(() {
      fakeRepo = FakeSalaryRepository();
    });

    test('unlockAndFetch with valid PIN transitions to success', () async {
      final notifier = SalaryNotifier(fakeRepo);
      expect(notifier.state.isEmpty, isTrue);

      await notifier.unlockAndFetch('1234');
      expect(notifier.state.isSuccess, isTrue);
      expect(notifier.state.data!['basicSalary'], equals(9500));
      expect(notifier.salaryToken, equals('valid-salary-token-999'));
    });

    test('unlockAndFetch with invalid PIN transitions to error without null',
        () async {
      final notifier = SalaryNotifier(fakeRepo);
      await notifier.unlockAndFetch('0000');

      expect(notifier.state.isError, isTrue);
      expect(notifier.state.errorCode, equals('INVALID_PIN'));
      expect(notifier.salaryToken, isNull);
    });

    test('lock resets salary state to empty', () async {
      final notifier = SalaryNotifier(fakeRepo);
      await notifier.unlockAndFetch('1234');
      expect(notifier.state.isSuccess, isTrue);

      notifier.lock();
      expect(notifier.state.isEmpty, isTrue);
      expect(notifier.salaryToken, isNull);
    });
  });
}
