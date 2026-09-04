import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../data/benefits_content.dart';
import '../../../inbox/presentation/screens/inbox_screen.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import 'benefit_detail_screen.dart';
import 'trip_detail_screen.dart';

class BenefitsScreen extends StatefulWidget {
  /// 0 Featured, 1 Supermarkets, 2 Health Care — lets other screens open a
  /// pre-selected category (e.g. Quick Actions).
  final int initialTab;

  const BenefitsScreen({super.key, this.initialTab = 0});

  @override
  State<BenefitsScreen> createState() => _BenefitsScreenState();
}

class _BenefitsScreenState extends State<BenefitsScreen> {
  late int _selectedCategoryIndex = widget.initialTab;

  @override
  void initState() {
    super.initState();
    BenefitsContent.instance.load();
  }

  final List<_CategoryFilter> _categories = [
    _CategoryFilter(label: AppLocale.tr('ben_cat_featured'), icon: Icons.auto_awesome),
    _CategoryFilter(label: AppLocale.tr('ben_cat_supermarkets'), icon: Icons.shopping_cart_outlined),
    _CategoryFilter(label: AppLocale.tr('ben_cat_health'), icon: Icons.medical_services_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: Column(
        children: [
          // Pinned App Bar
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppLocale.tr('nav_benefits'),
                      style: AppTypography.welcomeTitle,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      AppLocale.tr('ben_subtitle'),
                      style: AppTypography.dateSubtitle,
                    ),
                  ],
                ),
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
                    child: const Icon(
                      Icons.notifications,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Scrollable Body
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),

                  // Category Filter Row
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    child: Row(
                      children: List.generate(_categories.length, (index) {
                        final cat = _categories[index];
                        final isSelected = _selectedCategoryIndex == index;

                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: () => setState(() => _selectedCategoryIndex = index),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.primary : AppColors.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected ? AppColors.primary : const Color(0xFFE5E7EB),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    cat.icon,
                                    size: 18,
                                    color: isSelected ? Colors.white : AppColors.textPrimary,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    cat.label,
                                    style: AppTypography.fontBase.copyWith(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: isSelected ? Colors.white : AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Section 1: Exclusive Perks (server data when online,
                  // bundled demo otherwise)
                  if (_serverBenefits.isNotEmpty) ...[
                    _buildSectionHeader(AppLocale.tr('ben_section_perks')),
                    const SizedBox(height: 12),
                    ..._serverBenefits.map((b) => Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: _buildPerkCard(
                            title: '${b.discount} – ${b.title}',
                            subtitle:
                                '${b.category} • Valid through ${b.validThrough}',
                            imagePath: 'assets/images/benefit_supermarket.png',
                            heroImageUrl: b.imageUrl,
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => BenefitDetailScreen(
                                    title: b.title,
                                    discount: b.discount,
                                    category: b.category,
                                    description: b.description,
                                    validity: 'Valid through ${b.validThrough}',
                                    imageUrl: b.imageUrl,
                                  ),
                                ),
                              );
                            },
                          ),
                        )),
                  ] else ...[
                    _buildSectionHeader(AppLocale.tr('ben_section_perks')),
                    const SizedBox(height: 12),
                    if (_showSaudi) _buildPerkCard(
                      title: '20% off – Saudi Supermarket',
                      subtitle: 'Supermarkets • Valid through Dec 2026',
                      imagePath: 'assets/images/benefit_supermarket.png',
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const BenefitDetailScreen(
                              title: 'Saudi Supermarket',
                              discount: '20% OFF',
                              category: 'Exclusive Perk',
                              imagePath: 'assets/images/benefit_supermarket.png',
                              validity: 'Valid through 31 Dec 2026',
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 14),
                    if (_showSeif) _buildPerkCard(
                      title: '15% off – Seif Pharmacies',
                      subtitle: 'Health Care • Valid through Jun 2027',
                      imagePath: 'assets/images/benefit_pharmacy.png',
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const BenefitDetailScreen(
                              title: 'Seif Pharmacies',
                              discount: '15% OFF',
                              category: 'Exclusive Perk',
                              imagePath: 'assets/images/benefit_pharmacy.png',
                              validity: 'Valid through 30 Jun 2027',
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                  const SizedBox(height: 24),

                  // Section 2: Company Trips (only on Featured)
                  if (_isFeatured) ...[
                  _buildSectionHeader(AppLocale.tr('ben_section_trips')),
                  const SizedBox(height: 12),
                  if (_serverTrips.isNotEmpty)
                    SizedBox(
                      height: 210,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        itemCount: _serverTrips.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 14),
                        itemBuilder: (context, i) {
                          final t = _serverTrips[i];
                          final remaining = t.totalSeats - t.bookedSeats;
                          return _buildTripCard(
                            title: t.title,
                            subtitle:
                                'Company - subsidized • ${t.price}',
                            imagePath: 'assets/images/benefit_sokhna.png',
                            heroImageUrl: t.imageUrl,
                            capacityText:
                                '${t.bookedSeats}/${t.totalSeats} seats filled',
                            progress: t.totalSeats == 0
                                ? 0.0
                                : t.bookedSeats / t.totalSeats,
                            progressColor: remaining < 5
                                ? const Color(0xFFD97706)
                                : AppColors.statusGreen,
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => TripDetailScreen(
                                    tripId: t.id,
                                    title: t.title,
                                    destination: t.destination,
                                    price: t.price,
                                    originalPrice: t.originalPrice,
                                    date: t.date,
                                    imageUrl: t.imageUrl,
                                    totalSeats: t.totalSeats,
                                    bookedSeats: t.bookedSeats,
                                  ),
                                ),
                              );
                            },
                          );
                        },
                      ),
                    )
                  else
                    SizedBox(
                      height: 210,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        children: [
                          _buildTripCard(
                            title: 'Ain Sokhna Retreat',
                            subtitle: 'Company - subsidized • 500 EGP',
                            imagePath: 'assets/images/benefit_sokhna.png',
                            capacityText: '23/30 seats filled',
                            progress: 23 / 30,
                            progressColor: const Color(0xFFD97706),
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => TripDetailScreen(),
                                ),
                              );
                            },
                          ),
                          const SizedBox(width: 14),
                          _buildTripCard(
                            title: 'Siwa Oasis Escape',
                            subtitle: 'Company - subsidized • 800 EGP',
                            imagePath: 'assets/images/benefit_siwa.png',
                            capacityText: '20/50 seats filled',
                            progress: 20 / 50,
                            progressColor: AppColors.statusGreen,
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => TripDetailScreen(
                                    title: 'Siwa Oasis Escape',
                                    destination: 'Siwa Oasis • Matrouh',
                                    price: 'EGP 800',
                                    originalPrice: 'EGP 2,100',
                                    date: 'Thu – Sat, 12 Nov 2026',
                                    imagePath: 'assets/images/benefit_siwa.png',
                                    totalSeats: 50,
                                    bookedSeats: 20,
                                  ),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 24),
                  ],

                  // Section 3: Expiring Soon (only on Featured)
                  if (_isFeatured) ...[
                  _buildSectionHeader(AppLocale.tr('ben_section_expiring')),
                  const SizedBox(height: 12),
                  _buildPerkCard(
                    title: '5% off – Raya Shop',
                    subtitle: 'Electronics • Valid through Sep 2026',
                    imagePath: 'assets/images/benefit_raya.png',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const BenefitDetailScreen(
                            title: 'Raya Shop',
                            discount: '5% OFF',
                            category: 'Electronics & Mobile',
                            imagePath: 'assets/images/benefit_raya.png',
                            validity: 'Valid through 30 Sep 2026',
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 14),
                  _buildPerkCard(
                    title: '20% off – Flame & Fork',
                    subtitle: 'Restaurants • Valid through Aug 2026',
                    imagePath: 'assets/images/benefit_flame.png',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const BenefitDetailScreen(
                            title: 'Flame & Fork',
                            discount: '20% OFF',
                            category: 'Dining & Restaurants',
                            imagePath: 'assets/images/benefit_flame.png',
                            validity: 'Valid through 31 Aug 2026',
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 32),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool get _isFeatured => _selectedCategoryIndex == 0;
  bool get _showSaudi => _isFeatured || _selectedCategoryIndex == 1;
  bool get _showSeif => _isFeatured || _selectedCategoryIndex == 2;

  List<ServerBenefit> get _serverBenefits {
    final all = BenefitsContent.instance.benefits;
    if (_isFeatured) return all;
    final category = _categories[_selectedCategoryIndex].label;
    return all.where((b) => b.category == category).toList();
  }

  List<ServerTrip> get _serverTrips => BenefitsContent.instance.trips;

  Widget _buildSectionHeader(String title) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: AppTypography.fontBase.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        GestureDetector(
          onTap: () => setState(() => _selectedCategoryIndex = 0),
          child: Text(
            AppLocale.tr('view_all'),
            style: AppTypography.fontBase.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPerkCard({
    required String title,
    required String subtitle,
    required String imagePath,
    String? heroImageUrl,
    required VoidCallback onTap,
  }) {
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
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (heroImageUrl != null)
                Image.network(
                  ApiClient.instance.resolveUrl(heroImageUrl),
                  width: double.infinity,
                  height: 130,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Image.asset(
                    imagePath,
                    width: double.infinity,
                    height: 130,
                    fit: BoxFit.cover,
                  ),
                )
              else
                Image.asset(
                  imagePath,
                  width: double.infinity,
                  height: 130,
                  fit: BoxFit.cover,
                ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
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

  Widget _buildTripCard({
    required String title,
    required String subtitle,
    required String imagePath,
    String? heroImageUrl,
    required String capacityText,
    required double progress,
    required Color progressColor,
    required VoidCallback onTap,
  }) {
    return Container(
      width: 240,
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
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (heroImageUrl != null)
                Image.network(
                  ApiClient.instance.resolveUrl(heroImageUrl),
                  width: 240,
                  height: 110,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Image.asset(
                    imagePath,
                    width: 240,
                    height: 110,
                    fit: BoxFit.cover,
                  ),
                )
              else
                Image.asset(
                  imagePath,
                  width: 240,
                  height: 110,
                  fit: BoxFit.cover,
                ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      capacityText,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: progressColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 4,
                        backgroundColor: const Color(0xFFF3F4F6),
                        valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                      ),
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
}

class _CategoryFilter {
  final String label;
  final IconData icon;

  const _CategoryFilter({
    required this.label,
    required this.icon,
  });
}
