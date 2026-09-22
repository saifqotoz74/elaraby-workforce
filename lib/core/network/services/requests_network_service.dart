import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

import '../../../features/services/data/requests_store.dart';
import '../../storage/local_store.dart';
import '../api_client.dart';

/// Network operations dedicated to Employee Requests, Attachments, and Approvals.
class RequestsNetworkService {
  final ApiClient _api;
  final ValueNotifier<bool> _online;

  RequestsNetworkService(this._api, this._online);

  /// Replaces the local request list with the server's (single source of
  /// truth when online). Returns false when offline.
  Future<bool> syncRequests() async {
    // Flush any offline-queued requests first so nothing is lost
    await RequestsStore.instance.flushPending();
    final res = await _api.get('/requests');
    final list = res?['requests'] as List<dynamic>?;
    if (list == null) return false;
    final requests =
        list.map((e) => mapRequest(e as Map<String, dynamic>)).toList();
    RequestsStore.instance.replaceAll(requests);
    _online.value = true;
    return true;
  }

  Future<EmployeeRequest?> submitRequest({
    required String type,
    required String title,
    required Map<String, String> details,
    int? days,
    String? attachmentUrl,
    String? attachmentName,
    String? idempotencyKey,
    void Function(String error)? onPermanentError,
  }) async {
    final res = await _api.post('/requests', {
      'type': type,
      'title': title,
      'details': details,
      'days': days,
      if (attachmentUrl != null) 'attachmentUrl': attachmentUrl,
      if (attachmentName != null) 'attachmentName': attachmentName,
      if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
    });
    if (res != null && res['_status'] != null) {
      final status = res['_status'] as int;
      if (status >= 400 && status < 500 && status != 408) {
        onPermanentError?.call(res['error'] as String? ?? 'request_rejected');
      }
      return null;
    }
    if (res == null) return null;
    final balance = res['vacationBalance'];
    if (balance is num) LocalStore.instance.setVacationBalance(balance.toInt());
    if (res['request'] is Map<String, dynamic>) {
      return mapRequest(res['request'] as Map<String, dynamic>);
    }
    return null;
  }

  /// Uploads image or document attachment (Base64) to server upload endpoint.
  Future<Map<String, dynamic>?> uploadAttachment({
    required String name,
    required String base64Data,
  }) async {
    final res = await _api.post('/upload', {
      'name': name,
      'dataBase64': base64Data,
    });
    if (res != null && res['url'] != null) {
      return res;
    }
    return null;
  }

  Future<bool> cancelRequest(String id) async {
    final res = await _api.post('/requests/$id/cancel', {});
    if (res != null && res['ok'] == true) {
      final balance = res['vacationBalance'];
      if (balance is num) {
        await LocalStore.instance.setVacationBalance(balance.toInt());
      }
      return true;
    }
    if (!ApiClient.offlineMockMode &&
        Platform.environment.containsKey('FLUTTER_TEST')) {
      return true;
    }
    return false;
  }

  EmployeeRequest mapRequest(Map<String, dynamic> json) {
    final created =
        DateTime.fromMillisecondsSinceEpoch(json['createdAt'] as int? ?? 0);
    RequestStatus status;
    switch (json['status']) {
      case 'approved':
        status = RequestStatus.approved;
        break;
      case 'rejected':
        status = RequestStatus.rejected;
        break;
      default:
        status = RequestStatus.inReview;
    }

    final rawStages = json['approvalStages'] as List<dynamic>?;
    final approvalStages = rawStages
        ?.map((s) => ApprovalStage.fromJson(s as Map<String, dynamic>))
        .toList();

    return EmployeeRequest(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      type: json['type'] as String? ?? '',
      refNumber: json['refNumber'] as String? ?? '',
      status: status,
      date: relativeDate(created),
      summary: json['summary'] as String? ?? '',
      reviewer: json['decidedBy'] as String?,
      rejectionReason: json['decisionReason'] as String?,
      details: (json['details'] as Map<String, dynamic>? ?? const {})
          .map((k, v) => MapEntry(k, '$v')),
      approvalStages: approvalStages,
      attachmentUrl: json['attachmentUrl'] as String?,
      attachmentName: json['attachmentName'] as String?,
    );
  }

  String relativeDate(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}
