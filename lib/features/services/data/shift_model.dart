class WorkShift {
  final String dayEn;
  final String dayAr;
  final String date; // YYYY-MM-DD
  final String shift; // 'morning', 'evening', 'night', 'regular', 'off'
  final String name;
  final String shiftNameAr;
  final String time;
  final String timeAr;
  final bool isConfirmed;
  final bool isOverride;
  final String supervisor;
  final String line;

  const WorkShift({
    required this.dayEn,
    required this.dayAr,
    required this.date,
    required this.shift,
    required this.name,
    required this.shiftNameAr,
    required this.time,
    required this.timeAr,
    this.isConfirmed = true,
    this.isOverride = false,
    this.supervisor = 'Mohamed Hassan',
    this.line = 'Production Line A',
  });

  bool get isRestDay => shift == 'off';

  String localizedName(bool isAr) => isAr ? shiftNameAr : name;
  String localizedTime(bool isAr) => isAr ? timeAr : time;
  String localizedDay(bool isAr) => isAr ? dayAr : dayEn;

  factory WorkShift.fromJson(Map<String, dynamic> json) {
    return WorkShift(
      dayEn: json['dayEn'] as String? ?? json['day'] as String? ?? 'Sun',
      dayAr: json['dayAr'] as String? ?? 'الأحد',
      date: json['date'] as String? ?? '',
      shift: json['shift'] as String? ?? 'morning',
      name: json['name'] as String? ?? 'Morning Shift',
      shiftNameAr: json['shiftNameAr'] as String? ?? 'الوردية الأولى',
      time: json['time'] as String? ?? '07:00 AM – 03:00 PM',
      timeAr: json['timeAr'] as String? ?? '07:00 ص – 03:00 م',
      isConfirmed: json['isConfirmed'] as bool? ?? true,
      isOverride: json['isOverride'] as bool? ?? false,
      supervisor: json['supervisor'] as String? ?? 'Mohamed Hassan',
      line: json['line'] as String? ?? 'Production Line A',
    );
  }

  Map<String, dynamic> toJson() => {
        'dayEn': dayEn,
        'dayAr': dayAr,
        'date': date,
        'shift': shift,
        'name': name,
        'shiftNameAr': shiftNameAr,
        'time': time,
        'timeAr': timeAr,
        'isConfirmed': isConfirmed,
        'isOverride': isOverride,
        'supervisor': supervisor,
        'line': line,
      };
}

class ShiftWeek {
  final String weekStart;
  final bool isCurrent;
  final List<WorkShift> days;

  const ShiftWeek({
    required this.weekStart,
    required this.isCurrent,
    required this.days,
  });

  factory ShiftWeek.fromJson(Map<String, dynamic> json) {
    final rawDays = json['days'] as List<dynamic>? ?? [];
    return ShiftWeek(
      weekStart: json['weekStart'] as String? ?? '',
      isCurrent: json['isCurrent'] as bool? ?? false,
      days: rawDays
          .map((d) => WorkShift.fromJson(d as Map<String, dynamic>))
          .toList(),
    );
  }
}

class ShiftSwapColleague {
  final String id;
  final String name;
  final String employeeCode;
  final String position;
  final String currentShift;
  final String currentShiftName;
  final String currentShiftNameAr;
  final String currentShiftTime;
  final String currentShiftTimeAr;
  final bool isEligible;
  final String? ineligibilityReason;
  final String? ineligibilityMessage;

  const ShiftSwapColleague({
    required this.id,
    required this.name,
    required this.employeeCode,
    required this.position,
    required this.currentShift,
    required this.currentShiftName,
    required this.currentShiftNameAr,
    required this.currentShiftTime,
    required this.currentShiftTimeAr,
    this.isEligible = true,
    this.ineligibilityReason,
    this.ineligibilityMessage,
  });

  factory ShiftSwapColleague.fromJson(Map<String, dynamic> json) {
    return ShiftSwapColleague(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      employeeCode: json['employeeCode'] as String? ?? '',
      position: json['position'] as String? ?? '',
      currentShift: json['currentShift'] as String? ?? 'morning',
      currentShiftName: json['currentShiftName'] as String? ?? '',
      currentShiftNameAr: json['currentShiftNameAr'] as String? ?? '',
      currentShiftTime: json['currentShiftTime'] as String? ?? '',
      currentShiftTimeAr: json['currentShiftTimeAr'] as String? ?? '',
      isEligible: json['isEligible'] as bool? ?? true,
      ineligibilityReason: json['ineligibilityReason'] as String?,
      ineligibilityMessage: json['ineligibilityMessage'] as String?,
    );
  }
}

class ShiftSwapRequest {
  final String id;
  final String requesterId;
  final String requesterName;
  final String targetEmployeeId;
  final String targetEmployeeName;
  final String date;
  final String myShiftId;
  final String myShiftName;
  final String myShiftNameAr;
  final String targetShiftId;
  final String targetShiftName;
  final String targetShiftNameAr;
  final String reason;
  final String status; // colleague_pending, supervisor_pending, approved, declined_by_colleague, rejected_by_supervisor
  final String supervisor;
  final int createdAt;

  const ShiftSwapRequest({
    required this.id,
    required this.requesterId,
    required this.requesterName,
    required this.targetEmployeeId,
    required this.targetEmployeeName,
    required this.date,
    required this.myShiftId,
    required this.myShiftName,
    required this.myShiftNameAr,
    required this.targetShiftId,
    required this.targetShiftName,
    required this.targetShiftNameAr,
    required this.reason,
    required this.status,
    required this.supervisor,
    required this.createdAt,
  });

  factory ShiftSwapRequest.fromJson(Map<String, dynamic> json) {
    return ShiftSwapRequest(
      id: json['id'] as String? ?? '',
      requesterId: json['requesterId'] as String? ?? '',
      requesterName: json['requesterName'] as String? ?? '',
      targetEmployeeId: json['targetEmployeeId'] as String? ?? '',
      targetEmployeeName: json['targetEmployeeName'] as String? ?? '',
      date: json['date'] as String? ?? '',
      myShiftId: json['myShiftId'] as String? ?? '',
      myShiftName: json['myShiftName'] as String? ?? '',
      myShiftNameAr: json['myShiftNameAr'] as String? ?? '',
      targetShiftId: json['targetShiftId'] as String? ?? '',
      targetShiftName: json['targetShiftName'] as String? ?? '',
      targetShiftNameAr: json['targetShiftNameAr'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
      status: json['status'] as String? ?? 'colleague_pending',
      supervisor: json['supervisor'] as String? ?? '',
      createdAt: json['createdAt'] as int? ?? 0,
    );
  }
  bool get isPendingColleague => status == 'colleague_pending';
  bool get isPendingSupervisor => status == 'supervisor_pending';
  bool get isApproved => status == 'approved';
  bool get isDeclined => status.contains('declined') || status.contains('rejected');
}

class OvertimeClaim {
  final String id;
  final String employeeId;
  final String date;
  final double hours;
  final String timePeriod; // 'day' or 'night'
  final String reason;
  final double multiplier;
  final int totalAmount;
  final String status; // 'pending_supervisor', 'approved', 'rejected'
  final int createdAt;

  const OvertimeClaim({
    required this.id,
    required this.employeeId,
    required this.date,
    required this.hours,
    required this.timePeriod,
    required this.reason,
    required this.multiplier,
    required this.totalAmount,
    required this.status,
    required this.createdAt,
  });

  bool get isApproved => status == 'approved';
  bool get isPending => status == 'pending_supervisor';

  factory OvertimeClaim.fromJson(Map<String, dynamic> json) {
    final calc = json['calculation'] as Map<String, dynamic>? ?? {};
    return OvertimeClaim(
      id: json['id'] as String? ?? '',
      employeeId: json['employeeId'] as String? ?? '',
      date: json['date'] as String? ?? '',
      hours: (json['hours'] as num?)?.toDouble() ?? 1.0,
      timePeriod: json['timePeriod'] as String? ?? 'day',
      reason: json['reason'] as String? ?? '',
      multiplier: (calc['multiplier'] as num?)?.toDouble() ?? 1.35,
      totalAmount: (calc['totalAmount'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'pending_supervisor',
      createdAt: json['createdAt'] as int? ?? 0,
    );
  }
}

class TodayPunchState {
  final String date;
  final String status; // 'checked_in', 'checked_out', 'not_checked_in'
  final int workingMinutes;
  final String? punchInTime;
  final String? punchOutTime;
  final String punctuality;
  final int delayMinutes;
  final String qrToken;
  final String offlineToken;
  final String? factoryName;

  const TodayPunchState({
    required this.date,
    required this.status,
    this.workingMinutes = 0,
    this.punchInTime,
    this.punchOutTime,
    this.punctuality = 'on_time',
    this.delayMinutes = 0,
    required this.qrToken,
    required this.offlineToken,
    this.factoryName,
  });

  bool get isCheckedIn => status == 'checked_in';
  bool get isCheckedOut => status == 'checked_out';
  bool get isNotCheckedIn => status == 'not_checked_in';

  Map<String, dynamic> toJson() => {
        'date': date,
        'status': status,
        'workingMinutes': workingMinutes,
        'punchInTime': punchInTime,
        'punchOutTime': punchOutTime,
        'punctuality': punctuality,
        'delayMinutes': delayMinutes,
        'qrToken': qrToken,
        'offlineToken': offlineToken,
        'factoryName': factoryName,
      };

  factory TodayPunchState.fromJson(Map<String, dynamic> json) {
    final punchIn = json['punchIn'] as Map<String, dynamic>?;
    final punchOut = json['punchOut'] as Map<String, dynamic>?;
    final geofence = json['factoryGeofence'] as Map<String, dynamic>?;

    return TodayPunchState(
      date: json['date'] as String? ?? '',
      status: json['status'] as String? ?? 'not_checked_in',
      workingMinutes: (json['workingMinutes'] as num?)?.toInt() ?? 0,
      punchInTime: punchIn?['timeFormatted'] as String? ?? json['punchInTime'] as String?,
      punchOutTime: punchOut?['timeFormatted'] as String? ?? json['punchOutTime'] as String?,
      punctuality: punchIn?['punctuality'] as String? ?? json['punctuality'] as String? ?? 'on_time',
      delayMinutes: (punchIn?['delayMinutes'] as num?)?.toInt() ?? (json['delayMinutes'] as num?)?.toInt() ?? 0,
      qrToken: json['qrToken'] as String? ?? '',
      offlineToken: json['offlineToken'] as String? ?? '',
      factoryName: geofence?['nameAr'] as String? ?? json['factoryName'] as String? ?? 'مجمع العاشر من رمضان',
    );
  }
}
