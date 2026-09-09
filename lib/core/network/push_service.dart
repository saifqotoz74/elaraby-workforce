import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../firebase_options.dart';
import 'api_client.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } on Exception catch (e) {
    debugPrint('FCM background handler Firebase init exception: $e');
  }
}

/// FCM push notifications with foreground heads-up banner via [FlutterLocalNotificationsPlugin].
class PushService {
  static final PushService instance = PushService._();
  PushService._();

  static void Function(Map<String, dynamic> data)? onNotificationTapped;

  bool _initialized = false;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static const AndroidNotificationChannel _highImportanceChannel =
      AndroidNotificationChannel(
    'elaraby_high_importance_channel',
    'Elaraby Connect Notifications',
    description: 'Notifications and announcements from Elaraby Workforce.',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    } on Exception catch (e1) {
      try {
        await Firebase.initializeApp();
      } on Exception catch (e2) {
        debugPrint('PushService Firebase init failed: $e1 / $e2');
        return;
      }
    }

    // Register top-level background message handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Initialize local notifications for foreground heads-up display
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings iosSettings =
        DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const InitializationSettings initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final payload = response.payload;
        if (payload != null && payload.isNotEmpty) {
          try {
            final data = jsonDecode(payload) as Map<String, dynamic>;
            onNotificationTapped?.call(data);
          } on FormatException catch (e) {
            debugPrint('PushService: Corrupted notification payload: $e');
          }
        }
      },
    );

    // Create high-importance channel on Android
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_highImportanceChannel);

    // Permission prompt (notifications are denied by default on Android 13+).
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return;
    }

    // Capture token and send to backend
    await registerCurrentToken();

    // Listen for FCM token refreshes
    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      _registerToken(token);
    });

    // Foreground message presentation -> show local notification
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final notif = message.notification;
      if (notif == null) return;
      _localNotifications.show(
        message.hashCode,
        notif.title,
        notif.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _highImportanceChannel.id,
            _highImportanceChannel.name,
            channelDescription: _highImportanceChannel.description,
            importance: Importance.max,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        payload: jsonEncode(message.data),
      );
    });

    // Background tap -> app opens
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      onNotificationTapped?.call(message.data);
    });

    // Cold-start tap (app was terminated)
    FirebaseMessaging.instance
        .getInitialMessage()
        .then((RemoteMessage? message) {
      if (message != null) {
        onNotificationTapped?.call(message.data);
      }
    });
  }

  Future<void> _registerToken(String? token) async {
    if (token == null) return;
    if (ApiClient.instance.token == null) return;
    await ApiClient.instance.post('/fcm-token', {'token': token});
  }

  Future<void> registerCurrentToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      await _registerToken(token);
    } on Exception catch (e) {
      debugPrint('PushService registerCurrentToken error: $e');
    }
  }

  Future<void> unregisterToken() async {
    try {
      await FirebaseMessaging.instance.deleteToken();
    } on Exception catch (e) {
      debugPrint('PushService unregisterToken error: $e');
    }
  }
}
