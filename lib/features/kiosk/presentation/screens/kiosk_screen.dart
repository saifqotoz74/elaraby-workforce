import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/navigation/app_navigation.dart';
import '../widgets/machine_status_card.dart';
import '../widgets/work_order_tile.dart';

class KioskScreen extends StatefulWidget {
  const KioskScreen({super.key});

  @override
  State<KioskScreen> createState() => _KioskScreenState();
}

class _KioskScreenState extends State<KioskScreen> {
  late Timer _timer;
  DateTime _now = DateTime.now();

  // Hardcoded Mock Data based on backend specs
  final List<Map<String, dynamic>> machines = [
    {'id': 'M001', 'name': 'خط التجميع A', 'status': 'running', 'stopReason': null},
    {'id': 'M002', 'name': 'خط اللحام B', 'status': 'running', 'stopReason': null},
    {'id': 'M003', 'name': 'ضاغط الهواء C', 'status': 'stopped', 'stopReason': 'صيانة دورية'},
    {'id': 'M004', 'name': 'خط الطلاء D', 'status': 'maintenance', 'stopReason': null},
  ];

  final List<Map<String, dynamic>> workOrders = [
    {'id': 'WO-2026-001', 'title': 'تجميع ثلاجات 12 قدم', 'targetQty': 200, 'completedQty': 145, 'dueDate': '2026-09-25', 'priority': 'high'},
    {'id': 'WO-2026-002', 'title': 'لحام هياكل غسالات', 'targetQty': 150, 'completedQty': 150, 'dueDate': '2026-09-22', 'priority': 'normal'},
    {'id': 'WO-2026-003', 'title': 'طلاء بودرة باب الثلاجة', 'targetQty': 300, 'completedQty': 80, 'dueDate': '2026-09-28', 'priority': 'normal'},
  ];

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _now = DateTime.now();
      });
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  String _formatTime(DateTime time) {
    final hour = time.hour > 12 ? time.hour - 12 : (time.hour == 0 ? 12 : time.hour);
    final min = time.minute.toString().padLeft(2, '0');
    final amPm = time.hour >= 12 ? 'م' : 'ص';
    return '$hour:$min $amPm';
  }

  @override
  Widget build(BuildContext context) {
    final int stoppedCount = machines.where((m) => m['status'] == 'stopped').length;
    final bool hasStoppage = stoppedCount > 0;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              _buildTopBar(),
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildLeftPanel(),
                    Expanded(
                      flex: 6,
                      child: _buildRightPanel(hasStoppage, stoppedCount),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      color: AppColors.surface,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(Icons.factory, color: AppColors.primary, size: 32),
              const SizedBox(width: 12),
              Text(
                'العربي - كشك الإنتاج',
                style: AppTypography.sectionHeading,
              ),
            ],
          ),
          Text(
            _formatTime(_now),
            style: AppTypography.welcomeTitle.copyWith(color: AppColors.primary, fontWeight: FontWeight.bold),
          ),
          Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.shiftIconBg,
                child: Icon(Icons.person, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('محمود أحمد', style: AppTypography.newsTitle),
                  Text('EG-1042', style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLeftPanel() {
    return Expanded(
      flex: 4,
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          boxShadow: const [
            BoxShadow(
              color: AppColors.cardShadow,
              blurRadius: 16,
              offset: Offset(0, 4),
            )
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 60,
              backgroundColor: AppColors.shiftIconBg,
              child: Icon(Icons.person, size: 80, color: AppColors.primary),
            ),
            const SizedBox(height: 24),
            Text(
              'محمود أحمد',
              style: AppTypography.welcomeTitle,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'الوردية الصباحية',
                style: AppTypography.newsTitle.copyWith(color: AppColors.primary),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 16,
                  height: 16,
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'داخل المصنع',
                  style: AppTypography.sectionHeading.copyWith(color: AppColors.success),
                ),
              ],
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 80,
              child: ElevatedButton.icon(
                onPressed: () {
                  AppNavigation.toKioskQr(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.success,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                icon: const Icon(Icons.qr_code_scanner, size: 32, color: Colors.white),
                label: Text(
                  'تسجيل الحضور / الانصراف',
                  style: AppTypography.sectionHeading.copyWith(color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRightPanel(bool hasStoppage, int stoppedCount) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 24, left: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasStoppage)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 24),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.5)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 32),
                  const SizedBox(width: 12),
                  Text(
                    '⚠️ تحذير: $stoppedCount ماكينة متوقفة',
                    style: AppTypography.sectionHeading.copyWith(color: AppColors.error),
                  ),
                ],
              ),
            ),
          
          Text('حالة الماكينات', style: AppTypography.sectionHeading),
          const SizedBox(height: 16),
          Expanded(
            flex: 2,
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 2.5,
              ),
              itemCount: machines.length,
              itemBuilder: (context, index) {
                final m = machines[index];
                return MachineStatusCard(
                  id: m['id'],
                  name: m['name'],
                  status: m['status'],
                  stopReason: m['stopReason'],
                );
              },
            ),
          ),
          
          const SizedBox(height: 24),
          Text('أوامر التشغيل الحالية', style: AppTypography.sectionHeading),
          const SizedBox(height: 16),
          Expanded(
            flex: 3,
            child: ListView.builder(
              itemCount: workOrders.length,
              itemBuilder: (context, index) {
                final w = workOrders[index];
                return WorkOrderTile(
                  id: w['id'],
                  title: w['title'],
                  targetQty: w['targetQty'],
                  completedQty: w['completedQty'],
                  dueDate: w['dueDate'],
                  priority: w['priority'],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
