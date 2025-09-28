class SermonFilter {
  final int skip;
  final int limit;
  final String? ministry;
  final String? speaker;
  final List<String> tags;
  final DateTime? dateAfter;
  final DateTime? dateBefore;
  final String? query;
  final bool favoritesOnly;

  const SermonFilter({
    this.skip = 0,
    this.limit = 50,
    this.ministry,
    this.speaker,
    this.tags = const <String>[],
    this.dateAfter,
    this.dateBefore,
    this.query,
    this.favoritesOnly = false,
  });

  SermonFilter copyWith({
    int? skip,
    int? limit,
    String? ministry,
    String? speaker,
    List<String>? tags,
    DateTime? dateAfter,
    DateTime? dateBefore,
    String? query,
    bool? favoritesOnly,
  }) {
    return SermonFilter(
      skip: skip ?? this.skip,
      limit: limit ?? this.limit,
      ministry: ministry ?? this.ministry,
      speaker: speaker ?? this.speaker,
      tags: tags ?? this.tags,
      dateAfter: dateAfter ?? this.dateAfter,
      dateBefore: dateBefore ?? this.dateBefore,
      query: query ?? this.query,
      favoritesOnly: favoritesOnly ?? this.favoritesOnly,
    );
  }

  Map<String, String> toQueryParameters() {
    String? _formatDate(DateTime? date) {
      if (date == null) return null;
      return date.toIso8601String().split('T').first;
    }

    final Map<String, String> params = {
      'skip': skip.toString(),
      'limit': limit.toString(),
      if (ministry != null && ministry!.isNotEmpty) 'ministry': ministry!,
      if (speaker != null && speaker!.isNotEmpty) 'speaker': speaker!,
      if (tags.isNotEmpty) 'tags': tags.join(','),
      if (query != null && query!.isNotEmpty) 'query': query!,
      'published': 'true',
      if (_formatDate(dateAfter) != null) 'date_after': _formatDate(dateAfter)!,
      if (_formatDate(dateBefore) != null)
        'date_before': _formatDate(dateBefore)!,
      if (favoritesOnly) 'favorites_only': 'true',
    };

    return params;
  }
}
