import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../storage/local_store.dart';
import 'l10n_map.dart';

/// Centralized locale manager backed by Flutter official ARB-generated [AppLocalizations].
///
/// Supports English and Arabic, full RTL/LTR text directionality,
/// and Arabic/English pluralization rules.
class AppLocale extends ChangeNotifier {
  static final AppLocale instance = AppLocale._();
  AppLocale._();

  Locale _locale = const Locale('en');
  late AppLocalizations _l10n = lookupAppLocalizations(_locale);

  Locale get currentLocale => _locale;
  bool get isArabic => _locale.languageCode == 'ar';
  bool get isRTL => _locale.languageCode == 'ar';
  TextDirection get textDirection =>
      isRTL ? TextDirection.rtl : TextDirection.ltr;

  AppLocalizations get l10n => _l10n;
  static AppLocalizations get current => instance._l10n;

  /// Restores the saved language at startup (before the first frame).
  void loadFromStorage() {
    final code = LocalStore.instance.localeCode;
    if (code == 'ar' || code == 'en') {
      _locale = Locale(code!);
    } else {
      _locale = const Locale('ar');
    }
    _l10n = lookupAppLocalizations(_locale);
  }

  void setLocale(Locale newLocale) {
    if (_locale != newLocale) {
      _locale = newLocale;
      _l10n = lookupAppLocalizations(newLocale);
      LocalStore.instance.setLocaleCode(newLocale.languageCode);
      notifyListeners();
    }
  }

  void toggleLocale() {
    setLocale(isArabic ? const Locale('en') : const Locale('ar'));
  }

  /// Looks up a localized string by its ARB key.
  ///
  /// Prefers [AppLocalizations.of(context)] when a [context] is provided,
  /// falling back to the singleton's active [AppLocalizations] instance.
  /// Falls back to returning [key] if no translation exists.
  static String tr(String key, [BuildContext? context]) {
    final activeL10n =
        (context != null ? AppLocalizations.of(context) : null) ??
            instance._l10n;
    return lookupL10nString(activeL10n, key) ?? key;
  }

  /// Lockout message formatted with remaining minutes.
  static String trLocked(int minutes) =>
      instance._l10n.auth_locked(minutes.toString());

  /// Typed pluralization helper for lockout minutes.
  static String trLockedPlural(num minutes) =>
      instance._l10n.auth_locked_minutes(minutes);

  /// Typed pluralization helper for vacation days available.
  static String vacationDaysCount(num count) =>
      instance._l10n.vacation_days_count(count);

  /// Typed pluralization helper for vacation days remaining.
  static String vacationDaysRemainingCount(num count) =>
      instance._l10n.vacation_days_remaining_count(count);

  /// Typed pluralization helper for trip seats remaining.
  static String tripSeatsLeftCount(num count) =>
      instance._l10n.trip_seats_left_count(count);
}

/// Convenience extension on [BuildContext] for ergonomic localization access.
extension AppLocalizationExtension on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this)!;
  bool get isRTL => Directionality.of(this) == TextDirection.rtl;
  TextDirection get textDirection => Directionality.of(this);
}
