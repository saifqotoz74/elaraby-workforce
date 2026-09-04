import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/home_content.dart';

class CompanyNewsScreen extends StatelessWidget {
  /// Live articles from the backend; empty -> bundled demo articles.
  final List<ServerNews> serverNews;

  const CompanyNewsScreen({super.key, this.serverNews = const []});

  @override
  Widget build(BuildContext context) {
    if (serverNews.isNotEmpty) {
      return _listView(
        context,
        serverNews
            .map((n) => _NewsArticle(
                  title: n.title,
                  category: AppLocale.instance.isArabic ? 'أخبار' : 'Company',
                  date: n.timeAgo,
                  readTime: '',
                  imagePath: 'assets/images/news_factory.png',
                  summary: n.body,
                  imageUrl: n.imageUrl,
                ))
            .toList(),
      );
    }
    final newsList = [
      _NewsArticle(
        title: AppLocale.tr('news_demo1_title'),
        category: AppLocale.tr('news_demo1_cat'),
        date: '2 Hours Ago',
        readTime: '3 min read',
        imagePath: 'assets/images/news_factory.png',
        summary: AppLocale.tr('news_demo1_body'),
      ),
      _NewsArticle(
        title: AppLocale.tr('news_demo2_title'),
        category: AppLocale.tr('news_demo2_cat'),
        date: 'Yesterday',
        readTime: '2 min read',
        imagePath: 'assets/images/news_factory.png',
        summary: AppLocale.tr('news_demo2_body'),
      ),
      _NewsArticle(
        title: AppLocale.tr('news_demo3_title'),
        category: AppLocale.tr('news_demo3_cat'),
        date: '3 days ago',
        readTime: '4 min read',
        imagePath: 'assets/images/news_factory.png',
        summary: AppLocale.tr('news_demo3_body'),
      ),
      _NewsArticle(
        title: AppLocale.tr('news_demo4_title'),
        category: AppLocale.tr('news_demo4_cat'),
        date: '1 week ago',
        readTime: '5 min read',
        imagePath: 'assets/images/news_factory.png',
        summary: AppLocale.tr('news_demo4_body'),
      ),
    ];

    return _listView(context, newsList);
  }

  Widget _listView(BuildContext context, List<_NewsArticle> newsList) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          AppLocale.tr('company_news'),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: SafeArea(
        child: ListView.separated(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.all(16),
          itemCount: newsList.length,
          separatorBuilder: (_, __) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final item = newsList[index];
            return _buildNewsCard(context, item);
          },
        ),
      ),
    );
  }

  Widget _buildNewsCard(BuildContext context, _NewsArticle item) {
    return Container(
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
          onTap: () => _showArticleModal(context, item),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              item.image(height: 140),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.shiftBg,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            item.category,
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        if (item.readTime.isNotEmpty)
                          Text(
                            item.readTime,
                            style: AppTypography.dateSubtitle.copyWith(fontSize: 11),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      item.title,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.summary,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          item.date,
                          style: AppTypography.newsTimestamp,
                        ),
                        Row(
                          children: [
                            Text(
                              AppLocale.tr('news_read'),
                              style: AppTypography.fontBase.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.primary),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showArticleModal(BuildContext context, _NewsArticle item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          height: MediaQuery.of(ctx).size.height * 0.85,
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Grab handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: item.image(height: 180),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.shiftBg,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              item.category,
                              style: AppTypography.fontBase.copyWith(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            item.date,
                            style: AppTypography.newsTimestamp,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        item.title,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        item.summary,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'This milestone reinforces Elaraby Group commitment to industrial leadership, empowering our team members with the latest training, modern safety protocols, and advanced manufacturing technologies.\n\nFor more information or internal inquiries, please connect with your factory communications officer or line manager.',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
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

class _NewsArticle {
  final String title;
  final String category;
  final String date;
  final String readTime;
  final String imagePath;
  final String summary;
  final String? imageUrl;

  const _NewsArticle({
    required this.title,
    required this.category,
    required this.date,
    required this.readTime,
    required this.imagePath,
    required this.summary,
    this.imageUrl,
  });

  Widget image({double? height}) {
    if (imageUrl != null) {
      return Image.network(
        ApiClient.instance.resolveUrl(imageUrl!),
        width: double.infinity,
        height: height,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Image.asset(
          imagePath,
          width: double.infinity,
          height: height,
          fit: BoxFit.cover,
        ),
      );
    }
    return Image.asset(
      imagePath,
      width: double.infinity,
      height: height,
      fit: BoxFit.cover,
    );
  }
}
