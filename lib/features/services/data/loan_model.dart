import 'package:flutter/foundation.dart';

class LoanInstallment {
  final int installmentNumber;
  final String period;
  final int amount;
  final String status; // pending, deducted, waived
  final DateTime? deductedAt;

  const LoanInstallment({
    required this.installmentNumber,
    required this.period,
    required this.amount,
    required this.status,
    this.deductedAt,
  });

  factory LoanInstallment.fromJson(Map<String, dynamic> json) {
    return LoanInstallment(
      installmentNumber: (json['installmentNumber'] as num?)?.toInt() ?? 1,
      period: json['period'] as String? ?? '',
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'pending',
      deductedAt: json['deductedAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch((json['deductedAt'] as num).toInt())
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'installmentNumber': installmentNumber,
        'period': period,
        'amount': amount,
        'status': status,
        'deductedAt': deductedAt?.millisecondsSinceEpoch,
      };

  bool get isDeducted => status == 'deducted';
}

class LoanRequest {
  final String id;
  final String referenceNumber;
  final String employeeId;
  final String type; // emergency_advance, social_loan
  final int amount;
  final int remainingBalance;
  final int installmentsCount;
  final int paidInstallmentsCount;
  final int monthlyInstallment;
  final String purpose;
  final String? notes;
  final String status; // pending, approved, active, completed, rejected
  final DateTime createdAt;
  final List<LoanInstallment> repaymentSchedule;

  const LoanRequest({
    required this.id,
    required this.referenceNumber,
    required this.employeeId,
    required this.type,
    required this.amount,
    required this.remainingBalance,
    required this.installmentsCount,
    required this.paidInstallmentsCount,
    required this.monthlyInstallment,
    required this.purpose,
    this.notes,
    required this.status,
    required this.createdAt,
    required this.repaymentSchedule,
  });

  factory LoanRequest.fromJson(Map<String, dynamic> json) {
    final scheduleRaw = json['repaymentSchedule'] as List<dynamic>? ?? [];
    final schedule = scheduleRaw
        .map((item) => LoanInstallment.fromJson(item as Map<String, dynamic>))
        .toList();

    return LoanRequest(
      id: json['id'] as String? ?? '',
      referenceNumber: json['referenceNumber'] as String? ?? '',
      employeeId: json['employeeId'] as String? ?? '',
      type: json['type'] as String? ?? 'emergency_advance',
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      remainingBalance: (json['remainingBalance'] as num?)?.toInt() ?? 0,
      installmentsCount: (json['installmentsCount'] as num?)?.toInt() ?? 1,
      paidInstallmentsCount: (json['paidInstallmentsCount'] as num?)?.toInt() ?? 0,
      monthlyInstallment: (json['monthlyInstallment'] as num?)?.toInt() ?? 0,
      purpose: json['purpose'] as String? ?? 'general',
      notes: json['notes'] as String?,
      status: json['status'] as String? ?? 'pending',
      createdAt: json['createdAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch((json['createdAt'] as num).toInt())
          : DateTime.now(),
      repaymentSchedule: schedule,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'referenceNumber': referenceNumber,
        'employeeId': employeeId,
        'type': type,
        'amount': amount,
        'remainingBalance': remainingBalance,
        'installmentsCount': installmentsCount,
        'paidInstallmentsCount': paidInstallmentsCount,
        'monthlyInstallment': monthlyInstallment,
        'purpose': purpose,
        'notes': notes,
        'status': status,
        'createdAt': createdAt.millisecondsSinceEpoch,
        'repaymentSchedule': repaymentSchedule.map((s) => s.toJson()).toList(),
      };

  bool get isEmergency => type == 'emergency_advance';
  bool get isActive => status == 'active';
  bool get isCompleted => status == 'completed';

  double get progressPercentage {
    if (amount <= 0) return 1.0;
    final paid = amount - remainingBalance;
    return (paid / amount).clamp(0.0, 1.0);
  }
}

@immutable
class LoanEligibility {
  final int netSalary;
  final int maxEmergencyAdvance;
  final int maxSocialLoan;
  final bool canApplyEmergencyAdvance;
  final bool canApplySocialLoan;
  final int currentMonthlyDeductions;
  final int activeLoansCount;

  const LoanEligibility({
    required this.netSalary,
    required this.maxEmergencyAdvance,
    required this.maxSocialLoan,
    required this.canApplyEmergencyAdvance,
    required this.canApplySocialLoan,
    required this.currentMonthlyDeductions,
    required this.activeLoansCount,
  });

  factory LoanEligibility.fromJson(Map<String, dynamic> json) {
    return LoanEligibility(
      netSalary: (json['netSalary'] as num?)?.toInt() ?? 8500,
      maxEmergencyAdvance: (json['maxEmergencyAdvance'] as num?)?.toInt() ?? 4250,
      maxSocialLoan: (json['maxSocialLoan'] as num?)?.toInt() ?? 25500,
      canApplyEmergencyAdvance: json['canApplyEmergencyAdvance'] as bool? ?? true,
      canApplySocialLoan: json['canApplySocialLoan'] as bool? ?? true,
      currentMonthlyDeductions: (json['currentMonthlyDeductions'] as num?)?.toInt() ?? 0,
      activeLoansCount: (json['activeLoansCount'] as num?)?.toInt() ?? 0,
    );
  }

  factory LoanEligibility.defaults() {
    return const LoanEligibility(
      netSalary: 9160,
      maxEmergencyAdvance: 4500,
      maxSocialLoan: 27000,
      canApplyEmergencyAdvance: true,
      canApplySocialLoan: true,
      currentMonthlyDeductions: 500,
      activeLoansCount: 1,
    );
  }
}
