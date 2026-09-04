import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/backend.dart';

enum RequestStatus { inReview, approved, rejected }

class EmployeeRequest {
  final String id;
  final String title;
  final String type;
  final String refNumber;
  final RequestStatus status;
  final String date;
  final String summary;
  final String? reviewer;
  final String? rejectionReason;
  final Map<String, String> details;

  const EmployeeRequest({
    required this.id,
    required this.title,
    required this.type,
    required this.refNumber,
    required this.status,
    required this.date,
    required this.summary,
    this.reviewer,
    this.rejectionReason,
    this.details = const {},
  });

  String get statusLabel {
    switch (status) {
      case RequestStatus.inReview:
        return 'In Review';
      case RequestStatus.approved:
        return 'Approved';
      case RequestStatus.rejected:
        return 'Rejected';
    }
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'type': type,
        'refNumber': refNumber,
        'status': status.index,
        'date': date,
        'summary': summary,
        'reviewer': reviewer,
        'rejectionReason': rejectionReason,
        'details': details,
      };

  factory EmployeeRequest.fromJson(Map<String, dynamic> json) =>
      EmployeeRequest(
        id: json['id'] as String,
        title: json['title'] as String,
        type: json['type'] as String,
        refNumber: json['refNumber'] as String,
        status: RequestStatus.values[json['status'] as int],
        date: json['date'] as String,
        summary: json['summary'] as String,
        reviewer: json['reviewer'] as String?,
        rejectionReason: json['rejectionReason'] as String?,
        details: (json['details'] as Map<String, dynamic>? ?? const {})
            .map((k, v) => MapEntry(k, v as String)),
      );
}

/// ChangeNotifier store persisted to [SharedPreferences] as JSON, so requests
/// survive restarts. Seeded once with demo data on first launch.
class RequestsStore extends ChangeNotifier {
  static const _kRequests = 'employee_requests';

  static final RequestsStore instance = RequestsStore._();
  RequestsStore._();

  List<EmployeeRequest> _requests = [];

  /// Must be awaited once at startup (see `main.dart`) before reading data.
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_kRequests);
    if (stored == null) {
      _requests = _seedRequests;
      await _persist();
      return;
    }
    try {
      final list = jsonDecode(stored) as List<dynamic>;
      _requests = list
          .map((e) => EmployeeRequest.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      _requests = _seedRequests;
      await _persist();
    }
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _kRequests,
      jsonEncode(_requests.map((r) => r.toJson()).toList()),
    );
  }

  List<EmployeeRequest> get allRequests => List.unmodifiable(_requests);

  List<EmployeeRequest> get inReviewRequests =>
      _requests.where((r) => r.status == RequestStatus.inReview).toList();

  List<EmployeeRequest> get approvedRequests =>
      _requests.where((r) => r.status == RequestStatus.approved).toList();

  List<EmployeeRequest> get rejectedRequests =>
      _requests.where((r) => r.status == RequestStatus.rejected).toList();

  /// Server is the source of truth when online — swaps the whole list.
  void replaceAll(List<EmployeeRequest> requests) {
    _requests = requests;
    _persist();
    notifyListeners();
  }

  void addRequest(EmployeeRequest request, {int? days}) {
    _requests.insert(0, request);
    _persist();
    notifyListeners();
    // Mirror to the backend (no-op when offline; re-sync happens on next load).
    Backend.instance.submitRequest(
      type: request.type,
      title: request.title,
      details: request.details,
      days: days,
    );
  }

  void cancelRequest(String id) {
    _requests.removeWhere((r) => r.id == id);
    _persist();
    notifyListeners();
    Backend.instance.cancelRequest(id);
  }

  static List<EmployeeRequest> get _seedRequests => [
        EmployeeRequest(
          id: '1',
          title: 'Annual Leave Request',
          type: 'Leave',
          refNumber: 'LEV-2026-089',
          status: RequestStatus.inReview,
          date: 'Submitted 3 days ago',
          summary: 'Waiting on: Line Manager Approval',
          reviewer: 'Line Manager (Mohamed Hassan)',
          details: {
            'Duration': '3 days',
            'Dates': '12 – 14 Oct 2026',
            'Submitted': '3 days ago',
          },
        ),
        EmployeeRequest(
          id: '2',
          title: 'Salary Slip',
          type: 'Salary Slip',
          refNumber: 'SAL-2026-118',
          status: RequestStatus.approved,
          date: 'Generated 30 mins ago',
          summary: 'Available to download',
          reviewer: 'HR Automated Payroll',
          details: {
            'Period': 'Jul 2026',
            'Generated': '30 mins ago',
          },
        ),
        EmployeeRequest(
          id: '3',
          title: 'HR Request',
          type: 'Salary Certificate',
          refNumber: 'HR-2026-104',
          status: RequestStatus.approved,
          date: 'Requested 28 Jul 2026',
          summary: 'Document signed by HR',
          reviewer: 'HR — Mona Adel',
          details: {
            'Request Type': 'Salary Certificate',
            'Requested': '28 Jul 2026',
            'Signed by': 'HR — Mona Adel',
          },
        ),
        EmployeeRequest(
          id: '4',
          title: 'HR Request',
          type: 'Experience Certificate',
          refNumber: 'HR-2026-119',
          status: RequestStatus.rejected,
          date: 'Requested 28 Jul 2026',
          summary: 'Rejected by HR',
          reviewer: 'HR — Mona Adel',
          rejectionReason: "Please resubmit with manager's signature",
          details: {
            'Request Type': 'Experience Certificate',
            'Requested': '28 Jul 2026',
            'Rejected by': 'HR — Mona Adel',
          },
        ),
      ];
}
