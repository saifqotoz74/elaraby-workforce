import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class EmployeeDataScreen extends StatefulWidget {
  const EmployeeDataScreen({super.key});

  @override
  State<EmployeeDataScreen> createState() => _EmployeeDataScreenState();
}

class _EmployeeDataScreenState extends State<EmployeeDataScreen> {
  EmployeeProfile get _profile => LocalStore.instance.profile;

  Future<void> _save(EmployeeProfile updated) async {
    await LocalStore.instance.saveProfile(updated);
    setState(() {});
  }

  void _showEditSheet(String fieldTitle, String currentValue, ValueChanged<String> onSaved) {
    final controller = TextEditingController(text: currentValue);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE5E7EB),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  '${AppLocale.tr('emp_edit_title')}: $fieldTitle',
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  AppLocale.tr('emp_edit_note'),
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: controller,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: fieldTitle,
                    labelStyle: const TextStyle(color: AppColors.primary),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      final newVal = controller.text.trim();
                      if (newVal.isNotEmpty) {
                        onSaved(newVal);
                        Navigator.of(ctx).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(AppLocale.tr('emp_saved')),
                            backgroundColor: AppColors.statusGreen,
                          ),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      AppLocale.tr('common_save'),
                      style: AppTypography.buttonText.copyWith(fontSize: 14),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        );
      },
    );
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
          AppLocale.tr('emp_data_title'),
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
            // Section 1: Personal Information
            _buildSectionHeader(AppLocale.tr('emp_personal_info')),
            const SizedBox(height: 8),
            Container(
              decoration: _cardDecoration(),
              child: Column(
                children: [
                  _buildDataField(
                    label: AppLocale.tr('emp_name'),
                    value: _profile.name,
                    hasEdit: true,
                    onEdit: () {
                      _showEditSheet(
                        AppLocale.tr('emp_name'),
                        _profile.name,
                        (v) => _save(_profile.copyWith(name: v)),
                      );
                    },
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(label: AppLocale.tr('emp_code'), value: _profile.employeeCode),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(label: 'National ID', value: '290101•••••92'),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(
                    label: AppLocale.tr('emp_phone'),
                    value: _profile.phone,
                    hasEdit: true,
                    onEdit: () {
                      _showEditSheet(
                        AppLocale.tr('emp_phone'),
                        _profile.phone,
                        (v) => _save(_profile.copyWith(phone: v)),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Section 2: Work Information
            _buildSectionHeader(AppLocale.tr('emp_work_info')),
            const SizedBox(height: 8),
            Container(
              decoration: _cardDecoration(),
              child: Column(
                children: [
                  _buildDataField(label: AppLocale.tr('factory_label'), value: _profile.factory),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(label: AppLocale.tr('dept_label'), value: _profile.department),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(label: AppLocale.tr('emp_position'), value: _profile.position),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(label: 'Work Line', value: 'Production Line A'),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(label: 'Shift', value: 'Morning Shift'),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(label: 'Joining Date', value: '14 Mar 2024'),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(label: AppLocale.tr('emp_supervisor'), value: _profile.supervisor),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Section 3: Emergency Contact
            _buildSectionHeader(AppLocale.tr('emp_emergency')),
            const SizedBox(height: 8),
            Container(
              decoration: _cardDecoration(),
              child: Column(
                children: [
                  _buildDataField(
                    label: AppLocale.tr('emp_name'),
                    value: _profile.emergencyName,
                    hasEdit: true,
                    onEdit: () {
                      _showEditSheet(
                        AppLocale.tr('emp_emergency'),
                        _profile.emergencyName,
                        (v) => _save(_profile.copyWith(emergencyName: v)),
                      );
                    },
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(
                    label: AppLocale.tr('emp_relationship'),
                    value: _profile.emergencyRelationship,
                    hasEdit: true,
                    onEdit: () {
                      _showEditSheet(
                        AppLocale.tr('emp_relationship'),
                        _profile.emergencyRelationship,
                        (v) => _save(_profile.copyWith(emergencyRelationship: v)),
                      );
                    },
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                  _buildDataField(
                    label: AppLocale.tr('emp_phone'),
                    value: _profile.emergencyContact,
                    hasEdit: true,
                    onEdit: () {
                      _showEditSheet(
                        AppLocale.tr('emp_emergency'),
                        _profile.emergencyContact,
                        (v) => _save(_profile.copyWith(emergencyContact: v)),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Info Note at Bottom
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.shiftBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_rounded, color: AppColors.primary, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      AppLocale.tr('emp_hr_only'),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 13,
                        color: AppColors.shiftTextBlue,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  BoxDecoration _cardDecoration() {
    return BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      boxShadow: const [
        BoxShadow(
          color: Color(0x06000000),
          blurRadius: 6,
          offset: Offset(0, 2),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: AppTypography.fontBase.copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
      ),
    );
  }

  Widget _buildDataField({
    required String label,
    required String value,
    bool hasEdit = false,
    VoidCallback? onEdit,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTypography.fontBase.copyWith(
                  fontSize: 12,
                  color: AppColors.shiftTextBlue,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: AppTypography.fontBase.copyWith(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          if (hasEdit)
            IconButton(
              icon: const Icon(Icons.edit_note_rounded, color: AppColors.primary, size: 24),
              onPressed: onEdit,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }
}
