class LegalPageDto {
  final String slug;
  final String title;
  final String locale;
  final String contentMarkdown;
  final DateTime updatedAt;

  LegalPageDto({
    required this.slug,
    required this.title,
    required this.locale,
    required this.contentMarkdown,
    required this.updatedAt,
  });

  factory LegalPageDto.fromJson(Map<String, dynamic> json) {
    return LegalPageDto(
      slug: json['slug'] as String,
      title: json['title'] as String,
      locale: json['locale'] as String,
      contentMarkdown: json['content_markdown'] as String? ?? '',
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}