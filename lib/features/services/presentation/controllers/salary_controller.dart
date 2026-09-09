import 'package:flutter_riverpod/flutter_riverpod.dart';
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
        state = const UiState.error('Invalid PIN or verification failed',
            code: 'INVALID_PIN');
        return;
      }
      _salaryToken = token;
      final payload = await _repo.fetchPayroll(salaryToken: token, pin: pin);
      if (payload != null &&
          payload['ok'] == true &&
          payload['payroll'] != null) {
        state = UiState.success(payload['payroll'] as Map<String, dynamic>);
      } else {
        state = UiState.error(
          payload?['error'] as String? ??
              'Failed to load salary statement from server',
          code: 'PAYROLL_UNAVAILABLE',
        );
      }
    } catch (e) {
      state = UiState.error(e.toString(), code: 'NETWORK_ERROR');
    }
  }

  Future<void> fetchWithToken() async {
    if (_salaryToken == null) {
      state = const UiState.empty();
      return;
    }
    state = const UiState.loading();
    try {
      final payload = await _repo.fetchPayroll(salaryToken: _salaryToken);
      if (payload != null &&
          payload['ok'] == true &&
          payload['payroll'] != null) {
        state = UiState.success(payload['payroll'] as Map<String, dynamic>);
      } else {
        state = UiState.error(
          payload?['error'] as String? ?? 'Failed to load salary statement',
          code: 'PAYROLL_UNAVAILABLE',
        );
      }
    } catch (e) {
      state = UiState.error(e.toString(), code: 'NETWORK_ERROR');
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
