// -----------------------------------------------------------------------------
// Normalizes various possible Bible JSON shapes into a single flat
// list of maps used by the app. Also resolves flexible book naming
// (ids, names, common aliases) to canonical book names.
// -----------------------------------------------------------------------------

import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/foundation.dart' show FlutterError;

/// Canonical order of Books present in the bible. 
/// The Bible file's JSON can use numbers or titles for its Book entry. 
/// This list is ordered to establish numbering and naming pairs. 
const List<String> _BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel",
  "1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs",
  "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
  "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians",
  "Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James",
  "1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"
];

/// List of common aliases for book titles, should Bible JSONs opt to use a different Book title. 
const Map<String, String> _BOOK_ALIASES = {
  // Psalms
  'psalm': 'Psalms',
  'psalms': 'Psalms',
  // Song of Solomon
  'song': 'Song of Solomon',
  'song of songs': 'Song of Solomon',
  'songs of solomon': 'Song of Solomon',
  'canticles': 'Song of Solomon',
};

/// Performs additional cleaning on the Book titles pulled from a Bible JSON file. 
String _canonBookFromName(String raw) {
  final s0 = raw.trim();
  // Returns immediately if it is 1 to 1.
  for (final b in _BOOKS) {
    if (s0 == b) return b;
  }
  // Remove periods, collapse multiple spaces into one space, convert all characters to lowercase
  String norm(String x) =>
      x.replaceAll('.', '').replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();

  final s = norm(s0);
  // Checks if an alias matches. 
  if (_BOOK_ALIASES.containsKey(s)) return _BOOK_ALIASES[s]!;
  // As a safety measure, normalizes the book titles from the list above then compares it again. 
  for (final b in _BOOKS) {
    if (norm(b) == s) return b;
  }
  // Returns the original value, as a last resort
  return s0;
}

/// Converts an inputted Book number value to its matching Book.
String _bookNameFromId(dynamic v) {
  // Accepts int values, and converts a numerical String to int if needed. 
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

/// Opens a Bible JSON and normalizes its .
class ElishaJsonSource {
  /// Opens a Bible JSON file. The contents of that JSON are returned as follows:
  ///   `{ 'book': String, 'chapter': int, 'verse': int, 'text': String }`
  Future<List<Map<String, dynamic>>> load(String translation) async {
    final candidates = <String>[
      'assets/bibles/$translation.json',          // current path
      //'assets/bibles/elisha/$translation.json',   // old path remove later
    ];

    Object? decoded;
    FormatException? lastErr;

    for (final path in candidates) {
      try {
        final raw = await rootBundle.loadString(path);
        decoded = jsonDecode(raw);
        final rows = _normalize(decoded);
        // The following commented out line prints out loaded files and can be used for debugging
        // print('[ElishaJsonSource] Loaded $path (${rows.length} rows)');
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

  /// Converts several formats into a unified row format.
  /// The following formats are accepted:
  /// - A: Elements are paired with what they are (EX: {"book": "John", "chapter":3, ...})
  /// - B: Elements are in an array in the fixed order of book, chapter, verse, text. No declaration needed.
  List<Map<String, dynamic>> _normalize(Object? decoded) {
    // Case A: flat list of maps
    // Letters b, c, v, t can be used in place of book, chapter, verse, text. 
    if (decoded is List && (decoded.isEmpty || decoded.first is Map)) {
      return decoded.cast<Map>().map<Map<String, dynamic>>((m) {
        final book = _bookNameFromId(m['book'] ?? m['b']);
        final chapter = _toInt(m['chapter'] ?? m['c']);
        final verse = _toVerse(m['verse'], m['v']);
        final text  = _toText(m['text'], m['t']);
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
    throw const FormatException('Unrecognized Bible JSON shape');
  }
}
