// -----------------------------------------------------------------------------
// Contains rules for handling the mapping of verses between different
// translations of the bible. This code was designed with KJV and RST mapping
// in mind, but these rules should work for mapping different bibles. This has
// only been tested for mapping between two bibles though. 
// 
// Rules stored here: assets/bibles/verse_matching/verse_matching_rules.json
// Currently modeled after this: https://www.ph4.org/btraduk_ruennum.php
//
// Supported the following rule types
// - one_to_one          : maps one verse to another, can be across chapters
// - range_shift         : shifts verse ranges or whole chapters
// - chapter_remap       : keep verse numbering but change chapters
// - merge               : many verses map to one verse
// - split               : one verse maps to many verses
//    - ((Merge and Split can overlap and create a cluster. EX: 
//        For Eph, KJV 3:17 maps to RST 3:17 and half of 3:18, and 
//        KJV 3:18 maps to the other half of RST 3:18. Interacting
//        with any of these individually applies to all of them.))
//
// Identity fallback
// - If no explicit mapping rule is found, maps 1:1 to the verse with the
//   same numbering. 
// -----------------------------------------------------------------------------

import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'books.dart';

/// Keys for locating a verse
typedef VerseKey = ({String book, int chapter, int verse});

/// -------- Canonicalization helpers --------
/// Standardize formatting on book names. 
/// Trims extra characters and makes all characters lowercase. 
/// Also accepts some common aliases.
String _canonBook(String raw) {
  return Books.instance.canonEnglishName(raw);
}

/// Restricts rules to only apply in certain directions
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

/// Standardizes the directional labeling.
String _dirFromTxs(String fromTx, String toTx) {
  final f = fromTx.trim().toLowerCase();
  final t = toTx.trim().toLowerCase();
  if (f == 'kjv' && t == 'rst') return 'EN→RU';
  if (f == 'rst' && t == 'kjv') return 'RU→EN';
  return 'both';
}

/// -------- Rule framework --------

/// Base template for rules.
/// At minimum, rules have a book and a direction. 
abstract class _Rule {
  final String book;
  final String direction;
  _Rule(this.book, this.direction);

  bool applies(String fromTx, VerseKey k);
  List<VerseKey> map(String fromTx, VerseKey k);
}

/// One-to-one verse mapping.
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
    // Allow mapping from the opposite side.
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

/// Range shift
/// Falls back to this if not trying to offset a whole chapter
class _SpanCrossChapterRule extends _Rule {
  final int fromChapter, start, end;
  final int toChapter, toStart, toEnd;
  _SpanCrossChapterRule(
    super.book, super.direction,
    this.fromChapter, this.start, this.end,
    this.toChapter, this.toStart, this.toEnd,
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
    if (applies(fromTx, k)) {
      final idx = k.verse - start; // 0-based
      final mapped = toStart + idx;
      if (mapped < toStart || mapped > toEnd) return const [];
      return [(book: _canonBook(book), chapter: toChapter, verse: mapped)];
    }
    // Inversion from the opposite side.
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

/// Chapter Remap
/// Moves a whole chapter to another chapter number, maintains verse numbering
/// TODO: Redundant with range_shift, potentially remove. Simpler interface though. Unused in current mapping ruleset.
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
    // Inversion from the opposite side.
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

/// Many-to-one mapping
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
    // Reverse: from the target side, return all originals.
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

/// One-to-many mapping.
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
    // Reverse: any member maps back to the singleton source.
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

/// ---------------------------------------------------------------------------
/// Range Shift
/// 
/// Adds functionality to range shifting to support whole chapters.
/// Falls back to the previously set up range shifting rules if not
/// doing whole chapter. Replaces the previous psalm shifting rule. 
/// 
/// - to
///   "Chapter Delta" indicates how the chapter's number should be offset. 
///   "Verse Offset" indicates by how much should a verse be offset. 
/// - from
///   Setting "end" to -1 indicates that it applies through the last verse.
/// ---------------------------------------------------------------------------
class _SpanOffsetRule extends _Rule {
  final int fromChapter, start, end;     // end == -1 => to end of chapter
  final int chapterDelta, verseOffset;   // e.g., -1:+1

  _SpanOffsetRule(
    super.book,
    super.direction,
    this.fromChapter,
    this.start,
    this.end,
    this.chapterDelta,
    this.verseOffset,
  );

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) &&
      _canonBook(k.book) == _canonBook(book) &&
      k.chapter == fromChapter &&
      k.verse >= start &&
      (end == -1 || k.verse <= end);

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    // Forward mapping: FROM side → TO side
    if (applies(fromTx, k)) {
      final toChap = fromChapter + chapterDelta;
      final toVerse = k.verse + verseOffset;
      if (toVerse < 1) return const [];
      return [(book: _canonBook(book), chapter: toChap, verse: toVerse)];
    }

    // Reverse mapping: TO side → FROM side (implicit inversion)
    final t = fromTx.trim().toLowerCase();
    final d = direction.trim().toUpperCase();
    final isOpposite =
        (d == 'EN→RU' && t == 'rst') || (d == 'RU→EN' && t == 'kjv');
    if (isOpposite && _canonBook(k.book) == _canonBook(book)) {
      final toChap = fromChapter + chapterDelta;
      if (k.chapter == toChap) {
        final srcVerse = k.verse - verseOffset;
        if (srcVerse < 1) return const [];
        // Validate source verse is within the declared source range.
        final inRange = srcVerse >= start && (end == -1 || srcVerse <= end);
        if (inRange) {
          return [(book: _canonBook(book), chapter: fromChapter, verse: srcVerse)];
        }
      }
    }

    return const [];
  }
}

/// -------- Matching engine --------

/// Parses the rules from the JSON file 
class VerseMatching {
  final List<_Rule> _rules;
  VerseMatching._(this._rules);

  static Future<VerseMatching> load() async {
    await Books.instance.ensureLoaded();

    const path = 'assets/bibles/verse_matching/verse_matching_rules.json';
    dynamic decoded;
    try {
      final s = await rootBundle.loadString(path);
      decoded = jsonDecode(s);
    } catch (_) {
      throw StateError('Could not load verse-matching rules from: $path');
    }

    final parsed = <_Rule>[];

    if (decoded is! Map || decoded['pairs'] is! List) {
      throw StateError('Unrecognized verse-matching rules format in $path');
    }

    // Pairs
    for (final p in (decoded['pairs'] as List)) {
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

          // -------------------------------------------------------------------
          // If present, use the new _SpanOffsetRule; otherwise, fall back to
          // the original cross-chapter form.
          // -------------------------------------------------------------------
          final hasOffsetForm = to.containsKey('chapter_delta') && to.containsKey('verse_offset');
          if (hasOffsetForm) {
            parsed.add(_SpanOffsetRule(
              book, dir,
              (from['chapter'] as num).toInt(),
              (from['start'] as num).toInt(),
              ((from['end'] as num?) ?? -1).toInt(), // allow sentinel -1 (= to end)
              (to['chapter_delta'] as num).toInt(),
              (to['verse_offset']  as num).toInt(),
            ));
          } else {
            parsed.add(_SpanCrossChapterRule(
              book, dir,
              (from['chapter'] as num).toInt(),
              (from['start'] as num).toInt(),
              (from['end']   as num).toInt(),
              (to['chapter'] as num).toInt(),
              (to['start']   as num).toInt(),
              (to['end']     as num).toInt(),
            ));
          }
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

    return VerseMatching._(parsed);
  }

  /// Maps verses to their pairs according to rules
  /// If no rules are present, falls back to same book/chapter/verse
  List<VerseKey> matchToOther({required String fromTx, required VerseKey key}) {
    final nk = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    bool blockIdentity = false;

    for (final r in _rules) {
      final mapped = r.map(fromTx, nk);
      if (mapped.isNotEmpty) return mapped;
    }

    return blockIdentity ? const [] : [nk];
  }

  /// Rule-only mapping (no identity fallback). Useful for cluster traversal.
  List<VerseKey> matchToOtherRuleOnly({required String fromTx, required VerseKey key}) {
    final nk = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    return _ruleEdgesOnly(fromTx, nk);
  }

  /// Whether this verse exists in the other translation in *any* form.
  /// Identity counts as “exists” so 1:1 verses share highlights.
  bool existsInOther({required String fromTx, required VerseKey key}) {
    final mapped = matchToOther(fromTx: fromTx, key: key);
    return mapped.isNotEmpty;
  }

  /// ---- Helpers for cluster traversal ----

  /// Helps generate clusters and prevent accidental rule overlaps. 
  List<VerseKey> _ruleEdgesOnly(String fromTx, VerseKey key) {
    final nk = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    final out = <String, VerseKey>{}; // de-dup via canonical key
    for (final r in _rules) {
      final mapped = r.map(fromTx, nk); // rule-only; no identity fallback
      for (final m in mapped) {
        final mk = (book: _canonBook(m.book), chapter: m.chapter, verse: m.verse);
        out['${mk.book}|${mk.chapter}|${mk.verse}'] = mk;
      }
    }

    var neighbors = out.values.toList();

    neighbors = neighbors.where((mk) =>
      !(_canonBook(mk.book) == _canonBook(nk.book) &&
        mk.chapter == nk.chapter &&
        mk.verse == nk.verse)
    ).toList();

    if (_canonBook(nk.book) == 'Psalms') {
      final hasCrossChapter = neighbors.any((mk) => mk.chapter != nk.chapter);
      if (hasCrossChapter) {
        neighbors = neighbors.where((mk) => mk.chapter != nk.chapter).toList();
      }
    }
    return neighbors;
  }

  /// Creates identification for clusters of verses.
  /// Allows for clusters to share highlights/notes.
  /// Designed to avoid accidental mapping due to psalm rules. 
  ///
  /// Traversal rules:
  /// - Expand via *rule edges only*; if rule edges exist, include the identity
  ///   co-target in membership (for symmetry) but do not expand from it.
  /// - If no rule edges exist on either side, cross identity (identity-only pairs).
  /// - Psalms: never include/cross identity during expansion (prevents bridges).
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
      final curKey = (book: _canonBook(cur.$2.book), chapter: cur.$2.chapter, verse: cur.$2.verse);

      // RULE EDGES (primary traversal)
      final rt = _ruleEdgesOnly(curTx, curKey);

      // --- Psalms anti-bridging guard (per-expansion) ---
      // If any cross-chapter edge exists for this source, drop same-chapter edges
      // for THIS expansion step. Prevents hops like RST 58:2 → KJV 58:1 sneaking in.
      final ruleTargets = (_canonBook(curKey.book) == 'Psalms')
          ? (rt.any((mk) => mk.chapter != curKey.chapter)
              ? rt.where((mk) => mk.chapter != curKey.chapter).toList()
              : rt)
          : rt;

      // Enqueue non-identity rule edges. (Identity co-target handled below)
      bool hasNonIdentity = false;
      for (final m in ruleTargets) {
        final isIdentity =
            _canonBook(m.book) == _canonBook(curKey.book) &&
            m.chapter == curKey.chapter &&
            m.verse == curKey.verse;
        if (!isIdentity) {
          hasNonIdentity = true;
          q.add((otherTx, m));
        }
      }

      if (hasNonIdentity) {
        // When rule edges exist:
        // - Outside Psalms: include identity co-targets in MEMBERSHIP (for symmetric clusters).
        // - In Psalms: never add identity co-targets.
        if (_canonBook(curKey.book) != 'Psalms') {
          for (final m in ruleTargets) {
            final isIdentity =
                _canonBook(m.book) == _canonBook(curKey.book) &&
                m.chapter == curKey.chapter &&
                m.verse == curKey.verse;
            if (isIdentity) {
              seen.add((otherTx, m)); // membership only
            }
          }
        }
      } else {
        // Only identity neighbor.
        if (_canonBook(curKey.book) != 'Psalms') {
          // Outside Psalms: include and traverse identity so overlaps (e.g., Eph 3:17) cluster fully.
          seen.add((otherTx, curKey));   // membership
          q.add((otherTx, curKey));      // traverse
        } else {
          // In Psalms: never include/cross identity (prevents KJV 59:1 → KJV 58:2).
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
    return '$repTx|${_canonBook(rep.book)}|${rep.chapter}|${rep.verse}';
  }

  // Mirrors clusterId() traversal exactly but returns members instead of an ID.
  List<(String, VerseKey)> clusterMembers({required String tx, required VerseKey key}) {
    final canonKey = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    final start = (tx.trim().toLowerCase(), canonKey);

    final seen = <(String, VerseKey)>{};
    final q = <(String, VerseKey)>[start];

    while (q.isNotEmpty) {
      final cur = q.removeLast();
      if (!seen.add(cur)) continue;

      final curTx = cur.$1;
      final otherTx = (curTx == 'kjv') ? 'rst' : 'kjv';
      final curKey = (book: _canonBook(cur.$2.book), chapter: cur.$2.chapter, verse: cur.$2.verse);

      // RULE EDGES (same logic as in clusterId)
      final rt = _ruleEdgesOnly(curTx, curKey);

      // Psalms anti-bridging guard (per-expansion)
      final ruleTargets = (_canonBook(curKey.book) == 'Psalms')
          ? (rt.any((mk) => mk.chapter != curKey.chapter)
              ? rt.where((mk) => mk.chapter != curKey.chapter).toList()
              : rt)
          : rt;

      bool hasNonIdentity = false;
      for (final m in ruleTargets) {
        final isIdentity =
            _canonBook(m.book) == _canonBook(curKey.book) &&
            m.chapter == curKey.chapter &&
            m.verse == curKey.verse;
        if (!isIdentity) {
          hasNonIdentity = true;
          q.add((otherTx, m));
        }
      }

      if (hasNonIdentity) {
        // Outside Psalms: include identity co-targets in membership (no enqueue)
        if (_canonBook(curKey.book) != 'Psalms') {
          for (final m in ruleTargets) {
            final isIdentity =
                _canonBook(m.book) == _canonBook(curKey.book) &&
                m.chapter == curKey.chapter &&
                m.verse == curKey.verse;
            if (isIdentity) {
              seen.add((otherTx, m));
            }
          }
        }
      } else {
        // Identity-only neighbor case
        if (_canonBook(curKey.book) != 'Psalms') {
          seen.add((otherTx, curKey));  // membership
          q.add((otherTx, curKey));     // traverse
        }
      }
    }

    return seen.toList();
  }

  // TODO: NEW — convenience: list same-translation siblings in the cluster (excludes the seed).
  List<VerseKey> sameTxSiblings({required String tx, required VerseKey key}) {
    final all = clusterMembers(tx: tx, key: key);
    final t = tx.trim().toLowerCase();
    final canon = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    return [
      for (final e in all)
        if (e.$1 == t &&
            !(_canonBook(e.$2.book) == canon.book &&
              e.$2.chapter == canon.chapter &&
              e.$2.verse == canon.verse))
          (book: _canonBook(e.$2.book), chapter: e.$2.chapter, verse: e.$2.verse)
    ];
  }
}
