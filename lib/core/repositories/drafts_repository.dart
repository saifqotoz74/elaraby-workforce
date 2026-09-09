import 'dart:convert';
import '../data_sources/local_storage_data_source.dart';

abstract class DraftsRepository {
  Future<void> saveDraft(String formKey, Map<String, dynamic> data);
  Map<String, dynamic>? getDraft(String formKey);
  Future<void> clearDraft(String formKey);
}

class DraftsRepositoryImpl implements DraftsRepository {
  final LocalStorageDataSource _storage;
  final Map<String, Map<String, dynamic>> _draftsCache = {};

  DraftsRepositoryImpl({required LocalStorageDataSource storage})
      : _storage = storage;

  @override
  Future<void> saveDraft(String formKey, Map<String, dynamic> data) async {
    _draftsCache[formKey] = data;
    final serialized = jsonEncode(data);
    await _storage.setString('draft_$formKey', serialized);
  }

  @override
  Map<String, dynamic>? getDraft(String formKey) {
    if (_draftsCache.containsKey(formKey)) {
      return _draftsCache[formKey];
    }
    final raw = _storage.getString('draft_$formKey');
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      _draftsCache[formKey] = decoded;
      return decoded;
    } on FormatException {
      return null;
    } on TypeError {
      return null;
    }
  }

  @override
  Future<void> clearDraft(String formKey) async {
    _draftsCache.remove(formKey);
    await _storage.remove('draft_$formKey');
  }
}
