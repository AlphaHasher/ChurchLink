// -----------------------------------------------------------------------------
// This file contains code for interpreting and relaying data from the .JSON
// bible files to other components as-needed. Essentially a middleman. 
// -----------------------------------------------------------------------------

// lib/features/bible/data/bible_repo_elisha.dart
// Uses this to standardize and clean up the formatting from a .JSON Bible file. 
import 'elisha_json_source.dart';

/// Create an object for every single verse
/// Stores book, chapter, verse as properties
/// "book" is stored as a canonical English name (e.g., 'John').
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

/// Works as a middleman for accessing data from the bibles.
class ElishaBibleRepo {
  final _src = ElishaJsonSource();

  // Fixes the infinite loading when opening the Bible initially
  static Future<void>? _init;

  static Future<void> ensureInitialized() {
    return _init ??= _loadAll();
  }

  static Future<void> _loadAll() async {
    await ElishaJsonSource().load('kjv');
    await ElishaJsonSource().load('rst');
  }

  /// Returns all verses for the requested chapter as a sorted list.
  /// Input here is the following:
  ///   translation: which version of the bible to use
  ///     (For our use case, Russian Synodial Translation (RST) and King James Version (KJV) are used)
  ///     (Any other bibles should be compatible so long as they are formatted properly)
  ///   book: title of the book in the bible 
  ///     (uses canonical English name at the moment, may opt for handling RST book names)
  ///   chapter: number of the chapter as an int
  /// Using these keys the following is returned:
  ///   VerseRef: a verse's identification
  ///     (Book, Chapter, Verse)
  ///   text: a verse's actual contents
  Future<List<(VerseRef ref, String text)>> getChapter({
    required String translation,
    required String book,
    required int chapter,
  }) async {
    final rows = await _src.load(translation);

    // Normalizes the book to its ID number from book name. 
    final targetBookId = _bookIdByName(book);

    final filtered = rows.where((r) {
      final rb = r['book']; // EX: Accepts int (43) or String ('John')
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

  /// List of canonical book titles
  static const List<String> _bookNames = [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
    '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther',
    'Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations',
    'Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah',
    'Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
    '2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
    '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
  ];

  /// Converts a book's name to its corresponding ID.
  static int _bookIdByName(String name) =>
      _bookNames.indexWhere((n) => n.toLowerCase() == name.toLowerCase()) + 1;
}