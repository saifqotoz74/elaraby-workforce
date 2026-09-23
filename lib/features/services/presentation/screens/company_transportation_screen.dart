import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/transport_controller.dart';
import 'package:elaraby_workforce/features/services/data/transport_model.dart';
import '../../../../core/navigation/app_navigation.dart';
import '../../domain/transit_telemetry_simulator.dart';
import 'apply_route_transfer_sheet.dart';
import '../widgets/interactive_fleet_map.dart';

class CompanyTransportationScreen extends ConsumerStatefulWidget {
  const CompanyTransportationScreen({super.key});

  @override
  ConsumerState<CompanyTransportationScreen> createState() =>
      _CompanyTransportationScreenState();
}

class _CompanyTransportationScreenState
    extends ConsumerState<CompanyTransportationScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedFactoryFilter = 'all';
  final TextEditingController _searchCtrl = TextEditingController();

  TransitTelemetrySimulator? _simulator;
  StreamSubscription<SimulatedTransitUpdate>? _simSubscription;
  bool _isSimulating = false;
  SimulatedTransitUpdate? _lastSimUpdate;
  Timer? _countdownTicker;
  final ValueNotifier<int> _displaySecondsNotifier = ValueNotifier<int>(0);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _countdownTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_displaySecondsNotifier.value > 0) {
        _displaySecondsNotifier.value--;
      }
    });
  }

  @override
  void dispose() {
    _countdownTicker?.cancel();
    _displaySecondsNotifier.dispose();
    _simSubscription?.cancel();
    _simulator?.dispose();
    _tabController.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _toggleLiveSimulation(BusRoute route, BusStop selectedStop) {
    setState(() {
      _isSimulating = !_isSimulating;
    });

    if (_isSimulating) {
      _simulator?.dispose();
      _simulator = TransitTelemetrySimulator();
      _simSubscription = _simulator!.updateStream.listen((update) {
        if (!mounted) return;
        setState(() {
          _lastSimUpdate = update;
        });
        _displaySecondsNotifier.value = update.etaSecondsRemaining;
      });
      _simulator!.startSimulation(
        route: route,
        targetStopId: selectedStop.id,
      );
    } else {
      _simSubscription?.cancel();
      _simSubscription = null;
      _simulator?.stopSimulation();
      setState(() {
        _lastSimUpdate = null;
      });
    }
  }

  String _formatCountdown(int totalSeconds) {
    if (totalSeconds <= 0) return '00:00';
    final mins = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final secs = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$mins:$secs';
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Text(
          AppLocale.tr('company_transportation'),
          style: AppTypography.welcomeTitle.copyWith(fontSize: 18),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            tooltip: AppLocale.tr('driver_cockpit_mode'),
            icon: Icon(Icons.tablet_mac_rounded, color: AppColors.primary),
            onPressed: () => _promptDriverMode(context, isAr),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelStyle: AppTypography.labelBold.copyWith(fontSize: 12),
          unselectedLabelStyle: AppTypography.bodySmall.copyWith(fontSize: 12),
          tabs: [
            Tab(
              icon: const Icon(Icons.navigation_outlined, size: 18),
              text: isAr ? 'رحلتي وتتبّع الحافلة' : 'My Commute',
            ),
            Tab(
              icon: const Icon(Icons.alt_route, size: 18),
              text: isAr ? 'دليل الخطوط' : 'Routes',
            ),
            Tab(
              icon: const Icon(Icons.qr_code_2, size: 18),
              text: isAr ? 'بطاقة الصعود' : 'Boarding Pass',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMyCommuteTab(isAr),
          _buildRoutesDirectoryTab(isAr),
          _buildBoardingPassTab(isAr),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 1: MY COMMUTE & LIVE MAP
  // ==========================================
  Widget _buildMyCommuteTab(bool isAr) {
    final commuteState = ref.watch(myCommuteProvider);

    return commuteState.when(
      loading: (_) => Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
      error: (msg, code, prev) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text(msg, style: AppTypography.bodyMedium),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => ref.read(myCommuteProvider.notifier).loadCommute(),
              child: Text(isAr ? 'إعادة المحاولة' : 'Retry'),
            ),
          ],
        ),
      ),
      empty: () => Center(child: Text(isAr ? 'لا توجد بيانات رحلة حالية' : 'No commute data')),
      refreshing: (commute) => _buildCommuteContent(commute, isAr),
      success: (commute) => _buildCommuteContent(commute, isAr),
    );
  }

  Widget _buildCommuteContent(MyCommuteState commute, bool isAr) {
    final route = commute.route;
    final telemetry = commute.telemetry;

    if (route == null) {
      return Center(child: Text(isAr ? 'لم يتم تعيين خط حافلة بعد' : 'No bus route assigned'));
    }

    final selectedStop = route.stops.firstWhere(
      (s) => s.id == commute.assignment?.selectedStopId,
      orElse: () => route.stops.first,
    );

    final effectiveTelemetry = (_isSimulating && _lastSimUpdate != null)
        ? _lastSimUpdate!.telemetry
        : telemetry;

    if (_displaySecondsNotifier.value == 0 && effectiveTelemetry != null && !_isSimulating) {
      _displaySecondsNotifier.value = effectiveTelemetry.etaMinutes * 60;
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => ref.read(myCommuteProvider.notifier).loadCommute(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          // Smart Commute Suppression Banner (if on leave, rest day, or opted out)
          if (commute.suppression.isSuppressed) ...[
            _buildSuppressionBanner(commute.suppression, isAr),
            const SizedBox(height: 12),
          ],

          // Top Status Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.directions_bus, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              route.localizedName(isAr),
                              style: AppTypography.labelBold.copyWith(color: Colors.white, fontSize: 14),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (_isSimulating) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF22C55E).withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: const Color(0xFF22C55E), width: 0.8),
                              ),
                              child: Text(
                                isAr ? 'بث حي' : 'LIVE',
                                style: const TextStyle(
                                  color: Color(0xFF4ADE80),
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        effectiveTelemetry?.localizedStatus(isAr) ??
                            (isAr ? 'الحافلة تعمل في مسارها الطبيعي' : 'On route'),
                        style: AppTypography.bodySmall.copyWith(color: const Color(0xFF38BDF8)),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0284C7).withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.5)),
                  ),
                  child: Text(
                    route.code,
                    style: AppTypography.labelBold.copyWith(color: Colors.white, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ETA Countdown & Distance Card
          if (effectiveTelemetry != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _isSimulating
                      ? const Color(0xFF0284C7).withValues(alpha: 0.4)
                      : Colors.grey.shade200,
                  width: _isSimulating ? 1.5 : 1.0,
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              AppLocale.tr('eta_countdown'),
                              style: AppTypography.bodySmall,
                            ),
                            if (_isSimulating) ...[
                              const SizedBox(width: 6),
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF0284C7),
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            ValueListenableBuilder<int>(
                              valueListenable: _displaySecondsNotifier,
                              builder: (context, seconds, _) => Text(
                                _formatCountdown(seconds),
                                style: AppTypography.welcomeTitle.copyWith(
                                  fontSize: 26,
                                  color: effectiveTelemetry.isApproaching
                                      ? const Color(0xFFEAB308)
                                      : AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              isAr ? 'د:ث' : 'm:s',
                              style: AppTypography.labelBold.copyWith(
                                color: effectiveTelemetry.isApproaching
                                    ? const Color(0xFFEAB308)
                                    : AppColors.primary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 48, color: Colors.grey.shade200),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 16, right: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isAr ? 'المسافة إلى محطتك' : 'Distance to Stop',
                            style: AppTypography.bodySmall,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                '${effectiveTelemetry.distanceKm}',
                                style: AppTypography.welcomeTitle.copyWith(fontSize: 24),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                AppLocale.tr('km_abbr'),
                                style: AppTypography.bodySmall,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  Container(width: 1, height: 48, color: Colors.grey.shade200),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          isAr ? 'سرعة الحافلة' : 'Bus Speed',
                          style: AppTypography.bodySmall,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${effectiveTelemetry.speedKmh} ${isAr ? "كم/س" : "km/h"}',
                          style: AppTypography.labelBold.copyWith(color: const Color(0xFF16A34A)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),

          // Interactive Route Vector Visualizer / Map
          _buildInteractiveRouteMap(route, effectiveTelemetry, selectedStop, isAr),
          const SizedBox(height: 16),

          // Selected Pickup Stop Card with Change Action
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      AppLocale.tr('pickup_stop'),
                      style: AppTypography.labelBold.copyWith(color: AppColors.textSecondary),
                    ),
                    InkWell(
                      onTap: () => _showChangeStopDialog(route, selectedStop, isAr),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        child: Text(
                          AppLocale.tr('change_stop'),
                          style: AppTypography.labelBold.copyWith(color: AppColors.primary, fontSize: 13),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.location_on, color: Colors.redAccent, size: 22),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        selectedStop.localizedName(isAr),
                        style: AppTypography.labelBold.copyWith(fontSize: 15),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        selectedStop.scheduledTime,
                        style: AppTypography.labelBold.copyWith(color: AppColors.primary, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Driver & Bus Details Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppLocale.tr('driver_details'),
                  style: AppTypography.labelBold.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: const Color(0xFFE2E8F0),
                      child: Icon(Icons.person, color: AppColors.primary, size: 28),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            route.driver.localizedName(isAr),
                            style: AppTypography.labelBold.copyWith(fontSize: 14),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(Icons.star, size: 14, color: Colors.amber),
                              const SizedBox(width: 4),
                              Text(
                                '${route.driver.rating}',
                                style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(width: 8),
                              Text('•', style: AppTypography.bodySmall),
                              const SizedBox(width: 8),
                              Text(
                                route.vehiclePlate,
                                style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A).withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.phone, color: Color(0xFF16A34A), size: 18),
                      ),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('${AppLocale.tr('call_driver')}: ${route.driver.phone}')),
                        );
                      },
                    ),
                  ],
                ),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${AppLocale.tr('bus_model_label')}: ${route.busModel}',
                      style: AppTypography.bodySmall,
                    ),
                    Text(
                      '${route.capacity} ${isAr ? 'راكب' : 'seats'}',
                      style: AppTypography.bodySmall,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Smart Commute Preferences & Proximity Alert Preview
          _buildCommutePreferenceCard(commute, isAr),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  // Interactive Live OpenStreetMap Fleet View
  Widget _buildInteractiveRouteMap(
    BusRoute route,
    BusTelemetry? telemetry,
    BusStop selectedStop,
    bool isAr,
  ) {
    return InteractiveFleetMap(
      route: route,
      telemetry: telemetry,
      selectedStop: selectedStop,
      isArabic: isAr,
      height: 270,
      onSetAsPickup: (stop) {
        ref.read(myCommuteProvider.notifier).selectStop(route.id, stop.id);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isAr
                  ? 'تم تعيين محطة ركوبك إلى: "${stop.localizedName(isAr)}"'
                  : 'Pickup stop updated to: "${stop.localizedName(isAr)}"',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      },
    );
  }

  void _showChangeStopDialog(BusRoute route, BusStop currentStop, bool isAr) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isAr ? 'اختر محطة ركوبك المعتادة:' : 'Select Your Pickup Stop:',
                style: AppTypography.welcomeTitle.copyWith(fontSize: 16),
              ),
              const SizedBox(height: 16),
              ...route.stops.map((stop) {
                final isSelected = stop.id == currentStop.id;
                return ListTile(
                  leading: Icon(
                    Icons.location_on,
                    color: isSelected ? AppColors.primary : Colors.grey,
                  ),
                  title: Text(stop.localizedName(isAr), style: AppTypography.bodyMedium),
                  subtitle: Text(stop.scheduledTime),
                  trailing: isSelected
                      ? Icon(Icons.check_circle, color: AppColors.primary)
                      : null,
                  onTap: () {
                    Navigator.of(context).pop();
                    ref.read(myCommuteProvider.notifier).selectStop(route.id, stop.id);
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  // ==========================================
  // TAB 2: ROUTES & SCHEDULES DIRECTORY
  // ==========================================
  Widget _buildRoutesDirectoryTab(bool isAr) {
    final routesState = ref.watch(busRoutesProvider);

    return routesState.when(
      loading: (_) => Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (msg, code, prev) => Center(child: Text(msg)),
      empty: () => Center(child: Text(isAr ? 'لا توجد خطوط' : 'No routes available')),
      refreshing: (routes) => _buildRoutesList(routes, isAr),
      success: (routes) => _buildRoutesList(routes, isAr),
    );
  }

  Widget _buildRoutesList(List<BusRoute> routes, bool isAr) {
    final query = _searchCtrl.text.toLowerCase().trim();

    final filtered = routes.where((r) {
      if (_selectedFactoryFilter != 'all') {
        if (r.destinationComplex.toLowerCase() != _selectedFactoryFilter.toLowerCase()) return false;
      }
      if (query.isNotEmpty) {
        final matchesName = r.nameAr.toLowerCase().contains(query) ||
            r.nameEn.toLowerCase().contains(query) ||
            r.code.toLowerCase().contains(query);
        final matchesStop = r.stops.any((s) =>
            s.nameAr.toLowerCase().contains(query) || s.nameEn.toLowerCase().contains(query));
        return matchesName || matchesStop;
      }
      return true;
    }).toList();

    return Column(
      children: [
        // Search Bar & Filter Header
        Container(
          color: AppColors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            children: [
              // Search Input
              TextField(
                controller: _searchCtrl,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: AppLocale.tr('search_routes_hint'),
                  prefixIcon: const Icon(Icons.search, size: 20),
                  filled: true,
                  fillColor: const Color(0xFFF1F5F9),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Complex Filter Tabs
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('all', AppLocale.tr('all_factories_tab')),
                    _buildFilterChip('10th of Ramadan', isAr ? 'العاشر من رمضان' : '10th of Ramadan'),
                    _buildFilterChip('Quesna', isAr ? 'قويسنا' : 'Quesna'),
                    _buildFilterChip('Benha', isAr ? 'بنها' : 'Benha'),
                  ],
                ),
              ),
            ],
          ),
        ),

        // List of Routes
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: filtered.length,
            itemBuilder: (context, i) {
              final r = filtered[i];
              return _buildRouteCard(r, routes, isAr);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _selectedFactoryFilter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => setState(() => _selectedFactoryFilter = key),
        selectedColor: AppColors.primary,
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : AppColors.textPrimary,
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }

  Widget _buildRouteCard(BusRoute route, List<BusRoute> allRoutes, bool isAr) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(Icons.directions_bus, color: AppColors.primary),
        ),
        title: Text(
          route.localizedName(isAr),
          style: AppTypography.labelBold.copyWith(fontSize: 14),
        ),
        subtitle: Text(
          '${route.code} • ${route.stops.length} ${isAr ? 'محطات' : 'stops'} • ${route.destinationComplex}',
          style: AppTypography.bodySmall,
        ),
        childrenPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        children: [
          const Divider(),
          // Driver info row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${isAr ? 'السائق:' : 'Driver:'} ${route.driver.localizedName(isAr)}',
                style: AppTypography.bodySmall.copyWith(fontWeight: FontWeight.w600),
              ),
              Text(
                route.vehiclePlate,
                style: AppTypography.bodySmall.copyWith(color: AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Sequential stops timeline
          ...route.stops.map((stop) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '${stop.order}',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(stop.localizedName(isAr), style: AppTypography.bodyMedium),
                  ),
                  Text(stop.scheduledTime, style: AppTypography.bodySmall),
                ],
              ),
            );
          }),
          const SizedBox(height: 12),

          // Transfer Button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                ApplyRouteTransferSheet.show(
                  context,
                  routes: allRoutes,
                  currentRouteId: route.id,
                );
              },
              icon: const Icon(Icons.swap_horiz, size: 18),
              label: Text(AppLocale.tr('request_transfer_btn')),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 3: DIGITAL BOARDING PASS & ALERTS
  // ==========================================
  Widget _buildBoardingPassTab(bool isAr) {
    final passState = ref.watch(boardingPassProvider);
    final alertsState = ref.watch(routeAlertsProvider);
    final commuteState = ref.watch(myCommuteProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Digital QR Boarding Card
        passState.when(
          loading: (_) => Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (msg, code, prev) => Center(child: Text(msg)),
          empty: () => Center(child: Text(isAr ? 'لا توجد بطاقة صعود' : 'No boarding pass')),
          refreshing: (pass) => _buildBoardingPassCard(pass, commuteState.data, isAr),
          success: (pass) => _buildBoardingPassCard(pass, commuteState.data, isAr),
        ),
        const SizedBox(height: 24),

        // Action Buttons (Report Delay & Missed Bus)
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => _showReportIncidentSheet(isAr),
                icon: const Icon(Icons.report_problem_outlined, size: 16, color: Colors.white),
                label: Text(
                  AppLocale.tr('report_delay_btn'),
                  style: AppTypography.buttonText.copyWith(fontSize: 12),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _showMissedBusAssistant(isAr),
                icon: const Icon(Icons.help_outline, size: 16),
                label: Text(
                  AppLocale.tr('missed_bus_btn'),
                  style: AppTypography.labelBold.copyWith(fontSize: 12),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: BorderSide(color: AppColors.primary),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Live Route Alerts Section
        Text(
          AppLocale.tr('active_alerts_title'),
          style: AppTypography.welcomeTitle.copyWith(fontSize: 16),
        ),
        const SizedBox(height: 12),

        alertsState.when(
          loading: (_) => Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (msg, code, prev) => Center(child: Text(msg)),
          empty: () => _buildEmptyAlertsCard(isAr),
          refreshing: (alerts) => _buildAlertsList(alerts, isAr),
          success: (alerts) => _buildAlertsList(alerts, isAr),
        ),
      ],
    );
  }

  Widget _buildBoardingPassCard(BoardingPassData pass, MyCommuteState? commute, bool isAr) {
    final hasBoarded = commute?.hasBoarded ?? false;
    final isExcused = commute?.boarding?.excusedForTransitDelay ?? false;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: Colors.grey.shade200),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppLocale.tr('digital_boarding_pass'),
                    style: AppTypography.welcomeTitle.copyWith(fontSize: 16),
                  ),
                  Text(
                    pass.localizedRoute(isAr),
                    style: AppTypography.bodySmall,
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: hasBoarded ? const Color(0xFFDCFCE7) : const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  hasBoarded
                      ? (isAr ? 'تم الصعود • على متن الحافلة' : 'Boarded')
                      : (isAr ? 'جاهز للصعود' : 'Ready to Board'),
                  style: TextStyle(
                    color: hasBoarded ? const Color(0xFF16A34A) : const Color(0xFF0284C7),
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // QR Code Display
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Column(
              children: [
                const Icon(Icons.qr_code_2, size: 160, color: Color(0xFF0F172A)),
                const SizedBox(height: 8),
                Text(
                  pass.qrToken.split('-').take(3).join('-'),
                  style: TextStyle(fontSize: 10, color: Colors.grey.shade500, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Security Counter
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.timer_outlined, size: 14, color: AppColors.primary),
              const SizedBox(width: 4),
              Text(
                '${isAr ? 'يتجدد رمز المرور خلال' : 'Refreshes in'} ${pass.expiresInSeconds} ${AppLocale.tr('minutes_abbr') == 'دقيقة' ? 'ثانية' : 'sec'}',
                style: AppTypography.bodySmall.copyWith(color: AppColors.primary),
              ),
            ],
          ),
          const Divider(height: 24),

          // Passenger details
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(isAr ? 'اسم الراكب' : 'Passenger', style: AppTypography.bodySmall),
                  Text(pass.employeeName, style: AppTypography.labelBold),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(AppLocale.tr('seat_number'), style: AppTypography.bodySmall),
                  Text(pass.seatNumber, style: AppTypography.labelBold.copyWith(color: AppColors.primary)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(AppLocale.tr('bus_plate_label'), style: AppTypography.bodySmall),
                  Text(pass.vehiclePlate, style: AppTypography.labelBold),
                ],
              ),
            ],
          ),

          // Excused Transit Delay Banner if active
          if (isExcused) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF86EFAC)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.verified, color: Color(0xFF16A34A), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      AppLocale.tr('transit_excuse_active'),
                      style: AppTypography.labelBold.copyWith(color: const Color(0xFF16A34A), fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyAlertsCard(bool isAr) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline, color: Color(0xFF16A34A), size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              AppLocale.tr('no_active_alerts'),
              style: AppTypography.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAlertsList(List<RouteAlert> alerts, bool isAr) {
    if (alerts.isEmpty) return _buildEmptyAlertsCard(isAr);

    return Column(
      children: alerts.map((alert) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFBEB),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFFCD34D)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert.message,
                      style: AppTypography.labelBold.copyWith(fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${alert.routeNameAr} • ${isAr ? 'تأخير متوقع:' : 'Expected delay:'} ${alert.delayMinutes} ${AppLocale.tr('minutes_abbr')}',
                      style: AppTypography.bodySmall.copyWith(color: const Color(0xFFB45309)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // Incident reporting modal sheet
  void _showReportIncidentSheet(bool isAr) {
    final commute = ref.read(myCommuteProvider).data;
    final routeId = commute?.route?.id ?? 'route_101';
    final textCtrl = TextEditingController();
    String selectedType = 'traffic_delay';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            top: 20,
            left: 20,
            right: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                AppLocale.tr('report_delay_btn'),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 16),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: selectedType,
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                items: [
                  DropdownMenuItem(value: 'traffic_delay', child: Text(AppLocale.tr('incident_type_traffic'))),
                  DropdownMenuItem(value: 'breakdown', child: Text(AppLocale.tr('incident_type_breakdown'))),
                  DropdownMenuItem(value: 'detour', child: Text(AppLocale.tr('incident_type_detour'))),
                ],
                onChanged: (v) => selectedType = v ?? 'traffic_delay',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: textCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: AppLocale.tr('incident_notes_hint'),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () async {
                    if (textCtrl.text.trim().isEmpty) return;
                    Navigator.of(ctx).pop();
                    await ref.read(routeAlertsProvider.notifier).reportIncident(
                          routeId: routeId,
                          type: selectedType,
                          message: textCtrl.text.trim(),
                        );
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(AppLocale.tr('incident_sent_success')),
                          backgroundColor: const Color(0xFF16A34A),
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    isAr ? 'إرسال البلاغ' : 'Send Incident Report',
                    style: AppTypography.buttonText,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // Missed bus assistant modal
  void _showMissedBusAssistant(bool isAr) {
    final allRoutes = ref.read(busRoutesProvider).data ?? [];

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.directions_bus_filled, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    AppLocale.tr('missed_bus_title'),
                    style: AppTypography.welcomeTitle.copyWith(fontSize: 16),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                AppLocale.tr('missed_bus_desc'),
                style: AppTypography.bodySmall,
              ),
              const SizedBox(height: 16),
              ...allRoutes.take(3).map((r) {
                return ListTile(
                  leading: Icon(Icons.alt_route, color: AppColors.primary),
                  title: Text(r.localizedName(isAr), style: AppTypography.labelBold.copyWith(fontSize: 13)),
                  subtitle: Text('${r.destinationAr} • ${r.vehiclePlate}'),
                  trailing: TextButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      ApplyRouteTransferSheet.show(context, routes: allRoutes, currentRouteId: r.id);
                    },
                    child: Text(isAr ? 'ركوب هذا الخط' : 'Board Line'),
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSuppressionBanner(CommuteSuppression suppression, bool isAr) {
    final bool isOptOut = suppression.optOutToday;
    final Color bgColor = isOptOut ? const Color(0xFFFEF3C7) : const Color(0xFFEFF6FF);
    final Color borderColor = isOptOut ? const Color(0xFFF59E0B) : const Color(0xFF3B82F6);
    final Color textColor = isOptOut ? const Color(0xFF92400E) : const Color(0xFF1E40AF);
    final IconData icon = isOptOut ? Icons.pause_circle_outline_rounded : Icons.info_outline_rounded;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: borderColor, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppLocale.tr('proximity_alert_suppressed'),
                  style: AppTypography.labelBold.copyWith(color: textColor, fontSize: 13),
                ),
                const SizedBox(height: 2),
                Text(
                  suppression.localizedReason(isAr),
                  style: AppTypography.bodySmall.copyWith(color: textColor.withValues(alpha: 0.85), fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommutePreferenceCard(MyCommuteState commute, bool isAr) {
    final bool isOptedOut = commute.suppression.optOutToday;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: isOptedOut ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isOptedOut ? Icons.no_transfer_rounded : Icons.notifications_active_outlined,
                  color: isOptedOut ? AppColors.error : AppColors.statusGreen,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppLocale.tr('not_commuting_today'),
                      style: AppTypography.labelBold.copyWith(fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      AppLocale.tr('not_commuting_desc'),
                      style: AppTypography.bodySmall.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: isOptedOut,
                activeColor: AppColors.primary,
                onChanged: (val) async {
                  final ok = await ref.read(myCommuteProvider.notifier).toggleOptOut(val);
                  if (ok && mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          val
                              ? AppLocale.tr('commuting_paused')
                              : AppLocale.tr('commuting_confirmed'),
                        ),
                        behavior: SnackBarBehavior.floating,
                        backgroundColor: val ? AppColors.warning : AppColors.statusGreen,
                      ),
                    );
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          Divider(height: 1, color: Colors.grey.shade100),
          const SizedBox(height: 12),

          // Simulate Live Transit Stream Toggle
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: (_isSimulating ? const Color(0xFF0284C7) : AppColors.primary)
                      .withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _isSimulating
                      ? Icons.play_circle_filled_rounded
                      : Icons.play_circle_outline_rounded,
                  color: _isSimulating ? const Color(0xFF0284C7) : AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isAr ? 'محاكاة البث الحي للحافلة' : 'Simulate Live Transit Stream',
                      style: AppTypography.labelBold.copyWith(fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isAr
                          ? 'بث إحداثيات GPS للسائق كل 1.5 ثانية وتحديث الخريطة'
                          : 'Stream driver GPS telemetry every 1500ms on live map',
                      style: AppTypography.bodySmall.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: _isSimulating,
                activeColor: const Color(0xFF0284C7),
                onChanged: (val) {
                  if (commute.route != null) {
                    final selectedStop = commute.route!.stops.firstWhere(
                      (s) => s.id == commute.assignment?.selectedStopId,
                      orElse: () => commute.route!.stops.first,
                    );
                    _toggleLiveSimulation(commute.route!, selectedStop);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          val
                              ? (isAr
                                  ? 'تم بدء بث المحاكاة الحية للحافلة'
                                  : 'Live transit simulation started')
                              : (isAr
                                  ? 'تم إيقاف محاكاة البث الحي'
                                  : 'Live transit simulation stopped'),
                        ),
                        behavior: SnackBarBehavior.floating,
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          Divider(height: 1, color: Colors.grey.shade100),
          const SizedBox(height: 10),
          InkWell(
            onTap: () => _showProximityAlertSimulation(commute, isAr),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.touch_app_outlined, size: 16, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    AppLocale.tr('simulated_proximity_ping'),
                    style: AppTypography.labelBold.copyWith(
                      color: AppColors.primary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showProximityAlertSimulation(MyCommuteState commute, bool isAr) {
    final route = commute.route;
    final telemetry = commute.telemetry;
    final driver = route?.driver;
    final stop = route?.stops.firstWhere(
      (s) => s.id == commute.assignment?.selectedStopId,
      orElse: () => route.stops.first,
    );

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: const BoxDecoration(
                  color: Color(0xFFEFF6FF),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.directions_bus_rounded, color: AppColors.primary, size: 30),
              ),
              const SizedBox(height: 14),
              Text(
                AppLocale.tr('approaching_banner_title'),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                '${route?.code ?? "BUS-101"} • ${driver?.name ?? ""}',
                style: AppTypography.labelBold.copyWith(color: AppColors.primary, fontSize: 13),
              ),
              const SizedBox(height: 8),
              Text(
                isAr
                    ? 'الحافلة على بُعد ${telemetry?.distanceKm ?? 3} كم (${telemetry?.etaMinutes ?? 8} دقائق) من محطة "${stop?.nameAr ?? ""}". يُرجى التواجد في نقطة الركوب الآن.'
                    : 'Bus is ${telemetry?.distanceKm ?? 3} km (${telemetry?.etaMinutes ?? 8} mins) away from "${stop?.nameEn ?? ""}". Please be at your pickup point.',
                style: AppTypography.bodySmall.copyWith(fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        side: const BorderSide(color: Color(0xFF16A34A)),
                      ),
                      icon: const Icon(Icons.call, size: 16, color: Color(0xFF16A34A)),
                      label: Text(
                        AppLocale.tr('call_driver_action'),
                        style: AppTypography.labelBold.copyWith(color: const Color(0xFF16A34A), fontSize: 12),
                      ),
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(isAr ? 'جاري الاتصال بالسائق: ${driver?.phone ?? ""}' : 'Calling driver: ${driver?.phone ?? ""}'),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: const Icon(Icons.map_outlined, size: 16, color: Colors.white),
                      label: Text(
                        AppLocale.tr('open_live_map_action'),
                        style: AppTypography.labelBold.copyWith(color: Colors.white, fontSize: 12),
                      ),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _promptDriverMode(BuildContext context, bool isAr) {
    final pinCtrl = TextEditingController(text: '1234');
    String? errorMessage;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.admin_panel_settings, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  AppLocale.tr('driver_pin_prompt'),
                  style: AppTypography.sectionHeading.copyWith(fontSize: 16),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                AppLocale.tr('driver_mode_desc'),
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: pinCtrl,
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 4,
                textAlign: TextAlign.center,
                style: TextStyle(
                  letterSpacing: 12,
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 22,
                ),
                decoration: InputDecoration(
                  counterText: '',
                  filled: true,
                  fillColor: AppColors.background,
                  hintText: '••••',
                  errorText: errorMessage,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: AppColors.primary, width: 2),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(isAr ? 'إلغاء' : 'Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                final pin = pinCtrl.text.trim();
                if (pin == '1234' || pin.length == 4) {
                  Navigator.of(ctx).pop();
                  AppNavigation.toDriverConsole(context, routeId: 'route_101');
                } else {
                  setModalState(() {
                    errorMessage = AppLocale.tr('driver_pin_invalid');
                  });
                }
              },
              child: Text(AppLocale.tr('enter_pin_btn')),
            ),
          ],
        ),
      ),
    );
  }
}

// ==========================================
// CUSTOM VECTOR ROUTE PAINTER
// ==========================================
class RouteMapPainter extends CustomPainter {
  final List<BusStop> stops;
  final String selectedStopId;
  final double progressRatio;

  RouteMapPainter({
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
    final stepX = (size.width - 60) / (stops.length - 1);
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

    // Draw Stop Nodes
    for (int i = 0; i < stops.length; i++) {
      final x = 30 + i * stepX;
      final y = centerY + (i % 2 == 0 ? -25 : 25);
      final isSelected = stops[i].id == selectedStopId;

      final nodePaint = Paint()
        ..color = isSelected ? Colors.redAccent : (i == stops.length - 1 ? const Color(0xFF22C55E) : Colors.white)
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

    // Draw Animated Bus Position
    final busX = 30 + (stops.length - 1) * stepX * progressRatio;
    final busY = centerY + 10;
    final busPaint = Paint()..color = const Color(0xFF38BDF8);

    canvas.drawCircle(Offset(busX, busY), 9, busPaint);
    final busRadar = Paint()
      ..color = const Color(0xFF38BDF8).withValues(alpha: 0.3)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(Offset(busX, busY), 16, busRadar);
  }

  @override
  bool shouldRepaint(covariant RouteMapPainter oldDelegate) => true;
}
