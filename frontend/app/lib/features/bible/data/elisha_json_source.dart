import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

class ElishaJsonSource {
  Future<List<Map<String, dynamic>>> load(String translation) async {
    final path = 'assets/bibles/elisha/$translation.json';
    final raw = await rootBundle.loadString(path);
    final decoded = jsonDecode(raw);

    // Case A: flat list of maps: [{"book":"John","chapter":3,"verse":16,"text":"..."}]
    if (decoded is List && (decoded.isEmpty || decoded.first is Map)) {
      return decoded.cast<Map<String, dynamic>>();
    }

    // Case B: flat list of arrays: [[id, book, chapter, verse, text], ...]
    if (decoded is List && decoded.first is List) {
      return decoded.map<Map<String, dynamic>>((row) {
        final r = row as List;
        return {'book': r[1], 'chapter': r[2], 'verse': r[3], 'text': r[4]};
      }).toList();
    }

    // Case C: resultset/row/field: {"resultset":{"row":[{"field":[id,book,chapter,verse,text]}, ...]}}
    if (decoded is Map &&
        decoded['resultset'] is Map &&
        (decoded['resultset']['row'] is List)) {
      final rows = (decoded['resultset']['row'] as List);
      return rows.map<Map<String, dynamic>>((row) {
        final fields = (row['field'] as List);
        return {'book': fields[1], 'chapter': fields[2], 'verse': fields[3], 'text': fields[4]};
      }).toList();
    }

    // Case D: nested map: {"John": {"3": [{"v":1,"t":"..."}, ...]}}
    if (decoded is Map) {
      final out = <Map<String, dynamic>>[];
      decoded.forEach((book, chapters) {
        (chapters as Map).forEach((chKey, verses) {
          final ch = int.parse(chKey.toString());
          for (final v in (verses as List)) {
            final m = (v as Map);
            out.add({
              'book': book,
              'chapter': ch,
              'verse': (m['verse'] ?? m['v']) as int,
              'text' : (m['text']  ?? m['t']) as String,
            });
          }
        });
      });
      return out;
    }

    throw const FormatException('Unrecognized Bible JSON shape');
  }
}
