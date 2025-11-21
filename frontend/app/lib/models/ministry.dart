class Ministry {
  final String id;
  final String name;
  final String createdAt;
  final String updatedAt;

  Ministry({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Ministry.fromJson(Map<String, dynamic> json) {
    return Ministry(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'name': name,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}
