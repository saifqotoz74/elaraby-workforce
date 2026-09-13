import '../utils/national_id_validator.dart';

enum IdentityMode {
  egyptianNationalId,
  gulfIqama,
  genericEmployeeCode,
}

/// Abstract contract for institutional identity validation across different tenant regions.
abstract class IdentityStrategy {
  String get id;
  String get labelEn;
  String get labelAr;
  String get hintText;
  int? get exactLength;
  int get minLength;
  int get maxLength;
  bool get isNumericOnly;

  bool validate(String rawInput);

  factory IdentityStrategy.fromMode(IdentityMode mode) {
    switch (mode) {
      case IdentityMode.egyptianNationalId:
        return EgyptianNationalIdStrategy();
      case IdentityMode.gulfIqama:
        return GulfIqamaStrategy();
      case IdentityMode.genericEmployeeCode:
        return GenericEmployeeCodeStrategy();
    }
  }

  factory IdentityStrategy.fromString(String? modeStr) {
    if (modeStr == null) return EgyptianNationalIdStrategy();
    switch (modeStr.toLowerCase().trim()) {
      case 'gulf_iqama':
      case 'iqama':
        return GulfIqamaStrategy();
      case 'employee_code':
      case 'generic':
        return GenericEmployeeCodeStrategy();
      case 'egyptian_national_id':
      default:
        return EgyptianNationalIdStrategy();
    }
  }
}

/// Egyptian National ID strategy: 14 numeric digits with birth date and governorate verification.
class EgyptianNationalIdStrategy implements IdentityStrategy {
  @override
  String get id => 'egyptian_national_id';

  @override
  String get labelEn => 'National ID Number';

  @override
  String get labelAr => 'الرقم القومي';

  @override
  String get hintText => '29001011234567';

  @override
  int? get exactLength => 14;

  @override
  int get minLength => 14;

  @override
  int get maxLength => 14;

  @override
  bool get isNumericOnly => true;

  @override
  bool validate(String rawInput) {
    return EgyptianNationalIdValidator.isValid(rawInput);
  }
}

/// Gulf Resident / National ID strategy: 10 numeric digits starting with 1 (Citizen) or 2 (Resident).
class GulfIqamaStrategy implements IdentityStrategy {
  @override
  String get id => 'gulf_iqama';

  @override
  String get labelEn => 'National / Resident ID (Iqama)';

  @override
  String get labelAr => 'رقم الهوية الوطنية / الإقامة';

  @override
  String get hintText => '1001234567 / 2001234567';

  @override
  int? get exactLength => 10;

  @override
  int get minLength => 10;

  @override
  int get maxLength => 10;

  @override
  bool get isNumericOnly => true;

  @override
  bool validate(String rawInput) {
    final clean = EgyptianNationalIdValidator.normalizeDigits(rawInput);
    if (!RegExp(r'^[12]\d{9}$').hasMatch(clean)) return false;
    return true;
  }
}

/// General Employee Code strategy: 3 to 20 alphanumeric characters.
class GenericEmployeeCodeStrategy implements IdentityStrategy {
  @override
  String get id => 'employee_code';

  @override
  String get labelEn => 'Employee ID Code';

  @override
  String get labelAr => 'الرقم الوظيفي';

  @override
  String get hintText => 'EG-20481';

  @override
  int? get exactLength => null;

  @override
  int get minLength => 3;

  @override
  int get maxLength => 20;

  @override
  bool get isNumericOnly => false;

  @override
  bool validate(String rawInput) {
    final clean = rawInput.trim();
    if (clean.length < 3 || clean.length > 20) return false;
    return RegExp(r'^[a-zA-Z0-9_\-\./]+$').hasMatch(clean);
  }
}
