import 'package:intl/intl.dart';

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
  });

  factory Bulletin.fromJson(Map<String, dynamic> json) {
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

    List<AttachmentItem> _parseAttachments(dynamic value) {
      if (value is List) {
        return value
            .where((element) => element is Map)
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
      roles: _coerceStringList(json['roles']),
      ministries: _coerceStringList(json['ministries']),
      attachments: _parseAttachments(json['attachments']),
      ruHeadline: json['ru_headline']?.toString(),
      ruBody: json['ru_body']?.toString(),
      createdAt: parseDate(createdAtRaw?.toString()),
      updatedAt: parseDate(updatedAtRaw?.toString()),
    );
  }

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
    };
  }

  /// Format the publish date as "Week of MMM DD, YYYY"
  String get formattedWeek {
    final formatter = DateFormat('MMM dd, yyyy');
    return 'Week of ${formatter.format(publishDate)}';
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
    );
  }
}

/// Filter options for querying bulletins
class BulletinFilter {
  final int skip;
  final int limit;
  final String? ministry;
  final bool? published;
  final DateTime? weekStart;
  final DateTime? weekEnd;

  const BulletinFilter({
    this.skip = 0,
    this.limit = 100,
    this.ministry,
    this.published,
    this.weekStart,
    this.weekEnd,
  });

  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{'skip': skip, 'limit': limit};

    if (ministry != null && ministry!.isNotEmpty) {
      params['ministry'] = ministry;
    }
    if (published != null) {
      params['published'] = published;
    }
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

    return params;
  }

  BulletinFilter copyWith({
    int? skip,
    int? limit,
    String? ministry,
    bool? published,
    DateTime? weekStart,
    DateTime? weekEnd,
  }) {
    return BulletinFilter(
      skip: skip ?? this.skip,
      limit: limit ?? this.limit,
      ministry: ministry ?? this.ministry,
      published: published ?? this.published,
      weekStart: weekStart ?? this.weekStart,
      weekEnd: weekEnd ?? this.weekEnd,
    );
  }
}
