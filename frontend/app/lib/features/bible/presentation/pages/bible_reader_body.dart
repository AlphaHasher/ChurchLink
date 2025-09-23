// Renders the bible reader itself
// Top bar extracted earlier; now also extracts loader, actions, and jump picker sheet.

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

import '../../data/bible_repo_elisha.dart';
import '../../data/elisha_json_source.dart';
import '../../data/books.dart';
import '../../data/verse_matching.dart' show VerseMatching, VerseKey;

import '../widgets/flowing_chapter_text.dart';
import '../../domain/highlight.dart';
import '../../application/reader_logic.dart';
import '../../application/reader_sync.dart';
import '../sheets/verse_actions_sheet.dart';
import '../widgets/reader_top_bar.dart';

// New extractions
import '../../application/reader_loader.dart';
import '../../application/reader_actions.dart';
import '../sheets/jump_picker_sheet.dart';

// Notes API for network + caching
import '../../data/notes_api.dart' as api;

import 'package:connectivity_plus/connectivity_plus.dart';

import 'package:intl/intl.dart';
import '../../application/last_sync_store.dart';


class BibleReaderBody extends StatefulWidget {
  const BibleReaderBody({
    super.key,
    this.initialTranslation = 'kjv',
    this.initialBook = 'Genesis',
    this.initialChapter = 1,
  });

  final String initialTranslation;
  final String initialBook;
  final int initialChapter;

  @override
  State<BibleReaderBody> createState() => _BibleReaderBodyState();
}

class _BibleReaderBodyState extends State<BibleReaderBody> {
  // Convert VerseRef -> record expected by reader_logic helpers.
  ({String book, int chapter, int verse}) _r(VerseRef v) =>
      (book: v.book, chapter: v.chapter, verse: v.verse);

  final _repo = ElishaBibleRepo();

  // Current view
  late String _translation;
  late String _book;
  late int _chapter;

  VerseMatching? _matcher; // mirrored from _ctx.matcher
  List<(VerseRef ref, String text)> _verses = [];

  // Shared across translations (cluster keyed)
  final Map<String, HighlightColor> _hlShared = {};
  final Map<String, String> _notesShared = {};

  // Per-translation fallbacks
  final Map<String, Map<String, HighlightColor>> _hlPerTx = {
    'kjv': <String, HighlightColor>{},
    'rst': <String, HighlightColor>{},
    'asv': <String, HighlightColor>{},
    'web': <String, HighlightColor>{},
  };
  final Map<String, Map<String, String>> _notesPerTx = {
    'kjv': <String, String>{},
    'rst': <String, String>{},
    'asv': <String, String>{},
    'web': <String, String>{},
  };

  // Remote ID index (so we can update/delete correct rows)
  final Map<String, String> _noteIdByKey = <String, String>{}; // "Book|C|V" -> id
  final Map<String, String> _noteIdByCluster = <String, String>{}; // clusterId -> id

  // Connectivity state
  bool _offline = false;

  // Distinguish who kicked a refresh
  bool _refreshing = false; // true while a pull-to-refresh is running

  // Track which cluster IDs belonged to the last hydrated window.
  Set<String> _lastWindowCids = <String>{};

  // Books catalog state
  bool _booksReady = false;
  String _localeForTx(String tx) => tx.trim().toLowerCase() == 'rst' ? 'ru' : 'en';

  // Catalog wrappers
  List<String> get _bookNames => _booksReady ? Books.instance.names() : const <String>[];
  String _abbr(String book) => _booksReady ? Books.instance.abbrev(book) : book;
  int _chapterCount(String book) => _booksReady ? Books.instance.chapterCount(book) : 1;
  int _bookIndex(String book) => _booksReady ? (Books.instance.orderIndex(book) - 1) : 0;

  List<Map<String, String>>? _currentRuns;
  Map<int, Map<String, dynamic>>? _currentBlocks; // verse -> block info

  // Logic + Sync wrappers
  late final ReaderContext _ctx = ReaderContext(
    translation: widget.initialTranslation,
    hlShared: _hlShared,
    notesShared: _notesShared,
    hlPerTx: _hlPerTx,
    notesPerTx: _notesPerTx,
    noteIdByKey: _noteIdByKey,
    noteIdByCluster: _noteIdByCluster,
    lastWindowCids: _lastWindowCids,
    matcher: _matcher,
  );

  late final ReaderSync _sync = ReaderSync(
    provideBooksIndex: () {
      if (!_booksReady) return <String, int>{};
      return {
        for (final name in Books.instance.names()) name: Books.instance.chapterCount(name),
      };
    },
    hydrateCurrent: () async => syncFetchChapterNotes(_ctx, book: _book, chapter: _chapter),
    onOfflineChanged: (off) {
      if (mounted) setState(() => _offline = off);
    },
  );

  // Helpers
  ReaderLoader get _loader => ReaderLoader(_repo, ElishaJsonSource());
  ReaderActions get _actions => ReaderActions(_ctx, api.NotesApi());

  @override
  void initState() {
    super.initState();

    _translation = widget.initialTranslation;
    _book = widget.initialBook;
    _chapter = widget.initialChapter;

    if (kDebugMode) {
      debugPrint('[BibleReader] boot -> $_translation $_book:$_chapter');
    }

    // Catalog ready → set locale, then load
    Books.instance.ensureLoaded().then((_) async {
      if (!mounted) return;
      Books.instance.setLocaleCode(_localeForTx(_translation));
      _booksReady = true;
      setState(() {});

      // Kick initial load + prime once books exist
      await _load();
      await _sync.onBooksReady();
    });

    // Start side-effect orchestrator (auth/connectivity/sync stream)
    _sync.start();

    // Belt & suspenders: reflect very first connectivity state in the UI.
    Connectivity().checkConnectivity().then((r) {
      if (!mounted) return;
      setState(() => _offline = ReaderSync.isOfflineFrom(r));
    });
  }

  @override
  void dispose() {
    _sync.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    await ElishaBibleRepo.ensureInitialized();

    if (kDebugMode) {
      debugPrint('[BibleReader] getChapter tx=$_translation book=$_book ch=$_chapter');
    }

    final r = await _loader.load(
      translation: _translation,
      book: _book,
      chapter: _chapter,
    );
    if (!mounted) return;
    setState(() {
      _verses = r.verses;
      _currentRuns = r.runs;
      _currentBlocks = r.blocks;
    });

    // Ensure matcher exists and promote local entries to shared clusters
    await ensureMatcherLoaded(_ctx);
    _matcher = _ctx.matcher; // keep mirror in sync
    promoteLocalToShared(_ctx);

    await syncFetchChapterNotes(_ctx, book: _book, chapter: _chapter);
    if (mounted) setState(() {});
  }

  // Sibling helpers
  bool get _isAtFirstChapter {
    if (!_booksReady) return true;
    final i = _bookIndex(_book);
    return _chapter == 1 && i == 0;
  }

  bool get _isAtLastChapter {
    if (!_booksReady) return true;
    final i = _bookIndex(_book);
    final lastBookIndex = _bookNames.length - 1;
    return _chapter == _chapterCount(_book) && i == lastBookIndex;
  }

  void _nextChapter() {
    if (!_booksReady) return;
    final i = _bookIndex(_book);
    final count = _chapterCount(_book);
    if (_chapter < count) {
      setState(() => _chapter += 1);
    } else {
      final ni = (i + 1) % _bookNames.length;
      setState(() {
        _book = Books.instance.englishByOrder(ni + 1);
        _chapter = 1;
      });
    }
    _load();
  }

  void _prevChapter() {
    if (!_booksReady) return;
    final i = _bookIndex(_book);
    if (_chapter > 1) {
      setState(() => _chapter -= 1);
    } else {
      final pi = (i - 1 + _bookNames.length) % _bookNames.length;
      setState(() {
        _book = Books.instance.englishByOrder(pi + 1);
        _chapter = _chapterCount(_book);
      });
    }
    _load();
  }

  Future<void> _openJumpPicker() async {
    if (!_booksReady) return;

    final result = await showJumpPicker(
      context: context,
      bookNames: _bookNames,
      initialBook: _bookNames[_bookIndex(_book)],
      initialChapter: _chapter,
      chapterCountForBook: _chapterCount,
    );

    if (result != null) {
      setState(() {
        _book = Books.instance.canonEnglishName(result.$1);
        _chapter = result.$2;
      });

      if (kDebugMode) {
        debugPrint('[BibleReader] jump -> $_translation $_book:$_chapter');
      }

      _load();
    }
  }

  Future<void> _handlePullToRefresh() async {
    if (!_booksReady) return;
    if (_refreshing) return;

    _refreshing = true;
    if (kDebugMode) debugPrint('[PULL] start: drain + prime + rehydrate');

    try {
      await _sync.onPullToRefresh();
    } finally {
      _refreshing = false;
      if (mounted) setState(() {});
      if (kDebugMode && mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(const SnackBar(
            content: Text('Refreshed'),
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 2),
            margin: EdgeInsets.all(12),
            shape: StadiumBorder(),
          ));
      }
      if (kDebugMode) debugPrint('[PULL] done');
    }
  }

  Future<void> _openActions((VerseRef ref, String text) v) async {
    final res = await showModalBottomSheet<ActionResult>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => VerseActionsSheet(
        verseLabel: v.$1.toString(),
        currentHighlight: colorFor(_ctx, _r(v.$1)),
        existingNote: noteFor(_ctx, _r(v.$1)),
      ),
    );
    if (res == null) return;

    // Apply action (mutates the maps in-place; performs write-through)
    try {
      await _actions.applyAction(
        translation: _translation,
        vt: v,
        res: res,
        hlShared: _hlShared,
        notesShared: _notesShared,
        hlPerTx: _hlPerTx,
        notesPerTx: _notesPerTx,
        noteIdByKey: _noteIdByKey,
        noteIdByCluster: _noteIdByCluster,
        currentBook: _book,
        currentChapter: _chapter,
      );
    } catch (e, st) {
      debugPrint('[ReaderActions] failed: $e');
      debugPrint('$st');
    }

    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ReaderTopBar(
          displayLabel: '${_booksReady ? _abbr(_book) : _book} $_chapter',
          translation: _translation,
          translations: _translations,
          isAtFirstChapter: _isAtFirstChapter,
          isAtLastChapter: _isAtLastChapter,
          onPrevChapter: _isAtFirstChapter ? null : _prevChapter,
          onNextChapter: _isAtLastChapter ? null : _nextChapter,
          onOpenJumpPicker: _openJumpPicker,
          onSelectTranslation: (val) {
            setState(() {
              _translation = val;
              _ctx.translation = val; // keep logic layer in sync
              if (_booksReady) {
                Books.instance.setLocaleCode(_localeForTx(_translation));
              }
            });
            _load();
          },
        ),
        const Divider(height: 12),
        Expanded(
          child: Stack(
            children: [
              _verses.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                      onRefresh: _handlePullToRefresh,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(12, 8, 12, _offline ? 96 : 24),
                        child: FlowingChapterText(
                          verses: _verses,
                          highlights: { for (final v in _verses) v.$1: colorFor(_ctx, _r(v.$1)) },
                          onTapVerse: (vt) => _openActions(vt),
                          baseStyle: Theme.of(context).textTheme.bodyLarge?.copyWith(fontSize: 16, height: 1.6),
                          runs: _currentRuns,
                          verseBlocks: _currentBlocks,
                        ),
                      ),
                    ),
              if (_offline)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: SafeArea(
                    top: false,
                    child: Material(
                      elevation: 4,
                      borderRadius: BorderRadius.circular(12),
                      color: Theme.of(context).colorScheme.tertiaryContainer,
                      child: ListTile(
                        dense: true,
                        leading: const Icon(Icons.wifi_off),
                        title: const Text('You’re offline'),
                        subtitle: FutureBuilder<DateTime?>(
                          future: LastSyncStore.readLocal(),
                          builder: (context, snap) {
                            final last = snap.data;
                            final pretty = last == null
                                ? 'never'
                                : DateFormat.yMMMd().add_jm().format(last); // e.g., Sep 22, 3:41 PM
                            return Text('Last sync: $pretty • Changes are saved and will sync later.');
                          },
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

const List<String> _translations = ['kjv', 'asv', 'web', 'rst'];
