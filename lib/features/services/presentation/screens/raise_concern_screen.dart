import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_typography.dart';

import '../../../../core/network/backend.dart';
import '../../../../core/storage/local_store.dart';

class RaiseConcernScreen extends StatefulWidget {
  const RaiseConcernScreen({super.key});

  @override
  State<RaiseConcernScreen> createState() => _RaiseConcernScreenState();
}

class _RaiseConcernScreenState extends State<RaiseConcernScreen> {
  String _selectedCategory = 'Workplace Environment';
  final TextEditingController _detailsController = TextEditingController();
  bool _submitting = false;

  final List<String> _categories = [
    'Workplace Environment',
    'Safety & Health',
    'Fair Treatment',
    'Equipment & Maintenance',
    'Other Concerns',
  ];

  @override
  void initState() {
    super.initState();
    final draft = LocalStore.instance.getDraft('raise_concern');
    if (draft != null) {
      if (draft['category'] is String && _categories.contains(draft['category'])) {
        _selectedCategory = draft['category'] as String;
      }
      if (draft['details'] is String) {
        _detailsController.text = draft['details'] as String;
      }
    }
    _detailsController.addListener(_onTextChanged);
  }

  void _onTextChanged() {
    LocalStore.instance.saveDraft('raise_concern', {
      'category': _selectedCategory,
      'details': _detailsController.text,
    });
  }

  @override
  void dispose() {
    _detailsController.removeListener(_onTextChanged);
    _detailsController.dispose();
    super.dispose();
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
          AppLocale.tr('raise_concern'),
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
                    // Anonymous Banner
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.shiftBg,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.shield_outlined,
                            color: AppColors.primary,
                            size: 24,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'This is fully anonymous',
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Your identity will not be shared with anyone unless you choose to disclose it in your report. We take your privacy seriously.',
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 12,
                                    color: AppColors.shiftTextBlue,
                                    height: 1.35,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Main Card
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
                          // Select Category
                          Text(
                            'Select a Category',
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
                                value: _selectedCategory,
                                isExpanded: true,
                                icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.textSecondary),
                                items: _categories.map((cat) {
                                  return DropdownMenuItem(
                                    value: cat,
                                    child: Text(
                                      cat,
                                      style: AppTypography.fontBase.copyWith(
                                        fontSize: 14,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) setState(() => _selectedCategory = val);
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Concern Details
                          Text(
                            'Concern Details',
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
                              hintText: "Add any details you'd like to share...",
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
                          const SizedBox(height: 6),
                          Text(
                            'Do not include identifying information if you wish to remain anonymous.',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Evidence (Optional)
                          Text(
                            'Evidence (Optional)',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 13,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 20),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFFD1D5DB),
                                style: BorderStyle.solid,
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.add_a_photo_outlined,
                                  color: AppColors.primary,
                                  size: 22,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Attach Photo',
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary,
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

            // Submit Anonymously Button
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Text(
                          'Submit Anonymously',
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

  Future<void> _submit() async {
    final details = _detailsController.text.trim();
    if (details.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocale.instance.isArabic
                ? 'يرجى كتابة تفاصيل البلاغ أولاً'
                : 'Please enter details for your report first.',
          ),
          backgroundColor: AppColors.announcementButton,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    try {
      final res = await Backend.instance.submitConcern(
        category: _selectedCategory,
        details: details,
      );
      await LocalStore.instance.clearDraft('raise_concern');
      if (!mounted) return;
      setState(() => _submitting = false);
      final ref = res?['refNumber'] as String?;
      final isAr = AppLocale.instance.isArabic;
      final msg = ref != null
          ? (isAr ? 'تم إرسال بلاغك بنجاح وسرية تامة (رقم: $ref)' : 'Concern submitted securely (Ref: $ref)')
          : AppLocale.tr('concern_success');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: AppColors.primary,
        ),
      );
      Navigator.of(context).maybePop();
    } catch (_) {
      await LocalStore.instance.clearDraft('raise_concern');
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocale.tr('concern_success')),
          backgroundColor: AppColors.primary,
        ),
      );
      Navigator.of(context).maybePop();
    }
  }
}
