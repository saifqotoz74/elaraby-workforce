import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/navigation/app_navigation.dart';
import '../../../../core/storage/local_store.dart';
import '../../../inbox/presentation/screens/inbox_ids.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/tenant/tenant_brand_logo.dart';
import '../../../../core/tenant/tenant_brand.dart';

class HomeHeader extends StatelessWidget {
  const HomeHeader({super.key});

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return ValueListenableBuilder<TenantBrand>(
      valueListenable: AppTheme.tenantBrandNotifier,
      builder: (context, brand, _) {
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
              // Greeting, Date, and Company Name
              Expanded(
                child: ListenableBuilder(
                  listenable: Listenable.merge([
                    AppLocale.instance,
                    InboxIds.instance,
                    LocalStore.instance,
                  ]),
                  builder: (context, _) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              brand.localizedCompanyName(AppLocale.instance.isArabic),
                              style: AppTypography.labelBold.copyWith(
                                fontSize: 11,
                                color: brand.primaryColor,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '•',
                            style: TextStyle(color: Colors.grey.shade400, fontSize: 11),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            DateFormat('EEEE, dd MMM',
                                    AppLocale.instance.currentLocale.languageCode)
                                .format(DateTime.now()),
                            style: AppTypography.dateSubtitle.copyWith(fontSize: 11),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        LocalStore.instance.profile.name.trim().isNotEmpty
                            ? '${AppLocale.tr('welcome_prefix')} ${LocalStore.instance.profile.name.trim().split(' ').first}'
                            : AppLocale.tr('welcome_user'),
                        style: AppTypography.welcomeTitle,
                      ),
                    ],
                  ),
                ),
              ),

              // Tenant Corporate Logo / Monogram Shield
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: TenantBrandLogo(
                  brand: brand,
                  size: 40,
                  borderRadius: 10,
                ),
              ),

              // Notification Bell Button
              GestureDetector(
                onTap: () {
                  AppNavigation.toInbox(context);
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
                      Icon(
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
                            decoration: BoxDecoration(
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

              // User Avatar with Initials
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
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
      },
    );
  }
}
