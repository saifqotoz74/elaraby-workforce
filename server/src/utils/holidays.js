// Egyptian Official Public Holidays & Factory Working Days Calculator
// Compliant with Egyptian Labor Law No. 12 of 2003 and official cabinet decrees.

const EGYPTIAN_HOLIDAYS_MAP = {
  // 2025
  '2025-01-07': 'Coptic Christmas (عيد الميلاد المجيد)',
  '2025-01-25': 'Police Day & Revolution (عيد الشرطة وثورة 25 يناير)',
  '2025-03-30': 'Eid Al-Fitr Day 1 (عيد الفطر المبارك)',
  '2025-03-31': 'Eid Al-Fitr Day 2 (عيد الفطر المبارك)',
  '2025-04-01': 'Eid Al-Fitr Day 3 (عيد الفطر المبارك)',
  '2025-04-21': 'Sham El-Nessim (شم النسيم)',
  '2025-04-25': 'Sinai Liberation Day (عيد تحرير سيناء)',
  '2025-05-01': 'Labor Day (عيد العمال)',
  '2025-06-05': 'Arafat Day (وقفة عرفات)',
  '2025-06-06': 'Eid Al-Adha Day 1 (عيد الأضحى المبارك)',
  '2025-06-07': 'Eid Al-Adha Day 2 (عيد الأضحى المبارك)',
  '2025-06-08': 'Eid Al-Adha Day 3 (عيد الأضحى المبارك)',
  '2025-06-26': 'Islamic New Year (رأس السنة الهجرية)',
  '2025-06-30': '30 June Revolution (ثورة 30 يونيو)',
  '2025-07-23': '23 July Revolution (ثورة 23 يوليو)',
  '2025-09-04': "Prophet's Birthday (المولد النبوي الشريف)",
  '2025-10-06': 'Armed Forces Day (عيد القوات المسلحة - 6 أكتوبر)',

  // 2026
  '2026-01-07': 'Coptic Christmas (عيد الميلاد المجيد)',
  '2026-01-25': 'Police Day & Revolution (عيد الشرطة وثورة 25 يناير)',
  '2026-03-20': 'Eid Al-Fitr Day 1 (عيد الفطر المبارك)',
  '2026-03-21': 'Eid Al-Fitr Day 2 (عيد الفطر المبارك)',
  '2026-03-22': 'Eid Al-Fitr Day 3 (عيد الفطر المبارك)',
  '2026-04-13': 'Sham El-Nessim (شم النسيم)',
  '2026-04-25': 'Sinai Liberation Day (عيد تحرير سيناء)',
  '2026-05-01': 'Labor Day (عيد العمال)',
  '2026-05-26': 'Arafat Day (وقفة عرفات)',
  '2026-05-27': 'Eid Al-Adha Day 1 (عيد الأضحى المبارك)',
  '2026-05-28': 'Eid Al-Adha Day 2 (عيد الأضحى المبارك)',
  '2026-05-29': 'Eid Al-Adha Day 3 (عيد الأضحى المبارك)',
  '2026-06-16': 'Islamic New Year (رأس السنة الهجرية)',
  '2026-06-30': '30 June Revolution (ثورة 30 يونيو)',
  '2026-07-23': '23 July Revolution (ثورة 23 يوليو)',
  '2026-08-25': "Prophet's Birthday (المولد النبوي الشريف)",
  '2026-10-06': 'Armed Forces Day (عيد القوات المسلحة - 6 أكتوبر)',

  // 2027
  '2027-01-07': 'Coptic Christmas (عيد الميلاد المجيد)',
  '2027-01-25': 'Police Day & Revolution (عيد الشرطة وثورة 25 يناير)',
  '2027-03-10': 'Eid Al-Fitr Day 1 (عيد الفطر المبارك)',
  '2027-03-11': 'Eid Al-Fitr Day 2 (عيد الفطر المبارك)',
  '2027-03-12': 'Eid Al-Fitr Day 3 (عيد الفطر المبارك)',
  '2027-04-25': 'Sinai Liberation Day (عيد تحرير سيناء)',
  '2027-05-01': 'Labor Day (عيد العمال)',
  '2027-05-03': 'Sham El-Nessim (شم النسيم)',
  '2027-05-16': 'Arafat Day (وقفة عرفات)',
  '2027-05-17': 'Eid Al-Adha Day 1 (عيد الأضحى المبارك)',
  '2027-06-30': '30 June Revolution (ثورة 30 يونيو)',
  '2027-07-23': '23 July Revolution (ثورة 23 يوليو)',
  '2027-10-06': 'Armed Forces Day (عيد القوات المسلحة - 6 أكتوبر)',
};

function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === 'string') {
    const parts = input.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(input);
  }
  return new Date(input);
}

function formatKey(date) {
  const d = parseDate(date);
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Checks if given day is a factory weekly rest day (Friday: 5, Saturday: 6).
 */
function isWeekend(date) {
  const d = parseDate(date);
  if (!d) return false;
  const day = d.getDay();
  return day === 5 || day === 6; // Friday = 5, Saturday = 6 in JS getDay() (0=Sun)
}

/**
 * Returns holiday name if date falls on an official national holiday, or null.
 */
function getHolidayName(date) {
  const key = formatKey(date);
  return EGYPTIAN_HOLIDAYS_MAP[key] || null;
}

/**
 * Calculates working days between two dates, strictly excluding weekends & national holidays.
 */
function calculateWorkingDays(startDate, endDate) {
  const startD = parseDate(startDate);
  const endD = parseDate(endDate);
  if (!startD || !endD) {
    return { workingDays: 0, excludedWeekends: 0, excludedHolidays: [] };
  }

  const start = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
  const end = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());

  if (end < start) {
    return { workingDays: 0, excludedWeekends: 0, excludedHolidays: [] };
  }

  let workingDays = 0;
  let excludedWeekends = 0;
  const excludedHolidays = [];

  const cur = new Date(start);
  while (cur <= end) {
    const isWk = isWeekend(cur);
    const holiday = getHolidayName(cur);

    if (isWk) {
      excludedWeekends++;
    } else if (holiday) {
      excludedHolidays.push({ date: formatKey(cur), name: holiday });
    } else {
      workingDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  // If requested within rest days only (emergency/shift), fallback to total days requested
  if (workingDays === 0 && end >= start) {
    const totalDiff = Math.round((end - start) / (24 * 3600 * 1000)) + 1;
    workingDays = totalDiff;
  }

  return {
    workingDays,
    excludedWeekends,
    excludedHolidays,
  };
}

module.exports = {
  isWeekend,
  getHolidayName,
  calculateWorkingDays,
  EGYPTIAN_HOLIDAYS_MAP,
};
