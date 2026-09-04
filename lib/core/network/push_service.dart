import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'api_client.dart';

/// FCM push notifications.
///
/// Activates only when `android/app/google-services.json` exists (see
/// android/app/build.gradle — the Google Services plugin is applied
/// conditionally). Without the file everything here is a no-op and the app
/// keeps working with pull-based inbox refresh.
class PushService {
  static final PushService instance = PushService._();
  PushService._();

  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      await Firebase.initializeApp();
    } catch (_) {
      // No google-services.json / not supported platform — skip silently.
      return;
    }

    // Permission prompt (notifications are denied by default on Android 13+).
    await FirebaseMessaging.instance.requestPermission();

    // Register the current device token with the backend.
    final token = await FirebaseMessaging.instance.getToken();
    await _registerToken(token);
    FirebaseMessaging.instance.onTokenRefresh.listen(_registerToken);
  }

  Future<void> _registerToken(String? token) async {
    if (token == null) return;
    // The backend needs to know whose device this is — only send when the
    // user has a session (before login there is nothing to attribute).
    if (ApiClient.instance.token == null) return;
    await ApiClient.instance.post('/fcm-token', {'token': token});
  }
}
