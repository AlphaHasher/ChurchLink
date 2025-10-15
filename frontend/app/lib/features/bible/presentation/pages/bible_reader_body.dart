// Renders the bible reader itself
// Top bar extracted earlier; now also extracts loader, actions, and jump picker sheet.

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

import 'package:app/features/bible/data/bible_repo_elisha.dart';
import 'package:app/features/bible/data/elisha_json_source.dart';
import 'package:app/features/bible/data/books.dart';
import 'package:app/features/bible/data/verse_matching.dart' show VerseMatching;

import 'package:app/features/bible/presentation/widgets/flowing_chapter_text.dart';
import 'package:app/features/bible/domain/highlight.dart';
import 'package:app/features/bible/application/reader_logic.dart';
import 'package:app/features/bible/application/reader_sync.dart';
import 'package:app/features/bible/presentation/sheets/verse_actions_sheet.dart';
import 'package:app/features/bible/presentation/widgets/reader_top_bar.dart';

// New extractions
import 'package:app/features/bible/application/reader_loader.dart';
import 'package:app/features/bible/application/reader_actions.dart';
import 'package:app/features/bible/presentation/sheets/jump_picker_sheet.dart';

// Notes API for network + caching
import 'package:app/features/bible/data/notes_api.dart' as api;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'dart:async';

import 'package:intl/intl.dart';
import 'package:app/features/bible/application/last_sync_store.dart';

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

class _BibleReaderBodyState extends State<BibleReaderBody> with TickerProviderStateMixin {
  // Map to hold GlobalKeys for each verse for scrolling
  final Map<VerseRef, GlobalKey> _verseKeys = {};

  // Animation controllers for page slide transitions
  late AnimationController _slideAnimationController;
  late Animation<Offset> _slideAnimation;
  bool _isAnimating = false;

  // Interactive drag gesture tracking
  bool _isDragging = false;
  double _dragStartX = 0.0;
  double _dragCurrentX = 0.0;
  double _dragProgress = 0.0;
  bool _dragDirection = true; // true = next chapter (left swipe), false = prev chapter (right swipe)
  
  // Drag thresholds
  static const double _dragThreshold = 0.3; // 30% of screen width to trigger page change
  static const double _velocityThreshold = 300.0; // pixels per second

  // Interactive drag animation
  void _updateDragAnimation(double progress, bool isNext) {
    final offset = isNext ? Offset(-progress, 0.0) : Offset(progress, 0.0);
    _slideAnimation = Tween<Offset>(
      begin: offset,
      end: offset,
    ).animate(_slideAnimationController);
    
    if (!_slideAnimationController.isAnimating) {
      _slideAnimationController.value = 1.0;
    }
  }

  // Complete or cancel drag animation
  Future<void> _completeDragAnimation(bool shouldChangePage, bool isNext) async {
    _isAnimating = true;
    
    if (shouldChangePage) {
      // Pre-load the new chapter content while animating
      final contentFuture = _preloadNewChapter(isNext);
      
      // Complete the swipe - animate to full offset
      final targetOffset = isNext ? const Offset(-1.0, 0.0) : const Offset(1.0, 0.0);
      _slideAnimation = Tween<Offset>(
        begin: _slideAnimation.value,
        end: targetOffset,
      ).animate(CurvedAnimation(
        parent: _slideAnimationController,
        curve: Curves.easeOut,
      ));
      
      _slideAnimationController.reset();
      
      // Wait for both animation and content loading to complete
      await Future.wait([
        _slideAnimationController.forward(),
        contentFuture,
      ]);
      
      // Now apply the new chapter state and reset animation
      if (isNext) {
        _applyNextChapter();
      } else {
        _applyPrevChapter();
      }
      
      // Reset slide animation to center for new content
      _slideAnimation = Tween<Offset>(
        begin: Offset.zero,
        end: Offset.zero,
      ).animate(_slideAnimationController);
      _slideAnimationController.reset();
      _slideAnimationController.value = 0.0;
      
    } else {
      // Cancel the swipe - animate back to center
      _slideAnimation = Tween<Offset>(
        begin: _slideAnimation.value,
        end: Offset.zero,
      ).animate(CurvedAnimation(
        parent: _slideAnimationController,
        curve: Curves.easeOut,
      ));
      
      _slideAnimationController.reset();
      await _slideAnimationController.forward();
    }
    
    _isAnimating = false;
    _isDragging = false;
  }

  // Pre-load new chapter content without changing UI state
  Future<void> _preloadNewChapter(bool isNext) async {
    await ElishaBibleRepo.ensureInitialized();
    
    if (!_booksReady) return;
    
    // Calculate the next chapter/book to preload
    if (isNext) {
      final i = _bookIndex(_book);
      final count = _chapterCount(_book);
      if (_chapter < count) {
        // Next chapter in same book - preload it
        await _repo.getChapter(translation: _translation, book: _book, chapter: _chapter + 1);
      } else {
        // Next book - preload first chapter
        final ni = (i + 1) % _bookNames.length;
        final nextBook = Books.instance.englishByOrder(ni + 1);
        await _repo.getChapter(translation: _translation, book: nextBook, chapter: 1);
      }
    } else {
      final i = _bookIndex(_book);
      if (_chapter > 1) {
        // Previous chapter in same book - preload it
        await _repo.getChapter(translation: _translation, book: _book, chapter: _chapter - 1);
      } else {
        // Previous book - preload last chapter
        final pi = (i - 1 + _bookNames.length) % _bookNames.length;
        final prevBook = Books.instance.englishByOrder(pi + 1);
        final prevBookChapterCount = _chapterCount(prevBook);
        await _repo.getChapter(translation: _translation, book: prevBook, chapter: prevBookChapterCount);
      }
    }
  }

  // Apply next chapter state after content is ready
  void _applyNextChapter() {
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_mainScrollController.hasClients) {
        _mainScrollController.jumpTo(0.0);
      }
    });
  }

  // Apply previous chapter state after content is ready
  void _applyPrevChapter() {
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_mainScrollController.hasClients) {
        _mainScrollController.jumpTo(0.0);
      }
    });
  }

  // Helper to scroll to the top after loading
  void _scrollToTop() {
    if (_mainScrollController.hasClients) {
      _mainScrollController.animateTo(
        0.0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  // Helper to scroll to a verse after loading
  void _scrollToVerse(VerseRef ref) {
    final key = _verseKeys[ref];
    if (key != null && key.currentContext != null) {
      Scrollable.ensureVisible(
        key.currentContext!,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
        alignment: 0.1,
      );
    }
  }

  static const int _verseSearchPageSize = 100;
  List<(VerseRef ref, String text)> _verseSearchResults = [];
  int _verseSearchLoaded = 0;
  bool _isLoadingVersePage = false;
  String _lastVerseSearchQuery = '';
  bool _isLoadingNotePage = false;
  final ScrollController _searchScrollController = ScrollController();
  final ScrollController _mainScrollController = ScrollController();
  String _searchType = 'Verse';
  bool _showSearch = false;
  String _searchText = '';
  // Convert VerseRef -> record expected by reader_logic helpers.
  ({String book, int chapter, int verse}) _r(VerseRef v) => (
    book: v.book,
    chapter: v.chapter,
    verse: v.verse,
  );

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
  final Map<String, String> _noteIdByKey =
      <String, String>{}; // "Book|C|V" -> id
  final Map<String, String> _noteIdByCluster =
      <String, String>{}; // clusterId -> id

  // Connectivity state
  bool _offline = false;

  // Distinguish who kicked a refresh
  bool _refreshing = false; // true while a pull-to-refresh is running

  // Track which cluster IDs belonged to the last hydrated window.
  final Set<String> _lastWindowCids = <String>{};

  // Books catalog state
  bool _booksReady = false;
  String _localeForTx(String tx) =>
      tx.trim().toLowerCase() == 'rst' ? 'ru' : 'en';

  // Catalog wrappers
  List<String> get _bookNames =>
      _booksReady ? Books.instance.names() : const <String>[];
  String _abbr(String book) => _booksReady ? Books.instance.abbrev(book) : book;
  int _chapterCount(String book) =>
      _booksReady ? Books.instance.chapterCount(book) : 1;
  int _bookIndex(String book) =>
      _booksReady ? (Books.instance.orderIndex(book) - 1) : 0;

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
        for (final name in Books.instance.names())
          name: Books.instance.chapterCount(name),
      };
    },
    hydrateCurrent:
        () async => syncFetchChapterNotes(_ctx, book: _book, chapter: _chapter),
    onOfflineChanged: (off) {
      if (mounted) setState(() => _offline = off);
    },
  );

  // Fast note search: cache all notes for instant search
  List<(VerseRef, String, String)> _allUserNotes = [];
  bool _allNotesLoaded = false;
  StreamSubscription<void>? _notesSyncedSub;

  Future<void> _loadAllNotes() async {
    // Read from local cache only (no network here).
    final allNotes = await api.NotesApi.getAllNotesFromCache();

    final List<(VerseRef, String, String)> notes = [];
    for (final n in allNotes) {
      final chapterVerses = await _repo.getChapter(
        translation: _translation,
        book: n.book,
        chapter: n.chapter,
      );
      final v = chapterVerses.firstWhere(
        (v) =>
            v.$1.book == n.book &&
            v.$1.chapter == n.chapter &&
            v.$1.verse == n.verseStart,
        orElse: () => (VerseRef(n.book, n.chapter, n.verseStart), ''),
      );
      notes.add((v.$1, v.$2, n.note));
      debugPrint(
        '[NOTE-LOAD] ${n.book} ${n.chapter}:${n.verseStart} note="${n.note}" text="${v.$2}"',
      );
    }

    debugPrint('[NOTE-LOAD] Total notes loaded: ${notes.length}');
    if (mounted) {
      setState(() {
        _allUserNotes = notes;
        _allNotesLoaded = true;
      });
    }
  }

  // Helpers
  ReaderLoader get _loader => ReaderLoader(_repo, ElishaJsonSource());
  ReaderActions get _actions => ReaderActions(_ctx, api.NotesApi());

  @override
  void initState() {
    super.initState();

    // Initialize slide animation controller
    _slideAnimationController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _slideAnimation = Tween<Offset>(
      begin: Offset.zero,
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideAnimationController,
      curve: Curves.easeInOut,
    ));
    _translation = widget.initialTranslation;
    _book = widget.initialBook;
    _chapter = widget.initialChapter;

    // Fast note search: load all notes at startup
    Books.instance.ensureLoaded().then((_) {
      _loadAllNotes();
    });

    if (kDebugMode) {
      debugPrint('[BibleReader] boot -> $_translation $_book:$_chapter');
    }

    // Catalog ready → set locale, then load
    Books.instance.ensureLoaded().then((_) async {
      if (!mounted) return;
      Books.instance.setLocaleCode(_localeForTx(_translation));
      _booksReady = true;
      if (mounted) {
        setState(() {});
      }

      // Kick initial load + prime once books exist
      await _load();
      await _sync.onBooksReady();
    });

    // Start side-effect orchestrator (auth/connectivity/sync stream)
    _sync.start();

    // One-shot: fetch ALL notes via index route (limit=0) and fill cache.
    api.NotesApi.primeAllCache();

    // When cache finishes writing (or outbox drains), refresh local search data.
    _notesSyncedSub = api.NotesApi.onSynced.listen((_) {
      if (!mounted) return;
      _loadAllNotes();
    });

    // Belt & suspenders: reflect very first connectivity state in the UI.
    Connectivity().checkConnectivity().then((r) {
      if (!mounted) return;
      setState(() => _offline = ReaderSync.isOfflineFrom(r));
    });
  }

  @override
  void dispose() {
    _sync.dispose();
    _searchScrollController.dispose();
    _mainScrollController.dispose();
    _slideAnimationController.dispose();
    _notesSyncedSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    await ElishaBibleRepo.ensureInitialized();

    if (kDebugMode) {
      debugPrint(
        '[BibleReader] getChapter tx=$_translation book=$_book ch=$_chapter',
      );
    }

    final r = await _loader.load(
      translation: _translation,
      book: _book,
      chapter: _chapter,
    );
    if (!mounted) return;
    if (mounted) {
      setState(() {
        _verses = r.verses;
        _currentRuns = r.runs;
        _currentBlocks = r.blocks;
      });
    }

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

  // Regular navigation (for buttons and jump picker)
  void _nextChapter() {
    if (!_booksReady) return;
    final i = _bookIndex(_book);
    final count = _chapterCount(_book);
    if (_chapter < count) {
      if (mounted) setState(() => _chapter += 1);
    } else {
      final ni = (i + 1) % _bookNames.length;
      if (mounted) {
        setState(() {
          _book = Books.instance.englishByOrder(ni + 1);
          _chapter = 1;
        });
      }
    }
    _load();
    // Reset scroll position to top when changing chapters
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToTop();
    });
  }

  void _prevChapter() {
    if (!_booksReady) return;
    final i = _bookIndex(_book);
    if (_chapter > 1) {
      if (mounted) setState(() => _chapter -= 1);
    } else {
      final pi = (i - 1 + _bookNames.length) % _bookNames.length;
      if (mounted) {
        setState(() {
          _book = Books.instance.englishByOrder(pi + 1);
          _chapter = _chapterCount(_book);
        });
      }
    }
    _load();
    // Reset scroll position to top when changing chapters
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToTop();
    });
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
      if (mounted) {
        setState(() {
          _book = Books.instance.canonEnglishName(result.$1);
          _chapter = result.$2;
        });
      }

      if (kDebugMode) {
        debugPrint('[BibleReader] jump -> $_translation $_book:$_chapter');
      }

      _load();
      // Reset scroll position to top when jumping to a different chapter
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToTop();
      });
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
          ..showSnackBar(
            const SnackBar(
              content: Text('Refreshed'),
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 2),
              margin: EdgeInsets.all(12),
              shape: StadiumBorder(),
            ),
          );
      }
      if (kDebugMode) debugPrint('[PULL] done');
    }
  }

  Future<void> _openActions((VerseRef ref, String text) v) async {
    final res = await showModalBottomSheet<ActionResult>(
      context: context,
      isScrollControlled: true,
      builder:
          (ctx) => VerseActionsSheet(
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
      await _loadAllNotes();
    } catch (e, st) {
      debugPrint('[ReaderActions] failed: $e');
      debugPrint('$st');
    }

    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    List<(VerseRef ref, String text)> filteredVerses = _verses;
    final trimmedSearch = _searchText.trim();
    final query = trimmedSearch.toLowerCase();
    if (trimmedSearch.isNotEmpty && _booksReady) {
      if (_searchType == 'Book') {
        final allBookNames = Books.instance.names();
        filteredVerses =
            allBookNames
                .where((book) => book.toLowerCase().contains(query))
                .map((book) {
                  final verse = _verses.firstWhere(
                    (v) => v.$1.book == book,
                    orElse: () => (VerseRef(book, 1, 1), ''),
                  );
                  return verse;
                })
                .toList();
      } else if (_searchType == 'Verse') {
        // Global async paged search for Verse
        if (_lastVerseSearchQuery != trimmedSearch) {
          _verseSearchResults = [];
          _verseSearchLoaded = 0;
          _lastVerseSearchQuery = trimmedSearch;
        }
        void loadMoreVerses() async {
          if (_isLoadingVersePage) return;
          _isLoadingVersePage = true;
          final List<(VerseRef ref, String text)> newResults = [];
          int loaded = 0;
          outer:
          for (final book in Books.instance.names()) {
            final chapterCount = Books.instance.chapterCount(book);
            for (int ch = 1; ch <= chapterCount; ch++) {
              final chapterVerses = await _repo.getChapter(
                translation: _translation,
                book: book,
                chapter: ch,
              );
              for (final v in chapterVerses) {
                final ref = v.$1;
                final text = v.$2.toLowerCase();
                final chapterMatch = ref.chapter.toString().contains(query);
                final verseMatch = ref.verse.toString().contains(query);
                final verseTextMatch = text.contains(query);
                if (chapterMatch || verseMatch || verseTextMatch) {
                  if (loaded >= _verseSearchLoaded &&
                      newResults.length < _verseSearchPageSize) {
                    newResults.add(v);
                  }
                  loaded++;
                  if (newResults.length >= _verseSearchPageSize) break outer;
                }
              }
            }
          }
          if (mounted) {
            setState(() {
              _verseSearchResults.addAll(newResults);
              _verseSearchLoaded += newResults.length;
              _isLoadingVersePage = false;
            });
          } else {
            _isLoadingVersePage = false;
          }
        }

        if (_verseSearchResults.isEmpty && !_isLoadingVersePage) {
          loadMoreVerses();
        }
        filteredVerses =
            _verseSearchResults.where((v) {
              final ref = v.$1;
              final text = v.$2.toLowerCase();
              final chapterMatch = ref.chapter.toString().contains(query);
              final verseMatch = ref.verse.toString().contains(query);
              final verseTextMatch = text.contains(query);
              return chapterMatch || verseMatch || verseTextMatch;
            }).toList();
      } else if (_searchType == 'Note') {
        // Global async paged search for Note
        if (!_allNotesLoaded) {
          _isLoadingNotePage = true;
          filteredVerses = [];
        } else {
          debugPrint('[NOTE-SEARCH] Query: "$query"');
          int matchCount = 0;
          for (final n in _allUserNotes) {
            final noteLower = n.$3.toLowerCase();
            final contains = noteLower.contains(query);
            debugPrint(
              '[NOTE-SEARCH] Check: ${n.$1.book} ${n.$1.chapter}:${n.$1.verse} note="${n.$3}" containsQuery=$contains',
            );
            if (contains) matchCount++;
          }
          final filtered =
              _allUserNotes
                  .where((n) => n.$3.toLowerCase().contains(query))
                  .toList();
          debugPrint(
            '[NOTE-SEARCH] Matches found: $matchCount, Filtered list length: ${filtered.length}',
          );
          filteredVerses = filtered.map((n) => (n.$1, n.$2)).toList();
          _isLoadingNotePage = false;
        }
      } else {
        filteredVerses =
            _verses.where((v) {
              final ref = v.$1;
              final text = v.$2.toLowerCase();
              final bookMatch = ref.book.toLowerCase().contains(query);
              final chapterMatch = ref.chapter.toString().contains(query);
              final verseMatch = ref.verse.toString().contains(query);
              final verseTextMatch = text.contains(query);
              final noteShared =
                  _notesShared['${ref.book}|${ref.chapter}|${ref.verse}'] ?? '';
              final notePerTx =
                  _notesPerTx[_translation]?['${ref.book}|${ref.chapter}|${ref.verse}'] ??
                  '';
              final noteMatch =
                  noteShared.toLowerCase().contains(query) ||
                  notePerTx.toLowerCase().contains(query);
              return bookMatch ||
                  chapterMatch ||
                  verseMatch ||
                  verseTextMatch ||
                  noteMatch;
            }).toList();
      }
    }

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
            if (mounted) {
              setState(() {
                _translation = val;
                _ctx.translation = val; // keep logic layer in sync
                if (_booksReady) {
                  Books.instance.setLocaleCode(_localeForTx(_translation));
                }
              });
            }
            _load();
          },
          onSearchPressed: () {
            if (mounted) {
              setState(() {
                _showSearch = !_showSearch;
                if (!_showSearch) _searchText = '';
              });
            }
          },
        ),
        if (_showSearch) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Theme.of(context).dividerColor, width: 1.2),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                children: [
                  DropdownButton<String>(
                    value: _searchType,
                    items: const [
                      DropdownMenuItem(
                        value: 'Book',
                        child: Text(
                          'Book',
                        ),
                      ),
                      DropdownMenuItem(
                        value: 'Verse',
                        child: Text(
                          'Verse',
                        ),
                      ),
                      DropdownMenuItem(
                        value: 'Note',
                        child: Text(
                          'Note',
                        ),
                      ),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        if (mounted) setState(() => _searchType = val);
                      }
                    },
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      autofocus: true,
                      decoration: InputDecoration(
                        hintText:
                            _searchType == 'Verse'
                                ? 'Search verse text, chapter, or number...'
                                : 'Search...',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 0,
                          horizontal: 0,
                        ),
                        isDense: true,
                        filled: false,
                      ),
                      onChanged: (val) {
                        if (mounted) {
                          setState(() {
                            _searchText = val;
                          });
                        }
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_searchText.trim().isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 220),
              margin: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                border: Border.all(color: Theme.of(context).dividerColor),
                borderRadius: BorderRadius.circular(8),
              ),
              child:
                  (_isLoadingVersePage &&
                              _searchType == 'Verse' &&
                              _verseSearchResults.isEmpty) ||
                          (_isLoadingNotePage &&
                              _searchType == 'Note' &&
                              filteredVerses.isEmpty)
                      ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: CircularProgressIndicator(),
                        ),
                      )
                      : filteredVerses.isEmpty
                      ? ListTile(
                        title: Text(
                          'No ${_searchType.toLowerCase()} results found',
                        ),
                      )
                      : ListView.builder(
                        controller: _searchScrollController,
                        shrinkWrap: true,
                        itemCount:
                            filteredVerses.length +
                            ((_isLoadingVersePage &&
                                        _searchType == 'Verse' &&
                                        _verseSearchResults.isNotEmpty) ||
                                    (_isLoadingNotePage &&
                                        _searchType == 'Note' &&
                                        filteredVerses.isNotEmpty)
                                ? 1
                                : 0),
                        itemBuilder: (ctx, i) {
                          if ((_isLoadingVersePage &&
                                  _searchType == 'Verse' &&
                                  i == filteredVerses.length) ||
                              (_isLoadingNotePage &&
                                  _searchType == 'Note' &&
                                  i == filteredVerses.length)) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 16),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          final v = filteredVerses[i];
                          final ref = v.$1;
                          final noteShared =
                              _notesShared['${ref.book}|${ref.chapter}|${ref.verse}'] ??
                              '';
                          final notePerTx =
                              _notesPerTx[_translation]?['${ref.book}|${ref.chapter}|${ref.verse}'] ??
                              '';
                          final note =
                              noteShared.isNotEmpty ? noteShared : notePerTx;
                          if (_searchType == 'Book') {
                            final bookName = ref.book;
                            final chapterCount =
                                _booksReady
                                    ? Books.instance.chapterCount(bookName)
                                    : 0;
                            return ListTile(
                              dense: true,
                              title: Text(
                                bookName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              subtitle:
                                  chapterCount > 0
                                      ? Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Wrap(
                                          spacing: 6,
                                          runSpacing: 4,
                                          children: List.generate(
                                            chapterCount,
                                            (i) {
                                              final chapNum = i + 1;
                                              return ActionChip(
                                                label: Text('Ch $chapNum'),
                                                onPressed: () {
                                                  if (mounted) {
                                                    setState(() {
                                                      _book = bookName;
                                                      _chapter = chapNum;
                                                      _showSearch = false;
                                                      _searchText = '';
                                                    });
                                                  }
                                                  _load();
                                                },
                                              );
                                            },
                                          ),
                                        ),
                                      )
                                      : null,
                            );
                          } else if (_searchType == 'Note') {
                            String noteContent = '';
                            final match = _allUserNotes.firstWhere(
                              (n) => n.$1 == ref,
                              orElse: () => (ref, v.$2, ''),
                            );
                            noteContent = match.$3;
                            return ListTile(
                              dense: true,
                              title: Text(
                                noteContent,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                '${ref.book} ${ref.chapter}:${ref.verse}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Colors.blueGrey,
                                ),
                              ),
                              onTap: () async {
                                if (_book != ref.book ||
                                    _chapter != ref.chapter) {
                                  if (mounted) {
                                    setState(() {
                                      _book = ref.book;
                                      _chapter = ref.chapter;
                                      _showSearch = false;
                                      _searchText = '';
                                    });
                                  }
                                  await _load();
                                  WidgetsBinding.instance.addPostFrameCallback((
                                    _,
                                  ) {
                                    _scrollToVerse(ref);
                                    _openActions(v);
                                  });
                                } else {
                                  if (mounted) {
                                    setState(() {
                                      _showSearch = false;
                                      _searchText = '';
                                    });
                                  }
                                  WidgetsBinding.instance.addPostFrameCallback((
                                    _,
                                  ) {
                                    _scrollToVerse(ref);
                                    _openActions(v);
                                  });
                                }
                              },
                            );
                          } else {
                            return ListTile(
                              dense: true,
                              title: Text(
                                '${ref.book} ${ref.chapter}:${ref.verse}',
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    v.$2,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (note.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        'Note: $note',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Colors.blueGrey,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              onTap: () async {
                                if (_searchType == 'Verse') {
                                  if (_book != ref.book ||
                                      _chapter != ref.chapter) {
                                    if (mounted) {
                                      setState(() {
                                        _book = ref.book;
                                        _chapter = ref.chapter;
                                        _showSearch = false;
                                        _searchText = '';
                                      });
                                    }
                                    await _load();
                                    WidgetsBinding.instance
                                        .addPostFrameCallback((_) {
                                          _scrollToVerse(ref);
                                        });
                                  } else {
                                    if (mounted) {
                                      setState(() {
                                        _showSearch = false;
                                        _searchText = '';
                                      });
                                    }
                                    WidgetsBinding.instance
                                        .addPostFrameCallback((_) {
                                          _scrollToVerse(ref);
                                        });
                                  }
                                } else {
                                  _openActions(v);
                                }
                              },
                            );
                          }
                        },
                      ),
            ),
        ],
        const Divider(height: 12),
        Expanded(
          child: Stack(
            children: [
              filteredVerses.isEmpty
                  ? const Center(child: Text('No results found'))
                  : GestureDetector(
                      onHorizontalDragStart: (details) {
                        if (_isAnimating) return;
                        _isDragging = true;
                        _dragStartX = details.globalPosition.dx;
                        _dragCurrentX = details.globalPosition.dx;
                        _dragProgress = 0.0;
                      },
                      onHorizontalDragUpdate: (details) {
                        if (!_isDragging || _isAnimating) return;
                        
                        _dragCurrentX = details.globalPosition.dx;
                        final screenWidth = MediaQuery.of(context).size.width;
                        final dragDistance = _dragCurrentX - _dragStartX;
                        
                        // Calculate progress (0.0 to 1.0)
                        _dragProgress = (dragDistance.abs() / screenWidth).clamp(0.0, 1.0);
                        
                        // Determine direction
                        _dragDirection = dragDistance < 0; // true = next (left swipe), false = prev (right swipe)
                        
                        // Check if we can navigate in this direction
                        final canNavigate = _dragDirection ? !_isAtLastChapter : !_isAtFirstChapter;
                        
                        if (canNavigate) {
                          setState(() {
                            _updateDragAnimation(_dragProgress, _dragDirection);
                          });
                        }
                      },
                      onHorizontalDragEnd: (details) {
                        if (!_isDragging || _isAnimating) return;
                        
                        final velocity = details.primaryVelocity ?? 0.0;
                        final shouldChangePage = _dragProgress > _dragThreshold || 
                                               velocity.abs() > _velocityThreshold;
                        
                        final canNavigate = _dragDirection ? !_isAtLastChapter : !_isAtFirstChapter;
                        
                        if (canNavigate && shouldChangePage) {
                          _completeDragAnimation(true, _dragDirection);
                        } else {
                          _completeDragAnimation(false, _dragDirection);
                        }
                      },
                      onHorizontalDragCancel: () {
                        if (!_isDragging || _isAnimating) return;
                        _completeDragAnimation(false, _dragDirection);
                      },
                      child: SlideTransition(
                        position: _slideAnimation,
                        child: RefreshIndicator(
                          onRefresh: _handlePullToRefresh,
                          child: SingleChildScrollView(
                            controller: _mainScrollController,
                            physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(12, 8, 12, _offline ? 96 : 24),
                        child: (() {
                          for (final v in filteredVerses) {
                            _verseKeys.putIfAbsent(v.$1, () => GlobalKey());
                          }
                          return FlowingChapterText(
                            verses: filteredVerses,
                            highlights: { for (final v in filteredVerses) v.$1: colorFor(_ctx, _r(v.$1)) },
                            onTapVerse: (vt) => _openActions(vt),
                            baseStyle: Theme.of(context).textTheme.bodyLarge?.copyWith(fontSize: 16, height: 1.6),
                            runs: _currentRuns,
                            verseBlocks: _currentBlocks,
                            verseKeys: _verseKeys,
                          );
                        })(),
                      ),
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
                      color: Theme.of(context).colorScheme.primary,
                      child: ListTile(
                        dense: true,
                        leading: Icon(
                          Icons.wifi_off,
                          color: Theme.of(context).colorScheme.onPrimary
                        ),
                        title: Text(
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onPrimary
                          ),
                          'You\'re offline'
                        ),
                        subtitle: FutureBuilder<DateTime?>(
                          future: LastSyncStore.readLocal(),
                          builder: (context, snap) {
                            final last = snap.data;
                            final pretty =
                                last == null
                                    ? 'never'
                                    : DateFormat.yMMMd().add_jm().format(
                                      last,
                                    ); // e.g., Sep 22, 3:41 PM
                            return Text(
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onPrimary
                              ),
                              'Last sync: $pretty\nChanges are saved and will sync later.',
                            );
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
