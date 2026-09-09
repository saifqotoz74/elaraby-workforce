import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/core/utils/national_id_validator.dart';

void main() {
  group('EgyptianNationalIdValidator Tests', () {
    test('Normalizes Arabic-Indic and Persian numerals', () {
      expect(
        EgyptianNationalIdValidator.normalizeDigits('٢٩٠٠١٠١١٢٣٤٥٩٢'),
        '29001011234592',
      );
      expect(
        EgyptianNationalIdValidator.normalizeDigits('  ٣٠٦٠٧٣٠١٤٠٢٩٩٢  '),
        '30607301402992',
      );
    });

    test('Validates official Egyptian National IDs', () {
      // Century 2 (1990-01-01, Dakahlia 12)
      expect(EgyptianNationalIdValidator.isValid('29001011234592'), isTrue);

      // Century 3 (2006-07-30, Qalyubia 14)
      expect(EgyptianNationalIdValidator.isValid('30607301402992'), isTrue);

      // Leap year check: Feb 29 on 2004 (century 3, year 04, month 02, day 29, Cairo 01)
      expect(EgyptianNationalIdValidator.isValid('30402290100123'), isTrue);
    });

    test('Rejects invalid format, centuries, dates, and governorates', () {
      // Invalid length
      expect(EgyptianNationalIdValidator.isValid('12345'), isFalse);
      expect(EgyptianNationalIdValidator.isValid('123456789012345'), isFalse);

      // Invalid century (1 or 4)
      expect(EgyptianNationalIdValidator.isValid('19001011234592'), isFalse);
      expect(EgyptianNationalIdValidator.isValid('49001011234592'), isFalse);

      // Invalid month (13)
      expect(EgyptianNationalIdValidator.isValid('29013011234592'), isFalse);

      // Invalid day (32 in January)
      expect(EgyptianNationalIdValidator.isValid('29001321234592'), isFalse);

      // Invalid non-leap year Feb 29 (1999)
      expect(EgyptianNationalIdValidator.isValid('29902290100123'), isFalse);

      // Invalid governorate code (99)
      expect(EgyptianNationalIdValidator.isValid('29001019934592'), isFalse);
    });

    test('Parses birth date and governorate correctly', () {
      final date = EgyptianNationalIdValidator.parseBirthDate('29001011234592');
      expect(date, equals(DateTime(1990, 1, 1)));

      final gov = EgyptianNationalIdValidator.getGovernorate('29001011234592');
      expect(gov, equals('Dakahlia'));

      final cairoGov = EgyptianNationalIdValidator.getGovernorate('30402290100123');
      expect(cairoGov, equals('Cairo'));
    });
  });
}
