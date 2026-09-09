import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/backend.dart';
import '../../../core/storage/local_store.dart';

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
  final bool isPendingSync;

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
    this.isPendingSync = false,
  });

  EmployeeRequest copyWith({
    String? id,
    String? title,
    String? type,
    String? refNumber,
    RequestStatus? status,
    String? date,
    String? summary,
    String? reviewer,
    String? rejectionReason,
    Map<String, String>? details,
    bool? isPendingSync,
  }) {
    return EmployeeRequest(
      id: id ?? this.id,
      title: title ?? this.title,
      type: type ?? this.type,
      refNumber: refNumber ?? this.refNumber,
      status: status ?? this.status,
      date: date ?? this.date,
      summary: summary ?? this.summary,
      reviewer: reviewer ?? this.reviewer,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      details: details ?? this.details,
      isPendingSync: isPendingSync ?? this.isPendingSync,
    );
  }

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
        'isPendingSync': isPendingSync,
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
        isPendingSync: json['isPendingSync'] as bool? ?? false,
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

  List<EmployeeRequest> get pendingSyncRequests =>
      _requests.where((r) => r.isPendingSync).toList();

  /// Server is the source of truth when online — but preserves any local requests
  /// that are still pending upload so they are NEVER erased.
  void replaceAll(List<EmployeeRequest> serverRequests) {
    final localPending = _requests.where((r) => r.isPendingSync).toList();
    final serverRefs = serverRequests.map((s) => s.refNumber).toSet();
    final remainingPending = localPending
        .where((p) => !serverRefs.contains(p.refNumber))
        .toList();

    _requests = [...remainingPending, ...serverRequests];
    _persist();
    notifyListeners();
  }

  /// Flushes all pending offline requests to the server.
  Future<void> flushPending() async {
    if (!Backend.instance.online.value) return;
    final pending = _requests.where((r) => r.isPendingSync).toList();
    if (pending.isEmpty) return;

    var modified = false;
    for (final req in pending) {
      final days = int.tryParse(req.details['days'] ?? '');
      var isPermanentRejection = false;
      String? rejectReason;

      final serverReq = await Backend.instance.submitRequest(
        type: req.type,
        title: req.title,
        details: req.details,
        days: days,
        idempotencyKey: req.id,
        onPermanentError: (err) {
          isPermanentRejection = true;
          rejectReason = err;
        },
      );

      final idx = _requests.indexWhere((r) => r.id == req.id);
      if (serverReq != null && idx != -1) {
        _requests[idx] = req.copyWith(
          id: serverReq.id,
          refNumber: serverReq.refNumber,
          isPendingSync: false,
        );
        modified = true;
      } else if (isPermanentRejection && idx != -1) {
        final days = int.tryParse(req.details['days'] ?? '');
        final isAnnual = req.type == 'Leave' &&
            (req.details['leaveType'] == 'Annual Leave' ||
                req.title.toLowerCase().contains('annual'));
        if (days != null && days > 0 && isAnnual) {
          await LocalStore.instance.addVacationDays(days);
        }
        _requests[idx] = req.copyWith(
          status: RequestStatus.rejected,
          isPendingSync: false,
          summary: rejectReason == 'exceeds_balance'
              ? 'Rejected: Vacation balance exceeded'
              : 'Rejected: Request rejected by policy',
        );
        modified = true;
      }
    }
    if (modified) {
      await _persist();
      notifyListeners();
    }
  }

  void addRequest(EmployeeRequest request, {int? days}) {
    final isOnline = Backend.instance.online.value;
    final pendingReq = request.copyWith(isPendingSync: !isOnline);
    _requests.insert(0, pendingReq);
    _persist();
    notifyListeners();

    if (isOnline) {
      var isPermanentRejection = false;
      String? rejectReason;

      Backend.instance
          .submitRequest(
        type: request.type,
        title: request.title,
        details: request.details,
        days: days,
        idempotencyKey: request.id,
        onPermanentError: (err) {
          isPermanentRejection = true;
          rejectReason = err;
        },
      )
          .then((serverReq) {
        if (serverReq != null) {
          final idx = _requests.indexWhere((r) => r.id == pendingReq.id);
          if (idx != -1) {
            _requests[idx] = pendingReq.copyWith(
              id: serverReq.id,
              refNumber: serverReq.refNumber,
              isPendingSync: false,
            );
            _persist();
            notifyListeners();
          }
        } else if (isPermanentRejection) {
          final isAnnual = pendingReq.type == 'Leave' &&
              (pendingReq.details['leaveType'] == 'Annual Leave' ||
                  pendingReq.title.toLowerCase().contains('annual'));
          if (days != null && days > 0 && isAnnual) {
            LocalStore.instance.addVacationDays(days);
          }
          final idx = _requests.indexWhere((r) => r.id == pendingReq.id);
          if (idx != -1) {
            _requests[idx] = pendingReq.copyWith(
              status: RequestStatus.rejected,
              isPendingSync: false,
              summary: rejectReason == 'exceeds_balance'
                  ? 'Rejected: Vacation balance exceeded'
                  : 'Rejected: Request rejected by policy',
            );
            _persist();
            notifyListeners();
          }
        } else {
          // Transit network failure: preserve in pendingSync queue
          final idx = _requests.indexWhere((r) => r.id == pendingReq.id);
          if (idx != -1 && !_requests[idx].isPendingSync) {
            _requests[idx] = _requests[idx].copyWith(isPendingSync: true);
            _persist();
            notifyListeners();
          }
        }
      }).catchError((_) {
        // Catch unexpected exception: mark pendingSync for flushPending retry
        final idx = _requests.indexWhere((r) => r.id == pendingReq.id);
        if (idx != -1 && !_requests[idx].isPendingSync) {
          _requests[idx] = _requests[idx].copyWith(isPendingSync: true);
          _persist();
          notifyListeners();
        }
      });
    }
  }

  Future<bool> cancelRequest(String id) async {
    final originalIndex = _requests.indexWhere((r) => r.id == id);
    if (originalIndex == -1) return false;
    final originalReq = _requests[originalIndex];

    // Optimistically remove from active list
    _requests.removeAt(originalIndex);
    notifyListeners();

    final isAnnual = originalReq.type == 'Leave' &&
        (originalReq.details['leaveType'] == 'Annual Leave' ||
            originalReq.title.toLowerCase().contains('annual'));
    final leaveDays = int.tryParse(originalReq.details['days'] ?? '');

    if (originalReq.isPendingSync || !Backend.instance.online.value) {
      if (isAnnual && leaveDays != null && leaveDays > 0) {
        await LocalStore.instance.addVacationDays(leaveDays);
      }
      await _persist();
      return true;
    }

    try {
      final success = await Backend.instance.cancelRequest(id);
      if (success) {
        await _persist();
        return true;
      } else {
        // Rollback state if server rejected cancellation
        _requests.insert(originalIndex, originalReq);
        notifyListeners();
        return false;
      }
    } catch (_) {
      // Rollback state on network or unexpected failure
      _requests.insert(originalIndex, originalReq);
      notifyListeners();
      return false;
    }
  }

  void clear() {
    _requests = [];
    _persist();
    notifyListeners();
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
