import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class MachineStatusCard extends StatelessWidget {
  final String id;
  final String name;
  final String status; // 'running', 'stopped', 'maintenance'
  final String? stopReason;

  const MachineStatusCard({
    super.key,
    required this.id,
    required this.name,
    required this.status,
    this.stopReason,
  });

  @override
  Widget build(BuildContext context) {
    final bool isRunning = status == 'running';
    final bool isStopped = status == 'stopped';
    
    final Color bgColor = isRunning 
        ? AppColors.success.withValues(alpha: 0.1)
        : isStopped
            ? AppColors.error.withValues(alpha: 0.1)
            : AppColors.warning.withValues(alpha: 0.1);
            
    final Color iconColor = isRunning 
        ? AppColors.success 
        : isStopped 
            ? AppColors.error 
            : AppColors.warning;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isStopped ? AppColors.error.withValues(alpha: 0.5) : Colors.grey.shade200,
          width: isStopped ? 2 : 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: AppColors.cardShadow,
            blurRadius: 8,
            offset: Offset(0, 4),
          )
        ],
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: bgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(
              isRunning 
                  ? Icons.check_circle_outline 
                  : isStopped 
                      ? Icons.error_outline 
                      : Icons.build_circle_outlined,
              color: iconColor,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: AppTypography.newsTitle.copyWith(fontSize: 16),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    id,
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                  if (isStopped && stopReason != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        stopReason!,
                        style: AppTypography.bodySmall.copyWith(color: AppColors.error),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
