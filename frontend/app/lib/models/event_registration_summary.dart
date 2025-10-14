class RegistrationEntry {
  final String userUid;
  final String userName;
  final String? personId;
  final String? personName;
  final String displayName;
  final DateTime registeredOn;
  final String kind;
  final String scope; // "series" for recurring, "occurrence" for one-time

  RegistrationEntry({
    required this.userUid,
    required this.userName,
    this.personId,
    this.personName,
    required this.displayName,
    required this.registeredOn,
    required this.kind,
    this.scope = 'series', // Default to series for backwards compatibility
  });

  factory RegistrationEntry.fromJson(Map<String, dynamic> json) {
    return RegistrationEntry(
      userUid: json['user_uid'] ?? '',
      userName: json['user_name'] ?? '',
      personId: json['person_id'],
      personName: json['person_name'],
      displayName: json['display_name'] ?? '',
      registeredOn:
          json['registered_on'] != null
              ? DateTime.parse(json['registered_on'])
              : DateTime.now(),
      kind: json['kind'] ?? 'rsvp',
      scope: json['scope'] ?? 'series', // Default to series if not provided
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_uid': userUid,
      'user_name': userName,
      'person_id': personId,
      'person_name': personName,
      'display_name': displayName,
      'registered_on': registeredOn.toIso8601String(),
      'kind': kind,
      'scope': scope,
    };
  }

  /// Check if this registration belongs to the current user
  bool isCurrentUser(String currentUserUid) {
    return userUid == currentUserUid && personId == null;
  }

  /// Check if this registration is for a family member of the current user
  bool isCurrentUserFamily(String currentUserUid) {
    return userUid == currentUserUid && personId != null;
  }
}

class EventRegistrationSummary {
  final List<RegistrationEntry> userRegistrations; // Only current user's family
  final int totalRegistrations; // Aggregate count only
  final int availableSpots;
  final int totalSpots;
  final bool canRegister;

  EventRegistrationSummary({
    required this.userRegistrations,
    required this.totalRegistrations,
    required this.availableSpots,
    required this.totalSpots,
    required this.canRegister,
  });

  factory EventRegistrationSummary.fromJson(Map<String, dynamic> json) {
    final registrationsList =
        json['user_registrations'] as List<dynamic>? ?? [];
    final userRegistrations =
        registrationsList
            .map(
              (item) =>
                  RegistrationEntry.fromJson(item as Map<String, dynamic>),
            )
            .toList();

    return EventRegistrationSummary(
      userRegistrations: userRegistrations,
      totalRegistrations: json['total_registrations'] ?? 0,
      availableSpots: json['available_spots'] ?? 0,
      totalSpots: json['total_spots'] ?? 0,
      canRegister: json['can_register'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_registrations': userRegistrations.map((r) => r.toJson()).toList(),
      'total_registrations': totalRegistrations,
      'available_spots': availableSpots,
      'total_spots': totalSpots,
      'can_register': canRegister,
    };
  }

  /// Get registrations for the current user (themselves)
  List<RegistrationEntry> getCurrentUserRegistrations(String currentUserUid) {
    return userRegistrations
        .where((reg) => reg.isCurrentUser(currentUserUid))
        .toList();
  }

  /// Get registrations for the current user's family members
  List<RegistrationEntry> getCurrentUserFamilyRegistrations(
    String currentUserUid,
  ) {
    return userRegistrations
        .where((reg) => reg.isCurrentUserFamily(currentUserUid))
        .toList();
  }

  /// Get all registrations that belong to current user (user + family)
  List<RegistrationEntry> getAllCurrentUserRegistrations(
    String currentUserUid,
  ) {
    return userRegistrations;
  }
}
