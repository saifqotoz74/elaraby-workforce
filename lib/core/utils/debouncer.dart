import 'dart:async';
import 'package:flutter/foundation.dart';

/// Debouncer to prevent expensive operations (e.g. disk persistence, network queries)
/// from executing on every keystroke or rapid event.
///
/// Executes the debounced action after [delay] (default 600ms) of inactivity.
/// Supports immediate flushing on dispose, navigation, or app backgrounding.
class Debouncer {
  final Duration delay;
  Timer? _timer;
  VoidCallback? _pendingAction;

  Debouncer({this.delay = const Duration(milliseconds: 600)});

  bool get hasPending => _timer?.isActive ?? false;

  /// Runs [action] after [delay] has elapsed without new calls.
  void run(VoidCallback action) {
    _timer?.cancel();
    _pendingAction = action;
    _timer = Timer(delay, () {
      _pendingAction = null;
      action();
    });
  }

  /// Immediately executes any pending action and cancels the timer.
  /// Useful in [State.dispose] or navigation callbacks to ensure no data is lost.
  void flush() {
    if (_timer?.isActive ?? false) {
      _timer?.cancel();
      final action = _pendingAction;
      _pendingAction = null;
      action?.call();
    }
  }

  /// Cancels any scheduled pending action without executing it.
  void cancel() {
    _timer?.cancel();
    _pendingAction = null;
  }
}
