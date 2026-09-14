/// Egyptian Factory Working Calendar & Public Holiday Calculator (2025 - 2027)
/// Excludes weekly factory rest days (Fridays & Saturdays) and official Egyptian national holidays
/// from leave duration calculation in compliance with Egyptian Labor Law No. 12.
library;

class EgyptianHoliday {
  final String dateKey; // YYYY-MM-DD
  final String nameAr;
  final String nameEn;

  const EgyptianHoliday({
    required this.dateKey,
    required this.nameAr,
    required this.nameEn,
  });

  String localizedName(bool isArabic) => isArabic ? nameAr : nameEn;
}

class WorkingDaysResult {
  final int totalCalendarDays;
  final int workingDays;
  final int excludedWeekends;
  final List<EgyptianHoliday> excludedHolidays;

  const WorkingDaysResult({
    required this.totalCalendarDays,
    required this.workingDays,
    required this.excludedWeekends,
    required this.excludedHolidays,
  });
}

class EgyptianCalendar {
  static const Map<String, EgyptianHoliday> _holidays = {
    // 2025
    '2025-01-07': EgyptianHoliday(dateKey: '2025-01-07', nameAr: 'عيد الميلاد المجيد', nameEn: 'Coptic Christmas'),
    '2025-01-25': EgyptianHoliday(dateKey: '2025-01-25', nameAr: 'ثورة 25 يناير وعيد الشرطة', nameEn: 'Revolution & Police Day'),
    '2025-03-30': EgyptianHoliday(dateKey: '2025-03-30', nameAr: 'وقفة عيد الفطر', nameEn: 'Eid Al-Fitr Eve'),
    '2025-03-31': EgyptianHoliday(dateKey: '2025-03-31', nameAr: 'أول أيام عيد الفطر المبارك', nameEn: 'Eid Al-Fitr Day 1'),
    '2025-04-01': EgyptianHoliday(dateKey: '2025-04-01', nameAr: 'ثاني أيام عيد الفطر المبارك', nameEn: 'Eid Al-Fitr Day 2'),
    '2025-04-21': EgyptianHoliday(dateKey: '2025-04-21', nameAr: 'عيد شم النسيم', nameEn: 'Sham El-Nessim'),
    '2025-04-25': EgyptianHoliday(dateKey: '2025-04-25', nameAr: 'عيد تحرير سيناء', nameEn: 'Sinai Liberation Day'),
    '2025-05-01': EgyptianHoliday(dateKey: '2025-05-01', nameAr: 'عيد العمال', nameEn: 'Labor Day'),
    '2025-06-05': EgyptianHoliday(dateKey: '2025-06-05', nameAr: 'وقفة عرفات', nameEn: 'Arafat Day'),
    '2025-06-06': EgyptianHoliday(dateKey: '2025-06-06', nameAr: 'أول أيام عيد الأضحى المبارك', nameEn: 'Eid Al-Adha Day 1'),
    '2025-06-07': EgyptianHoliday(dateKey: '2025-06-07', nameAr: 'ثاني أيام عيد الأضحى المبارك', nameEn: 'Eid Al-Adha Day 2'),
    '2025-06-26': EgyptianHoliday(dateKey: '2025-06-26', nameAr: 'رأس السنة الهجرية 1447', nameEn: 'Islamic New Year'),
    '2025-06-30': EgyptianHoliday(dateKey: '2025-06-30', nameAr: 'ثورة 30 يونيو', nameEn: '30 June Revolution'),
    '2025-07-23': EgyptianHoliday(dateKey: '2025-07-23', nameAr: 'ثورة 23 يوليو', nameEn: '23 July Revolution'),
    '2025-09-04': EgyptianHoliday(dateKey: '2025-09-04', nameAr: 'المولد النبوي الشريف', nameEn: 'Prophet Birthday'),
    '2025-10-06': EgyptianHoliday(dateKey: '2025-10-06', nameAr: 'عيد القوات المسلحة (6 أكتوبر)', nameEn: 'Armed Forces Day (6 October)'),

    // 2026
    '2026-01-07': EgyptianHoliday(dateKey: '2026-01-07', nameAr: 'عيد الميلاد المجيد', nameEn: 'Coptic Christmas'),
    '2026-01-25': EgyptianHoliday(dateKey: '2026-01-25', nameAr: 'ثورة 25 يناير وعيد الشرطة', nameEn: 'Revolution & Police Day'),
    '2026-03-20': EgyptianHoliday(dateKey: '2026-03-20', nameAr: 'وقفة عيد الفطر', nameEn: 'Eid Al-Fitr Eve'),
    '2026-03-21': EgyptianHoliday(dateKey: '2026-03-21', nameAr: 'أول أيام عيد الفطر المبارك', nameEn: 'Eid Al-Fitr Day 1'),
    '2026-03-22': EgyptianHoliday(dateKey: '2026-03-22', nameAr: 'ثاني أيام عيد الفطر المبارك', nameEn: 'Eid Al-Fitr Day 2'),
    '2026-04-13': EgyptianHoliday(dateKey: '2026-04-13', nameAr: 'عيد شم النسيم', nameEn: 'Sham El-Nessim'),
    '2026-04-25': EgyptianHoliday(dateKey: '2026-04-25', nameAr: 'عيد تحرير سيناء', nameEn: 'Sinai Liberation Day'),
    '2026-05-01': EgyptianHoliday(dateKey: '2026-05-01', nameAr: 'عيد العمال', nameEn: 'Labor Day'),
    '2026-05-26': EgyptianHoliday(dateKey: '2026-05-26', nameAr: 'وقفة عرفات', nameEn: 'Arafat Day'),
    '2026-05-27': EgyptianHoliday(dateKey: '2026-05-27', nameAr: 'أول أيام عيد الأضحى المبارك', nameEn: 'Eid Al-Adha Day 1'),
    '2026-05-28': EgyptianHoliday(dateKey: '2026-05-28', nameAr: 'ثاني أيام عيد الأضحى المبارك', nameEn: 'Eid Al-Adha Day 2'),
    '2026-06-16': EgyptianHoliday(dateKey: '2026-06-16', nameAr: 'رأس السنة الهجرية 1448', nameEn: 'Islamic New Year'),
    '2026-06-30': EgyptianHoliday(dateKey: '2026-06-30', nameAr: 'ثورة 30 يونيو', nameEn: '30 June Revolution'),
    '2026-07-23': EgyptianHoliday(dateKey: '2026-07-23', nameAr: 'ثورة 23 يوليو', nameEn: '23 July Revolution'),
    '2026-08-25': EgyptianHoliday(dateKey: '2026-08-25', nameAr: 'المولد النبوي الشريف', nameEn: 'Prophet Birthday'),
    '2026-10-06': EgyptianHoliday(dateKey: '2026-10-06', nameAr: 'عيد القوات المسلحة (6 أكتوبر)', nameEn: 'Armed Forces Day (6 October)'),

    // 2027
    '2027-01-07': EgyptianHoliday(dateKey: '2027-01-07', nameAr: 'عيد الميلاد المجيد', nameEn: 'Coptic Christmas'),
    '2027-01-25': EgyptianHoliday(dateKey: '2027-01-25', nameAr: 'ثورة 25 يناير وعيد الشرطة', nameEn: 'Revolution & Police Day'),
    '2027-03-09': EgyptianHoliday(dateKey: '2027-03-09', nameAr: 'أول أيام عيد الفطر المبارك', nameEn: 'Eid Al-Fitr Day 1'),
    '2027-04-25': EgyptianHoliday(dateKey: '2027-04-25', nameAr: 'عيد تحرير سيناء', nameEn: 'Sinai Liberation Day'),
    '2027-05-01': EgyptianHoliday(dateKey: '2027-05-01', nameAr: 'عيد العمال', nameEn: 'Labor Day'),
    '2027-05-03': EgyptianHoliday(dateKey: '2027-05-03', nameAr: 'عيد شم النسيم', nameEn: 'Sham El-Nessim'),
    '2027-05-16': EgyptianHoliday(dateKey: '2027-05-16', nameAr: 'وقفة عرفات', nameEn: 'Arafat Day'),
    '2027-05-17': EgyptianHoliday(dateKey: '2027-05-17', nameAr: 'أول أيام عيد الأضحى المبارك', nameEn: 'Eid Al-Adha Day 1'),
    '2027-06-30': EgyptianHoliday(dateKey: '2027-06-30', nameAr: 'ثورة 30 يونيو', nameEn: '30 June Revolution'),
    '2027-07-23': EgyptianHoliday(dateKey: '2027-07-23', nameAr: 'ثورة 23 يوليو', nameEn: '23 July Revolution'),
    '2027-10-06': EgyptianHoliday(dateKey: '2027-10-06', nameAr: 'عيد القوات المسلحة (6 أكتوبر)', nameEn: 'Armed Forces Day (6 October)'),
  };

  static String formatDateKey(DateTime date) {
    final y = date.year.toString().padLeft(4, '0');
    final m = date.month.toString().padLeft(2, '0');
    final d = date.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  /// In Egyptian factories, Friday (5) and Saturday (6) are weekly rest days.
  static bool isWeekend(DateTime date) {
    return date.weekday == DateTime.friday || date.weekday == DateTime.saturday;
  }

  /// Returns the Egyptian public holiday matching the date, or null.
  static EgyptianHoliday? getHoliday(DateTime date) {
    final key = formatDateKey(date);
    return _holidays[key];
  }

  /// Calculates billable working days between two dates, excluding weekends and public holidays.
  static WorkingDaysResult calculateWorkingDays(DateTime startDate, DateTime endDate) {
    final start = DateTime(startDate.year, startDate.month, startDate.day);
    final end = DateTime(endDate.year, endDate.month, endDate.day);

    if (end.isBefore(start)) {
      return const WorkingDaysResult(
        totalCalendarDays: 0,
        workingDays: 0,
        excludedWeekends: 0,
        excludedHolidays: [],
      );
    }

    int workingDays = 0;
    int excludedWeekends = 0;
    final List<EgyptianHoliday> excludedHolidays = [];

    var cur = start;
    int totalDays = 0;

    while (!cur.isAfter(end)) {
      totalDays++;
      final isWk = isWeekend(cur);
      final holiday = getHoliday(cur);

      if (isWk) {
        excludedWeekends++;
      } else if (holiday != null) {
        excludedHolidays.add(holiday);
      } else {
        workingDays++;
      }
      cur = DateTime(cur.year, cur.month, cur.day + 1);
    }

    // Fallback: if the employee requested within rest days only, bill total days
    final finalWorkingDays = workingDays == 0 ? totalDays : workingDays;

    return WorkingDaysResult(
      totalCalendarDays: totalDays,
      workingDays: finalWorkingDays,
      excludedWeekends: excludedWeekends,
      excludedHolidays: excludedHolidays,
    );
  }
}
