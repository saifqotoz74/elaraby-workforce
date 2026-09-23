const { data: db } = require('../../db');

const SHIFT_PRESETS = {
  morning: {
    time: '07:00 AM – 03:00 PM',
    timeEn: '07:00 AM – 03:00 PM',
    timeAr: '07:00 ص – 03:00 م',
    name: 'Morning Shift',
    nameEn: 'Morning Shift',
    nameAr: 'الوردية الأولى (صباحية)',
    offDuty: false,
  },
  evening: {
    time: '03:00 PM – 11:00 PM',
    timeEn: '03:00 PM – 11:00 PM',
    timeAr: '03:00 م – 11:00 م',
    name: 'Evening Shift',
    nameEn: 'Evening Shift',
    nameAr: 'الوردية الثانية (مسائية)',
    offDuty: false,
  },
  night: {
    time: '11:00 PM – 07:00 AM',
    timeEn: '11:00 PM – 07:00 AM',
    timeAr: '11:00 م – 07:00 ص',
    name: 'Night Shift',
    nameEn: 'Night Shift',
    nameAr: 'الوردية الثالثة (ليلية)',
    offDuty: false,
  },
  office: {
    time: '08:30 AM – 04:30 PM',
    timeEn: '08:30 AM – 04:30 PM',
    timeAr: '08:30 ص – 04:30 م',
    name: 'Office Hours',
    nameEn: 'Office Hours',
    nameAr: 'الدوام الإداري العام',
    offDuty: false,
  },
  off: {
    time: 'Rest Day',
    timeEn: 'Rest Day',
    timeAr: 'عطلة أسبوعية',
    name: 'Off Duty',
    nameEn: 'Off Duty',
    nameAr: 'يوم راحة أسبوعية',
    offDuty: true,
  },
};

function currentWeekStartKey() {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
}

function resolveEmployeeShiftForDay(employee, dayIndex, customShift) {
  let shiftKey = customShift;
  if (!shiftKey) {
    const isRestDay = dayIndex === 5 || dayIndex === 6; // Friday or Saturday
    if (isRestDay) {
      shiftKey = 'off';
    } else {
      const isPR = String(employee?.department || '').includes('Public Relations') ||
                   String(employee?.department || '').includes('العلاقات العامة');
      shiftKey = isPR ? 'office' : 'morning';
    }
  }
  const preset = SHIFT_PRESETS[shiftKey] || SHIFT_PRESETS.morning;
  const lineText = employee
    ? `${employee.factory || 'Elaraby Group'} • ${employee.department || 'Operations'}`
    : 'Elaraby Workforce';

  return {
    shiftKey,
    name: preset.nameEn,
    shiftName: preset.nameEn,
    shiftNameAr: preset.nameAr,
    time: preset.timeEn,
    timeEn: preset.timeEn,
    timeAr: preset.timeAr,
    line: lineText,
    lineAr: lineText,
    offDuty: preset.offDuty,
  };
}

function resolveTodayShift(employee) {
  if (!employee) return null;
  const now = new Date();
  const dayIndex = now.getDay();
  const weekStart = currentWeekStartKey();
  const rosterList = db().roster || [];
  const record = rosterList.find(
    (r) => r.employeeId === employee.id && (r.weekStart === weekStart || !r.weekStart),
  );
  const customShift = record?.days?.find((d) => d.dayIndex === dayIndex)?.shift;
  return {
    ...resolveEmployeeShiftForDay(employee, dayIndex, customShift),
    date: now.toISOString().slice(0, 10),
    dayIndex,
  };
}

function resolveWeekRoster(employee, record) {
  const now = new Date();
  const dayIndexToday = now.getDay();
  return Array.from({ length: 7 }).map((_, i) => {
    const customShift = record?.days?.find((d) => d.dayIndex === i)?.shift;
    const resolved = resolveEmployeeShiftForDay(employee, i, customShift);
    return {
      dayIndex: i,
      shift: resolved.shiftKey,
      ...resolved,
      isToday: i === dayIndexToday,
    };
  });
}

module.exports = {
  SHIFT_PRESETS,
  currentWeekStartKey,
  resolveEmployeeShiftForDay,
  resolveTodayShift,
  resolveWeekRoster,
};
