// features/bible/data/verse_matching.dart
// -----------------------------------------------------------------------------
// Maps verse numbers between translations (KJV <-> RST).
// When a verse maps across, notes/highlights should transfer.
// Relies on /assets/bibles/verse_matching/verse_matching_rules.json
//
// This version:
//  • Supports: one_to_one, range_shift, chapter_remap, merge (many→one),
//              split (one→many), and Psalms title offsets.
//  • Identity fallback: if no rule applies (and not blocked), a verse maps to
//    itself across translations.
//  • Cluster IDs: traverse only rule edges; include identity co-target in the
//    cluster membership (but don’t expand from it); cross identity only when
//    there are no rule edges on either side (identity-only pairs like Gen 1:1).
//    This prevents bridges like KJV 3:18 → RST 3:18 → KJV 3:17.
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

// Determines whether a rule is allowed to apply from the given tx.
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

// Normalized label for direction given from/to tx tags.
String _dirFromTxs(String fromTx, String toTx) {
  final f = fromTx.trim().toLowerCase();
  final t = toTx.trim().toLowerCase();
  if (f == 'kjv' && t == 'rst') return 'EN→RU';
  if (f == 'rst' && t == 'kjv') return 'RU→EN';
  return 'both';
}

/// -------- Rule framework --------

abstract class _Rule {
  final String book;
  final String direction;
  _Rule(this.book, this.direction);

  bool applies(String fromTx, VerseKey k);
  List<VerseKey> map(String fromTx, VerseKey k);
}

/// One-to-one single verse.
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
    // invert for opposite tx:
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

/// One-to-one range (may cross chapters).
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

/// Whole-chapter renumbering.
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

/// Merge: many source verses -> one target verse.
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
    // reverse: single target -> all originals (when called from opposite tx)
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

/// Split: one source verse -> many target verses.
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
    // reverse: any member of the split range -> singleton source
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

/// Psalms title offset (RST has an extra title verse).
class _PsalmsTitleOffsetRule extends _Rule {
  final List<int> psalms;
  final int verse1Extra;  // extra added to verse 1
  final int restOffset;   // offset for verses >= 2

  _PsalmsTitleOffsetRule(super.book, super.direction, this.psalms, this.verse1Extra, this.restOffset);

  bool _isPsalms(VerseKey k) => _canonBook(k.book) == 'Psalms';
  bool _appliesChapter(VerseKey k) => psalms.contains(k.chapter);

  @override
  bool applies(String fromTx, VerseKey k) =>
      _dirOk(fromTx, direction) && _isPsalms(k) && _appliesChapter(k);

  int _forward(int v) => v == 1 ? 1 + verse1Extra : v + restOffset;
  int _backward(int v) {
    final special = 1 + verse1Extra;
    return v == special ? 1 : v - restOffset;
  }

  @override
  List<VerseKey> map(String fromTx, VerseKey k) {
    if (!_isPsalms(k) || !psalms.contains(k.chapter)) return const [];

    final t = fromTx.trim().toLowerCase();
    final d = direction.trim().toUpperCase();
    int toVerse;

    // Semantics: forward = KJV -> RST (adds title), backward = RST -> KJV.
    if (_dirOk(fromTx, direction)) {
      if (d == 'EN→RU') {
        toVerse = (t == 'kjv') ? _forward(k.verse) : _backward(k.verse);
      } else if (d == 'RU→EN') {
        toVerse = (t == 'rst') ? _backward(k.verse) : _forward(k.verse);
      } else {
        toVerse = (t == 'kjv') ? _forward(k.verse) : _backward(k.verse);
      }
    } else {
      // explicitly invert when asked from the opposite side
      if (d == 'EN→RU' && t == 'rst') {
        toVerse = _backward(k.verse); // RST -> KJV
      } else if (d == 'RU→EN' && t == 'kjv') {
        toVerse = _forward(k.verse);  // KJV <- RST
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

  /// Load mapping rules from the asset.
  static Future<VerseMatching> load() async {
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

    return VerseMatching._(parsed);
  }

  /// Map a verse to its equivalent(s) in the other translation.
  List<VerseKey> matchToOther({required String fromTx, required VerseKey key}) {
    final nk = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    bool blockIdentity = false;

    for (final r in _rules) {
      final mapped = r.map(fromTx, nk);
      if (mapped.isNotEmpty) return mapped;

      // Block identity fallback for Psalms title verses (no counterpart).
      if (r is _PsalmsTitleOffsetRule &&
          nk.book == 'Psalms' &&
          nk.verse == 1 &&
          r.psalms.contains(nk.chapter)) {
        blockIdentity = true;
      }
    }

    // Identity mapping by default unless explicitly blocked (e.g., Psalms titles).
    return blockIdentity ? const [] : [nk];
  }

  List<VerseKey> matchToOtherRuleOnly({required String fromTx, required VerseKey key}) {
    final nk = (book: _canonBook(key.book), chapter: key.chapter, verse: key.verse);
    return _ruleEdgesOnly(fromTx, nk);
  }

  /// Does this verse exist in the other translation in any form?
  /// NOTE: We count identities as "exists" so 1:1 verses share highlights.
  bool existsInOther({required String fromTx, required VerseKey key}) {
    final mapped = matchToOther(fromTx: fromTx, key: key);
    return mapped.isNotEmpty;
  }

  /// ---- Helpers for cluster traversal ----
  /// Return *rule-based* neighbors only (no identity fallback).
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

    // --- Psalms anti-bridging guard ---
    // If any cross-chapter edge exists for this source,
    // drop same-chapter edges (title-offset hops) to prevent bridging.
    var neighbors = out.values.toList();

    // 1) Drop identity edges entirely. Identity is handled as a fallback elsewhere.
    neighbors = neighbors.where((mk) =>
      !(_canonBook(mk.book) == _canonBook(nk.book) &&
        mk.chapter == nk.chapter &&
        mk.verse == nk.verse)
    ).toList();

    // 2) Psalms anti-bridging: if any cross-chapter edge exists, drop same-chapter edges.
    if (_canonBook(nk.book) == 'Psalms') {
      final hasCrossChapter = neighbors.any((mk) => mk.chapter != nk.chapter);
      if (hasCrossChapter) {
        neighbors = neighbors.where((mk) => mk.chapter != nk.chapter).toList();
      }
    }
    return neighbors;
  }

  bool _psalmsTitleBlocked(VerseKey nk) {
    // Block identity crossing for ALL Psalms verse 1 (regardless of JSON).
    return _canonBook(nk.book) == 'Psalms' && nk.verse == 1;
  }

  /// Deterministic cluster id for all equivalents of (tx, key).
  /// Cluster contains ONLY the verses that should share state, e.g.:
  ///   KJV Eph 3:17 <-> {RST 3:17, RST 3:18}   (but NOT KJV 3:18)
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
      final _rt = _ruleEdgesOnly(curTx, curKey);

      // --- Psalms anti-bridging guard (per-expansion) ---
      // If any cross-chapter edge exists for this source, drop same-chapter edges
      // for THIS expansion step. Prevents hops like RST 58:2 → KJV 58:1 sneaking in.
      final ruleTargets = (_canonBook(curKey.book) == 'Psalms')
          ? (_rt.any((mk) => mk.chapter != curKey.chapter)
              ? _rt.where((mk) => mk.chapter != curKey.chapter).toList()
              : _rt)
          : _rt;

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
        // When any non-identity rule edges exist, do NOT add identity co-targets.
      } else {
        // Only identity neighbor.
        if (!_psalmsTitleBlocked(curKey)) {
          // Include identity membership for true 1:1 cases (e.g., Gen 1:1).
          seen.add((otherTx, curKey));  // membership only, no traversal yet

          final otherHasRules = _ruleEdgesOnly(otherTx, curKey).isNotEmpty;
          if (!otherHasRules) {
            q.add((otherTx, curKey)); // safe identity crossing for pure 1:1 cases
          }
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
