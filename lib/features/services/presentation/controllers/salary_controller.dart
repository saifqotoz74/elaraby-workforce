import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/errors/app_error.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/providers/repository_providers.dart';
import '../../../../core/repositories/salary_repository.dart';
import '../../../../core/state/ui_state.dart';

class SalaryNotifier extends StateNotifier<UiState<Map<String, dynamic>>> {
  final SalaryRepository _repo;
  String? _salaryToken;

  SalaryNotifier(this._repo) : super(const UiState.empty());

  String? get salaryToken => _salaryToken;

  Future<void> unlockAndFetch(String pin) async {
    state = const UiState.loading();
    try {
      final token = await _repo.unlockSalary(pin);
      if (token == null) {
        final lastErr = ApiClient.instance.lastError;
        state = UiState.error(
          lastErr?.message ?? 'Invalid PIN or verification failed',
          code: lastErr?.code ?? 'INVALID_PIN',
        );
        return;
      }
      _salaryToken = token;
      final payload = await _repo.fetchPayroll(salaryToken: token, pin: pin);
      Map<String, dynamic>? payrollData;
      if (payload != null) {
        if (payload['payroll'] is Map<String, dynamic>) {
          payrollData = payload['payroll'] as Map<String, dynamic>;
        } else if (payload.containsKey('basicSalary')) {
          payrollData = payload;
        }
      }

      if (payrollData != null) {
        state = UiState.success(payrollData);
      } else {
        final lastErr = ApiClient.instance.lastError;
        state = UiState.error(
          lastErr?.message ??
              payload?['error'] as String? ??
              'Failed to load salary statement from server',
          code: lastErr?.code ?? 'PAYROLL_UNAVAILABLE',
        );
      }
    } catch (e, st) {
      final appErr = AppError.fromException(e, st);
      state = UiState.error(appErr.message, code: appErr.code);
    }
  }

  Future<void> fetchWithToken() async {
    state = const UiState.loading();
    try {
      final payload = await _repo.fetchPayroll(salaryToken: _salaryToken);
      Map<String, dynamic>? payrollData;
      if (payload != null) {
        if (payload['payroll'] is Map<String, dynamic>) {
          payrollData = payload['payroll'] as Map<String, dynamic>;
        } else if (payload.containsKey('basicSalary')) {
          payrollData = payload;
        }
      }

      if (payrollData != null) {
        state = UiState.success(payrollData);
      } else {
        final lastErr = ApiClient.instance.lastError;
        state = UiState.error(
          lastErr?.message ??
              payload?['error'] as String? ??
              'Failed to load salary statement',
          code: lastErr?.code ?? 'PAYROLL_UNAVAILABLE',
        );
      }
    } catch (e, st) {
      final appErr = AppError.fromException(e, st);
      state = UiState.error(appErr.message, code: appErr.code);
    }
  }

  void lock() {
    _salaryToken = null;
    state = const UiState.empty();
  }
}

final salaryStateProvider =
    StateNotifierProvider<SalaryNotifier, UiState<Map<String, dynamic>>>((ref) {
  final repo = ref.watch(salaryRepositoryProvider);
  return SalaryNotifier(repo);
});
