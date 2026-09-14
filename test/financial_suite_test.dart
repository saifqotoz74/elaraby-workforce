import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/features/services/data/payroll_data.dart';
import 'package:elaraby_workforce/features/services/data/loan_model.dart';
import 'package:elaraby_workforce/features/services/presentation/controllers/salary_controller.dart';
import 'package:elaraby_workforce/core/repositories/salary_repository.dart';

class MockSalaryRepository implements SalaryRepository {
  @override
  Future<String?> unlockSalary(String pin) async =>
      pin == '1234' ? 'mock-salary-token' : null;

  @override
  Future<Map<String, dynamic>?> fetchPayroll(
      {String? pin, String? salaryToken, String? period}) async {
    return {
      'ok': true,
      'payroll': {
        'period': period ?? 'August 2026',
        'basicSalary': 8500,
        'overtimeAmount': 700,
        'transportAllowance': 400,
        'mealAllowance': 350,
        'incentiveBonus': 850,
        'allowances': 2300,
        'socialInsurance': 680,
        'incomeTax': 210,
        'medicalInsurance': 150,
        'penalties': 0,
        'loanDeduction': 500,
        'deductions': 1540,
        'netSalary': 9260,
        'paidOn': 'Aug 28, 2026',
        'paymentMethod': 'Bank Transfer (CIB)',
      }
    };
  }

  @override
  Future<List<String>?> fetchPayrollHistoryPeriods(
      {String? pin, String? salaryToken}) async {
    return ['August 2026', 'July 2026', 'June 2026', 'May 2026'];
  }

  @override
  int get salaryGateFailedAttempts => 0;

  @override
  Future<void> setSalaryGateFailedAttempts(int count) async {}

  @override
  int get salaryGateLockoutUntil => 0;

  @override
  Future<void> setSalaryGateLockoutUntil(int epochMs) async {}

  @override
  Future<void> resetSalaryGateLockout() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Financial Suite: SalarySlipData & Itemized Breakdown', () {
    test('Calculates net pay and formatted labels correctly', () {
      final slip = SalarySlipData(
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
        loanDeduction: 500,
        deductions: 1540,
        paidOn: 'Aug 28, 2026',
        paymentMethod: 'Bank Transfer (CIB)',
      );

      expect(slip.netPay, 9260);
      expect(slip.netPayLabel, 'EGP 9,260');
      expect(slip.basicLabel, 'EGP 8,500');
      expect(slip.overtimeLabel, '+EGP 700');
      expect(slip.loanDeductionLabel, '-EGP 500');
      expect(slip.hasLoanDeduction, isTrue);
    });

    test('Parses from JSON accurately with fallback defaults', () {
      final json = {
        'period': 'July 2026',
        'basicSalary': 8500,
        'allowances': 2200,
        'deductions': 1540,
        'overtimeAmount': 650,
        'loanDeduction': 500,
      };

      final slip = SalarySlipData.fromJson(json);
      expect(slip.period, 'July 2026');
      expect(slip.netPay, 9160);
      expect(slip.overtimeAmount, 650);
      expect(slip.loanDeduction, 500);
    });
  });

  group('Financial Suite: Arabic Tafqeet (Number-to-Words)', () {
    test('Converts exact Egyptian pound amounts to formal Arabic words', () {
      expect(
        convertToArabicWords(1000),
        'فقط ألف جنيهاً مصرياً لا غير',
      );
      expect(
        convertToArabicWords(2500),
        'فقط ألفان وخمسمائة جنيهاً مصرياً لا غير',
      );
      expect(
        convertToArabicWords(9160),
        'فقط تسعة آلاف ومائة وستون جنيهاً مصرياً لا غير',
      );
    });
  });

  group('Financial Suite: Loan Models & Installments', () {
    test('LoanRequest progress calculation and installment status', () {
      final loan = LoanRequest(
        id: 'test_loan_1',
        referenceNumber: 'LN-2026-1001',
        employeeId: 'emp_1',
        type: 'emergency_advance',
        amount: 2000,
        remainingBalance: 1000,
        installmentsCount: 2,
        paidInstallmentsCount: 1,
        monthlyInstallment: 1000,
        purpose: 'emergency_medical',
        status: 'active',
        createdAt: DateTime.now(),
        repaymentSchedule: [
          const LoanInstallment(
            installmentNumber: 1,
            period: 'July 2026',
            amount: 1000,
            status: 'deducted',
          ),
          const LoanInstallment(
            installmentNumber: 2,
            period: 'August 2026',
            amount: 1000,
            status: 'pending',
          ),
        ],
      );

      expect(loan.isEmergency, isTrue);
      expect(loan.isActive, isTrue);
      expect(loan.progressPercentage, 0.5); // 1000 / 2000
      expect(loan.repaymentSchedule.first.isDeducted, isTrue);
      expect(loan.repaymentSchedule.last.isDeducted, isFalse);
    });

    test('LoanEligibility defaults provides healthy limits', () {
      final elig = LoanEligibility.defaults();
      expect(elig.maxEmergencyAdvance, 4500);
      expect(elig.maxSocialLoan, 27000);
      expect(elig.canApplyEmergencyAdvance, isTrue);
      expect(elig.canApplySocialLoan, isTrue);
    });
  });

  group('Financial Suite: SalaryNotifier Riverpod Controller', () {
    test('unlockAndFetch populates available periods and statements', () async {
      final repo = MockSalaryRepository();
      final notifier = SalaryNotifier(repo);

      await notifier.unlockAndFetch('1234');

      expect(notifier.salaryToken, 'mock-salary-token');
      expect(notifier.availablePeriods.length, 4);
      expect(notifier.availablePeriods.contains('August 2026'), isTrue);
      expect(notifier.state.isSuccess, isTrue);

      // Switch period to July 2026
      await notifier.selectPeriod('July 2026');
      expect(notifier.selectedPeriod, 'July 2026');
      expect(notifier.state.isSuccess, isTrue);
    });
  });
}
