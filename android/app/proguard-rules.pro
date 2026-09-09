# Flutter Proguard Rules for Production Release
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Flutter Secure Storage Keep Rules
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# Local Auth Biometrics Keep Rules
-keep class io.flutter.plugins.localauth.** { *; }

# Printing and PDF Native Bindings
-keep class net.nfet.flutter.printing.** { *; }

# Google Play Core / Deferred components (when not using dynamic delivery)
-dontwarn com.google.android.play.core.**
