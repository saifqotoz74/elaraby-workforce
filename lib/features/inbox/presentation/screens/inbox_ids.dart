import 'package:flutter/foundation.dart';

import '../../../../core/storage/local_store.dart';

/// Central registry of inbox item ids and their read state (persisted via
/// [LocalStore]). Widgets listen to this ChangeNotifier to keep badges in
/// sync across the bell button, the inbox tab and "mark all as read".
class InboxIds extends ChangeNotifier {
  static final InboxIds instance = InboxIds._();
  InboxIds._();

  // Canonical inbox item ids (match offline/seeded defaults).
  static const shiftPolicy = 'inbox_shift_policy';
  static const leaveApproved = 'inbox_leave_approved';
  static const newDiscount = 'inbox_new_discount';
  static const salarySlip = 'inbox_salary_slip';

  static const defaultIds = [
    shiftPolicy,
    leaveApproved,
    newDiscount,
    salarySlip,
  ];

  static List<String> get all => instance._knownIds.toList();

  final Set<String> _knownIds = {...defaultIds};
  Set<String> _read = {};

  /// Dynamically registers server notifications into tracking
  void registerServerNotifications(List<dynamic> notes) {
    for (final n in notes) {
      final id = n.id as String;
      _knownIds.add(id);
      if (n.read == true) {
        _read.add(id);
      }
    }
    notifyListeners();
  }

  /// Call once at startup (main.dart) after LocalStore.init().
  void load() {
    _read = LocalStore.instance.readInboxIds;
  }

  int get unreadCount => _knownIds.where((id) => !_read.contains(id)).length;

  bool isRead(String id) => _read.contains(id);

  Future<void> markRead(String id) async {
    if (_read.contains(id)) return;
    _read = {..._read, id};
    await LocalStore.instance.markInboxRead([id]);
    notifyListeners();
  }

  Future<void> markAllRead() async {
    _read = {..._knownIds};
    await LocalStore.instance.markInboxRead(_knownIds);
    notifyListeners();
  }
}
