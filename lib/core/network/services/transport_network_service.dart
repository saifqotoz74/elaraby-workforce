import '../../../features/services/data/transport_model.dart';
import '../api_client.dart';

/// Network operations dedicated to Corporate Transportation, Fleet Tracking, and Driver Consoles.
class TransportNetworkService {
  final ApiClient _api;

  TransportNetworkService(this._api);

  // ---------- Corporate Transportation & Fleet Tracking ----------
  Future<MyCommuteState?> fetchMyCommute() async {
    final res = await _api.get('/transport/my-commute');
    if (res == null) return null;
    return MyCommuteState.fromJson(res);
  }

  Future<List<BusRoute>?> fetchBusRoutes({String? factory, String? shift}) async {
    final params = <String>[];
    if (factory != null) params.add('factory=${Uri.encodeComponent(factory)}');
    if (shift != null) params.add('shift=${Uri.encodeComponent(shift)}');
    final query = params.isNotEmpty ? '?${params.join('&')}' : '';

    final res = await _api.get('/transport/routes$query');
    if (res?['routes'] == null) return null;
    return (res!['routes'] as List<dynamic>)
        .map((r) => BusRoute.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  Future<bool> selectPickupStop({
    required String routeId,
    required String stopId,
  }) async {
    final res = await _api.post('/transport/select-stop', {
      'routeId': routeId,
      'stopId': stopId,
    });
    return res != null && res['success'] == true;
  }

  Future<bool> requestRouteTransfer({
    required String targetRouteId,
    String? targetStopId,
    String? date,
    String? reason,
  }) async {
    final res = await _api.post('/transport/request-transfer', {
      'targetRouteId': targetRouteId,
      if (targetStopId != null) 'targetStopId': targetStopId,
      if (date != null) 'date': date,
      if (reason != null) 'reason': reason,
    });
    return res != null && res['ok'] == true;
  }

  Future<BoardingPassData?> fetchBoardingPass() async {
    final res = await _api.get('/transport/boarding-pass');
    if (res == null) return null;
    return BoardingPassData.fromJson(res);
  }

  Future<bool> reportRouteIncident({
    required String routeId,
    required String type,
    required String message,
    int delayMinutes = 15,
  }) async {
    final res = await _api.post('/transport/report-incident', {
      'routeId': routeId,
      'type': type,
      'message': message,
      'delayMinutes': delayMinutes,
    });
    return res != null && res['ok'] == true;
  }

  Future<List<RouteAlert>?> fetchRouteAlerts({String? routeId}) async {
    final query = routeId != null ? '?routeId=${Uri.encodeComponent(routeId)}' : '';
    final res = await _api.get('/transport/alerts$query');
    if (res?['alerts'] == null) return null;
    return (res!['alerts'] as List<dynamic>)
        .map((a) => RouteAlert.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  Future<bool> toggleCommuteOptOut({required bool optOut}) async {
    final res = await _api.post('/transport/opt-out', {
      'optOut': optOut,
    });
    return res != null && res['success'] == true;
  }

  // ---------- Driver & Supervisor Dedicated Tablet Console ----------
  Future<RouteManifestData?> fetchRouteManifest({required String routeId}) async {
    final res = await _api.get('/transport/driver/manifest?routeId=${Uri.encodeComponent(routeId)}');
    if (res == null || res['data'] == null) return null;
    return RouteManifestData.fromJson(res['data'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>?> manualBoardPassenger({
    required String employeeId,
    required String routeId,
  }) async {
    final res = await _api.post('/transport/driver/board-manual', {
      'employeeId': employeeId,
      'routeId': routeId,
    });
    return res;
  }

  Future<Map<String, dynamic>?> advanceStopDeparture({
    required String routeId,
    required String stopId,
  }) async {
    final res = await _api.post('/transport/driver/depart-stop', {
      'routeId': routeId,
      'stopId': stopId,
    });
    return res;
  }

  Future<Map<String, dynamic>?> completeRouteRun({
    required String routeId,
  }) async {
    final res = await _api.post('/transport/driver/complete-run', {
      'routeId': routeId,
    });
    return res;
  }
}
