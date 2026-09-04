import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../widgets/announcement_card.dart';
import '../widgets/company_news_card.dart';
import '../widgets/home_header.dart';
import '../widgets/metric_cards_row.dart';
import '../widgets/quick_actions_grid.dart';
import '../widgets/quick_survey_card.dart';
import '../widgets/today_shift_card.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: Column(
        children: [
          // Header / Custom App Bar
          const HomeHeader(),

          // Scrollable Body Content
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
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
          ),
        ],
      ),
    );
  }
}
