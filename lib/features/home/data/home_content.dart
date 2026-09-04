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

/// Announcement + news pulled from the backend. Null/empty members mean the
/// server was unreachable — screens fall back to their bundled demo content.
class HomeContent extends ChangeNotifier {
  static final HomeContent instance = HomeContent._();
  HomeContent._();

  final ApiClient _api = ApiClient.instance;

  ServerAnnouncement? announcement;
  List<ServerNews> news = [];

  Future<void> load() async {
    final res = await _api.get('/home');
    final rawAnnouncement = res?['announcement'] as Map<String, dynamic>?;
    final rawNews = res?['news'] as List<dynamic>?;
    if (rawAnnouncement == null && rawNews == null) return;

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
    notifyListeners();
  }
}
