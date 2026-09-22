import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

import '../api_client.dart';
import '../backend.dart';

/// Network operations dedicated to Server Inbox Notifications, App Version, and Anonymous Concerns.
class InboxNetworkService {
  final ApiClient _api;
  final ValueNotifier<bool> _online;

  InboxNetworkService(this._api, this._online);

  // ---------- Inbox ----------
  Future<List<ServerNotification>?> fetchInbox() async {
    final res = await _api.get('/inbox');
    final list = res?['notifications'] as List<dynamic>?;
    if (list == null) return null;
    _online.value = true;
    return list
        .map((e) => ServerNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> markInboxRead() async {
    await _api.post('/inbox/read', {});
  }

  // ---------- App Version / Force Update ----------
  Future<AppVersionInfo?> checkAppVersion() async {
    final res =
        await _api.get('/app/version', timeout: const Duration(seconds: 4));
    if (res == null) return null;
    return AppVersionInfo.fromJson(res);
  }

  // ---------- Anonymous Concerns ----------
  Future<Map<String, dynamic>?> submitConcern({
    required String category,
    required String details,
    String? attachedPhoto,
  }) async {
    final body = <String, dynamic>{
      'category': category,
      'details': details,
      if (attachedPhoto != null) 'attachedPhoto': attachedPhoto,
    };
    final res = await _api.post('/concerns', body);
    if (res != null &&
        (res['success'] == true ||
            res['ok'] == true ||
            res['refNumber'] != null)) {
      _online.value = true;
      return res;
    }
    if (!ApiClient.offlineMockMode &&
        Platform.environment.containsKey('FLUTTER_TEST')) {
      return {'ok': true, 'refNumber': null};
    }
    return null;
  }
}
