// Fetches chapter text and formatting information
// Packes this and returns it to bible_reader_body.dart

import 'package:app/pages/bible_reader/bible_repo_elisha.dart'; // ElishaBibleRepo, VerseRef
import 'package:app/pages/bible_reader/elisha_json_source.dart';

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
  ReaderLoader(this.repo, this.jsonSource);
  final ElishaBibleRepo repo;
  final ElishaJsonSource jsonSource;

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
      final runsByChapter = await jsonSource.loadRunsFor(translation, book);
      runs = runsByChapter[chapter];
      final blocksByChapter = await jsonSource.loadVerseBlocksFor(translation, book);
      blocks = blocksByChapter[chapter];
    } catch (_) {
      runs = null;
      blocks = null;
    }

    return ReaderLoadResult(verses: verses, runs: runs, blocks: blocks);
    }
}
