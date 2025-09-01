import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/foundation.dart' show FlutterError;

/// Canonical 66-book order
const List<String> _BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel",
  "1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs",
  "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
  "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians",
  "Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James",
  "1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"
];

/// Common aliases → canonical names (lowercased keys)
const Map<String, String> _BOOK_ALIASES = {
  // Psalms
  'psalm': 'Psalms',
  'psalms': 'Psalms',
  // Song of Solomon
  'song': 'Song of Solomon',
  'song of songs': 'Song of Solomon',
  'songs of solomon': 'Song of Solomon',
  'canticles': 'Song of Solomon',
  // Variations with dots/spaces will be normalized below; add any you encounter.
};

String _canonBookFromName(String raw) {
  final s0 = raw.trim();
  // quick exact hit
  for (final b in _BOOKS) {
    if (s0 == b) return b;
  }
  // normalized (strip dots, collapse spaces, lowercase)
  String norm(String x) =>
      x.replaceAll('.', '').replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();

  final s = norm(s0);
  // try aliases
  if (_BOOK_ALIASES.containsKey(s)) return _BOOK_ALIASES[s]!;
  // try canonical after normalization
  for (final b in _BOOKS) {
    if (norm(b) == s) return b;
  }
  // last resort: keep original (prevents crash; mapping may fail if non-canonical)
  return s0;
}

String _bookNameFromId(dynamic v) {
  // Accept int or numeric string; else normalize string name to canonical.
  if (v is int) {
    final i = v - 1;
    if (i >= 0 && i < _BOOKS.length) return _BOOKS[i];
    throw const FormatException('Invalid book id');
  }
  final s = v.toString().trim();
  final n = int.tryParse(s);
  if (n != null) {
    final i = n - 1;
    if (i >= 0 && i < _BOOKS.length) return _BOOKS[i];
    throw const FormatException('Invalid book id');
  }
  return _canonBookFromName(s);
}

int _toInt(dynamic v) {
  if (v is int) return v;
  return int.parse(v.toString());
}

String _toText(dynamic vText, dynamic vAlt) =>
    (vText ?? vAlt ?? '').toString();

int _toVerse(dynamic vVerse, dynamic vAlt) =>
    _toInt(vVerse ?? vAlt);

class ElishaJsonSource {
  Future<List<Map<String, dynamic>>> load(String translation) async {
    final candidates = <String>[
      'assets/bibles/$translation.json',          // current path
      'assets/bibles/elisha/$translation.json',   // old path remove later
    ];

    Object? decoded;
    FormatException? lastErr;

    for (final path in candidates) {
      try {
        final raw = await rootBundle.loadString(path);
        decoded = jsonDecode(raw);
        final rows = _normalize(decoded);
        // Debug aid: which file actually loaded
        // (Remove if too noisy; prints are stripped in release)
        // ignore: avoid_print
        print('[ElishaJsonSource] Loaded $path (${rows.length} rows)');
        return rows;
      } on FlutterError {
        continue; // asset not found; try next
      } on FormatException catch (e) {
        lastErr = e; // bad JSON/shape; try next
        continue;
      }
    }

    throw lastErr ??
        FlutterError('Bible JSON not found. Tried: ${candidates.join(', ')}');
  }

  /// Normalizes to:
  ///   {'book': String, 'chapter': int, 'verse': int, 'text': String}
  List<Map<String, dynamic>> _normalize(Object? decoded) {
    // Case A: flat list of maps
    if (decoded is List && (decoded.isEmpty || decoded.first is Map)) {
      return decoded.cast<Map>().map<Map<String, dynamic>>((m) {
        final book = _bookNameFromId(m['book'] ?? m['b']);
        final chapter = _toInt(m['chapter'] ?? m['c']);
        final verse = _toVerse(m['verse'], m['v']);     // <— accept 'v'
        final text  = _toText(m['text'], m['t']);       // <— accept 't'
        return {'book': book, 'chapter': chapter, 'verse': verse, 'text': text};
      }).toList();
    }

    // Case B: flat list of arrays: [id, bookIdOrName, chapter, verse, text]
    if (decoded is List && decoded.isNotEmpty && decoded.first is List) {
      return decoded.map<Map<String, dynamic>>((row) {
        final r = row as List;
        if (r.length < 5) {
          throw const FormatException('Tuple row must have at least 5 elements');
        }
        final book = _bookNameFromId(r[1]);
        final chapter = _toInt(r[2]);
        final verse = _toInt(r[3]);
        final text = r[4].toString();
        return {'book': book, 'chapter': chapter, 'verse': verse, 'text': text};
      }).toList();
    }

    // Case C: {"resultset":{"row":[{"field":[id,book,chapter,verse,text]}, ...]}}
    if (decoded is Map &&
        decoded['resultset'] is Map &&
        (decoded['resultset']['row'] is List)) {
      final rows = (decoded['resultset']['row'] as List);
      return rows.map<Map<String, dynamic>>((row) {
        final fields = (row as Map)['field'] as List;
        final book = _bookNameFromId(fields[1]);
        final chapter = _toInt(fields[2]);
        final verse = _toInt(fields[3]);
        final text = fields[4].toString();
        return {'book': book, 'chapter': chapter, 'verse': verse, 'text': text};
      }).toList();
    }

    // Case D: nested map {"John":{"3":[{"v":1,"t":"..."}, ...]}}
    if (decoded is Map) {
      final out = <Map<String, dynamic>>[];
      decoded.forEach((bookKey, chapters) {
        final book = _bookNameFromId(bookKey);
        (chapters as Map).forEach((chKey, verses) {
          final ch = _toInt(chKey);
          for (final vv in (verses as List)) {
            final m = vv as Map;
            out.add({
              'book': book,
              'chapter': ch,
              'verse': _toVerse(m['verse'], m['v']),
              'text': _toText(m['text'], m['t']),
            });
          }
        });
      });
      return out;
    }

    throw const FormatException('Unrecognized Bible JSON shape');
  }
}
