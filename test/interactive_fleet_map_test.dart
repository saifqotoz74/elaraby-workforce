import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:elaraby_workforce/features/services/data/transport_model.dart';
import 'package:elaraby_workforce/features/services/presentation/widgets/interactive_fleet_map.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/driver_console_screen.dart';

void main() {
  const dummyRoute = BusRoute(
    id: 'route_101',
    code: 'BUS-101',
    nameAr: 'خط الهرم - الرماية - الدائري',
    nameEn: 'Haram - Remaya Line',
    destinationComplex: '10th of Ramadan',
    destinationAr: 'مجمع مصانع العاشر من رمضان',
    vehiclePlate: 'ط س ج ٥٨١٢',
    vehiclePlateEn: 'TSJ 5812',
    busModel: 'Mercedes-Benz MCV 500',
    capacity: 50,
    driver: BusDriver(
      id: 'drv_101',
      name: 'محمود عبد الفتاح شلبي',
      nameEn: 'Mahmoud Abdel-Fattah',
      phone: '+201019882233',
    ),
    shiftId: 'morning',
    stops: [
      BusStop(
        id: 'stop_1',
        nameAr: 'ميدان الرماية',
        nameEn: 'Remaya Square',
        lat: 29.993,
        lng: 31.118,
        scheduledTime: '05:45 ص',
        order: 1,
      ),
      BusStop(
        id: 'stop_2',
        nameAr: 'الهرم - نصر الدين',
        nameEn: 'Haram - Nasr El-Din',
        lat: 30.007,
        lng: 31.196,
        scheduledTime: '06:00 ص',
        order: 2,
      ),
      BusStop(
        id: 'stop_3',
        nameAr: 'مجمع العاشر من رمضان',
        nameEn: '10th Complex',
        lat: 30.298,
        lng: 31.742,
        scheduledTime: '07:00 ص',
        order: 3,
      ),
    ],
  );

  const dummyTelemetry = BusTelemetry(
    routeId: 'route_101',
    routeCode: 'BUS-101',
    currentLat: 30.001,
    currentLng: 31.155,
    speedKmh: 62,
    headingDegrees: 45,
    currentStopName: 'ميدان الرماية',
    nextStopName: 'الهرم - نصر الدين',
    targetStopId: 'stop_2',
    targetStopName: 'الهرم - نصر الدين',
    distanceKm: 2,
    etaMinutes: 7,
    status: 'on_schedule',
    statusTextAr: 'في الموعد المحدد',
    statusTextEn: 'On Schedule',
    isApproaching: true,
    lastUpdated: 1773499200000,
  );

  group('InteractiveFleetMap - Widget & Integration Tests', () {
    testWidgets('Renders FlutterMap with TileLayer, PolylineLayer and Markers',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: InteractiveFleetMap(
              route: dummyRoute,
              telemetry: dummyTelemetry,
              selectedStop: dummyRoute.stops[1],
              isArabic: true,
              height: 300,
            ),
          ),
        ),
      );

      // Verify flutter_map widget is mounted
      expect(find.byType(FlutterMap), findsOneWidget);
      expect(find.byType(TileLayer), findsOneWidget);
      expect(find.byType(PolylineLayer), findsWidgets);
      expect(find.byType(MarkerLayer), findsWidgets);
      expect(find.byType(CircleLayer), findsOneWidget);

      // Verify header status shows approaching banner when distance <= 3km
      expect(find.text('الحافلة تقترب منك!'), findsOneWidget);
      expect(find.text('62 كم/س'), findsOneWidget);
    });

    testWidgets('Tapping floating camera controls switches modes',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: InteractiveFleetMap(
              route: dummyRoute,
              telemetry: dummyTelemetry,
              selectedStop: dummyRoute.stops[1],
              isArabic: false,
              height: 300,
            ),
          ),
        ),
      );

      // Verify English controls are displayed
      expect(find.text('Follow Bus'), findsOneWidget);
      expect(find.text('My Stop'), findsOneWidget);
      expect(find.text('Whole Route'), findsOneWidget);

      // Tap Follow Bus
      await tester.tap(find.text('Follow Bus'));
      await tester.pump(const Duration(milliseconds: 100));

      // Tap My Stop
      await tester.tap(find.text('My Stop'));
      await tester.pump(const Duration(milliseconds: 100));

      // Tap Whole Route
      await tester.tap(find.text('Whole Route'));
      await tester.pump(const Duration(milliseconds: 100));
    });

    testWidgets('Tapping offline mode icon switches to Vector Canvas fallback',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: InteractiveFleetMap(
              route: dummyRoute,
              telemetry: dummyTelemetry,
              selectedStop: dummyRoute.stops[1],
              isArabic: true,
              height: 300,
            ),
          ),
        ),
      );

      // Tap offline bolt icon
      final offlineBtn = find.byIcon(Icons.offline_bolt_outlined);
      expect(offlineBtn, findsOneWidget);
      await tester.tap(offlineBtn);
      await tester.pump(const Duration(milliseconds: 100));

      // Verify fallback painter is mounted
      expect(find.byType(CustomPaint), findsWidgets);
      expect(find.text('وضع الخريطة غير المتصلة (أوفلاين)'), findsOneWidget);

      // Tap return to tiles
      final returnBtn = find.text('العودة لخريطة الأقمار');
      expect(returnBtn, findsOneWidget);
      await tester.tap(returnBtn);
      await tester.pump(const Duration(milliseconds: 100));

      // Back to FlutterMap
      expect(find.byType(FlutterMap), findsOneWidget);
    });

    testWidgets('Tapping a stop pin triggers inspection modal bottom sheet',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      BusStop? selectedByCallback;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: InteractiveFleetMap(
              route: dummyRoute,
              telemetry: dummyTelemetry,
              selectedStop: dummyRoute.stops[1],
              isArabic: true,
              height: 300,
              onSetAsPickup: (stop) {
                selectedByCallback = stop;
              },
            ),
          ),
        ),
      );

      // Find origin stop pin (marked with trip_origin_rounded)
      final originPin = find.byIcon(Icons.trip_origin_rounded);
      expect(originPin, findsOneWidget);
      await tester.tap(originPin);
      
      // Advance frames across the modal bottom sheet transition
      for (int i = 0; i < 15; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      // Bottom sheet with stop name should appear
      expect(find.text('ميدان الرماية'), findsOneWidget);
      expect(find.text('تعيين كمحطة ركوبي الأساسية'), findsOneWidget);

      // Tap Set as Pickup Stop button
      await tester.tap(find.text('تعيين كمحطة ركوبي الأساسية'), warnIfMissed: false);
      for (int i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      expect(selectedByCallback?.id, equals('stop_1'));
    });
  });

  group('Driver Console - Adaptive Cockpit Tests', () {
    testWidgets('Driver console provides map toggle button on phone layout',
        (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: DriverConsoleScreen(routeId: 'route_101'),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));

      // Verify toggle button exists
      final mapToggle = find.byIcon(Icons.map_outlined);
      expect(mapToggle, findsOneWidget);

      // Toggle map open
      await tester.tap(mapToggle);
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.byType(InteractiveFleetMap), findsOneWidget);
    });

    testWidgets('Driver console displays side-by-side split screen on tablet width',
        (tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: DriverConsoleScreen(routeId: 'route_101'),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));

      // Tablet split screen displays InteractiveFleetMap side-by-side with manifest
      expect(find.byType(InteractiveFleetMap), findsOneWidget);
    });
  });
}
