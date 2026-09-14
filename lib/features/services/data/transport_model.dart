class BusStop {
  final String id;
  final String nameAr;
  final String nameEn;
  final double lat;
  final double lng;
  final String scheduledTime;
  final int order;

  const BusStop({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.lat,
    required this.lng,
    required this.scheduledTime,
    required this.order,
  });

  String localizedName(bool isArabic) => isArabic ? nameAr : nameEn;

  factory BusStop.fromJson(Map<String, dynamic> json) {
    return BusStop(
      id: json['id'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
      scheduledTime: json['scheduledTime'] as String? ?? '',
      order: (json['order'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'nameAr': nameAr,
        'nameEn': nameEn,
        'lat': lat,
        'lng': lng,
        'scheduledTime': scheduledTime,
        'order': order,
      };
}

class BusDriver {
  final String id;
  final String name;
  final String nameEn;
  final String phone;
  final double rating;

  const BusDriver({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.phone,
    this.rating = 5.0,
  });

  String localizedName(bool isArabic) => isArabic ? name : nameEn;

  factory BusDriver.fromJson(Map<String, dynamic> json) {
    return BusDriver(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'nameEn': nameEn,
        'phone': phone,
        'rating': rating,
      };
}

class BusRoute {
  final String id;
  final String code;
  final String nameAr;
  final String nameEn;
  final String destinationComplex;
  final String destinationAr;
  final String vehiclePlate;
  final String vehiclePlateEn;
  final String busModel;
  final int capacity;
  final BusDriver driver;
  final String shiftId;
  final List<BusStop> stops;

  const BusRoute({
    required this.id,
    required this.code,
    required this.nameAr,
    required this.nameEn,
    required this.destinationComplex,
    required this.destinationAr,
    required this.vehiclePlate,
    required this.vehiclePlateEn,
    required this.busModel,
    required this.capacity,
    required this.driver,
    required this.shiftId,
    required this.stops,
  });

  String localizedName(bool isArabic) => isArabic ? nameAr : nameEn;

  factory BusRoute.fromJson(Map<String, dynamic> json) {
    final rawStops = json['stops'] as List<dynamic>? ?? [];
    return BusRoute(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      destinationComplex: json['destinationComplex'] as String? ?? '10th of Ramadan',
      destinationAr: json['destinationAr'] as String? ?? 'مجمع مصانع العاشر من رمضان',
      vehiclePlate: json['vehiclePlate'] as String? ?? '',
      vehiclePlateEn: json['vehiclePlateEn'] as String? ?? '',
      busModel: json['busModel'] as String? ?? '',
      capacity: (json['capacity'] as num?)?.toInt() ?? 50,
      driver: BusDriver.fromJson(json['driver'] as Map<String, dynamic>? ?? {}),
      shiftId: json['shiftId'] as String? ?? 'morning',
      stops: rawStops.map((s) => BusStop.fromJson(s as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'nameAr': nameAr,
        'nameEn': nameEn,
        'destinationComplex': destinationComplex,
        'destinationAr': destinationAr,
        'vehiclePlate': vehiclePlate,
        'vehiclePlateEn': vehiclePlateEn,
        'busModel': busModel,
        'capacity': capacity,
        'driver': driver.toJson(),
        'shiftId': shiftId,
        'stops': stops.map((s) => s.toJson()).toList(),
      };
}

class BusTelemetry {
  final String routeId;
  final String routeCode;
  final double currentLat;
  final double currentLng;
  final int speedKmh;
  final int headingDegrees;
  final String currentStopName;
  final String nextStopName;
  final String targetStopId;
  final String targetStopName;
  final int distanceKm;
  final int etaMinutes;
  final String status;
  final String statusTextAr;
  final String statusTextEn;
  final bool isApproaching;
  final bool isAtStop;
  final int lastUpdated;

  const BusTelemetry({
    required this.routeId,
    required this.routeCode,
    required this.currentLat,
    required this.currentLng,
    required this.speedKmh,
    this.headingDegrees = 0,
    required this.currentStopName,
    required this.nextStopName,
    required this.targetStopId,
    required this.targetStopName,
    required this.distanceKm,
    required this.etaMinutes,
    required this.status,
    required this.statusTextAr,
    required this.statusTextEn,
    this.isApproaching = false,
    this.isAtStop = false,
    required this.lastUpdated,
  });

  String localizedStatus(bool isArabic) => isArabic ? statusTextAr : statusTextEn;

  factory BusTelemetry.fromJson(Map<String, dynamic> json) {
    return BusTelemetry(
      routeId: json['routeId'] as String? ?? '',
      routeCode: json['routeCode'] as String? ?? '',
      currentLat: (json['currentLat'] as num?)?.toDouble() ?? 0.0,
      currentLng: (json['currentLng'] as num?)?.toDouble() ?? 0.0,
      speedKmh: (json['speedKmh'] as num?)?.toInt() ?? 0,
      headingDegrees: (json['headingDegrees'] as num?)?.toInt() ?? 0,
      currentStopName: json['currentStopName'] as String? ?? '',
      nextStopName: json['nextStopName'] as String? ?? '',
      targetStopId: json['targetStopId'] as String? ?? '',
      targetStopName: json['targetStopName'] as String? ?? '',
      distanceKm: (json['distanceKm'] as num?)?.toInt() ?? 0,
      etaMinutes: (json['etaMinutes'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'in_transit',
      statusTextAr: json['statusTextAr'] as String? ?? 'في الطريق إلى محطتك',
      statusTextEn: json['statusTextEn'] as String? ?? 'En route to your stop',
      isApproaching: json['isApproaching'] as bool? ?? false,
      isAtStop: json['isAtStop'] as bool? ?? false,
      lastUpdated: json['lastUpdated'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'routeId': routeId,
        'routeCode': routeCode,
        'currentLat': currentLat,
        'currentLng': currentLng,
        'speedKmh': speedKmh,
        'headingDegrees': headingDegrees,
        'currentStopName': currentStopName,
        'nextStopName': nextStopName,
        'targetStopId': targetStopId,
        'targetStopName': targetStopName,
        'distanceKm': distanceKm,
        'etaMinutes': etaMinutes,
        'status': status,
        'statusTextAr': statusTextAr,
        'statusTextEn': statusTextEn,
        'isApproaching': isApproaching,
        'isAtStop': isAtStop,
        'lastUpdated': lastUpdated,
      };
}

class BusAssignment {
  final String employeeId;
  final String assignedRouteId;
  final String selectedStopId;
  final String seatNumber;
  final bool optOutToday;

  const BusAssignment({
    required this.employeeId,
    required this.assignedRouteId,
    required this.selectedStopId,
    this.seatNumber = 'A-12',
    this.optOutToday = false,
  });

  factory BusAssignment.fromJson(Map<String, dynamic> json) {
    return BusAssignment(
      employeeId: json['employeeId'] as String? ?? '',
      assignedRouteId: json['assignedRouteId'] as String? ?? '',
      selectedStopId: json['selectedStopId'] as String? ?? '',
      seatNumber: json['seatNumber'] as String? ?? 'A-12',
      optOutToday: json['optOutToday'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'employeeId': employeeId,
        'assignedRouteId': assignedRouteId,
        'selectedStopId': selectedStopId,
        'seatNumber': seatNumber,
        'optOutToday': optOutToday,
      };
}

class BusBoarding {
  final String id;
  final String employeeId;
  final String employeeName;
  final String routeId;
  final String routeNameAr;
  final String date;
  final String boardTime;
  final String verifiedByDriver;
  final String transitStatus;
  final bool excusedForTransitDelay;

  const BusBoarding({
    required this.id,
    required this.employeeId,
    required this.employeeName,
    required this.routeId,
    required this.routeNameAr,
    required this.date,
    required this.boardTime,
    required this.verifiedByDriver,
    this.transitStatus = 'in_transit',
    this.excusedForTransitDelay = false,
  });

  bool get isInTransit => transitStatus == 'in_transit';

  factory BusBoarding.fromJson(Map<String, dynamic> json) {
    return BusBoarding(
      id: json['id'] as String? ?? '',
      employeeId: json['employeeId'] as String? ?? '',
      employeeName: json['employeeName'] as String? ?? '',
      routeId: json['routeId'] as String? ?? '',
      routeNameAr: json['routeNameAr'] as String? ?? '',
      date: json['date'] as String? ?? '',
      boardTime: json['boardTime'] as String? ?? '',
      verifiedByDriver: json['verifiedByDriver'] as String? ?? '',
      transitStatus: json['transitStatus'] as String? ?? 'in_transit',
      excusedForTransitDelay: json['excusedForTransitDelay'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'employeeId': employeeId,
        'employeeName': employeeName,
        'routeId': routeId,
        'routeNameAr': routeNameAr,
        'date': date,
        'boardTime': boardTime,
        'verifiedByDriver': verifiedByDriver,
        'transitStatus': transitStatus,
        'excusedForTransitDelay': excusedForTransitDelay,
      };
}

class RouteAlert {
  final String id;
  final String routeId;
  final String routeNameAr;
  final String type;
  final String message;
  final int delayMinutes;
  final String reportedBy;
  final int timestamp;
  final bool active;

  const RouteAlert({
    required this.id,
    required this.routeId,
    required this.routeNameAr,
    required this.type,
    required this.message,
    this.delayMinutes = 15,
    required this.reportedBy,
    required this.timestamp,
    this.active = true,
  });

  factory RouteAlert.fromJson(Map<String, dynamic> json) {
    return RouteAlert(
      id: json['id'] as String? ?? '',
      routeId: json['routeId'] as String? ?? '',
      routeNameAr: json['routeNameAr'] as String? ?? '',
      type: json['type'] as String? ?? 'traffic_delay',
      message: json['message'] as String? ?? '',
      delayMinutes: (json['delayMinutes'] as num?)?.toInt() ?? 15,
      reportedBy: json['reportedBy'] as String? ?? 'Logistics Control',
      timestamp: json['timestamp'] as int? ?? 0,
      active: json['active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'routeId': routeId,
        'routeNameAr': routeNameAr,
        'type': type,
        'message': message,
        'delayMinutes': delayMinutes,
        'reportedBy': reportedBy,
        'timestamp': timestamp,
        'active': active,
      };
}

class BoardingPassData {
  final String employeeId;
  final String employeeName;
  final String employeeCode;
  final String routeId;
  final String routeCode;
  final String routeNameAr;
  final String routeNameEn;
  final String seatNumber;
  final String vehiclePlate;
  final String destinationAr;
  final String qrToken;
  final int expiresInSeconds;
  final int issuedAt;

  const BoardingPassData({
    required this.employeeId,
    required this.employeeName,
    required this.employeeCode,
    required this.routeId,
    required this.routeCode,
    required this.routeNameAr,
    required this.routeNameEn,
    required this.seatNumber,
    required this.vehiclePlate,
    required this.destinationAr,
    required this.qrToken,
    required this.expiresInSeconds,
    required this.issuedAt,
  });

  String localizedRoute(bool isArabic) => isArabic ? routeNameAr : routeNameEn;

  factory BoardingPassData.fromJson(Map<String, dynamic> json) {
    return BoardingPassData(
      employeeId: json['employeeId'] as String? ?? '',
      employeeName: json['employeeName'] as String? ?? '',
      employeeCode: json['employeeCode'] as String? ?? '',
      routeId: json['routeId'] as String? ?? '',
      routeCode: json['routeCode'] as String? ?? '',
      routeNameAr: json['routeNameAr'] as String? ?? '',
      routeNameEn: json['routeNameEn'] as String? ?? '',
      seatNumber: json['seatNumber'] as String? ?? 'A-12',
      vehiclePlate: json['vehiclePlate'] as String? ?? '',
      destinationAr: json['destinationAr'] as String? ?? '',
      qrToken: json['qrToken'] as String? ?? '',
      expiresInSeconds: (json['expiresInSeconds'] as num?)?.toInt() ?? 60,
      issuedAt: json['issuedAt'] as int? ?? 0,
    );
  }
}

class CommuteSuppression {
  final bool isSuppressed;
  final String reason;
  final String reasonAr;
  final String reasonEn;
  final bool optOutToday;

  const CommuteSuppression({
    this.isSuppressed = false,
    this.reason = 'active',
    this.reasonAr = 'تنبيهات الحافلة مفعّلة',
    this.reasonEn = 'Bus alerts active',
    this.optOutToday = false,
  });

  String localizedReason(bool isArabic) => isArabic ? reasonAr : reasonEn;

  factory CommuteSuppression.fromJson(Map<String, dynamic> json) {
    return CommuteSuppression(
      isSuppressed: json['isSuppressed'] as bool? ?? false,
      reason: json['reason'] as String? ?? 'active',
      reasonAr: json['reasonAr'] as String? ?? 'تنبيهات الحافلة مفعّلة',
      reasonEn: json['reasonEn'] as String? ?? 'Bus alerts active',
      optOutToday: json['optOutToday'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'isSuppressed': isSuppressed,
        'reason': reason,
        'reasonAr': reasonAr,
        'reasonEn': reasonEn,
        'optOutToday': optOutToday,
      };
}

class ProximityAlertEvent {
  final String employeeId;
  final String routeId;
  final String routeCode;
  final String routeNameAr;
  final String stopId;
  final String stopNameAr;
  final String stopNameEn;
  final int distanceKm;
  final int etaMinutes;
  final String driverName;
  final String driverPhone;
  final String vehiclePlate;
  final String titleAr;
  final String titleEn;
  final String bodyAr;
  final String bodyEn;
  final int timestamp;

  const ProximityAlertEvent({
    required this.employeeId,
    required this.routeId,
    required this.routeCode,
    required this.routeNameAr,
    required this.stopId,
    required this.stopNameAr,
    required this.stopNameEn,
    required this.distanceKm,
    required this.etaMinutes,
    required this.driverName,
    required this.driverPhone,
    required this.vehiclePlate,
    required this.titleAr,
    required this.titleEn,
    required this.bodyAr,
    required this.bodyEn,
    required this.timestamp,
  });

  String localizedTitle(bool isArabic) => isArabic ? titleAr : titleEn;
  String localizedBody(bool isArabic) => isArabic ? bodyAr : bodyEn;

  factory ProximityAlertEvent.fromJson(Map<String, dynamic> json) {
    return ProximityAlertEvent(
      employeeId: json['employeeId'] as String? ?? '',
      routeId: json['routeId'] as String? ?? '',
      routeCode: json['routeCode'] as String? ?? '',
      routeNameAr: json['routeNameAr'] as String? ?? '',
      stopId: json['stopId'] as String? ?? '',
      stopNameAr: json['stopNameAr'] as String? ?? '',
      stopNameEn: json['stopNameEn'] as String? ?? '',
      distanceKm: (json['distanceKm'] as num?)?.toInt() ?? 0,
      etaMinutes: (json['etaMinutes'] as num?)?.toInt() ?? 0,
      driverName: json['driverName'] as String? ?? '',
      driverPhone: json['driverPhone'] as String? ?? '',
      vehiclePlate: json['vehiclePlate'] as String? ?? '',
      titleAr: json['titleAr'] as String? ?? '',
      titleEn: json['titleEn'] as String? ?? '',
      bodyAr: json['bodyAr'] as String? ?? '',
      bodyEn: json['bodyEn'] as String? ?? '',
      timestamp: json['timestamp'] as int? ?? 0,
    );
  }
}

class MyCommuteState {
  final BusRoute? route;
  final BusAssignment? assignment;
  final BusTelemetry? telemetry;
  final BusBoarding? boarding;
  final bool hasBoarded;
  final List<RouteAlert> alerts;
  final CommuteSuppression suppression;

  const MyCommuteState({
    this.route,
    this.assignment,
    this.telemetry,
    this.boarding,
    this.hasBoarded = false,
    this.alerts = const [],
    this.suppression = const CommuteSuppression(),
  });

  factory MyCommuteState.fromJson(Map<String, dynamic> json) {
    final rawAlerts = json['alerts'] as List<dynamic>? ?? [];
    return MyCommuteState(
      route: json['route'] != null ? BusRoute.fromJson(json['route'] as Map<String, dynamic>) : null,
      assignment: json['assignment'] != null
          ? BusAssignment.fromJson(json['assignment'] as Map<String, dynamic>)
          : null,
      telemetry: json['telemetry'] != null
          ? BusTelemetry.fromJson(json['telemetry'] as Map<String, dynamic>)
          : null,
      boarding: json['boarding'] != null
          ? BusBoarding.fromJson(json['boarding'] as Map<String, dynamic>)
          : null,
      hasBoarded: json['hasBoarded'] as bool? ?? false,
      alerts: rawAlerts.map((a) => RouteAlert.fromJson(a as Map<String, dynamic>)).toList(),
      suppression: json['suppression'] != null
          ? CommuteSuppression.fromJson(json['suppression'] as Map<String, dynamic>)
          : const CommuteSuppression(),
    );
  }
}

class ManifestPassenger {
  final String id;
  final String nameAr;
  final String nameEn;
  final String department;
  final String phone;
  final String seatNumber;
  final String photoUrl;
  final String boardingStatus;
  final String? boardedAt;
  final String? verifiedBy;
  final String? optOutReason;

  const ManifestPassenger({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    this.department = '',
    this.phone = '',
    this.seatNumber = '',
    this.photoUrl = '',
    this.boardingStatus = 'waiting',
    this.boardedAt,
    this.verifiedBy,
    this.optOutReason,
  });

  bool get isBoarded => boardingStatus == 'boarded';
  bool get isWaiting => boardingStatus == 'waiting';
  bool get isOptedOut => boardingStatus == 'opted_out';

  String localizedName(bool isArabic) => isArabic ? nameAr : nameEn;

  factory ManifestPassenger.fromJson(Map<String, dynamic> json) {
    return ManifestPassenger(
      id: json['id'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      department: json['department'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      seatNumber: json['seatNumber'] as String? ?? '',
      photoUrl: json['photoUrl'] as String? ?? '',
      boardingStatus: json['boardingStatus'] as String? ?? 'waiting',
      boardedAt: json['boardedAt'] as String?,
      verifiedBy: json['verifiedBy'] as String?,
      optOutReason: json['optOutReason'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'nameAr': nameAr,
    'nameEn': nameEn,
    'department': department,
    'phone': phone,
    'seatNumber': seatNumber,
    'photoUrl': photoUrl,
    'boardingStatus': boardingStatus,
    'boardedAt': boardedAt,
    'verifiedBy': verifiedBy,
    'optOutReason': optOutReason,
  };
}

class ManifestStop {
  final String id;
  final String nameAr;
  final String nameEn;
  final String scheduledTime;
  final int order;
  final bool isNext;
  final bool isPassed;
  final int boardedCount;
  final int waitingCount;
  final int optedOutCount;
  final List<ManifestPassenger> passengers;

  const ManifestStop({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.scheduledTime,
    required this.order,
    this.isNext = false,
    this.isPassed = false,
    this.boardedCount = 0,
    this.waitingCount = 0,
    this.optedOutCount = 0,
    this.passengers = const [],
  });

  String localizedName(bool isArabic) => isArabic ? nameAr : nameEn;

  factory ManifestStop.fromJson(Map<String, dynamic> json) {
    final rawPassengers = json['passengers'] as List<dynamic>? ?? [];
    return ManifestStop(
      id: json['id'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      scheduledTime: json['scheduledTime'] as String? ?? '',
      order: (json['order'] as num?)?.toInt() ?? 0,
      isNext: json['isNext'] as bool? ?? false,
      isPassed: json['isPassed'] as bool? ?? false,
      boardedCount: (json['boardedCount'] as num?)?.toInt() ?? 0,
      waitingCount: (json['waitingCount'] as num?)?.toInt() ?? 0,
      optedOutCount: (json['optedOutCount'] as num?)?.toInt() ?? 0,
      passengers: rawPassengers.map((p) => ManifestPassenger.fromJson(p as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'nameAr': nameAr,
    'nameEn': nameEn,
    'scheduledTime': scheduledTime,
    'order': order,
    'isNext': isNext,
    'isPassed': isPassed,
    'boardedCount': boardedCount,
    'waitingCount': waitingCount,
    'optedOutCount': optedOutCount,
    'passengers': passengers.map((p) => p.toJson()).toList(),
  };
}

class ManifestHeadcounts {
  final int totalAssigned;
  final int boarded;
  final int waiting;
  final int optedOut;
  final int occupancyRate;
  final bool allAccountedFor;

  const ManifestHeadcounts({
    this.totalAssigned = 0,
    this.boarded = 0,
    this.waiting = 0,
    this.optedOut = 0,
    this.occupancyRate = 0,
    this.allAccountedFor = false,
  });

  factory ManifestHeadcounts.fromJson(Map<String, dynamic> json) {
    return ManifestHeadcounts(
      totalAssigned: (json['totalAssigned'] as num?)?.toInt() ?? 0,
      boarded: (json['boarded'] as num?)?.toInt() ?? 0,
      waiting: (json['waiting'] as num?)?.toInt() ?? 0,
      optedOut: (json['optedOut'] as num?)?.toInt() ?? 0,
      occupancyRate: (json['occupancyRate'] as num?)?.toInt() ?? 0,
      allAccountedFor: json['allAccountedFor'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'totalAssigned': totalAssigned,
    'boarded': boarded,
    'waiting': waiting,
    'optedOut': optedOut,
    'occupancyRate': occupancyRate,
    'allAccountedFor': allAccountedFor,
  };
}

class RouteManifestData {
  final BusRoute? route;
  final ManifestHeadcounts headcounts;
  final List<ManifestStop> stops;

  const RouteManifestData({
    this.route,
    this.headcounts = const ManifestHeadcounts(),
    this.stops = const [],
  });

  factory RouteManifestData.fromJson(Map<String, dynamic> json) {
    final rawStops = json['stops'] as List<dynamic>? ?? [];
    return RouteManifestData(
      route: json['route'] != null ? BusRoute.fromJson(json['route'] as Map<String, dynamic>) : null,
      headcounts: json['headcounts'] != null
          ? ManifestHeadcounts.fromJson(json['headcounts'] as Map<String, dynamic>)
          : const ManifestHeadcounts(),
      stops: rawStops.map((s) => ManifestStop.fromJson(s as Map<String, dynamic>)).toList(),
    );
  }
}

