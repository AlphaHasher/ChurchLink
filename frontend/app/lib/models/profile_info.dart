class ProfileInfo {
  final String firstName;
  final String lastName;
  final String email;
  final DateTime? birthday;
  final String? gender; // "M" | "F" | null

  const ProfileInfo({
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.birthday,
    required this.gender,
  });

  factory ProfileInfo.fromJson(Map<String, dynamic> j) {
    return ProfileInfo(
      firstName: (j['first_name'] ?? '').toString(),
      lastName: (j['last_name'] ?? '').toString(),
      email: (j['email'] ?? '').toString(),
      birthday:
          (j['birthday'] is String && (j['birthday'] as String).isNotEmpty)
              ? DateTime.tryParse(j['birthday'] as String)
              : null,
      gender:
          (j['gender'] == 'M' || j['gender'] == 'F')
              ? j['gender'] as String
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'first_name': firstName,
      'last_name': lastName,
      'email': email,
      'birthday': birthday?.toIso8601String(),
      'gender': gender,
    };
  }
}
