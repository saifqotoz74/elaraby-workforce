/// Represents the granular feature flags and module permissions activated for a tenant.
class TenantFeatures {
  final bool hasShifts;
  final bool hasPayroll;
  final bool hasVacations;
  final bool hasBuses;
  final bool hasBenefits;
  final bool hasSummerTrips;
  final bool hasWhistleblower;
  final bool hasSurveys;
  final bool hasMedicalNetwork;

  const TenantFeatures({
    this.hasShifts = true,
    this.hasPayroll = true,
    this.hasVacations = true,
    this.hasBuses = true,
    this.hasBenefits = true,
    this.hasSummerTrips = true,
    this.hasWhistleblower = true,
    this.hasSurveys = true,
    this.hasMedicalNetwork = true,
  });

  /// Default baseline where all enterprise features are enabled
  factory TenantFeatures.allEnabled() => const TenantFeatures();

  /// Deserializes feature toggles from a JSON map (from API or LocalStore)
  factory TenantFeatures.fromJson(Map<String, dynamic> json) {
    return TenantFeatures(
      hasShifts: json['hasShifts'] as bool? ?? true,
      hasPayroll: json['hasPayroll'] as bool? ?? true,
      hasVacations: json['hasVacations'] as bool? ?? true,
      hasBuses: json['hasBuses'] as bool? ?? true,
      hasBenefits: json['hasBenefits'] as bool? ?? true,
      hasSummerTrips: json['hasSummerTrips'] as bool? ?? true,
      hasWhistleblower: json['hasWhistleblower'] as bool? ?? true,
      hasSurveys: json['hasSurveys'] as bool? ?? true,
      hasMedicalNetwork: json['hasMedicalNetwork'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'hasShifts': hasShifts,
        'hasPayroll': hasPayroll,
        'hasVacations': hasVacations,
        'hasBuses': hasBuses,
        'hasBenefits': hasBenefits,
        'hasSummerTrips': hasSummerTrips,
        'hasWhistleblower': hasWhistleblower,
        'hasSurveys': hasSurveys,
        'hasMedicalNetwork': hasMedicalNetwork,
      };

  TenantFeatures copyWith({
    bool? hasShifts,
    bool? hasPayroll,
    bool? hasVacations,
    bool? hasBuses,
    bool? hasBenefits,
    bool? hasSummerTrips,
    bool? hasWhistleblower,
    bool? hasSurveys,
    bool? hasMedicalNetwork,
  }) {
    return TenantFeatures(
      hasShifts: hasShifts ?? this.hasShifts,
      hasPayroll: hasPayroll ?? this.hasPayroll,
      hasVacations: hasVacations ?? this.hasVacations,
      hasBuses: hasBuses ?? this.hasBuses,
      hasBenefits: hasBenefits ?? this.hasBenefits,
      hasSummerTrips: hasSummerTrips ?? this.hasSummerTrips,
      hasWhistleblower: hasWhistleblower ?? this.hasWhistleblower,
      hasSurveys: hasSurveys ?? this.hasSurveys,
      hasMedicalNetwork: hasMedicalNetwork ?? this.hasMedicalNetwork,
    );
  }
}
