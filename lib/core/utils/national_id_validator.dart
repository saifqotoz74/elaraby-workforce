/// Validates and parses Egyptian National Identification numbers (14 digits).
///
/// Format rules:
/// - Digit 1: Century (2 = 1900-1999, 3 = 2000-2099)
/// - Digits 2-3: Birth year
/// - Digits 4-5: Birth month (01-12)
/// - Digits 6-7: Birth day (01-31, valid for that month/year)
/// - Digits 8-9: Governorate code (official Egyptian administrative divisions)
/// - Digits 10-13: Daily sequence number (odd for male, even for female)
/// - Digit 14: Verification digit (1-9)
class EgyptianNationalIdValidator {
  static const Map<String, String> _governorates = {
    '01': 'Cairo',
    '02': 'Alexandria',
    '03': 'Port Said',
    '04': 'Suez',
    '11': 'Damietta',
    '12': 'Dakahlia',
    '13': 'Ash Sharqia',
    '14': 'Al Qalyubia',
    '15': 'Kafr El Sheikh',
    '16': 'Gharbia',
    '17': 'Monufia',
    '18': 'El Beheira',
    '19': 'Ismailia',
    '21': 'Giza',
    '22': 'Beni Suef',
    '23': 'Fayoum',
    '24': 'Minya',
    '25': 'Asyut',
    '26': 'Sohag',
    '27': 'Qena',
    '28': 'Aswan',
    '29': 'Luxor',
    '31': 'Red Sea',
    '32': 'New Valley',
    '33': 'Matrouh',
    '34': 'North Sinai',
    '35': 'South Sinai',
    '88': 'Born Abroad',
  };

  /// Normalizes Arabic-Indic (٠-٩) and Persian (۰-۹) numerals to standard ASCII (0-9).
  static String normalizeDigits(String input) {
    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
    final buffer = StringBuffer();
    for (var i = 0; i < input.length; i++) {
      final char = input[i];
      final arabicIndex = arabicIndic.indexOf(char);
      if (arabicIndex != -1) {
        buffer.write(arabicIndex);
        continue;
      }
      final easternIndex = easternArabic.indexOf(char);
      if (easternIndex != -1) {
        buffer.write(easternIndex);
        continue;
      }
      buffer.write(char);
    }
    return buffer.toString().trim();
  }

  /// Returns true if the given [id] matches the official Egyptian National ID format and rules.
  static bool isValid(String rawId) {
    final id = normalizeDigits(rawId);
    if (!RegExp(r'^\d{14}$').hasMatch(id)) return false;

    // Century digit must be 2 (1900s) or 3 (2000s)
    final centuryDigit = int.parse(id[0]);
    if (centuryDigit != 2 && centuryDigit != 3) return false;

    final centuryBase = centuryDigit == 2 ? 1900 : 2000;
    final year = centuryBase + int.parse(id.substring(1, 3));
    final month = int.parse(id.substring(3, 5));
    final day = int.parse(id.substring(5, 7));

    if (month < 1 || month > 12) return false;

    // Validate day of month with leap year support
    final daysInMonth = _daysInMonth(year, month);
    if (day < 1 || day > daysInMonth) return false;

    // Birth date cannot be in the future
    final birthDate = DateTime(year, month, day);
    if (birthDate.isAfter(DateTime.now())) return false;

    // Validate governorate code
    final govCode = id.substring(7, 9);
    if (!_governorates.containsKey(govCode)) return false;

    return true;
  }

  /// Extracts birth date from a valid National ID.
  static DateTime? parseBirthDate(String rawId) {
    final id = normalizeDigits(rawId);
    if (id.length < 7) return null;
    try {
      final centuryDigit = int.parse(id[0]);
      if (centuryDigit != 2 && centuryDigit != 3) return null;
      final centuryBase = centuryDigit == 2 ? 1900 : 2000;
      final year = centuryBase + int.parse(id.substring(1, 3));
      final month = int.parse(id.substring(3, 5));
      final day = int.parse(id.substring(5, 7));
      return DateTime(year, month, day);
    } on FormatException {
      return null;
    } on RangeError {
      return null;
    }
  }

  /// Extracts governorate name from a National ID.
  static String? getGovernorate(String rawId) {
    final id = normalizeDigits(rawId);
    if (id.length < 9) return null;
    final code = id.substring(7, 9);
    return _governorates[code];
  }

  static int _daysInMonth(int year, int month) {
    if (month == 2) {
      final isLeapYear =
          (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
      return isLeapYear ? 29 : 28;
    }
    const days30 = [4, 6, 9, 11];
    return days30.contains(month) ? 30 : 31;
  }
}
