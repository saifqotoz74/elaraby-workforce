import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';

class CustomBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const CustomBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return ListenableBuilder(
      listenable: AppLocale.instance,
      builder: (context, _) {
        final items = [
          _NavItem(
            label: AppLocale.tr('nav_home'),
            activeIcon: Icons.home_rounded,
            inactiveIcon: Icons.home_outlined,
          ),
          _NavItem(
            label: AppLocale.tr('nav_services'),
            activeIcon: Icons.grid_view_rounded,
            inactiveIcon: Icons.grid_view_outlined,
          ),
          _NavItem(
            label: AppLocale.tr('nav_benefits'),
            activeIcon: Icons.card_giftcard_rounded,
            inactiveIcon: Icons.card_giftcard_outlined,
          ),
          _NavItem(
            label: AppLocale.tr('nav_inbox'),
            activeIcon: Icons.inbox_rounded,
            inactiveIcon: Icons.inbox_outlined,
          ),
          _NavItem(
            label: AppLocale.tr('nav_profile'),
            activeIcon: Icons.person_rounded,
            inactiveIcon: Icons.person_outline_rounded,
          ),
        ];

        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(
              top: BorderSide(
                color: AppColors.navBorder,
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Color(0x08000000),
                blurRadius: 10,
                offset: Offset(0, -3),
              ),
            ],
          ),
          padding: EdgeInsets.only(
            top: 10,
            bottom: bottomPadding > 0 ? bottomPadding : 12,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(items.length, (index) {
              final item = items[index];
              final isSelected = currentIndex == index;

              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onTap(index),
                child: SizedBox(
                  width: 64,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isSelected ? item.activeIcon : item.inactiveIcon,
                        color: isSelected ? AppColors.navActive : AppColors.navInactive,
                        size: 24,
                      ),
                      if (isSelected) ...[
                        const SizedBox(height: 4),
                        Text(
                          item.label,
                          style: AppTypography.navLabelActive,
                        ),
                      ] else ...[
                        const SizedBox(height: 4),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ),
        );
      },
    );
  }
}

class _NavItem {
  final String label;
  final IconData activeIcon;
  final IconData inactiveIcon;

  const _NavItem({
    required this.label,
    required this.activeIcon,
    required this.inactiveIcon,
  });
}
