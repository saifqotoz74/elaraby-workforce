import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/localization/app_locale.dart';

/// Candidate worker model for interactive Smart Backfill
class BackfillCandidate {
  final String id;
  final String code;
  final String name;
  final String role;
  final String line;
  final double suitabilityScore;
  bool isAssigned;

  BackfillCandidate({
    required this.id,
    required this.code,
    required this.name,
    required this.role,
    required this.line,
    required this.suitabilityScore,
    this.isAssigned = false,
  });
}

/// Role-gated Mobile Screen for Floor Shift Supervisors & Plant Managers.
/// Features:
/// 1. Live Shift Attendance & Fill Rate Circular Meter
/// 2. Active Floor Alert & Stoppage Risk Banners
/// 3. Interactive 1-Tap Smart Crew Backfill Assignment
/// 4. Department Overtime Budget Meter
class SupervisorAnalyticsScreen extends StatefulWidget {
  final String shiftName;
  final String departmentName;

  const SupervisorAnalyticsScreen({
    super.key,
    this.shiftName = 'الوردية الصباحية (08:00 - 16:00)',
    this.departmentName = 'قطاع التجميع والصناعات الهندسية',
  });

  @override
  State<SupervisorAnalyticsScreen> createState() =>
      _SupervisorAnalyticsScreenState();
}

class _SupervisorAnalyticsScreenState extends State<SupervisorAnalyticsScreen> {
  bool _isLoading = false;
  final int _scheduledCount = 48;
  int _presentCount = 44;
  final int _overtimeHoursUsed = 142;
  static const int _overtimeHoursCap = 180;

  final List<BackfillCandidate> _backfillCandidates = [
    BackfillCandidate(
      id: 'emp_1042',
      code: 'EG-1042',
      name: 'محمود عبد الفتاح',
      role: 'فني تجميع وتشغيل ماكينات',
      line: 'Line-B (خط التجميع الرئيسي)',
      suitabilityScore: 0.98,
    ),
    BackfillCandidate(
      id: 'emp_1088',
      code: 'EG-1088',
      name: 'أحمد إبراهيم السيد',
      role: 'مشغل فني معتمد',
      line: 'Line-A (خط التغذية الآلية)',
      suitabilityScore: 0.94,
    ),
    BackfillCandidate(
      id: 'emp_1105',
      code: 'EG-1105',
      name: 'طارق صلاح الدين',
      role: 'فني ضبط جودة وصيانة',
      line: 'Line-C (مراقبة الجودة والفرز)',
      suitabilityScore: 0.91,
    ),
  ];

  Future<void> _refreshData() async {
    setState(() => _isLoading = true);
    await Future.delayed(const Duration(milliseconds: 600));
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  void _assignCandidate(BackfillCandidate candidate) {
    setState(() {
      candidate.isAssigned = true;
      _presentCount = (_presentCount + 1).clamp(0, _scheduledCount);
    });

    final isAr = AppLocale.instance.isArabic;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF059669),
        behavior: SnackBarBehavior.floating,
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                isAr
                    ? 'تم تعيين العامل ${candidate.name} كبديل فوري بنجاح'
                    : 'Worker ${candidate.name} successfully assigned as backfill',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    final fillRate = _scheduledCount > 0
        ? ((_presentCount / _scheduledCount) * 100).clamp(0, 100).toDouble()
        : 0.0;
    final otFraction = (_overtimeHoursUsed / _overtimeHoursCap).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          isAr ? 'إحصائيات الوردية والخطوط' : 'Floor Shift Analytics',
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: isAr ? 'تحديث البيانات' : 'Refresh',
            onPressed: _refreshData,
          ),
        ],
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _refreshData,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                children: [
                  // Department & Shift Header Card
                  _buildShiftHeaderCard(isAr),
                  const SizedBox(height: 16),

                  // Circular Fill Rate & Metric Counters
                  _buildAttendanceFillRateCard(isAr, fillRate),
                  const SizedBox(height: 16),

                  // Stoppage Risk Floor Alert Banner
                  _buildStoppageRiskAlert(isAr, fillRate),
                  const SizedBox(height: 16),

                  // Interactive Smart Backfill Card
                  _buildSmartBackfillCard(isAr),
                  const SizedBox(height: 16),

                  // Overtime Budget Meter
                  _buildOvertimeBudgetMeter(isAr, otFraction),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }

  Widget _buildShiftHeaderCard(bool isAr) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  widget.departmentName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      isAr ? 'مباشر' : 'LIVE',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF065F46),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.schedule_rounded, size: 14, color: Color(0xFF64748B)),
              const SizedBox(width: 4),
              Text(
                widget.shiftName,
                style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAttendanceFillRateCard(bool isAr, double fillRate) {
    final rateColor = fillRate >= 92
        ? const Color(0xFF10B981)
        : (fillRate >= 80 ? const Color(0xFFF59E0B) : const Color(0xFFEF4444));

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Circular Progress Meter
          SizedBox(
            width: 90,
            height: 90,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: fillRate / 100,
                  strokeWidth: 8,
                  backgroundColor: const Color(0xFFE2E8F0),
                  valueColor: AlwaysStoppedAnimation<Color>(rateColor),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${fillRate.toStringAsFixed(1)}%',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: rateColor,
                      ),
                    ),
                    Text(
                      isAr ? 'ملء الوردية' : 'Fill Rate',
                      style: const TextStyle(
                        fontSize: 9,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 20),

          // Counts Breakdown
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildCountRow(
                  label: isAr ? 'الحاضرون بالوردية' : 'Present on Floor',
                  value: '$_presentCount / $_scheduledCount',
                  color: const Color(0xFF0F172A),
                ),
                const SizedBox(height: 8),
                _buildCountRow(
                  label: isAr ? 'حالات الغياب / عجز' : 'Absent / Deficit',
                  value: '${_scheduledCount - _presentCount}',
                  color: _scheduledCount - _presentCount > 3
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF64748B),
                ),
                const SizedBox(height: 8),
                _buildCountRow(
                  label: isAr ? 'المستهدف التشغيلي' : 'Target Threshold',
                  value: '92.0%',
                  color: const Color(0xFF0284C7),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCountRow({
    required String label,
    required String value,
    required Color color,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        Text(
          value,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color),
        ),
      ],
    );
  }

  Widget _buildStoppageRiskAlert(bool isAr, double fillRate) {
    final hasRisk = fillRate < 92.0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: hasRisk ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasRisk ? const Color(0xFFFECACA) : const Color(0xFFBBF7D0),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            hasRisk ? Icons.warning_amber_rounded : Icons.check_circle_outline,
            color: hasRisk ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
            size: 22,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hasRisk
                      ? (isAr ? 'تنبيه عجز تشغيلي على خط التجميع' : 'Operational Deficit Alert')
                      : (isAr ? 'خطوط الإنتاج تعمل بكامل طاقتها' : 'Lines Running at Full Capacity'),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: hasRisk ? const Color(0xFF991B1B) : const Color(0xFF14532D),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  hasRisk
                      ? (isAr
                          ? 'نسبة الحضور أقل من المستهدف. يوصى بتعيين بديل فوري من العمالة الاحتياطية لتفادي توقف الخطوط.'
                          : 'Attendance below target. Recommend assigning backfills to avoid line bottlenecks.')
                      : (isAr
                          ? 'لا توجد مخاطر توقف حالية. جميع المحطات الفنية مكتملة.'
                          : 'Zero stoppage risk detected. All operator stations staffed.'),
                  style: TextStyle(
                    fontSize: 11.5,
                    color: hasRisk ? const Color(0xFFB91C1C) : const Color(0xFF166534),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSmartBackfillCard(bool isAr) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
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
                  const Icon(Icons.bolt_rounded, color: Color(0xFF0284C7), size: 20),
                  const SizedBox(width: 6),
                  Text(
                    isAr ? 'التعويض الذكي الفوري (Smart Backfill)' : 'Smart Crew Backfill',
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isAr ? 'AI ترشيح' : 'AI Match',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            isAr
                ? 'عمال متوافقون من ورديات سابقة متاحون للتكليف الفوري بنقرة واحدة'
                : 'Compatible off-shift operators available for instant 1-tap assignment',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 14),

          // Candidate List
          ..._backfillCandidates.map((c) => _buildCandidateTile(isAr, c)),
        ],
      ),
    );
  }

  Widget _buildCandidateTile(bool isAr, BackfillCandidate candidate) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: candidate.isAssigned ? const Color(0xFFF8FAFC) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: candidate.isAssigned ? const Color(0xFFE2E8F0) : const Color(0xFFCBD5E1),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: candidate.isAssigned ? const Color(0xFFE2E8F0) : const Color(0xFFE0F2FE),
            child: Icon(
              candidate.isAssigned ? Icons.check : Icons.person_rounded,
              size: 18,
              color: candidate.isAssigned ? const Color(0xFF64748B) : const Color(0xFF0284C7),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      candidate.name,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: candidate.isAssigned ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '(${candidate.code})',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '${candidate.role} • ${candidate.line}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // 1-Tap Action Button
          candidate.isAssigned
              ? Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isAr ? 'تم التعيين' : 'Assigned',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF059669),
                    ),
                  ),
                )
              : ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: () => _assignCandidate(candidate),
                  child: Text(
                    isAr ? 'تعيين كبديل' : 'Assign',
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                  ),
                ),
        ],
      ),
    );
  }

  Widget _buildOvertimeBudgetMeter(bool isAr, double fraction) {
    final isHigh = fraction > 0.85;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 8,
            offset: Offset(0, 2),
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
                isAr ? 'ميزانية الساعات الإضافية للمصنع' : 'Department Overtime Budget',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
              Text(
                '$_overtimeHoursUsed / $_overtimeHoursCap ساعة',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: isHigh ? const Color(0xFFDC2626) : const Color(0xFF0284C7),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 8,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: AlwaysStoppedAnimation<Color>(
                isHigh ? const Color(0xFFDC2626) : const Color(0xFF10B981),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isAr
                ? (isHigh
                    ? '⚠️ تحذير: استهلاك 85% من سقف الساعات الإضافية المصرح بها لهذا الشهر.'
                    : 'الاستهلاك ضمن المعدل الطبيعي المعتمد للوردية.')
                : (isHigh
                    ? 'Warning: 85% of monthly overtime cap consumed.'
                    : 'Overtime usage is within normal operational allocation.'),
            style: TextStyle(
              fontSize: 11,
              color: isHigh ? const Color(0xFFDC2626) : const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }
}
