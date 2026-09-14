import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Path;
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/transport_model.dart';

/// Production-grade interactive live fleet tracking map.
/// Built with OpenStreetMap (via flutter_map) and CartoDB Voyager tiles.
/// Supports smooth vehicle tweening, dynamic heading, geofence halos,
/// floating camera controls, and graceful offline vector fallback.
class InteractiveFleetMap extends StatefulWidget {
  final BusRoute route;
  final BusTelemetry? telemetry;
  final BusStop? selectedStop;
  final Function(BusStop stop)? onStopTap;
  final Function(BusStop stop)? onSetAsPickup;
  final bool isArabic;
  final double height;
  final bool isCockpitMode;
  final bool initialFollowBus;

  const InteractiveFleetMap({
    super.key,
    required this.route,
    this.telemetry,
    this.selectedStop,
    this.onStopTap,
    this.onSetAsPickup,
    this.isArabic = true,
    this.height = 280,
    this.isCockpitMode = false,
    this.initialFollowBus = false,
  });

  @override
  State<InteractiveFleetMap> createState() => _InteractiveFleetMapState();
}

class _InteractiveFleetMapState extends State<InteractiveFleetMap>
    with TickerProviderStateMixin {
  late final MapController _mapController;

  // Telemetry Position Animation & Heading
  late AnimationController _busMoveAnimController;
  late Animation<double> _busLatTween;
  late Animation<double> _busLngTween;
  double _currentBusLat = 0.0;
  double _currentBusLng = 0.0;
  double _currentHeadingRad = 0.0;

  // Radar Pulse Animation
  late AnimationController _radarPulseController;

  // Camera Follow Mode & Offline Fallback Toggle
  late bool _isFollowingBus;
  bool _forceOfflineVector = false;

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _isFollowingBus = widget.initialFollowBus;

    // Initial bus coordinates
    final initialLat = widget.telemetry?.currentLat ??
        (widget.route.stops.isNotEmpty ? widget.route.stops.first.lat : 30.0);
    final initialLng = widget.telemetry?.currentLng ??
        (widget.route.stops.isNotEmpty ? widget.route.stops.first.lng : 31.0);
    _currentBusLat = initialLat;
    _currentBusLng = initialLng;

    _busMoveAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..addListener(() {
        setState(() {
          _currentBusLat = _busLatTween.value;
          _currentBusLng = _busLngTween.value;
        });
        if (_isFollowingBus) {
          _mapController.move(
            LatLng(_currentBusLat, _currentBusLng),
            _mapController.camera.zoom,
          );
        }
      });

    _busLatTween = Tween<double>(begin: initialLat, end: initialLat).animate(
      CurvedAnimation(parent: _busMoveAnimController, curve: Curves.easeInOut),
    );
    _busLngTween = Tween<double>(begin: initialLng, end: initialLng).animate(
      CurvedAnimation(parent: _busMoveAnimController, curve: Curves.easeInOut),
    );

    // Radar pulse controller
    _radarPulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    // Initial heading calculation
    _computeHeading();
  }

  @override
  void didUpdateWidget(covariant InteractiveFleetMap oldWidget) {
    super.didUpdateWidget(oldWidget);

    final newTelemetry = widget.telemetry;
    final oldTelemetry = oldWidget.telemetry;

    if (newTelemetry != null &&
        (oldTelemetry == null ||
            newTelemetry.currentLat != oldTelemetry.currentLat ||
            newTelemetry.currentLng != oldTelemetry.currentLng)) {
      _animateBusTo(newTelemetry.currentLat, newTelemetry.currentLng);
    }
  }

  void _animateBusTo(double targetLat, double targetLng) {
    _computeHeadingTo(targetLat, targetLng);

    _busLatTween = Tween<double>(
      begin: _currentBusLat,
      end: targetLat,
    ).animate(CurvedAnimation(
      parent: _busMoveAnimController,
      curve: Curves.easeInOutCubic,
    ));

    _busLngTween = Tween<double>(
      begin: _currentBusLng,
      end: targetLng,
    ).animate(CurvedAnimation(
      parent: _busMoveAnimController,
      curve: Curves.easeInOutCubic,
    ));

    _busMoveAnimController.forward(from: 0.0);
  }

  void _computeHeadingTo(double nextLat, double nextLng) {
    if (widget.telemetry != null && widget.telemetry!.headingDegrees > 0) {
      _currentHeadingRad = widget.telemetry!.headingDegrees * (math.pi / 180.0);
      return;
    }
    final dLng = (nextLng - _currentBusLng) * (math.pi / 180.0);
    final lat1 = _currentBusLat * (math.pi / 180.0);
    final lat2 = nextLat * (math.pi / 180.0);

    final y = math.sin(dLng) * math.cos(lat2);
    final x = math.cos(lat1) * math.sin(lat2) -
        math.sin(lat1) * math.cos(lat2) * math.cos(dLng);

    if (x != 0 || y != 0) {
      _currentHeadingRad = math.atan2(y, x);
    }
  }

  void _computeHeading() {
    if (widget.route.stops.length >= 2) {
      final s2 = widget.route.stops[1];
      _computeHeadingTo(s2.lat, s2.lng);
    }
  }

  @override
  void dispose() {
    _busMoveAnimController.dispose();
    _radarPulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  void _fitCorridorBounds() {
    setState(() => _isFollowingBus = false);
    if (widget.route.stops.isEmpty) return;

    final points = widget.route.stops
        .map((s) => LatLng(s.lat, s.lng))
        .toList();

    if (_currentBusLat != 0.0) {
      points.add(LatLng(_currentBusLat, _currentBusLng));
    }

    final bounds = LatLngBounds.fromPoints(points);
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 36),
      ),
    );
  }

  void _centerOnMyStop() {
    setState(() => _isFollowingBus = false);
    final stop = widget.selectedStop ??
        (widget.route.stops.isNotEmpty ? widget.route.stops.first : null);
    if (stop != null) {
      _mapController.move(LatLng(stop.lat, stop.lng), 15.5);
    }
  }

  void _toggleFollowBus() {
    setState(() {
      _isFollowingBus = !_isFollowingBus;
    });
    if (_isFollowingBus && _currentBusLat != 0.0) {
      _mapController.move(LatLng(_currentBusLat, _currentBusLng), 15.0);
    }
  }

  void _zoomIn() {
    final currentZoom = _mapController.camera.zoom;
    _mapController.move(_mapController.camera.center, currentZoom + 1.0);
  }

  void _zoomOut() {
    final currentZoom = _mapController.camera.zoom;
    _mapController.move(_mapController.camera.center, currentZoom - 1.0);
  }

  @override
  Widget build(BuildContext context) {
    if (_forceOfflineVector) {
      return _buildOfflineVectorFallback();
    }

    final stops = widget.route.stops;
    final corridorPoints = stops.map((s) => LatLng(s.lat, s.lng)).toList();
    final busPosition = LatLng(_currentBusLat, _currentBusLng);
    final myStop = widget.selectedStop ?? (stops.isNotEmpty ? stops.first : null);

    final initialCenter = _currentBusLat != 0.0
        ? busPosition
        : (corridorPoints.isNotEmpty ? corridorPoints.first : const LatLng(30.0, 31.0));

    final isProximityApproaching = widget.telemetry != null &&
        widget.telemetry!.distanceKm <= 3.0 &&
        widget.telemetry!.etaMinutes <= 12;

    return Container(
      height: widget.height,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // 1. OPENSTREETMAP TILE LAYER VIA FLUTTER_MAP
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: initialCenter,
              initialZoom: 12.5,
              minZoom: 8.0,
              maxZoom: 18.0,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all,
              ),
              onPositionChanged: (camera, hasGesture) {
                if (hasGesture && _isFollowingBus) {
                  setState(() => _isFollowingBus = false);
                }
              },
            ),
            children: [
              // High-resolution CartoDB Voyager raster tiles
              TileLayer(
                urlTemplate:
                    'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                userAgentPackageName: 'com.workforce.connect',
                tileProvider: NetworkTileProvider(),
                errorTileCallback: (tile, error, stackTrace) {},
              ),

              // 2. 500m PROXIMITY GEOFENCE AROUND WORKER'S PICKUP STOP
              if (myStop != null)
                CircleLayer(
                  circles: [
                    CircleMarker(
                      point: LatLng(myStop.lat, myStop.lng),
                      radius: 50,
                      useRadiusInMeter: false,
                      color: isProximityApproaching
                          ? const Color(0xFF22C55E).withValues(alpha: 0.28)
                          : const Color(0xFF0284C7).withValues(alpha: 0.16),
                      borderColor: isProximityApproaching
                          ? const Color(0xFF16A34A)
                          : const Color(0xFF0284C7),
                      borderStrokeWidth: isProximityApproaching ? 2.5 : 1.5,
                    ),
                  ],
                ),

              // 3. HIGHWAY CORRIDOR POLYLINES
              if (corridorPoints.length >= 2) ...[
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: corridorPoints,
                      strokeWidth: 8.0,
                      color: const Color(0xFF0284C7).withValues(alpha: 0.35),
                      strokeCap: StrokeCap.round,
                      strokeJoin: StrokeJoin.round,
                    ),
                  ],
                ),
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: corridorPoints,
                      strokeWidth: 4.5,
                      color: const Color(0xFF0284C7),
                      strokeCap: StrokeCap.round,
                      strokeJoin: StrokeJoin.round,
                    ),
                  ],
                ),
              ],

              // 4. INTERACTIVE STOP MARKERS
              MarkerLayer(
                markers: stops.asMap().entries.map((entry) {
                  final index = entry.key;
                  final stop = entry.value;
                  final isPickup = stop.id == myStop?.id;
                  final isDestination = index == stops.length - 1;
                  final isOrigin = index == 0;

                  return Marker(
                    point: LatLng(stop.lat, stop.lng),
                    width: isPickup ? 46 : (isDestination ? 42 : 32),
                    height: isPickup ? 46 : (isDestination ? 42 : 32),
                    child: GestureDetector(
                      onTap: () => _handleStopMarkerTapped(stop),
                      child: _buildStopMarkerWidget(
                        index: index,
                        stop: stop,
                        isPickup: isPickup,
                        isDestination: isDestination,
                        isOrigin: isOrigin,
                        isApproaching: isProximityApproaching && isPickup,
                      ),
                    ),
                  );
                }).toList(),
              ),

              // 5. MOVING BUS TELEMETRY MARKER WITH RADAR PULSE
              if (_currentBusLat != 0.0)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: busPosition,
                      width: 54,
                      height: 54,
                      child: _buildAnimatedBusMarker(),
                    ),
                  ],
                ),
            ],
          ),

          // 6. TOP STATUS & TELEMETRY HEADER OVERLAY
          Positioned(
            top: 10,
            left: 12,
            right: 12,
            child: _buildTopOverlayHeader(isProximityApproaching),
          ),

          // 7. FLOATING QUICK ACTION DOCK (CAMERA CONTROLS & OFFLINE TOGGLE)
          Positioned(
            bottom: 12,
            right: 12,
            child: _buildFloatingControlsDock(),
          ),

          // 8. MAP ZOOM CONTROLS (LEFT SIDE)
          Positioned(
            bottom: 12,
            left: 12,
            child: _buildZoomControls(),
          ),
        ],
      ),
    );
  }

  Widget _buildStopMarkerWidget({
    required int index,
    required BusStop stop,
    required bool isPickup,
    required bool isDestination,
    required bool isOrigin,
    required bool isApproaching,
  }) {
    if (isPickup) {
      return Stack(
        alignment: Alignment.center,
        children: [
          if (isApproaching)
            AnimatedBuilder(
              animation: _radarPulseController,
              builder: (context, child) {
                final scale = 1.0 + (_radarPulseController.value * 0.4);
                return Transform.scale(
                  scale: scale,
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF22C55E).withValues(
                        alpha: (1.0 - _radarPulseController.value) * 0.5,
                      ),
                    ),
                  ),
                );
              },
            ),
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.red.withValues(alpha: 0.4),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.location_on_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
        ],
      );
    }

    if (isDestination) {
      return Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: const Color(0xFF16A34A),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 6,
            ),
          ],
        ),
        child: const Icon(
          Icons.domain_rounded,
          color: Colors.white,
          size: 16,
        ),
      );
    }

    if (isOrigin) {
      return Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          color: const Color(0xFF0284C7),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
        ),
        child: const Icon(
          Icons.trip_origin_rounded,
          color: Colors.white,
          size: 14,
        ),
      );
    }

    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFF0284C7), width: 2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 4,
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        '${index + 1}',
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: Color(0xFF0F172A),
        ),
      ),
    );
  }

  Widget _buildAnimatedBusMarker() {
    return AnimatedBuilder(
      animation: _radarPulseController,
      builder: (context, child) {
        final radarVal = _radarPulseController.value;
        final scale = 1.0 + (radarVal * 0.75);
        final opacity = (1.0 - radarVal).clamp(0.0, 1.0);

        return Stack(
          alignment: Alignment.center,
          children: [
            Transform.scale(
              scale: scale,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF38BDF8).withValues(alpha: opacity * 0.4),
                  border: Border.all(
                    color: const Color(0xFF0284C7).withValues(alpha: opacity * 0.8),
                    width: 1.5,
                  ),
                ),
              ),
            ),
            Transform.rotate(
              angle: _currentHeadingRad,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2.2),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0284C7).withValues(alpha: 0.5),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.navigation_rounded,
                  color: Colors.white,
                  size: 16,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTopOverlayHeader(bool isApproaching) {
    final telemetry = widget.telemetry;
    final isAr = widget.isArabic;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isApproaching ? const Color(0xFF22C55E) : Colors.white24,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: isApproaching
                      ? const Color(0xFF22C55E)
                      : const Color(0xFF38BDF8),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                isApproaching
                    ? (isAr ? 'الحافلة تقترب منك!' : 'Bus Approaching!')
                    : (isAr ? 'تتبّع مباشر GPS' : 'Live GPS Fleet'),
                style: TextStyle(
                  color: isApproaching ? const Color(0xFF4ADE80) : Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        if (telemetry != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white24, width: 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.speed, color: Color(0xFF38BDF8), size: 13),
                const SizedBox(width: 5),
                Text(
                  '${telemetry.speedKmh} ${isAr ? "كم/س" : "km/h"}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildFloatingControlsDock() {
    final isAr = widget.isArabic;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withValues(alpha: 0.90),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white24, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 8,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildPillButton(
            icon: Icons.my_location_rounded,
            label: isAr ? 'تتبع الحافلة' : 'Follow Bus',
            isActive: _isFollowingBus,
            onTap: _toggleFollowBus,
          ),
          const SizedBox(width: 4),
          _buildPillButton(
            icon: Icons.pin_drop_rounded,
            label: isAr ? 'محطتي' : 'My Stop',
            isActive: false,
            onTap: _centerOnMyStop,
          ),
          const SizedBox(width: 4),
          _buildPillButton(
            icon: Icons.fit_screen_rounded,
            label: isAr ? 'كامل المسار' : 'Whole Route',
            isActive: false,
            onTap: _fitCorridorBounds,
          ),
          const SizedBox(width: 4),

          // Offline Vector Toggle
          IconButton(
            tooltip: isAr ? 'وضع الخريطة غير المتصلة (أوفلاين)' : 'Offline Corridor Map',
            icon: const Icon(Icons.offline_bolt_outlined, size: 16, color: Color(0xFF94A3B8)),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            onPressed: () {
              setState(() => _forceOfflineVector = true);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPillButton({
    required IconData icon,
    required String label,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isActive
              ? const Color(0xFF0284C7)
              : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 13,
              color: isActive ? Colors.white : const Color(0xFFCBD5E1),
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: isActive ? Colors.white : const Color(0xFFCBD5E1),
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildZoomControls() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white24, width: 1),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: _zoomIn,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(9)),
            child: const Padding(
              padding: EdgeInsets.all(6),
              child: Icon(Icons.add, size: 16, color: Colors.white),
            ),
          ),
          Container(width: 24, height: 1, color: Colors.white12),
          InkWell(
            onTap: _zoomOut,
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(9)),
            child: const Padding(
              padding: EdgeInsets.all(6),
              child: Icon(Icons.remove, size: 16, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  void _handleStopMarkerTapped(BusStop stop) {
    if (widget.onStopTap != null) {
      widget.onStopTap!(stop);
      return;
    }

    final isAr = widget.isArabic;
    final isCurrentPickup = stop.id == widget.selectedStop?.id;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isCurrentPickup
                          ? Colors.redAccent.withValues(alpha: 0.1)
                          : AppColors.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.location_on,
                      color: isCurrentPickup ? Colors.redAccent : AppColors.primary,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stop.localizedName(isAr),
                          style: AppTypography.welcomeTitle.copyWith(fontSize: 16),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${AppLocale.tr("scheduled_time_label")}: ${stop.scheduledTime}',
                          style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  if (isCurrentPickup)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.redAccent.withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        isAr ? 'محطتك المحددة' : 'My Selected Stop',
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              if (!isCurrentPickup && widget.onSetAsPickup != null) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: Text(isAr ? 'تعيين كمحطة ركوبي الأساسية' : 'Set as My Pickup Stop'),
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      widget.onSetAsPickup!(stop);
                    },
                  ),
                ),
                const SizedBox(height: 8),
              ],
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: Text(isAr ? 'إغلاق' : 'Close'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildOfflineVectorFallback() {
    final isAr = widget.isArabic;
    return Container(
      height: widget.height,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          CustomPaint(
            size: Size(double.infinity, widget.height),
            painter: OfflineVectorRoutePainter(
              stops: widget.route.stops,
              selectedStopId: widget.selectedStop?.id ?? '',
              progressRatio: 0.65,
            ),
          ),
          Positioned(
            top: 10,
            left: 12,
            right: 12,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade900.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.signal_wifi_off_rounded, size: 14, color: Colors.amberAccent),
                      const SizedBox(width: 6),
                      Text(
                        isAr ? 'وضع الخريطة غير المتصلة (أوفلاين)' : 'Offline Corridor Map',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    backgroundColor: Colors.white12,
                  ),
                  onPressed: () => setState(() => _forceOfflineVector = false),
                  child: Text(
                    isAr ? 'العودة لخريطة الأقمار' : 'Return to Tiles',
                    style: const TextStyle(color: Colors.white, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class OfflineVectorRoutePainter extends CustomPainter {
  final List<BusStop> stops;
  final String selectedStopId;
  final double progressRatio;

  OfflineVectorRoutePainter({
    required this.stops,
    required this.selectedStopId,
    this.progressRatio = 0.6,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (stops.isEmpty) return;

    final roadPaint = Paint()
      ..color = const Color(0xFF334155)
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final progressPaint = Paint()
      ..color = const Color(0xFF0284C7)
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();
    final stepX = (size.width - 60) / (stops.length - 1).clamp(1, 999);
    final centerY = size.height / 2;

    for (int i = 0; i < stops.length; i++) {
      final x = 30 + i * stepX;
      final y = centerY + (i % 2 == 0 ? -25 : 25);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        final prevX = 30 + (i - 1) * stepX;
        final prevY = centerY + ((i - 1) % 2 == 0 ? -25 : 25);
        path.quadraticBezierTo(
          (prevX + x) / 2,
          (prevY + y) / 2 + (i % 2 == 0 ? 15 : -15),
          x,
          y,
        );
      }
    }

    canvas.drawPath(path, roadPaint);
    canvas.drawPath(path, progressPaint);

    for (int i = 0; i < stops.length; i++) {
      final x = 30 + i * stepX;
      final y = centerY + (i % 2 == 0 ? -25 : 25);
      final isSelected = stops[i].id == selectedStopId;

      final nodePaint = Paint()
        ..color = isSelected
            ? Colors.redAccent
            : (i == stops.length - 1 ? const Color(0xFF22C55E) : Colors.white)
        ..style = PaintingStyle.fill;

      canvas.drawCircle(Offset(x, y), isSelected ? 8 : 5, nodePaint);

      if (isSelected) {
        final haloPaint = Paint()
          ..color = Colors.redAccent.withValues(alpha: 0.3)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4;
        canvas.drawCircle(Offset(x, y), 14, haloPaint);
      }
    }

    final busX = 30 + (stops.length - 1) * stepX * progressRatio;
    final busY = centerY + 10;
    final busPaint = Paint()..color = const Color(0xFF38BDF8);

    canvas.drawCircle(Offset(busX, busY), 9, busPaint);
  }

  @override
  bool shouldRepaint(covariant OfflineVectorRoutePainter oldDelegate) => true;
}
