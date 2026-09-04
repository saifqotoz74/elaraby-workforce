import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../firebase_options.dart';
import 'api_client.dart';

/// FCM push notifications.
///
/// Automatically initialized using DefaultFirebaseOptions and google-services.json.
class PushService {
  static final PushService instance = PushService._();
  PushService._();

  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    } catch (_) {
      try {
        await Firebase.initializeApp();
      } catch (_) {
        return;
      }
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
