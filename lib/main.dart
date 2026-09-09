import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/localization/app_locale.dart';
import 'l10n/generated/app_localizations.dart';
import 'core/navigation/app_router.dart';
import 'core/network/api_client.dart';
import 'core/network/backend.dart';
import 'core/network/connectivity_service.dart';
import 'core/network/push_service.dart';
import 'core/storage/local_store.dart';
import 'core/theme/app_theme.dart';
import 'features/benefits/data/benefits_content.dart';
import 'features/home/data/home_content.dart';
import 'features/inbox/presentation/screens/inbox_ids.dart';
import 'features/services/data/requests_store.dart';

GlobalKey<NavigatorState> get appNavigatorKey => rootNavigatorKey;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Bounded image cache to prevent Out-Of-Memory crashes on factory workers' budget devices
  PaintingBinding.instance.imageCache.maximumSizeBytes =
      30 * 1024 * 1024; // 30 MB max
  PaintingBinding.instance.imageCache.maximumSize = 50; // 50 images max

  await ConnectivityService.instance.init();
  await LocalStore.instance.init();
  await ApiClient.instance.init();
  await RequestsStore.instance.load();
  AppLocale.instance.loadFromStorage();
  AppTheme.init();
  InboxIds.instance.load();

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
  runApp(
    const ProviderScope(
      child: ElarabyWorkforceApp(),
    ),
  );
}

class ElarabyWorkforceApp extends ConsumerWidget {
  final Widget? initialScreen;

  const ElarabyWorkforceApp({
    super.key,
    this.initialScreen,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return ListenableBuilder(
      listenable: Listenable.merge([
        AppLocale.instance,
        AppTheme.themeModeNotifier,
      ]),
      builder: (context, _) {
        if (initialScreen != null) {
          return MaterialApp(
            navigatorKey: rootNavigatorKey,
            title: 'Elaraby Connect',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: AppTheme.themeModeNotifier.value,
            locale: AppLocale.instance.currentLocale,
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
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
            home: initialScreen,
          );
        }

        return MaterialApp.router(
          routerConfig: router,
          title: 'Elaraby Connect',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: AppTheme.themeModeNotifier.value,
          locale: AppLocale.instance.currentLocale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
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
        );
      },
    );
  }
}
