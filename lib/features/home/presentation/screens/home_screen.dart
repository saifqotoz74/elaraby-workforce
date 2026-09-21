import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/theme/tenant_theme_extension.dart';
import '../../../../core/navigation/app_navigation.dart';
import '../../data/home_content.dart';
import '../widgets/announcement_card.dart';
import '../widgets/company_news_card.dart';
import '../widgets/home_header.dart';
import '../widgets/metric_cards_row.dart';
import '../widgets/quick_actions_grid.dart';
import '../widgets/quick_survey_card.dart';
import '../widgets/today_shift_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  DateTime? _lastRefreshed;
  static const _kRefreshCooldown = Duration(seconds: 60);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final now = DateTime.now();
      if (_lastRefreshed == null ||
          now.difference(_lastRefreshed!) > _kRefreshCooldown) {
        _refresh();
      }
    }
  }

  Future<void> _refresh() async {
    _lastRefreshed = DateTime.now();
    try {
      await Future.wait([
        HomeContent.instance.load(),
        Backend.instance.syncProfile(),
        Backend.instance.syncRequests(),
      ]);
    } on Exception catch (e) {
      debugPrint('HomeScreen: refresh sync encountered error: $e');
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final features = context.tenantFeatures;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: Column(
        children: [
          // Header / Custom App Bar
          const HomeHeader(),

          // Scrollable Body Content with Pull-to-Refresh
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _refresh,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList.list(
                      children: [
                        const SizedBox(height: 16),
                        const AnnouncementCard(),
                        if (features.hasShifts) ...[
                          const SizedBox(height: 14),
                          const TodayShiftCard(),
                          const SizedBox(height: 14),
                          _buildSupervisorAnalyticsBanner(context),
                        ],
                        const SizedBox(height: 14),
                        const MetricCardsRow(),
                        const SizedBox(height: 20),
                        const QuickActionsGrid(),
                        const SizedBox(height: 20),
                        const CompanyNewsCard(),
                        if (features.hasSurveys) ...[
                          const SizedBox(height: 20),
                          const QuickSurveyCard(),
                        ],
                        const SizedBox(height: 32),
                      ],
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

  Widget _buildSupervisorAnalyticsBanner(BuildContext context) {
    return GestureDetector(
      onTap: () => AppNavigation.toSupervisorAnalytics(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 8,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0x330284C7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.analytics_rounded,
                color: Color(0xFF38BDF8),
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'إحصائيات الوردية والخطوط (Floor Analytics)',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'مراقبة ملء الوردية، مخاطر التوقف، والتعويض الذكي للعمالة',
                    style: TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              color: Color(0xFF94A3B8),
              size: 14,
            ),
          ],
        ),
      ),
    );
  }
}
