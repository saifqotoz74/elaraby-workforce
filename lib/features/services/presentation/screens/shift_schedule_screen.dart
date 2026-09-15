import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/shifts_controller.dart';
import 'package:elaraby_workforce/features/services/data/shift_model.dart';
import 'apply_overtime_sheet.dart';
import 'apply_shift_swap_sheet.dart';

class ShiftScheduleScreen extends ConsumerStatefulWidget {
  const ShiftScheduleScreen({super.key});

  @override
  ConsumerState<ShiftScheduleScreen> createState() => _ShiftScheduleScreenState();
}

class _ShiftScheduleScreenState extends ConsumerState<ShiftScheduleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int _selectedWeekIndex = 1; // Default to current week (index 1 of 4)
  bool _punching = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _handlePunch(String type) async {
    setState(() => _punching = true);
    final success = await ref.read(attendanceProvider.notifier).punch(type);
    if (!mounted) return;
    setState(() => _punching = false);

    final isAr = AppLocale.instance.isArabic;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success
              ? (type == 'in'
                  ? (isAr ? 'تم تسجيل حضورك بنجاح في المصنع!' : 'Punch In recorded successfully!')
                  : (isAr ? 'تم تسجيل انصرافك بنجاح. نتمنى لك راحة سعيدة!' : 'Punch Out recorded successfully!'))
              : (isAr ? 'تعذر تسجيل البصمة. يرجى المحاولة ثانية.' : 'Failed to record punch.'),
        ),
        backgroundColor: success ? AppColors.statusGreen : AppColors.error,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;

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
          AppLocale.tr('shift_schedule', context),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
            tooltip: isAr ? 'تحديث' : 'Refresh',
            onPressed: () {
              ref.read(rosterProvider.notifier).loadRoster();
              ref.read(attendanceProvider.notifier).loadToday();
              ref.read(shiftSwapsProvider.notifier).loadSwaps();
              ref.read(overtimeProvider.notifier).loadClaims();
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelStyle: AppTypography.fontBase.copyWith(
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
          unselectedLabelStyle: AppTypography.fontBase.copyWith(
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
          tabs: [
            Tab(text: AppLocale.tr('tab_roster_calendar', context)),
            Tab(text: AppLocale.tr('tab_attendance_punch', context)),
            Tab(text: AppLocale.tr('tab_swaps_overtime', context)),
          ],
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: [
            _buildRosterCalendarTab(),
            _buildAttendancePunchTab(),
            _buildSwapsAndOvertimeTab(),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // TAB 1: ROSTER CALENDAR
  // =========================================================================
  Widget _buildRosterCalendarTab() {
    final rosterState = ref.watch(rosterProvider);
    final isAr = AppLocale.instance.isArabic;

    return rosterState.when(
      loading: (_) => Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (msg, code, prev) => Center(child: Text(msg)),
      empty: () => const Center(child: Text('No roster schedule available')),
      refreshing: (weeks) => _buildRosterContent(weeks, isAr),
      success: (weeks) => _buildRosterContent(weeks, isAr),
    );
  }

  Widget _buildRosterContent(List<ShiftWeek> weeks, bool isAr) {
    if (weeks.isEmpty) return const SizedBox.shrink();
    if (_selectedWeekIndex >= weeks.length) _selectedWeekIndex = 0;
    final currentWeek = weeks[_selectedWeekIndex];

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => ref.read(rosterProvider.notifier).loadRoster(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.all(16),
        children: [
          // 4-Week Carousel Selector
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                for (int w = 0; w < weeks.length; w++) ...[
                  InkWell(
                    onTap: () => setState(() => _selectedWeekIndex = w),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: _selectedWeekIndex == w ? AppColors.primary : AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _selectedWeekIndex == w
                              ? AppColors.primary
                              : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            weeks[w].isCurrent
                                ? (isAr ? 'الأسبوع الحالي' : 'Current Week')
                                : (isAr ? 'أسبوع ${weeks[w].weekStart}' : 'W: ${weeks[w].weekStart}'),
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: _selectedWeekIndex == w
                                  ? Colors.white
                                  : AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Legend Header
          Row(
            children: [
              _buildLegendDot(color: AppColors.primary, label: isAr ? 'ورديات عمل' : 'Scheduled Shift'),
              const SizedBox(width: 16),
              _buildLegendDot(color: const Color(0xFF94A3B8), label: isAr ? 'عطلة أسبوعية' : 'Rest Day'),
            ],
          ),
          const SizedBox(height: 12),

          // Days List
          for (final shift in currentWeek.days) _buildShiftItemCard(shift, isAr),
        ],
      ),
    );
  }

  Widget _buildLegendDot({required Color color, required String label}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: AppTypography.fontBase.copyWith(fontSize: 12, color: AppColors.textSecondary),
        ),
      ],
    );
  }

  Widget _buildShiftItemCard(WorkShift shift, bool isAr) {
    final now = DateTime.now();
    final isToday = shift.date ==
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isToday ? AppColors.shiftBg : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isToday ? AppColors.primary.withValues(alpha: 0.4) : const Color(0xFFF1F5F9),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Day badge
            SizedBox(
              width: 55,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    shift.localizedDay(isAr),
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: isToday ? AppColors.primary : AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    shift.date,
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 10,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            // Shift details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          shift.localizedName(isAr),
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: shift.isRestDay ? AppColors.textSecondary : AppColors.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (shift.isOverride) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isAr ? 'مُبدلة' : 'Swapped',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: AppColors.statusGreen,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    shift.localizedTime(isAr),
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: shift.isRestDay ? AppColors.textSecondary : AppColors.primary,
                    ),
                  ),
                  Text(
                    '${shift.line} • ${shift.supervisor}',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

            // Swap button (only for non-rest days)
            if (!shift.isRestDay)
              IconButton(
                icon: Icon(Icons.swap_horiz_rounded, color: AppColors.primary),
                tooltip: AppLocale.tr('request_shift_swap', context),
                onPressed: () => ApplyShiftSwapSheet.show(context, shift),
              ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // TAB 2: ATTENDANCE & QR PUNCH
  // =========================================================================
  Widget _buildAttendancePunchTab() {
    final attendanceState = ref.watch(attendanceProvider);
    final isAr = AppLocale.instance.isArabic;

    return attendanceState.when(
      loading: (_) => Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (msg, code, prev) => Center(child: Text(msg)),
      empty: () => const Center(child: Text('No attendance data')),
      refreshing: (data) => _buildAttendanceContent(data, isAr),
      success: (data) => _buildAttendanceContent(data, isAr),
    );
  }

  Widget _buildAttendanceContent(TodayPunchState punch, bool isAr) {
    Color statusBg;
    Color statusColor;
    String statusText;

    switch (punch.status) {
      case 'checked_in':
        statusBg = const Color(0xFFDCFCE7);
        statusColor = AppColors.statusGreen;
        statusText = AppLocale.tr('checked_in_status', context);
        break;
      case 'checked_out':
        statusBg = const Color(0xFFEFF6FF);
        statusColor = AppColors.primary;
        statusText = AppLocale.tr('checked_out_status', context);
        break;
      case 'not_checked_in':
      default:
        statusBg = const Color(0xFFFEF3C7);
        statusColor = const Color(0xFFD97706);
        statusText = AppLocale.tr('not_checked_in_status', context);
        break;
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => ref.read(attendanceProvider.notifier).loadToday(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.all(16),
        children: [
          // Live Status Card
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
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      punch.date,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        statusText,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Punch times summary
                Row(
                  children: [
                    Expanded(
                      child: _buildPunchTimeCol(
                        label: AppLocale.tr('punch_in', context),
                        time: punch.punchInTime ?? '--:--',
                        color: AppColors.statusGreen,
                        icon: Icons.login_rounded,
                      ),
                    ),
                    Container(width: 1, height: 40, color: const Color(0xFFE2E8F0)),
                    Expanded(
                      child: _buildPunchTimeCol(
                        label: AppLocale.tr('punch_out', context),
                        time: punch.punchOutTime ?? '--:--',
                        color: AppColors.primary,
                        icon: Icons.logout_rounded,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Punch Action Button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _punching
                        ? null
                        : () => _handlePunch(punch.status == 'checked_in' ? 'out' : 'in'),
                    icon: _punching
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Icon(
                            punch.status == 'checked_in'
                                ? Icons.logout_rounded
                                : Icons.login_rounded,
                            color: Colors.white,
                          ),
                    label: Text(
                      punch.status == 'checked_in'
                          ? AppLocale.tr('punch_out', context)
                          : AppLocale.tr('punch_in', context),
                      style: AppTypography.buttonText.copyWith(fontSize: 15),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: punch.status == 'checked_in'
                          ? const Color(0xFFDC2626)
                          : AppColors.statusGreen,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Factory Geofence Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.location_on_rounded, color: AppColors.statusGreen, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        AppLocale.tr('geofence_within', context),
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF166534),
                        ),
                      ),
                      Text(
                        punch.factoryName ?? 'مجمع العاشر من رمضان',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 11,
                          color: const Color(0xFF15803D),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Smart Attendance QR Badge
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.qr_code_2_rounded, color: AppColors.primary, size: 22),
                    const SizedBox(width: 8),
                    Text(
                      AppLocale.tr('attendance_qr_title', context),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  AppLocale.tr('attendance_qr_desc', context),
                  textAlign: TextAlign.center,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 16),

                // Simulated QR Box
                Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0), width: 2),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.qr_code_scanner_rounded,
                      size: 90,
                      color: AppColors.primary.withValues(alpha: 0.8),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Rotating token string
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'TOKEN: ${punch.qrToken.length > 20 ? punch.qrToken.substring(0, 20) : punch.qrToken}...',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Offline Token Box (For Low-reception metal hangars)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Icon(Icons.offline_bolt_outlined, color: AppColors.primary, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        AppLocale.tr('offline_token_badge', context),
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        punch.offlineToken,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 18, color: AppColors.textSecondary),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: punch.offlineToken));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(isAr ? 'تم نسخ الرمز' : 'Token copied')),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPunchTimeCol({
    required String label,
    required String time,
    required Color color,
    required IconData icon,
  }) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: AppTypography.fontBase.copyWith(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          time,
          style: AppTypography.fontBase.copyWith(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }

  // =========================================================================
  // TAB 3: SWAPS & OVERTIME OPERATIONS
  // =========================================================================
  Widget _buildSwapsAndOvertimeTab() {
    final swapsState = ref.watch(shiftSwapsProvider);
    final overtimeState = ref.watch(overtimeProvider);
    final isAr = AppLocale.instance.isArabic;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async {
        await ref.read(shiftSwapsProvider.notifier).loadSwaps();
        await ref.read(overtimeProvider.notifier).loadClaims();
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.all(16),
        children: [
          // Section: Shift Swaps
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isAr ? 'طلبات تبديل الورديات' : 'Shift Swap Requests',
                style: AppTypography.welcomeTitle.copyWith(fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 8),

          swapsState.when(
            loading: (_) => Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            ),
            error: (msg, code, prev) => Center(child: Text(msg)),
            empty: () => _buildEmptyCard(isAr ? 'لا توجد طلبات تبديل حالية' : 'No shift swap requests'),
            refreshing: (swaps) => _buildSwapsList(swaps, isAr),
            success: (swaps) => _buildSwapsList(swaps, isAr),
          ),
          const SizedBox(height: 24),

          // Section: Overtime
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isAr ? 'ساعات العمل الإضافي (OT)' : 'Overtime Claims (OT)',
                style: AppTypography.welcomeTitle.copyWith(fontSize: 16),
              ),
              ElevatedButton.icon(
                onPressed: () {
                  final today = DateTime.now();
                  final dateStr =
                      '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
                  ApplyOvertimeSheet.show(context, initialDate: dateStr);
                },
                icon: const Icon(Icons.add, size: 16, color: Colors.white),
                label: Text(
                  isAr ? 'تسجيل إضافي' : 'Claim OT',
                  style: AppTypography.buttonText.copyWith(fontSize: 12),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          overtimeState.when(
            loading: (_) => Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            ),
            error: (msg, code, prev) => Center(child: Text(msg)),
            empty: () => _buildEmptyCard(isAr ? 'لا توجد ساعات عمل إضافي مسجلة' : 'No overtime claims yet'),
            refreshing: (claims) => _buildOvertimeList(claims, isAr),
            success: (claims) => _buildOvertimeList(claims, isAr),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyCard(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Center(
        child: Text(
          message,
          style: AppTypography.fontBase.copyWith(fontSize: 13, color: AppColors.textSecondary),
        ),
      ),
    );
  }

  Widget _buildSwapsList(List<ShiftSwapRequest> swaps, bool isAr) {
    if (swaps.isEmpty) {
      return _buildEmptyCard(isAr ? 'لا توجد طلبات تبديل حالية' : 'No shift swap requests');
    }

    return Column(
      children: [
        for (final swap in swaps) _buildSwapCard(swap, isAr),
      ],
    );
  }

  Widget _buildSwapCard(ShiftSwapRequest swap, bool isAr) {
    Color statusBg;
    Color statusColor;
    String statusLabel;

    switch (swap.status) {
      case 'approved':
        statusBg = const Color(0xFFDCFCE7);
        statusColor = AppColors.statusGreen;
        statusLabel = AppLocale.tr('swap_approved', context);
        break;
      case 'declined_by_colleague':
      case 'rejected_by_supervisor':
        statusBg = const Color(0xFFFEE2E2);
        statusColor = AppColors.error;
        statusLabel = AppLocale.tr('swap_declined', context);
        break;
      case 'supervisor_pending':
        statusBg = const Color(0xFFDBEAFE);
        statusColor = AppColors.primary;
        statusLabel = AppLocale.tr('swap_pending_supervisor', context);
        break;
      case 'colleague_pending':
      default:
        statusBg = const Color(0xFFFEF3C7);
        statusColor = const Color(0xFFD97706);
        statusLabel = AppLocale.tr('swap_pending_colleague', context);
        break;
    }

    final isIncoming = swap.targetEmployeeId == 'emp_1'; // Assuming current demo user

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${swap.date} (${swap.myShiftName} ↔ ${swap.targetShiftName})',
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  statusLabel,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${swap.requesterName} ↔ ${swap.targetEmployeeName}',
            style: AppTypography.fontBase.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            ),
          ),
          if (swap.reason.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '${isAr ? 'السبب' : 'Reason'}: ${swap.reason}',
              style: AppTypography.fontBase.copyWith(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ],

          // Peer Action buttons for incoming requests
          if (isIncoming && swap.status == 'colleague_pending') ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      await ref
                          .read(shiftSwapsProvider.notifier)
                          .respondSwap(swap.id, 'accept');
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.statusGreen,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: Text(
                      AppLocale.tr('accept_swap', context),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      await ref
                          .read(shiftSwapsProvider.notifier)
                          .respondSwap(swap.id, 'decline');
                    },
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.error),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: Text(
                      AppLocale.tr('decline_swap', context),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.error,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildOvertimeList(List<OvertimeClaim> claims, bool isAr) {
    if (claims.isEmpty) {
      return _buildEmptyCard(isAr ? 'لا توجد ساعات عمل إضافي مسجلة' : 'No overtime claims yet');
    }

    return Column(
      children: [
        for (final claim in claims) ...[
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '${claim.date} • ${claim.hours} ${isAr ? 'ساعات' : 'hrs'}',
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${(claim.multiplier * 100).toInt()}%',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      claim.reason,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '+${claim.totalAmount} EGP',
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.statusGreen,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      claim.status == 'approved'
                          ? (isAr ? 'معتمد' : 'Approved')
                          : (isAr ? 'قيد المراجعة' : 'In Review'),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: claim.status == 'approved'
                            ? AppColors.statusGreen
                            : const Color(0xFFD97706),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
