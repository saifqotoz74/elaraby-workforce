import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';

class ServerBenefit {
  final String id;
  final String title;
  final String discount;
  final String category;
  final String description;
  final String validThrough;
  final String? imageUrl;

  const ServerBenefit({
    required this.id,
    required this.title,
    required this.discount,
    required this.category,
    required this.description,
    required this.validThrough,
    this.imageUrl,
  });
}

class ServerTrip {
  final String id;
  final String title;
  final String destination;
  final String price;
  final String originalPrice;
  final String date;
  final String? imageUrl;
  final int totalSeats;
  final int bookedSeats;

  const ServerTrip({
    required this.id,
    required this.title,
    required this.destination,
    required this.price,
    required this.originalPrice,
    required this.date,
    required this.totalSeats,
    required this.bookedSeats,
    this.imageUrl,
  });
}

/// Benefits + trips from the backend. When `loaded` is false (offline or not
/// fetched yet) the benefits screen renders its bundled demo content.
class BenefitsContent extends ChangeNotifier {
  static final BenefitsContent instance = BenefitsContent._();
  BenefitsContent._();

  final ApiClient _api = ApiClient.instance;

  bool loaded = false;
  List<ServerBenefit> benefits = [];
  List<ServerTrip> trips = [];

  Future<void> load() async {
    final res = await _api.get('/benefits');
    final rawBenefits = res?['benefits'] as List<dynamic>?;
    final rawTrips = res?['trips'] as List<dynamic>?;
    if (rawBenefits == null) return;

    benefits = rawBenefits.map((e) {
      final m = e as Map<String, dynamic>;
      return ServerBenefit(
        id: m['id'] as String,
        title: m['title'] as String? ?? '',
        discount: m['discount'] as String? ?? '',
        category: m['category'] as String? ?? '',
        description: m['description'] as String? ?? '',
        validThrough: m['validThrough'] as String? ?? '',
        imageUrl: m['imageUrl'] as String?,
      );
    }).toList();

    trips = (rawTrips ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      return ServerTrip(
        id: m['id'] as String,
        title: m['title'] as String? ?? '',
        destination: m['destination'] as String? ?? '',
        price: m['price'] as String? ?? '',
        originalPrice: m['originalPrice'] as String? ?? '',
        date: m['date'] as String? ?? '',
        totalSeats: m['totalSeats'] as int? ?? 0,
        bookedSeats: m['bookedSeats'] as int? ?? 0,
        imageUrl: m['imageUrl'] as String?,
      );
    }).toList();

    loaded = true;
    notifyListeners();
  }

  Future<void> bookTrip(String tripId, bool book) async {
    final path = book ? '/trips/$tripId/book' : '/trips/$tripId/unbook';
    final res = await _api.post(path, {});
    if (res?['ok'] == true) {
      final tripJson = res?['trip'] as Map<String, dynamic>?;
      if (tripJson != null) {
        final booked = tripJson['bookedSeats'] as int?;
        trips = trips
            .map((t) => t.id == tripId && booked != null
                ? ServerTrip(
                    id: t.id,
                    title: t.title,
                    destination: t.destination,
                    price: t.price,
                    originalPrice: t.originalPrice,
                    date: t.date,
                    totalSeats: t.totalSeats,
                    bookedSeats: booked,
                    imageUrl: t.imageUrl,
                  )
                : t)
            .toList();
        notifyListeners();
      }
    }
  }
}
