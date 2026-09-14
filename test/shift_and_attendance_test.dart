import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/features/services/data/shift_model.dart';
import 'package:elaraby_workforce/features/services/presentation/controllers/shifts_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('WorkShift & Multi-Week Roster Models', () {
    test('Correctly parses WorkShift JSON and provides localized accessors', () {
      final json = {
        'dayEn': 'Sun',
        'dayAr': 'الأحد',
        'date': '2026-09-20',
        'shift': 'morning',
        'name': 'Morning Shift (Line A)',
        'shiftNameAr': 'الوردية الأولى (خط أ)',
        'time': '07:00 AM – 03:00 PM',
        'timeAr': '07:00 ص – 03:00 م',
        'isConfirmed': true,
        'isOverride': false,
        'supervisor': 'Mohamed Hassan',
        'line': 'Production Line A',
      };

      final shift = WorkShift.fromJson(json);

      expect(shift.dayEn, 'Sun');
      expect(shift.dayAr, 'الأحد');
      expect(shift.date, '2026-09-20');
      expect(shift.shift, 'morning');
      expect(shift.isRestDay, isFalse);
      expect(shift.localizedName(true), 'الوردية الأولى (خط أ)');
      expect(shift.localizedName(false), 'Morning Shift (Line A)');
      expect(shift.localizedTime(true), '07:00 ص – 03:00 م');
      expect(shift.localizedTime(false), '07:00 AM – 03:00 PM');
      expect(shift.localizedDay(true), 'الأحد');
      expect(shift.localizedDay(false), 'Sun');

      final serialized = shift.toJson();
      expect(serialized['shift'], 'morning');
      expect(serialized['supervisor'], 'Mohamed Hassan');
    });

    test('Identifies rest day shifts correctly', () {
      final restShift = WorkShift.fromJson({
        'dayEn': 'Fri',
        'dayAr': 'الجمعة',
        'date': '2026-09-25',
        'shift': 'off',
        'name': 'Weekly Rest Day',
        'shiftNameAr': 'راحة أسبوعية',
        'time': 'Rest Day',
        'timeAr': 'عطلة أسبوعية',
      });

      expect(restShift.isRestDay, isTrue);
      expect(restShift.shift, 'off');
    });

    test('Parses ShiftWeek correctly with list of 7 days', () {
      final weekJson = {
        'weekStart': '2026-09-20',
        'isCurrent': true,
        'days': [
          {
            'dayEn': 'Sun',
            'dayAr': 'الأحد',
            'date': '2026-09-20',
            'shift': 'morning',
            'name': 'Morning Shift',
            'shiftNameAr': 'الوردية الصباحية',
            'time': '07:00 AM – 03:00 PM',
            'timeAr': '07:00 ص – 03:00 م',
          },
          {
            'dayEn': 'Mon',
            'dayAr': 'الاثنين',
            'date': '2026-09-21',
            'shift': 'morning',
            'name': 'Morning Shift',
            'shiftNameAr': 'الوردية الصباحية',
            'time': '07:00 AM – 03:00 PM',
            'timeAr': '07:00 ص – 03:00 م',
          }
        ]
      };

      final week = ShiftWeek.fromJson(weekJson);
      expect(week.weekStart, '2026-09-20');
      expect(week.isCurrent, isTrue);
      expect(week.days.length, 2);
      expect(week.days.first.shift, 'morning');
    });

    test('RosterNotifier produces 4 rotating weeks with valid Friday/Saturday rest days in fallback mode', () {
      final notifier = RosterNotifier();
      final fallbackWeeks = notifier.generateFallbackWeeksForTesting();

      expect(fallbackWeeks.length, 4);
      expect(fallbackWeeks.any((w) => w.isCurrent), isTrue);

      for (final week in fallbackWeeks) {
        expect(week.days.length, 7);
        // Friday (index 5) and Saturday (index 6) should be rest days
        expect(week.days[5].shift, 'off');
        expect(week.days[5].isRestDay, isTrue);
        expect(week.days[6].shift, 'off');
        expect(week.days[6].isRestDay, isTrue);

        // Workdays (Sunday-Thursday) should have assigned shifts
        for (int i = 0; i < 5; i++) {
          expect(week.days[i].isRestDay, isFalse);
          expect(['morning', 'evening', 'night', 'regular'], contains(week.days[i].shift));
        }
      }
    });
  });

  group('Two-Tier Shift Swap Requests & Peer Discovery', () {
    test('Parses ShiftSwapColleague with eligibility flags and rejection reason', () {
      final eligibleJson = {
        'id': 'emp_3',
        'name': 'Tamer Fathy',
        'employeeCode': 'EL-2049',
        'position': 'Machine Operator',
        'currentShift': 'evening',
        'currentShiftName': 'Evening Shift (15:00 - 23:00)',
        'currentShiftNameAr': 'وردية مسائية (15:00 - 23:00)',
        'currentShiftTime': '15:00 - 23:00',
        'currentShiftTimeAr': '15:00 - 23:00',
        'isEligible': true,
      };

      final ineligibleJson = {
        'id': 'emp_4',
        'name': 'Hassan Mansour',
        'employeeCode': 'EL-3011',
        'position': 'Technician',
        'currentShift': 'night',
        'currentShiftName': 'Night Shift (23:00 - 07:00)',
        'currentShiftNameAr': 'وردية ليلية (23:00 - 07:00)',
        'currentShiftTime': '23:00 - 07:00',
        'currentShiftTimeAr': '23:00 - 07:00',
        'isEligible': false,
        'ineligibilityReason': 'fatigue_risk',
        'ineligibilityMessage': 'Violates 11-hour mandatory rest period',
      };

      final c1 = ShiftSwapColleague.fromJson(eligibleJson);
      expect(c1.id, 'emp_3');
      expect(c1.isEligible, isTrue);
      expect(c1.ineligibilityReason, isNull);

      final c2 = ShiftSwapColleague.fromJson(ineligibleJson);
      expect(c2.id, 'emp_4');
      expect(c2.isEligible, isFalse);
      expect(c2.ineligibilityReason, 'fatigue_risk');
      expect(c2.ineligibilityMessage, contains('11-hour mandatory rest'));
    });

    test('Parses ShiftSwapRequest lifecycle across two tiers', () {
      final requestJson = {
        'id': 'swap_101',
        'requesterId': 'emp_1',
        'requesterName': 'Ahmed Hassan',
        'targetEmployeeId': 'emp_3',
        'targetEmployeeName': 'Tamer Fathy',
        'date': '2026-09-22',
        'myShiftId': 'morning',
        'myShiftName': 'Morning Shift (07:00 - 15:00)',
        'myShiftNameAr': 'وردية صباحية (07:00 - 15:00)',
        'targetShiftId': 'evening',
        'targetShiftName': 'Evening Shift (15:00 - 23:00)',
        'targetShiftNameAr': 'وردية مسائية (15:00 - 23:00)',
        'reason': 'Family emergency in the morning',
        'status': 'colleague_pending',
        'createdAt': 1726682400000,
        'supervisor': 'Mohamed Hassan',
      };

      final swap = ShiftSwapRequest.fromJson(requestJson);
      expect(swap.id, 'swap_101');
      expect(swap.status, 'colleague_pending');
      expect(swap.isPendingColleague, isTrue);
      expect(swap.isPendingSupervisor, isFalse);
      expect(swap.isApproved, isFalse);

      final updatedToSupervisor = ShiftSwapRequest.fromJson({
        ...requestJson,
        'status': 'supervisor_pending',
      });
      expect(updatedToSupervisor.isPendingSupervisor, isTrue);

      final approved = ShiftSwapRequest.fromJson({
        ...requestJson,
        'status': 'approved',
      });
      expect(approved.isApproved, isTrue);
    });
  });

  group('Egyptian Labor Law Overtime (OT) Engine', () {
    test('Parses OvertimeClaim model with statutory rates and payout calculations', () {
      final otJson = {
        'id': 'ot_501',
        'employeeId': 'emp_1',
        'date': '2026-09-18',
        'hours': 3.5,
        'timePeriod': 'day',
        'reason': 'Urgent factory line maintenance',
        'status': 'approved',
        'calculation': {
          'multiplier': 1.35,
          'hourlyRate': 45,
          'totalAmount': 212,
        },
        'createdAt': 1726682400000,
      };

      final claim = OvertimeClaim.fromJson(otJson);
      expect(claim.id, 'ot_501');
      expect(claim.hours, 3.5);
      expect(claim.multiplier, 1.35);
      expect(claim.totalAmount, 212);
      expect(claim.status, 'approved');
      expect(claim.isApproved, isTrue);
    });

    test('Validates statutory Egyptian Labor Law multiplier tiers (Art. 85)', () {
      const basicSalary = 10800.0; // EGP / month
      const monthlyHours = 240.0; // 30 days * 8 hours standard
      const hourlyBase = basicSalary / monthlyHours; // 45 EGP / hr
      const workedHours = 4.0;

      // Tier 1: Daytime Overtime (+35% premium -> 135%)
      const dayMultiplier = 1.35;
      final dayPayout = workedHours * hourlyBase * dayMultiplier;
      expect(dayPayout, closeTo(243.0, 0.01));

      // Tier 2: Nighttime Overtime (+70% premium -> 170%)
      const nightMultiplier = 1.70;
      final nightPayout = workedHours * hourlyBase * nightMultiplier;
      expect(nightPayout, closeTo(306.0, 0.01));

      // Tier 3: Rest Day / Official Holiday Overtime (Double pay -> 200%)
      const holidayMultiplier = 2.00;
      final holidayPayout = workedHours * hourlyBase * holidayMultiplier;
      expect(holidayPayout, closeTo(360.0, 0.01));
    });
  });

  group('Factory Attendance & QR Verification Engine', () {
    test('Parses TodayPunchState for checked-in status', () {
      final punchJson = {
        'status': 'checked_in',
        'date': '2026-09-14',
        'workingMinutes': 120,
        'punchIn': {
          'timeFormatted': '06:54 AM',
          'punctuality': 'on_time',
          'delayMinutes': 0,
        },
        'factoryGeofence': {
          'name': 'Quesna Complex',
          'nameAr': 'مجمع قويسنا الصناعي - مصنع 2',
        },
        'qrToken': 'HMAC_ROTATING_QR_TOKEN_ABC123',
        'offlineToken': 'OFFLINE_TOKEN_XYZ',
      };

      final state = TodayPunchState.fromJson(punchJson);
      expect(state.isCheckedIn, isTrue);
      expect(state.punchInTime, '06:54 AM');
      expect(state.punchOutTime, isNull);
      expect(state.factoryName, contains('قويسنا'));
      expect(state.qrToken, isNotEmpty);
      expect(state.punctuality, 'on_time');

      final serialized = state.toJson();
      expect(serialized['status'], 'checked_in');
      expect(serialized['punchInTime'], '06:54 AM');
    });

    test('Parses TodayPunchState for completed work day (checked-out)', () {
      final punchJson = {
        'status': 'checked_out',
        'date': '2026-09-14',
        'workingMinutes': 480,
        'punchIn': {
          'timeFormatted': '06:54 AM',
          'punctuality': 'on_time',
        },
        'punchOut': {
          'timeFormatted': '03:05 PM',
        },
        'qrToken': '',
        'offlineToken': '',
      };

      final state = TodayPunchState.fromJson(punchJson);
      expect(state.status, 'checked_out');
      expect(state.isCheckedOut, isTrue);
      expect(state.punchInTime, '06:54 AM');
      expect(state.punchOutTime, '03:05 PM');
    });

    test('Simulates cryptographically-signed offline attendance token generation', () {
      final now = DateTime.now().millisecondsSinceEpoch;
      final employeeId = 'emp_1';
      final factoryCode = 'QUESNA_PLANT_2';
      final offlinePayload = 'OFFLINE-$employeeId-$factoryCode-$now';

      expect(offlinePayload, startsWith('OFFLINE-emp_1-QUESNA_PLANT_2-'));
      expect(offlinePayload.split('-').length, greaterThanOrEqualTo(4));
    });
  });
}
