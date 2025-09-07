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

/// Opens a Bible JSON and normalizes its .
class ElishaJsonSource {
  /// Opens a Bible JSON file. The contents of that JSON are returned as follows:
  ///   `{ 'book': String, 'chapter': int, 'verse': int, 'text': String }`
  Future<List<Map<String, dynamic>>> load(String translation) async {
    await Books.instance.ensureLoaded();
    final candidates = <String>[
      'assets/bibles/translations/$translation.json',          // current path
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

    // Case B: flat list of arrays: [id, bookIdOrName, chapter, verse, text]
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
}
