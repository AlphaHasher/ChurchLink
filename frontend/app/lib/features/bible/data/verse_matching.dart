// -----------------------------------------------------------------------------
// Maps verse numbers between translations. Necessary for when a verse's 
// chapter and numbering differs between two different translations. (At 
// present, only two translations are being considered). When a verse 
// matches another, its highlights and notes should transfer. When a verse
// has no pair, its notes and highlights should only be accessable when using
// the corresponding translation. Relies on verse_matching_mapping.json and
// verse_matching_rules.json. 
// TODO: Switch to the mapping file provided by Daniel
// TODO: Possibly need to implement One-to-Many verse mapping for edge cases?
// TODO: Double check the mapping file and the bibles
// TODO: Implement note transferring when verses need to be mapped
// TODO: KJV Jonah 1:17 <--> RST Jonah 2:1 is a good test case
// -----------------------------------------------------------------------------

import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

/// Record type alias used app-wide
/// Simple record representing a verse location.
typedef VerseKey = ({String book, int chapter, int verse});
String _k(VerseKey k) => '${k.book}|${k.chapter}|${k.verse}';

/// -------- Canonicalization helpers --------

/// Normalizes a book name (handles dots, extra spaces, common aliases).
String _canonBook(String raw) {
  String norm(String x) =>
      x.replaceAll('.', '').replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();
  final s = norm(raw);

  // Common aliases
  // TODO: Migrate this into a separate file
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
  // TODO: Migrate this into a separate file
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

// Determines mapping direction and if a rule should apply given that direction
bool _dirOk(String fromTx, String direction) {
  final t = fromTx.trim().toLowerCase();
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

// Provides a standardized label for mapping direction
String _dirFromTxs(String fromTx, String toTx) {
  final f = fromTx.trim().toLowerCase();
  final t = toTx.trim().toLowerCase();
  if (f == 'kjv' && t == 'rst') return 'EN→RU';
  if (f == 'rst' && t == 'kjv') return 'RU→EN';
  return 'both';
}

/// -------- Rule framework --------
/// Relevant data needed to perform a remap (point, ranges, chapter remaps, etc.).
abstract class _Rule {
  final String book;       // Which book a rule applies to
  final String direction;  // Mapping direction of the rule (From which book to which book)
  _Rule(this.book, this.direction);
  
  /// Returns true if this rule applies to the input.
  bool applies(String fromTx, VerseKey k);
  /// Returns the equivalent verse to an inputted verse.
  List<VerseKey> map(String fromTx, VerseKey k);
}

/// One-To-One Verse Mapping. Applies to individual verses. 
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

/// One-to-One range of verses mapping.
/// Applies to a set of contiguous verses. 
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

/// Remaps an entire chapter to another chapter.
/// Applies when an entire chapter is shifted to another number but its contents are identical. 
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

/// Designed specifically for Psalms in RST and KJV
/// In RST, Psalms counts the title of a chapter as its own verse.
/// This offsets the verse numbering between RST and KJV by 1. 
/// In RST, verse 1 of each chapter has no KJV equivalent
class _OffsetRangeRule extends _Rule {
  final List<int> psalms;
  final int ruVerseOffset; // RU = EN + offset (for headings)
  _OffsetRangeRule(super.book, super.direction, this.psalms, this.ruVerseOffset);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) && // Restricts shifting by direction
      _canonBook(k.book) == 'Psalms' &&
      psalms.contains(k.chapter);

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

/// Uses the functions outlined earlier to map out the verse 
/// translations for the different bibles. 
class VerseMatching {
  final List<_Rule> _rules;

  VerseMatching._(this._rules);

/// Loads mapping tables and optional rules from /assets/bibles/verse_mapping.
static Future<VerseMatching> load() async {
    // Open the matching rules file
    final ruleCandidates = <String>[
      'assets/bibles/verse_matching/verse_matching_rules.json',
    ];

    String? rulePathUsed;
    dynamic decoded;

    // Attempts to open the rules file.
    // TODO: Originally designed for searching multiple files
    // TODO: Might have redundant code for checking this
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

    /// Parses the mapping file. Requires a specific format.
    /// Mapping rules are stored in verse_matching_rules.json
    /// The JSON should look like the following example:
    /// 
    /// {
    ///   "pairs": [
    ///     { "type":"one_to_one",
    ///       "book":"Jonah",
    ///       "from":{"tx":"kjv","chapter":1,"verse":17},
    ///       "to":  {"tx":"rst","chapter":2,"verse":1} },
    ///     { "type":"range_shift",
    ///       "book":"Daniel",
    ///       "from":{"tx":"kjv","chapter":4,"start":1,"end":3},
    ///       "to":  {"tx":"rst","chapter":3,"start":31,"end":33} },
    ///     { "type":"chapter_remap",
    ///       "book":"Joel",
    ///       "map":[{"from":{"tx":"kjv","chapter":3},
    ///               "to":  {"tx":"rst","chapter":4}}] }
    ///   ],
    ///   "psalms_title_offsets": {
    ///     "tx_from":"kjv","tx_to":"rst","psalms":[3,4,5]
    ///   }
    /// }
    /// 
    /// The last section is optional and should be used when Psalms
    /// are offset by one specifically between translations.
    /// 
    if (decoded is Map && decoded['pairs'] is List) {
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

      // Special section for remapping Psalms by an offset
      // Could be done individually, but would be massive in the .json
      // Should only be performed when translating in one direction
      // Despite 'both', directionality is enforced later
      if (decoded['psalms_title_offsets'] is Map) {
        final p = decoded['psalms_title_offsets'] as Map<String, dynamic>;
        final ps = (p['psalms'] as List).map((e) => (e as num).toInt()).toList();
        final offset = (p['offset'] is num) ? (p['offset'] as num).toInt() : 1;
        parsed.add(_OffsetRangeRule('Psalms', 'both', ps, offset));
      }
    } else {
      throw StateError('Unrecognized verse-matching rules format in $rulePathUsed');
    }

    return VerseMatching._(parsed);
  }

  /// Returns the verse(s) that correspond to a given key. 
  List<VerseKey> matchToOther({required String fromTx, required VerseKey key}) {
    // Normalize incoming key for rule matching
    final normKey = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);

    // Handles verses that are mapped to other chapters
    for (final r in _rules) {
      if (r.applies(fromTx, normKey)) {
        final mapped = r.map(fromTx, normKey);
        if (mapped.isNotEmpty) return mapped;
      }
    }
    
    // If no mapping occurs, default to 1:1
    return [normKey];
  }

  bool existsInOther({required String fromTx, required VerseKey key}) =>
      matchToOther(fromTx: fromTx, key: key).isNotEmpty;
}
