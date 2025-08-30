// lib/features/bible/data/bible_repo_elisha.dart
import 'elisha_json_source.dart';

class VerseRef {
  final String book;  // canonical name (we normalize if the JSON uses an int)
  final int chapter;
  final int verse;
  const VerseRef(this.book, this.chapter, this.verse);

  @override
  bool operator ==(Object o) =>
      o is VerseRef && o.book == book && o.chapter == chapter && o.verse == verse;
  @override
  int get hashCode => Object.hash(book, chapter, verse);
  @override
  String toString() => '$book $chapter:$verse';
}

class ElishaBibleRepo {
  final _src = ElishaJsonSource();

  /// translation: 'kjv' | 'asv' | 'bbe' | 'web' | 'ylt'
  /// book: canonical English name you want to load, e.g. 'John'
  Future<List<(VerseRef ref, String text)>> getChapter({
    required String translation,
    required String book,
    required int chapter,
  }) async {
    final rows = await _src.load(translation);

    // Normalize target book to numeric id (1..66) so we can match either int or string in JSON.
    final targetBookId = _bookIdByName(book);

    final filtered = rows.where((r) {
      final rb = r['book']; // could be int (43) or String ('John')
      final rc = (r['chapter'] as num).toInt();
      final matchesBook = rb is int
          ? rb == targetBookId
          : (rb as String).toLowerCase() == book.toLowerCase();
      return matchesBook && rc == chapter;
    });

    final out = <(VerseRef, String)>[];
    for (final r in filtered) {
      final rb = r['book'];
      final name = rb is int ? _bookNames[rb - 1] : rb as String;
      out.add((
        VerseRef(name, (r['chapter'] as num).toInt(), (r['verse'] as num).toInt()),
        r['text'] as String,
      ));
    }
    out.sort((a, b) => a.$1.verse.compareTo(b.$1.verse));
    return out;
  }

  // 1-based list of canonical book names
  static const List<String> _bookNames = [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
    '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther',
    'Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations',
    'Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah',
    'Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
    '2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
    '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
  ];

  static int _bookIdByName(String name) =>
      _bookNames.indexWhere((n) => n.toLowerCase() == name.toLowerCase()) + 1;
}
