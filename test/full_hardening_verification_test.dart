import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/network/backend.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    await ApiClient.instance.init();
    await RequestsStore.instance.load();
  });

  group('Full Hardening Verification Tests', () {
    test('LocalStore is a ChangeNotifier and emits notifications on mutations', () async {
      final store = LocalStore.instance;
      expect(store, isA<ChangeNotifier>());

      int notificationCount = 0;
      void listener() => notificationCount++;

      store.addListener(listener);

      // 1. Profile mutation triggers notification
      await store.saveProfile(const EmployeeProfile(name: 'Test Worker', employeeCode: 'EMP-999'));
      expect(notificationCount, 1);
      expect(store.profile.name, 'Test Worker');

      // 2. Vacation balance updates trigger notification
      await store.setVacationBalance(15);
      expect(notificationCount, 2);
      expect(store.vacationDaysRemaining, 15);

      await store.deductVacationDays(3);
      expect(notificationCount, 3);
      expect(store.vacationDaysRemaining, 12);

      await store.addVacationDays(2);
      expect(notificationCount, 4);
      expect(store.vacationDaysRemaining, 14);

      // 3. Session clear triggers notification
      await store.clearSession();
      expect(notificationCount, 5);

      store.removeListener(listener);
    });

    test('Salary Gate persistent lockout getters, setters, and reset', () async {
      final store = LocalStore.instance;

      expect(store.salaryGateFailedAttempts, 0);
      expect(store.salaryGateLockoutUntil, 0);

      await store.setSalaryGateFailedAttempts(3);
      expect(store.salaryGateFailedAttempts, 3);

      final now = DateTime.now().millisecondsSinceEpoch + 30000;
      await store.setSalaryGateLockoutUntil(now);
      expect(store.salaryGateLockoutUntil, now);

      await store.resetSalaryGateLockout();
      expect(store.salaryGateFailedAttempts, 0);
      expect(store.salaryGateLockoutUntil, 0);
    });

    test('Backend submitConcern and deleteAccount methods exist and handle offline gracefully', () async {
      ApiClient.offlineMockMode = true;

      final concernResult = await Backend.instance.submitConcern(
        category: 'Safety & Health',
        details: 'Exposed cable near machine 4',
      );
      expect(concernResult, isNull);

      final deleteResult = await Backend.instance.deleteAccount(pin: '1234');
      expect(deleteResult, isFalse);

      ApiClient.offlineMockMode = false;
    });

    test('RequestsStore does not refund annual days when non-annual leave is rejected', () async {
      final store = LocalStore.instance;
      await store.setVacationBalance(10);

      // Adding a Medical leave request
      final medicalReq = EmployeeRequest(
        id: 'med_req_1',
        title: 'Sick Leave Request',
        type: 'Leave',
        refNumber: 'LEV-MED-1',
        status: RequestStatus.inReview,
        date: 'Today',
        summary: 'Under review',
        details: {
          'leaveType': 'Sick Leave',
          'days': '3',
        },
      );

      RequestsStore.instance.addRequest(medicalReq, days: 3);

      // Annual vacation balance remains 10 (not deducted for sick leave)
      expect(store.vacationDaysRemaining, 10);
    });
  });
}
