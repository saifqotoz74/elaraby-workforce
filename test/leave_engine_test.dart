import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/utils/egyptian_calendar.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    await RequestsStore.instance.load();
    RequestsStore.instance.clear();
  });

  group('Egyptian Calendar & Working Days Calculation', () {
    test('identifies Friday and Saturday as Egyptian factory weekends', () {
      // 2026-05-01 is Friday, 2026-05-02 is Saturday, 2026-05-03 is Sunday
      final friday = DateTime(2026, 5, 1);
      final saturday = DateTime(2026, 5, 2);
      final sunday = DateTime(2026, 5, 3);

      expect(EgyptianCalendar.isWeekend(friday), isTrue);
      expect(EgyptianCalendar.isWeekend(saturday), isTrue);
      expect(EgyptianCalendar.isWeekend(sunday), isFalse);
    });

    test('detects official Egyptian national holidays in 2026', () {
      final copticChristmas = DateTime(2026, 1, 7);
      final sinaiLiberation = DateTime(2026, 4, 25);
      final armedForcesDay = DateTime(2026, 10, 6);
      final normalWorkDay = DateTime(2026, 3, 15);

      expect(EgyptianCalendar.getHoliday(copticChristmas), isNotNull);
      expect(EgyptianCalendar.getHoliday(sinaiLiberation), isNotNull);
      expect(EgyptianCalendar.getHoliday(armedForcesDay), isNotNull);
      expect(EgyptianCalendar.getHoliday(normalWorkDay), isNull);
    });

    test('accurately calculates net working days across weekend and holiday', () {
      // From 2026-04-23 (Thursday) to 2026-04-27 (Monday)
      // Days:
      // Thu Apr 23: Working day (1)
      // Fri Apr 24: Weekend (excluded)
      // Sat Apr 25: Weekend + Sinai Liberation Day (excluded)
      // Sun Apr 26: Working day (2)
      // Mon Apr 27: Working day (3)
      final start = DateTime(2026, 4, 23);
      final end = DateTime(2026, 4, 27);

      final result = EgyptianCalendar.calculateWorkingDays(start, end);

      expect(result.totalCalendarDays, 5);
      expect(result.workingDays, 3);
      expect(result.excludedWeekends, 2);
    });

    test('handles single day range correctly', () {
      final sundayWorkday = DateTime(2026, 6, 7); // Sunday
      final singleResult = EgyptianCalendar.calculateWorkingDays(sundayWorkday, sundayWorkday);
      expect(singleResult.totalCalendarDays, 1);
      expect(singleResult.workingDays, 1);
      expect(singleResult.excludedWeekends, 0);

      final fridayDay = DateTime(2026, 6, 5); // Friday (rest day)
      final weekendResult = EgyptianCalendar.calculateWorkingDays(fridayDay, fridayDay);
      expect(weekendResult.totalCalendarDays, 1);
      // When requested entirely within rest days, fall back to total days so a valid leave can be submitted
      expect(weekendResult.workingDays, 1);
      expect(weekendResult.excludedWeekends, 1);
    });
  });

  group('ApprovalStage JSON Serialization', () {
    test('ApprovalStage serializes and deserializes correctly', () {
      const stage = ApprovalStage(
        stage: 2,
        role: 'clinic',
        title: 'Medical Clinic',
        status: 'pending',
        reviewer: 'Dr. Mahmoud',
      );

      final json = stage.toJson();
      expect(json['stage'], 2);
      expect(json['role'], 'clinic');
      expect(json['title'], 'Medical Clinic');
      expect(json['status'], 'pending');
      expect(json['reviewer'], 'Dr. Mahmoud');

      final parsed = ApprovalStage.fromJson(json);
      expect(parsed.stage, stage.stage);
      expect(parsed.role, stage.role);
      expect(parsed.title, stage.title);
      expect(parsed.status, stage.status);
      expect(parsed.reviewer, stage.reviewer);
    });
  });

  group('RequestsStore Leave Breakdown & Quota Calculations', () {
    test('tracks emergency leave usage and calculates remaining from 6-day cap', () {
      final store = RequestsStore.instance;

      expect(store.emergencyDaysUsed, 0);
      expect(store.emergencyDaysRemaining, 6);

      // Add emergency leave of 2 days
      store.addRequest(const EmployeeRequest(
        id: 'emg-1',
        title: 'Emergency Leave',
        type: 'Leave',
        refNumber: 'EMG-001',
        status: RequestStatus.approved,
        date: '2026-05-10',
        summary: 'Family emergency',
        details: {'leaveType': 'Emergency Leave', 'days': '2'},
      ));

      expect(store.emergencyDaysUsed, 2);
      expect(store.emergencyDaysRemaining, 4);

      // Add another emergency leave of 2 days (inReview status still counts against quota)
      store.addRequest(const EmployeeRequest(
        id: 'emg-2',
        title: 'Emergency Leave',
        type: 'Leave',
        refNumber: 'EMG-002',
        status: RequestStatus.inReview,
        date: '2026-06-15',
        summary: 'Urgent matter',
        details: {'leaveType': 'Emergency Leave', 'days': '2'},
      ));

      expect(store.emergencyDaysUsed, 4);
      expect(store.emergencyDaysRemaining, 2);
    });

    test('tracks sick leave days taken without affecting annual balance', () {
      final store = RequestsStore.instance;

      expect(store.sickDaysTaken, 0);

      store.addRequest(const EmployeeRequest(
        id: 'sick-1',
        title: 'Sick Leave',
        type: 'Leave',
        refNumber: 'SCK-001',
        status: RequestStatus.approved,
        date: '2026-03-01',
        summary: 'Flu recovery',
        details: {'leaveType': 'Sick Leave', 'days': '3'},
      ));

      expect(store.sickDaysTaken, 3);
      expect(store.annualVacationDaysUsed, 0);
      expect(store.emergencyDaysUsed, 0);
    });

    test('deducts annual leave locally and restores balance on cancellation', () async {
      final store = RequestsStore.instance;
      await LocalStore.instance.setVacationBalance(21);
      expect(LocalStore.instance.vacationDaysRemaining, 21);

      const annualReq = EmployeeRequest(
        id: 'ann-1',
        title: 'Annual Leave',
        type: 'Leave',
        refNumber: 'ANN-001',
        status: RequestStatus.inReview,
        date: '2026-07-01',
        summary: 'Summer break',
        isPendingSync: true,
        details: {'leaveType': 'Annual Leave', 'days': '5'},
      );

      store.addRequest(annualReq, days: 5);
      await LocalStore.instance.deductVacationDays(5);
      expect(LocalStore.instance.vacationDaysRemaining, 16);
      expect(store.annualVacationDaysUsed, 5);

      // Cancel the request
      final success = await store.cancelRequest('ann-1');
      expect(success, isTrue);
      // Balance is refunded back to 21
      expect(LocalStore.instance.vacationDaysRemaining, 21);
      expect(store.annualVacationDaysUsed, 0);
    });
  });
}
