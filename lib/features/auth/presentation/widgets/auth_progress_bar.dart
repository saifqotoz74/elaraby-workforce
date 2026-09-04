import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class AuthProgressBar extends StatelessWidget {
  final int currentStep; // 1 to 5

  const AuthProgressBar({
    super.key,
    required this.currentStep,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: List.generate(5, (index) {
          final isCompleted = index < currentStep;
          return Expanded(
            child: Container(
              height: 3,
              margin: EdgeInsets.only(
                left: index == 0 ? 0 : 4,
                right: index == 4 ? 0 : 4,
              ),
              decoration: BoxDecoration(
                color: isCompleted ? AppColors.primary : const Color(0xFFE5EBF2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
      ),
    );
  }
}
