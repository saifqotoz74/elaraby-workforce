import 'package:flutter/foundation.dart';

import '../../../../core/storage/local_store.dart';

/// Central registry of inbox item ids and their read state (persisted via
/// [LocalStore]). Widgets listen to this ChangeNotifier to keep badges in
/// sync across the bell button, the inbox tab and "mark all as read".
class InboxIds extends ChangeNotifier {
  static final InboxIds instance = InboxIds._();
  InboxIds._();

  // Canonical inbox item ids (match the cards in inbox_screen.dart).
  static const shiftPolicy = 'inbox_shift_policy';
  static const leaveApproved = 'inbox_leave_approved';
  static const newDiscount = 'inbox_new_discount';
  static const salarySlip = 'inbox_salary_slip';

  static const all = [
    shiftPolicy,
    leaveApproved,
    newDiscount,
    salarySlip,
  ];

  Set<String> _read = {};

  /// Call once at startup (main.dart) after LocalStore.init().
  void load() {
    _read = LocalStore.instance.readInboxIds;
  }

  int get unreadCount => all.where((id) => !_read.contains(id)).length;

  bool isRead(String id) => _read.contains(id);

  Future<void> markRead(String id) async {
    if (_read.contains(id)) return;
    _read = {..._read, id};
    await LocalStore.instance.markInboxRead([id]);
    notifyListeners();
  }

  Future<void> markAllRead() async {
    _read = {...all};
    await LocalStore.instance.markInboxRead(all);
    notifyListeners();
  }
}
