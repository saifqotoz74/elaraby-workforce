import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/providers/repository_providers.dart';
import '../../../../core/repositories/profile_repository.dart';
import '../../../../core/state/ui_state.dart';
import '../../../../core/storage/local_store.dart';

class ProfileNotifier extends StateNotifier<UiState<EmployeeProfile>> {
  final ProfileRepository _repo;

  ProfileNotifier(this._repo) : super(UiState.success(_repo.profile));

  Future<void> refresh() async {
    state = UiState.refreshing(state.data ?? _repo.profile);
    try {
      await _repo.syncProfile();
      state = UiState.success(_repo.profile);
    } catch (e) {
      state = UiState.error(
        e.toString(),
        previousData: _repo.profile,
      );
    }
  }

  Future<void> updateProfile(EmployeeProfile profile) async {
    state = UiState.loading(state.data);
    try {
      await _repo.saveProfile(profile);
      state = UiState.success(_repo.profile);
    } catch (e) {
      state = UiState.error(e.toString(), previousData: _repo.profile);
    }
  }
}

class VacationBalanceNotifier extends StateNotifier<int> {
  final ProfileRepository _repo;

  VacationBalanceNotifier(this._repo) : super(_repo.vacationDaysRemaining);

  Future<void> deductDays(int days) async {
    await _repo.deductVacationDays(days);
    state = _repo.vacationDaysRemaining;
  }

  Future<void> addDays(int days) async {
    await _repo.addVacationDays(days);
    state = _repo.vacationDaysRemaining;
  }

  Future<void> setBalance(int days) async {
    await _repo.setVacationBalance(days);
    state = _repo.vacationDaysRemaining;
  }

  void refresh() {
    state = _repo.vacationDaysRemaining;
  }
}

final profileStateProvider =
    StateNotifierProvider<ProfileNotifier, UiState<EmployeeProfile>>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return ProfileNotifier(repo);
});

final vacationBalanceProvider =
    StateNotifierProvider<VacationBalanceNotifier, int>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return VacationBalanceNotifier(repo);
});
