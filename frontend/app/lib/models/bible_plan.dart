// Bible Plan Models for Flutter App

import 'dart:math' as math;

/// Represents a single Bible passage reading
class BiblePassage {
  final String id;
  final String book;
  final int chapter;
  final int? endChapter;
  final int? startVerse;
  final int? endVerse;
  final String reference;

  BiblePassage({
    required this.id,
    required this.book,
    required this.chapter,
    this.endChapter,
    this.startVerse,
    this.endVerse,
    required this.reference,
  });

  factory BiblePassage.fromJson(Map<String, dynamic> json) {
    return BiblePassage(
      id: json['id'] as String,
      book: json['book'] as String,
      chapter: json['chapter'] as int,
      endChapter: json['endChapter'] as int?,
      startVerse: json['startVerse'] as int?,
      endVerse: json['endVerse'] as int?,
      reference: json['reference'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'book': book,
      'chapter': chapter,
      'endChapter': endChapter,
      'startVerse': startVerse,
      'endVerse': endVerse,
      'reference': reference,
    };
  }
}

/// Represents a Bible reading plan
class BiblePlan {
  final String id;
  final String name;
  final int duration;
  final Map<String, List<BiblePassage>> readings;
  final String userId;
  final bool visible;
  final DateTime createdAt;
  final DateTime updatedAt;

  BiblePlan({
    required this.id,
    required this.name,
    required this.duration,
    required this.readings,
    required this.userId,
    required this.visible,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BiblePlan.fromJson(Map<String, dynamic> json) {
    // Parse readings manually since it's a complex nested structure
    Map<String, List<BiblePassage>> parsedReadings = {};
    if (json['readings'] != null) {
      (json['readings'] as Map<String, dynamic>).forEach((key, value) {
        if (value is List) {
          parsedReadings[key] = value
              .map((p) => BiblePassage.fromJson(p as Map<String, dynamic>))
              .toList();
        }
      });
    }

    return BiblePlan(
      id: json['id'] as String,
      name: json['name'] as String,
      duration: json['duration'] as int,
      readings: parsedReadings,
      userId: json['user_id'] as String,
      visible: json['visible'] as bool,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'duration': duration,
      'readings': readings.map((key, value) =>
          MapEntry(key, value.map((p) => p.toJson()).toList())),
      'user_id': userId,
      'visible': visible,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  /// Get readings for a specific day (1-indexed)
  List<BiblePassage> getReadingsForDay(int day) {
    return readings[day.toString()] ?? [];
  }

  bool isRestDay(int day) {
    return getReadingsForDay(day).isEmpty;
  }

  int get readingDaysCount {
    if (duration <= 0) {
      return 0;
    }

    var count = 0;
    for (var day = 1; day <= duration; day++) {
      if (!isRestDay(day)) {
        count += 1;
      }
    }
    return count;
  }
}

/// Tracks progress for a single day in a Bible plan
class DayProgress {
  final int day;
  final List<String> completedPassages;
  final bool isCompleted;

  DayProgress({
    required this.day,
    required this.completedPassages,
    required this.isCompleted,
  });

  factory DayProgress.fromJson(Map<String, dynamic> json) {
    return DayProgress(
      day: json['day'] as int,
      completedPassages: (json['completed_passages'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      isCompleted: json['is_completed'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'day': day,
      'completed_passages': completedPassages,
      'is_completed': isCompleted,
    };
  }

  /// Check if a specific passage is completed
  bool isPassageCompleted(String passageId) {
    return completedPassages.contains(passageId);
  }

  /// Create a copy with updated fields
  DayProgress copyWith({
    int? day,
    List<String>? completedPassages,
    bool? isCompleted,
  }) {
    return DayProgress(
      day: day ?? this.day,
      completedPassages: completedPassages ?? this.completedPassages,
      isCompleted: isCompleted ?? this.isCompleted,
    );
  }
}

/// User's subscription to a Bible plan
class UserBiblePlanSubscription {
  final String planId;
  final DateTime startDate;
  final String? notificationTime; // HH:MM format
  final bool notificationEnabled;
  final List<DayProgress> progress;
  final DateTime subscribedAt;

  UserBiblePlanSubscription({
    required this.planId,
    required this.startDate,
    this.notificationTime,
    required this.notificationEnabled,
    required this.progress,
    required this.subscribedAt,
  });

  factory UserBiblePlanSubscription.fromJson(Map<String, dynamic> json) {
    return UserBiblePlanSubscription(
      planId: json['plan_id'] as String,
      startDate: DateTime.parse(json['start_date'] as String),
      notificationTime: json['notification_time'] as String?,
      notificationEnabled: json['notification_enabled'] as bool,
      progress: (json['progress'] as List<dynamic>?)
              ?.map((p) => DayProgress.fromJson(p as Map<String, dynamic>))
              .toList() ??
          [],
      subscribedAt: DateTime.parse(json['subscribed_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'plan_id': planId,
      'start_date': startDate.toIso8601String(),
      'notification_time': notificationTime,
      'notification_enabled': notificationEnabled,
      'progress': progress.map((p) => p.toJson()).toList(),
      'subscribed_at': subscribedAt.toIso8601String(),
    };
  }

  /// Get the current day based on start date (1-indexed)
  int getCurrentDay() {
    final now = DateTime.now();
    final difference = now.difference(startDate).inDays;
    final current = difference + 1; // 1-indexed
    return current < 1 ? 1 : current;
  }

  /// Get the highest completed day
  int getHighestCompletedDay() {
    if (progress.isEmpty) {
      return 0;
    }

    var maxDay = 0;
    for (final dayProgress in progress) {
      if (dayProgress.isCompleted && dayProgress.day > maxDay) {
        maxDay = dayProgress.day;
      }
    }

    return maxDay;
  }

  /// Get progress for a specific day
  DayProgress? getProgressForDay(int day) {
    try {
      return progress.firstWhere((p) => p.day == day);
    } catch (e) {
      return null;
    }
  }

  double getProgressPercentageForPlan(BiblePlan plan) {
    final totalReadingDays = plan.readingDaysCount;
    if (totalReadingDays == 0) {
      return 0.0;
    }

    var completedReadingDays = 0;
    for (final entry in progress) {
      if (!entry.isCompleted) {
        continue;
      }
      if (plan.isRestDay(entry.day)) {
        continue;
      }
      completedReadingDays += 1;
    }

    return (completedReadingDays / totalReadingDays) * 100;
  }

  /// Create a copy with updated fields
  UserBiblePlanSubscription copyWith({
    String? planId,
    DateTime? startDate,
    String? notificationTime,
    bool? notificationEnabled,
    List<DayProgress>? progress,
    DateTime? subscribedAt,
  }) {
    return UserBiblePlanSubscription(
      planId: planId ?? this.planId,
      startDate: startDate ?? this.startDate,
      notificationTime: notificationTime ?? this.notificationTime,
      notificationEnabled: notificationEnabled ?? this.notificationEnabled,
      progress: progress ?? this.progress,
      subscribedAt: subscribedAt ?? this.subscribedAt,
    );
  }

  /// Returns the earliest day the user can work on, enforcing sequential completion.
  /// If all prior days are fully completed, unlocks the next day in sequence.
  int get nextSequentialDay {
    if (progress.isEmpty) {
      return 1;
    }

    final progressByDay = {
      for (final entry in progress) entry.day: entry,
    };

    var day = 1;
    while (true) {
      final entry = progressByDay[day];
      if (entry != null && entry.isCompleted) {
        day += 1;
        continue;
      }
      break;
    }

    return day;
  }
}

/// Combined model with both the plan and subscription details
class UserBiblePlanWithDetails {
  final BiblePlan plan;
  final UserBiblePlanSubscription subscription;

  UserBiblePlanWithDetails({
    required this.plan,
    required this.subscription,
  });

  /// Get progress percentage for this plan
  double get progressPercentage =>
    subscription.getProgressPercentageForPlan(plan);

  /// Get current day based on subscription start date
  int get currentDay {
    final dayFromDate = subscription.getCurrentDay();
    if (dayFromDate > plan.duration) {
      return plan.duration;
    }
    return dayFromDate;
  }

  /// Get the day to display based on either schedule or completion progress
  int get displayCurrentDay {
    final completedDay = subscription.getHighestCompletedDay();
    final dayFromDate = currentDay;
    final candidate = math.max(completedDay, dayFromDate);
    if (candidate < 1) {
      return 1;
    }
    if (candidate > plan.duration) {
      return plan.duration;
    }
    return candidate;
  }

  /// Check if plan is complete
  bool get isComplete {
    final totalReadingDays = plan.readingDaysCount;
    if (totalReadingDays == 0) {
      return true;
    }

    var completedReadingDays = 0;
    for (final entry in subscription.progress) {
      if (entry.isCompleted && !plan.isRestDay(entry.day)) {
        completedReadingDays += 1;
      }
    }

    return completedReadingDays >= totalReadingDays;
  }

  /// Whether a specific day is unlocked for progress based on sequential completion rules.
  bool isDayUnlocked(int day) {
    final progressByDay = {
      for (final entry in subscription.progress) entry.day: entry,
    };

    var pointer = 1;
    while (pointer <= plan.duration) {
      final readings = plan.getReadingsForDay(pointer);
      final isRestDay = readings.isEmpty;

      if (isRestDay || (progressByDay[pointer]?.isCompleted ?? false)) {
        pointer += 1;
        continue;
      }

      break;
    }

    if (day <= pointer) {
      return true;
    }

    // Always allow rest days even if pointer hasn't advanced to them yet.
    return plan.getReadingsForDay(day).isEmpty;
  }

  /// Returns the calendar date corresponding to the requested plan day (1-indexed).
  DateTime dateForDay(int day) {
    if (day <= 1) {
      return subscription.startDate;
    }
    return subscription.startDate.add(Duration(days: day - 1));
  }
}

/// Bible plan notification preference for a specific plan
class BiblePlanNotificationPreference {
  final String planId;
  final bool notificationEnabled;
  final String? notificationTime;
  final DateTime startDate;
  final DateTime subscribedAt;

  BiblePlanNotificationPreference({
    required this.planId,
    required this.notificationEnabled,
    this.notificationTime,
    required this.startDate,
    required this.subscribedAt,
  });

  factory BiblePlanNotificationPreference.fromJson(Map<String, dynamic> json) {
    return BiblePlanNotificationPreference(
      planId: json['plan_id'] as String,
      notificationEnabled: json['notification_enabled'] as bool,
      notificationTime: json['notification_time'] as String?,
      startDate: DateTime.parse(json['start_date'] as String),
      subscribedAt: DateTime.parse(json['subscribed_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'plan_id': planId,
      'notification_enabled': notificationEnabled,
      'notification_time': notificationTime,
      'start_date': startDate.toIso8601String(),
      'subscribed_at': subscribedAt.toIso8601String(),
    };
  }
}

/// Available notification preference type
class NotificationPreferenceType {
  final String key;
  final String description;
  final bool defaultValue;

  NotificationPreferenceType({
    required this.key,
    required this.description,
    required this.defaultValue,
  });

  factory NotificationPreferenceType.fromJson(String key, Map<String, dynamic> json) {
    return NotificationPreferenceType(
      key: key,
      description: json['description'] as String,
      defaultValue: json['default'] as bool,
    );
  }
}
