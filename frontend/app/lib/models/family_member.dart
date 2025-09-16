class FamilyMember {
  final String id;
  final String firstName;
  final String lastName;
  final String gender; // "M" or "F"
  final DateTime dateOfBirth;
  final DateTime createdOn;

  FamilyMember({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.gender,
    required this.dateOfBirth,
    required this.createdOn,
  });

  String get fullName => '$firstName $lastName';

  int get age {
    final now = DateTime.now();
    int age = now.year - dateOfBirth.year;
    if (now.month < dateOfBirth.month ||
        (now.month == dateOfBirth.month && now.day < dateOfBirth.day)) {
      age--;
    }
    return age;
  }

  factory FamilyMember.fromJson(Map<String, dynamic> json) {
    return FamilyMember(
      id: json['id'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      gender: json['gender'],
      dateOfBirth: DateTime.parse(json['date_of_birth']),
      createdOn: DateTime.parse(json['createdOn']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'first_name': firstName,
      'last_name': lastName,
      'gender': gender,
      'date_of_birth': dateOfBirth.toIso8601String(),
    };
  }
}

class FamilyMemberCreate {
  final String firstName;
  final String lastName;
  final String gender;
  final DateTime dateOfBirth;

  FamilyMemberCreate({
    required this.firstName,
    required this.lastName,
    required this.gender,
    required this.dateOfBirth,
  });

  Map<String, dynamic> toJson() {
    return {
      'first_name': firstName,
      'last_name': lastName,
      'gender': gender,
      'date_of_birth': dateOfBirth.toIso8601String(),
    };
  }
}
