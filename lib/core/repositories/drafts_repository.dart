import 'dart:convert';
import '../data_sources/local_storage_data_source.dart';

abstract class DraftsRepository {
  Future<void> saveDraft(String formKey, Map<String, dynamic> data);
  Map<String, dynamic>? getDraft(String formKey);
  Future<void> clearDraft(String formKey);
}

class DraftsRepositoryImpl implements DraftsRepository {
  final LocalStorageDataSource _storage;
  final Map<String, Map<String, dynamic>> _secureDraftsCache = {};

  DraftsRepositoryImpl({required LocalStorageDataSource storage})
      : _storage = storage;

  @override
  Future<void> saveDraft(String formKey, Map<String, dynamic> data) async {
    final serialized = jsonEncode(data);
    if (formKey == 'raise_concern') {
      _secureDraftsCache[formKey] = data;
      await _storage.writeSecure('sec_draft_$formKey', serialized);
      await _storage.remove('draft_$formKey');
      return;
    }
    await _storage.setString('draft_$formKey', serialized);
  }

  @override
  Map<String, dynamic>? getDraft(String formKey) {
    if (formKey == 'raise_concern' && _secureDraftsCache.containsKey(formKey)) {
      return _secureDraftsCache[formKey];
    }
    final raw = _storage.getString('draft_$formKey');
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> clearDraft(String formKey) async {
    _secureDraftsCache.remove(formKey);
    if (formKey == 'raise_concern') {
      await _storage.deleteSecure('sec_draft_$formKey');
    }
    await _storage.remove('draft_$formKey');
  }
}
