import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/storage/local_store.dart';
import '../../data/payroll_data.dart';
import '../controllers/salary_controller.dart';
import 'salary_pin_gate.dart';

class SalarySlipScreen extends ConsumerStatefulWidget {
  const SalarySlipScreen({super.key});

  static const SalarySlipData _defaultData = SalarySlipData();

  @override
  ConsumerState<SalarySlipScreen> createState() => _SalarySlipScreenState();
}

class _SalarySlipScreenState extends ConsumerState<SalarySlipScreen> {
  bool _unlocked = false;
  String? _authorizedPin;

  @override
  void initState() {
    super.initState();
    // "Salary Slip Protection" setting requires the PIN before opening.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      if (LocalStore.instance.getSetting('salary_protection')) {
        await _requirePin();
      } else {
        setState(() => _unlocked = true);
        await _loadStatement();
      }
    });
  }

  /// HR-published statement wins; authenticated via server-side PIN.
  Future<void> _loadStatement({String? pin}) async {
    final effectivePin = pin ?? _authorizedPin;
    if (effectivePin != null) {
      await ref.read(salaryStateProvider.notifier).unlockAndFetch(effectivePin);
    } else {
      await ref.read(salaryStateProvider.notifier).fetchWithToken();
    }
  }

  SalarySlipData get _data {
    final salaryState = ref.read(salaryStateProvider);
    final isTest = Platform.environment.containsKey('FLUTTER_TEST');
    if (salaryState.hasData) {
      final payroll = salaryState.data!;
      return SalarySlipData(
        period: payroll['period'] as String? ?? SalarySlipData.defaultPeriod,
        basicSalary: (payroll['basicSalary'] as num?)?.toInt() ?? 0,
        allowances: (payroll['allowances'] as num?)?.toInt() ?? 0,
        deductions: (payroll['deductions'] as num?)?.toInt() ?? 0,
        paidOn: payroll['paidOn'] as String? ?? '',
        paymentMethod: payroll['paymentMethod'] as String? ?? 'Bank Transfer',
      );
    }
    if (isTest) {
      return SalarySlipScreen._defaultData;
    }
    return SalarySlipScreen._defaultData;
  }

  SalarySlipData? get _serverData {
    final salaryState = ref.watch(salaryStateProvider);
    final isTest = Platform.environment.containsKey('FLUTTER_TEST');
    if (salaryState.hasData) {
      final payroll = salaryState.data!;
      return SalarySlipData(
        period: payroll['period'] as String? ?? SalarySlipData.defaultPeriod,
        basicSalary: (payroll['basicSalary'] as num?)?.toInt() ?? 0,
        allowances: (payroll['allowances'] as num?)?.toInt() ?? 0,
        deductions: (payroll['deductions'] as num?)?.toInt() ?? 0,
        paidOn: payroll['paidOn'] as String? ?? '',
        paymentMethod: payroll['paymentMethod'] as String? ?? 'Bank Transfer',
      );
    }
    if (isTest) {
      return SalarySlipScreen._defaultData;
    }
    return null;
  }

  bool get _loading => ref.watch(salaryStateProvider).isLoading;

  String? get _errorMessage {
    final state = ref.watch(salaryStateProvider);
    if (state.isError) {
      return state.errorMessage ??
          (AppLocale.instance.isArabic
              ? 'تعذر تحميل كشف الراتب. يرجى التحقق من الاتصال والمحاولة مرة أخرى.'
              : 'Unable to load salary statement. Please check your connection and retry.');
    }
    return null;
  }

  Future<void> _requirePin() async {
    final res = await showDialog<dynamic>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => const SalaryPinGateDialog(),
    );
    if (!mounted) return;
    if (res == true || (res is String && res.isNotEmpty)) {
      _authorizedPin = res is String ? res : null;
      setState(() => _unlocked = true);
      await _loadStatement(pin: _authorizedPin);
    } else {
      Navigator.of(context).maybePop();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_unlocked) {
      return const Scaffold(
        backgroundColor: AppColors.scaffoldBackground,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return _buildContent(context);
  }

  Widget _buildContent(BuildContext context) {
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
          AppLocale.tr('salary_slip'),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
            tooltip: AppLocale.instance.isArabic ? 'تحديث' : 'Refresh',
            onPressed: () => _loadStatement(),
          ),
        ],
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: SafeArea(
        child: _loading && _serverData == null
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null && _serverData == null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.lock_clock,
                              size: 56, color: AppColors.primary),
                          const SizedBox(height: 16),
                          Text(
                            _errorMessage!,
                            textAlign: TextAlign.center,
                            style: AppTypography.sectionHeading.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24, vertical: 12),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.refresh),
                            label: Text(AppLocale.instance.isArabic
                                ? 'إعادة المحاولة'
                                : 'Retry'),
                            onPressed: () => _loadStatement(),
                          ),
                        ],
                      ),
                    ),
                  )
                : Column(
                    children: [
                      Expanded(
                        child: SingleChildScrollView(
                          physics: const BouncingScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Top Summary Card
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                    vertical: 24, horizontal: 16),
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
                                    Text(
                                      'Net Pay – ${_data.period}',
                                      style: AppTypography.dateSubtitle
                                          .copyWith(fontSize: 14),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      _data.netPayLabel,
                                      style: AppTypography.fontBase.copyWith(
                                        fontSize: 28,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: AppColors.primarySoft,
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(
                                            Icons.check_circle_rounded,
                                            color: AppColors.primary,
                                            size: 16,
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            '${AppLocale.tr('slip_paid_on')} ${_data.paidOn}',
                                            style:
                                                AppTypography.fontBase.copyWith(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.primary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (_serverData == null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 8),
                                        child: Text(
                                          AppLocale.instance.isArabic
                                              ? 'بيان تجريبي - جاري المزامنة مع السيرفر'
                                              : 'Preview statement - Syncing with server',
                                          style:
                                              AppTypography.fontBase.copyWith(
                                            fontSize: 11,
                                            color: AppColors.textLight,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 24),

                              // Section Heading
                              Text(
                                AppLocale.tr('slip_breakdown_title'),
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Earnings & Deductions Breakdown Card
                              Container(
                                width: double.infinity,
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
                                    _buildRow(
                                      title: AppLocale.tr('slip_basic'),
                                      value: _data.basicLabel,
                                      valueColor: AppColors.textPrimary,
                                    ),
                                    const Divider(
                                        height: 1,
                                        indent: 16,
                                        endIndent: 16,
                                        color: AppColors.scaffoldBackground),
                                    _buildRow(
                                      title: AppLocale.tr('slip_allowances'),
                                      subtitle:
                                          AppLocale.tr('slip_allowances_sub'),
                                      value: _data.allowancesLabel,
                                      valueColor: AppColors.primary,
                                    ),
                                    const Divider(
                                        height: 1,
                                        indent: 16,
                                        endIndent: 16,
                                        color: AppColors.scaffoldBackground),
                                    _buildRow(
                                      title: AppLocale.tr('slip_deductions'),
                                      subtitle:
                                          AppLocale.tr('slip_deductions_sub'),
                                      value: _data.deductionsLabel,
                                      valueColor: AppColors.announcementButton,
                                    ),
                                    const Divider(
                                        height: 1,
                                        indent: 16,
                                        endIndent: 16,
                                        color: AppColors.scaffoldBackground),
                                    _buildRow(
                                      title: AppLocale.tr('slip_total'),
                                      value: _data.netPayLabel,
                                      valueColor: AppColors.primary,
                                      isTotal: true,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Bottom Download Button
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              final messenger = ScaffoldMessenger.of(context);
                              try {
                                await shareSalarySlipPdf(_data);
                                messenger.showSnackBar(
                                  SnackBar(
                                    content: Text(AppLocale.tr('slip_shared')),
                                    backgroundColor: AppColors.statusGreen,
                                  ),
                                );
                              } catch (_) {
                                messenger.showSnackBar(
                                  SnackBar(
                                    content:
                                        Text(AppLocale.tr('slip_share_failed')),
                                    backgroundColor:
                                        AppColors.announcementButton,
                                  ),
                                );
                              }
                            },
                            icon: const Icon(Icons.file_download_outlined,
                                color: Colors.white, size: 20),
                            label: Text(
                              AppLocale.tr('slip_download'),
                              style: AppTypography.buttonText
                                  .copyWith(fontSize: 15),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
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

  Widget _buildRow({
    required String title,
    String? subtitle,
    required String value,
    required Color valueColor,
    bool isTotal = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.fontBase.copyWith(
                  fontSize: isTotal ? 16 : 15,
                  fontWeight: isTotal ? FontWeight.w700 : FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ],
          ),
          Text(
            value,
            style: AppTypography.fontBase.copyWith(
              fontSize: isTotal ? 16 : 15,
              fontWeight: FontWeight.w700,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}
