import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import 'apply_permit_sheet.dart';

class HseHomeScreen extends StatefulWidget {
  const HseHomeScreen({super.key});

  @override
  State<HseHomeScreen> createState() => _HseHomeScreenState();
}

class _HseHomeScreenState extends State<HseHomeScreen> {
  int _ltiDays = 142;
  List<Map<String, dynamic>> _permits = [
    {
      'title': 'عمل حار - خط الإنتاج 3',
      'subtitle': 'صالح حتى 4:00 مساءً',
      'status': 'مقبول',
      'isApproved': true,
    },
    {
      'title': 'أماكن مغلقة - خزان 2',
      'subtitle': 'في انتظار الموافقة',
      'status': 'قيد المراجعة',
      'isApproved': false,
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadHseData();
  }

  Future<void> _loadHseData() async {
    try {
      final summaryBody = await ApiClient.instance.get('/employee/hse/summary');
      if (summaryBody != null && mounted) {
        final data = summaryBody['data'] ?? summaryBody;
        if (data['ltiDays'] != null) {
          setState(() {
            _ltiDays = data['ltiDays'] as int;
          });
        }
      }

      final permitsBody = await ApiClient.instance.get('/employee/hse/permits');
      if (permitsBody != null && mounted) {
        final dataList = permitsBody['data'] ?? permitsBody['permits'];
        if (dataList is List && dataList.isNotEmpty) {
          final List<Map<String, dynamic>> list = [];
          for (final item in dataList) {
            list.add({
              'title': '${item['type'] ?? 'تصريح عمل'} - ${item['location'] ?? ''}',
              'subtitle': item['validUntil'] != null ? 'صالح حتى ${item['validUntil']}' : 'في انتظار المراجعة',
              'status': item['status'] == 'approved' ? 'مقبول' : 'قيد المراجعة',
              'isApproved': item['status'] == 'approved',
            });
          }
          setState(() {
            _permits = list;
          });
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'إدارة السلامة والصحة المهنية',
          style: AppTypography.welcomeTitle.copyWith(fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Hero card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.statusGreen.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.statusGreen.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.security, color: AppColors.statusGreen, size: 40),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$_ltiDays يوم بدون إصابات عمل',
                            style: AppTypography.metricValueSuccess,
                          ),
                          Text(
                            'حافظ على سلامتك وسلامة زملائك',
                            style: AppTypography.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // Quick Actions
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          builder: (context) => const ApplyPermitSheet(),
                        );
                      },
                      icon: const Icon(Icons.assignment),
                      label: const Text('طلب تصريح عمل'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.warning_amber),
                      label: const Text('إبلاغ عن خطر/حادث'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              // Active permits
              Text('تصاريح العمل النشطة', style: AppTypography.sectionHeading),
              const SizedBox(height: 12),
              ..._permits.map((permit) {
                final isApproved = permit['isApproved'] == true;
                return Card(
                  elevation: 0,
                  color: AppColors.surface,
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: AppColors.textLight.withValues(alpha: 0.2)),
                  ),
                  child: ListTile(
                    title: Text(permit['title'] as String, style: AppTypography.bodyMedium),
                    subtitle: Text(permit['subtitle'] as String, style: AppTypography.bodySmall),
                    trailing: Chip(
                      label: Text(permit['status'] as String),
                      backgroundColor: (isApproved ? AppColors.statusGreen : AppColors.warning).withValues(alpha: 0.1),
                      labelStyle: TextStyle(
                        color: isApproved ? AppColors.statusGreen : AppColors.warning,
                        fontSize: 12,
                      ),
                    ),
                  ),
                );
              }),
              const SizedBox(height: 24),
              // PPE
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: AppColors.cardShadow,
                      blurRadius: 10,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text('نسبة الالتزام بمهمات الوقاية', style: AppTypography.bodyMedium)),
                    const SizedBox(width: 8),
                    Text('98%', style: AppTypography.metricValueSuccess),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
