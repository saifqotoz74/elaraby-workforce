import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class WorkOrderTile extends StatelessWidget {
  final String id;
  final String title;
  final int targetQty;
  final int completedQty;
  final String dueDate;
  final String priority; // 'high', 'normal'

  const WorkOrderTile({
    super.key,
    required this.id,
    required this.title,
    required this.targetQty,
    required this.completedQty,
    required this.dueDate,
    required this.priority,
  });

  @override
  Widget build(BuildContext context) {
    final double progress = targetQty > 0 ? completedQty / targetQty : 0.0;
    final bool isHighPriority = priority == 'high';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: isHighPriority 
            ? Border.all(color: AppColors.warning.withValues(alpha: 0.5), width: 1.5)
            : Border.all(color: Colors.grey.shade200),
        boxShadow: const [
          BoxShadow(
            color: AppColors.cardShadow,
            blurRadius: 4,
            offset: Offset(0, 2),
          )
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
                  title,
                  style: AppTypography.newsTitle.copyWith(fontSize: 16),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isHighPriority)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    'أولوية قصوى',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.warning, fontWeight: FontWeight.bold),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                id,
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
              const Spacer(),
              Text(
                'موعد التسليم: $dueDate',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'التقدم:',
                style: AppTypography.bodyMedium,
              ),
              Text(
                '$completedQty / $targetQty',
                style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: progress.clamp(0.0, 1.0),
            backgroundColor: Colors.grey.shade200,
            valueColor: AlwaysStoppedAnimation<Color>(
              progress >= 1.0 
                  ? AppColors.success 
                  : isHighPriority 
                      ? AppColors.warning 
                      : AppColors.primary,
            ),
            minHeight: 8,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }
}
