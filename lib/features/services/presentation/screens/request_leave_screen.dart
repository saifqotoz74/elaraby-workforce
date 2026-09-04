import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/requests_store.dart';

class RequestLeaveScreen extends StatefulWidget {
  const RequestLeaveScreen({super.key});

  @override
  State<RequestLeaveScreen> createState() => _RequestLeaveScreenState();
}

class _RequestLeaveScreenState extends State<RequestLeaveScreen> {
  String _selectedLeaveType = 'Annual Leave';
  DateTime? _fromDate;
  DateTime? _toDate;
  final TextEditingController _notesController = TextEditingController();

  final List<String> _leaveTypes = [
    'Annual Leave',
    'Sick Leave',
    'Emergency Leave',
    'Unpaid Leave',
  ];

  int get _vacationRemaining => LocalStore.instance.vacationDaysRemaining;

  /// Inclusive day count between the two picked dates.
  int get _estimatedDays {
    if (_fromDate == null || _toDate == null) return 0;
    final diff = _toDate!.difference(_fromDate!).inDays + 1;
    return diff > 0 ? diff : 0;
  }

  bool get _datesValid =>
      _fromDate != null && _toDate != null && _estimatedDays > 0;

  bool get _exceedsBalance =>
      _datesValid && _selectedLeaveType == 'Annual Leave' &&
      _estimatedDays > _vacationRemaining;

  Future<void> _pickDate({required bool isFrom}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom
          ? (_fromDate ?? now)
          : (_toDate ?? _fromDate ?? now),
      firstDate: isFrom ? now : (_fromDate ?? now),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        _fromDate = picked;
        if (_toDate != null && _toDate!.isBefore(picked)) {
          _toDate = null;
        }
      } else {
        _toDate = picked;
      }
    });
  }

  String _formatDate(DateTime date) =>
      DateFormat('dd MMM yyyy').format(date);

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final estimatedDays = _estimatedDays;

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
          AppLocale.tr('request_leave'),
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
                  children: [
                    // Top Available Badge
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.shiftBg,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '$_vacationRemaining ${AppLocale.tr('vac_days_available')}',
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Main Form Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
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
                          // Leave Type
                          Text(
                            AppLocale.tr('leave_type'),
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE5E7EB)),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _selectedLeaveType,
                                isExpanded: true,
                                icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.textSecondary),
                                items: _leaveTypes.map((type) {
                                  return DropdownMenuItem(
                                    value: type,
                                    child: Text(
                                      AppLocale.tr('leave_type_${type.toLowerCase().replaceAll(' ', '_')}'),
                                      style: AppTypography.fontBase.copyWith(
                                        fontSize: 14,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) setState(() => _selectedLeaveType = val);
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Dates: From & To
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      AppLocale.tr('leave_from'),
                                      style: AppTypography.fontBase.copyWith(
                                        fontSize: 13,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    _dateField(
                                      date: _fromDate,
                                      onTap: () => _pickDate(isFrom: true),
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
                                      AppLocale.tr('leave_to'),
                                      style: AppTypography.fontBase.copyWith(
                                        fontSize: 13,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    _dateField(
                                      date: _toDate,
                                      onTap: () => _pickDate(isFrom: false),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Notes
                          Text(
                            AppLocale.tr('leave_notes'),
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 13,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _notesController,
                            maxLines: 4,
                            decoration: InputDecoration(
                              hintText: AppLocale.tr('leave_notes_hint'),
                              hintStyle: AppTypography.fontBase.copyWith(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                              ),
                              contentPadding: const EdgeInsets.all(14),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Estimated Duration Banner
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              color: _exceedsBalance
                                  ? AppColors.announcementBg
                                  : AppColors.shiftBg,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  AppLocale.tr('leave_estimated_duration'),
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                Text(
                                  _exceedsBalance
                                      ? AppLocale.tr('leave_exceeds_balance')
                                      : '$estimatedDays ${AppLocale.tr('vac_days_unit')}',
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: _exceedsBalance
                                        ? AppColors.announcementHeader
                                        : AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Submit Button (enabled only with valid dates)
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _datesValid && !_exceedsBalance ? _submit : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.35),
                    foregroundColor: Colors.white,
                    disabledForegroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    AppLocale.tr('leave_submit'),
                    style: AppTypography.buttonText.copyWith(fontSize: 15),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateField({DateTime? date, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 46,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                date != null ? _formatDate(date) : 'dd/mm/yyyy',
                style: AppTypography.fontBase.copyWith(
                  fontSize: 13,
                  color: date != null
                      ? AppColors.textPrimary
                      : AppColors.textSecondary,
                ),
              ),
            ),
            const Icon(Icons.calendar_today_outlined,
                size: 16, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  void _submit() {
    final ref = 'LEV-2026-${LocalStore.instance.nextRefNumber()}';
    final isAnnual = _selectedLeaveType == 'Annual Leave';

    RequestsStore.instance.addRequest(
      EmployeeRequest(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        title: '${AppLocale.tr('leave_type_${_selectedLeaveType.toLowerCase().replaceAll(' ', '_')}')} — ${AppLocale.tr('request_leave')}',
        type: 'Leave',
        refNumber: ref,
        status: RequestStatus.inReview,
        date: AppLocale.tr('time_just_now'),
        summary: AppLocale.tr('leave_waiting_approval'),
        reviewer: AppLocale.tr('leave_line_manager'),
        details: {
          'leaveType': _selectedLeaveType,
          'days': '$_estimatedDays',
          AppLocale.tr('leave_detail_duration'): '$_estimatedDays ${AppLocale.tr('vac_days_unit')}',
          AppLocale.tr('leave_detail_dates'):
              '${_formatDate(_fromDate!)} – ${_formatDate(_toDate!)}',
          AppLocale.tr('leave_detail_type'): AppLocale.tr(
              'leave_type_${_selectedLeaveType.toLowerCase().replaceAll(' ', '_')}'),
          AppLocale.tr('leave_detail_submitted'): AppLocale.tr('time_just_now'),
        },
      ),
      days: _estimatedDays,
    );

    if (isAnnual) {
      LocalStore.instance.deductVacationDays(_estimatedDays);
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppLocale.tr('leave_success')),
        backgroundColor: AppColors.primary,
      ),
    );
    Navigator.of(context).maybePop();
  }
}
