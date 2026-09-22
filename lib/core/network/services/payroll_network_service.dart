import 'package:flutter/foundation.dart';

import '../api_client.dart';

/// Network operations dedicated to Payroll, Payslips, Salary Unlock, and Company Loans.
class PayrollNetworkService {
  final ApiClient _api;
  final ValueNotifier<bool> _online;

  PayrollNetworkService(this._api, this._online);

  /// Unlocks salary information server-side using the employee's 4-digit PIN.
  /// Returns a short-lived salary authorization token, or null on failure.
  Future<String?> unlockSalary(String pin) async {
    final res = await _api.post('/payroll/unlock', {'pin': pin});
    if (res != null && res['ok'] == true && res['salaryToken'] is String) {
      return res['salaryToken'] as String;
    }
    return null;
  }

  /// The employee's current salary statement from the server.
  /// Server-side PIN verification is required when PIN is enabled.
  Future<Map<String, dynamic>?> fetchPayroll({
    String? pin,
    String? salaryToken,
    String? period,
  }) async {
    final extraHeaders = <String, String>{};
    if (salaryToken != null && salaryToken.isNotEmpty) {
      extraHeaders['x-salary-token'] = salaryToken;
    }
    if (pin != null && pin.isNotEmpty) {
      extraHeaders['x-salary-pin'] = pin;
    }
    final path = period != null
        ? '/payroll?period=${Uri.encodeComponent(period)}'
        : '/payroll';
    final res = await _api.get(path, extraHeaders: extraHeaders);
    if (res?['payroll'] == null) return null;
    _online.value = true;
    return res!['payroll'] as Map<String, dynamic>;
  }

  /// Available historical statement periods (e.g. August 2026, July 2026, June 2026).
  Future<List<String>?> fetchPayrollHistoryPeriods({
    String? pin,
    String? salaryToken,
  }) async {
    final extraHeaders = <String, String>{};
    if (salaryToken != null && salaryToken.isNotEmpty) {
      extraHeaders['x-salary-token'] = salaryToken;
    }
    if (pin != null && pin.isNotEmpty) {
      extraHeaders['x-salary-pin'] = pin;
    }
    final res = await _api.get('/payroll/history', extraHeaders: extraHeaders);
    if (res?['periods'] == null) return null;
    return (res!['periods'] as List<dynamic>).map((e) => e.toString()).toList();
  }

  // ---------- Loans & Salary Advances ----------
  Future<Map<String, dynamic>?> fetchLoanEligibility() async {
    final res = await _api.get('/loans/eligibility');
    return res?['eligibility'] as Map<String, dynamic>?;
  }

  Future<List<Map<String, dynamic>>?> fetchLoans() async {
    final res = await _api.get('/loans');
    final list = res?['loans'] as List<dynamic>?;
    if (list == null) return null;
    return list
        .map((e) => Map<String, dynamic>.from(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>?> applyLoan(
    Map<String, dynamic> data, {
    String? pin,
    String? salaryToken,
  }) async {
    final extraHeaders = <String, String>{};
    if (salaryToken != null && salaryToken.isNotEmpty) {
      extraHeaders['x-salary-token'] = salaryToken;
    }
    if (pin != null && pin.isNotEmpty) {
      extraHeaders['x-salary-pin'] = pin;
    }
    final res =
        await _api.post('/loans', data, extraHeaders: extraHeaders);
    return res?['loan'] as Map<String, dynamic>?;
  }
}
