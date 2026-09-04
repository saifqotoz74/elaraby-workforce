import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';
import '../../data/home_content.dart';
import '../screens/announcement_detail_screen.dart';

class AnnouncementCard extends StatelessWidget {
  const AnnouncementCard({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([AppLocale.instance, HomeContent.instance]),
      builder: (context, _) {
        final server = HomeContent.instance.announcement;
        final title = server?.title ?? AppLocale.tr('announcement_title');
        final badge = server == null
            ? AppLocale.tr('announcement_badge')
            : (server.important
                ? AppLocale.tr('announcement_badge')
                : AppLocale.tr('new_announcement'));
        return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.announcementBg,
          borderRadius: BorderRadius.circular(20),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        badge,
                        style: AppTypography.announcementBadge,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        title,
                        style: AppTypography.announcementTitle,
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.announcementIconBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.campaign_rounded,
                    color: AppColors.announcementButton,
                    size: 24,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AnnouncementDetailScreen(
                        title: server?.title,
                        body: server?.body,
                        imageUrl: server?.imageUrl,
                      ),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.announcementButton,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  AppLocale.tr('read_now'),
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
}
