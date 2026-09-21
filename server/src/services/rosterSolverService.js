const { data: db, save } = require('../db');

/**
 * Main entry point: generates a weekly roster
 * @param {string} tenantId 
 * @param {string} weekStart - ISO date string (Sunday)
 * @param {object} options - { includeOvertime: bool, includeSaturday: bool }
 * @returns {{ roster: Array, violations: string[], stats: object }}
 */
function solveRoster(tenantId, weekStart, options = {}) {
  const database = db();
  const effectiveTenant = tenantId || 'elaraby';
  const employees = database.employees.filter(e => (e.tenantId || 'elaraby') === effectiveTenant);
  const startDate = new Date(weekStart);
  
  // Egyptian week: Sun(0) to Thu(4) or Sat(6)
  const daysInWeek = options.includeSaturday ? 7 : 7; // We iterate all 7 days, but set Fri/Sat accordingly
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    weekDays.push(d);
  }

  // Load approved leaves
  const weekEnd = new Date(startDate);
  weekEnd.setDate(startDate.getDate() + 6);
  const weekEndMs = weekEnd.getTime();
  const weekStartMs = startDate.getTime();

  const approvedLeaves = (database.requests || []).filter(r => 
    r.status === 'approved' && 
    String(r.type || '').toLowerCase() === 'leave' &&
    ((r.startDate && new Date(r.startDate).getTime() <= weekEndMs) || r.createdAt <= weekEndMs)
  );

  const roster = [];
  const violations = [];
  let shiftA = 0, shiftB = 0, shiftC = 0, offDays = 0, leaveDays = 0;
  
  // Track consecutive days worked per employee (approximate from within this week)
  const consecutiveDays = {};
  
  // Simple round-robin shift assignment
  const shifts = ['A', 'B', 'C'];
  const shiftTimes = { A: {start: '06:00', end: '14:00'}, B: {start: '14:00', end: '22:00'}, C: {start: '22:00', end: '06:00'} };

  // Sort employees to prioritize seniors avoiding shift C
  const sortedEmployees = [...employees].sort((a, b) => {
    const aSenior = (Number(a.yearsOfService) || 0) >= 3 ? 1 : 0;
    const bSenior = (Number(b.yearsOfService) || 0) >= 3 ? 1 : 0;
    return bSenior - aSenior;
  });

  for (let i = 0; i < weekDays.length; i++) {
    const d = weekDays[i];
    const dayOfWeek = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const dateStr = d.toISOString().substring(0, 10);
    
    // Day OFF logic
    const isFriday = dayOfWeek === 5;
    const isSaturday = dayOfWeek === 6;
    const isWeekend = isFriday || (!options.includeSaturday && isSaturday);
    
    let shiftIndex = 0;
    
    for (const emp of sortedEmployees) {
      if (!consecutiveDays[emp.id]) consecutiveDays[emp.id] = 0;
      
      const empLeaves = approvedLeaves.filter(l => l.employeeId === emp.id);
      // For simplicity, if they have an approved leave that falls on this date, mark LEAVE
      let onLeave = false;
      for (const leave of empLeaves) {
        // approximate leave matching
        const lStart = new Date(leave.startDate || leave.createdAt).getTime();
        const lDays = Number(leave.days || leave.details?.days || 1);
        const lEnd = lStart + (lDays * 24 * 3600 * 1000);
        if (d.getTime() >= lStart && d.getTime() <= lEnd) {
          onLeave = true;
          break;
        }
      }

      let assignedShift = 'OFF';
      let assignedStart = null;
      let assignedEnd = null;

      if (isWeekend) {
        assignedShift = 'OFF';
        offDays++;
        consecutiveDays[emp.id] = 0;
      } else if (onLeave) {
        assignedShift = 'LEAVE';
        leaveDays++;
        consecutiveDays[emp.id] = 0;
      } else if (consecutiveDays[emp.id] >= 6) {
        assignedShift = 'OFF';
        offDays++;
        consecutiveDays[emp.id] = 0;
      } else {
        // Assign A, B, or C
        let targetShift = shifts[shiftIndex % 3];
        const isSenior = (Number(emp.yearsOfService) || 0) >= 3;
        
        if (targetShift === 'C' && isSenior) {
          targetShift = 'A'; // Senior preference
        }

        assignedShift = targetShift;
        assignedStart = shiftTimes[targetShift].start;
        assignedEnd = shiftTimes[targetShift].end;
        
        if (targetShift === 'A') shiftA++;
        if (targetShift === 'B') shiftB++;
        if (targetShift === 'C') shiftC++;
        
        consecutiveDays[emp.id]++;
        shiftIndex++;
      }

      roster.push({
        id: `RST-${tenantId}-${dateStr}-${emp.employeeCode || emp.id}`,
        tenantId,
        employeeCode: emp.employeeCode,
        employeeName: emp.name,
        date: dateStr,
        dayOfWeek,
        shift: assignedShift,
        shiftStart: assignedStart,
        shiftEnd: assignedEnd,
        isOvertime: false,
        department: emp.department || 'Operations',
        line: emp.factory || 'Main',
        generatedAt: new Date().toISOString()
      });
    }
  }

  const validateResult = validateRoster(roster);
  violations.push(...validateResult.violations);

  const stats = {
    totalEmployees: employees.length,
    scheduledDays: roster.filter(r => ['A','B','C'].includes(r.shift)).length,
    offDays,
    leaveDays,
    shiftA,
    shiftB,
    shiftC
  };

  return { roster, violations, stats };
}

/**
 * Validates a roster against hard constraints
 * @returns { valid: bool, violations: string[] }
 */
function validateRoster(rosterEntries) {
  const violations = [];
  const empMap = {};
  
  for (const entry of rosterEntries) {
    if (!empMap[entry.employeeCode]) empMap[entry.employeeCode] = [];
    empMap[entry.employeeCode].push(entry);
  }

  for (const [code, entries] of Object.entries(empMap)) {
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    let consecutive = 0;
    let hasOff = false;
    for (const entry of entries) {
      if (['A','B','C'].includes(entry.shift)) {
        consecutive++;
      } else {
        consecutive = 0;
        if (entry.shift === 'OFF') hasOff = true;
      }
      if (consecutive > 6) {
        violations.push(`Employee ${code} worked more than 6 consecutive days`);
      }
    }
    if (!hasOff && entries.length === 7) {
      violations.push(`Employee ${code} has no OFF day in the week`);
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Exports roster to CSV (UTF-8 BOM for Arabic Excel)
 */
function exportRosterToCsv(rosterEntries, employees) {
  const bom = '\uFEFF';
  const headers = ['تاريخ', 'كود الموظف', 'اسم الموظف', 'القسم', 'الوردية', 'بداية', 'نهاية'];
  
  const rows = rosterEntries.map(r => {
    return [
      r.date,
      r.employeeCode || '',
      r.employeeName || '',
      r.department || '',
      r.shift,
      r.shiftStart || '',
      r.shiftEnd || ''
    ].join(',');
  });

  return bom + headers.join(',') + '\n' + rows.join('\n');
}

module.exports = { solveRoster, validateRoster, exportRosterToCsv };
