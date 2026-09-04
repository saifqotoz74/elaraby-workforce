import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'core/localization/app_locale.dart';
import 'core/network/api_client.dart';
import 'core/network/push_service.dart';
import 'core/network/backend.dart';
import 'core/storage/local_store.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/screens/splash_screen.dart';
import 'features/benefits/data/benefits_content.dart';
import 'features/home/data/home_content.dart';
import 'features/inbox/presentation/screens/inbox_ids.dart';
import 'features/services/data/requests_store.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocalStore.instance.init();
  await ApiClient.instance.init();
  await RequestsStore.instance.load();
  AppLocale.instance.loadFromStorage();
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
    return ListenableBuilder(
      listenable: AppLocale.instance,
      builder: (context, _) {
        return MaterialApp(
          title: 'Elaraby Connect',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
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
          home: initialScreen ?? const SplashScreen(),
        );
      },
    );
  }
}
