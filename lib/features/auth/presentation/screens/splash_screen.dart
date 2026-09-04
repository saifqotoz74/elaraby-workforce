import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../common/presentation/widgets/update_dialog.dart';
import 'get_started_screen.dart';
import 'pin_lock_screen.dart';

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
    final splashMinWait = Future.delayed(const Duration(milliseconds: 2500));

    // Check version config from server
    AppVersionInfo? versionInfo;
    try {
      versionInfo = await Backend.instance.checkAppVersion();
    } catch (_) {}

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
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) =>
              onboarded ? const PinLockScreen() : const GetStartedScreen(),
        ),
      );
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
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.1),
                  const Color(0xFF073C74).withValues(alpha: 0.6),
                  const Color(0xFF063A72),
                ],
                stops: const [0.0, 0.45, 0.85],
              ),
            ),
          ),

          // Content
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.2),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Image.asset(
                      'assets/images/app_logo.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'ELARABY',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 42,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Better Connected\nEveryday',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
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
