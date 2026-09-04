import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';

class ServerAnnouncement {
  final String title;
  final String body;
  final bool important;
  final String? imageUrl;
  final DateTime createdAt;

  const ServerAnnouncement({
    required this.title,
    required this.body,
    required this.important,
    required this.createdAt,
    this.imageUrl,
  });
}

class ServerNews {
  final String id;
  final String title;
  final String body;
  final String? imageUrl;
  final DateTime createdAt;

  const ServerNews({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    this.imageUrl,
  });

  String get timeAgo {
    final diff = DateTime.now().difference(createdAt);
    if (diff.inMinutes < 60) return '${diff.inMinutes.clamp(1, 59)}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

/// Dynamic today shift data model fetched from the database / roster.
class ServerTodayShift {
  final String shiftKey;
  final String shiftName;
  final String shiftNameAr;
  final String time;
  final String timeAr;
  final String line;
  final String lineAr;
  final bool offDuty;

  const ServerTodayShift({
    required this.shiftKey,
    required this.shiftName,
    required this.shiftNameAr,
    required this.time,
    required this.timeAr,
    required this.line,
    required this.lineAr,
    required this.offDuty,
  });

  factory ServerTodayShift.fromJson(Map<String, dynamic> json) =>
      ServerTodayShift(
        shiftKey: json['shiftKey'] as String? ?? 'morning',
        shiftName: json['shiftName'] as String? ?? 'Morning Shift',
        shiftNameAr: json['shiftNameAr'] as String? ?? 'الوردية الأولى (صباحية)',
        time: json['time'] as String? ?? json['timeEn'] as String? ?? '07:00 AM – 03:00 PM',
        timeAr: json['timeAr'] as String? ?? '07:00 ص – 03:00 م',
        line: json['line'] as String? ?? 'Elaraby Group • Public Relations',
        lineAr: json['lineAr'] as String? ?? 'مجموعة العربي • العلاقات العامة',
        offDuty: json['offDuty'] as bool? ?? false,
      );
}

/// Announcement + news + today shift pulled from the backend. Null/empty members mean the
/// server was unreachable — screens fall back to their bundled demo content.
class HomeContent extends ChangeNotifier {
  static final HomeContent instance = HomeContent._();
  HomeContent._();

  final ApiClient _api = ApiClient.instance;

  ServerAnnouncement? announcement;
  List<ServerNews> news = [];
  ServerTodayShift? todayShift;

  Future<void> load() async {
    final res = await _api.get('/home');
    final rawAnnouncement = res?['announcement'] as Map<String, dynamic>?;
    final rawNews = res?['news'] as List<dynamic>?;
    final rawTodayShift = res?['todayShift'] as Map<String, dynamic>?;
    if (rawAnnouncement == null && rawNews == null && rawTodayShift == null) return;

    if (rawAnnouncement != null) {
      announcement = ServerAnnouncement(
        title: rawAnnouncement['title'] as String? ?? '',
        body: rawAnnouncement['body'] as String? ?? '',
        important: rawAnnouncement['important'] as bool? ?? false,
        imageUrl: rawAnnouncement['imageUrl'] as String?,
        createdAt: DateTime.fromMillisecondsSinceEpoch(
            rawAnnouncement['createdAt'] as int? ?? 0),
      );
    }
    if (rawNews != null) {
      news = rawNews
          .map((e) {
            final m = e as Map<String, dynamic>;
            return ServerNews(
              id: m['id'] as String,
              title: m['title'] as String? ?? '',
              body: m['body'] as String? ?? '',
              imageUrl: m['imageUrl'] as String?,
              createdAt:
                  DateTime.fromMillisecondsSinceEpoch(m['createdAt'] as int? ?? 0),
            );
          })
          .toList();
    }
    if (rawTodayShift != null) {
      todayShift = ServerTodayShift.fromJson(rawTodayShift);
    }
    notifyListeners();
  }
}
