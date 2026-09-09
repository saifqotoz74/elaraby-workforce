import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/providers/repository_providers.dart';
import '../../../../core/repositories/requests_repository.dart';
import '../../../../core/state/ui_state.dart';
import '../../data/requests_store.dart';

class RequestsNotifier extends StateNotifier<UiState<List<EmployeeRequest>>> {
  final RequestsRepository _repo;

  RequestsNotifier(this._repo) : super(const UiState.loading()) {
    loadRequests();
  }

  Future<void> loadRequests({bool forceRefresh = false}) async {
    if (state.hasData && !forceRefresh) {
      state = UiState.refreshing(state.data!);
    } else {
      state = const UiState.loading();
    }

    try {
      await _repo.load();
      final list = _repo.requests;
      if (list.isEmpty) {
        state = const UiState.empty();
      } else {
        state = UiState.success(list);
      }
    } catch (e) {
      state = UiState.error(
        e.toString(),
        previousData: _repo.requests.isNotEmpty ? _repo.requests : null,
      );
    }
  }

  Future<void> refreshFromBackend() async {
    if (state.hasData) {
      state = UiState.refreshing(state.data!);
    }
    try {
      await Backend.instance.syncRequests();
      await _repo.load();
      final list = _repo.requests;
      if (list.isEmpty) {
        state = const UiState.empty();
      } else {
        state = UiState.success(list);
      }
    } catch (e) {
      state = UiState.error(
        e.toString(),
        previousData: _repo.requests.isNotEmpty ? _repo.requests : null,
      );
    }
  }

  void addRequest(EmployeeRequest request, {int? days}) {
    _repo.addRequest(request, days: days);
    final list = _repo.requests;
    state = UiState.success(list);
  }

  Future<bool> cancelRequest(String id) async {
    final success = await _repo.cancelRequest(id);
    if (success) {
      final list = _repo.requests;
      if (list.isEmpty) {
        state = const UiState.empty();
      } else {
        state = UiState.success(list);
      }
    }
    return success;
  }
}

final requestsStateProvider =
    StateNotifierProvider<RequestsNotifier, UiState<List<EmployeeRequest>>>(
        (ref) {
  final repo = ref.watch(requestsRepositoryProvider);
  return RequestsNotifier(repo);
});
