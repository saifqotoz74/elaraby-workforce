import 'dart:convert';
import 'dart:io' show Platform;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../firebase_options.dart';
import 'api_client.dart';

/// Notification permission status states handled explicitly per Phase 12.
enum NotificationPermissionStatus {
  granted,
  denied,
  permanentlyDenied,
}

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

  NotificationPermissionStatus? _mockStatus;
  final ValueNotifier<NotificationPermissionStatus> permissionStatusNotifier =
      ValueNotifier(NotificationPermissionStatus.denied);

  NotificationPermissionStatus get permissionStatus =>
      _mockStatus ?? permissionStatusNotifier.value;

  /// Injected for test hermeticity.
  @visibleForTesting
  void setMockPermissionStatus(NotificationPermissionStatus? status) {
    _mockStatus = status;
    if (status != null) {
      permissionStatusNotifier.value = status;
    }
  }

  /// Initializes messaging handlers and channels WITHOUT prompting the user for permissions.
  /// Permission prompt is strictly deferred to contextual post-authentication flows.
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return;
    }

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

  /// Request notification permission contextually after authentication.
  /// Handles granted, denied, and permanently denied states.
  Future<NotificationPermissionStatus> requestPermissionContextually() async {
    if (_mockStatus != null) return _mockStatus!;
    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      final status = _mockStatus ?? NotificationPermissionStatus.granted;
      permissionStatusNotifier.value = status;
      return status;
    }

    try {
      final currentSettings =
          await FirebaseMessaging.instance.getNotificationSettings();

      // If already authorized, register token and return granted
      if (currentSettings.authorizationStatus ==
              AuthorizationStatus.authorized ||
          currentSettings.authorizationStatus ==
              AuthorizationStatus.provisional) {
        permissionStatusNotifier.value = NotificationPermissionStatus.granted;
        await registerCurrentToken();
        return NotificationPermissionStatus.granted;
      }

      final prefs = await SharedPreferences.getInstance();
      final previouslyRequested =
          prefs.getBool('notif_permission_previously_requested') ?? false;

      // If already denied previously and OS blocks re-prompting without system settings
      if (previouslyRequested &&
          currentSettings.authorizationStatus == AuthorizationStatus.denied) {
        permissionStatusNotifier.value =
            NotificationPermissionStatus.permanentlyDenied;
        return NotificationPermissionStatus.permanentlyDenied;
      }

      // Mark as requested and trigger system permission dialog
      await prefs.setBool('notif_permission_previously_requested', true);
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      final NotificationPermissionStatus finalStatus;
      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        finalStatus = NotificationPermissionStatus.granted;
        await registerCurrentToken();
      } else {
        finalStatus = previouslyRequested
            ? NotificationPermissionStatus.permanentlyDenied
            : NotificationPermissionStatus.denied;
      }

      permissionStatusNotifier.value = finalStatus;
      return finalStatus;
    } catch (e) {
      debugPrint('PushService requestPermissionContextually error: $e');
      return NotificationPermissionStatus.denied;
    }
  }

  /// Checks the current system notification permission state without prompting.
  Future<NotificationPermissionStatus> checkPermissionStatus() async {
    if (_mockStatus != null) return _mockStatus!;
    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return _mockStatus ?? NotificationPermissionStatus.granted;
    }

    try {
      final settings =
          await FirebaseMessaging.instance.getNotificationSettings();
      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        return NotificationPermissionStatus.granted;
      }
      final prefs = await SharedPreferences.getInstance();
      final previouslyRequested =
          prefs.getBool('notif_permission_previously_requested') ?? false;
      if (previouslyRequested &&
          settings.authorizationStatus == AuthorizationStatus.denied) {
        return NotificationPermissionStatus.permanentlyDenied;
      }
      return NotificationPermissionStatus.denied;
    } catch (e) {
      return NotificationPermissionStatus.denied;
    }
  }

  Future<void> _registerToken(String? token) async {
    if (token == null) return;
    if (ApiClient.instance.token == null) return;
    await ApiClient.instance.post('/fcm-token', {'token': token});
  }

  Future<void> registerCurrentToken() async {
    if (Platform.environment.containsKey('FLUTTER_TEST')) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      await _registerToken(token);
    } on Exception catch (e) {
      debugPrint('PushService registerCurrentToken error: $e');
    }
  }

  Future<void> unregisterToken() async {
    if (Platform.environment.containsKey('FLUTTER_TEST')) return;
    try {
      await FirebaseMessaging.instance.deleteToken();
    } on Exception catch (e) {
      debugPrint('PushService unregisterToken error: $e');
    }
  }
}
