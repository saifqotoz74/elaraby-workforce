import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/theme/app_theme.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    await RequestsStore.instance.load();
    RequestsStore.instance.clear();
  });

  group('RequestsStore Rollback & Cancellation', () {
    test('cancelling a local pendingSync request removes it cleanly', () async {
      final store = RequestsStore.instance;
      const req = EmployeeRequest(
        id: 'local-req-1',
        title: 'Local Test Leave',
        type: 'Leave',
        refNumber: 'LEV-TEST-001',
        status: RequestStatus.inReview,
        date: 'Today',
        summary: 'Waiting approval',
        isPendingSync: true,
      );

      store.addRequest(req);
      expect(store.allRequests.any((r) => r.id == 'local-req-1'), isTrue);

      final result = await store.cancelRequest('local-req-1');
      expect(result, isTrue);
      expect(store.allRequests.any((r) => r.id == 'local-req-1'), isFalse);
    });

    test('form draft saves, restores, and clears cleanly', () async {
      final store = LocalStore.instance;

      expect(store.getDraft('leave_request'), isNull);

      await store.saveDraft('leave_request', {
        'leaveType': 'Sick Leave',
        'notes': 'Flu fever',
      });

      final restored = store.getDraft('leave_request');
      expect(restored, isNotNull);
      expect(restored!['leaveType'], 'Sick Leave');
      expect(restored['notes'], 'Flu fever');

      await store.clearDraft('leave_request');
      expect(store.getDraft('leave_request'), isNull);
    });

    test('AppTheme theme mode switches and persists', () async {
      AppTheme.init();
      expect(AppTheme.themeModeNotifier.value, ThemeMode.system);

      AppTheme.setThemeMode(ThemeMode.dark);
      expect(AppTheme.themeModeNotifier.value, ThemeMode.dark);
      expect(LocalStore.instance.themeMode, 'dark');

      AppTheme.setThemeMode(ThemeMode.light);
      expect(AppTheme.themeModeNotifier.value, ThemeMode.light);
      expect(LocalStore.instance.themeMode, 'light');
    });
  });
}
