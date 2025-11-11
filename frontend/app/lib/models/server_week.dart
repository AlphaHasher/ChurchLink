/// Server-provided week information to ensure frontend-backend synchronization
class ServerWeekInfo {
  final DateTime currentDate;
  final DateTime weekStart;
  final DateTime weekEnd;
  final String weekLabel;
  final String timezone;

  const ServerWeekInfo({
    required this.currentDate,
    required this.weekStart,
    required this.weekEnd,
    required this.weekLabel,
    required this.timezone,
  });

  /// Parse from JSON response
  factory ServerWeekInfo.fromJson(Map<String, dynamic> json) {
    return ServerWeekInfo(
      currentDate: DateTime.parse(json['current_date'] as String),
      weekStart: DateTime.parse(json['week_start'] as String),
      weekEnd: DateTime.parse(json['week_end'] as String),
      weekLabel: json['week_label'] as String,
      timezone: json['timezone'] as String,
    );
  }

  /// Fallback to client-side calculation if server is unavailable
  factory ServerWeekInfo.clientFallback() {
    final now = DateTime.now();
    final dayOfWeek = now.weekday; // 1 = Monday, 7 = Sunday
    final daysFromMonday = dayOfWeek - 1;
    
    final monday = now.subtract(Duration(days: daysFromMonday));
    final weekStart = DateTime(monday.year, monday.month, monday.day, 0, 0, 0);
    
    final sunday = weekStart.add(const Duration(days: 6, hours: 23, minutes: 59, seconds: 59));
    
    // Format month name
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final monthName = monthNames[weekStart.month - 1];
    
    return ServerWeekInfo(
      currentDate: now,
      weekStart: weekStart,
      weekEnd: sunday,
      weekLabel: 'For the week of $monthName ${weekStart.day}, ${weekStart.year}',
      timezone: 'client-local',
    );
  }

  @override
  String toString() {
    return 'ServerWeekInfo(weekLabel: $weekLabel, timezone: $timezone)';
  }
}
