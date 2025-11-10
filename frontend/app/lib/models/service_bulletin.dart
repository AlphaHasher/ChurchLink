import 'package:intl/intl.dart';

/// Domain model representing a service bulletin document from the backend.
/// Service bulletins describe church services with timeline notes in markdown.
class ServiceBulletin {
  final String id;
  final String title;
  final String
  dayOfWeek; // Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
  final String timeOfDay; // HH:MM format (24-hour time)
  final String? description;
  final String? timelineNotes; // Markdown-formatted service timeline
  final DateTime displayWeek; // Weekly anchor, normalized to Monday 00:00
  final int order; // Display order within the week
  final bool published;
  final String visibilityMode; // 'always' or 'specific_weeks'
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const ServiceBulletin({
    required this.id,
    required this.title,
    required this.dayOfWeek,
    required this.timeOfDay,
    this.description,
    this.timelineNotes,
    required this.displayWeek,
    required this.order,
    required this.published,
    this.visibilityMode = 'specific_weeks',
    this.createdAt,
    this.updatedAt,
  });

  /// Parse a service bulletin from backend JSON response
  factory ServiceBulletin.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(String? value) {
      if (value == null || value.isEmpty) return null;
      return DateTime.tryParse(value);
    }

    final dayOfWeekRaw = json['day_of_week'] ?? json['dayOfWeek'];
    final timeOfDayRaw = json['time_of_day'] ?? json['timeOfDay'];
    final displayWeekRaw = json['display_week'] ?? json['displayWeek'];
    final timelineNotesRaw = json['timeline_notes'] ?? json['timelineNotes'];
    final visibilityModeRaw = json['visibility_mode'] ?? json['visibilityMode'];
    final createdAtRaw = json['created_at'] ?? json['createdAt'];
    final updatedAtRaw = json['updated_at'] ?? json['updatedAt'];

    return ServiceBulletin(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      dayOfWeek: dayOfWeekRaw?.toString() ?? 'Sunday',
      timeOfDay: timeOfDayRaw?.toString() ?? '10:00',
      description: json['description']?.toString(),
      timelineNotes: timelineNotesRaw?.toString(),
      displayWeek: parseDate(displayWeekRaw) ?? DateTime.now(),
      order: json['order'] as int? ?? 0,
      published: json['published'] as bool? ?? false,
      visibilityMode: visibilityModeRaw?.toString() ?? 'specific_weeks',
      createdAt: parseDate(createdAtRaw),
      updatedAt: parseDate(updatedAtRaw),
    );
  }

  /// Convert service bulletin to JSON for API requests
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'day_of_week': dayOfWeek,
      'time_of_day': timeOfDay,
      if (description != null) 'description': description,
      if (timelineNotes != null) 'timeline_notes': timelineNotes,
      'display_week': displayWeek.toIso8601String(),
      'order': order,
      'published': published,
      'visibility_mode': visibilityMode,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }

  /// Format service time for display (e.g., "Sunday at 10:00 AM")
  String get formattedServiceTime {
    // Convert 24-hour time to 12-hour format with AM/PM
    final parts = timeOfDay.split(':');
    final hours = int.tryParse(parts[0]) ?? 10;
    final minutes = parts.length > 1 ? parts[1] : '00';
    final period = hours >= 12 ? 'PM' : 'AM';
    final displayHours = hours % 12 == 0 ? 12 : hours % 12;
    return '$dayOfWeek at $displayHours:$minutes $period';
  }

  /// Format display week for UI (e.g., "Oct 6, 2025")
  /// NOTE: This is now handled server-side via the current_week endpoint
  /// to ensure synchronization. This getter is kept for backward compatibility
  /// but should not be used for displaying "For the week of" labels.
  /// @deprecated Use ServerWeekInfo.weekLabel instead
  String get formattedWeek {
    // Simply return the display week as provided by server
    // The server handles the transformation for 'always' visibility mode
    return DateFormat('MMM d, y').format(displayWeek);
  }

  /// Check if service is upcoming (deprecated - services are now recurring weekly)
  bool get isUpcoming {
    // Services no longer have specific dates, they recur weekly
    // This getter is kept for backward compatibility but always returns true
    return true;
  }

  /// Create a copy with updated fields
  ServiceBulletin copyWith({
    String? id,
    String? title,
    String? dayOfWeek,
    String? timeOfDay,
    String? description,
    String? timelineNotes,
    DateTime? displayWeek,
    int? order,
    bool? published,
    String? visibilityMode,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return ServiceBulletin(
      id: id ?? this.id,
      title: title ?? this.title,
      dayOfWeek: dayOfWeek ?? this.dayOfWeek,
      timeOfDay: timeOfDay ?? this.timeOfDay,
      description: description ?? this.description,
      timelineNotes: timelineNotes ?? this.timelineNotes,
      displayWeek: displayWeek ?? this.displayWeek,
      order: order ?? this.order,
      published: published ?? this.published,
      visibilityMode: visibilityMode ?? this.visibilityMode,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() {
    return 'ServiceBulletin(id: $id, title: $title, dayOfWeek: $dayOfWeek, timeOfDay: $timeOfDay, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ServiceBulletin && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

/// Filter parameters for querying service bulletins
class ServiceFilter {
  final int skip;
  final int limit;
  final DateTime? weekStart;
  final DateTime? weekEnd;
  final bool? published;
  final bool upcomingOnly;

  const ServiceFilter({
    this.skip = 0,
    this.limit = 50,
    this.weekStart,
    this.weekEnd,
    this.published,
    this.upcomingOnly = false,
  });

  /// Convert filter to query parameters for API requests
  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{
      'skip': skip.toString(),
      'limit': limit.toString(),
    };

    if (weekStart != null) {
      params['week_start'] = weekStart!.toIso8601String().split('T').first;
    }
    if (weekEnd != null) {
      params['week_end'] = weekEnd!.toIso8601String().split('T').first;
    }
    if (published != null) {
      params['published'] = published.toString();
    }
    if (upcomingOnly) {
      params['upcoming_only'] = 'true';
    }

    return params;
  }

  ServiceFilter copyWith({
    int? skip,
    int? limit,
    DateTime? weekStart,
    DateTime? weekEnd,
    bool? published,
    bool? upcomingOnly,
  }) {
    return ServiceFilter(
      skip: skip ?? this.skip,
      limit: limit ?? this.limit,
      weekStart: weekStart ?? this.weekStart,
      weekEnd: weekEnd ?? this.weekEnd,
      published: published ?? this.published,
      upcomingOnly: upcomingOnly ?? this.upcomingOnly,
    );
  }
}
