import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/local_store.dart';
import '../../data/benefits_content.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class TripDetailScreen extends StatefulWidget {
  final String title;
  final String destination;
  final String price;
  final String originalPrice;
  final String date;
  final String imagePath;
  final String? imageUrl;
  final String? tripId;
  final int totalSeats;
  final int bookedSeats;
  final List<String>? inclusions;
  final List<TripItineraryStep>? itinerary;

  const TripDetailScreen({
    super.key,
    this.title = 'Ain Sokhna Retreat',
    this.destination = 'Ain Sokhna • Red Sea',
    this.price = 'EGP 500',
    this.originalPrice = 'EGP 1,200',
    this.date = 'Friday, 24 Oct 2026',
    this.imagePath = 'assets/images/benefit_sokhna.png',
    this.imageUrl,
    this.tripId,
    this.totalSeats = 30,
    this.bookedSeats = 23,
    this.inclusions,
    this.itinerary,
  });

  /// Localized defaults resolved lazily (constructor params stay const-safe).
  static List<String> get defaultInclusions => [
        AppLocale.tr('trip_inc_1'),
        AppLocale.tr('trip_inc_2'),
        AppLocale.tr('trip_inc_3'),
        AppLocale.tr('trip_inc_4'),
        AppLocale.tr('trip_inc_5'),
      ];

  static List<TripItineraryStep> get defaultItinerary => [
        TripItineraryStep(time: '06:30 AM', title: AppLocale.tr('trip_step1_t'), desc: AppLocale.tr('trip_step1_d')),
        TripItineraryStep(time: '08:30 AM', title: AppLocale.tr('trip_step2_t'), desc: AppLocale.tr('trip_step2_d')),
        TripItineraryStep(time: '01:30 PM', title: AppLocale.tr('trip_step3_t'), desc: AppLocale.tr('trip_step3_d')),
        TripItineraryStep(time: '05:30 PM', title: AppLocale.tr('trip_step4_t'), desc: AppLocale.tr('trip_step4_d')),
        TripItineraryStep(time: '07:00 PM', title: AppLocale.tr('trip_step5_t'), desc: AppLocale.tr('trip_step5_d')),
      ];

  @override
  State<TripDetailScreen> createState() => _TripDetailScreenState();
}

class _TripDetailScreenState extends State<TripDetailScreen> {
  late int _currentBooked;
  bool _isBooked = false;
  late final String _tripId =
      'trip_${widget.title.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '_')}';

  @override
  void initState() {
    super.initState();
    _isBooked = LocalStore.instance.isTripBooked(_tripId);
    _currentBooked = widget.bookedSeats + (_isBooked ? 1 : 0);
  }

  void _toggleBooking() {
    setState(() {
      if (_isBooked) {
        _isBooked = false;
        _currentBooked--;
        LocalStore.instance.setTripBooked(_tripId, false);
        if (widget.tripId != null) {
          BenefitsContent.instance.bookTrip(widget.tripId!, false);
        }
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocale.tr('trip_cancelled')),
            backgroundColor: AppColors.textSecondary,
          ),
        );
      } else {
        if (_currentBooked < widget.totalSeats) {
          _isBooked = true;
          _currentBooked++;
          LocalStore.instance.setTripBooked(_tripId, true);
          if (widget.tripId != null) {
            BenefitsContent.instance.bookTrip(widget.tripId!, true);
          }
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(AppLocale.tr('trip_confirmed')),
              backgroundColor: AppColors.statusGreen,
            ),
          );
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final availableSeats = widget.totalSeats - _currentBooked;
    final progress = _currentBooked / widget.totalSeats;

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
          AppLocale.tr('trip_details'),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Hero Image Card
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: Stack(
                        children: [
                          widget.imageUrl != null
                              ? Image.network(
                                  ApiClient.instance.resolveUrl(widget.imageUrl!),
                                  width: double.infinity,
                                  height: 200,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Image.asset(
                                    widget.imagePath,
                                    width: double.infinity,
                                    height: 200,
                                    fit: BoxFit.cover,
                                  ),
                                )
                              : Image.asset(
                                  widget.imagePath,
                                  width: double.infinity,
                                  height: 200,
                                  fit: BoxFit.cover,
                                ),
                          Positioned(
                            top: 14,
                            right: 14,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(10),
                                boxShadow: const [
                                  BoxShadow(color: Color(0x20000000), blurRadius: 6),
                                ],
                              ),
                              child: Text(
                                AppLocale.tr('trip_subsidized_badge'),
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Main Title & Pricing Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x06000000),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  widget.title,
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    widget.price,
                                    style: AppTypography.fontBase.copyWith(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  Text(
                                    widget.originalPrice,
                                    style: AppTypography.dateSubtitle.copyWith(
                                      fontSize: 12,
                                      decoration: TextDecoration.lineThrough,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.location_on_outlined, size: 16, color: AppColors.primary),
                              const SizedBox(width: 4),
                              Text(
                                widget.destination,
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(width: 14),
                              const Icon(Icons.calendar_today_outlined, size: 15, color: AppColors.primary),
                              const SizedBox(width: 4),
                              Text(
                                widget.date,
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),

                          // Capacity Progress Bar
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '$_currentBooked ${AppLocale.tr('trip_seats_filled')} ${widget.totalSeats}',
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              Text(
                                '${AppLocale.tr('trip_seats_left')} $availableSeats',
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: availableSeats < 5 ? const Color(0xFFDC2626) : AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: LinearProgressIndicator(
                              value: progress,
                              minHeight: 8,
                              backgroundColor: const Color(0xFFF3F4F6),
                              valueColor: AlwaysStoppedAnimation<Color>(
                                availableSeats < 5 ? const Color(0xFFDC2626) : AppColors.primary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Inclusions
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x06000000),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppLocale.tr('trip_inclusions_title'),
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ...(widget.inclusions ?? TripDetailScreen.defaultInclusions).map(
                            (inc) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.check_circle_rounded, color: AppColors.statusGreen, size: 18),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      inc,
                                      style: AppTypography.fontBase.copyWith(
                                        fontSize: 13,
                                        color: AppColors.textPrimary,
                                        height: 1.35,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Program / Itinerary
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x06000000),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppLocale.tr('trip_itinerary_title'),
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 16),
                          ...(widget.itinerary ?? TripDetailScreen.defaultItinerary).asMap().entries.map((entry) {
                            final i = entry.key;
                            final step = entry.value;
                            final isLast = i == (widget.itinerary ?? TripDetailScreen.defaultItinerary).length - 1;

                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Column(
                                  children: [
                                    Container(
                                      width: 12,
                                      height: 12,
                                      decoration: const BoxDecoration(
                                        color: AppColors.primary,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    if (!isLast)
                                      Container(
                                        width: 2,
                                        height: 48,
                                        color: const Color(0xFFE5E7EB),
                                      ),
                                  ],
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            step.time,
                                            style: AppTypography.fontBase.copyWith(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.primary,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            step.title,
                                            style: AppTypography.fontBase.copyWith(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        step.desc,
                                        style: AppTypography.fontBase.copyWith(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                      const SizedBox(height: 18),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          }),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Bottom Book Action Bar
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x08000000),
                    blurRadius: 10,
                    offset: Offset(0, -4),
                  ),
                ],
              ),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _toggleBooking,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isBooked ? const Color(0xFFFEECEC) : AppColors.primary,
                    foregroundColor: _isBooked ? AppColors.announcementButton : Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    _isBooked
                        ? AppLocale.tr('trip_cancel_booking')
                        : '${AppLocale.tr('trip_book_now')} (${widget.price})',
                    style: AppTypography.buttonText.copyWith(
                      fontSize: 15,
                      color: _isBooked ? AppColors.announcementButton : Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TripItineraryStep {
  final String time;
  final String title;
  final String desc;

  const TripItineraryStep({
    required this.time,
    required this.title,
    required this.desc,
  });
}
