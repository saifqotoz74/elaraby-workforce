import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/navigation/app_navigation.dart';

class KioskQrScreen extends StatefulWidget {
  const KioskQrScreen({super.key});

  @override
  State<KioskQrScreen> createState() => _KioskQrScreenState();
}

class _KioskQrScreenState extends State<KioskQrScreen> {
  final TextEditingController _codeController = TextEditingController();
  bool _submitted = false;
  Timer? _timer;

  void _submit() {
    if (_codeController.text.trim().isEmpty) return;
    
    setState(() {
      _submitted = true;
    });

    _timer = Timer(const Duration(seconds: 2), () {
      if (mounted) {
        AppNavigation.pop(context);
      }
    });
  }

  @override
  void dispose() {
    _codeController.dispose();
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('تسجيل الحضور والانصراف'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: true,
      ),
      body: Center(
        child: Container(
          width: 400,
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: AppColors.cardShadow,
                blurRadius: 16,
                offset: Offset(0, 8),
              )
            ],
          ),
          child: _submitted ? _buildSuccess() : _buildInput(),
        ),
      ),
    );
  }

  Widget _buildInput() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.qr_code_scanner,
          size: 100,
          color: AppColors.primary,
        ),
        const SizedBox(height: 24),
        Text(
          'قم بمسح الباركود أو أدخل كود الموظف',
          style: AppTypography.newsTitle,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        TextField(
          controller: _codeController,
          decoration: InputDecoration(
            hintText: 'أدخل كود الموظف',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            filled: true,
            fillColor: AppColors.background,
          ),
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(
              'تسجيل',
              style: AppTypography.buttonText.copyWith(fontSize: 18),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSuccess() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.check_circle,
            size: 80,
            color: AppColors.success,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'تم التسجيل بنجاح',
          style: AppTypography.sectionHeading.copyWith(color: AppColors.success),
        ),
        const SizedBox(height: 12),
        Text(
          'شكراً لك، يتم العودة للشاشة الرئيسية...',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}
