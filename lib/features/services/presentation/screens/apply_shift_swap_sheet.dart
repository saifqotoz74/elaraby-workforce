import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/shifts_controller.dart';
import 'package:elaraby_workforce/features/services/data/shift_model.dart';

class ApplyShiftSwapSheet extends ConsumerStatefulWidget {
  final WorkShift shift;

  const ApplyShiftSwapSheet({super.key, required this.shift});

  static Future<bool?> show(BuildContext context, WorkShift shift) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ApplyShiftSwapSheet(shift: shift),
    );
  }

  @override
  ConsumerState<ApplyShiftSwapSheet> createState() => _ApplyShiftSwapSheetState();
}

class _ApplyShiftSwapSheetState extends ConsumerState<ApplyShiftSwapSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _reasonCtrl = TextEditingController();
  List<ShiftSwapColleague> _colleagues = [];
  bool _loadingColleagues = true;
  ShiftSwapColleague? _selectedColleague;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadColleagues();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadColleagues() async {
    setState(() => _loadingColleagues = true);
    final list = await Backend.instance.fetchSwapColleagues(widget.shift.date);
    if (mounted) {
      setState(() {
        _colleagues = list ?? [];
        _loadingColleagues = false;
      });
    }
  }

  Future<void> _submit() async {
    if (_selectedColleague == null) return;
    setState(() => _submitting = true);

    final success = await ref.read(shiftSwapsProvider.notifier).createSwap(
          targetEmployeeId: _selectedColleague!.id,
          date: widget.shift.date,
          reason: _reasonCtrl.text.trim().isEmpty ? null : _reasonCtrl.text.trim(),
        );

    if (!mounted) return;
    setState(() => _submitting = false);

    if (success) {
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocale.instance.isArabic
              ? 'تم إرسال طلب التبديل للزميل بنجاح. في انتظار موافقته.'
              : 'Swap request sent to colleague. Waiting for their approval.'),
          backgroundColor: AppColors.statusGreen,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocale.instance.isArabic
              ? 'تعذر إرسال الطلب. يرجى التحقق من اتصال الشبكة.'
              : 'Failed to submit swap request. Please check network connection.'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    final query = _searchCtrl.text.toLowerCase().trim();
    final filtered = _colleagues.where((c) {
      if (query.isEmpty) return true;
      return c.name.toLowerCase().contains(query) ||
          c.employeeCode.toLowerCase().contains(query) ||
          c.position.toLowerCase().contains(query);
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 16,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppLocale.tr('request_shift_swap', context),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 18),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Target shift chip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.shiftBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.event_outlined, size: 16, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  '${widget.shift.date} (${widget.shift.localizedDay(isAr)}) — ${widget.shift.localizedName(isAr)}',
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            AppLocale.tr('select_colleague', context),
            style: AppTypography.fontBase.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          // Search input
          TextField(
            controller: _searchCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: isAr ? 'بحث بالاسم أو الرقم الوظيفي...' : 'Search by name or code...',
              prefixIcon: const Icon(Icons.search, size: 20, color: AppColors.textSecondary),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Colleagues list
          Expanded(
            child: _loadingColleagues
                ? Center(child: CircularProgressIndicator(color: AppColors.primary))
                : filtered.isEmpty
                    ? Center(
                        child: Text(
                          isAr ? 'لا يوجد زملاء متاحين في نفس الخط' : 'No eligible line colleagues found',
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      )
                    : ListView.separated(
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (ctx, i) {
                          final colleague = filtered[i];
                          final isSelected = _selectedColleague?.id == colleague.id;
                          final isEligible = colleague.isEligible;

                          return InkWell(
                            onTap: isEligible
                                ? () {
                                    setState(() {
                                      _selectedColleague = isSelected ? null : colleague;
                                    });
                                  }
                                : null,
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppColors.primary.withValues(alpha: 0.06)
                                    : (isEligible ? const Color(0xFFF8FAFC) : const Color(0xFFF1F5F9)),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected
                                      ? AppColors.primary
                                      : (isEligible ? const Color(0xFFE2E8F0) : const Color(0xFFCBD5E1)),
                                  width: isSelected ? 1.5 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 20,
                                    backgroundColor: isEligible ? AppColors.shiftBg : const Color(0xFFE2E8F0),
                                    child: Icon(
                                      Icons.person,
                                      size: 20,
                                      color: isEligible ? AppColors.primary : AppColors.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          colleague.name,
                                          style: AppTypography.fontBase.copyWith(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            color: isEligible ? AppColors.textPrimary : AppColors.textSecondary,
                                          ),
                                        ),
                                        Text(
                                          '${colleague.position} • ${colleague.employeeCode}',
                                          style: AppTypography.fontBase.copyWith(
                                            fontSize: 11,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          isAr
                                            ? 'الوردية المجدولة: ${colleague.currentShiftNameAr}'
                                            : 'Current shift: ${colleague.currentShiftName}',
                                          style: AppTypography.fontBase.copyWith(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: isEligible ? AppColors.primary : AppColors.error,
                                          ),
                                        ),
                                        if (!isEligible) ...[
                                          const SizedBox(height: 2),
                                          Text(
                                            AppLocale.tr('fatigue_rule_warning', context),
                                            style: AppTypography.fontBase.copyWith(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w500,
                                              color: AppColors.error,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  if (isSelected)
                                    Icon(Icons.check_circle, color: AppColors.primary, size: 22),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
          const SizedBox(height: 12),
          // Reason input
          TextField(
            controller: _reasonCtrl,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: isAr ? 'سبب طلب التبديل (اختياري)...' : 'Reason for swap (optional)...',
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Submit Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _selectedColleague != null && !_submitting ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      AppLocale.tr('request_shift_swap', context),
                      style: AppTypography.buttonText.copyWith(fontSize: 15),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
