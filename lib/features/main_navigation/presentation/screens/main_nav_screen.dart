import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
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

  void switchTab(int index) {
    if (index >= 0 && index < 5) {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Rebuild all tabs when the locale changes: the IndexedStack holds const
    // children whose tr() strings would otherwise stay stale after a switch.
    return ListenableBuilder(
      listenable: AppLocale.instance,
      builder: (context, _) => Scaffold(
        backgroundColor: AppColors.scaffoldBackground,
        body: IndexedStack(
          index: _currentIndex,
          // Non-const on purpose: fresh instances force every tab to re-run
          // tr() so a language switch is reflected immediately.
          children: [
            HomeScreen(),
            ServicesScreen(),
            BenefitsScreen(),
            InboxScreen(),
            ProfileScreen(),
          ],
        ),
        bottomNavigationBar: CustomBottomNavBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
        ),
      ),
    );
  }
}
