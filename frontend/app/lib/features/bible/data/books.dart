// -----------------------------------------------------------------------------
// Middleman for accessing the formatting of the Books within
// the Bible, as stored in books.json.
// TODO: Implementation. Move away from individually listed Bible books
// TODO: in separate files and consolidate it.
// TODO: Implement the Bible revisions
// TODO: KJV: "King James Version (1769)"
// TODO: RST: "1876 (modern orthography)"
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Localized Bible book catalog backed by assets/bibles/books.json
//  • UI: localized names/abbreviations via current locale
//  • Data: stable canonical English + key-based lookups
// -----------------------------------------------------------------------------

import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/widgets.dart' show BuildContext, Localizations;
import 'package:flutter/foundation.dart' show FlutterError;

class BookMeta {
  final int order; // 1..66
  final String key; // stable id, e.g., "GEN"
  final int chapters;
  final Map<String, String> names; // localeCode -> name
  final Map<String, String> abbr; // localeCode -> abbr

  const BookMeta({
    required this.order,
    required this.key,
    required this.chapters,
    required this.names,
    required this.abbr,
  });

  factory BookMeta.fromJson(Map<String, dynamic> j) => BookMeta(
    order: j['order'] as int,
    key: j['key'] as String,
    chapters: j['chapters'] as int,
    names: (j['names'] as Map).cast<String, String>(),
    abbr: (j['abbr'] as Map).cast<String, String>(),
  );

  String nameFor(String locale, String fallback) =>
      names[locale] ?? names[fallback] ?? names.values.first;
  String abbrFor(String locale, String fallback) =>
      abbr[locale] ?? abbr[fallback] ?? abbr.values.first;
}

class Books {
  Books._();
  static final Books instance = Books._();

  bool _loaded = false;
  Future<void>? _loading;
  late final List<String> _locales;          // e.g., ["en","ru"]
  late final List<BookMeta> _byOrder;        // sorted by order
  late final Map<String, BookMeta> _byKey;   // "GEN" -> meta
  late final Map<String, BookMeta> _byEn;    // canonical English name -> meta
  late final Map<String, String> _aliasToKey;// normalized alias -> key

  String _uiLocale = 'en'; // current UI locale (2-letter)
  final String _fallbackLocale = 'en'; // fallback

  // Normalize for lookups (case/space/punct-insensitive)
  String _norm(String s) => s
          .toLowerCase()
          .replaceAll('.', '')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();

  Future<void> ensureLoaded() async {
    if (_loaded) return;
    if (_loading != null) {
      await _loading;
      return;
    }
    _loading = _doLoad();
    await _loading;
    _loading = null;
  }

  Future<void> _doLoad() async {
    Map<String, dynamic>? root;
    final candidates = [
      'assets/bibles/books.json',
      'assets/bibles/metadata/books.json',
      'assets/data/books.json',
    ];

    Object? lastErr;
    for (final p in candidates) {
      try {
        final s = await rootBundle.loadString(p);
        root = jsonDecode(s) as Map<String, dynamic>;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (root == null) {
      throw FlutterError(
        'books.json not found or invalid. Tried: ${candidates.join(', ')} ($lastErr)',
      );
    }

    _locales = (root['locales'] as List?)?.cast<String>() ?? const ['en'];

    final booksJson =
        (root['books'] as List).cast<Map>().cast<Map<String, dynamic>>();
    final aliasJson =
        (root['aliases'] as Map?)?.cast<String, String>() ??
        const <String, String>{};

    final books =
        booksJson.map(BookMeta.fromJson).toList()
          ..sort((a, b) => a.order.compareTo(b.order));

    _byOrder = books;
    _byKey = {for (final b in books) b.key: b};

    // Canonical English is required for stable internal naming:
    _byEn = {
      for (final b in books)
        (b.names['en'] ??
                (throw FlutterError('Missing English name for ${b.key}'))):
            b,
    };

    // Build alias index
    final aliasMap = <String, String>{};
    // Global aliases
    for (final e in aliasJson.entries) {
      aliasMap[_norm(e.key)] = e.value; // -> key
    }
    // Inline aliases per book
    for (final b in booksJson) {
      final key = b['key'] as String;
      final extra = (b['extra_aliases'] as List?)?.cast<String>() ?? const <String>[];
      for (final a in extra) {
        aliasMap[_norm(a)] = key;
      }
      // Also index all known localized names/abbr as aliases:
      final names = (b['names'] as Map).cast<String, String>().values;
      final abbrs = (b['abbr'] as Map).cast<String, String>().values;
      for (final n in names) {
        aliasMap[_norm(n)] = key;
      }
      for (final a2 in abbrs) {
        aliasMap[_norm(a2)] = key;
      }
      // Index the raw key (e.g., GEN) as an alias to itself for USFM \id
      aliasMap[_norm(key)] = key;
    }
    // And index English canonical names as aliases too
    for (final enName in _byEn.keys) {
      aliasMap[_norm(enName)] = _byEn[enName]!.key;
    }

    _aliasToKey = aliasMap;
    _loaded = true;
  }

  // ----- Locale management -----

  void setLocaleCode(String localeCode2) {
    _uiLocale = _locales.contains(localeCode2) ? localeCode2 : _fallbackLocale;
  }

  void setLocaleFromContext(BuildContext context) {
    final code = Localizations.localeOf(context).languageCode;
    setLocaleCode(code);
  }

  String get uiLocale => _uiLocale;

  // ----- Canonical/data lookups -----

  /// Resolve any raw string (localized name, English name, abbr, alias) -> key (e.g., "GEN").
  /// Returns null if unknown.
  String? keyFor(String raw) {
    final s = _norm(raw);
    return _aliasToKey[s];
  }

  /// Chapter count by raw selector (key or any alias).
  int chapterCount(String raw) {
    final key = keyFor(raw) ?? _byEn[raw]?.key;
    final meta = (key != null) ? _byKey[key] : _byEn[raw];
    return meta?.chapters ?? 1;
  }

  /// 1-based order index for raw selector. Returns -1 if unknown.
  int orderIndex(String raw) {
    final key = keyFor(raw) ?? _byEn[raw]?.key;
    if (key == null) return -1;
    final o = _byKey[key]!.order;
    return o;
  }

  /// Canonical English name for any raw selector (for stable storage in VerseRef).
  String canonEnglishName(String raw) {
    final key = keyFor(raw);
    if (key != null) return _byKey[key]!.names['en']!;
    // If it's already English canonical:
    if (_byEn.containsKey(raw)) return raw;
    return raw; // best effort
  }

  /// Return the key for a 1-based order.
  String keyByOrder(int order1based) {
    if (order1based < 1 || order1based > _byOrder.length) {
      throw RangeError('Book order out of range: $order1based');
    }
    return _byOrder[order1based - 1].key;
  }

  /// Return the English canonical name for a key like 'GEN'.
  String englishByKey(String key) {
    final meta = _byKey[key];
    if (meta == null) return key;
    return meta.names['en'] ?? key;
  }

  /// Return the English canonical name for a 1-based order.
  String englishByOrder(int order1based) =>
      _byOrder[order1based - 1].names['en']!;

  // ----- Localized UI accessors -----

  /// Localized book names in canonical order for UI lists.
  List<String> names({String? locale}) {
    final lc = (locale ?? _uiLocale);
    return _byOrder
        .map((b) => b.nameFor(lc, _fallbackLocale))
        .toList(growable: false);
  }

  /// Localized abbreviation for any raw selector (key, alias, etc.).
  String abbrev(String raw, {String? locale}) {
    final lc = (locale ?? _uiLocale);
    final key = keyFor(raw) ?? _byEn[raw]?.key;
    if (key == null) return raw;
    return _byKey[key]!.abbrFor(lc, _fallbackLocale);
  }
}
