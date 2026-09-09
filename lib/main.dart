import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'core/localization/app_locale.dart';
import 'core/network/api_client.dart';
import 'core/network/push_service.dart';
import 'core/network/backend.dart';
import 'core/storage/local_store.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/screens/pin_lock_screen.dart';
import 'features/auth/presentation/screens/splash_screen.dart';
import 'features/benefits/data/benefits_content.dart';
import 'features/home/data/home_content.dart';
import 'features/inbox/presentation/screens/inbox_ids.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'features/services/data/requests_store.dart';

final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Bounded image cache to prevent Out-Of-Memory crashes on factory workers' budget devices
  PaintingBinding.instance.imageCache.maximumSizeBytes =
      30 * 1024 * 1024; // 30 MB max
  PaintingBinding.instance.imageCache.maximumSize = 50; // 50 images max

  await LocalStore.instance.init();
  await ApiClient.instance.init();
  await RequestsStore.instance.load();
  AppLocale.instance.loadFromStorage();
  AppTheme.init();
  InboxIds.instance.load();

  // Route back to lock screen automatically whenever backend revokes session token (401)
  ApiClient.onSessionExpired = () {
    appNavigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const PinLockScreen()),
      (route) => false,
    );
  };

  // Reach out to the backend when available; the app stays fully usable
  // offline either way.
  PushService.instance.init();
  Backend.instance.ping().then((online) {
    if (online) {
      Backend.instance.syncProfile();
      Backend.instance.syncRequests();
      if (ApiClient.instance.token != null) {
        HomeContent.instance.load();
        BenefitsContent.instance.load();
      }
    }
  });
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const ElarabyWorkforceApp());
}

class ElarabyWorkforceApp extends StatelessWidget {
  final Widget? initialScreen;

  const ElarabyWorkforceApp({
    super.key,
    this.initialScreen,
  });

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      child: ListenableBuilder(
        listenable: Listenable.merge([
          AppLocale.instance,
          AppTheme.themeModeNotifier,
        ]),
        builder: (context, _) {
          return MaterialApp(
            navigatorKey: appNavigatorKey,
            title: 'Elaraby Connect',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: AppTheme.themeModeNotifier.value,
            locale: AppLocale.instance.currentLocale,
            supportedLocales: const [
              Locale('en'),
              Locale('ar'),
            ],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            builder: (context, child) {
              final mediaQuery = MediaQuery.of(context);
              return MediaQuery(
                data: mediaQuery.copyWith(
                  textScaler: mediaQuery.textScaler.clamp(
                    minScaleFactor: 1.0,
                    maxScaleFactor: 1.25,
                  ),
                ),
                child: child ?? const SizedBox.shrink(),
              );
            },
            home: initialScreen ?? const SplashScreen(),
          );
        },
      ),
    );
  }
}
