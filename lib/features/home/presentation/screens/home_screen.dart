import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/network/backend.dart';
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
      if (_lastRefreshed == null || now.difference(_lastRefreshed!) > _kRefreshCooldown) {
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
    } catch (_) {}
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
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
                      children: const [
                        SizedBox(height: 16),
                        AnnouncementCard(),
                        SizedBox(height: 14),
                        TodayShiftCard(),
                        SizedBox(height: 14),
                        MetricCardsRow(),
                        SizedBox(height: 20),
                        QuickActionsGrid(),
                        SizedBox(height: 20),
                        CompanyNewsCard(),
                        SizedBox(height: 20),
                        QuickSurveyCard(),
                        SizedBox(height: 32),
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
}
