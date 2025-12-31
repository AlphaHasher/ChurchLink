// Fetches chapter text and formatting information
// Packs this and returns it to bible_reader_body.dart

import 'package:app/models/bible_reader/verse_ref.dart';
import 'package:app/services/bible/local_bible_repository.dart';

class ReaderLoadResult {
  ReaderLoadResult({
    required this.verses,
    required this.runs,
    required this.blocks,
  });

  final List<(VerseRef ref, String text)> verses;
  final List<Map<String, String>>? runs;
  final Map<int, Map<String, dynamic>>? blocks;
}

class ReaderLoader {
  ReaderLoader(this.repo);
  final LocalBibleRepository repo;

  Future<ReaderLoadResult> load({
    required String translation,
    required String book,
    required int chapter,
  }) async {
    final verses = await repo.getChapter(
      translation: translation,
      book: book,
      chapter: chapter,
    );

    List<Map<String, String>>? runs;
    Map<int, Map<String, dynamic>>? blocks;
    try {
      final runsByChapter = await repo.getChapterRuns(
        translation: translation,
        book: book,
      );
      runs = runsByChapter[chapter];
      final blocksByChapter = await repo.getVerseBlocks(
        translation: translation,
        book: book,
      );
      blocks = blocksByChapter[chapter];
    } catch (_) {
      runs = null;
      blocks = null;
    }

    return ReaderLoadResult(verses: verses, runs: runs, blocks: blocks);
  }
}
