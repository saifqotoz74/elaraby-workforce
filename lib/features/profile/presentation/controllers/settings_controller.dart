import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/providers/repository_providers.dart';
import '../../../../core/repositories/settings_repository.dart';
import '../../../../core/theme/app_theme.dart';

class SettingsState {
  final bool biometricEnabled;
  final bool salaryProtectionEnabled;
  final bool notificationsEnabled;
  final String themeMode;

  const SettingsState({
    required this.biometricEnabled,
    required this.salaryProtectionEnabled,
    required this.notificationsEnabled,
    required this.themeMode,
  });

  SettingsState copyWith({
    bool? biometricEnabled,
    bool? salaryProtectionEnabled,
    bool? notificationsEnabled,
    String? themeMode,
  }) {
    return SettingsState(
      biometricEnabled: biometricEnabled ?? this.biometricEnabled,
      salaryProtectionEnabled:
          salaryProtectionEnabled ?? this.salaryProtectionEnabled,
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      themeMode: themeMode ?? this.themeMode,
    );
  }
}

class SettingsNotifier extends StateNotifier<SettingsState> {
  final SettingsRepository _repo;

  SettingsNotifier(this._repo)
      : super(SettingsState(
          biometricEnabled: _repo.biometricEnabled,
          salaryProtectionEnabled: _repo.salaryProtectionEnabled,
          notificationsEnabled: _repo.notificationsEnabled,
          themeMode: _repo.themeMode,
        ));

  Future<void> setBiometric(bool val) async {
    await _repo.setSetting('fingerprint', val);
    state = state.copyWith(biometricEnabled: val);
  }

  Future<void> setSalaryProtection(bool val) async {
    await _repo.setSetting('salary_protection', val);
    state = state.copyWith(salaryProtectionEnabled: val);
  }

  Future<void> setNotifications(bool val) async {
    await _repo.setSetting('notifications', val);
    state = state.copyWith(notificationsEnabled: val);
  }

  Future<void> updateTheme(ThemeMode mode) async {
    AppTheme.setThemeMode(mode);
    await _repo.setThemeMode(mode.name);
    state = state.copyWith(themeMode: mode.name);
  }

  Future<void> setThemeMode(String val) async {
    final mode = val == 'light'
        ? ThemeMode.light
        : val == 'dark'
            ? ThemeMode.dark
            : ThemeMode.system;
    await updateTheme(mode);
  }
}

final settingsStateProvider =
    StateNotifierProvider<SettingsNotifier, SettingsState>((ref) {
  final repo = ref.watch(settingsRepositoryProvider);
  return SettingsNotifier(repo);
});
