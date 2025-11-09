import 'package:intl/intl.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Represents an attachment item in a bulletin
class AttachmentItem {
  final String title;
  final String url;

  const AttachmentItem({required this.title, required this.url});

  factory AttachmentItem.fromJson(Map<String, dynamic> json) {
    return AttachmentItem(
      title: json['title']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {'title': title, 'url': url};
  }
}

/// Domain model representing a bulletin document returned by the backend.
class Bulletin {
  final String id;
  final String headline;
  final String body;
  final DateTime publishDate;
  final DateTime? expireAt;
  final bool published;
  final bool pinned;
  final List<String> roles;
  final List<String> ministries;
  final List<AttachmentItem> attachments;
  final String? ruHeadline;
  final String? ruBody;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  
  // Media library integration - EXACTLY like dashboard
  final String? imageId;
  final String? imageUrl;
  final String? thumbnailUrl;

  const Bulletin({
    required this.id,
    required this.headline,
    required this.body,
    required this.publishDate,
    this.expireAt,
    required this.published,
    required this.pinned,
    required this.roles,
    required this.ministries,
    required this.attachments,
    this.ruHeadline,
    this.ruBody,
    this.createdAt,
    this.updatedAt,
    this.imageId,
    this.imageUrl,
    this.thumbnailUrl,
  });

  factory Bulletin.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(String? value) {
      if (value == null || value.isEmpty) return null;
      return DateTime.tryParse(value);
    }

    List<String> coerceStringList(dynamic value) {
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

    List<AttachmentItem> parseAttachments(dynamic value) {
      if (value is List) {
        return value
            .whereType<Map>()
            .map(
              (element) =>
                  AttachmentItem.fromJson(element as Map<String, dynamic>),
            )
            .toList();
      }
      return <AttachmentItem>[];
    }

    final publishDateRaw = json['publish_date'] ?? json['publishDate'];
    final expireAtRaw = json['expire_at'] ?? json['expireAt'];
    final createdAtRaw = json['created_at'] ?? json['createdAt'];
    final updatedAtRaw = json['updated_at'] ?? json['updatedAt'];

    return Bulletin(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      headline: json['headline']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      publishDate: parseDate(publishDateRaw?.toString()) ?? DateTime.now(),
      expireAt: parseDate(expireAtRaw?.toString()),
      published: json['published'] == true,
      pinned: json['pinned'] == true,
      roles: coerceStringList(json['roles']),
      ministries: coerceStringList(json['ministries']),
      attachments: parseAttachments(json['attachments']),
      ruHeadline: json['ru_headline']?.toString(),
      ruBody: json['ru_body']?.toString(),
      createdAt: parseDate(createdAtRaw?.toString()),
      updatedAt: parseDate(updatedAtRaw?.toString()),
      imageId: json['image_id']?.toString(),
      imageUrl: json['image_url']?.toString(),
      thumbnailUrl: json['thumbnail_url']?.toString(),
    );
  }
  
  /// Build image URL from imageId - EXACT pattern from dashboard
  String _buildImageUrl(String id, {bool thumbnail = true}) {
    String base = dotenv.get('BACKEND_URL');
    if (!base.endsWith('/')) base = '$base/';
    
    final prefix = 'api/v1';
    final path = 'assets/public/id/${Uri.encodeComponent(id)}';
    final query = thumbnail ? '?thumbnail=1' : '';
    
    return '$base$prefix/$path$query';
  }
  
  /// Get resolved thumbnail URL - uses imageId with dashboard pattern
  String? get resolvedThumbnailUrl {
    if (imageId != null && imageId!.isNotEmpty) {
      return _buildImageUrl(imageId!, thumbnail: true);
    }
    return null;
  }
  
  /// Get resolved image URL - uses imageId with dashboard pattern
  String? get resolvedImageUrl {
    if (imageId != null && imageId!.isNotEmpty) {
      return _buildImageUrl(imageId!, thumbnail: false);
    }
    return null;
  }

  /// Ordered list of candidate image URLs to attempt when rendering media
  List<String> get imageSources {
    final seen = <String>{};
    final candidates = <String?>[
      thumbnailUrl,
      imageUrl,
      resolvedThumbnailUrl,
      resolvedImageUrl,
    ];

    final urls = <String>[];
    for (final candidate in candidates) {
      final value = candidate?.trim();
      if (value != null && value.isNotEmpty && seen.add(value)) {
        urls.add(value);
      }
    }
    return urls;
  }

  /// Whether the bulletin has at least one media source available
  bool get hasImage => imageSources.isNotEmpty;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'headline': headline,
      'body': body,
      'publish_date': publishDate.toIso8601String(),
      if (expireAt != null) 'expire_at': expireAt!.toIso8601String(),
      'published': published,
      'pinned': pinned,
      'roles': roles,
      'ministries': ministries,
      'attachments': attachments.map((a) => a.toJson()).toList(),
      if (ruHeadline != null) 'ru_headline': ruHeadline,
      if (ruBody != null) 'ru_body': ruBody,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
      if (imageId != null) 'image_id': imageId,
      if (imageUrl != null) 'image_url': imageUrl,
      if (thumbnailUrl != null) 'thumbnail_url': thumbnailUrl,
    };
  }

  /// Format the publish date as "MMM DD, YYYY"
  String get formattedWeek {
    final formatter = DateFormat('MMM dd, yyyy');
    return formatter.format(publishDate);
  }

  /// Check if the bulletin has expired
  bool get isExpired {
    if (expireAt == null) return false;
    return DateTime.now().isAfter(expireAt!);
  }

  /// Check if the bulletin is upcoming (publish date in the future)
  bool get isUpcoming {
    return publishDate.isAfter(DateTime.now());
  }

  /// Copy with method for creating modified instances
  Bulletin copyWith({
    String? id,
    String? headline,
    String? body,
    DateTime? publishDate,
    DateTime? expireAt,
    bool? published,
    bool? pinned,
    List<String>? roles,
    List<String>? ministries,
    List<AttachmentItem>? attachments,
    String? ruHeadline,
    String? ruBody,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? imageId,
    String? imageUrl,
    String? thumbnailUrl,
  }) {
    return Bulletin(
      id: id ?? this.id,
      headline: headline ?? this.headline,
      body: body ?? this.body,
      publishDate: publishDate ?? this.publishDate,
      expireAt: expireAt ?? this.expireAt,
      published: published ?? this.published,
      pinned: pinned ?? this.pinned,
      roles: roles ?? this.roles,
      ministries: ministries ?? this.ministries,
      attachments: attachments ?? this.attachments,
      ruHeadline: ruHeadline ?? this.ruHeadline,
      ruBody: ruBody ?? this.ruBody,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      imageId: imageId ?? this.imageId,
      imageUrl: imageUrl ?? this.imageUrl,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
    );
  }
}

/// Filter options for querying bulletins
class BulletinFilter {
  final int skip;
  final int limit;
  final String? ministry;
  final String? query; // Search query for bulletin headlines
  final bool? published;
  final DateTime? weekStart; // Used for services filtering only
  final DateTime? weekEnd; // Used for services filtering only
  final bool upcomingOnly; // Used for bulletins: show if publish_date <= now

  const BulletinFilter({
    this.skip = 0,
    this.limit = 100,
    this.ministry,
    this.query,
    this.published,
    this.weekStart,
    this.weekEnd,
    this.upcomingOnly = false,
  });

  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{'skip': skip, 'limit': limit};

    if (ministry != null && ministry!.isNotEmpty) {
      params['ministry'] = ministry;
    }
    if (query != null && query!.isNotEmpty) {
      params['query'] = query;
    }
    if (published != null) {
      params['published'] = published;
    }
    // week_start and week_end are used for services filtering only
    if (weekStart != null) {
      // Format as YYYY-MM-DD to match backend expectations
      params['week_start'] =
          '${weekStart!.year}-${weekStart!.month.toString().padLeft(2, '0')}-${weekStart!.day.toString().padLeft(2, '0')}';
    }
    if (weekEnd != null) {
      // Format as YYYY-MM-DD to match backend expectations
      params['week_end'] =
          '${weekEnd!.year}-${weekEnd!.month.toString().padLeft(2, '0')}-${weekEnd!.day.toString().padLeft(2, '0')}';
    }
    if (upcomingOnly) {
      params['upcoming_only'] = 'true';
    }

    return params;
  }

  BulletinFilter copyWith({
    int? skip,
    int? limit,
    String? ministry,
    String? query,
    bool? published,
    DateTime? weekStart,
    DateTime? weekEnd,
    bool? upcomingOnly,
  }) {
    return BulletinFilter(
      skip: skip ?? this.skip,
      limit: limit ?? this.limit,
      ministry: ministry ?? this.ministry,
      query: query ?? this.query,
      published: published ?? this.published,
      weekStart: weekStart ?? this.weekStart,
      weekEnd: weekEnd ?? this.weekEnd,
      upcomingOnly: upcomingOnly ?? this.upcomingOnly,
    );
  }
}
