import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../data/transport_model.dart';
import '../../../../core/network/push_service.dart';

/// Type alias for route representation matching interface specification.
typedef RouteInfo = BusRoute;

/// Intermediate GPS coordinate along route polyline with simulated driving parameters.
class TransitWaypoint {
  final double lat;
  final double lng;
  final int speedKmh;
  final String currentStopName;
  final String nextStopName;
  final int stopIndex;
  final int headingDegrees;

  const TransitWaypoint({
    required this.lat,
    required this.lng,
    required this.speedKmh,
    required this.currentStopName,
    required this.nextStopName,
    required this.stopIndex,
    required this.headingDegrees,
  });
}

/// Event emitted when bus arrives within the 250-meter proximity boundary of a stop.
class ArrivalAlertEvent {
  final String stopId;
  final String stopNameAr;
  final String stopNameEn;
  final double distanceMeters;
  final int etaSeconds;
  final DateTime timestamp;

  const ArrivalAlertEvent({
    required this.stopId,
    required this.stopNameAr,
    required this.stopNameEn,
    required this.distanceMeters,
    required this.etaSeconds,
    required this.timestamp,
  });
}

/// Comprehensive telemetry update packaging both high-level telemetry and
/// fine-grained precision metrics (exact remaining seconds, distance in meters).
class SimulatedTransitUpdate {
  final BusTelemetry telemetry;
  final int etaSecondsRemaining;
  final double distanceMeters;
  final int currentWaypointIndex;
  final int totalWaypoints;
  final bool triggeredProximityAlert;
  final bool triggeredArrivalChime;

  const SimulatedTransitUpdate({
    required this.telemetry,
    required this.etaSecondsRemaining,
    required this.distanceMeters,
    required this.currentWaypointIndex,
    required this.totalWaypoints,
    this.triggeredProximityAlert = false,
    this.triggeredArrivalChime = false,
  });
}

/// Real-time live transit driver GPS telemetry simulator.
/// Interpolates intermediate waypoints along route polylines, streams telemetry
/// every 1500ms, calculates live dynamic seconds countdown ETA, and triggers
/// proximity alerts, system audio chimes, heavy haptics, and notifications
/// when entering the 250m stop geofence.
class TransitTelemetrySimulator {
  final Duration tickInterval;
  final int pointsPerSegment;

  Timer? _timer;
  final StreamController<BusTelemetry> _telemetryController =
      StreamController<BusTelemetry>.broadcast();
  final StreamController<SimulatedTransitUpdate> _updateController =
      StreamController<SimulatedTransitUpdate>.broadcast();
  final StreamController<ArrivalAlertEvent> _alertController =
      StreamController<ArrivalAlertEvent>.broadcast();

  List<TransitWaypoint> _waypoints = [];
  int _currentIndex = 0;
  bool _isSimulating = false;
  bool _hasTriggeredProximity = false;
  int _arrivalAlertCount = 0;
  int _currentEtaSeconds = 0;

  BusRoute? _activeRoute;
  BusStop? _targetStop;

  /// Hook for tests to intercept notification payloads
  Future<void> Function({required String title, required String body})?
      customNotificationHandler;

  /// Hook for listeners to handle arrival alert events
  void Function(ArrivalAlertEvent event)? onArrivalAlert;

  TransitTelemetrySimulator({
    this.tickInterval = const Duration(milliseconds: 1500),
    this.pointsPerSegment = 8,
    this.customNotificationHandler,
    this.onArrivalAlert,
  });

  bool get isSimulating => _isSimulating;
  int get currentWaypointIndex => _currentIndex;
  int get totalWaypoints => _waypoints.length;
  List<TransitWaypoint> get waypoints => List.unmodifiable(_waypoints);
  int get arrivalAlertCount => _arrivalAlertCount;
  int get currentEtaSeconds => _currentEtaSeconds;
  bool get hasTriggeredProximity => _hasTriggeredProximity;
  BusRoute? get activeRoute => _activeRoute;
  BusStop? get targetStop => _targetStop;

  Stream<BusTelemetry> get telemetryStream => _telemetryController.stream;
  Stream<SimulatedTransitUpdate> get updateStream => _updateController.stream;
  Stream<ArrivalAlertEvent> get alertStream => _alertController.stream;

  /// Calculates geodesic distance between two coordinates in meters using the Haversine formula.
  static double calculateDistanceMeters(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    const double earthRadius = 6371000.0; // Earth radius in meters
    final dLat = (lat2 - lat1) * (math.pi / 180.0);
    final dLng = (lng2 - lng1) * (math.pi / 180.0);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * (math.pi / 180.0)) *
            math.cos(lat2 * (math.pi / 180.0)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadius * c;
  }

  /// Calculates compass bearing in degrees (0..359) from point 1 to point 2.
  static int calculateBearing(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    final phi1 = lat1 * (math.pi / 180.0);
    final phi2 = lat2 * (math.pi / 180.0);
    final deltaLambda = (lng2 - lng1) * (math.pi / 180.0);
    final y = math.sin(deltaLambda) * math.cos(phi2);
    final x = math.cos(phi1) * math.sin(phi2) -
        math.sin(phi1) * math.cos(phi2) * math.cos(deltaLambda);
    final theta = math.atan2(y, x);
    final deg = (theta * 180.0 / math.pi + 360.0) % 360.0;
    return deg.round() % 360;
  }

  /// Generates a sequential list of intermediate waypoints with interpolated
  /// coordinates, realistic speeds, and headings along the route corridor.
  List<TransitWaypoint> generateWaypoints(
    BusRoute route, {
    int? segmentPoints,
  }) {
    final count = segmentPoints ?? pointsPerSegment;
    final List<TransitWaypoint> generated = [];

    if (route.stops.isEmpty) return generated;
    if (route.stops.length == 1) {
      final s = route.stops.first;
      generated.add(TransitWaypoint(
        lat: s.lat,
        lng: s.lng,
        speedKmh: 0,
        currentStopName: s.nameAr,
        nextStopName: s.nameAr,
        stopIndex: 0,
        headingDegrees: 0,
      ));
      return generated;
    }

    for (int i = 0; i < route.stops.length - 1; i++) {
      final stopA = route.stops[i];
      final stopB = route.stops[i + 1];
      final segmentBearing =
          calculateBearing(stopA.lat, stopA.lng, stopB.lat, stopB.lng);

      for (int k = 0; k < count; k++) {
        final t = k / count;
        final lat = stopA.lat + (stopB.lat - stopA.lat) * t;
        final lng = stopA.lng + (stopB.lng - stopA.lng) * t;

        // Speed model: slow down near stops, cruise in middle
        int speed;
        if (k == 0) {
          speed = 0; // Stopped at stop
        } else if (k == 1 || k == count - 1) {
          speed = 25; // Accelerating/decelerating
        } else {
          speed = 55 + (k % 3) * 5; // Cruising 55-65 km/h
        }

        generated.add(TransitWaypoint(
          lat: lat,
          lng: lng,
          speedKmh: speed,
          currentStopName: stopA.nameAr,
          nextStopName: stopB.nameAr,
          stopIndex: i,
          headingDegrees: segmentBearing,
        ));
      }
    }

    // Final terminal stop waypoint
    final lastStop = route.stops.last;
    final prevStop = route.stops[route.stops.length - 2];
    final lastBearing = calculateBearing(
      prevStop.lat,
      prevStop.lng,
      lastStop.lat,
      lastStop.lng,
    );

    generated.add(TransitWaypoint(
      lat: lastStop.lat,
      lng: lastStop.lng,
      speedKmh: 0,
      currentStopName: lastStop.nameAr,
      nextStopName: lastStop.nameAr,
      stopIndex: route.stops.length - 1,
      headingDegrees: lastBearing,
    ));

    return generated;
  }

  /// Initializes route and waypoints without starting timer or emitting frames.
  void initializeRoute({
    required BusRoute route,
    String? targetStopId,
  }) {
    stopSimulation();
    _activeRoute = route;
    _waypoints = generateWaypoints(route);
    _currentIndex = 0;
    _hasTriggeredProximity = false;
    _arrivalAlertCount = 0;

    if (targetStopId != null) {
      _targetStop = route.stops.firstWhere(
        (s) => s.id == targetStopId,
        orElse: () => route.stops.length > 2
            ? route.stops[2]
            : route.stops.last,
      );
    } else {
      _targetStop = route.stops.length > 2
          ? route.stops[2]
          : route.stops.last;
    }
  }

  /// Starts the live simulation stream for the given route and optional target stop.
  Stream<BusTelemetry> startSimulation({
    required BusRoute route,
    String? targetStopId,
    bool loop = true,
  }) {
    initializeRoute(route: route, targetStopId: targetStopId);
    _isSimulating = true;

    // Emit initial frame immediately
    _emitCurrentFrame(loop: loop);

    // Schedule 1500ms ticker
    _timer = Timer.periodic(tickInterval, (_) {
      if (!_isSimulating) return;
      _currentIndex++;
      if (_currentIndex >= _waypoints.length) {
        if (loop) {
          _currentIndex = 0;
          _hasTriggeredProximity = false;
        } else {
          stopSimulation();
          return;
        }
      }
      _emitCurrentFrame(loop: loop);
    });

    return _telemetryController.stream;
  }

  /// Manually advances one simulation step (useful for instant determinism in tests).
  SimulatedTransitUpdate step({bool loop = true}) {
    if (_waypoints.isEmpty && _activeRoute != null) {
      _waypoints = generateWaypoints(_activeRoute!);
    }
    if (_waypoints.isEmpty) {
      throw StateError('Cannot step simulation without waypoints or an active route');
    }

    final update = _emitCurrentFrame(loop: loop);
    _currentIndex++;
    if (_currentIndex >= _waypoints.length) {
      if (loop) {
        _currentIndex = 0;
        _hasTriggeredProximity = false;
      } else {
        _currentIndex = _waypoints.length - 1;
      }
    }
    return update;
  }

  /// Emits the telemetry state for the current waypoint position.
  SimulatedTransitUpdate _emitCurrentFrame({required bool loop}) {
    final route = _activeRoute;
    if (route == null || _waypoints.isEmpty) {
      throw StateError('Active route and waypoints must not be empty');
    }

    final waypoint = _waypoints[_currentIndex.clamp(0, _waypoints.length - 1)];
    final target = _targetStop ?? route.stops.last;

    // Calculate distance to target stop
    final distanceMeters = calculateDistanceMeters(
      waypoint.lat,
      waypoint.lng,
      target.lat,
      target.lng,
    );

    // Speed calculation and seconds ETA countdown
    // Use effective speed of ~10 m/s (~36 km/h) if idling or moving slowly
    final effectiveSpeedMps = waypoint.speedKmh > 10
        ? (waypoint.speedKmh * 1000.0) / 3600.0
        : 10.0;

    _currentEtaSeconds = math.max(0, (distanceMeters / effectiveSpeedMps).round());
    final etaMinutes = math.max(1, (_currentEtaSeconds / 60.0).ceil());
    final distanceKm = math.max(1, (distanceMeters / 1000.0).ceil());

    final isAtStop = distanceMeters <= 60.0;
    final isApproaching = distanceMeters <= 1000.0 || etaMinutes <= 3;

    bool triggeredAlertThisTick = false;
    bool triggeredChimeThisTick = false;

    // Proximity alert threshold: <= 250 meters
    if (distanceMeters <= 250.0 && !_hasTriggeredProximity) {
      _hasTriggeredProximity = true;
      triggeredAlertThisTick = true;
      triggeredChimeThisTick = true;
      _triggerProximityAlert(target, distanceMeters, _currentEtaSeconds);
    }

    final String status;
    final String statusAr;
    final String statusEn;

    if (isAtStop) {
      status = 'at_stop';
      statusAr = 'وصلت الحافلة إلى محطتك الآن!';
      statusEn = 'Bus arrived at your stop!';
    } else if (isApproaching) {
      status = 'approaching';
      statusAr = 'على وشك الوصول ($_currentEtaSeconds ثانية)';
      statusEn = 'Approaching ($_currentEtaSeconds sec)';
    } else {
      status = 'in_transit';
      statusAr = 'في الطريق إلى محطتك ($etaMinutes دقيقة)';
      statusEn = 'En route ($etaMinutes mins)';
    }

    final telemetry = BusTelemetry(
      routeId: route.id,
      routeCode: route.code,
      currentLat: waypoint.lat,
      currentLng: waypoint.lng,
      speedKmh: waypoint.speedKmh,
      headingDegrees: waypoint.headingDegrees,
      currentStopName: waypoint.currentStopName,
      nextStopName: waypoint.nextStopName,
      targetStopId: target.id,
      targetStopName: target.nameAr,
      distanceKm: distanceKm,
      etaMinutes: etaMinutes,
      status: status,
      statusTextAr: statusAr,
      statusTextEn: statusEn,
      isApproaching: isApproaching,
      isAtStop: isAtStop,
      lastUpdated: DateTime.now().millisecondsSinceEpoch,
    );

    final update = SimulatedTransitUpdate(
      telemetry: telemetry,
      etaSecondsRemaining: _currentEtaSeconds,
      distanceMeters: distanceMeters,
      currentWaypointIndex: _currentIndex,
      totalWaypoints: _waypoints.length,
      triggeredProximityAlert: triggeredAlertThisTick,
      triggeredArrivalChime: triggeredChimeThisTick,
    );

    if (!_telemetryController.isClosed) {
      _telemetryController.add(telemetry);
    }
    if (!_updateController.isClosed) {
      _updateController.add(update);
    }

    return update;
  }

  /// Triggers proximity sound chime, heavy impact haptics, local push notification,
  /// and emits [ArrivalAlertEvent].
  Future<void> _triggerProximityAlert(
    BusStop stop,
    double distanceMeters,
    int etaSeconds,
  ) async {
    _arrivalAlertCount++;

    // 1. Audio chime alert
    try {
      await SystemSound.play(SystemSoundType.alert);
    } catch (e) {
      debugPrint('TransitTelemetrySimulator: SystemSound alert audio: $e');
    }

    // 2. Heavy impact tactile haptic alert
    try {
      await HapticFeedback.heavyImpact();
    } catch (e) {
      debugPrint('TransitTelemetrySimulator: Haptic feedback: $e');
    }

    // 3. High-priority local notification
    await _showProximityNotification(stop);

    // 4. Emit arrival alert event
    final event = ArrivalAlertEvent(
      stopId: stop.id,
      stopNameAr: stop.nameAr,
      stopNameEn: stop.nameEn,
      distanceMeters: distanceMeters,
      etaSeconds: etaSeconds,
      timestamp: DateTime.now(),
    );

    if (!_alertController.isClosed) {
      _alertController.add(event);
    }
    onArrivalAlert?.call(event);
  }

  /// Displays foreground heads-up banner via [FlutterLocalNotificationsPlugin]
  /// or test mock handler.
  Future<void> _showProximityNotification(BusStop stop) async {
    final title = 'وصلت حافلتك إلى المحطة!';
    final body =
        'الحافلة على بُعد أقل من 250 متر من محطة "${stop.nameAr}". يُرجى الاستعداد للصعود الآن.';

    if (customNotificationHandler != null) {
      await customNotificationHandler!(title: title, body: body);
      return;
    }

    // Ensure PushService has been initialized before posting notification
    if (PushService.instance.permissionStatus ==
        NotificationPermissionStatus.denied) {
      debugPrint('TransitTelemetrySimulator: Notifications denied by user preference');
    }

    if (Platform.environment.containsKey('FLUTTER_TEST')) return;

    try {
      final localNotifications = FlutterLocalNotificationsPlugin();
      const androidDetails = AndroidNotificationDetails(
        'workforce_high_importance_channel',
        'Workforce Notifications',
        channelDescription:
            'Notifications and announcements from your workforce organization.',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        enableVibration: true,
        icon: '@mipmap/ic_launcher',
      );
      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      await localNotifications.show(
        777,
        title,
        body,
        const NotificationDetails(
          android: androidDetails,
          iOS: iosDetails,
        ),
      );
    } catch (e) {
      debugPrint('TransitTelemetrySimulator: Local notification trigger error: $e');
    }
  }

  /// Stops and tears down the telemetry simulator.
  void stopSimulation() {
    _timer?.cancel();
    _timer = null;
    _isSimulating = false;
  }

  /// Disposes stream controllers and timers.
  void dispose() {
    stopSimulation();
    _telemetryController.close();
    _updateController.close();
    _alertController.close();
  }
}
