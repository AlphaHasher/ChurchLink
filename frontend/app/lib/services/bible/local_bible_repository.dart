// Local asset-based Bible repository implementation

import 'package:app/models/bible_reader/verse_ref.dart';
import 'package:app/services/bible/bible_repository.dart';
import 'package:app/services/bible/bible_data_source.dart';

/// Local asset-based implementation of [BibleRepository].
/// Loads Bible data from USFM files bundled in the app assets.
class LocalBibleRepository implements BibleRepository {
  final _dataSource = BibleDataSource();

  static Future<void>? _init;

  /// Ensure repository is initialized.
  /// Currently a no-op since data is loaded on demand per book for performance.
  static Future<void> ensureInitialized() {
    return _init ??= _loadAll();
  }

  static Future<void> _loadAll() async {
    // Intentionally minimal - data loaded on demand per book for performance.
  }

  @override
  Future<List<(VerseRef ref, String text)>> getChapter({
    required String translation,
    required String book,
    required int chapter,
  }) async {
    final rows = await _dataSource.loadBook(translation, book);

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

  @override
  Future<Map<int, List<Map<String, String>>>> getChapterRuns({
    required String translation,
    required String book,
  }) async {
    return await _dataSource.loadRuns(translation, book);
  }

  @override
  Future<Map<int, Map<int, Map<String, dynamic>>>> getVerseBlocks({
    required String translation,
    required String book,
  }) async {
    return await _dataSource.loadBlocks(translation, book);
  }
}
