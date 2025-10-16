// -----------------------------------------------------------------------------
// This file contains code for interpreting and relaying data from the .JSON
// bible files to other components as-needed. Essentially a middleman.
// -----------------------------------------------------------------------------

// lib/features/bible/data/bible_repo_elisha.dart
// Uses this to standardize and clean up the formatting from a .JSON Bible file.
import 'package:app/pages/bible_reader/elisha_json_source.dart';

/// Create an object for every single verse
/// Stores book, chapter, verse as properties
/// "book" is stored as a canonical English name (e.g., 'John').
class VerseRef {
  final String book; // canonical name (we normalize if the JSON uses an int)
  final int chapter;
  final int verse;
  const VerseRef(this.book, this.chapter, this.verse);

  @override
  bool operator ==(Object other) =>
      other is VerseRef && other.book == book && other.chapter == chapter && other.verse == verse;
  @override
  int get hashCode => Object.hash(book, chapter, verse);
  @override
  String toString() => '$book $chapter:$verse';
}

/// Works as a middleman for accessing data from the bibles.
class ElishaBibleRepo {
  final _src = ElishaJsonSource();

  // Lazy init; heavy data is loaded on demand per book for USFM sources
  static Future<void>? _init;

  static Future<void> ensureInitialized() {
    return _init ??= _loadAll();
  }

  static Future<void> _loadAll() async {
    // Intentionally no-op to avoid heavy upfront loads for USFM sources.
  }

  /// Returns all verses for the requested chapter as a sorted list.
  Future<List<(VerseRef ref, String text)>> getChapter({
    required String translation,
    required String book,
    required int chapter,
  }) async {
    // Load rows only for the requested book for performance (USFM)
    final rows = await _src.loadFor(translation, book);

    final out = <(VerseRef, String)>[];
    for (final r in rows) {
      final rc = (r['chapter'] as num).toInt();
      if (rc != chapter) continue;
      final name = r['book'] as String;
      out.add((
        VerseRef(name, rc, (r['verse'] as num).toInt()),
        r['text'] as String,
      ));
    }
    out.sort((a, b) => a.$1.verse.compareTo(b.$1.verse));
    return out;
  }
}
