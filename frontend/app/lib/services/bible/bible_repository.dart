// Abstract interface for Bible data access

import 'package:app/models/bible_reader/verse_ref.dart';

/// Abstract interface for accessing Bible text data.
/// Implementations can load from local assets, remote API, etc.
abstract class BibleRepository {
  /// Returns all verses for the requested chapter as a sorted list.
  /// Each tuple contains the verse reference and the verse text.
  Future<List<(VerseRef ref, String text)>> getChapter({
    required String translation,
    required String book,
    required int chapter,
  });

  /// Returns formatting runs (headings, section titles) for a book.
  /// Structure: { chapter -> [ {type, text} ] }
  /// Types include: mt1, mt2 (main titles), s1, s2 (section headings)
  Future<Map<int, List<Map<String, String>>>> getChapterRuns({
    required String translation,
    required String book,
  });

  /// Returns verse block styles (paragraph/poetry formatting) for a book.
  /// Structure: { chapter -> { verse -> {type, level, break} } }
  /// Types include: p (paragraph), m (margin), q (poetry), pi (indented), b (blank), nb (no break)
  Future<Map<int, Map<int, Map<String, dynamic>>>> getVerseBlocks({
    required String translation,
    required String book,
  });

  /// Ensure repository is initialized (for lazy loading)
  static Future<void> ensureInitialized() => Future.value();
}
