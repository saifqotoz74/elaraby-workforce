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
  final String crNumber;
  final String taxNumber;
  final String corporateSubtitle;
  final List<String> factoryLocations;
  final String currency;
  final bool isFlavorLocked;

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
    this.crNumber = '104821',
    this.taxNumber = 'EG-102-993-841',
    this.corporateSubtitle = 'Workforce & Operations Management',
    this.factoryLocations = const ['قويسنا الصناعية', 'مجمع بنها الصناعي'],
    this.currency = 'EGP',
    this.isFlavorLocked = false,
  });

  /// Institutional brand for Elaraby Group
  factory TenantBrand.elarabyDefault() => TenantBrand.elaraby();

  /// Default neutral white-label platform brand (PR Connect / Workforce OS)
  factory TenantBrand.prConnectDefault() => TenantBrand.neutral();

  factory TenantBrand.neutral() {
    return const TenantBrand(
      tenantId: 'generic',
      companyName: 'PR Connect',
      companyNameAr: 'بي آر كونكت',
      primaryColor: Color(0xFF1E40AF),
      primaryLightColor: Color(0xFF2563EB),
      primarySoftColor: Color(0xFFEFF6FF),
      scaffoldBgColor: Color(0xFFF8FAFC),
      surfaceColor: Colors.white,
      localLogoAsset: 'assets/images/app_logo.png',
      supportHotline: '19000',
      crNumber: 'CR-100000',
      taxNumber: 'TAX-000-000-000',
      corporateSubtitle: 'Workforce & Operations Management',
      factoryLocations: ['المقر الرئيسي', 'مجمع العمليات'],
      currency: 'EGP',
      isFlavorLocked: false,
    );
  }

  factory TenantBrand.elaraby() {
    return const TenantBrand(
      tenantId: 'elaraby',
      companyName: 'Elaraby Group',
      companyNameAr: 'مجموعة العربي',
      primaryColor: Color(0xFF0B63B4),
      primaryLightColor: Color(0xFF1668B8),
      primarySoftColor: Color(0xFFE8F1FA),
      scaffoldBgColor: Color(0xFFF3F5F7),
      surfaceColor: Colors.white,
      localLogoAsset: 'assets/images/app_logo.png',
      supportHotline: '19319',
      crNumber: 'EG-104821',
      taxNumber: 'EG-102-993-841',
      corporateSubtitle: 'Home Appliances & Electronics Manufacturing',
      factoryLocations: ['قويسنا الصناعية', 'مجمع بنها الصناعي', 'العبور للخدمات اللوجستية'],
      currency: 'EGP',
    );
  }

  factory TenantBrand.elsewedy() {
    return const TenantBrand(
      tenantId: 'elsewedy',
      companyName: 'Elsewedy Electric',
      companyNameAr: 'السويدي إليكتريك',
      primaryColor: Color(0xFFC8102E),
      primaryLightColor: Color(0xFFE02B47),
      primarySoftColor: Color(0xFFFCECEF),
      scaffoldBgColor: Color(0xFFF8F9FA),
      surfaceColor: Colors.white,
      supportHotline: '16244',
      crNumber: 'EG-284910',
      taxNumber: 'EG-284-910-112',
      corporateSubtitle: 'Energy, Cables & Infrastructure Solutions',
      factoryLocations: ['العاشر من رمضان قطاع الكابلات', 'العين السخنة للمحولات', 'السادات للمهمات الكهربائية'],
      currency: 'EGP',
    );
  }

  factory TenantBrand.ghabbour() {
    return const TenantBrand(
      tenantId: 'ghabbour',
      companyName: 'GB Corp (Ghabbour Auto)',
      companyNameAr: 'جي بي كورب (غبور أوتو)',
      primaryColor: Color(0xFF1E3A8A),
      primaryLightColor: Color(0xFF3B82F6),
      primarySoftColor: Color(0xFFEFF6FF),
      scaffoldBgColor: Color(0xFFF8FAFC),
      surfaceColor: Colors.white,
      supportHotline: '19623',
      crNumber: 'EG-550192',
      taxNumber: 'EG-550-192-334',
      corporateSubtitle: 'Automotive Manufacturing & Assembly Lines',
      factoryLocations: ['أبو رواش الجيزة تجميع الحافلات', 'مدينة السادات الصناعية لتصنيع السيارات', 'قليوب لقطع الغيار'],
      currency: 'EGP',
    );
  }

  factory TenantBrand.talaatMoustafa() {
    return const TenantBrand(
      tenantId: 'tmg',
      companyName: 'Talaat Moustafa Group (TMG)',
      companyNameAr: 'مجموعة طلعت مصطفى',
      primaryColor: Color(0xFF15803D),
      primaryLightColor: Color(0xFF22C55E),
      primarySoftColor: Color(0xFFF0FDF4),
      scaffoldBgColor: Color(0xFFF9FAFB),
      surfaceColor: Colors.white,
      supportHotline: '19688',
      crNumber: 'EG-993812',
      taxNumber: 'EG-993-812-776',
      corporateSubtitle: 'Urban Development & Smart Cities',
      factoryLocations: ['مدينتي - إدارة المرافق والتشغيل', 'مدينة نور - العاصمة الإدارية', 'الرحاب - الصيانة الحضرية'],
      currency: 'EGP',
    );
  }

  factory TenantBrand.gulfIndustrial() {
    return const TenantBrand(
      tenantId: 'gulf_industrial',
      companyName: 'Gulf Industrial Corp',
      companyNameAr: 'الخليج للصناعات الهندسية',
      primaryColor: Color(0xFF059669),
      primaryLightColor: Color(0xFF10B981),
      primarySoftColor: Color(0xFFECFDF5),
      scaffoldBgColor: Color(0xFFF3F4F6),
      surfaceColor: Colors.white,
      supportHotline: '80012345',
      crNumber: 'GCC-441092',
      taxNumber: 'SA-300-881-229',
      corporateSubtitle: 'Petrochemical & Heavy Machinery Plants',
      factoryLocations: ['الجبيل الصناعية - مجمع البتروكيماويات', 'ينبع للخدمات الصناعية', 'الدمام اللوجستية'],
      currency: 'SAR',
    );
  }

  /// Returns localized company name
  String localizedCompanyName(bool isArabic) => isArabic ? companyNameAr : companyName;

  /// Generates a 2-letter uppercase monogram (e.g. EG, EE, GB, TM, GI)
  String get initials {
    final clean = companyName.trim().replaceAll(RegExp(r'[^a-zA-Z\s]'), '');
    final parts = clean.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    if (companyName.isNotEmpty) {
      return companyName.substring(0, companyName.length.clamp(1, 2)).toUpperCase();
    }
    return 'CO';
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
      crNumber: json['crNumber'] as String? ?? '104821',
      taxNumber: json['taxNumber'] as String? ?? 'EG-102-993-841',
      corporateSubtitle: json['corporateSubtitle'] as String? ?? 'Workforce & Operations Management',
      factoryLocations: (json['factoryLocations'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const ['قويسنا الصناعية', 'مجمع بنها الصناعي'],
      currency: json['currency'] as String? ?? 'EGP',
      isFlavorLocked: json['isFlavorLocked'] as bool? ?? false,
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
        'crNumber': crNumber,
        'taxNumber': taxNumber,
        'corporateSubtitle': corporateSubtitle,
        'factoryLocations': factoryLocations,
        'currency': currency,
        'isFlavorLocked': isFlavorLocked,
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
    String? crNumber,
    String? taxNumber,
    String? corporateSubtitle,
    List<String>? factoryLocations,
    String? currency,
    bool? isFlavorLocked,
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
      crNumber: crNumber ?? this.crNumber,
      taxNumber: taxNumber ?? this.taxNumber,
      corporateSubtitle: corporateSubtitle ?? this.corporateSubtitle,
      factoryLocations: factoryLocations ?? this.factoryLocations,
      currency: currency ?? this.currency,
      isFlavorLocked: isFlavorLocked ?? this.isFlavorLocked,
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
    final int a = (color.a * 255).round() & 0xff;
    final int r = (color.r * 255).round() & 0xff;
    final int g = (color.g * 255).round() & 0xff;
    final int b = (color.b * 255).round() & 0xff;
    final int argb = (a << 24) | (r << 16) | (g << 8) | b;
    return '#${argb.toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}';
  }
}
