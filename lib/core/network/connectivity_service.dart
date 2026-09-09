import 'dart:async';
import 'dart:io' show Platform;
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Service managing device network connectivity using `connectivity_plus`.
/// Provides real-time network status, eliminating false "offline" errors on HTTP failures.
class ConnectivityService {
  static final ConnectivityService instance = ConnectivityService._();
  ConnectivityService._();

  Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  final ValueNotifier<bool> isOnlineNotifier = ValueNotifier<bool>(true);
  final StreamController<bool> _connectivityStreamController =
      StreamController<bool>.broadcast();

  bool? _mockIsOnline;

  /// True if the device currently has an active network connection interface.
  bool get isOnline => _mockIsOnline ?? isOnlineNotifier.value;

  /// Listenable for reactive UI widgets (e.g. offline status banners).
  ValueListenable<bool> get onlineListenable => isOnlineNotifier;

  /// Stream emitting connectivity status changes.
  Stream<bool> get onConnectivityChanged =>
      _connectivityStreamController.stream;

  bool get _isTest {
    try {
      return Platform.environment.containsKey('FLUTTER_TEST');
    } on UnsupportedError {
      return false;
    }
  }

  /// Allows unit and widget tests to deterministically simulate online/offline state.
  @visibleForTesting
  void setMockOnline(bool? online) {
    _mockIsOnline = online;
    if (online != null) {
      isOnlineNotifier.value = online;
      _connectivityStreamController.add(online);
    }
  }

  @visibleForTesting
  void setConnectivityForTesting(Connectivity connectivity) {
    _connectivity = connectivity;
  }

  /// Initialize connectivity monitoring.
  Future<void> init() async {
    if (_isTest && _mockIsOnline == null) {
      // In tests, default to online unless explicitly configured
      isOnlineNotifier.value = true;
      return;
    }

    try {
      final results = await _connectivity.checkConnectivity();
      _updateStatus(results);

      await _subscription?.cancel();
      _subscription = _connectivity.onConnectivityChanged.listen(_updateStatus);
    } catch (e) {
      debugPrint(
          'ConnectivityService: Failed to initialize connectivity listener: $e');
      // If plugin fails or unsupported, default to online to avoid false offline lockout
      isOnlineNotifier.value = true;
    }
  }

  /// Explicitly queries current network connectivity.
  Future<bool> checkConnectivity() async {
    if (_mockIsOnline != null) return _mockIsOnline!;
    if (_isTest) return isOnlineNotifier.value;

    try {
      final results = await _connectivity.checkConnectivity();
      _updateStatus(results);
      return isOnlineNotifier.value;
    } catch (e) {
      debugPrint('ConnectivityService: checkConnectivity error: $e');
      return isOnlineNotifier.value;
    }
  }

  void _updateStatus(List<ConnectivityResult> results) {
    // If results contains only 'none' or is empty, device is disconnected
    final hasConnection =
        results.isNotEmpty && results.any((r) => r != ConnectivityResult.none);

    final previous = isOnlineNotifier.value;
    isOnlineNotifier.value = hasConnection;

    if (previous != hasConnection) {
      _connectivityStreamController.add(hasConnection);
    }
  }

  void dispose() {
    _subscription?.cancel();
    _connectivityStreamController.close();
  }
}
