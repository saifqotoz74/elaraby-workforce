import 'package:flutter/material.dart';

/// Represents the visual identity, branding colors, and metadata for a tenant/organization.
class TenantBrand {
  final String tenantId;
  final String companyName;
  final String companyNameAr;
  final Color primaryColor;
  final Color primaryLightColor;
  final Color primarySoftColor;
  final Color scaffoldBgColor;
  final Color surfaceColor;
  final String? logoUrl;
  final String? localLogoAsset;
  final String supportHotline;

  const TenantBrand({
    required this.tenantId,
    required this.companyName,
    required this.companyNameAr,
    required this.primaryColor,
    required this.primaryLightColor,
    required this.primarySoftColor,
    this.scaffoldBgColor = const Color(0xFFF3F5F7),
    this.surfaceColor = Colors.white,
    this.logoUrl,
    this.localLogoAsset,
    this.supportHotline = '19319',
  });

  /// Default institutional brand for backward compatibility with existing tests and baseline
  factory TenantBrand.elarabyDefault() {
    return const TenantBrand(
      tenantId: 'elaraby',
      companyName: 'Elaraby Group',
      companyNameAr: 'مجموعة العربي',
      primaryColor: Color(0xFF0B63B4),
      primaryLightColor: Color(0xFF1668B8),
      primarySoftColor: Color(0xFFE8F1FA),
      scaffoldBgColor: Color(0xFFF3F5F7),
      surfaceColor: Colors.white,
      localLogoAsset: 'assets/images/elaraby_logo.png',
      supportHotline: '19319',
    );
  }

  /// Deserializes a tenant brand from a JSON dictionary (from API or LocalStore)
  factory TenantBrand.fromJson(Map<String, dynamic> json) {
    return TenantBrand(
      tenantId: json['tenantId'] as String? ?? 'elaraby',
      companyName: json['companyName'] as String? ?? 'Elaraby Group',
      companyNameAr: json['companyNameAr'] as String? ?? 'مجموعة العربي',
      primaryColor: _parseColor(json['primaryColor'], const Color(0xFF0B63B4)),
      primaryLightColor: _parseColor(json['primaryLightColor'], const Color(0xFF1668B8)),
      primarySoftColor: _parseColor(json['primarySoftColor'], const Color(0xFFE8F1FA)),
      scaffoldBgColor: _parseColor(json['scaffoldBgColor'], const Color(0xFFF3F5F7)),
      surfaceColor: _parseColor(json['surfaceColor'], Colors.white),
      logoUrl: json['logoUrl'] as String?,
      localLogoAsset: json['localLogoAsset'] as String?,
      supportHotline: json['supportHotline'] as String? ?? '19319',
    );
  }

  Map<String, dynamic> toJson() => {
        'tenantId': tenantId,
        'companyName': companyName,
        'companyNameAr': companyNameAr,
        'primaryColor': _colorToHex(primaryColor),
        'primaryLightColor': _colorToHex(primaryLightColor),
        'primarySoftColor': _colorToHex(primarySoftColor),
        'scaffoldBgColor': _colorToHex(scaffoldBgColor),
        'surfaceColor': _colorToHex(surfaceColor),
        'logoUrl': logoUrl,
        'localLogoAsset': localLogoAsset,
        'supportHotline': supportHotline,
      };

  TenantBrand copyWith({
    String? tenantId,
    String? companyName,
    String? companyNameAr,
    Color? primaryColor,
    Color? primaryLightColor,
    Color? primarySoftColor,
    Color? scaffoldBgColor,
    Color? surfaceColor,
    String? logoUrl,
    String? localLogoAsset,
    String? supportHotline,
  }) {
    return TenantBrand(
      tenantId: tenantId ?? this.tenantId,
      companyName: companyName ?? this.companyName,
      companyNameAr: companyNameAr ?? this.companyNameAr,
      primaryColor: primaryColor ?? this.primaryColor,
      primaryLightColor: primaryLightColor ?? this.primaryLightColor,
      primarySoftColor: primarySoftColor ?? this.primarySoftColor,
      scaffoldBgColor: scaffoldBgColor ?? this.scaffoldBgColor,
      surfaceColor: surfaceColor ?? this.surfaceColor,
      logoUrl: logoUrl ?? this.logoUrl,
      localLogoAsset: localLogoAsset ?? this.localLogoAsset,
      supportHotline: supportHotline ?? this.supportHotline,
    );
  }

  static Color _parseColor(dynamic hex, Color fallback) {
    if (hex == null || hex is! String || hex.trim().isEmpty) return fallback;
    try {
      String cleanHex = hex.replaceAll('#', '').trim();
      if (cleanHex.length == 6) {
        cleanHex = 'FF$cleanHex';
      }
      return Color(int.parse(cleanHex, radix: 16));
    } catch (_) {
      return fallback;
    }
  }

  static String _colorToHex(Color color) {
    return '#${color.value.toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}';
  }
}
