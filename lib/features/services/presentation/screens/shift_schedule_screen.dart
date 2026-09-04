import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class ShiftScheduleScreen extends StatefulWidget {
  const ShiftScheduleScreen({super.key});

  @override
  State<ShiftScheduleScreen> createState() => _ShiftScheduleScreenState();
}

class _ShiftScheduleScreenState extends State<ShiftScheduleScreen> {
  List<_DayShift>? _serverDays;

  @override
  void initState() {
    super.initState();
    _loadRoster();
  }

  /// HR-published roster for the current week; generated pattern otherwise.
  Future<void> _loadRoster() async {
    final days = await Backend.instance.fetchRoster();
    if (!mounted || days == null) return;
    final isAr = AppLocale.instance.isArabic;
    final now = DateTime.now();
    final sunday = now.subtract(Duration(days: now.weekday % 7));
    final dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    final dayNames = isAr ? dayNamesAr : dayNamesEn;

    setState(() {
      _serverDays = List.generate(7, (i) {
        final date = sunday.add(Duration(days: i));
        final shift = days[i]['shift'] as String? ?? 'morning';
        final timeStr = isAr
            ? (days[i]['timeAr'] as String? ?? days[i]['time'] as String? ?? 'عطلة أسبوعية')
            : (days[i]['time'] as String? ?? 'Rest Day');
        final nameStr = isAr
            ? (days[i]['shiftNameAr'] as String? ?? days[i]['name'] as String? ?? 'الوردية الأولى')
            : (days[i]['name'] as String? ?? 'Morning Shift');

        return _DayShift(
          day: dayNames[i],
          date: DateFormat('d MMM', isAr ? 'ar' : 'en').format(date),
          time: timeStr,
          shiftName: nameStr,
          isConfirmed: shift != 'off',
          isToday: date.year == now.year &&
              date.month == now.month &&
              date.day == now.day,
        );
      });
    });
  }

  /// Work week starting Sunday. Morning shift Sun–Thu, Fri/Sat off duty.
  List<_DayShift> _buildWeek() {
    final isAr = AppLocale.instance.isArabic;
    final now = DateTime.now();
    final sunday = now.subtract(Duration(days: now.weekday % 7));
    final dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    final dayNames = isAr ? dayNamesAr : dayNamesEn;

    return List.generate(7, (i) {
      final date = sunday.add(Duration(days: i));
      final isRestDay = i == 5 || i == 6;
      return _DayShift(
        day: dayNames[i],
        date: DateFormat('d MMM', isAr ? 'ar' : 'en').format(date),
        time: isRestDay
            ? (isAr ? 'عطلة أسبوعية' : 'Rest Day')
            : (isAr ? '07:00 ص – 03:00 م' : '07:00 AM – 03:00 PM'),
        shiftName: isRestDay
            ? (isAr ? 'يوم راحة' : 'Off Duty')
            : (isAr ? 'الوردية الأولى' : 'Morning Shift'),
        isConfirmed: !isRestDay,
        isToday: date.year == now.year &&
            date.month == now.month &&
            date.day == now.day,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final days = _serverDays ?? _buildWeek();
    final weekStart = days.first.date;
    final weekEnd = days.last.date;

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
          AppLocale.tr('shift_schedule'),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: SafeArea(
        child: ListView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              '${AppLocale.tr('shift_week_of')} $weekStart – $weekEnd ${DateTime.now().year}',
              style: AppTypography.welcomeTitle.copyWith(fontSize: 18),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildLegendItem(
                    color: AppColors.primary, label: AppLocale.tr('shift_confirmed')),
                const SizedBox(width: 16),
                _buildLegendItem(
                    color: AppColors.textSecondary,
                    label: AppLocale.tr('shift_rest_day')),
              ],
            ),
            const SizedBox(height: 16),
            ...days.map((d) => _buildShiftCard(d)),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendItem({required Color color, required String label}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: AppTypography.fontBase.copyWith(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildShiftCard(_DayShift shift) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: shift.isToday ? AppColors.shiftBg : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          children: [
            if (shift.isToday)
              Container(
                width: 4,
                color: AppColors.primary,
              ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    SizedBox(
                      width: 50,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            shift.day,
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: shift.isToday ? AppColors.primary : AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            shift.date,
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 11,
                              color: shift.isToday ? AppColors.primary : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            shift.time,
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            shift.shiftName,
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 12,
                              color: shift.isToday ? AppColors.primary : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: shift.isConfirmed ? AppColors.primary : AppColors.textSecondary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DayShift {
  final String day;
  final String date;
  final String time;
  final String shiftName;
  final bool isConfirmed;
  final bool isToday;

  const _DayShift({
    required this.day,
    required this.date,
    required this.time,
    required this.shiftName,
    required this.isConfirmed,
    this.isToday = false,
  });
}
