import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/features/services/data/transport_model.dart';
import 'package:elaraby_workforce/features/services/domain/transit_telemetry_simulator.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const testRoute = BusRoute(
    id: 'test_route_001',
    code: 'BUS-001',
    nameAr: 'خط العاشر - رمسيس',
    nameEn: '10th - Ramses Line',
    destinationComplex: '10th of Ramadan',
    destinationAr: 'العاشر من رمضان',
    vehiclePlate: 'أ ب ج ١٢٣',
    vehiclePlateEn: 'ABC 123',
    busModel: 'Mercedes MCV 500',
    capacity: 50,
    driver: BusDriver(
      id: 'drv_01',
      name: 'أحمد محمود',
      nameEn: 'Ahmed Mahmoud',
      phone: '+201000000000',
      rating: 4.8,
    ),
    shiftId: 'morning',
    stops: [
      BusStop(
        id: 'stop_1',
        nameAr: 'محطة رمسيس',
        nameEn: 'Ramses Station',
        lat: 30.063,
        lng: 31.249,
        scheduledTime: '06:00 ص',
        order: 1,
      ),
      BusStop(
        id: 'stop_2',
        nameAr: 'محطة مصر الجديدة',
        nameEn: 'Heliopolis Station',
        lat: 30.089,
        lng: 31.328,
        scheduledTime: '06:20 ص',
        order: 2,
      ),
      BusStop(
        id: 'stop_3',
        nameAr: 'موقف العاشر بالسلام',
        nameEn: 'Salam Terminal',
        lat: 30.165,
        lng: 31.428,
        scheduledTime: '06:45 ص',
        order: 3,
      ),
    ],
  );

  group('TransitTelemetrySimulator - Geodesy & Waypoint Calculations', () {
    test('calculateDistanceMeters computes accurate Haversine distance', () {
      // Cairo to Alexandria distance is approx 180-185 km
      final distMeters = TransitTelemetrySimulator.calculateDistanceMeters(
        30.0444,
        31.2357, // Cairo
        31.2001,
        29.9187, // Alexandria
      );

      final distKm = distMeters / 1000.0;
      expect(distKm, greaterThan(175.0));
      expect(distKm, lessThan(195.0));
    });

    test('calculateBearing calculates correct directional headings', () {
      // Point directly North
      final northBearing = TransitTelemetrySimulator.calculateBearing(
        30.0,
        31.0,
        31.0,
        31.0,
      );
      expect(northBearing, equals(0));

      // Point directly East
      final eastBearing = TransitTelemetrySimulator.calculateBearing(
        30.0,
        31.0,
        30.0,
        32.0,
      );
      expect(eastBearing, equals(90));

      // Point directly South
      final southBearing = TransitTelemetrySimulator.calculateBearing(
        31.0,
        31.0,
        30.0,
        31.0,
      );
      expect(southBearing, equals(180));

      // Point directly West
      final westBearing = TransitTelemetrySimulator.calculateBearing(
        30.0,
        32.0,
        30.0,
        31.0,
      );
      expect(westBearing, equals(270));
    });

    test('generateWaypoints interpolates coordinates and speeds smoothly between stops', () {
      final simulator = TransitTelemetrySimulator(pointsPerSegment: 6);
      final waypoints = simulator.generateWaypoints(testRoute);

      // (3 stops - 1) * 6 points per segment + 1 final terminal stop = 13 waypoints
      expect(waypoints.length, equals(13));

      // Initial waypoint starts at first stop
      expect(waypoints.first.lat, closeTo(testRoute.stops.first.lat, 0.001));
      expect(waypoints.first.lng, closeTo(testRoute.stops.first.lng, 0.001));
      expect(waypoints.first.speedKmh, equals(0)); // stopped

      // Terminal waypoint ends at last stop
      expect(waypoints.last.lat, closeTo(testRoute.stops.last.lat, 0.001));
      expect(waypoints.last.lng, closeTo(testRoute.stops.last.lng, 0.001));
      expect(waypoints.last.speedKmh, equals(0)); // stopped

      // Intermediate cruising points have realistic speed
      expect(waypoints[3].speedKmh, greaterThan(40));
    });
  });

  group('TransitTelemetrySimulator - Step Simulation & Countdown ETA', () {
    test('dynamic seconds countdown updates monotonically as bus advances towards stop', () {
      final simulator = TransitTelemetrySimulator(pointsPerSegment: 6);

      // Setup simulation targeting stop 2
      simulator.startSimulation(
        route: testRoute,
        targetStopId: 'stop_2',
        loop: false,
      );
      simulator.stopSimulation(); // disable auto timer, advance manually

      final initialUpdate = simulator.step(loop: false);
      expect(initialUpdate.distanceMeters, greaterThan(1000.0));
      expect(initialUpdate.etaSecondsRemaining, greaterThan(60));
      expect(initialUpdate.telemetry.routeCode, equals('BUS-001'));

      final firstDistance = initialUpdate.distanceMeters;

      // Advance several waypoints towards stop 2
      SimulatedTransitUpdate latest = initialUpdate;
      for (int i = 0; i < 4; i++) {
        latest = simulator.step(loop: false);
      }

      // As the vehicle advances along the polyline, distance to stop decreases
      expect(latest.distanceMeters, lessThan(firstDistance));
      expect(latest.etaSecondsRemaining, lessThan(initialUpdate.etaSecondsRemaining));
    });
  });

  group('TransitTelemetrySimulator - Proximity Alert Threshold & Arrival Chime', () {
    test('triggers arrival chime and notification when distance drops below 250m', () async {
      // Create a short route where stop 2 is very close (under 250m) to stop 1
      const closeRoute = BusRoute(
        id: 'close_route',
        code: 'BUS-CLOSE',
        nameAr: 'خط قريب',
        nameEn: 'Close Route',
        destinationComplex: '10th',
        destinationAr: 'العاشر',
        vehiclePlate: '١٢٣',
        vehiclePlateEn: '123',
        busModel: 'Bus',
        capacity: 40,
        driver: BusDriver(id: 'd1', name: 'سائق', nameEn: 'Driver', phone: '123'),
        shiftId: 'morning',
        stops: [
          BusStop(id: 's1', nameAr: 'المحطة الأولى', nameEn: 'Stop 1', lat: 30.0000, lng: 31.0000, scheduledTime: '06:00', order: 1),
          // ~200 meters north
          BusStop(id: 's2', nameAr: 'المحطة الثانية', nameEn: 'Stop 2', lat: 30.0018, lng: 31.0000, scheduledTime: '06:05', order: 2),
        ],
      );

      String? notifiedTitle;
      String? notifiedBody;
      ArrivalAlertEvent? receivedEvent;

      final simulator = TransitTelemetrySimulator(
        pointsPerSegment: 4,
        customNotificationHandler: ({required title, required body}) async {
          notifiedTitle = title;
          notifiedBody = body;
        },
        onArrivalAlert: (event) {
          receivedEvent = event;
        },
      );

      simulator.initializeRoute(
        route: closeRoute,
        targetStopId: 's2',
      );

      // Total distance is ~200m, which is immediately below 250m threshold
      final update = simulator.step(loop: false);
      await pumpEventQueue();

      expect(update.distanceMeters, lessThanOrEqualTo(250.0));
      expect(update.triggeredProximityAlert, isTrue);
      expect(update.triggeredArrivalChime, isTrue);
      expect(simulator.arrivalAlertCount, equals(1));
      expect(simulator.hasTriggeredProximity, isTrue);

      // Verify custom notification was received
      expect(notifiedTitle, contains('وصلت حافلتك'));
      expect(notifiedBody, contains('المحطة الثانية'));

      // Verify event was emitted
      expect(receivedEvent, isNotNull);
      expect(receivedEvent!.stopId, equals('s2'));
      expect(receivedEvent!.distanceMeters, lessThanOrEqualTo(250.0));

      // Step again: should NOT trigger another alert for the same arrival (idempotent)
      final secondUpdate = simulator.step(loop: false);
      expect(secondUpdate.triggeredProximityAlert, isFalse);
      expect(secondUpdate.triggeredArrivalChime, isFalse);
      expect(simulator.arrivalAlertCount, equals(1));

      simulator.dispose();
    });

    test('telemetry stream emits periodic updates over time', () async {
      final simulator = TransitTelemetrySimulator(
        tickInterval: const Duration(milliseconds: 50),
        pointsPerSegment: 4,
      );

      final emissions = <BusTelemetry>[];
      final completer = Completer<void>();

      final sub = simulator.telemetryStream.listen((t) {
        emissions.add(t);
        if (emissions.length >= 3 && !completer.isCompleted) {
          completer.complete();
        }
      });

      simulator.startSimulation(route: testRoute, loop: true);

      await completer.future.timeout(const Duration(seconds: 2));

      expect(emissions.length, greaterThanOrEqualTo(3));
      expect(emissions.first.routeCode, equals('BUS-001'));
      expect(emissions[1].currentLat, isNotNull);

      await sub.cancel();
      simulator.dispose();
    });
  });
}
