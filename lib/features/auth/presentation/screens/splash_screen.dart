import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../common/presentation/widgets/update_dialog.dart';
import '../../../../core/navigation/app_navigation.dart';
import '../../../../core/tenant/tenant_brand_logo.dart';
import '../../../../core/theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAppAndNavigate();
  }

  Future<void> _checkAppAndNavigate() async {
    final splashMinWait = Future.delayed(const Duration(milliseconds: 400));

    // Check version config from server
    AppVersionInfo? versionInfo;
    try {
      versionInfo = await Backend.instance.checkAppVersion();
    } on Exception catch (e) {
      debugPrint('SplashScreen: App version check failed: $e');
    }

    await splashMinWait;
    if (!mounted) return;

    // If update is required (forced or installed version < minimum supported), block navigation
    if (versionInfo != null && versionInfo.isUpdateRequired) {
      await UpdateDialog.show(context, versionInfo);
      return;
    }

    final onboarded =
        LocalStore.instance.isOnboarded && await LocalStore.instance.hasPin();

    if (mounted) {
      if (onboarded) {
        AppNavigation.toLock(context);
      } else {
        AppNavigation.toGetStarted(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background Team Image
          Image.asset(
            'assets/images/splash_team.png',
            fit: BoxFit.cover,
          ),

          // Gradient Overlay
          Builder(
            builder: (context) {
              final brand = AppTheme.currentBrand;
              return Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.1),
                      brand.primaryColor.withValues(alpha: 0.7),
                      brand.primaryColor,
                    ],
                    stops: const [0.0, 0.45, 0.85],
                  ),
                ),
              );
            },
          ),

          // Content
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TenantBrandLogo(
                    brand: AppTheme.currentBrand,
                    size: 88,
                    borderRadius: 22,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    AppTheme.currentBrand.companyName.split(' ').first.toUpperCase(),
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Workforce OS\nBetter Connected Everyday',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.9),
                      height: 1.3,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),
                  const SizedBox(
                    width: 38,
                    height: 38,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 3,
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
