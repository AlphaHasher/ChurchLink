import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

/// Record type alias used app-wide
typedef VerseKey = ({String book, int chapter, int verse});
String _k(VerseKey k) => '${k.book}|${k.chapter}|${k.verse}';

bool _dirOk(String fromTx, String direction) {
  if (direction == 'both') return true;
  if (direction == 'EN→RU') return fromTx == 'kjv';
  if (direction == 'RU→EN') return fromTx == 'rst';
  return false;
}

abstract class _Rule {
  final String book;
  final String direction; // 'EN→RU', 'RU→EN', or 'both'
  _Rule(this.book, this.direction);
  bool applies(String fromTx, VerseKey k);
  List<VerseKey> map(String fromTx, VerseKey k);
}

class _PointRule extends _Rule {
  final int fromChapter, fromVerse;
  final int toChapter, toVerse;
  _PointRule(super.book, super.direction, this.fromChapter, this.fromVerse, this.toChapter, this.toVerse);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) && k.book == book && k.chapter == fromChapter && k.verse == fromVerse;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    // Forward mapping
    if ((_dirOk(fromTx, direction) && applies(fromTx, k))) {
      return [(book: book, chapter: toChapter, verse: toVerse)];
    }
    // Invert when caller comes from the opposite tx
    if (direction == 'EN→RU' && fromTx == 'rst' && k.book == book && k.chapter == toChapter && k.verse == toVerse) {
      return [(book: book, chapter: fromChapter, verse: fromVerse)];
    }
    if (direction == 'RU→EN' && fromTx == 'kjv' && k.book == book && k.chapter == toChapter && k.verse == toVerse) {
      return [(book: book, chapter: fromChapter, verse: fromVerse)];
    }
    return const [];
  }
}

class _SpanOffsetRule extends _Rule {
  final int fromChapter, start, end;
  final int toChapter, verseOffset; // offset to apply to the verse number
  _SpanOffsetRule(super.book, super.direction, this.fromChapter, this.start, this.end, this.toChapter, this.verseOffset);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) && k.book == book && k.chapter == fromChapter && k.verse >= start && k.verse <= end;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    // Forward direction
    if ((_dirOk(fromTx, direction) && applies(fromTx, k))) {
      final v = k.verse + verseOffset;
      if (v < 1) return const [];
      return [(book: book, chapter: toChapter, verse: v)];
    }
    // Invert when same rule is defined only 'EN→RU' but we come from RST
    if (direction == 'EN→RU' && fromTx == 'rst' && k.book == book && k.chapter == toChapter) {
      final v = k.verse - verseOffset;
      if (v < start || v > end) return const [];
      return [(book: book, chapter: fromChapter, verse: v)];
    }
    if (direction == 'RU→EN' && fromTx == 'kjv' && k.book == book && k.chapter == toChapter) {
      final v = k.verse - verseOffset;
      if (v < start || v > end) return const [];
      return [(book: book, chapter: fromChapter, verse: v)];
    }
    return const [];
  }
}

class _SpanCrossChapterRule extends _Rule {
  final int fromChapter, start, end;
  final int toChapter, toStart, toEnd;
  _SpanCrossChapterRule(super.book, super.direction, this.fromChapter, this.start, this.end, this.toChapter, this.toStart, this.toEnd);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) && k.book == book && k.chapter == fromChapter && k.verse >= start && k.verse <= end;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    // Map position within source span to target span
    if ((_dirOk(fromTx, direction) && applies(fromTx, k))) {
      final idx = k.verse - start; // 0-based
      final mapped = toStart + idx;
      if (mapped < toStart || mapped > toEnd) return const [];
      return [(book: book, chapter: toChapter, verse: mapped)];
    }
    // Invert
    final isOpposite = (direction == 'EN→RU' && fromTx == 'rst') || (direction == 'RU→EN' && fromTx == 'kjv');
    if (isOpposite && k.book == book && k.chapter == toChapter && k.verse >= toStart && k.verse <= toEnd) {
      final idx = k.verse - toStart;
      final mapped = start + idx;
      if (mapped < start || mapped > end) return const [];
      return [(book: book, chapter: fromChapter, verse: mapped)];
    }
    return const [];
  }
}

class _OffsetRangeRule extends _Rule {
  final List<int> psalms;
  final int ruVerseOffset; // RU = EN + offset (for headings)
  _OffsetRangeRule(super.book, super.direction, this.psalms, this.ruVerseOffset);

  @override
  bool applies(String fromTx, VerseKey k) => k.book == 'Psalms' && psalms.contains(k.chapter);

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (!applies(fromTx, k)) return const [];
    if (fromTx == 'kjv') {
      final v = k.verse + ruVerseOffset;
      return v < 1 ? const [] : [(book: 'Psalms', chapter: k.chapter, verse: v)];
    } else {
      final v = k.verse - ruVerseOffset;
      return v < 1 ? const [] : [(book: 'Psalms', chapter: k.chapter, verse: v)];
    }
  }
}

class VerseMatching {
  final Map<String, List<int>> _kjvToRst;
  final Map<String, List<int>> _rstToKjv;
  final List<_Rule> _rules;

  VerseMatching._(this._kjvToRst, this._rstToKjv, this._rules);

  static Future<VerseMatching> load() async {
    // 1) Rules (required)
    final rulesRaw = await rootBundle.loadString(
      'assets/bibles/verse_matching/verse_matching_rules.json',
    );
    final rulesJson = jsonDecode(rulesRaw) as Map<String, dynamic>;
    final parsed = <_Rule>[];
    for (final r in (rulesJson['rules'] as List)) {
      final m = r as Map<String, dynamic>;
      final book = m['book'] as String;
      final dir = (m['direction'] ?? 'both') as String;
      switch (m['type'] as String) {
        case 'point':
          parsed.add(_PointRule(
            book, dir,
            (m['from']['chapter'] as num).toInt(),
            (m['from']['verse'] as num).toInt(),
            (m['to']['chapter'] as num).toInt(),
            (m['to']['verse'] as num).toInt(),
          ));
          break;
        case 'span-offset':
          parsed.add(_SpanOffsetRule(
            book, dir,
            (m['from']['chapter'] as num).toInt(),
            (m['from']['start'] as num).toInt(),
            (m['from']['end'] as num).toInt(),
            (m['to']['chapter'] as num).toInt(),
            (m['to']['verse_offset'] as num).toInt(),
          ));
          break;
        case 'span-cross-chapter':
          parsed.add(_SpanCrossChapterRule(
            book, dir,
            (m['from']['chapter'] as num).toInt(),
            (m['from']['start'] as num).toInt(),
            (m['from']['end'] as num).toInt(),
            (m['to']['chapter'] as num).toInt(),
            (m['to']['start'] as num).toInt(),
            (m['to']['end'] as num).toInt(),
          ));
          break;
        case 'offset-range':
          parsed.add(_OffsetRangeRule(
            book, dir,
            (m['psalms'] as List).map((e) => (e as num).toInt()).toList(),
            (m['ru_verse_offset'] as num).toInt(),
          ));
          break;
      }
    }

    // 2) Direct mapping (optional)
    Map<String, List<int>> kjvToRst = {};
    Map<String, List<int>> rstToKjv = {};
    try {
      final mapRaw = await rootBundle.loadString(
        'assets/bibles/verse_matching/verse_matching_mapping.json',
      );
      final mapJson = jsonDecode(mapRaw) as Map<String, dynamic>;
      kjvToRst = (mapJson['kjv_to_rst'] as Map)
          .map((k, v) => MapEntry(k as String, List<int>.from(v as List)));
      rstToKjv = (mapJson['rst_to_kjv'] as Map)
          .map((k, v) => MapEntry(k as String, List<int>.from(v as List)));
    } catch (_) {
      // fine; rules still cover the important differences
    }

    return VerseMatching._(kjvToRst, rstToKjv, parsed);
  }

  /// Returns mapped verses in the *other* translation. Empty => no counterpart.
  List<VerseKey> matchToOther({required String fromTx, required VerseKey key}) {
    // 1) direct 1:1
    final direct = fromTx == 'kjv' ? _kjvToRst[_k(key)] : _rstToKjv[_k(key)];
    if (direct != null && direct.isNotEmpty) {
      return [(book: key.book, chapter: key.chapter, verse: direct.first)];
    }
    // 2) rules (first match wins)
    for (final r in _rules) {
      if (r.applies(fromTx, key)) {
        final mapped = r.map(fromTx, key);
        if (mapped.isNotEmpty) return mapped;
      }
    }
    // 3) no mapping
    return const [];
  }

  bool existsInOther({required String fromTx, required VerseKey key}) =>
      matchToOther(fromTx: fromTx, key: key).isNotEmpty;
}
