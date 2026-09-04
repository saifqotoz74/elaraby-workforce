import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../data/home_content.dart';
import '../screens/company_news_screen.dart';

class CompanyNewsCard extends StatelessWidget {
  const CompanyNewsCard({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([AppLocale.instance, HomeContent.instance]),
      builder: (context, _) {
      final latest = HomeContent.instance.news.isNotEmpty
          ? HomeContent.instance.news.first
          : null;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                AppLocale.tr('company_news'),
                style: AppTypography.sectionHeading,
              ),
              GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => CompanyNewsScreen(
                        serverNews: HomeContent.instance.news,
                      ),
                    ),
                  );
                },
                child: Text(
                  AppLocale.tr('view_all'),
                  style: AppTypography.viewAllLink,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(18),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x06000000),
                  blurRadius: 8,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => CompanyNewsScreen(
                        serverNews: HomeContent.instance.news,
                      ),
                    ),
                  );
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (latest?.imageUrl != null)
                      Image.network(
                        ApiClient.instance.resolveUrl(latest!.imageUrl!),
                        width: double.infinity,
                        height: 135,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Image.asset(
                          'assets/images/news_factory.png',
                          width: double.infinity,
                          height: 135,
                          fit: BoxFit.cover,
                        ),
                      )
                    else
                      Image.asset(
                        'assets/images/news_factory.png',
                        width: double.infinity,
                        height: 135,
                        fit: BoxFit.cover,
                      ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            latest?.title ??
                                (AppLocale.instance.isArabic
                                    ? 'افتتاح خطوط إنتاج جديدة لزيادة الطاقة الاستيعابية لمصانع العربي'
                                    : 'New Manufacturing Facilities to Increase Production Capacity'),
                            style: AppTypography.newsTitle,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            latest?.timeAgo ??
                                (AppLocale.instance.isArabic ? 'منذ ساعتين' : '2 Hours Ago'),
                            style: AppTypography.newsTimestamp,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      );
      },
    );
  }
}
