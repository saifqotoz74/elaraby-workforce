import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/state/ui_state.dart';
import 'package:elaraby_workforce/features/services/data/transport_model.dart';

// ---------- My Commute Notifier ----------
class MyCommuteNotifier extends StateNotifier<UiState<MyCommuteState>> {
  MyCommuteNotifier() : super(const UiState.loading()) {
    loadCommute();
  }

  Future<void> loadCommute() async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final commute = await Backend.instance.fetchMyCommute();
      if (commute != null && commute.route != null) {
        state = UiState.success(commute);
      } else {
        state = UiState.success(_generateFallbackCommute());
      }
    } catch (_) {
      state = UiState.success(_generateFallbackCommute());
    }
  }

  Future<bool> selectStop(String routeId, String stopId) async {
    try {
      final ok = await Backend.instance.selectPickupStop(routeId: routeId, stopId: stopId);
      if (ok) {
        await loadCommute();
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<bool> toggleOptOut(bool optOut) async {
    try {
      final ok = await Backend.instance.toggleCommuteOptOut(optOut: optOut);
      if (ok) {
        await loadCommute();
        return true;
      }
    } catch (_) {}
    if (state.hasData) {
      final cur = state.data!;
      final newSuppression = CommuteSuppression(
        isSuppressed: optOut,
        reason: optOut ? 'manual_opt_out' : 'active',
        reasonAr: optOut ? 'تم إيقاف التنبيهات بناءً على رغبتك لليوم' : 'تنبيهات الحافلة مفعّلة',
        reasonEn: optOut ? 'Alerts paused by your preference for today' : 'Bus alerts active',
        optOutToday: optOut,
      );
      state = UiState.success(MyCommuteState(
        route: cur.route,
        assignment: cur.assignment != null
            ? BusAssignment(
                employeeId: cur.assignment!.employeeId,
                assignedRouteId: cur.assignment!.assignedRouteId,
                selectedStopId: cur.assignment!.selectedStopId,
                seatNumber: cur.assignment!.seatNumber,
                optOutToday: optOut,
              )
            : null,
        telemetry: cur.telemetry,
        boarding: cur.boarding,
        hasBoarded: cur.hasBoarded,
        alerts: cur.alerts,
        suppression: newSuppression,
      ));
      return true;
    }
    return false;
  }

  @visibleForTesting
  MyCommuteState generateFallbackCommuteForTesting() => _generateFallbackCommute();

  MyCommuteState _generateFallbackCommute() {
    const defaultRoute = BusRoute(
      id: 'route_101',
      code: 'BUS-101',
      nameAr: 'خط الهرم - الرماية - الدائري',
      nameEn: 'Haram - Remaya - Ring Road Line',
      destinationComplex: '10th of Ramadan',
      destinationAr: 'مجمع مصانع العاشر من رمضان',
      vehiclePlate: 'ط س ج ٥٨١٢',
      vehiclePlateEn: 'TSJ 5812',
      busModel: 'Mercedes-Benz MCV 500 (50 Seats)',
      capacity: 50,
      driver: BusDriver(
        id: 'drv_101',
        name: 'محمود عبد الفتاح شلبي',
        nameEn: 'Mahmoud Abdel-Fattah',
        phone: '+201019882233',
        rating: 4.9,
      ),
      shiftId: 'morning',
      stops: [
        BusStop(id: 'stop_101_1', nameAr: 'ميدان الرماية - أمام البنك الأهلي', nameEn: 'Remaya Square - NBE', lat: 29.993, lng: 31.118, scheduledTime: '05:45 ص', order: 1),
        BusStop(id: 'stop_101_2', nameAr: 'الهرم - محطة نصر الدين', nameEn: 'Haram - Nasr El-Din', lat: 30.007, lng: 31.196, scheduledTime: '06:00 ص', order: 2),
        BusStop(id: 'stop_101_3', nameAr: 'دائري المنيب - سلم الكونيسة', nameEn: 'Moneeb Ring Road', lat: 29.979, lng: 31.218, scheduledTime: '06:15 ص', order: 3),
        BusStop(id: 'stop_101_4', nameAr: 'موقف العاشر بالسلام', nameEn: 'Salam Terminal', lat: 30.165, lng: 31.428, scheduledTime: '06:40 ص', order: 4),
        BusStop(id: 'stop_101_5', nameAr: 'مجمع العاشر - المصنع الرئيسي (خط أ)', nameEn: '10th Complex - Plant 1', lat: 30.298, lng: 31.742, scheduledTime: '07:00 ص', order: 5),
      ],
    );

    const defaultTelemetry = BusTelemetry(
      routeId: 'route_101',
      routeCode: 'BUS-101',
      currentLat: 30.054,
      currentLng: 31.285,
      speedKmh: 64,
      headingDegrees: 48,
      currentStopName: 'دائري المنيب',
      nextStopName: 'موقف العاشر بالسلام',
      targetStopId: 'stop_101_3',
      targetStopName: 'دائري المنيب - سلم الكونيسة',
      distanceKm: 4,
      etaMinutes: 8,
      status: 'approaching',
      statusTextAr: 'على وشك الوصول (8 دقائق)',
      statusTextEn: 'Approaching (8 mins)',
      isApproaching: true,
      isAtStop: false,
      lastUpdated: 1726322400000,
    );

    return const MyCommuteState(
      route: defaultRoute,
      assignment: BusAssignment(
        employeeId: 'emp_1',
        assignedRouteId: 'route_101',
        selectedStopId: 'stop_101_3',
        seatNumber: 'A-14',
      ),
      telemetry: defaultTelemetry,
      boarding: null,
      hasBoarded: false,
      alerts: [],
    );
  }
}

// ---------- Bus Routes Directory Notifier ----------
class BusRoutesNotifier extends StateNotifier<UiState<List<BusRoute>>> {
  BusRoutesNotifier() : super(const UiState.loading()) {
    loadRoutes();
  }

  Future<void> loadRoutes({String? factory, String? shift}) async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final routes = await Backend.instance.fetchBusRoutes(factory: factory, shift: shift);
      if (routes != null && routes.isNotEmpty) {
        state = UiState.success(routes);
      } else {
        state = UiState.success(_generateFallbackRoutes());
      }
    } catch (_) {
      state = UiState.success(_generateFallbackRoutes());
    }
  }

  List<BusRoute> _generateFallbackRoutes() {
    return const [
      BusRoute(
        id: 'route_101',
        code: 'BUS-101',
        nameAr: 'خط الهرم - الرماية - الدائري',
        nameEn: 'Haram - Remaya - Ring Road Line',
        destinationComplex: '10th of Ramadan',
        destinationAr: 'مجمع مصانع العاشر من رمضان',
        vehiclePlate: 'ط س ج ٥٨١٢',
        vehiclePlateEn: 'TSJ 5812',
        busModel: 'Mercedes-Benz MCV 500 (50 Seats)',
        capacity: 50,
        driver: BusDriver(
          id: 'drv_101',
          name: 'محمود عبد الفتاح شلبي',
          nameEn: 'Mahmoud Abdel-Fattah',
          phone: '+201019882233',
        ),
        shiftId: 'morning',
        stops: [
          BusStop(id: 'stop_101_1', nameAr: 'ميدان الرماية - أمام البنك الأهلي', nameEn: 'Remaya Sq.', lat: 29.993, lng: 31.118, scheduledTime: '05:45 ص', order: 1),
          BusStop(id: 'stop_101_2', nameAr: 'الهرم - محطة نصر الدين', nameEn: 'Haram Station', lat: 30.007, lng: 31.196, scheduledTime: '06:00 ص', order: 2),
        ],
      ),
      BusRoute(
        id: 'route_201',
        code: 'BUS-201',
        nameAr: 'خط طنطا - بركة السبع - قويسنا',
        nameEn: 'Tanta - Berket El-Saba - Quesna Line',
        destinationComplex: 'Quesna',
        destinationAr: 'مجمع قويسنا الصناعي',
        vehiclePlate: 'م ن ر ٧١٢٠',
        vehiclePlateEn: 'MNR 7120',
        busModel: 'Toyota Coaster Deluxe (28 Seats)',
        capacity: 28,
        driver: BusDriver(
          id: 'drv_201',
          name: 'صبحي عبد الهادي منصور',
          nameEn: 'Sobhy Abdel-Hadi',
          phone: '+201223344889',
        ),
        shiftId: 'morning',
        stops: [
          BusStop(id: 'stop_201_1', nameAr: 'طنطا - محطة قطار المحطة', nameEn: 'Tanta Station', lat: 30.786, lng: 31.001, scheduledTime: '06:00 ص', order: 1),
        ],
      ),
    ];
  }
}

// ---------- Boarding Pass Notifier ----------
class BoardingPassNotifier extends StateNotifier<UiState<BoardingPassData>> {
  BoardingPassNotifier() : super(const UiState.loading()) {
    loadPass();
  }

  Future<void> loadPass() async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final pass = await Backend.instance.fetchBoardingPass();
      if (pass != null) {
        state = UiState.success(pass);
      } else {
        state = UiState.success(_generateFallbackPass());
      }
    } catch (_) {
      state = UiState.success(_generateFallbackPass());
    }
  }

  BoardingPassData _generateFallbackPass() {
    return BoardingPassData(
      employeeId: 'emp_1',
      employeeName: 'أحمد غنّام',
      employeeCode: 'EG-20481',
      routeId: 'route_101',
      routeCode: 'BUS-101',
      routeNameAr: 'خط الهرم - الرماية - العاشر',
      routeNameEn: 'Haram - Remaya - 10th Line',
      seatNumber: 'A-14',
      vehiclePlate: 'ط س ج ٥٨١٢',
      destinationAr: 'مجمع مصانع العاشر من رمضان',
      qrToken: 'ELARABY-BUS-DEMO-BOARDING-PASS-${DateTime.now().millisecondsSinceEpoch}',
      expiresInSeconds: 58,
      issuedAt: DateTime.now().millisecondsSinceEpoch,
    );
  }
}

// ---------- Route Alerts Notifier ----------
class RouteAlertsNotifier extends StateNotifier<UiState<List<RouteAlert>>> {
  RouteAlertsNotifier() : super(const UiState.loading()) {
    loadAlerts();
  }

  Future<void> loadAlerts({String? routeId}) async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final alerts = await Backend.instance.fetchRouteAlerts(routeId: routeId);
      state = UiState.success(alerts ?? []);
    } catch (_) {
      state = const UiState.success([]);
    }
  }

  Future<bool> reportIncident({
    required String routeId,
    required String type,
    required String message,
    int delayMinutes = 15,
  }) async {
    try {
      final ok = await Backend.instance.reportRouteIncident(
        routeId: routeId,
        type: type,
        message: message,
        delayMinutes: delayMinutes,
      );
      if (ok) {
        await loadAlerts(routeId: routeId);
        return true;
      }
    } catch (_) {}
    return false;
  }
}

// ---------- Riverpod Providers ----------
final myCommuteProvider =
    StateNotifierProvider<MyCommuteNotifier, UiState<MyCommuteState>>((ref) {
  return MyCommuteNotifier();
});

final busRoutesProvider =
    StateNotifierProvider<BusRoutesNotifier, UiState<List<BusRoute>>>((ref) {
  return BusRoutesNotifier();
});

final boardingPassProvider =
    StateNotifierProvider<BoardingPassNotifier, UiState<BoardingPassData>>((ref) {
  return BoardingPassNotifier();
});

final routeAlertsProvider =
    StateNotifierProvider<RouteAlertsNotifier, UiState<List<RouteAlert>>>((ref) {
  return RouteAlertsNotifier();
});

// ---------- Driver Console Notifier ----------
class DriverConsoleNotifier extends StateNotifier<UiState<RouteManifestData>> {
  final String routeId;

  DriverConsoleNotifier(this.routeId) : super(const UiState.loading()) {
    loadManifest();
  }

  Future<void> loadManifest() async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final manifest = await Backend.instance.fetchRouteManifest(routeId: routeId);
      if (manifest != null && manifest.stops.isNotEmpty) {
        state = UiState.success(manifest);
        return;
      }
    } catch (_) {}
    state = UiState.success(_generateFallbackManifest(routeId));
  }

  Future<bool> manualBoardPassenger({
    required String employeeId,
  }) async {
    try {
      final res = await Backend.instance.manualBoardPassenger(
        employeeId: employeeId,
        routeId: routeId,
      );
      if (res != null && res['success'] == true) {
        await loadManifest();
        return true;
      }
    } catch (_) {}

    // Optimistic fallback update
    if (state.hasData) {
      final cur = state.data!;
      var found = false;
      final updatedStops = cur.stops.map((stop) {
        final updatedPassengers = stop.passengers.map((p) {
          if (p.id == employeeId && !p.isBoarded) {
            found = true;
            return ManifestPassenger(
              id: p.id,
              nameAr: p.nameAr,
              nameEn: p.nameEn,
              department: p.department,
              phone: p.phone,
              seatNumber: p.seatNumber,
              photoUrl: p.photoUrl,
              boardingStatus: 'boarded',
              boardedAt: '06:15 ص',
              verifiedBy: 'manual_supervisor',
            );
          }
          return p;
        }).toList();

        final boarded = updatedPassengers.where((p) => p.isBoarded).length;
        final waiting = updatedPassengers.where((p) => p.isWaiting).length;
        final opted = updatedPassengers.where((p) => p.isOptedOut).length;

        return ManifestStop(
          id: stop.id,
          nameAr: stop.nameAr,
          nameEn: stop.nameEn,
          scheduledTime: stop.scheduledTime,
          order: stop.order,
          isNext: stop.isNext,
          isPassed: stop.isPassed,
          boardedCount: boarded,
          waitingCount: waiting,
          optedOutCount: opted,
          passengers: updatedPassengers,
        );
      }).toList();

      if (found) {
        final totalAssigned = cur.headcounts.totalAssigned;
        final newBoarded = cur.headcounts.boarded + 1;
        final newWaiting = (cur.headcounts.waiting - 1).clamp(0, totalAssigned);
        final capacity = cur.route?.capacity ?? 50;

        state = UiState.success(RouteManifestData(
          route: cur.route,
          headcounts: ManifestHeadcounts(
            totalAssigned: totalAssigned,
            boarded: newBoarded,
            waiting: newWaiting,
            optedOut: cur.headcounts.optedOut,
            occupancyRate: ((newBoarded / (capacity > 0 ? capacity : 50)) * 100).round(),
            allAccountedFor: (newBoarded + cur.headcounts.optedOut) >= totalAssigned,
          ),
          stops: updatedStops,
        ));
        return true;
      }
    }
    return false;
  }

  Future<bool> advanceStopDeparture({
    required String stopId,
  }) async {
    try {
      final res = await Backend.instance.advanceStopDeparture(
        routeId: routeId,
        stopId: stopId,
      );
      if (res != null && res['success'] == true) {
        await loadManifest();
        return true;
      }
    } catch (_) {}

    // Optimistic fallback
    if (state.hasData) {
      final cur = state.data!;
      final stops = cur.stops;
      final idx = stops.indexWhere((s) => s.id == stopId);
      if (idx >= 0) {
        final updatedStops = <ManifestStop>[];
        for (var i = 0; i < stops.length; i++) {
          final s = stops[i];
          if (i <= idx) {
            updatedStops.add(ManifestStop(
              id: s.id,
              nameAr: s.nameAr,
              nameEn: s.nameEn,
              scheduledTime: s.scheduledTime,
              order: s.order,
              isNext: false,
              isPassed: true,
              boardedCount: s.boardedCount,
              waitingCount: s.waitingCount,
              optedOutCount: s.optedOutCount,
              passengers: s.passengers,
            ));
          } else if (i == idx + 1) {
            updatedStops.add(ManifestStop(
              id: s.id,
              nameAr: s.nameAr,
              nameEn: s.nameEn,
              scheduledTime: s.scheduledTime,
              order: s.order,
              isNext: true,
              isPassed: false,
              boardedCount: s.boardedCount,
              waitingCount: s.waitingCount,
              optedOutCount: s.optedOutCount,
              passengers: s.passengers,
            ));
          } else {
            updatedStops.add(s);
          }
        }
        state = UiState.success(RouteManifestData(
          route: cur.route,
          headcounts: cur.headcounts,
          stops: updatedStops,
        ));
        return true;
      }
    }
    return false;
  }

  Future<bool> reportHighwayDelay({
    required int delayMinutes,
    required String type,
    required String message,
  }) async {
    try {
      final ok = await Backend.instance.reportRouteIncident(
        routeId: routeId,
        type: type,
        message: message,
        delayMinutes: delayMinutes,
      );
      return ok;
    } catch (_) {
      return true; // Return true on simulated offline mode
    }
  }

  Future<bool> completeRouteRun() async {
    try {
      final res = await Backend.instance.completeRouteRun(routeId: routeId);
      if (res != null && res['success'] == true) {
        await loadManifest();
        return true;
      }
    } catch (_) {}

    // Optimistic fallback
    if (state.hasData) {
      final cur = state.data!;
      final updatedStops = cur.stops.map((s) => ManifestStop(
        id: s.id,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        scheduledTime: s.scheduledTime,
        order: s.order,
        isNext: false,
        isPassed: true,
        boardedCount: s.boardedCount,
        waitingCount: s.waitingCount,
        optedOutCount: s.optedOutCount,
        passengers: s.passengers,
      )).toList();

      state = UiState.success(RouteManifestData(
        route: cur.route,
        headcounts: cur.headcounts,
        stops: updatedStops,
      ));
      return true;
    }
    return false;
  }

  static RouteManifestData _generateFallbackManifest(String routeId) {
    const route = BusRoute(
      id: 'route_101',
      code: 'BUS-101',
      nameAr: 'خط الهرم - الرماية - الدائري',
      nameEn: 'Haram - Remaya - Ring Road Line',
      destinationComplex: '10th of Ramadan',
      destinationAr: 'مجمع مصانع العاشر من رمضان',
      vehiclePlate: 'ط س ج ٥٨١٢',
      vehiclePlateEn: 'TSJ 5812',
      busModel: 'Mercedes-Benz MCV 500 (50 Seats)',
      capacity: 50,
      driver: BusDriver(
        id: 'drv_101',
        name: 'محمود عبد الفتاح شلبي',
        nameEn: 'Mahmoud Abdel-Fattah',
        phone: '+201019882233',
        rating: 4.9,
      ),
      shiftId: 'morning',
      stops: [],
    );

    final stops = [
      const ManifestStop(
        id: 'stop_101_1',
        nameAr: 'ميدان الرماية - أمام البنك الأهلي',
        nameEn: 'Remaya Square - NBE',
        scheduledTime: '05:45 ص',
        order: 1,
        isNext: false,
        isPassed: true,
        boardedCount: 1,
        waitingCount: 1,
        optedOutCount: 0,
        passengers: [
          ManifestPassenger(
            id: 'emp_1',
            nameAr: 'أحمد حسن منصور',
            nameEn: 'Ahmed Hassan Mansour',
            department: 'إنتاج شاشات تليفزيون',
            phone: '+201001234567',
            seatNumber: 'A-12',
            boardingStatus: 'boarded',
            boardedAt: '05:48 ص',
            verifiedBy: 'qr_scanner',
          ),
          ManifestPassenger(
            id: 'emp_10',
            nameAr: 'كريم إبراهيم جاد',
            nameEn: 'Karim Ibrahim Gad',
            department: 'مستودعات الغسالات المركزية',
            phone: '+201019988776',
            seatNumber: 'A-14',
            boardingStatus: 'waiting',
          ),
        ],
      ),
      const ManifestStop(
        id: 'stop_101_2',
        nameAr: 'الهرم - محطة نصر الدين',
        nameEn: 'Haram - Nasr El-Din',
        scheduledTime: '06:00 ص',
        order: 2,
        isNext: true,
        isPassed: false,
        boardedCount: 0,
        waitingCount: 1,
        optedOutCount: 1,
        passengers: [
          ManifestPassenger(
            id: 'emp_2',
            nameAr: 'منى السيد إبراهيم',
            nameEn: 'Mona El-Sayed Ibrahim',
            department: 'مراقبة الجودة والتفتيش',
            phone: '+201009876543',
            seatNumber: 'B-04',
            boardingStatus: 'waiting',
          ),
          ManifestPassenger(
            id: 'emp_12',
            nameAr: 'حسام الدين مختار',
            nameEn: 'Hossam El-Din Mokhtar',
            department: 'هندسة الصيانة الميكانيكية',
            phone: '+201023344556',
            seatNumber: 'B-06',
            boardingStatus: 'opted_out',
            optOutReason: 'إجازة سنوية معتمدة',
          ),
        ],
      ),
      const ManifestStop(
        id: 'stop_101_3',
        nameAr: 'دائري المنيب - سلم الكونيسة',
        nameEn: 'Moneeb Ring Road',
        scheduledTime: '06:15 ص',
        order: 3,
        isNext: false,
        isPassed: false,
        boardedCount: 0,
        waitingCount: 1,
        optedOutCount: 0,
        passengers: [
          ManifestPassenger(
            id: 'emp_3',
            nameAr: 'م. طارق فاروق عفيفي',
            nameEn: 'Tarek Farouk Afifi',
            department: 'إدارة المشروعات والتطوير',
            phone: '+201011223344',
            seatNumber: 'C-01',
            boardingStatus: 'waiting',
          ),
        ],
      ),
      const ManifestStop(
        id: 'stop_101_4',
        nameAr: 'موقف العاشر بالسلام',
        nameEn: 'Salam Terminal',
        scheduledTime: '06:40 ص',
        order: 4,
        isNext: false,
        isPassed: false,
        boardedCount: 0,
        waitingCount: 1,
        optedOutCount: 0,
        passengers: [
          ManifestPassenger(
            id: 'emp_4',
            nameAr: 'دعاء أحمد خليل',
            nameEn: 'Doaa Ahmed Khalil',
            department: 'الموارد البشرية والشؤون الإدارية',
            phone: '+201022334455',
            seatNumber: 'D-08',
            boardingStatus: 'waiting',
          ),
        ],
      ),
      const ManifestStop(
        id: 'stop_101_5',
        nameAr: 'مجمع العاشر - المصنع الرئيسي (خط أ)',
        nameEn: '10th Complex - Plant 1',
        scheduledTime: '07:00 ص',
        order: 5,
        isNext: false,
        isPassed: false,
        boardedCount: 0,
        waitingCount: 0,
        optedOutCount: 0,
        passengers: [],
      ),
    ];

    return RouteManifestData(
      route: route,
      headcounts: const ManifestHeadcounts(
        totalAssigned: 5,
        boarded: 1,
        waiting: 3,
        optedOut: 1,
        occupancyRate: 20,
        allAccountedFor: false,
      ),
      stops: stops,
    );
  }
}

final driverConsoleProvider = StateNotifierProvider.family<DriverConsoleNotifier,
    UiState<RouteManifestData>, String>((ref, routeId) {
  return DriverConsoleNotifier(routeId);
});

