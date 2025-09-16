// -----------------------------------------------------------------------------
// Normalizes various possible Bible JSON shapes into a single flat
// list of maps used by the app. Also resolves flexible book naming
// (ids, names, common aliases) to canonical book names.
// -----------------------------------------------------------------------------

import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/foundation.dart' show FlutterError;
import 'books.dart';

/// Converts values to int.
int _toInt(dynamic v) {
  if (v is int) return v;
  return int.parse(v.toString());
}

/// Converts values to String.
String _toText(dynamic vText, dynamic vAlt) =>
    (vText ?? vAlt ?? '').toString();

/// Reads verse number from either `verse` or `v` field.
int _toVerse(dynamic vVerse, dynamic vAlt) =>
    _toInt(vVerse ?? vAlt);

class ElishaJsonSource {
  // In-memory cache: translation|bookKey -> rows
  final Map<String, List<Map<String, dynamic>>> _bookCache = {};
  // In-memory cache for chapter runs: translation|bookKey -> { chapter:int -> [ {type,text} ] }
  final Map<String, Map<int, List<Map<String, String>>>> _bookRunsCache = {};
  // In-memory cache for verse block styles: translation|bookKey -> { chapter:int -> { verse:int -> {type,level,break:true} } }
  final Map<String, Map<int, Map<int, Map<String, dynamic>>>> _bookBlocksCache = {};

  Future<List<Map<String, dynamic>>> load(String translation) async {
    await Books.instance.ensureLoaded();
    final candidates = <String>[
      'assets/bibles/translations/$translation.json',          // JSON
    ];

    Object? decoded;
    FormatException? lastErr;

    for (final path in candidates) {
      try {
        final raw = await rootBundle.loadString(path);
        decoded = jsonDecode(raw);
        final rows = _normalize(decoded);
        return rows;
      } on FlutterError {
        continue; // asset not found; try next
      } on FormatException catch (e) {
        lastErr = e; // bad JSON/shape; try next
        continue;
      }
    }

    try {
      final rows = await _loadFromUsfmAssets(translation);
      if (rows.isNotEmpty) return rows;
    } catch (_) {}

    throw lastErr ??
        FlutterError('Bible JSON/USFM not found. Tried: ${candidates.join(', ')} and USFM folder for "$translation"');
  }

  // Preferred: only load the specific book for the requested translation
  Future<List<Map<String, dynamic>>> loadFor(String translation, String bookNameOrKey) async {
    await Books.instance.ensureLoaded();
    final key = Books.instance.keyFor(bookNameOrKey) ?? bookNameOrKey.toUpperCase();
    final cacheKey = '$translation|$key';
    final cached = _bookCache[cacheKey];
    if (cached != null) return cached;

    // Try USFM first (fast when limited to one book), fallback to JSON filter
    final rows = await _loadUsfmForBook(translation, key);
    if (rows.isNotEmpty) {
      _bookCache[cacheKey] = rows;
      return rows;
    }

    // Fallback: full JSON then filter
    final all = await load(translation);
    final canonical = Books.instance.englishByKey(key);
    final filtered = all.where((r) => (r['book'] as String).toLowerCase() == canonical.toLowerCase()).toList();
    _bookCache[cacheKey] = filtered;
    return filtered;
  }

  // Returns per-chapter runs like headings/section titles: { chapter -> [ {type,text} ] }
  Future<Map<int, List<Map<String, String>>>> loadRunsFor(String translation, String bookNameOrKey) async {
    await Books.instance.ensureLoaded();
    final key = Books.instance.keyFor(bookNameOrKey) ?? bookNameOrKey.toUpperCase();
    final cacheKey = '$translation|$key';
    final cached = _bookRunsCache[cacheKey];
    if (cached != null) return cached;

    // Trigger USFM parse which also fills runs cache
    await _loadUsfmForBook(translation, key);
    return _bookRunsCache[cacheKey] ?? <int, List<Map<String, String>>>{};
  }

  // Returns per-chapter verse block styles: { chapter -> { verse -> {type, level, break} } }
  Future<Map<int, Map<int, Map<String, dynamic>>>> loadVerseBlocksFor(String translation, String bookNameOrKey) async {
    await Books.instance.ensureLoaded();
    final key = Books.instance.keyFor(bookNameOrKey) ?? bookNameOrKey.toUpperCase();
    final cacheKey = '$translation|$key';
    final cached = _bookBlocksCache[cacheKey];
    if (cached != null) return cached;
    await _loadUsfmForBook(translation, key);
    return _bookBlocksCache[cacheKey] ?? <int, Map<int, Map<String, dynamic>>>{};
  }

  List<Map<String, dynamic>> _normalize(Object? decoded) {
    if (decoded is List && (decoded.isEmpty || decoded.first is Map)) {
      return decoded.cast<Map>().map<Map<String, dynamic>>((m) {
        final bookRaw = m['book'] ?? m['b'];
        final book = (bookRaw is int)
            ? Books.instance.englishByOrder(bookRaw)
            : Books.instance.canonEnglishName(bookRaw.toString());
        final chapter = _toInt(m['chapter'] ?? m['c']);
        final verse = _toVerse(m['verse'], m['v']);
        final text  = _toText(m['text'], m['t']);
        return {'book': book, 'chapter': chapter, 'verse': verse, 'text': text};
      }).toList();
    }

    if (decoded is List && decoded.isNotEmpty && decoded.first is List) {
      return decoded.map<Map<String, dynamic>>((row) {
        final r = row as List;
        if (r.length < 5) {
          throw const FormatException('Tuple row must have at least 5 elements');
        }
        final bookRaw = r[1];
        final book = (bookRaw is int)
            ? Books.instance.englishByOrder(bookRaw)
            : Books.instance.canonEnglishName(bookRaw.toString());
        final chapter = _toInt(r[2]);
        final verse = _toInt(r[3]);
        final text = r[4].toString();
        return {'book': book, 'chapter': chapter, 'verse': verse, 'text': text};
      }).toList();
    }
    throw const FormatException('Unrecognized Bible JSON shape');
  }

  // ----- USFM support (assets manifest enumeration) -----

  Future<List<Map<String, dynamic>>> _loadFromUsfmAssets(String translation) async {
    final manifestRaw = await rootBundle.loadString('AssetManifest.json');
    final manifest = jsonDecode(manifestRaw) as Map<String, dynamic>;
    final prefix = 'assets/bibles/translations/$translation/';

    final usfmPaths = manifest.keys
        .where((p) => p.startsWith(prefix) && p.toLowerCase().endsWith('.usfm'))
        .toList()
      ..sort();

    final rows = <Map<String, dynamic>>[];
    for (final p in usfmPaths) {
      final content = await rootBundle.loadString(p);
      final bookKey = _extractUsfmBookKey(content) ?? _inferBookKeyFromPath(p);
      if (bookKey == null) continue;
      rows.addAll(_parseUsfm(content, bookKey));
    }
    return rows;
  }

  Future<List<Map<String, dynamic>>> _loadUsfmForBook(String translation, String bookKey) async {
    final manifestRaw = await rootBundle.loadString('AssetManifest.json');
    final manifest = jsonDecode(manifestRaw) as Map<String, dynamic>;
    final prefix = 'assets/bibles/translations/$translation/';

    final candidates = manifest.keys
        .where((p) => p.startsWith(prefix) && p.toLowerCase().endsWith('.usfm'))
        .toList()
      ..sort();

    // Quick filename match
    final byName = candidates.where((p) => p.toUpperCase().contains('-$bookKey') || p.toUpperCase().endsWith('/$bookKey.usfm')).toList();
    if (byName.isNotEmpty) {
      // Initialize runs map for cache
      final runsOut = <int, List<Map<String, String>>>{};
      final blocksOut = <int, Map<int, Map<String, dynamic>>>{};
      final rows = <Map<String, dynamic>>[];
      for (final p in byName) {
        final content = await rootBundle.loadString(p);
        rows.addAll(_parseUsfm(content, bookKey, runsOut, blocksOut));
      }
      _bookRunsCache['$translation|$bookKey'] = runsOut;
      _bookBlocksCache['$translation|$bookKey'] = blocksOut;
      return rows;
    }

    // Fallback: scan files until we find matching \id
    for (final p in candidates) {
      final content = await rootBundle.loadString(p);
      final idKey = _extractUsfmBookKey(content);
      if (idKey == bookKey) {
        final runsOut = <int, List<Map<String, String>>>{};
        final blocksOut = <int, Map<int, Map<String, dynamic>>>{};
        final rows = _parseUsfm(content, bookKey, runsOut, blocksOut);
        _bookRunsCache['$translation|$bookKey'] = runsOut;
        _bookBlocksCache['$translation|$bookKey'] = blocksOut;
        return rows;
      }
    }
    return <Map<String, dynamic>>[];
  }

  String? _extractUsfmBookKey(String src) {
    for (final raw in const LineSplitter().convert(src)) {
      final line = raw.trim();
      if (line.isEmpty) continue;
      if (line.startsWith(r'\id ')) {
        final parts = line.substring(4).trim().split(RegExp(r'\s+'));
        if (parts.isNotEmpty) return parts.first.toUpperCase();
        break;
      }
      if (line.startsWith(r'\c ') || line.startsWith(r'\v ')) break;
    }
    return null;
  }

  String? _inferBookKeyFromPath(String path) {
    final file = path.split('/').last;
    final name = file.split('.').first; // e.g., 02-GENeng-kjv2006
    final parts = name.split('-');
    if (parts.length >= 2) {
      final maybeKey = parts[1].substring(0, 3).toUpperCase();
      if (maybeKey.length == 3) return maybeKey;
    }
    if (name.length >= 3) {
      final maybeKey = name.substring(0, 3).toUpperCase();
      return maybeKey;
    }
    return null;
  }

  // Strip/unwrap inline USFM markers while keeping human-readable text
  String _cleanInline(String s) {
    // Keep the word before the first pipe in \w and \+w, drop attributes
    s = s.replaceAllMapped(RegExp(r'\\\+?w\s+([^|\\]+?)(?:\|[^\\]*?)?\\\+?w\*'), (m) => m[1] ?? '');

    // Convert emphasis tags to lightweight markers our renderer understands
    String wrap(String tag, String text) => '⟦'+tag+'⟧'+text+'⟦/'+tag+'⟧';
    Map<String, String> tagMap = {
      'add': 'it',
      'it': 'it',
      'bd': 'bd',
      'bdit': 'bdit',
      'wj': 'wj',
      'nd': 'sc',
      'sc': 'sc',
      'qt': 'it', // quote inline -> italics
    };
    for (final e in tagMap.entries) {
      final src = e.key;
      final dst = e.value;
      s = s.replaceAllMapped(RegExp('\\\\'+src+ r'\s+([\s\S]*?)\\\\'+src+ r'\*', dotAll: true), (m) => wrap(dst, m[1] ?? ''));
    }

    // Remove any stray opening markers like \add that did not have a closing tag
    s = s.replaceAll(RegExp(r'\\(add|nd|wj|it|bdit|bd|em|sc|qt)\b\s+'), '');

    // Remove footnotes and cross references entirely
    s = s.replaceAll(RegExp(r'\\f\s[\s\S]*?\\f\*', dotAll: true), '');
    s = s.replaceAll(RegExp(r'\\x\s[\s\S]*?\\x\*', dotAll: true), '');

    // Remove any remaining closing markers like \w*
    s = s.replaceAll(RegExp(r'\\[a-zA-Z0-9]+\*'), '');

    // Remove pilcrow if present in text
    s = s.replaceAll('¶', '');

    // Normalize punctuation spacing: remove spaces before , . ; : ? !
    s = s.replaceAll(RegExp(r'\s+([,.;:?!])'), r'$1');
    // Ensure a space after punctuation if followed by a word
    s = s.replaceAll(RegExp(r'([,.;:?!])(\S)'), r'$1 $2');

    // Collapse whitespace
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();
    return s;
  }

  List<Map<String, dynamic>> _parseUsfm(String src, String bookKey, [Map<int, List<Map<String, String>>>? runsOut, Map<int, Map<int, Map<String, dynamic>>>? blocksOut]) {
    final rows = <Map<String, dynamic>>[];
    int currentChapter = 0;
    int currentVerse = 0;

    // Block style state applied to next verses until changed
    String? blockType; // e.g., p, m, q, pi, b
    int blockLevel = 0;
    bool blockBreak = false; // insert spacing before verse

    String buffer = '';

    void flush() {
      final text = _cleanInline(buffer.trim());
      if (currentChapter > 0 && currentVerse > 0 && text.isNotEmpty) {
        rows.add({
          'book': Books.instance.englishByKey(bookKey),
          'chapter': currentChapter,
          'verse': currentVerse,
          'text': text,
        });
        if (blocksOut != null && blockType != null) {
          final chMap = (blocksOut[currentChapter] ??= <int, Map<String, dynamic>>{});
          chMap[currentVerse] = {
            'type': blockType,
            'level': blockLevel,
            'break': blockBreak,
          };
        }
      }
      buffer = '';
      // after first verse, subsequent verses in same block shouldn't reinsert paragraph break implicitly
      blockBreak = false;
    }

    final lines = const LineSplitter().convert(src);
    for (final raw in lines) {
      final line = raw.trimRight();
      if (line.isEmpty) continue;
      if (line.startsWith(r'\c ')) {
        flush();
        currentChapter = int.tryParse(line.substring(3).trim().split(' ').first) ?? currentChapter;
        currentVerse = 0;
        blockType = null; blockLevel = 0; blockBreak = false;
        continue;
      }
      // Headings / section titles captured as runs
      final mt = RegExp(r'^\\mt(\d+)\s+(.*)').firstMatch(line);
      if (mt != null) {
        final text = _cleanInline(mt.group(2) ?? '');
        final ch = currentChapter == 0 ? 1 : currentChapter; // preface applies to ch1
        if (text.isNotEmpty && runsOut != null) {
          (runsOut[ch] ??= <Map<String, String>>[]).add({'type': 'mt${mt.group(1)}', 'text': text});
        }
        continue;
      }
      final s = RegExp(r'^\\s(\d*)\s+(.*)').firstMatch(line); // s, s1...
      if (s != null) {
        final text = _cleanInline(s.group(2) ?? '');
        final ty = 's${(s.group(1) ?? '1')}';
        final ch = currentChapter == 0 ? 1 : currentChapter;
        if (text.isNotEmpty && runsOut != null) {
          (runsOut[ch] ??= <Map<String, String>>[]).add({'type': ty, 'text': text});
        }
        continue;
      }
      // Paragraph/poetry markers
      final mP = RegExp(r'^\\p\b').firstMatch(line);
      if (mP != null) { blockType = 'p'; blockLevel = 0; blockBreak = true; continue; }
      final mM = RegExp(r'^\\m\b').firstMatch(line);
      if (mM != null) { blockType = 'm'; blockLevel = 0; blockBreak = true; continue; }
      final mPi = RegExp(r'^\\pi(\d*)\b').firstMatch(line);
      if (mPi != null) { blockType = 'pi'; blockLevel = int.tryParse(mPi.group(1) ?? '1') ?? 1; blockBreak = true; continue; }
      final mQ = RegExp(r'^\\q(\d*)\b').firstMatch(line);
      if (mQ != null) { blockType = 'q'; blockLevel = int.tryParse(mQ.group(1) ?? '1') ?? 1; blockBreak = true; continue; }
      final mB = RegExp(r'^\\b\b').firstMatch(line);
      if (mB != null) { blockType = 'b'; blockLevel = 0; blockBreak = true; continue; }
      final mNb = RegExp(r'^\\nb\b').firstMatch(line);
      if (mNb != null) { blockType = 'nb'; blockLevel = 0; blockBreak = false; continue; }

      if (line.startsWith(r'\v ')) {
        flush();
        final rest = line.substring(3).trim();
        final parts = rest.split(RegExp(r'\s+'));
        final v = int.tryParse(parts.first) ?? 0;
        currentVerse = v;
        final text = rest.substring(parts.first.length).trim();
        buffer = text.isEmpty ? '' : text + ' ';
        continue;
      }
      // Paragraph or poetry markers: \p, \m, \q1 etc. Add a space separator
      if (RegExp(r'^\\(p|m|q\d*)').hasMatch(line)) {
        final t = line.replaceFirst(RegExp(r'^\\\S+\s*'), '').trim();
        if (t.isNotEmpty) buffer += t + ' ';
        else buffer += ' ';
        continue;
      }
      // Titles/section headings like \mt1, \s1 — skip in verse text here.
      if (RegExp(r'^\\(mt\d+|s\d+)').hasMatch(line)) {
        continue;
      }
      // Default: append plain text
      buffer += line + ' ';
    }
    flush();
    return rows;
  }
}
