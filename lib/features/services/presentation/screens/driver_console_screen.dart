import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import 'package:elaraby_workforce/features/services/data/transport_model.dart';
import '../controllers/transport_controller.dart';
import '../widgets/interactive_fleet_map.dart';

class DriverConsoleScreen extends ConsumerStatefulWidget {
  final String routeId;

  const DriverConsoleScreen({
    super.key,
    this.routeId = 'route_101',
  });

  @override
  ConsumerState<DriverConsoleScreen> createState() => _DriverConsoleScreenState();
}

class _DriverConsoleScreenState extends ConsumerState<DriverConsoleScreen> {
  static const Color _bgDark = Color(0xFF090D16);
  static const Color _cardDark = Color(0xFF131A27);
  static const Color _cardElevated = Color(0xFF1B2436);
  static const Color _borderDark = Color(0xFF26334D);
  static const Color _accentCyan = Color(0xFF38BDF8);
  static const Color _statusGreen = Color(0xFF22C55E);
  static const Color _statusAmber = Color(0xFFF59E0B);
  static const Color _statusRed = Color(0xFFEF4444);
  static const Color _textWhite = Color(0xFFF8FAFC);
  static const Color _textMuted = Color(0xFF94A3B8);

  bool _isProcessing = false;
  bool _showMapOnPhone = false;

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    final manifestState = ref.watch(driverConsoleProvider(widget.routeId));

    return Scaffold(
      backgroundColor: _bgDark,
      body: SafeArea(
        child: manifestState.when(
          loading: (_) => const Center(
            child: CircularProgressIndicator(color: _accentCyan),
          ),
          empty: () => Center(
            child: Text(
              isAr ? 'لا توجد بيانات' : 'No manifest data',
              style: const TextStyle(color: _textWhite),
            ),
          ),
          error: (err, _, __) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, color: _statusRed, size: 48),
                const SizedBox(height: 12),
                Text(
                  err,
                  style: const TextStyle(color: _textWhite),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: _accentCyan),
                  onPressed: () => ref
                      .read(driverConsoleProvider(widget.routeId).notifier)
                      .loadManifest(),
                  child: const Text('إعادة المحاولة / Retry',
                      style: TextStyle(color: Colors.black)),
                ),
              ],
            ),
          ),
          success: (manifest) => _buildCockpitContent(context, manifest, isAr),
          refreshing: (manifest) => _buildCockpitContent(context, manifest, isAr),
        ),
      ),
    );
  }

  Widget _buildCockpitContent(
      BuildContext context, RouteManifestData manifest, bool isAr) {
    final route = manifest.route;
    final counts = manifest.headcounts;

    return LayoutBuilder(
      builder: (context, constraints) {
        final isTablet = constraints.maxWidth >= 768;

        return Column(
          children: [
            _buildTopHeader(context, route, isAr),
            _buildHeadcountHUD(counts, isAr),
            _buildHighwayControlBar(context, isAr, showMapToggle: !isTablet),
            const Divider(color: _borderDark, height: 1),
            if (!isTablet && _showMapOnPhone && route != null) ...[
              Padding(
                padding: const EdgeInsets.all(10),
                child: InteractiveFleetMap(
                  route: route,
                  isArabic: isAr,
                  height: 220,
                  isCockpitMode: true,
                  initialFollowBus: true,
                ),
              ),
              const Divider(color: _borderDark, height: 1),
            ],
            Expanded(
              child: isTablet && route != null
                  ? Row(
                      children: [
                        Expanded(
                          flex: 5,
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: InteractiveFleetMap(
                                route: route,
                                isArabic: isAr,
                                height: double.infinity,
                                isCockpitMode: true,
                                initialFollowBus: true,
                              ),
                            ),
                          ),
                        ),
                        const VerticalDivider(color: _borderDark, width: 1),
                        Expanded(
                          flex: 6,
                          child: _buildStopsManifest(context, manifest.stops, isAr),
                        ),
                      ],
                    )
                  : _buildStopsManifest(context, manifest.stops, isAr),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTopHeader(BuildContext context, BusRoute? route, bool isAr) {
    final routeName = isAr
        ? (route?.nameAr ?? 'خط الهرم - الرماية - الدائري')
        : (route?.nameEn ?? 'Haram - Remaya Line');
    final plate = route?.vehiclePlate ?? 'ط س ج ٥٨١٢';
    final driverName = route?.driver.name ?? 'محمود عبد الفتاح شلبي';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: _cardDark,
        border: Border(bottom: BorderSide(color: _borderDark, width: 1)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios, color: _textWhite, size: 20),
            tooltip: isAr ? 'العودة للتطبيق' : 'Back to App',
            onPressed: () => Navigator.of(context).pop(),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _accentCyan.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _accentCyan.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.directions_bus, color: _accentCyan, size: 16),
                const SizedBox(width: 6),
                Text(
                  route?.code ?? 'BUS-101',
                  style: const TextStyle(
                    color: _accentCyan,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  routeName,
                  style: const TextStyle(
                    color: _textWhite,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '$plate • $driverName',
                  style: const TextStyle(
                    color: _textMuted,
                    fontSize: 12,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _statusGreen.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: _statusGreen.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: _statusGreen,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  isAr ? 'مباشر' : 'LIVE',
                  style: const TextStyle(
                    color: _statusGreen,
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeadcountHUD(ManifestHeadcounts counts, bool isAr) {
    return Container(
      padding: const EdgeInsets.all(12),
      color: _cardElevated,
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildHUDTile(
                  title: isAr ? 'المقاعد المخصصة' : 'Assigned',
                  count: '${counts.totalAssigned}',
                  icon: Icons.airline_seat_recline_normal,
                  color: _accentCyan,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildHUDTile(
                  title: isAr ? 'صعدوا الحافلة' : 'Boarded',
                  count: '${counts.boarded}',
                  icon: Icons.check_circle_outline,
                  color: _statusGreen,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildHUDTile(
                  title: isAr ? 'في الانتظار' : 'Waiting',
                  count: '${counts.waiting}',
                  icon: Icons.access_time,
                  color: _statusAmber,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildHUDTile(
                  title: isAr ? 'معتذر اليوم' : 'Opted Out',
                  count: '${counts.optedOut}',
                  icon: Icons.do_not_disturb_on_outlined,
                  color: _textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (counts.occupancyRate / 100).clamp(0.0, 1.0),
                    backgroundColor: _borderDark,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      counts.allAccountedFor ? _statusGreen : _accentCyan,
                    ),
                    minHeight: 8,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${counts.occupancyRate}% ${isAr ? "إشغال" : "Occupied"}',
                style: TextStyle(
                  color: counts.allAccountedFor ? _statusGreen : _textWhite,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              if (counts.allAccountedFor) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: _statusGreen.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    isAr ? 'تم الحصر بالكامل ✓' : 'All Accounted ✓',
                    style: const TextStyle(
                      color: _statusGreen,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHUDTile({
    required String title,
    required String count,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      decoration: BoxDecoration(
        color: _cardDark,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _borderDark),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 14),
              const SizedBox(width: 4),
              Text(
                count,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: const TextStyle(
              color: _textMuted,
              fontSize: 10,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildHighwayControlBar(BuildContext context, bool isAr, {bool showMapToggle = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      color: _cardDark,
      child: Row(
        children: [
          Expanded(
            child: _buildHighwayButton(
              label: isAr ? 'زحام +١٥ د' : 'Traffic +15m',
              icon: Icons.traffic,
              color: _statusAmber,
              onPressed: () => _handleDelayReport(15, 'traffic_delay', isAr),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildHighwayButton(
              label: isAr ? 'عطل +٣٥ د' : 'Breakdown +35m',
              icon: Icons.warning_amber_rounded,
              color: _statusRed,
              onPressed: () => _handleDelayReport(35, 'breakdown', isAr),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildHighwayButton(
              label: isAr ? 'مسح QR' : 'Scan QR',
              icon: Icons.qr_code_scanner,
              color: _accentCyan,
              onPressed: () => _showQrScannerModal(context, isAr),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildHighwayButton(
              label: isAr ? 'وصلنا المجمع' : 'Arrived Gate',
              icon: Icons.flag_circle,
              color: _statusGreen,
              onPressed: () => _handleCompleteRun(isAr),
            ),
          ),
          if (showMapToggle) ...[
            const SizedBox(width: 8),
            IconButton(
              tooltip: _showMapOnPhone
                  ? (isAr ? 'إخفاء الخريطة' : 'Hide Map')
                  : (isAr ? 'عرض الخريطة' : 'Show Map'),
              icon: Icon(
                _showMapOnPhone ? Icons.map : Icons.map_outlined,
                color: _showMapOnPhone ? _accentCyan : _textMuted,
                size: 20,
              ),
              style: IconButton.styleFrom(
                backgroundColor: _showMapOnPhone
                    ? _accentCyan.withValues(alpha: 0.15)
                    : Colors.transparent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: _showMapOnPhone ? _accentCyan : _borderDark,
                  ),
                ),
              ),
              onPressed: () {
                setState(() => _showMapOnPhone = !_showMapOnPhone);
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHighwayButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      height: 44,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: color.withValues(alpha: 0.6), width: 1.2),
          backgroundColor: color.withValues(alpha: 0.12),
          foregroundColor: color,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        onPressed: _isProcessing ? null : onPressed,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStopsManifest(
      BuildContext context, List<ManifestStop> stops, bool isAr) {
    if (stops.isEmpty) {
      return Center(
        child: Text(
          isAr ? 'لا توجد محطات مسجلة لهذا الخط' : 'No stops found for this line',
          style: const TextStyle(color: _textMuted),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: stops.length,
      itemBuilder: (context, idx) {
        final stop = stops[idx];
        return _buildStopCard(context, stop, isAr);
      },
    );
  }

  Widget _buildStopCard(BuildContext context, ManifestStop stop, bool isAr) {
    final isNext = stop.isNext;
    final isPassed = stop.isPassed;

    Color borderColor = _borderDark;
    if (isNext) borderColor = _accentCyan;
    if (isPassed) borderColor = _statusGreen.withValues(alpha: 0.4);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _cardDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor, width: isNext ? 2 : 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Stop Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: isNext
                  ? _accentCyan.withValues(alpha: 0.1)
                  : (isPassed
                      ? _statusGreen.withValues(alpha: 0.05)
                      : _cardElevated),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(9)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 12,
                  backgroundColor: isNext
                      ? _accentCyan
                      : (isPassed ? _statusGreen : _borderDark),
                  child: Text(
                    '${stop.order}',
                    style: TextStyle(
                      color: isNext || isPassed ? Colors.black : _textWhite,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        stop.localizedName(isAr),
                        style: TextStyle(
                          color: _textWhite,
                          fontWeight:
                              isNext ? FontWeight.bold : FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${stop.scheduledTime} • ${stop.boardedCount} ${isAr ? "صعدوا" : "boarded"} • ${stop.waitingCount} ${isAr ? "بالانتظار" : "waiting"}',
                        style: const TextStyle(color: _textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                if (isPassed)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusGreen.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      AppLocale.tr('departed_badge'),
                      style: const TextStyle(
                        color: _statusGreen,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  )
                else if (isNext)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _accentCyan.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      AppLocale.tr('current_stop_badge'),
                      style: const TextStyle(
                        color: _accentCyan,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Depart Stop Advance Action (Shown for the active stop)
          if (isNext)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _accentCyan,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.arrow_forward, size: 18),
                  label: Text(
                    AppLocale.tr('stop_departure_action'),
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  onPressed: _isProcessing
                      ? null
                      : () => _handleDepartStop(stop.id, isAr),
                ),
              ),
            ),

          // Passenger rows
          if (stop.passengers.isEmpty)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                isAr
                    ? 'لا يوجد ركاب مخصصين لهذه المحطة'
                    : 'No passengers assigned to this stop',
                style: const TextStyle(
                    color: _textMuted, fontSize: 12, fontStyle: FontStyle.italic),
              ),
            )
          else
            ...stop.passengers.map((p) => _buildPassengerRow(context, p, isAr)),
        ],
      ),
    );
  }

  Widget _buildPassengerRow(
      BuildContext context, ManifestPassenger p, bool isAr) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: _borderDark, width: 0.5)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              color: _cardElevated,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: _borderDark),
            ),
            child: Text(
              p.seatNumber.isNotEmpty ? p.seatNumber : 'A-01',
              style: const TextStyle(
                color: _accentCyan,
                fontWeight: FontWeight.bold,
                fontSize: 11,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.localizedName(isAr),
                  style: const TextStyle(
                    color: _textWhite,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                Text(
                  p.department,
                  style: const TextStyle(color: _textMuted, fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          _buildPassengerStatusAction(p, isAr),
        ],
      ),
    );
  }

  Widget _buildPassengerStatusAction(ManifestPassenger p, bool isAr) {
    if (p.isBoarded) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: _statusGreen.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: _statusGreen.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check, color: _statusGreen, size: 14),
            const SizedBox(width: 4),
            Text(
              p.boardedAt ?? AppLocale.tr('manifest_boarded_count'),
              style: const TextStyle(
                color: _statusGreen,
                fontWeight: FontWeight.bold,
                fontSize: 11,
              ),
            ),
          ],
        ),
      );
    }

    if (p.isOptedOut) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              AppLocale.tr('manifest_opted_out_count'),
              style: const TextStyle(color: _textMuted, fontSize: 11),
            ),
            if (p.optOutReason != null)
              Text(
                p.optOutReason!,
                style: TextStyle(
                    color: _textMuted.withValues(alpha: 0.7), fontSize: 9),
              ),
          ],
        ),
      );
    }

    // Waiting -> Manual 1-Tap Check-In button
    return SizedBox(
      height: 38,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: _accentCyan.withValues(alpha: 0.15),
          foregroundColor: _accentCyan,
          side: const BorderSide(color: _accentCyan, width: 1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          padding: const EdgeInsets.symmetric(horizontal: 8),
        ),
        icon: const Icon(Icons.touch_app, size: 16),
        label: Text(
          AppLocale.tr('manual_check_in_btn'),
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
        ),
        onPressed: _isProcessing ? null : () => _handleManualBoard(p.id, isAr),
      ),
    );
  }

  Future<void> _handleManualBoard(String employeeId, bool isAr) async {
    setState(() => _isProcessing = true);
    final ok = await ref
        .read(driverConsoleProvider(widget.routeId).notifier)
        .manualBoardPassenger(employeeId: employeeId);
    setState(() => _isProcessing = false);

    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: _statusGreen,
          content: Text(
            AppLocale.tr('passenger_boarded_success'),
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _handleDepartStop(String stopId, bool isAr) async {
    setState(() => _isProcessing = true);
    final ok = await ref
        .read(driverConsoleProvider(widget.routeId).notifier)
        .advanceStopDeparture(stopId: stopId);
    setState(() => _isProcessing = false);

    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: _accentCyan,
          content: Text(
            isAr
                ? 'تم تسجيل مغادرة المحطة وتقدم مسار الرحلة'
                : 'Stop departure recorded, route advanced',
            style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _handleDelayReport(
      int delayMinutes, String type, bool isAr) async {
    setState(() => _isProcessing = true);
    final ok = await ref
        .read(driverConsoleProvider(widget.routeId).notifier)
        .reportHighwayDelay(
          delayMinutes: delayMinutes,
          type: type,
          message: type == 'breakdown'
              ? (isAr ? 'عطل ميكانيكي طارئ' : 'Emergency breakdown')
              : (isAr ? 'تكدس مروري حاد' : 'Heavy traffic delay'),
        );
    setState(() => _isProcessing = false);

    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: type == 'breakdown' ? _statusRed : _statusAmber,
          content: Text(
            AppLocale.tr('delay_excuse_issued'),
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  Future<void> _handleCompleteRun(bool isAr) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _cardElevated,
        title: Text(
          isAr ? 'تأكيد الوصول للمجمع' : 'Confirm Factory Arrival',
          style: const TextStyle(color: _textWhite),
        ),
        content: Text(
          isAr
              ? 'هل وصلت الحافلة بالفعل إلى بوابة مجمع العربي الصناعي؟ سيتم اعتماد حضور ركاب الحافلة وإنهاء خط السير.'
              : 'Has the bus arrived at the factory complex? This will finalize the commute and verify arrival for all onboard.',
          style: const TextStyle(color: _textMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(isAr ? 'إلغاء' : 'Cancel',
                style: const TextStyle(color: _textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: _statusGreen),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              isAr ? 'تأكيد الوصول' : 'Confirm Arrival',
              style: const TextStyle(
                  color: Colors.black, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      setState(() => _isProcessing = true);
      await ref
          .read(driverConsoleProvider(widget.routeId).notifier)
          .completeRouteRun();
      setState(() => _isProcessing = false);

      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: _cardElevated,
            icon: const Icon(Icons.check_circle, color: _statusGreen, size: 48),
            title: Text(
              AppLocale.tr('run_completed_dialog_title'),
              style: const TextStyle(color: _textWhite),
            ),
            content: Text(
              AppLocale.tr('run_completed_dialog_desc'),
              style: const TextStyle(color: _textMuted),
              textAlign: TextAlign.center,
            ),
            actions: [
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: _accentCyan),
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                child: Text(isAr ? 'تم' : 'Done',
                    style: const TextStyle(color: Colors.black)),
              ),
            ],
          ),
        );
      }
    }
  }

  void _showQrScannerModal(BuildContext context, bool isAr) {
    showModalBottomSheet(
      context: context,
      backgroundColor: _cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                AppLocale.tr('qr_scanner_title'),
                style: const TextStyle(
                  color: _textWhite,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _accentCyan, width: 2),
                ),
                child: const Center(
                  child: Icon(Icons.qr_code_scanner,
                      color: _accentCyan, size: 64),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                isAr
                    ? 'وجّه كاميرا الجهاز اللوحي نحو الباركود في هاتف الراكب'
                    : 'Point the tablet camera towards the employee digital pass',
                style: const TextStyle(color: _textMuted, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _statusGreen,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.camera_alt, size: 20),
                  label: Text(
                    AppLocale.tr('qr_simulated_scan'),
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  onPressed: () async {
                    Navigator.of(ctx).pop();
                    // Pick the first waiting passenger to board
                    final manifest = ref
                        .read(driverConsoleProvider(widget.routeId))
                        .data;
                    String? targetEmpId;
                    if (manifest != null) {
                      for (final stop in manifest.stops) {
                        for (final p in stop.passengers) {
                          if (p.isWaiting) {
                            targetEmpId = p.id;
                            break;
                          }
                        }
                        if (targetEmpId != null) break;
                      }
                    }
                    if (targetEmpId != null) {
                      await _handleManualBoard(targetEmpId, isAr);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: _statusGreen,
                          content: Text(
                            isAr
                                ? 'تم مسح الباركود بنجاح - جميع الركاب صعدوا بالفعل'
                                : 'QR Scanned - All passengers already accounted for',
                          ),
                        ),
                      );
                    }
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
