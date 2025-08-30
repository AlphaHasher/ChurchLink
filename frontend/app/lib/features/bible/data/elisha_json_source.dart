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

String _bookNameFromId(dynamic v) {
  // Accept int or numeric string; return book name; fallback to string if it already looks like a name
  if (v is int) {
    final i = v - 1;
    if (i >= 0 && i < _BOOKS.length) return _BOOKS[i];
  } else {
    final s = v.toString().trim();
    final n = int.tryParse(s);
    if (n != null) {
      final i = n - 1;
      if (i >= 0 && i < _BOOKS.length) return _BOOKS[i];
    }
    // Already a name
    return s;
  }
  throw const FormatException('Invalid book id');
}

int _toInt(dynamic v) {
  if (v is int) return v;
  return int.parse(v.toString());
}

class ElishaJsonSource {
  /// Tries both new and old asset locations:
  ///   assets/bibles/<translation>.json
  ///   assets/bibles/elisha/<translation>.json
  Future<List<Map<String, dynamic>>> load(String translation) async {
    final candidates = <String>[
      'assets/bibles/$translation.json',          // new outputs (kjv.json, rst.json)
      'assets/bibles/elisha/$translation.json',   // legacy location
    ];

    Object? decoded;
    FormatException? lastErr;

    for (final path in candidates) {
      try {
        final raw = await rootBundle.loadString(path);
        decoded = jsonDecode(raw);
        // success
        final rows = _normalize(decoded);
        return rows;
      } on FlutterError {
        // asset not found; try next
        continue;
      } on FormatException catch (e) {
        // JSON parse/shape error; record and try next
        lastErr = e;
        continue;
      }
    }

    // If we reached here, either assets missing or invalid
    throw lastErr ??
        FlutterError('Bible JSON not found. Tried: ${candidates.join(', ')}');
  }

  /// Normalizes any of the supported shapes to:
  ///   {'book': String, 'chapter': int, 'verse': int, 'text': String}
  List<Map<String, dynamic>> _normalize(Object? decoded) {
    // Case A: flat list of maps
    if (decoded is List && (decoded.isEmpty || decoded.first is Map)) {
      return decoded.cast<Map>().map<Map<String, dynamic>>((m) {
        final bookVal = m['book'];
        final book = (bookVal is String) ? bookVal : _bookNameFromId(bookVal);
        final chapter = _toInt(m['chapter']);
        final verse = _toInt(m['verse']);
        final text = (m['text'] ?? m['t']).toString();
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
        final book = bookKey.toString();
        (chapters as Map).forEach((chKey, verses) {
          final ch = _toInt(chKey);
          for (final vv in (verses as List)) {
            final m = vv as Map;
            out.add({
              'book': book,
              'chapter': ch,
              'verse': _toInt(m['verse'] ?? m['v']),
              'text': (m['text'] ?? m['t']).toString(),
            });
          }
        });
      });
      return out;
    }

    throw const FormatException('Unrecognized Bible JSON shape');
  }
}
