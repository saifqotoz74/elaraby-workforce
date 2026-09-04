import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../inbox/presentation/screens/inbox_screen.dart';
import '../../../../core/storage/local_store.dart';
import '../../../inbox/presentation/screens/inbox_ids.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';

class HomeHeader extends StatelessWidget {
  const HomeHeader({super.key});

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(24),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(20, topPadding + 12, 20, 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Greeting and Date
          Expanded(
            child: ListenableBuilder(
              listenable: Listenable.merge([AppLocale.instance, InboxIds.instance]),
              builder: (context, _) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    DateFormat('EEEE, dd MMMM', AppLocale.instance.currentLocale.languageCode)
                        .format(DateTime.now()),
                    style: AppTypography.dateSubtitle,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${AppLocale.tr('welcome_prefix')} ${LocalStore.instance.profile.name.split(' ').first}',
                    style: AppTypography.welcomeTitle,
                  ),
                ],
              ),
            ),
          ),
          // PR Project Logo Badge
          Container(
            width: 40,
            height: 40,
            margin: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE5E7EB)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 4,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Image.asset(
              'assets/images/app_logo.png',
              fit: BoxFit.contain,
            ),
          ),
          // Notification Bell Button
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const InboxScreen()),
              );
            },
            child: Container(
              width: 42,
              height: 42,
              decoration: const BoxDecoration(
                color: Color(0xFFF1F4F8),
                shape: BoxShape.circle,
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(
                    Icons.notifications,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  if (InboxIds.instance.unreadCount > 0)
                    Positioned(
                      top: 10,
                      right: 11,
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 10),
          // User Avatar with Initials "AG"
          Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
              color: AppColors.avatarBg,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              LocalStore.instance.profile.initials,
              style: AppTypography.fontBase.copyWith(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.avatarText,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
