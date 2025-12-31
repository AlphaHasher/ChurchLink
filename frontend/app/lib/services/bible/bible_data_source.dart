// Asset loading layer for Bible data

import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle, AssetManifest;
import 'package:flutter/foundation.dart' show FlutterError;
import 'package:app/models/bible_reader/books.dart';
import 'package:app/services/bible/usfm_parser.dart';

/// Handles loading Bible data from local assets (USFM files).
/// Provides caching for performance.
class BibleDataSource {
  // In-memory cache: translation|bookKey -> verse rows
  final Map<String, List<Map<String, dynamic>>> _bookCache = {};

  // In-memory cache for chapter runs: translation|bookKey -> { chapter -> [ {type,text} ] }
  final Map<String, Map<int, List<Map<String, String>>>> _runsCache = {};

  // In-memory cache for verse block styles: translation|bookKey -> { chapter -> { verse -> {type,level,break} } }
  final Map<String, Map<int, Map<int, Map<String, dynamic>>>> _blocksCache = {};

  /// Load verses for a specific book.
  /// Returns list of verse maps: [{book, chapter, verse, text}]
  Future<List<Map<String, dynamic>>> loadBook(
    String translation,
    String bookNameOrKey,
  ) async {
    await Books.instance.ensureLoaded();
    final key = Books.instance.keyFor(bookNameOrKey) ?? bookNameOrKey.toUpperCase();
    final cacheKey = '$translation|$key';

    final cached = _bookCache[cacheKey];
    if (cached != null) return cached;

    // Load and parse USFM
    final rows = await _loadUsfmForBook(translation, key);
    if (rows.isNotEmpty) {
      _bookCache[cacheKey] = rows;
      return rows;
    }

    // Fallback: try loading from single JSON file (legacy format)
    try {
      final rows = await _loadFromJson(translation, key);
      if (rows.isNotEmpty) {
        _bookCache[cacheKey] = rows;
        return rows;
      }
    } catch (_) {}

    return [];
  }

  /// Load chapter runs (headings/sections) for a book.
  Future<Map<int, List<Map<String, String>>>> loadRuns(
    String translation,
    String bookNameOrKey,
  ) async {
    await Books.instance.ensureLoaded();
    final key = Books.instance.keyFor(bookNameOrKey) ?? bookNameOrKey.toUpperCase();
    final cacheKey = '$translation|$key';

    final cached = _runsCache[cacheKey];
    if (cached != null) return cached;

    // Trigger USFM parse which also fills runs cache
    await _loadUsfmForBook(translation, key);
    return _runsCache[cacheKey] ?? <int, List<Map<String, String>>>{};
  }

  /// Load verse block styles for a book.
  Future<Map<int, Map<int, Map<String, dynamic>>>> loadBlocks(
    String translation,
    String bookNameOrKey,
  ) async {
    await Books.instance.ensureLoaded();
    final key = Books.instance.keyFor(bookNameOrKey) ?? bookNameOrKey.toUpperCase();
    final cacheKey = '$translation|$key';

    final cached = _blocksCache[cacheKey];
    if (cached != null) return cached;

    await _loadUsfmForBook(translation, key);
    return _blocksCache[cacheKey] ?? <int, Map<int, Map<String, dynamic>>>{};
  }

  /// List all .usfm asset paths for a translation.
  Future<List<String>> _listUsfmAssets(String translation) async {
    final prefix = 'assets/bibles/translations/$translation/';

    try {
      final assetManifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      return assetManifest
          .listAssets()
          .where((p) => p.startsWith(prefix) && p.toLowerCase().endsWith('.usfm'))
          .toList()
        ..sort();
    } on FlutterError {
      // Fallback for older SDKs that still generate AssetManifest.json
      final manifestRaw = await rootBundle.loadString('AssetManifest.json');
      final manifest = jsonDecode(manifestRaw) as Map<String, dynamic>;
      return manifest.keys
          .where((p) => p.startsWith(prefix) && p.toLowerCase().endsWith('.usfm'))
          .toList()
        ..sort();
    }
  }

  /// Load USFM data for a specific book.
  Future<List<Map<String, dynamic>>> _loadUsfmForBook(
    String translation,
    String bookKey,
  ) async {
    final cacheKey = '$translation|$bookKey';
    final candidates = await _listUsfmAssets(translation);

    // Quick filename match
    final byName = candidates
        .where((p) =>
            p.toUpperCase().contains('-$bookKey') ||
            p.toUpperCase().endsWith('/$bookKey.usfm'))
        .toList();

    if (byName.isNotEmpty) {
      final runsOut = <int, List<Map<String, String>>>{};
      final blocksOut = <int, Map<int, Map<String, dynamic>>>{};
      final rows = <Map<String, dynamic>>[];

      for (final p in byName) {
        final content = await rootBundle.loadString(p);
        final result = UsfmParser.parse(content, bookKey);
        rows.addAll(result.verses);
        _mergeRuns(runsOut, result.runs);
        _mergeBlocks(blocksOut, result.blocks);
      }

      _runsCache[cacheKey] = runsOut;
      _blocksCache[cacheKey] = blocksOut;
      return rows;
    }

    // Fallback: scan files until we find matching \id
    for (final p in candidates) {
      final content = await rootBundle.loadString(p);
      final idKey = UsfmParser.extractBookKey(content);
      if (idKey == bookKey) {
        final result = UsfmParser.parse(content, bookKey);
        _runsCache[cacheKey] = result.runs;
        _blocksCache[cacheKey] = result.blocks;
        return result.verses;
      }
    }

    return <Map<String, dynamic>>[];
  }

  /// Load from legacy single JSON file format.
  Future<List<Map<String, dynamic>>> _loadFromJson(
    String translation,
    String bookKey,
  ) async {
    final path = 'assets/bibles/translations/$translation.json';

    try {
      final raw = await rootBundle.loadString(path);
      final decoded = jsonDecode(raw);

      if (decoded is List) {
        final canonical = Books.instance.englishByKey(bookKey);
        return decoded
            .cast<Map>()
            .where((m) {
              final bookRaw = m['book'] ?? m['b'];
              final book = (bookRaw is int)
                  ? Books.instance.englishByOrder(bookRaw)
                  : Books.instance.canonEnglishName(bookRaw.toString());
              return book.toLowerCase() == canonical.toLowerCase();
            })
            .map<Map<String, dynamic>>((m) {
              final bookRaw = m['book'] ?? m['b'];
              final book = (bookRaw is int)
                  ? Books.instance.englishByOrder(bookRaw)
                  : Books.instance.canonEnglishName(bookRaw.toString());
              final chapter = _toInt(m['chapter'] ?? m['c']);
              final verse = _toInt(m['verse'] ?? m['v']);
              final text = (m['text'] ?? m['t'] ?? '').toString();
              return {'book': book, 'chapter': chapter, 'verse': verse, 'text': text};
            })
            .toList();
      }
    } on FlutterError {
      // Asset not found
    }

    return [];
  }

  void _mergeRuns(
    Map<int, List<Map<String, String>>> target,
    Map<int, List<Map<String, String>>> source,
  ) {
    for (final e in source.entries) {
      (target[e.key] ??= <Map<String, String>>[]).addAll(e.value);
    }
  }

  void _mergeBlocks(
    Map<int, Map<int, Map<String, dynamic>>> target,
    Map<int, Map<int, Map<String, dynamic>>> source,
  ) {
    for (final e in source.entries) {
      final chMap = (target[e.key] ??= <int, Map<String, dynamic>>{});
      chMap.addAll(e.value);
    }
  }

  int _toInt(dynamic v) {
    if (v is int) return v;
    return int.parse(v.toString());
  }
}
