import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/features/services/data/transport_model.dart';
import 'package:elaraby_workforce/features/services/presentation/controllers/transport_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Transport Models - Unit & Serialization Tests', () {
    test('BusStop serialization and localizedName', () {
      final json = {
        'id': 'stop_101_1',
        'nameAr': 'ميدان الرماية - أمام البنك الأهلي',
        'nameEn': 'Remaya Square - NBE',
        'lat': 29.993,
        'lng': 31.118,
        'scheduledTime': '05:45 ص',
        'order': 1,
      };

      final stop = BusStop.fromJson(json);

      expect(stop.id, 'stop_101_1');
      expect(stop.nameAr, 'ميدان الرماية - أمام البنك الأهلي');
      expect(stop.nameEn, 'Remaya Square - NBE');
      expect(stop.lat, 29.993);
      expect(stop.lng, 31.118);
      expect(stop.scheduledTime, '05:45 ص');
      expect(stop.order, 1);
      expect(stop.localizedName(true), 'ميدان الرماية - أمام البنك الأهلي');
      expect(stop.localizedName(false), 'Remaya Square - NBE');

      final serialized = stop.toJson();
      expect(serialized['id'], 'stop_101_1');
      expect(serialized['lat'], 29.993);
      expect(serialized['order'], 1);
    });

    test('BusDriver serialization and localizedName', () {
      final json = {
        'id': 'drv_101',
        'name': 'محمود عبد الفتاح شلبي',
        'nameEn': 'Mahmoud Abdel-Fattah',
        'phone': '+201019882233',
        'rating': 4.9,
      };

      final driver = BusDriver.fromJson(json);

      expect(driver.id, 'drv_101');
      expect(driver.name, 'محمود عبد الفتاح شلبي');
      expect(driver.nameEn, 'Mahmoud Abdel-Fattah');
      expect(driver.phone, '+201019882233');
      expect(driver.rating, 4.9);
      expect(driver.localizedName(true), 'محمود عبد الفتاح شلبي');
      expect(driver.localizedName(false), 'Mahmoud Abdel-Fattah');

      final serialized = driver.toJson();
      expect(serialized['phone'], '+201019882233');
      expect(serialized['rating'], 4.9);
    });

    test('BusRoute serialization with nested stops and driver', () {
      final json = {
        'id': 'route_101',
        'code': 'BUS-101',
        'nameAr': 'خط الهرم - الرماية - الدائري',
        'nameEn': 'Haram - Remaya Line',
        'destinationComplex': '10th of Ramadan',
        'destinationAr': 'مجمع مصانع العاشر من رمضان',
        'vehiclePlate': 'ط س ج ٥٨١٢',
        'vehiclePlateEn': 'TSJ 5812',
        'busModel': 'Mercedes-Benz MCV 500',
        'capacity': 50,
        'shiftId': 'morning',
        'driver': {
          'id': 'drv_101',
          'name': 'محمود عبد الفتاح شلبي',
          'nameEn': 'Mahmoud Abdel-Fattah',
          'phone': '+201019882233',
          'rating': 4.9,
        },
        'stops': [
          {
            'id': 'stop_101_1',
            'nameAr': 'ميدان الرماية',
            'nameEn': 'Remaya Square',
            'lat': 29.993,
            'lng': 31.118,
            'scheduledTime': '05:45 ص',
            'order': 1,
          },
          {
            'id': 'stop_101_2',
            'nameAr': 'الهرم - نصر الدين',
            'nameEn': 'Haram - Nasr El Din',
            'lat': 30.007,
            'lng': 31.196,
            'scheduledTime': '06:00 ص',
            'order': 2,
          },
        ],
      };

      final route = BusRoute.fromJson(json);

      expect(route.id, 'route_101');
      expect(route.code, 'BUS-101');
      expect(route.capacity, 50);
      expect(route.driver.nameEn, 'Mahmoud Abdel-Fattah');
      expect(route.stops.length, 2);
      expect(route.stops[0].id, 'stop_101_1');
      expect(route.stops[1].id, 'stop_101_2');
      expect(route.localizedName(true), 'خط الهرم - الرماية - الدائري');
      expect(route.localizedName(false), 'Haram - Remaya Line');

      final serialized = route.toJson();
      expect(serialized['code'], 'BUS-101');
      expect((serialized['stops'] as List).length, 2);
    });

    test('BusTelemetry serialization and status localized', () {
      final json = {
        'routeId': 'route_101',
        'routeCode': 'BUS-101',
        'currentLat': 30.054,
        'currentLng': 31.285,
        'speedKmh': 64,
        'headingDegrees': 48,
        'currentStopName': 'دائري المنيب',
        'nextStopName': 'موقف العاشر بالسلام',
        'targetStopId': 'stop_101_3',
        'targetStopName': 'دائري المنيب - سلم الكونيسة',
        'distanceKm': 4,
        'etaMinutes': 8,
        'status': 'approaching',
        'statusTextAr': 'على وشك الوصول (8 دقائق)',
        'statusTextEn': 'Approaching (8 mins)',
        'isApproaching': true,
        'isAtStop': false,
        'lastUpdated': 1726322400000,
      };

      final telemetry = BusTelemetry.fromJson(json);

      expect(telemetry.routeId, 'route_101');
      expect(telemetry.speedKmh, 64);
      expect(telemetry.headingDegrees, 48);
      expect(telemetry.etaMinutes, 8);
      expect(telemetry.isApproaching, isTrue);
      expect(telemetry.isAtStop, isFalse);
      expect(telemetry.localizedStatus(true), 'على وشك الوصول (8 دقائق)');
      expect(telemetry.localizedStatus(false), 'Approaching (8 mins)');

      final serialized = telemetry.toJson();
      expect(serialized['speedKmh'], 64);
      expect(serialized['isApproaching'], isTrue);
    });

    test('BusAssignment serialization', () {
      final json = {
        'employeeId': 'emp_1',
        'assignedRouteId': 'route_101',
        'selectedStopId': 'stop_101_3',
        'seatNumber': 'A-14',
      };

      final assignment = BusAssignment.fromJson(json);

      expect(assignment.employeeId, 'emp_1');
      expect(assignment.assignedRouteId, 'route_101');
      expect(assignment.selectedStopId, 'stop_101_3');
      expect(assignment.seatNumber, 'A-14');

      final serialized = assignment.toJson();
      expect(serialized['seatNumber'], 'A-14');
    });

    test('BusBoarding verification and transit status', () {
      final json = {
        'id': 'brd_1',
        'employeeId': 'emp_1',
        'employeeName': 'أحمد غنّام',
        'routeId': 'route_101',
        'routeNameAr': 'خط الهرم - الرماية',
        'date': '2026-09-14',
        'boardTime': '06:12:00',
        'verifiedByDriver': 'drv_101',
        'transitStatus': 'in_transit',
        'excusedForTransitDelay': true,
      };

      final boarding = BusBoarding.fromJson(json);

      expect(boarding.id, 'brd_1');
      expect(boarding.employeeName, 'أحمد غنّام');
      expect(boarding.isInTransit, isTrue);
      expect(boarding.excusedForTransitDelay, isTrue);

      final serialized = boarding.toJson();
      expect(serialized['transitStatus'], 'in_transit');
      expect(serialized['excusedForTransitDelay'], isTrue);
    });

    test('RouteAlert model handles delays and active flag', () {
      final json = {
        'id': 'alt_1',
        'routeId': 'route_101',
        'routeNameAr': 'خط الهرم - العاشر',
        'type': 'traffic_delay',
        'message': 'كثافات مرورية عالية على محور 26 يوليو',
        'delayMinutes': 25,
        'reportedBy': 'Driver',
        'timestamp': 1726322400000,
        'active': true,
      };

      final alert = RouteAlert.fromJson(json);

      expect(alert.id, 'alt_1');
      expect(alert.type, 'traffic_delay');
      expect(alert.delayMinutes, 25);
      expect(alert.active, isTrue);

      final serialized = alert.toJson();
      expect(serialized['delayMinutes'], 25);
      expect(serialized['active'], isTrue);
    });

    test('BoardingPassData parsing and localization', () {
      final json = {
        'employeeId': 'emp_1',
        'employeeName': 'أحمد غنّام',
        'employeeCode': 'EG-20481',
        'routeId': 'route_101',
        'routeCode': 'BUS-101',
        'routeNameAr': 'خط الهرم - الرماية',
        'routeNameEn': 'Haram Line',
        'seatNumber': 'A-14',
        'vehiclePlate': 'ط س ج ٥٨١٢',
        'destinationAr': 'مجمع مصانع العاشر من رمضان',
        'qrToken': 'HMAC-SHA256-TOKEN-XYZ',
        'expiresInSeconds': 60,
        'issuedAt': 1726322400000,
      };

      final pass = BoardingPassData.fromJson(json);

      expect(pass.employeeId, 'emp_1');
      expect(pass.employeeCode, 'EG-20481');
      expect(pass.qrToken, 'HMAC-SHA256-TOKEN-XYZ');
      expect(pass.localizedRoute(true), 'خط الهرم - الرماية');
      expect(pass.localizedRoute(false), 'Haram Line');
    });

    test('MyCommuteState composition and deserialization', () {
      final json = {
        'hasBoarded': true,
        'route': {
          'id': 'route_101',
          'code': 'BUS-101',
          'nameAr': 'خط الهرم',
          'nameEn': 'Haram Line',
          'destinationComplex': '10th of Ramadan',
          'destinationAr': 'العاشر من رمضان',
          'vehiclePlate': 'ط س ج ٥٨١٢',
          'vehiclePlateEn': 'TSJ 5812',
          'busModel': 'MCV 500',
          'capacity': 50,
          'shiftId': 'morning',
          'driver': {
            'id': 'drv_101',
            'name': 'محمود',
            'nameEn': 'Mahmoud',
            'phone': '01019882233',
            'rating': 5.0,
          },
          'stops': [],
        },
        'assignment': {
          'employeeId': 'emp_1',
          'assignedRouteId': 'route_101',
          'selectedStopId': 'stop_101_2',
          'seatNumber': 'B-04',
        },
        'alerts': [
          {
            'id': 'alt_1',
            'routeId': 'route_101',
            'routeNameAr': 'خط الهرم',
            'type': 'traffic',
            'message': 'زحام',
            'delayMinutes': 10,
            'reportedBy': 'System',
            'timestamp': 1000,
            'active': true,
          }
        ],
      };

      final state = MyCommuteState.fromJson(json);

      expect(state.hasBoarded, isTrue);
      expect(state.route, isNotNull);
      expect(state.route!.id, 'route_101');
      expect(state.assignment, isNotNull);
      expect(state.assignment!.seatNumber, 'B-04');
      expect(state.alerts.length, 1);
      expect(state.alerts.first.delayMinutes, 10);
    });

    test('CommuteSuppression model serialization and localized accessors', () {
      final json = {
        'isSuppressed': true,
        'reason': 'approved_leave',
        'reasonAr': 'تنبيهات الحافلة متوقفة: إجازة اعتيادية',
        'reasonEn': 'Alerts paused: Annual Leave',
        'optOutToday': false,
      };

      final suppression = CommuteSuppression.fromJson(json);

      expect(suppression.isSuppressed, isTrue);
      expect(suppression.reason, 'approved_leave');
      expect(suppression.localizedReason(true), 'تنبيهات الحافلة متوقفة: إجازة اعتيادية');
      expect(suppression.localizedReason(false), 'Alerts paused: Annual Leave');

      final serialized = suppression.toJson();
      expect(serialized['reason'], 'approved_leave');
      expect(serialized['optOutToday'], isFalse);
    });

    test('ProximityAlertEvent model parsing and quick actions attributes', () {
      final json = {
        'employeeId': 'emp_1',
        'routeId': 'route_101',
        'routeCode': 'BUS-101',
        'routeNameAr': 'خط الهرم - الرماية',
        'stopId': 'stop_101_2',
        'stopNameAr': 'محطة نصر الدين',
        'stopNameEn': 'Nasr El-Din Station',
        'distanceKm': 3,
        'etaMinutes': 8,
        'driverName': 'محمود',
        'driverPhone': '01019882233',
        'vehiclePlate': 'ط س ج ٥٨١٢',
        'titleAr': 'الحافلة على وشك الوصول (8 د)',
        'titleEn': 'Bus Approaching (8 mins)',
        'bodyAr': 'الحافلة على بعد 3 كم',
        'bodyEn': 'Bus is 3 km away',
        'timestamp': 1726322400000,
      };

      final event = ProximityAlertEvent.fromJson(json);

      expect(event.employeeId, 'emp_1');
      expect(event.distanceKm, 3);
      expect(event.etaMinutes, 8);
      expect(event.localizedTitle(true), 'الحافلة على وشك الوصول (8 د)');
      expect(event.localizedTitle(false), 'Bus Approaching (8 mins)');
      expect(event.localizedBody(true), 'الحافلة على بعد 3 كم');
    });
  });

  group('Transport Notifiers - Fallback & State Testing', () {
    test('MyCommuteNotifier generateFallbackCommute produces valid state', () {
      final notifier = MyCommuteNotifier();
      final fallback = notifier.generateFallbackCommuteForTesting();

      expect(fallback.route, isNotNull);
      expect(fallback.route!.code, 'BUS-101');
      expect(fallback.route!.stops.isNotEmpty, isTrue);
      expect(fallback.assignment, isNotNull);
      expect(fallback.telemetry, isNotNull);
      expect(fallback.telemetry!.speedKmh, greaterThan(0));
      expect(fallback.telemetry!.etaMinutes, greaterThan(0));
      expect(fallback.suppression.isSuppressed, isFalse);
    });

    test('MyCommuteNotifier toggleOptOut pauses alerts and updates assignment', () async {
      final notifier = MyCommuteNotifier();
      await Future.delayed(const Duration(milliseconds: 50));

      final toggled = await notifier.toggleOptOut(true);
      expect(toggled, isTrue);
      expect(notifier.state.hasData, isTrue);

      final state = notifier.state.data!;
      expect(state.suppression.isSuppressed, isTrue);
      expect(state.suppression.optOutToday, isTrue);
      expect(state.assignment?.optOutToday, isTrue);

      // Re-enable
      final resumed = await notifier.toggleOptOut(false);
      expect(resumed, isTrue);
      expect(notifier.state.data!.suppression.optOutToday, isFalse);
    });

    test('BusRoutesNotifier loads fallback routes when backend is unavailable', () async {
      final notifier = BusRoutesNotifier();
      // Allow initial async execution to complete with fallback
      await Future.delayed(const Duration(milliseconds: 50));

      expect(notifier.state.hasData, isTrue);
      final routes = notifier.state.data!;
      expect(routes.length, greaterThanOrEqualTo(2));
      expect(routes.any((r) => r.code == 'BUS-101'), isTrue);
      expect(routes.any((r) => r.code == 'BUS-201'), isTrue);
    });

    test('BoardingPassNotifier loads valid fallback boarding pass', () async {
      final notifier = BoardingPassNotifier();
      await Future.delayed(const Duration(milliseconds: 50));

      expect(notifier.state.hasData, isTrue);
      final pass = notifier.state.data!;
      expect(pass.employeeName, 'أحمد غنّام');
      expect(pass.routeCode, 'BUS-101');
      expect(pass.qrToken.isNotEmpty, isTrue);
      expect(pass.seatNumber, isNotEmpty);
    });
  });

  group('Driver & Bus Supervisor Dedicated Tablet Console - Unit Tests', () {
    test('ManifestPassenger serialization and status getters', () {
      final json = {
        'id': 'emp_1',
        'nameAr': 'أحمد حسن منصور',
        'nameEn': 'Ahmed Hassan Mansour',
        'department': 'إنتاج شاشات تليفزيون',
        'phone': '+201001234567',
        'seatNumber': 'A-12',
        'boardingStatus': 'boarded',
        'boardedAt': '05:48 ص',
        'verifiedBy': 'qr_scanner',
      };

      final p = ManifestPassenger.fromJson(json);
      expect(p.id, 'emp_1');
      expect(p.localizedName(true), 'أحمد حسن منصور');
      expect(p.localizedName(false), 'Ahmed Hassan Mansour');
      expect(p.seatNumber, 'A-12');
      expect(p.isBoarded, isTrue);
      expect(p.isWaiting, isFalse);
      expect(p.isOptedOut, isFalse);
      expect(p.boardedAt, '05:48 ص');

      final serialized = p.toJson();
      expect(serialized['id'], 'emp_1');
      expect(serialized['boardingStatus'], 'boarded');
    });

    test('ManifestStop serialization with passengers', () {
      final json = {
        'id': 'stop_101_1',
        'nameAr': 'ميدان الرماية',
        'nameEn': 'Remaya Square',
        'scheduledTime': '05:45 ص',
        'order': 1,
        'isNext': false,
        'isPassed': true,
        'boardedCount': 2,
        'waitingCount': 0,
        'optedOutCount': 0,
        'passengers': [
          {
            'id': 'emp_1',
            'nameAr': 'أحمد حسن',
            'nameEn': 'Ahmed Hassan',
            'boardingStatus': 'boarded',
          },
        ],
      };

      final stop = ManifestStop.fromJson(json);
      expect(stop.id, 'stop_101_1');
      expect(stop.order, 1);
      expect(stop.isPassed, isTrue);
      expect(stop.passengers.length, 1);
      expect(stop.passengers.first.isBoarded, isTrue);
    });

    test('ManifestHeadcounts calculation and allAccountedFor logic', () {
      final json = {
        'totalAssigned': 5,
        'boarded': 4,
        'waiting': 0,
        'optedOut': 1,
        'occupancyRate': 80,
        'allAccountedFor': true,
      };

      final counts = ManifestHeadcounts.fromJson(json);
      expect(counts.totalAssigned, 5);
      expect(counts.boarded, 4);
      expect(counts.waiting, 0);
      expect(counts.optedOut, 1);
      expect(counts.occupancyRate, 80);
      expect(counts.allAccountedFor, isTrue);
    });

    test('DriverConsoleNotifier initializes with fallback manifest and handles manual check-in', () async {
      final notifier = DriverConsoleNotifier('route_101');
      await Future.delayed(const Duration(milliseconds: 50));

      expect(notifier.state.hasData, isTrue);
      final initialData = notifier.state.data!;
      expect(initialData.stops.isNotEmpty, isTrue);
      expect(initialData.headcounts.totalAssigned, 5);

      final initialBoarded = initialData.headcounts.boarded;

      // Perform manual check-in for waiting passenger emp_10
      final ok = await notifier.manualBoardPassenger(employeeId: 'emp_10');
      expect(ok, isTrue);

      final updatedData = notifier.state.data!;
      expect(updatedData.headcounts.boarded, initialBoarded + 1);

      // Verify the passenger in the stop is now boarded
      final stop1 = updatedData.stops.firstWhere((s) => s.id == 'stop_101_1');
      final emp10 = stop1.passengers.firstWhere((p) => p.id == 'emp_10');
      expect(emp10.isBoarded, isTrue);
    });

    test('DriverConsoleNotifier stop departure progression and arrival completion', () async {
      final notifier = DriverConsoleNotifier('route_101');
      await Future.delayed(const Duration(milliseconds: 50));

      expect(notifier.state.hasData, isTrue);

      // Depart stop 2 (الهرم - محطة نصر الدين)
      final advanced = await notifier.advanceStopDeparture(stopId: 'stop_101_2');
      expect(advanced, isTrue);

      final afterAdvance = notifier.state.data!;
      final stop2 = afterAdvance.stops.firstWhere((s) => s.id == 'stop_101_2');
      expect(stop2.isPassed, isTrue);
      expect(stop2.isNext, isFalse);

      final stop3 = afterAdvance.stops.firstWhere((s) => s.id == 'stop_101_3');
      expect(stop3.isNext, isTrue);

      // Complete route run (Arrival at complex)
      final completed = await notifier.completeRouteRun();
      expect(completed, isTrue);

      final afterComplete = notifier.state.data!;
      expect(afterComplete.stops.every((s) => s.isPassed), isTrue);
    });
  });
}

