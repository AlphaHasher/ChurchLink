class MyEventDetails {
  final String id;
  final String name;
  final String? ruName;
  final String description;
  final String? ruDescription;
  final DateTime date;
  final String location;
  final double price;
  final int? spots;
  final bool rsvp;
  final String? recurring;
  final List<String> ministry;
  final int minAge;
  final int maxAge;
  final String gender;
  final String? imageUrl;
  final List<String> roles;
  final bool published;
  final int seatsTaken;
  final List<String> attendeeKeys;
  final List<dynamic> attendees;

  MyEventDetails({
    required this.id,
    required this.name,
    this.ruName,
    required this.description,
    this.ruDescription,
    required this.date,
    required this.location,
    required this.price,
    this.spots,
    required this.rsvp,
    this.recurring,
    required this.ministry,
    required this.minAge,
    required this.maxAge,
    required this.gender,
    this.imageUrl,
    required this.roles,
    required this.published,
    required this.seatsTaken,
    required this.attendeeKeys,
    required this.attendees,
  });

  factory MyEventDetails.fromJson(Map<String, dynamic> json) {
    return MyEventDetails(
      // Backend may return the id as 'id' or as Mongo '_id'. Prefer available values.
      id:
          json['id']?.toString() ??
          json['_id']?.toString() ??
          json['event_id']?.toString() ??
          '',
      name: json['name']?.toString() ?? '',
      ruName: json['ru_name']?.toString(),
      description: json['description']?.toString() ?? '',
      ruDescription: json['ru_description']?.toString(),
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
      location: json['location']?.toString() ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      spots: (json['spots'] as num?)?.toInt(),
      rsvp: json['rsvp'] == true,
      recurring: json['recurring']?.toString(),
      ministry:
          json['ministry'] != null
              ? List<String>.from(json['ministry'])
              : <String>[],
      minAge: (json['min_age'] as num?)?.toInt() ?? 0,
      maxAge: (json['max_age'] as num?)?.toInt() ?? 100,
      gender: json['gender']?.toString() ?? 'all',
      imageUrl: json['image_url']?.toString(),
      roles:
          json['roles'] != null ? List<String>.from(json['roles']) : <String>[],
      published: json['published'] == true,
      seatsTaken: (json['seats_taken'] as num?)?.toInt() ?? 0,
      attendeeKeys:
          json['attendee_keys'] != null
              ? List<String>.from(json['attendee_keys'])
              : <String>[],
      attendees:
          json['attendees'] != null
              ? List<dynamic>.from(json['attendees'])
              : <dynamic>[],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'ru_name': ruName,
      'description': description,
      'ru_description': ruDescription,
      'date': date.toIso8601String(),
      'location': location,
      'price': price,
      'spots': spots,
      'rsvp': rsvp,
      'recurring': recurring,
      'ministry': ministry,
      'min_age': minAge,
      'max_age': maxAge,
      'gender': gender,
      'image_url': imageUrl,
      'roles': roles,
      'published': published,
      'seats_taken': seatsTaken,
      'attendee_keys': attendeeKeys,
      'attendees': attendees,
    };
  }
}

class MyEventRef {
  final String id; // _id from backend
  final String eventId; // event_id
  final String? personId; // person_id for family members
  final String reason; // "rsvp" or "watch"
  final String scope; // "series" or "occurrence"
  final String? seriesId; // series_id
  final String? occurrenceId; // occurrence_id
  final String? occurrenceStart; // occurrence_start
  final String key; // composite key
  final Map<String, dynamic>? meta; // additional metadata
  final DateTime addedOn; // when user added this event
  final String? displayName; // display_name for family members
  final MyEventDetails? event; // expanded event details
  final List<String>
  registrants; // aggregated registrant display names (user + family)

  MyEventRef({
    required this.id,
    required this.eventId,
    this.personId,
    required this.reason,
    required this.scope,
    this.seriesId,
    this.occurrenceId,
    this.occurrenceStart,
    required this.key,
    this.meta,
    required this.addedOn,
    this.displayName,
    this.event,
    this.registrants = const <String>[],
  });

  /// Check if this is a family member's registration
  bool get isFamilyMember => personId != null;

  /// Check if the event is upcoming
  bool get isUpcoming {
    if (event?.date != null) {
      return event!.date.isAfter(DateTime.now());
    }
    return false;
  }

  /// Get display name or fallback
  String get effectiveDisplayName {
    if (displayName != null && displayName!.isNotEmpty) {
      return displayName!;
    }
    return isFamilyMember ? 'Family Member' : 'You';
  }

  factory MyEventRef.fromJson(Map<String, dynamic> json) {
    return MyEventRef(
      id: json['_id']?.toString() ?? '',
      eventId: json['event_id']?.toString() ?? '',
      personId: json['person_id']?.toString(),
      reason: json['reason']?.toString() ?? 'rsvp',
      scope: json['scope']?.toString() ?? 'occurrence',
      seriesId: json['series_id']?.toString(),
      occurrenceId: json['occurrence_id']?.toString(),
      occurrenceStart: json['occurrence_start']?.toString(),
      key: json['key']?.toString() ?? '',
      meta:
          json['meta'] != null ? Map<String, dynamic>.from(json['meta']) : null,
      addedOn:
          DateTime.tryParse(json['addedOn']?.toString() ?? '') ??
          DateTime.now(),
      displayName: json['display_name']?.toString(),
      event:
          json['event'] != null
              ? MyEventDetails.fromJson(
                Map<String, dynamic>.from(json['event']),
              )
              : null,
      registrants:
          json['registrants'] != null
              ? List<String>.from(json['registrants'])
              : const <String>[],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'event_id': eventId,
      'person_id': personId,
      'reason': reason,
      'scope': scope,
      'series_id': seriesId,
      'occurrence_id': occurrenceId,
      'occurrence_start': occurrenceStart,
      'key': key,
      'meta': meta,
      'addedOn': addedOn.toIso8601String(),
      'display_name': displayName,
      'event': event?.toJson(),
      'registrants': registrants,
    };
  }
}

class MyEventsResponse {
  final bool success;
  final List<MyEventRef> events;

  MyEventsResponse({required this.success, required this.events});

  factory MyEventsResponse.fromJson(Map<String, dynamic> json) {
    return MyEventsResponse(
      success: json['success'] == true,
      events:
          json['events'] != null
              ? List<MyEventRef>.from(
                json['events'].map(
                  (x) => MyEventRef.fromJson(Map<String, dynamic>.from(x)),
                ),
              )
              : <MyEventRef>[],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'events': events.map((x) => x.toJson()).toList(),
    };
  }
}

/// Enum for time-based filter options
enum TimeFilter { upcoming, past }

/// Event filters for UI state management
class EventFilters {
  final TimeFilter timeFilter;
  final bool showFamily;
  final String searchTerm;
  final String? ministry;

  EventFilters({
    this.timeFilter = TimeFilter.upcoming,
    this.showFamily = true,
    this.searchTerm = '',
    this.ministry,
  });

  EventFilters copyWith({
    TimeFilter? timeFilter,
    bool? showFamily,
    String? searchTerm,
    String? ministry,
  }) {
    return EventFilters(
      timeFilter: timeFilter ?? this.timeFilter,
      showFamily: showFamily ?? this.showFamily,
      searchTerm: searchTerm ?? this.searchTerm,
      ministry: ministry ?? this.ministry,
    );
  }

  // Convenience getters for backward compatibility
  bool get showUpcoming => timeFilter == TimeFilter.upcoming;
  bool get showPast => timeFilter == TimeFilter.past;
}
