import 'package:intl/intl.dart';

/// Domain model representing a sermon document returned by the backend.
class Sermon {
  final String id;
  final String title;
  final String? ruTitle;
  final String description;
  final String? ruDescription;
  final String speaker;
  final String? ruSpeaker;
  final List<String> ministry;
  final String youtubeUrl;
  final String? videoId;
  final DateTime datePosted;
  final bool published;
  final List<String> roles;
  final bool isFavorited;
  final String? thumbnailUrl;
  final List<String> tags;
  final int? durationSeconds;
  final String? summary;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Sermon({
    required this.id,
    required this.title,
    this.ruTitle,
    required this.description,
    this.ruDescription,
    required this.speaker,
    this.ruSpeaker,
    required this.ministry,
    required this.youtubeUrl,
    this.videoId,
    required this.datePosted,
    required this.published,
    required this.roles,
    required this.isFavorited,
    this.thumbnailUrl,
    required this.tags,
    this.durationSeconds,
    this.summary,
    this.createdAt,
    this.updatedAt,
  });

  factory Sermon.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(String? value) {
      if (value == null || value.isEmpty) return null;
      return DateTime.tryParse(value);
    }

    List<String> _coerceStringList(dynamic value) {
      if (value is List) {
        return value
            .map((element) => element.toString())
            .where((element) => element.isNotEmpty)
            .toList();
      }
      if (value is String && value.isNotEmpty) {
        return value.split(',').map((item) => item.trim()).toList();
      }
      return <String>[];
    }

    final datePostedRaw = json['date_posted'] ?? json['datePosted'];
    final createdAtRaw = json['created_at'] ?? json['createdAt'];
    final updatedAtRaw = json['updated_at'] ?? json['updatedAt'];

    return Sermon(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      ruTitle: json['ru_title']?.toString(),
      description: json['description']?.toString() ?? '',
      ruDescription: json['ru_description']?.toString(),
      speaker: json['speaker']?.toString() ?? '',
      ruSpeaker: json['ru_speaker']?.toString(),
      ministry: _coerceStringList(json['ministry']),
      youtubeUrl: json['youtube_url']?.toString() ?? '',
      videoId: json['video_id']?.toString(),
      datePosted: parseDate(datePostedRaw?.toString()) ?? DateTime.now(),
      published: json['published'] == true,
      roles: _coerceStringList(json['roles']),
      isFavorited: json['is_favorited'] == true,
      thumbnailUrl: json['thumbnail_url']?.toString(),
      tags: _coerceStringList(json['tags']),
      durationSeconds: (json['duration_seconds'] as num?)?.toInt(),
      summary: json['summary']?.toString(),
      createdAt: parseDate(createdAtRaw?.toString()),
      updatedAt: parseDate(updatedAtRaw?.toString()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      if (ruTitle != null) 'ru_title': ruTitle,
      'description': description,
      if (ruDescription != null) 'ru_description': ruDescription,
      'speaker': speaker,
      if (ruSpeaker != null) 'ru_speaker': ruSpeaker,
      'ministry': ministry,
      'youtube_url': youtubeUrl,
      if (videoId != null) 'video_id': videoId,
      'date_posted': datePosted.toIso8601String(),
      'published': published,
      'roles': roles,
      'is_favorited': isFavorited,
      if (thumbnailUrl != null) 'thumbnail_url': thumbnailUrl,
      if (tags.isNotEmpty) 'tags': tags,
      if (durationSeconds != null) 'duration_seconds': durationSeconds,
      if (summary != null) 'summary': summary,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  bool get hasThumbnail => thumbnailUrl != null && thumbnailUrl!.isNotEmpty;

  static String? _extractYoutubeId(String? url) {
    if (url == null) return null;

    final trimmed = url.trim();
    if (trimmed.isEmpty) return null;

    const pattern = r'^[A-Za-z0-9_-]{11}$';
    final regex = RegExp(pattern);

    String? tryCandidate(String? candidate) {
      final value = candidate?.trim();
      if (value != null && value.isNotEmpty && regex.hasMatch(value)) {
        return value;
      }
      return null;
    }

    try {
      final uri = Uri.parse(trimmed);
      final host = uri.host.toLowerCase();

      if (host.contains('youtu.be')) {
        if (uri.pathSegments.isNotEmpty) {
          final candidate = uri.pathSegments.last;
          final result = tryCandidate(candidate);
          if (result != null) {
            return result;
          }
        }
      }

      if (host.contains('youtube.com')) {
        final vParam = uri.queryParameters['v'];
        final vCandidate = tryCandidate(vParam);
        if (vCandidate != null) {
          return vCandidate;
        }

        final segments = uri.pathSegments;
        final embedIndex = segments.indexOf('embed');
        if (embedIndex != -1 && embedIndex + 1 < segments.length) {
          final embedCandidate = tryCandidate(segments[embedIndex + 1]);
          if (embedCandidate != null) {
            return embedCandidate;
          }
        }

        if (segments.isNotEmpty) {
          final lastSegmentCandidate = tryCandidate(segments.last);
          if (lastSegmentCandidate != null) {
            return lastSegmentCandidate;
          }
        }
      }
    } catch (_) {
      // fall through to heuristic parsing below
    }

    final equalsIndex = trimmed.lastIndexOf('=');
    if (equalsIndex != -1 && equalsIndex + 1 < trimmed.length) {
      final heuristicCandidate = tryCandidate(
        trimmed.substring(equalsIndex + 1),
      );
      if (heuristicCandidate != null) {
        return heuristicCandidate;
      }
    }

    return tryCandidate(trimmed);
  }

  String? get resolvedThumbnailUrl {
    if (hasThumbnail) {
      return thumbnailUrl;
    }

    final videoId = _extractYoutubeId(youtubeUrl);
    if (videoId == null) {
      return null;
    }

    return 'https://i.ytimg.com/vi/$videoId/hqdefault.jpg';
  }

  Duration? get duration =>
      durationSeconds != null ? Duration(seconds: durationSeconds!) : null;

  String get formattedDate => DateFormat('MMM dd, yyyy').format(datePosted);

  String get formattedDateTime =>
      DateFormat('MMM dd, yyyy • hh:mm a').format(datePosted);

  String getDisplayTitle({bool useRussian = false}) {
    if (useRussian && ruTitle != null && ruTitle!.isNotEmpty) {
      return ruTitle!;
    }
    return title;
  }

  String getDisplayDescription({bool useRussian = false}) {
    if (useRussian && ruDescription != null && ruDescription!.isNotEmpty) {
      return ruDescription!;
    }
    return description;
  }

  String getDisplaySpeaker({bool useRussian = false}) {
    if (useRussian && ruSpeaker != null && ruSpeaker!.isNotEmpty) {
      return ruSpeaker!;
    }
    return speaker;
  }

  Sermon copyWith({bool? isFavorited}) {
    return Sermon(
      id: id,
      title: title,
      ruTitle: ruTitle,
      description: description,
      ruDescription: ruDescription,
      speaker: speaker,
      ruSpeaker: ruSpeaker,
      ministry: ministry,
      youtubeUrl: youtubeUrl,
      videoId: videoId,
      datePosted: datePosted,
      published: published,
      roles: roles,
      isFavorited: isFavorited ?? this.isFavorited,
      thumbnailUrl: thumbnailUrl,
      tags: tags,
      durationSeconds: durationSeconds,
      summary: summary,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
