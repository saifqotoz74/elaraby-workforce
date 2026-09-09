import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/requests_store.dart';

class HrRequestScreen extends StatefulWidget {
  const HrRequestScreen({super.key});

  @override
  State<HrRequestScreen> createState() => _HrRequestScreenState();
}

class _HrRequestScreenState extends State<HrRequestScreen> {
  String _selectedRequestType = 'Salary Certificate';
  final TextEditingController _detailsController = TextEditingController();
  String? _attachedFileName;
  bool _submitting = false;

  final List<String> _types = [
    'Salary Certificate',
    'HR Letter',
    'Experience Certificate',
    'Medical Insurance Inquiry',
  ];

  @override
  void initState() {
    super.initState();
    _loadDraft();
    _detailsController.addListener(_persistDraft);
  }

  @override
  void dispose() {
    _detailsController.removeListener(_persistDraft);
    _detailsController.dispose();
    super.dispose();
  }

  void _loadDraft() {
    final draft = LocalStore.instance.getDraft('hr_request');
    if (draft != null) {
      if (draft['requestType'] is String &&
          _types.contains(draft['requestType'])) {
        _selectedRequestType = draft['requestType'] as String;
      }
      if (draft['details'] is String) {
        _detailsController.text = draft['details'] as String;
      }
    }
  }

  void _persistDraft() {
    LocalStore.instance.saveDraft('hr_request', {
      'requestType': _selectedRequestType,
      'details': _detailsController.text,
    });
  }

  @override
  Widget build(BuildContext context) {
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
          AppLocale.tr('hr_request'),
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
                child: Container(
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
                      // Request Type
                      Text(
                        'Request Type',
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
                            value: _selectedRequestType,
                            isExpanded: true,
                            icon: const Icon(Icons.keyboard_arrow_down,
                                color: AppColors.textSecondary),
                            items: _types.map((type) {
                              return DropdownMenuItem(
                                value: type,
                                child: Text(
                                  type,
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 14,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              );
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setState(() => _selectedRequestType = val);
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Details
                      Text(
                        'Details',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 13,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _detailsController,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: 'Add any details for HR...',
                          hintStyle: AppTypography.fontBase.copyWith(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                          contentPadding: const EdgeInsets.all(14),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide:
                                const BorderSide(color: Color(0xFFE5E7EB)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide:
                                const BorderSide(color: Color(0xFFE5E7EB)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Attach Document Box
                      InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          setState(() {
                            _attachedFileName = _attachedFileName == null
                                ? 'document_${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}.pdf'
                                : null;
                          });
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 24),
                          decoration: BoxDecoration(
                            color: _attachedFileName != null
                                ? AppColors.shiftBg
                                : const Color(0xFFF9FAFB),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _attachedFileName != null
                                  ? AppColors.primary
                                  : const Color(0xFFD1D5DB),
                              style: BorderStyle.solid,
                            ),
                          ),
                          child: Column(
                            children: [
                              Icon(
                                _attachedFileName != null
                                    ? Icons.check_circle_rounded
                                    : Icons.attach_file_rounded,
                                color: _attachedFileName != null
                                    ? AppColors.primary
                                    : AppColors.textPrimary,
                                size: 26,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _attachedFileName ??
                                    'Attach Document (optional)',
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 13,
                                  fontWeight: _attachedFileName != null
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: _attachedFileName != null
                                      ? AppColors.primary
                                      : AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Submit Button
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _submitting
                      ? null
                      : () {
                          if (_submitting) return;
                          setState(() => _submitting = true);

                          RequestsStore.instance.addRequest(
                            EmployeeRequest(
                              id: DateTime.now()
                                  .millisecondsSinceEpoch
                                  .toString(),
                              title: 'HR Request',
                              type: _selectedRequestType,
                              refNumber:
                                  'HR-2026-${LocalStore.instance.nextRefNumber()}',
                              status: RequestStatus.inReview,
                              date: AppLocale.tr('time_just_now'),
                              summary: AppLocale.instance.isArabic
                                  ? 'تم الإرسال • الخطوة القادمة: مراجعة الموارد البشرية'
                                  : 'Submitted • Next: HR Operations Review',
                              reviewer: AppLocale.instance.isArabic
                                  ? 'عمليات الموارد البشرية'
                                  : 'HR Operations',
                              details: {
                                'Request Type': _selectedRequestType,
                                'Requested': AppLocale.tr('time_just_now'),
                                'Details': _detailsController.text.isNotEmpty
                                    ? _detailsController.text
                                    : 'Standard issuance request',
                                if (_attachedFileName != null)
                                  'Attachment': _attachedFileName!,
                              },
                            ),
                          );

                          LocalStore.instance.clearDraft('hr_request');

                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                AppLocale.instance.isArabic
                                    ? 'تم تقديم طلبك للموارد البشرية بنجاح!'
                                    : 'HR Request submitted successfully!',
                              ),
                              backgroundColor: AppColors.primary,
                            ),
                          );
                          Navigator.of(context).maybePop();
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor:
                        AppColors.primary.withValues(alpha: 0.35),
                    foregroundColor: Colors.white,
                    disabledForegroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'Submit Request',
                          style:
                              AppTypography.buttonText.copyWith(fontSize: 15),
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
