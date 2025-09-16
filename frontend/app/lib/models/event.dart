import 'package:intl/intl.dart';

class Event {
  final String id;
  final String name;
  final String? ruName; // Russian translation
  final String description;
  final String? ruDescription; // Russian description
  final DateTime date;
  final String location;
  final double price;
  final List<String> ministry;
  final int minAge;
  final int maxAge;
  final String gender;
  final String? imageUrl; // Event banner image
  final int? spots; // Available spots
  final bool rsvp; // RSVP required
  final String? recurring; // Recurring pattern
  final List<String> roles; // Required roles
  final bool published; // Publication status
  final int seatsTaken; // Current registrations
  final List<String> attendeeKeys; // Attendee identifiers
  final List<dynamic> attendees; // Full attendee objects

  Event({
    required this.id,
    required this.name,
    this.ruName,
    required this.description,
    this.ruDescription,
    required this.date,
    required this.location,
    required this.price,
    required this.ministry,
    required this.minAge,
    required this.maxAge,
    required this.gender,
    this.imageUrl,
    this.spots,
    required this.rsvp,
    this.recurring,
    required this.roles,
    required this.published,
    required this.seatsTaken,
    required this.attendeeKeys,
    required this.attendees,
  });

  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      ruName: json['ru_name']?.toString(),
      description: json['description']?.toString() ?? '',
      ruDescription: json['ru_description']?.toString(),
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
      location: json['location']?.toString() ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      ministry:
          json['ministry'] != null
              ? List<String>.from(json['ministry'])
              : <String>[],
      minAge: (json['min_age'] as num?)?.toInt() ?? 0,
      maxAge: (json['max_age'] as num?)?.toInt() ?? 100,
      gender: json['gender']?.toString() ?? 'all',
      imageUrl: json['image_url']?.toString(),
      spots: (json['spots'] as num?)?.toInt(),
      rsvp: json['rsvp'] == true,
      recurring: json['recurring']?.toString(),
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
      if (ruName != null) 'ru_name': ruName,
      'description': description,
      if (ruDescription != null) 'ru_description': ruDescription,
      'date': date.toIso8601String(),
      'location': location,
      'price': price,
      'ministry': ministry,
      'min_age': minAge,
      'max_age': maxAge,
      'gender': gender,
      if (imageUrl != null) 'image_url': imageUrl,
      if (spots != null) 'spots': spots,
      'rsvp': rsvp,
      if (recurring != null) 'recurring': recurring,
      'roles': roles,
      'published': published,
      'seats_taken': seatsTaken,
      'attendee_keys': attendeeKeys,
      'attendees': attendees,
    };
  }

  // Computed properties
  bool get isFree => price == 0;

  bool get hasSpots => spots == null || seatsTaken < spots!;

  int? get availableSpots => spots != null ? spots! - seatsTaken : null;

  bool get isUpcoming => date.isAfter(DateTime.now());

  String get formattedDate => DateFormat('MMM dd, yyyy').format(date);

  String get formattedTime => DateFormat('hh:mm a').format(date);

  String get formattedDateTime =>
      DateFormat('MMM dd, yyyy • hh:mm a').format(date);

  // Helper method for display name (with fallback to Russian if available)
  String getDisplayName(bool useRussian) {
    if (useRussian && ruName != null && ruName!.isNotEmpty) {
      return ruName!;
    }
    return name;
  }

  // Helper method for display description
  String getDisplayDescription(bool useRussian) {
    if (useRussian && ruDescription != null && ruDescription!.isNotEmpty) {
      return ruDescription!;
    }
    return description;
  }
}
