import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

/// Record type alias used app-wide
typedef VerseKey = ({String book, int chapter, int verse});
String _k(VerseKey k) => '${k.book}|${k.chapter}|${k.verse}';

/// -------- Canonicalization helpers --------

String _canonBook(String raw) {
  String norm(String x) =>
      x.replaceAll('.', '').replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();
  final s = norm(raw);

  // Common aliases
  const aliases = {
    'psalm': 'Psalms',
    'psalms': 'Psalms',
    'song': 'Song of Solomon',
    'songofsongs': 'Song of Solomon',
    'songs of songs': 'Song of Solomon',
    'canticles': 'Song of Solomon',
  };
  if (aliases.containsKey(s)) return aliases[s]!;

  // Canonical set (normalized compare)
  const canon = [
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel",
    "1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs",
    "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
    "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
    "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians",
    "Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James",
    "1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"
  ];
  for (final b in canon) {
    if (norm(b) == s) return b;
  }
  return raw.trim(); // last resort
}

bool _dirOk(String fromTx, String direction) {
  final t = fromTx.trim().toLowerCase();   // 'kjv' / 'rst'
  final d = direction.trim().toLowerCase()
      .replaceAll(' ', '')
      .replaceAll('->', '→')
      .replaceAll('enru', 'en→ru')
      .replaceAll('ruen', 'ru→en');
  if (d.isEmpty || d == 'both') return true;
  if (d == 'en→ru') return t == 'kjv';
  if (d == 'ru→en') return t == 'rst';
  return false;
}

String _dirFromTxs(String fromTx, String toTx) {
  final f = fromTx.trim().toLowerCase();
  final t = toTx.trim().toLowerCase();
  if (f == 'kjv' && t == 'rst') return 'EN→RU';
  if (f == 'rst' && t == 'kjv') return 'RU→EN';
  return 'both';
}

/// -------- Rule framework --------

abstract class _Rule {
  final String book;       // may be variant; always compare via _canonBook()
  final String direction;  // 'EN→RU', 'RU→EN', 'both', or variants
  _Rule(this.book, this.direction);
  bool applies(String fromTx, VerseKey k);
  List<VerseKey> map(String fromTx, VerseKey k);
}

class _PointRule extends _Rule {
  final int fromChapter, fromVerse;
  final int toChapter, toVerse;
  _PointRule(
    super.book,
    super.direction,
    this.fromChapter,
    this.fromVerse,
    this.toChapter,
    this.toVerse,
  );

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) &&
      _canonBook(k.book) == _canonBook(book) &&
      k.chapter == fromChapter &&
      k.verse == fromVerse;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (_dirOk(fromTx, direction) && applies(fromTx, k)) {
      return [(book: _canonBook(book), chapter: toChapter, verse: toVerse)];
    }
    // Invert for opposite tx
    final sameBook = _canonBook(k.book) == _canonBook(book);
    final t = fromTx.trim().toLowerCase();
    final d = direction.trim().toUpperCase();
    if (d == 'EN→RU' && t == 'rst' && sameBook && k.chapter == toChapter && k.verse == toVerse) {
      return [(book: _canonBook(book), chapter: fromChapter, verse: fromVerse)];
    }
    if (d == 'RU→EN' && t == 'kjv' && sameBook && k.chapter == toChapter && k.verse == toVerse) {
      return [(book: _canonBook(book), chapter: fromChapter, verse: fromVerse)];
    }
    return const [];
  }
}

class _SpanCrossChapterRule extends _Rule {
  final int fromChapter, start, end;
  final int toChapter, toStart, toEnd;
  _SpanCrossChapterRule(
    super.book,
    super.direction,
    this.fromChapter,
    this.start,
    this.end,
    this.toChapter,
    this.toStart,
    this.toEnd,
  );

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) &&
      _canonBook(k.book) == _canonBook(book) &&
      k.chapter == fromChapter &&
      k.verse >= start &&
      k.verse <= end;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (_dirOk(fromTx, direction) && applies(fromTx, k)) {
      final idx = k.verse - start; // 0-based
      final mapped = toStart + idx;
      if (mapped < toStart || mapped > toEnd) return const [];
      return [(book: _canonBook(book), chapter: toChapter, verse: mapped)];
    }
    // Invert
    final isOpposite =
        (direction.trim().toUpperCase() == 'EN→RU' && fromTx.trim().toLowerCase() == 'rst') ||
        (direction.trim().toUpperCase() == 'RU→EN' && fromTx.trim().toLowerCase() == 'kjv');
    if (isOpposite &&
        _canonBook(k.book) == _canonBook(book) &&
        k.chapter == toChapter &&
        k.verse >= toStart &&
        k.verse <= toEnd) {
      final idx = k.verse - toStart;
      final mapped = start + idx;
      if (mapped < start || mapped > end) return const [];
      return [(book: _canonBook(book), chapter: fromChapter, verse: mapped)];
    }
    return const [];
  }
}

/// Map entire chapter A ↔ B preserving verse number
class _ChapterRemapRule extends _Rule {
  final int fromChapter;
  final int toChapter;
  _ChapterRemapRule(super.book, super.direction, this.fromChapter, this.toChapter);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) &&
      _canonBook(k.book) == _canonBook(book) &&
      k.chapter == fromChapter;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (_dirOk(fromTx, direction) && applies(fromTx, k)) {
      return [(book: _canonBook(book), chapter: toChapter, verse: k.verse)];
    }
    // invert
    final sameBook = _canonBook(k.book) == _canonBook(book);
    final t = fromTx.trim().toLowerCase();
    final d = direction.trim().toUpperCase();
    if (d == 'EN→RU' && t == 'rst' && sameBook && k.chapter == toChapter) {
      return [(book: _canonBook(book), chapter: fromChapter, verse: k.verse)];
    }
    if (d == 'RU→EN' && t == 'kjv' && sameBook && k.chapter == toChapter) {
      return [(book: _canonBook(book), chapter: fromChapter, verse: k.verse)];
    }
    return const [];
  }
}

/// Psalms titles offset (e.g., RU = EN + 1)
class _OffsetRangeRule extends _Rule {
  final List<int> psalms;
  final int ruVerseOffset; // RU = EN + offset (for headings)
  _OffsetRangeRule(super.book, super.direction, this.psalms, this.ruVerseOffset);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _canonBook(k.book) == 'Psalms' && psalms.contains(k.chapter);

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (!applies(fromTx, k)) return const [];
    if (fromTx.trim().toLowerCase() == 'kjv') {
      final v = k.verse + ruVerseOffset;
      return v < 1 ? const [] : [(book: 'Psalms', chapter: k.chapter, verse: v)];
    } else {
      final v = k.verse - ruVerseOffset;
      return v < 1 ? const [] : [(book: 'Psalms', chapter: k.chapter, verse: v)];
    }
  }
}

/// -------- Matching engine --------

class VerseMatching {
  final Map<String, List<int>> _kjvToRst;
  final Map<String, List<int>> _rstToKjv;
  final List<_Rule> _rules;

  VerseMatching._(this._kjvToRst, this._rstToKjv, this._rules);

  static Future<VerseMatching> load() async {
    // ---------- Try multiple rule file shapes ----------
    final ruleCandidates = <String>[
      'assets/bibles/verse_matching/verse_matching_rules.json',
      'assets/bibles/verse_matching/rules.json',
      'assets/bibles/elisha/verse_matching_rules.json',
      // your new schema file could be any of these names; keep them in sync
    ];

    String? rulePathUsed;
    dynamic decoded;

    for (final p in ruleCandidates) {
      try {
        final s = await rootBundle.loadString(p);
        decoded = jsonDecode(s);
        rulePathUsed = p;
        break;
      } catch (_) { /* try next */ }
    }
    if (decoded == null) {
      throw StateError('Could not load verse-matching rules from: ${ruleCandidates.join(', ')}');
    }

    final parsed = <_Rule>[];

    // ----- (A) Legacy formats -----
    if (decoded is List || (decoded is Map && decoded['rules'] is List)) {
      final List<dynamic> rulesList = decoded is List ? decoded : (decoded['rules'] as List);
      for (final r in rulesList) {
        final m = r as Map<String, dynamic>;
        final book = m['book'] as String;
        final dir = (m['direction'] ?? 'both') as String;
        final type = m['type'] as String;

        switch (type) {
          case 'point':
            parsed.add(_PointRule(
              book, dir,
              (m['from']['chapter'] as num).toInt(),
              (m['from']['verse'] as num).toInt(),
              (m['to']['chapter'] as num).toInt(),
              (m['to']['verse'] as num).toInt(),
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
    }
    // ----- (B) Your schema:1 format -----
    else if (decoded is Map && decoded['schema'] == 1 && decoded['pairs'] is List) {
      final pairs = decoded['pairs'] as List;
      for (final p in pairs) {
        final m = p as Map<String, dynamic>;
        final book = m['book'] as String;
        final type = m['type'] as String;

        switch (type) {
          case 'one_to_one': {
            final from = m['from'] as Map<String, dynamic>;
            final to   = m['to']   as Map<String, dynamic>;
            final dir  = _dirFromTxs(from['tx'] as String, to['tx'] as String);
            parsed.add(_PointRule(
              book, dir,
              (from['chapter'] as num).toInt(),
              (from['verse'] as num).toInt(),
              (to['chapter'] as num).toInt(),
              (to['verse'] as num).toInt(),
            ));
            break;
          }
          case 'range_shift': {
            final from = m['from'] as Map<String, dynamic>;
            final to   = m['to']   as Map<String, dynamic>;
            final dir  = _dirFromTxs(from['tx'] as String, to['tx'] as String);
            parsed.add(_SpanCrossChapterRule(
              book, dir,
              (from['chapter'] as num).toInt(),
              (from['start'] as num).toInt(),
              (from['end'] as num).toInt(),
              (to['chapter'] as num).toInt(),
              (to['start'] as num).toInt(),
              (to['end'] as num).toInt(),
            ));
            break;
          }
          case 'chapter_remap': {
            final maps = m['map'] as List;
            for (final ent in maps) {
              final e = ent as Map<String, dynamic>;
              final from = e['from'] as Map<String, dynamic>;
              final to   = e['to']   as Map<String, dynamic>;
              final dir  = _dirFromTxs(from['tx'] as String, to['tx'] as String);
              parsed.add(_ChapterRemapRule(
                book, dir,
                (from['chapter'] as num).toInt(),
                (to['chapter'] as num).toInt(),
              ));
            }
            break;
          }
        }
      }

      // psalms_title_offsets
      if (decoded['psalms_title_offsets'] is Map) {
        final p = decoded['psalms_title_offsets'] as Map<String, dynamic>;
        final dir = _dirFromTxs(p['tx_from'] as String, p['tx_to'] as String);
        final ps = (p['psalms'] as List).map((e) => (e as num).toInt()).toList();
        // rule "toVerse = (fromVerse == 1 ? 2 : fromVerse + 1)" is effectively offset +1
        parsed.add(_OffsetRangeRule('Psalms', dir, ps, 1));
      }
    } else {
      throw StateError('Unrecognized verse-matching rules format in $rulePathUsed');
    }

    // ---------- Optional direct mapping ----------
    Map<String, List<int>> kjvToRst = {};
    Map<String, List<int>> rstToKjv = {};
    final mapCandidates = <String>[
      'assets/bibles/verse_matching/verse_matching_mapping.json',
      'assets/bibles/verse_matching/mapping.json',
      'assets/bibles/elisha/verse_matching_mapping.json',
    ];
    for (final p in mapCandidates) {
      try {
        final s = await rootBundle.loadString(p);
        final mapJson = jsonDecode(s) as Map<String, dynamic>;
        final k2r = mapJson['kjv_to_rst'];
        final r2k = mapJson['rst_to_kjv'];
        if (k2r is Map && r2k is Map) {
          kjvToRst = k2r.map((k, v) => MapEntry(k as String, List<int>.from(v as List)));
          rstToKjv = r2k.map((k, v) => MapEntry(k as String, List<int>.from(v as List)));
        }
        break;
      } catch (_) { /* optional */ }
    }

    return VerseMatching._(kjvToRst, rstToKjv, parsed);
  }

  /// Returns mapped verses in the *other* translation. Empty => no counterpart.
  List<VerseKey> matchToOther({required String fromTx, required VerseKey key}) {
    // Normalize incoming key for rule matching
    final normKey = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);

    // 1) rules first (handle cross-chapter shifts like Jonah 1:17 -> 2:1)
    for (final r in _rules) {
      if (r.applies(fromTx, normKey)) {
        final mapped = r.map(fromTx, normKey);
        if (mapped.isNotEmpty) return mapped;
      }
    }

    // 2) optional direct mapping (same-chapter only); try original and canonicalized book keys
    final maps = fromTx.trim().toLowerCase() == 'kjv' ? _kjvToRst : _rstToKjv;
    final key1 = _k(key);
    final key2 = _k(normKey);
    final directList = maps[key1] ?? maps[key2];

    if (directList != null && directList.isNotEmpty) {
      return directList
          .map((v) => (book: normKey.book, chapter: normKey.chapter, verse: v))
          .toList(growable: false);
    }

    return const [];
  }

  bool existsInOther({required String fromTx, required VerseKey key}) =>
      matchToOther(fromTx: fromTx, key: key).isNotEmpty;
}
