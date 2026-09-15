import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/errors/app_error.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/providers/repository_providers.dart';
import '../../../../core/repositories/salary_repository.dart';
import '../../../../core/state/ui_state.dart';

class SalaryNotifier extends StateNotifier<UiState<Map<String, dynamic>>> {
  final SalaryRepository _repo;
  String? _salaryToken;
  String? _lastPin;

  List<String> _availablePeriods = const [
    'August 2026',
    'July 2026',
    'June 2026',
    'May 2026',
  ];
  String _selectedPeriod = 'August 2026';
  final Map<String, Map<String, dynamic>> _periodCache = {};

  SalaryNotifier(this._repo) : super(const UiState.empty());

  String? get salaryToken => _salaryToken;
  String get selectedPeriod => _selectedPeriod;
  List<String> get availablePeriods => _availablePeriods;

  Future<void> unlockAndFetch(String pin, {String? period}) async {
    state = const UiState.loading();
    _lastPin = pin;
    if (period != null) _selectedPeriod = period;

    try {
      final token = await _repo.unlockSalary(pin);
      if (token == null) {
        final lastErr = ApiClient.instance.lastError;
        final isNetwork =
            lastErr != null && (lastErr.isOffline || lastErr.isTimeout);
        state = UiState.error(
          isNetwork
              ? lastErr.userFacingMessage()
              : 'Invalid PIN or verification failed',
          code: isNetwork ? lastErr.code : 'INVALID_PIN',
          error: lastErr,
        );
        return;
      }
      _salaryToken = token;

      // Fetch available historical periods
      final serverPeriods = await _repo.fetchPayrollHistoryPeriods(
        salaryToken: token,
        pin: pin,
      );
      if (serverPeriods != null && serverPeriods.isNotEmpty) {
        _availablePeriods = serverPeriods;
        if (!_availablePeriods.contains(_selectedPeriod)) {
          _selectedPeriod = _availablePeriods.first;
        }
      }

      await _fetchForPeriod(_selectedPeriod, pin: pin, token: token);
    } catch (e, st) {
      final appErr = AppError.fromException(e, st);
      state = UiState.error(appErr.message, code: appErr.code);
    }
  }

  Future<void> fetchWithToken({String? period}) async {
    state = const UiState.loading();
    if (period != null) _selectedPeriod = period;

    try {
      final serverPeriods = await _repo.fetchPayrollHistoryPeriods(
        salaryToken: _salaryToken,
        pin: _lastPin,
      );
      if (serverPeriods != null && serverPeriods.isNotEmpty) {
        _availablePeriods = serverPeriods;
        if (!_availablePeriods.contains(_selectedPeriod)) {
          _selectedPeriod = _availablePeriods.first;
        }
      }

      await _fetchForPeriod(_selectedPeriod, pin: _lastPin, token: _salaryToken);
    } catch (e, st) {
      final appErr = AppError.fromException(e, st);
      state = UiState.error(appErr.message, code: appErr.code);
    }
  }

  Future<void> selectPeriod(String period) async {
    if (_selectedPeriod == period && state.hasData) return;
    _selectedPeriod = period;

    if (_periodCache.containsKey(period)) {
      state = UiState.success(_periodCache[period]!);
      return;
    }

    state = const UiState.loading();
    await _fetchForPeriod(period, pin: _lastPin, token: _salaryToken);
  }

  Future<void> _fetchForPeriod(String period, {String? pin, String? token}) async {
    final payload = await _repo.fetchPayroll(
      salaryToken: token,
      pin: pin,
      period: period,
    );
    Map<String, dynamic>? payrollData;
    if (payload != null) {
      if (payload['payroll'] is Map<String, dynamic>) {
        payrollData = payload['payroll'] as Map<String, dynamic>;
      } else if (payload.containsKey('basicSalary') ||
          payload.containsKey('baseSalary') ||
          payload.containsKey('netSalary')) {
        payrollData = payload;
      }
    }

    if (payrollData != null) {
      _periodCache[period] = payrollData;
      state = UiState.success(payrollData);
    } else {
      final lastErr = ApiClient.instance.lastError;
      state = UiState.error(
        lastErr?.message ??
            payload?['error'] as String? ??
            'Failed to load salary statement for $period',
        code: lastErr?.code ?? 'PAYROLL_UNAVAILABLE',
      );
    }
  }

  void lock() {
    _salaryToken = null;
    _lastPin = null;
    _periodCache.clear();
    state = const UiState.empty();
  }
}

final salaryStateProvider =
    StateNotifierProvider<SalaryNotifier, UiState<Map<String, dynamic>>>((ref) {
  final repo = ref.watch(salaryRepositoryProvider);
  return SalaryNotifier(repo);
});
