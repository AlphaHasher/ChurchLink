const _undefined = Object();

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
    Object? ministry = _undefined,
    Object? speaker = _undefined,
    Object? tags = _undefined,
    Object? dateAfter = _undefined,
    Object? dateBefore = _undefined,
    Object? query = _undefined,
    bool? favoritesOnly,
  }) {
    return SermonFilter(
      skip: skip ?? this.skip,
      limit: limit ?? this.limit,
      ministry: ministry == _undefined ? this.ministry : ministry as String?,
      speaker: speaker == _undefined ? this.speaker : speaker as String?,
      tags:
          tags == _undefined
              ? this.tags
              : tags as List<String>? ?? const <String>[],
      dateAfter:
          dateAfter == _undefined ? this.dateAfter : dateAfter as DateTime?,
      dateBefore:
          dateBefore == _undefined ? this.dateBefore : dateBefore as DateTime?,
      query: query == _undefined ? this.query : query as String?,
      favoritesOnly: favoritesOnly ?? this.favoritesOnly,
    );
  }

  Map<String, String> toQueryParameters() {
    String? formatDate(DateTime? date) {
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
      if (formatDate(dateAfter) != null) 'date_after': formatDate(dateAfter)!,
      if (formatDate(dateBefore) != null)
        'date_before': formatDate(dateBefore)!,
      if (favoritesOnly) 'favorites_only': 'true',
    };

    return params;
  }
}
