import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../benefits/presentation/screens/benefits_screen.dart';
import '../../../home/presentation/screens/home_screen.dart';
import '../../../inbox/presentation/screens/inbox_screen.dart';
import '../../../profile/presentation/screens/profile_screen.dart';
import '../../../services/presentation/screens/services_screen.dart';
import '../widgets/custom_bottom_nav_bar.dart';

class MainNavScreen extends StatefulWidget {
  const MainNavScreen({super.key});

  @override
  State<MainNavScreen> createState() => _MainNavScreenState();
}

class _MainNavScreenState extends State<MainNavScreen> {
  int _currentIndex = 0;
  final Set<int> _loadedTabs = {0};

  void switchTab(int index) {
    if (index >= 0 && index < 5) {
      setState(() {
        _currentIndex = index;
        _loadedTabs.add(index);
      });
    }
  }

  Widget _buildTabScreen(int index) {
    if (!_loadedTabs.contains(index)) {
      return const SizedBox.shrink();
    }
    switch (index) {
      case 0:
        return const HomeScreen();
      case 1:
        return const ServicesScreen();
      case 2:
        return const BenefitsScreen();
      case 3:
        return const InboxScreen();
      case 4:
        return const ProfileScreen();
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppLocale.instance,
      builder: (context, _) => Scaffold(
        backgroundColor: AppColors.scaffoldBackground,
        body: Column(
          children: [
            // Real-time offline awareness banner
            ValueListenableBuilder<bool>(
              valueListenable: Backend.instance.online,
              builder: (context, isOnline, _) {
                if (isOnline) return const SizedBox.shrink();
                return Container(
                  width: double.infinity,
                  color: const Color(0xFFB45309),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.cloud_off_rounded, color: Colors.white, size: 15),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          AppLocale.tr('network_offline_warning'),
                          style: AppTypography.fontBase.copyWith(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            Expanded(
              child: IndexedStack(
                index: _currentIndex,
                children: List.generate(5, _buildTabScreen),
              ),
            ),
          ],
        ),
        bottomNavigationBar: CustomBottomNavBar(
          currentIndex: _currentIndex,
          onTap: switchTab,
        ),
      ),
    );
  }
}
