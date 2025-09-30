import 'sermon.dart';

class SermonFavorite {
  final String id;
  final String sermonId;
  final String? reason;
  final String? key;
  final Map<String, dynamic>? meta;
  final DateTime addedOn;
  final Sermon? sermon;

  const SermonFavorite({
    required this.id,
    required this.sermonId,
    this.reason,
    this.key,
    this.meta,
    required this.addedOn,
    this.sermon,
  });

  bool get hasExpandedSermon => sermon != null;

  factory SermonFavorite.fromJson(Map<String, dynamic> json) {
    Sermon? parseSermon(dynamic value) {
      if (value is Map<String, dynamic>) {
        return Sermon.fromJson(value);
      }
      return null;
    }

    Map<String, dynamic>? parseMeta(dynamic value) {
      if (value is Map<String, dynamic>) return value;
      return null;
    }

    return SermonFavorite(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      sermonId:
          json['sermon_id']?.toString() ?? json['sermonId']?.toString() ?? '',
      reason: json['reason']?.toString(),
      key: json['key']?.toString(),
      meta: parseMeta(json['meta']),
      addedOn:
          DateTime.tryParse(json['addedOn']?.toString() ?? '') ??
          DateTime.now(),
      sermon: parseSermon(json['sermon']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sermon_id': sermonId,
      if (reason != null) 'reason': reason,
      if (key != null) 'key': key,
      if (meta != null) 'meta': meta,
      'addedOn': addedOn.toIso8601String(),
      if (sermon != null) 'sermon': sermon!.toJson(),
    };
  }

  SermonFavorite copyWith({Sermon? sermon}) {
    return SermonFavorite(
      id: id,
      sermonId: sermonId,
      reason: reason,
      key: key,
      meta: meta,
      addedOn: addedOn,
      sermon: sermon ?? this.sermon,
    );
  }
}

class SermonFavoritesResponse {
  final bool success;
  final List<SermonFavorite> favorites;

  const SermonFavoritesResponse({
    required this.success,
    required this.favorites,
  });

  factory SermonFavoritesResponse.fromJson(Map<String, dynamic> json) {
    List<dynamic>? rawFavorites;
    if (json['favorites'] is List) {
      rawFavorites = json['favorites'] as List;
    } else if (json['items'] is List) {
      rawFavorites = json['items'] as List;
    }

    return SermonFavoritesResponse(
      success: json['success'] == true,
      favorites:
          rawFavorites != null
              ? rawFavorites
                  .map(
                    (item) => SermonFavorite.fromJson(
                      Map<String, dynamic>.from(item as Map),
                    ),
                  )
                  .toList()
              : <SermonFavorite>[],
    );
  }
}
