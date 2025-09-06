// -----------------------------------------------------------------------------
// Verse matching (KJV <-> RST)
// -----------------------------------------------------------------------------
// - Supports: one_to_one, range_shift, chapter_remap, merge (many->one),
//             split (one->many), and Psalms title offsets.
// - Identity fallback: if no rule applies (and not blocked), a verse maps to
//   itself across translations.
// - Cluster IDs: verses that should share highlights/notes produce the same ID.
//   The traversal crosses real (non-identity) edges, includes identity co-
//   targets for membership, and only crosses identity when it's the *only* edge
//   (identity-only pairs like Gen 1:1).
// -----------------------------------------------------------------------------

import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

/// Simple record representing a verse location.
typedef VerseKey = ({String book, int chapter, int verse});
String _k(VerseKey k) => '${k.book}|${k.chapter}|${k.verse}';

/// -------- Canonicalization helpers --------

String _canonBook(String raw) {
  String norm(String x) =>
      x.replaceAll('.', '').replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();
  final s = norm(raw);

  const aliases = {
    'psalm': 'Psalms',
    'psalms': 'Psalms',
    'song': 'Song of Solomon',
    'songofsongs': 'Song of Solomon',
    'songs of songs': 'Song of Solomon',
    'canticles': 'Song of Solomon',
  };
  if (aliases.containsKey(s)) return aliases[s]!;

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
  return raw.trim();
}

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

String _dirFromTxs(String fromTx, String toTx) {
  final f = fromTx.trim().toLowerCase();
  final t = toTx.trim().toLowerCase();
  if (f == 'kjv' && t == 'rst') return 'EN→RU';
  if (f == 'rst' && t == 'kjv') return 'RU→EN';
  return 'both';
}

/// -------- Rule framework --------
abstract class _Rule {
  final String book;      // book name
  final String direction; // 'EN→RU', 'RU→EN', or 'both'
  _Rule(this.book, this.direction);

  bool applies(String fromTx, VerseKey k);
  List<VerseKey> map(String fromTx, VerseKey k);
}

/// 1-to-1 single verse
class _PointRule extends _Rule {
  final int fromChapter, fromVerse;
  final int toChapter, toVerse;
  _PointRule(super.book, super.direction, this.fromChapter, this.fromVerse, this.toChapter, this.toVerse);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) &&
      _canonBook(k.book) == _canonBook(book) &&
      k.chapter == fromChapter &&
      k.verse == fromVerse;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (applies(fromTx, k)) {
      return [(book: _canonBook(book), chapter: toChapter, verse: toVerse)];
    }
    // invert
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

/// 1-to-1 contiguous span (with a chapter number change allowed)
class _SpanCrossChapterRule extends _Rule {
  final int fromChapter, start, end;
  final int toChapter, toStart, toEnd;
  _SpanCrossChapterRule(super.book, super.direction, this.fromChapter, this.start, this.end,
      this.toChapter, this.toStart, this.toEnd);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) &&
      _canonBook(k.book) == _canonBook(book) &&
      k.chapter == fromChapter &&
      k.verse >= start &&
      k.verse <= end;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (applies(fromTx, k)) {
      final idx = k.verse - start; // 0-based
      final mapped = toStart + idx;
      if (mapped < toStart || mapped > toEnd) return const [];
      return [(book: _canonBook(book), chapter: toChapter, verse: mapped)];
    }
    // invert
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

/// Whole-chapter renumbering
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
    if (applies(fromTx, k)) {
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

/// Merge: many source verses -> one target verse
class _MergeRule extends _Rule {
  final int fromChapter, start, end;
  final int toChapter, toVerse;
  _MergeRule(super.book, super.direction, this.fromChapter, this.start, this.end, this.toChapter, this.toVerse);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) &&
      _canonBook(k.book) == _canonBook(book) &&
      k.chapter == fromChapter &&
      k.verse >= start && k.verse <= end;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (applies(fromTx, k)) {
      return [(book: _canonBook(book), chapter: toChapter, verse: toVerse)];
    }
    // reverse: target -> all originals (when called from opposite tx)
    final t = fromTx.trim().toLowerCase();
    final d = direction.trim().toUpperCase();
    final sameBook = _canonBook(k.book) == _canonBook(book);

    if (d == 'EN→RU' && t == 'rst' && sameBook && k.chapter == toChapter && k.verse == toVerse) {
      return [for (var v = start; v <= end; v++) (book: _canonBook(book), chapter: fromChapter, verse: v)];
    }
    if (d == 'RU→EN' && t == 'kjv' && sameBook && k.chapter == toChapter && k.verse == toVerse) {
      return [for (var v = start; v <= end; v++) (book: _canonBook(book), chapter: fromChapter, verse: v)];
    }
    return const [];
  }
}

/// Split: one source verse -> many target verses
class _SplitRule extends _Rule {
  final int fromChapter, fromVerse;
  final int toChapter, toStart, toEnd;
  _SplitRule(super.book, super.direction, this.fromChapter, this.fromVerse, this.toChapter, this.toStart, this.toEnd);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) &&
      _canonBook(k.book) == _canonBook(book) &&
      k.chapter == fromChapter &&
      k.verse == fromVerse;

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (applies(fromTx, k)) {
      return [for (var v = toStart; v <= toEnd; v++) (book: _canonBook(book), chapter: toChapter, verse: v)];
    }
    // reverse: any member of the split range -> the singleton source
    final t = fromTx.trim().toLowerCase();
    final d = direction.trim().toUpperCase();
    final sameBook = _canonBook(k.book) == _canonBook(book);

    if (d == 'EN→RU' && t == 'rst' && sameBook && k.chapter == toChapter && k.verse >= toStart && k.verse <= toEnd) {
      return [(book: _canonBook(book), chapter: fromChapter, verse: fromVerse)];
    }
    if (d == 'RU→EN' && t == 'kjv' && sameBook && k.chapter == toChapter && k.verse >= toStart && k.verse <= toEnd) {
      return [(book: _canonBook(book), chapter: fromChapter, verse: fromVerse)];
    }
    return const [];
  }
}

/// Psalms title offset (RST counts titles as v1)
class _PsalmsTitleOffsetRule extends _Rule {
  final List<int> psalms;
  final int verse1Extra;  // typically +1
  final int restOffset;   // typically +1

  _PsalmsTitleOffsetRule(super.book, super.direction, this.psalms, this.verse1Extra, this.restOffset);

  bool _isPsalms(VerseKey k) => _canonBook(k.book) == 'Psalms';
  bool _appliesChapter(VerseKey k) => psalms.contains(k.chapter);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) && _isPsalms(k) && _appliesChapter(k);

  int _forward(int v) => v == 1 ? 1 + verse1Extra : v + restOffset; // KJV -> RST
  int _backward(int v) {
    final special = 1 + verse1Extra;
    return v == special ? 1 : v - restOffset; // RST -> KJV
  }

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    final sameBook = _canonBook(k.book) == 'Psalms';
    if (!sameBook || !psalms.contains(k.chapter)) return const [];

    final t = fromTx.trim().toLowerCase();
    final d = direction.trim().toUpperCase();

    int toVerse;
    if (_dirOk(fromTx, direction)) {
      if (d == 'EN→RU') {
        toVerse = (t == 'kjv') ? _forward(k.verse) : _backward(k.verse);
      } else if (d == 'RU→EN') {
        toVerse = (t == 'rst') ? _backward(k.verse) : _forward(k.verse);
      } else {
        toVerse = (t == 'kjv') ? _forward(k.verse) : _backward(k.verse);
      }
    } else {
      if (d == 'EN→RU' && t == 'rst') {
        toVerse = _backward(k.verse);
      } else if (d == 'RU→EN' && t == 'kjv') {
        toVerse = _forward(k.verse);
      } else {
        return const [];
      }
    }

    if (toVerse < 1) return const [];
    return [(book: 'Psalms', chapter: k.chapter, verse: toVerse)];
  }
}

/// -------- Matching engine --------
class VerseMatching {
  final List<_Rule> _rules;

  VerseMatching._(this._rules);

  /// Load rules from /assets/bibles/verse_matching/verse_matching_rules.json
  static Future<VerseMatching> load() async {
    final ruleCandidates = <String>[
      'assets/bibles/verse_matching/verse_matching_rules.json',
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
          case 'merge': {
            final from = m['from'] as Map<String, dynamic>;
            final to   = m['to']   as Map<String, dynamic>;
            final dir  = _dirFromTxs(from['tx'] as String, to['tx'] as String);
            parsed.add(_MergeRule(
              book, dir,
              (from['chapter'] as num).toInt(),
              (from['start']   as num).toInt(),
              (from['end']     as num).toInt(),
              (to['chapter']   as num).toInt(),
              (to['verse']     as num).toInt(),
            ));
            break;
          }
          case 'split': {
            final from = m['from'] as Map<String, dynamic>;
            final to   = m['to']   as Map<String, dynamic>;
            final dir  = _dirFromTxs(from['tx'] as String, to['tx'] as String);
            parsed.add(_SplitRule(
              book, dir,
              (from['chapter'] as num).toInt(),
              (from['verse']   as num).toInt(),
              (to['chapter']   as num).toInt(),
              (to['start']     as num).toInt(),
              (to['end']       as num).toInt(),
            ));
            break;
          }
        }
      }

      // Psalms title offsets (optional)
      if (decoded['psalms_title_offsets'] is Map) {
        final p = decoded['psalms_title_offsets'] as Map<String, dynamic>;
        final fromTx = (p['from_tx'] as String).trim();
        final toTx   = (p['to_tx']   as String).trim();
        final dir    = _dirFromTxs(fromTx, toTx);
        final ps     = (p['psalms'] as List).map((e) => (e as num).toInt()).toList();
        final v1x    = (p['verse1_extra'] is num) ? (p['verse1_extra'] as num).toInt() : 1;
        final rest   = (p['rest_offset']  is num) ? (p['rest_offset']  as num).toInt() : 1;

        parsed.add(_PsalmsTitleOffsetRule('Psalms', dir, ps, v1x, rest));
      }
    } else {
      throw StateError('Unrecognized verse-matching rules format in $rulePathUsed');
    }

    return VerseMatching._(parsed);
  }

  /// Core mapping: KJV<->RST according to rules, else identity fallback (unless blocked).
  List<VerseKey> matchToOther({required String fromTx, required VerseKey key}) {
    final nk = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    bool blockIdentity = false;

    for (final r in _rules) {
      final mapped = r.map(fromTx, nk);
      if (mapped.isNotEmpty) return mapped;

      // Title verse in Psalms has no counterpart in the other tx.
      if (r is _PsalmsTitleOffsetRule &&
          nk.book == 'Psalms' &&
          nk.verse == 1 &&
          r.psalms.contains(nk.chapter)) {
        blockIdentity = true;
      }
    }

    return blockIdentity ? const [] : [nk];
  }

  /// True if *any* counterpart exists (identity counts). Use this in the UI to decide shared behavior.
  bool existsInOther({required String fromTx, required VerseKey key}) {
    return matchToOther(fromTx: fromTx, key: key).isNotEmpty;
  }

  /// Deterministic cluster id for all equivalents of (tx, key).
  /// Traversal rules:
  /// - Follow non-identity edges (actual remaps) normally.
  /// - If the only edge is identity, cross it so identity-only pairs share.
  /// - If non-identity edges exist (e.g., split), also include the identity
  ///   co-target in the *membership* (but do not expand from it) so
  ///   KJV 3:17 <-> RST 3:17 & 3:18 stay together without pulling KJV 3:18.
  String clusterId(String tx, VerseKey key) {
    final canonKey = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    final start = (tx.trim().toLowerCase(), canonKey);

    final seen = <(String, VerseKey)>{};
    final q = <(String, VerseKey)>[start];

    while (q.isNotEmpty) {
      final cur = q.removeLast();
      if (!seen.add(cur)) continue;

      final curTx = cur.$1;
      final otherTx = (curTx == 'kjv') ? 'rst' : 'kjv';

      final targets = matchToOther(fromTx: curTx, key: cur.$2);

      bool hasNonIdentity = false;
      for (final m in targets) {
        final isIdentity =
            _canonBook(m.book) == _canonBook(cur.$2.book) &&
            m.chapter == cur.$2.chapter &&
            m.verse == cur.$2.verse;
        if (!isIdentity) {
          hasNonIdentity = true;
          q.add((otherTx, m));           // traverse real edges
        }
      }

      if (!hasNonIdentity) {
        // identity-only: cross so the opposite side can reveal merges/splits.
        for (final m in targets) {
          q.add((otherTx, m));           // identity here
        }
      } else {
        // include identity co-target for membership (do not expand from it)
        for (final m in targets) {
          final isIdentity =
              _canonBook(m.book) == _canonBook(cur.$2.book) &&
              m.chapter == cur.$2.chapter &&
              m.verse == cur.$2.verse;
          if (isIdentity) seen.add((otherTx, m));
        }
      }
    }

    int txOrder(String t) => t == 'kjv' ? 0 : 1;

    final list = seen.toList();
    list.sort((a, b) {
      final c = txOrder(a.$1).compareTo(txOrder(b.$1));
      if (c != 0) return c;
      final ak = a.$2, bk = b.$2;
      final bc = _canonBook(ak.book).compareTo(_canonBook(bk.book));
      if (bc != 0) return bc;
      final cc = ak.chapter.compareTo(bk.chapter);
      if (cc != 0) return cc;
      return ak.verse.compareTo(bk.verse);
    });

    final (repTx, rep) = list.first;
    return '${repTx}|${_canonBook(rep.book)}|${rep.chapter}|${rep.verse}';
  }
}
