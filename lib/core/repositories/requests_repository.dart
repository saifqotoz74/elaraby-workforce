import '../data_sources/local_storage_data_source.dart';
import '../../features/services/data/requests_store.dart';

abstract class RequestsRepository {
  List<EmployeeRequest> get requests;
  Future<void> load();
  void addRequest(EmployeeRequest request, {int? days});
  Future<bool> cancelRequest(String id);
  int nextRefNumber();
}

class RequestsRepositoryImpl implements RequestsRepository {
  final LocalStorageDataSource _storage;
  final RequestsStore _store;
  static const _kRefCounter = 'request_ref_counter';

  RequestsRepositoryImpl({
    required LocalStorageDataSource storage,
    RequestsStore? store,
  })  : _storage = storage,
        _store = store ?? RequestsStore.instance;

  @override
  List<EmployeeRequest> get requests => _store.allRequests;

  @override
  Future<void> load() => _store.load();

  @override
  void addRequest(EmployeeRequest request, {int? days}) =>
      _store.addRequest(request, days: days);

  @override
  Future<bool> cancelRequest(String id) => _store.cancelRequest(id);

  @override
  int nextRefNumber() {
    final next = (_storage.getInt(_kRefCounter) ?? 200) + 1;
    _storage.setInt(_kRefCounter, next);
    return next;
  }
}
