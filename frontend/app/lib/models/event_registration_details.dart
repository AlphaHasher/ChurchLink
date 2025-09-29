class RegistrationEntry {
  final String userUid;
  final String userName;
  final String? personId;
  final String? personName;
  final String displayName;
  final DateTime registeredOn;
  final String kind;

  RegistrationEntry({
    required this.userUid,
    required this.userName,
    this.personId,
    this.personName,
    required this.displayName,
    required this.registeredOn,
    required this.kind,
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
