import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/payroll_data.dart';
import '../controllers/loan_controller.dart';
import '../controllers/salary_controller.dart';
import 'apply_loan_sheet.dart';
import 'salary_pin_gate.dart';

class SalarySlipScreen extends ConsumerStatefulWidget {
  final int initialTabIndex;
  final bool? initialUnlocked;
  const SalarySlipScreen({
    super.key,
    this.initialTabIndex = 0,
    this.initialUnlocked,
  });

  @override
  ConsumerState<SalarySlipScreen> createState() => _SalarySlipScreenState();
}

class _SalarySlipScreenState extends ConsumerState<SalarySlipScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late bool _unlocked;
  String? _authorizedPin;

  @override
  void initState() {
    super.initState();
    _unlocked = widget.initialUnlocked ??
        !LocalStore.instance.getSetting('salary_protection', defaultValue: false);
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 2),
    );

    // Security Gate check
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      if (!_unlocked) {
        await _requirePin();
      } else {
        await _loadStatement();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadStatement({String? pin, bool force = false}) async {
    final effectivePin = pin ?? _authorizedPin;
    if (effectivePin != null) {
      await ref.read(salaryStateProvider.notifier).unlockAndFetch(effectivePin);
    } else {
      if (force || ref.read(salaryStateProvider).isEmpty) {
        await ref.read(salaryStateProvider.notifier).fetchWithToken();
      }
    }
    // Also load loans
    ref.read(loanStateProvider.notifier).loadLoansAndEligibility();
  }

  SalarySlipData? get _serverData {
    final salaryState = ref.watch(salaryStateProvider);
    if (salaryState.hasData) {
      final payroll = salaryState.data!;
      return SalarySlipData.fromJson(payroll);
    }
    return null;
  }

  SalarySlipData get _data => _serverData ?? _fallbackDemoData;

  static final _fallbackDemoData = SalarySlipData(
    period: 'August 2026',
    basicSalary: 8500,
    overtimeAmount: 700,
    transportAllowance: 400,
    mealAllowance: 350,
    incentiveBonus: 850,
    allowances: 2300,
    socialInsurance: 680,
    incomeTax: 210,
    medicalInsurance: 150,
    penalties: 0,
    loanDeduction: 500,
    deductions: 1540,
    paidOn: 'Aug 28, 2026',
    paymentMethod: 'Bank Transfer (CIB)',
  );

  bool get _loading => ref.watch(salaryStateProvider).isLoading;

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
      return Scaffold(
        backgroundColor: AppColors.scaffoldBackground,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

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
          AppLocale.tr('financial_hub_title'),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
            tooltip: AppLocale.instance.isArabic ? 'تحديث' : 'Refresh',
            onPressed: () => _loadStatement(force: true),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: [
            Tab(text: AppLocale.tr('salary_slips_tab')),
            Tab(text: AppLocale.tr('loans_advances_tab')),
            Tab(text: AppLocale.tr('installments_tab')),
          ],
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: [
            _buildSalarySlipTab(context),
            _buildLoansTab(context),
            _buildScheduleTab(context),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // TAB 1: SALARY SLIPS & PDF EXPORT
  // ==========================================
  Widget _buildSalarySlipTab(BuildContext context) {
    final salaryState = ref.watch(salaryStateProvider);
    if (_loading && _serverData == null) {
      return Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (salaryState.isError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 48),
              const SizedBox(height: 16),
              Text(
                salaryState.errorMessage ?? 'Unable to contact payroll server.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => _loadStatement(force: true),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final notifier = ref.read(salaryStateProvider.notifier);
    final availablePeriods = notifier.availablePeriods;
    final selectedPeriod = notifier.selectedPeriod;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Historical Month Pills Selector
          Text(
            AppLocale.tr('historical_statements'),
            style: AppTypography.fontBase.copyWith(
              fontWeight: FontWeight.w600,
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              itemCount: availablePeriods.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final p = availablePeriods[i];
                final isSelected = p == selectedPeriod;
                return InkWell(
                  onTap: () => notifier.selectPeriod(p),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary : AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? AppColors.primary : const Color(0xFFE2E8F0),
                      ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: AppColors.primary.withValues(alpha: 0.25),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              )
                            ]
                          : null,
                    ),
                    child: Text(
                      p,
                      style: TextStyle(
                        color: isSelected ? Colors.white : AppColors.textPrimary,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        fontSize: 12.5,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),

          // Main Net Pay Summary Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0B63B4), Color(0xFF1E40AF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x1A0B63B4),
                  blurRadius: 16,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _data.period,
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _data.paymentMethod,
                        style: const TextStyle(color: Colors.white, fontSize: 11),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  AppLocale.tr('slip_total'),
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _data.netPayLabel,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  convertToArabicWords(_data.netPay),
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
                const SizedBox(height: 16),
                const Divider(color: Colors.white24, height: 1),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildSummaryStat(
                      AppLocale.instance.isArabic ? 'البدلات' : 'Allowances',
                      _data.allowancesLabel,
                      Colors.greenAccent,
                    ),
                    _buildSummaryStat(
                      AppLocale.instance.isArabic ? 'إجمالي المستحق' : 'Gross Pay',
                      '+EGP ${SalarySlipData.format(_data.basicSalary + _data.allowances)}',
                      Colors.white,
                    ),
                    _buildSummaryStat(
                      AppLocale.instance.isArabic ? 'تاريخ الصرف' : 'Paid On',
                      _data.paidOn,
                      Colors.white,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Download PDF Action Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.surface,
                foregroundColor: AppColors.primary,
                elevation: 0,
                side: BorderSide(color: AppColors.primary, width: 1.2),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 20),
              label: Text(
                AppLocale.tr('slip_download'),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              onPressed: () => shareSalarySlipPdf(_data),
            ),
          ),
          const SizedBox(height: 20),

          // Itemized Earnings Card
          _buildItemizedCard(
            title: AppLocale.tr('earnings_title'),
            headerColor: const Color(0xFFEBF5FF),
            titleColor: const Color(0xFF0B63B4),
            icon: Icons.add_circle_outline,
            items: [
              {'label': 'الراتب الأساسي', 'value': _data.basicLabel},
              {'label': AppLocale.tr('transport_allowance'), 'value': _data.transportLabel},
              {'label': AppLocale.tr('meal_allowance'), 'value': _data.mealLabel},
              {'label': AppLocale.tr('production_incentive'), 'value': _data.incentiveLabel},
              {'label': AppLocale.tr('overtime_pay'), 'value': _data.overtimeLabel},
            ],
            totalLabel: 'إجمالي المستحقات',
            totalValue: '+EGP ${_data.basicSalary + _data.allowances}',
          ),
          const SizedBox(height: 16),

          // Itemized Deductions Card
          _buildItemizedCard(
            title: AppLocale.tr('deductions_title'),
            headerColor: const Color(0xFFFEF2F2),
            titleColor: const Color(0xFFDC2626),
            icon: Icons.remove_circle_outline,
            items: [
              {'label': AppLocale.tr('social_insurance'), 'value': _data.socialInsuranceLabel},
              {'label': AppLocale.tr('income_tax'), 'value': _data.incomeTaxLabel},
              {'label': AppLocale.tr('medical_insurance'), 'value': _data.medicalInsuranceLabel},
              if (_data.hasLoanDeduction)
                {'label': AppLocale.tr('loan_deduction'), 'value': _data.loanDeductionLabel},
              {'label': AppLocale.tr('penalties_deduction'), 'value': _data.penaltiesLabel},
            ],
            totalLabel: 'إجمالي الاستقطاعات',
            totalValue: _data.deductionsLabel,
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryStat(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11)),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildItemizedCard({
    required String title,
    required Color headerColor,
    required Color titleColor,
    required IconData icon,
    required List<Map<String, String>> items,
    required String totalLabel,
    required String totalValue,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: headerColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Row(
              children: [
                Icon(icon, size: 18, color: titleColor),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    color: titleColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 13.5,
                  ),
                ),
              ],
            ),
          ),
          ...items.map((item) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(item['label']!, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                  Text(item['value']!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(totalLabel, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold)),
                Text(
                  totalValue,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: titleColor),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 2: LOANS & SALARY ADVANCES
  // ==========================================
  Widget _buildLoansTab(BuildContext context) {
    final loanState = ref.watch(loanStateProvider);
    final activeLoan = loanState.activeLoan;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Active Loan Progress Card
          if (activeLoan != null) ...[
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(color: Color(0x06000000), blurRadius: 10, offset: Offset(0, 4)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEBF5FF),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.account_balance_wallet_outlined, color: AppColors.primary, size: 20),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                activeLoan.isEmergency ? 'سلفة طارئة نشطة' : 'قرض حسن نشط',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              Text(
                                activeLoan.referenceNumber,
                                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'ساري الاستقطاع',
                          style: TextStyle(color: Color(0xFF15803D), fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  LinearProgressIndicator(
                    value: activeLoan.progressPercentage,
                    backgroundColor: const Color(0xFFF1F5F9),
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                    minHeight: 8,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'المتبقي: ${activeLoan.remainingBalance} ج.م',
                        style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                      ),
                      Text(
                        'إجمالي المبلغ: ${activeLoan.amount} ج.م',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'القسط الشهري: ${activeLoan.monthlyInstallment} ج.م / شهر',
                        style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'تم سداد ${activeLoan.paidInstallmentsCount} من أصل ${activeLoan.installmentsCount} أقساط',
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Action Button: Apply New Advance
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              icon: const Icon(Icons.add_circle_outline, size: 20),
              label: Text(
                AppLocale.tr('apply_new_loan'),
                style: AppTypography.buttonText.copyWith(fontSize: 15),
              ),
              onPressed: () => ApplyLoanSheet.show(context),
            ),
          ),
          const SizedBox(height: 24),

          // Loan Requests List
          Text(
            'سجل طلبات السلف والقروض',
            style: AppTypography.sectionHeading.copyWith(fontSize: 16),
          ),
          const SizedBox(height: 12),
          if (loanState.loans.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'لا توجد طلبات سلف سابقة مسجلة.',
                  style: TextStyle(color: AppColors.textSecondary.withValues(alpha: 0.8)),
                ),
              ),
            )
          else
            ...loanState.loans.map((loan) {
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: loan.isActive ? const Color(0xFFEBF5FF) : const Color(0xFFF1F5F9),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        loan.isEmergency ? Icons.flash_on_rounded : Icons.handshake_outlined,
                        color: loan.isActive ? AppColors.primary : AppColors.textSecondary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            loan.isEmergency ? 'سلفة طارئة' : 'قرض حسن',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${loan.amount} ج.م • ${loan.installmentsCount} أقساط',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: loan.isActive
                            ? const Color(0xFFDCFCE7)
                            : (loan.isCompleted ? const Color(0xFFE0E7FF) : const Color(0xFFFEF3C7)),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        loan.isActive
                            ? 'ساري'
                            : (loan.isCompleted ? 'مسدد' : 'قيد المراجعة'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: loan.isActive
                              ? const Color(0xFF15803D)
                              : (loan.isCompleted ? const Color(0xFF4338CA) : const Color(0xFFB45309)),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 3: REPAYMENT SCHEDULE TIMELINE
  // ==========================================
  Widget _buildScheduleTab(BuildContext context) {
    final loanState = ref.watch(loanStateProvider);
    final activeLoan = loanState.activeLoan;

    if (activeLoan == null || activeLoan.repaymentSchedule.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.event_note_outlined, size: 56, color: AppColors.textSecondary.withValues(alpha: 0.5)),
              const SizedBox(height: 12),
              const Text(
                'لا توجد أقساط نشطة حالياً.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: activeLoan.repaymentSchedule.length,
      itemBuilder: (context, i) {
        final item = activeLoan.repaymentSchedule[i];
        final isPaid = item.isDeducted;

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isPaid ? const Color(0xFF86EFAC) : const Color(0xFFE2E8F0),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isPaid ? Icons.check_rounded : Icons.schedule_rounded,
                  color: isPaid ? const Color(0xFF16A34A) : AppColors.textSecondary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'القسط رقم ${item.installmentNumber} (${item.period})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isPaid ? 'تم الاستقطاع من مرتب الشهر' : 'سيتم الاستقطاع تلقائياً',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: isPaid ? const Color(0xFF16A34A) : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '${item.amount} ج.م',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: isPaid ? const Color(0xFF16A34A) : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
