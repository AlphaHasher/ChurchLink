// Renders the bible reader itself
// Includes navigation elements (possibly migrate to a new file?)

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

import '../data/bible_repo_elisha.dart';
import '../data/elisha_json_source.dart';
import '../data/books.dart';
import '../data/verse_matching.dart' show VerseMatching, VerseKey;

import 'flowing_chapter_text.dart';
import '../domain/highlight.dart';
import '../logic/reader_logic.dart';
import '../sync/reader_sync.dart';
import '../ui/verse_actions_sheet.dart';

// Notes API for network + caching
import '../data/notes_api.dart' as api;
// Models/enums (RemoteNote, ServerHighlight) come from the helper:
import 'package:app/helpers/bible_notes_helper.dart' as bh;

import 'package:connectivity_plus/connectivity_plus.dart';

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

    final data = await _repo.getChapter(
      translation: _translation,
      book: _book,
      chapter: _chapter,
    );
    if (!mounted) return;
    setState(() => _verses = data);

    // Load section runs & verse blocks
    try {
      final src = ElishaJsonSource();
      final runsByChapter = await src.loadRunsFor(_translation, _book);
      _currentRuns = runsByChapter[_chapter];
      final blocksByChapter = await src.loadVerseBlocksFor(_translation, _book);
      _currentBlocks = blocksByChapter[_chapter];
    } catch (_) {
      _currentRuns = null;
      _currentBlocks = null;
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

    final result = await showModalBottomSheet<(String, int)?>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        String selBook = _bookNames[_bookIndex(_book)];
        int selChap = _chapter;

        return StatefulBuilder(
          builder: (ctx, setSheet) {
            final total = _chapterCount(selBook);
            return SafeArea(
              child: LayoutBuilder(
                builder: (ctx, constraints) {
                  final maxH = constraints.maxHeight * 0.92;
                  return ConstrainedBox(
                    constraints: BoxConstraints(maxHeight: maxH),
                    child: Padding(
                      padding: EdgeInsets.only(
                        left: 16,
                        right: 16,
                        top: 12,
                        bottom: 16 + MediaQuery.of(ctx).viewInsets.bottom,
                      ),
                      child: Column(
                        children: [
                          Expanded(
                            child: SingleChildScrollView(
                              physics: const ClampingScrollPhysics(),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text('Jump to', style: Theme.of(ctx).textTheme.titleMedium),
                                  const SizedBox(height: 12),
                                  DropdownButtonFormField<String>(
                                    value: selBook, // (Deprecated in some SDKs) OK for now
                                    isExpanded: true,
                                    decoration: const InputDecoration(
                                      labelText: 'Book',
                                      border: OutlineInputBorder(),
                                    ),
                                    items: _bookNames
                                        .map((b) => DropdownMenuItem(value: b, child: Text(b)))
                                        .toList(),
                                    onChanged: (b) {
                                      if (b == null) return;
                                      setSheet(() { selBook = b; selChap = 1; });
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text('Chapter', style: Theme.of(ctx).textTheme.labelLarge),
                                  ),
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: List.generate(total, (i) {
                                      final c = i + 1;
                                      final selected = c == selChap;
                                      return ChoiceChip(
                                        label: Text('$c'),
                                        selected: selected,
                                        onSelected: (_) => setSheet(() => selChap = c),
                                      );
                                    }),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: FilledButton(
                                  onPressed: () => Navigator.pop(ctx, (selBook, selChap)),
                                  child: const Text('Go'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            );
          },
        );
      },
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

    // ----- Local state updates -----
    setState(() {
      if (res.noteDelete == true) {
        final m = _ctx.matcher;
        final hereK = _ctx.k(_r(v.$1));

        if (m != null && existsInOther(_ctx, _r(v.$1))) {
          final me = _ctx.keyOf(_r(v.$1));
          final selfCid = m.clusterId(_ctx.canonicalTx(_translation), me);

          final bool isPsalms = me.book == 'Psalms';
          List<VerseKey> counterparts;
          if (isPsalms) {
            final ro = m.matchToOtherRuleOnly(fromTx: _ctx.canonicalTx(_translation), key: me);
            final hasCross = ro.any((x) => x.chapter != me.chapter);
            counterparts = hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
          } else {
            counterparts = m.matchToOther(fromTx: _ctx.canonicalTx(_translation), key: me);
          }

          final cids = <String>{selfCid};
          for (final o in counterparts) {
            cids.add(m.clusterId(_ctx.otherTx, o));
          }
          for (final s in sameTxSiblingsFor(_ctx, _r(v.$1))) {
            cids.add(m.clusterId(_ctx.canonicalTx(_translation), s));
            _hlPerTx[_translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
          }
          for (final cid in cids) {
            _notesShared.remove(cid);
            _hlShared.remove(cid);
          }
          _notesPerTx[_translation]?.remove(hereK);
          _hlPerTx[_translation]?.remove(hereK);
        } else {
          _notesPerTx[_translation]?.remove(hereK);
          _hlPerTx[_translation]?.remove(hereK);
        }
      } else if (res.noteText != null) {
        final txt = res.noteText!.trim();
        final m = _ctx.matcher;

        if (txt.isEmpty) {
          final hereK = _ctx.k(_r(v.$1));
          if (m != null && existsInOther(_ctx, _r(v.$1))) {
            final me = _ctx.keyOf(_r(v.$1));
            final selfCid = m.clusterId(_ctx.canonicalTx(_translation), me);

            final bool isPsalms = me.book == 'Psalms';
            List<VerseKey> counterparts;
            if (isPsalms) {
              final ro = m.matchToOtherRuleOnly(fromTx: _ctx.canonicalTx(_translation), key: me);
              final hasCross = ro.any((x) => x.chapter != me.chapter);
              counterparts = hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
            } else {
              counterparts = m.matchToOther(fromTx: _ctx.canonicalTx(_translation), key: me);
            }

            final cids = <String>{selfCid};
            for (final o in counterparts) {
              cids.add(m.clusterId(_ctx.otherTx, o));
            }
            for (final s in sameTxSiblingsFor(_ctx, _r(v.$1))) {
              cids.add(m.clusterId(_ctx.canonicalTx(_translation), s));
              _hlPerTx[_translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
            }

            for (final cid in cids) {
              _notesShared.remove(cid);
              _hlShared.remove(cid);
            }
            _notesPerTx[_translation]?.remove(hereK);
            _hlPerTx[_translation]?.remove(hereK);
          } else {
            _notesPerTx[_translation]?.remove(hereK);
            _hlPerTx[_translation]?.remove(hereK);
          }
        } else {
          if (m != null && existsInOther(_ctx, _r(v.$1))) {
            final cid = m.clusterId(_ctx.canonicalTx(_translation), _ctx.keyOf(_r(v.$1)));
            _notesShared[cid] = txt;
            for (final tx in _notesPerTx.keys) {
              _notesPerTx[tx]?.remove(_ctx.k(_r(v.$1)));
            }
            for (final s in sameTxSiblingsFor(_ctx, _r(v.$1))) {
              _notesPerTx[_translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
            }
          } else {
            _notesPerTx[_translation]?[_ctx.k(_r(v.$1))] = txt;
          }
        }
      }

      // HIGHLIGHTS
      if (res.highlight != null) {
        final color = res.highlight!;
        final hereK = _ctx.k(_r(v.$1));

        final m = _ctx.matcher;
        final mapsAcross = m != null && existsInOther(_ctx, _r(v.$1));

        if (!mapsAcross) {
          if (color == HighlightColor.none) {
            _hlPerTx[_translation]?.remove(hereK);
          } else {
            _hlPerTx[_translation]?[hereK] = color;
          }
        } else {
          final cid = (m!).clusterId(_ctx.canonicalTx(_translation), _ctx.keyOf(_r(v.$1)));
          if (color == HighlightColor.none) {
            _hlShared.remove(cid);
          } else {
            _hlShared[cid] = color;
          }
          for (final tx in _hlPerTx.keys) {
            _hlPerTx[tx]?.remove(hereK);
          }
          for (final s in sameTxSiblingsFor(_ctx, _r(v.$1))) {
            final kStr = '${s.book}|${s.chapter}|${s.verse}';
            if (color == HighlightColor.none) {
              _hlPerTx[_translation]?.remove(kStr);
            } else {
              _hlPerTx[_translation]?[kStr] = color;
            }
          }
        }
      }
    });

    // ----- Server write-throughs (fail-soft) -----
    try {
      final m = _ctx.matcher;
      final cid = m?.clusterId(_ctx.canonicalTx(_translation), _ctx.keyOf(_r(v.$1)));
      String? id = (cid != null ? _noteIdByCluster[cid] : null) ?? _noteIdByKey[_ctx.k(_r(v.$1))];

      if (kDebugMode) {
        debugPrint('[WriteThrough] ref=${_ctx.k(_r(v.$1))} cid=${cid ?? "-"} id=${id ?? "-"} '
            'noteDelete=${res.noteDelete} noteLen=${(res.noteText ?? "").length} '
            'hl=${res.highlight?.name}');
      }

      if (res.noteDelete == true) {
        if (id != null && id.startsWith('temp_')) {
          await api.NotesApi.drainOutbox();
          await syncFetchChapterNotes(_ctx, book: _book, chapter: _chapter);
          id = (cid != null ? _noteIdByCluster[cid] : null) ?? _noteIdByKey[_ctx.k(_r(v.$1))];
        }

        if (id != null) {
          if (kDebugMode) debugPrint('[WriteThrough] DELETE note id=$id');
          await api.NotesApi.delete(id);
          if (cid != null) _noteIdByCluster.remove(cid);
          _noteIdByKey.remove(_ctx.k(_r(v.$1)));
        }
      } else if (res.noteText != null) {
        final txt = (res.noteText ?? '').trim();
        if (txt.isNotEmpty) {
          if (id == null) {
            if (kDebugMode) debugPrint('[WriteThrough] CREATE note');
            final created = await api.NotesApi.create(
              bh.RemoteNote(
                id: 'new',
                book: v.$1.book,
                chapter: v.$1.chapter,
                verseStart: v.$1.verse,
                verseEnd: null,
                note: txt,
                color: null, // toCreateJson() may default this to yellow.
                createdAt: null,
                updatedAt: null,
              ),
            );
            _noteIdByKey[_ctx.k(_r(v.$1))] = created.id;
            if (cid != null) _noteIdByCluster[cid] = created.id;
          } else {
            if (kDebugMode) debugPrint('[WriteThrough] UPDATE note id=$id');
            await api.NotesApi.update(id, note: txt);
          }
        } else {
          if (id != null) {
            if (kDebugMode) {
              debugPrint('[WriteThrough] DELETE note (empty text) id=$id');
            }
            await api.NotesApi.delete(id);
            if (cid != null) _noteIdByCluster.remove(cid);
            _noteIdByKey.remove(_ctx.k(_r(v.$1)));
          }
        }
      }

      // Highlight upsert/clear
      if (res.highlight != null) {
        final color = res.highlight!;
        final sc = HighlightCodec.toServer(color); // -> bh.ServerHighlight?
        final cid2 = m?.clusterId(_ctx.canonicalTx(_translation), _ctx.keyOf(_r(v.$1)));
        String? id2 = (cid2 != null ? _noteIdByCluster[cid2] : null) ?? _noteIdByKey[_ctx.k(_r(v.$1))];

        if (color != HighlightColor.none) {
          if (id2 == null) {
            if (kDebugMode) debugPrint('[WriteThrough] CREATE highlight');
            final created = await api.NotesApi.create(
              bh.RemoteNote(
                id: 'new',
                book: v.$1.book,
                chapter: v.$1.chapter,
                verseStart: v.$1.verse,
                verseEnd: null,
                note: '',
                color: sc,
                createdAt: null,
                updatedAt: null,
              ),
            );
            _noteIdByKey[_ctx.k(_r(v.$1))] = created.id;
            if (cid2 != null) _noteIdByCluster[cid2] = created.id;
          } else {
            if (kDebugMode) {
              debugPrint('[WriteThrough] UPDATE highlight id=$id2 -> ${sc?.name}');
            }
            await api.NotesApi.update(id2, color: sc);
          }
        } else {
          final existingTxt =
              (_notesPerTx[_translation]?[_ctx.k(_r(v.$1))] ?? _notesShared[cid2 ?? ''] ?? '').trim();
          if (existingTxt.isEmpty && id2 != null) {
            if (kDebugMode) debugPrint('[WriteThrough] DELETE row (clear highlight) id=$id2');
            await api.NotesApi.delete(id2);
            if (cid2 != null) _noteIdByCluster.remove(cid2);
            _noteIdByKey.remove(_ctx.k(_r(v.$1)));
          }
        }
      }
    } catch (e, st) {
      debugPrint('[WriteThrough] failed: $e');
      debugPrint('$st');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tLabel = _translation.toUpperCase();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
          child: IconButtonTheme(
            data: IconButtonThemeData(
              style: ButtonStyle(
                foregroundColor: WidgetStateProperty.resolveWith<Color?>((states) {
                  final base = Theme.of(context).colorScheme.onSurface;
                  return states.contains(WidgetState.disabled)
                      ? base.withValues(alpha: 0.35)
                      : base.withValues(alpha: 0.7);
                }),
              ),
            ),
            child: IconTheme(
              data: IconThemeData(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
              ),
              child: Row(
                children: [
                  IconButton(
                    tooltip: 'Previous chapter',
                    onPressed: _isAtFirstChapter ? null : _prevChapter,
                    icon: Icon(
                      Icons.chevron_left,
                      color: _isAtFirstChapter ? Colors.white38 : Colors.white70,
                    ),
                  ),
                  Expanded(
                    flex: 6,
                    child: SizedBox(
                      height: 36,
                      width: double.infinity,
                      child: TextButton(
                        onPressed: _openJumpPicker,
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          backgroundColor: Theme.of(context).colorScheme.surfaceContainerHigh,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: Text(
                          '${_booksReady ? _abbr(_book) : _book} $_chapter',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          softWrap: false,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PopupMenuButton<String>(
                    tooltip: 'Translation',
                    initialValue: _translation,
                    onSelected: (val) {
                      setState(() {
                        _translation = val;
                        _ctx.translation = val; // keep logic layer in sync
                        if (_booksReady) {
                          Books.instance.setLocaleCode(_localeForTx(_translation));
                        }
                      });
                      _load();
                    },
                    itemBuilder: (ctx) =>
                        _translations.map((t) => PopupMenuItem(value: t, child: Text(t.toUpperCase()))).toList(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Theme.of(context).dividerColor, width: 1),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(tLabel),
                          const SizedBox(width: 4),
                          const Icon(Icons.arrow_drop_down, size: 18),
                        ],
                      ),
                    ),
                  ),
                  const Spacer(flex: 1),
                  IconButton(
                    tooltip: 'Search',
                    onPressed: null,
                    icon: const Icon(Icons.search, color: Colors.white60),
                  ),
                  IconButton(
                    tooltip: 'Read aloud',
                    onPressed: null,
                    icon: const Icon(Icons.volume_up_outlined, color: Colors.white60),
                  ),
                  IconButton(
                    tooltip: 'Next chapter',
                    onPressed: _isAtLastChapter ? null : _nextChapter,
                    icon: Icon(
                      Icons.chevron_right,
                      color: _isAtLastChapter ? Colors.white38 : Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
          ),
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
                      child: const ListTile(
                        dense: true,
                        leading: Icon(Icons.wifi_off),
                        title: Text('You’re offline'),
                        subtitle: Text('Changes are saved and will sync later.'),
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
