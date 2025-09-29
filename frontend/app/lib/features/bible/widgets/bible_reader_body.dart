// -----------------------------------------------------------------------------
// Main body for the bible reader. Displays a chapter, lets users highlight and
// add notes, jump around, and switch translations. Syncs notes/highlights to the
// backend per verse; clusters are applied on read to mirror across translations.
// -----------------------------------------------------------------------------

import 'package:flutter/material.dart';
import '../data/bible_repo_elisha.dart';
import 'flowing_chapter_text.dart';
import '../data/verse_matching.dart' show VerseMatching, VerseKey;
import '../data/books.dart';
import '../data/elisha_json_source.dart';

// Debug logging (visible in flutter run console)
import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

// Server syncing client
import '../data/notes_api.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:async';

import 'package:app/helpers/bible_notes_helper.dart';

/// List of possible highlight colors, matching what the API supports
enum HighlightColor { none, blue, red, yellow, green, purple }

/// Converts colors between different formats
extension HighlightColorServerCodec on HighlightColor {
  String? get apiValue => switch (this) {
    HighlightColor.none => null,
    HighlightColor.blue => 'blue',
    HighlightColor.red => 'red',
    HighlightColor.yellow => 'yellow',
    HighlightColor.green => 'green',
    HighlightColor.purple => 'purple',
  };

  static HighlightColor fromApi(String? s) {
    switch ((s ?? '').toLowerCase()) {
      case 'blue':
        return HighlightColor.blue;
      case 'red':
        return HighlightColor.red;
      case 'yellow':
        return HighlightColor.yellow;
      case 'green':
        return HighlightColor.green;
      case 'purple':
        return HighlightColor.purple;
      default:
        return HighlightColor.none;
    }
  }
}

/// Stores information for what should be displayed in the reader
/// Translation, Book, and Chapter are needed to display the correct verses
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

/// Stores more necessary information for the reader
/// Visible Verses, Translation Remapping, Notes/Highlights
class _BibleReaderBodyState extends State<BibleReaderBody> {
  // Persistent ScrollController for search navigation and chapter jumps
  final ScrollController scrollController = ScrollController();

  // Returns all verses for the current translation and book, across all chapters
  // TODO: Properly load all verses from all chapters asynchronously
  List<(VerseRef ref, String text)> _allVerses() {
    // For now, just return current chapter's verses to avoid async errors
    return _verses;
  }
  // Highlights occurrences of searchText in the given text
  Widget _highlightText(String text, String searchText) {
    if (searchText.isEmpty) return Text(text);
    final matches = <TextSpan>[];
    final lowerText = text.toLowerCase();
    final lowerSearch = searchText.toLowerCase();
    int start = 0;
    while (true) {
      final index = lowerText.indexOf(lowerSearch, start);
      if (index < 0) {
        matches.add(TextSpan(text: text.substring(start)));
        break;
      }
      if (index > start) {
        matches.add(TextSpan(text: text.substring(start, index)));
      }
      matches.add(TextSpan(
        text: text.substring(index, index + searchText.length),
        style: const TextStyle(backgroundColor: Color(0xFFFFF59D), fontWeight: FontWeight.bold),
      ));
      start = index + searchText.length;
    }
    return RichText(text: TextSpan(style: const TextStyle(color: Colors.black), children: matches));
  }
  final _repo = ElishaBibleRepo();

  // Current view
  late String _translation;
  late String _book;
  late int _chapter;

  VerseMatching? _matcher;
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

  // TODO: listen for server-sync events + auth changes
  StreamSubscription? _notesSyncSub; // TODO
  StreamSubscription<User?>? _authSub; // TODO

  String _k(VerseRef r) => '${r.book}|${r.chapter}|${r.verse}';
  String _canonicalTx(String tx) {
    final t = tx.trim().toLowerCase();
    if (t == 'asv' || t == 'web') return 'kjv';
    return t;
  }

  String get _otherTx => _canonicalTx(_translation) == 'kjv' ? 'rst' : 'kjv';

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

  VerseRef? _tempAnimatedHighlight;

  

  @override
  void initState() {
    super.initState();

    // Books catalog
    Books.instance.ensureLoaded().then((_) {
      if (!mounted) return;
      Books.instance.setLocaleCode(_localeForTx(widget.initialTranslation));
      _booksReady = true;
      setState(() {});
    });

    _translation = widget.initialTranslation;
    _book = widget.initialBook;
    _chapter = widget.initialChapter;

    if (kDebugMode) {
      debugPrint('[BibleReader] boot -> $_translation $_book:$_chapter');
    }

    // NOTE: _load() now ensures VerseMatching is ready BEFORE hydrating server notes.
    _load();

    // TODO: kick a drain when the Bible page opens (if already signed in)
    final u = FirebaseAuth.instance.currentUser;
    if (u != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        NotesApi.drainOutbox();
      });
    }

    // TODO: also drain if the user signs in while this page is open
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) NotesApi.drainOutbox();
    });

    // TODO: refresh indices automatically when outbox/direct writes finish
    _notesSyncSub = NotesApi.onSynced.listen((_) async {
      await _syncFetchChapterNotes();
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _notesSyncSub?.cancel();
    _authSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    await ElishaBibleRepo.ensureInitialized();

    if (kDebugMode) {
      debugPrint(
        '[BibleReader] getChapter tx=$_translation book=$_book ch=$_chapter',
      );
    }

    final data = await _repo.getChapter(
      translation: _translation,
      book: _book,
      chapter: _chapter,
    );
    if (!mounted) return;
    setState(() => _verses = data);

    // Load runs (headings/sections) for the current chapter from the source
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

    // --- FIX: ensure matcher before we hydrate from server, then normalize ---
    if (_matcher == null) {
      if (kDebugMode) debugPrint('[BibleReader] loading VerseMatching…');
      _matcher = await VerseMatching.load();
      _promoteLocalToShared(); // lift any pre-existing per-tx entries into shared clusters
    }

    await _syncFetchChapterNotes();
    if (mounted) setState(() {});
  }

  VerseKey _keyOf(VerseRef r) => (
    book: r.book,
    chapter: r.chapter,
    verse: r.verse,
  );

  bool _existsInOther(VerseRef ref) {
    final m = _matcher;
    if (m == null) return false;
    return m.existsInOther(
      fromTx: _canonicalTx(_translation),
      key: _keyOf(ref),
    );
  }

  Iterable<VerseKey> _sameTxSiblingsFor(VerseRef ref) {
    final m = _matcher;
    if (m == null) return const <VerseKey>[];

    final me = _keyOf(ref);
    final fromTx = _canonicalTx(_translation);
    final otherTx = _otherTx;

    List<VerseKey> toOther;
    if (me.book == 'Psalms') {
      final ro = m.matchToOtherRuleOnly(fromTx: fromTx, key: me);
      toOther = ro.where((x) => x.chapter != me.chapter).toList();
    } else {
      toOther = m.matchToOther(fromTx: fromTx, key: me);
    }

    final siblings = <String, VerseKey>{};
    for (final t in toOther) {
      final back =
          (me.book == 'Psalms')
              ? m.matchToOtherRuleOnly(fromTx: otherTx, key: t)
              : m.matchToOther(fromTx: otherTx, key: t);
      for (final s in back) {
        if (s.book == me.book &&
            !(s.chapter == me.chapter && s.verse == me.verse)) {
          siblings['${s.book}|${s.chapter}|${s.verse}'] = s;
        }
      }
    }
    return siblings.values;
  }

  void _promoteLocalToShared() {
    final m = _matcher;
    if (m == null) return;

    for (final tx in _hlPerTx.keys) {
      final per = _hlPerTx[tx]!;
      for (final e in per.entries.toList()) {
        final p = e.key.split('|');
        if (p.length != 3) continue;
        final k = (
          book: p[0],
          chapter: int.tryParse(p[1]) ?? 0,
          verse: int.tryParse(p[2]) ?? 0,
        );
        if (m.existsInOther(fromTx: _canonicalTx(tx), key: k)) {
          final cid = m.clusterId(_canonicalTx(tx), k);
          _hlShared[cid] = e.value;
          per.remove(e.key);
        }
      }
    }

    for (final tx in _notesPerTx.keys) {
      final per = _notesPerTx[tx]!;
      for (final e in per.entries.toList()) {
        final p = e.key.split('|');
        if (p.length != 3) continue;
        final k = (
          book: p[0],
          chapter: int.tryParse(p[1]) ?? 0,
          verse: int.tryParse(p[2]) ?? 0,
        );
        if (m.existsInOther(fromTx: _canonicalTx(tx), key: k)) {
          final cid = m.clusterId(_canonicalTx(tx), k);
          _notesShared[cid] = e.value;
          per.remove(e.key);
        }
      }
    }
  }


  /// ===== Server sync (read) =====
  Future<void> _syncFetchChapterNotes() async {
  _noteIdByKey.clear();
  _noteIdByCluster.clear();
  if (kDebugMode) debugPrint('[DEBUG] _syncFetchChapterNotes called for $_book $_chapter');

    // Belt & suspenders: never write unmapped data if matcher isn't ready
    final m = _matcher;
    if (m == null) {
      if (kDebugMode) debugPrint('[Sync.Read] matcher not ready; deferring hydration');
      return;
    }

    final bookCanon = _book;
    final c = _chapter;
    final start = (c - 1) < 1 ? 1 : (c - 1);
    final end = c + 1;

    try {
      if (kDebugMode) {
        debugPrint('[Sync.Read] $bookCanon ch=$c window=[$start..$end] tx=$_translation');
      }

      final items = await getNotesForChapterRange(
        book: bookCanon,
        chapterStart: start,
        chapterEnd: end,
      );

      if (kDebugMode) debugPrint('[DEBUG] Notes fetched: count=${items.length}');
      for (final rn in items) {
        debugPrint('[DEBUG] Note: id=${rn.id} book=${rn.book} ch=${rn.chapter} v=${rn.verseStart} note="${rn.note}" color=${rn.color}');
      }

      items.sort((a, b) {
        final ax =
            a.updatedAt ??
            a.createdAt ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final bx =
            b.updatedAt ??
            b.createdAt ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return ax.compareTo(bx);
      });

      for (final rn in items) {
        final String serverTx = 'kjv';
        final s = rn.verseStart;
        final e = rn.verseEnd ?? rn.verseStart;
        final color = HighlightColorServerCodec.fromApi(rn.color?.name);
        final noteText = rn.note;
        for (int v = s; v <= e; v++) {
          final key = '$bookCanon|${rn.chapter}|$v';
          _noteIdByKey[key] = rn.id;
          final cid = m.clusterId(
            serverTx,
            (book: bookCanon, chapter: rn.chapter, verse: v),
          );
          _noteIdByCluster[cid] = rn.id;
          if (noteText.isNotEmpty) _notesShared[cid] = noteText;
          if (color != HighlightColor.none) _hlShared[cid] = color;
          _notesPerTx[_translation]?.remove(key);
          _hlPerTx[_translation]?.remove(key);
        }
      }
      if (kDebugMode) debugPrint('[DEBUG] _notesShared keys: ${_notesShared.keys.toList()}');
      if (kDebugMode) debugPrint('[DEBUG] _notesPerTx keys: ${_notesPerTx[_translation]?.keys.toList()}');
    } catch (e, st) {
      debugPrint('[_syncFetchChapterNotes] failed: $e');
      debugPrint('$st');
    }
  }

  /// Sends selected color values to the backend API
  ServerHighlight? _serverFromUi(HighlightColor c) => switch (c) {
    HighlightColor.blue => ServerHighlight.blue,
    HighlightColor.red => ServerHighlight.red,
    HighlightColor.yellow => ServerHighlight.yellow,
    HighlightColor.green => ServerHighlight.green,
    HighlightColor.purple => ServerHighlight.purple,
    HighlightColor.none => null,
  };

  // ===== Effective lookups =====
  HighlightColor _colorFor(VerseRef ref) {
    final m = _matcher;

    if (m != null) {
      final selfCid = m.clusterId(_canonicalTx(_translation), _keyOf(ref));
      final cSelf = _hlShared[selfCid];
      if (cSelf != null) return cSelf;

      final me = _keyOf(ref);
      final bool isPsalms = me.book == 'Psalms';
      List<VerseKey> counterparts;
      if (isPsalms) {
        final ro = m.matchToOtherRuleOnly(
          fromTx: _canonicalTx(_translation),
          key: me,
        );
        final hasCross = ro.any((x) => x.chapter != me.chapter);
        counterparts =
            hasCross
                ? ro.where((x) => x.chapter != me.chapter).toList()
                : const <VerseKey>[];
      } else {
        counterparts = m.matchToOther(
          fromTx: _canonicalTx(_translation),
          key: me,
        );
      }
      for (final other in counterparts) {
        final otherCid = m.clusterId(_otherTx, other);
        final cOther = _hlShared[otherCid];
        if (cOther != null) return cOther;
      }
    }

    final local = _hlPerTx[_translation]?[_k(ref)];
    if (local != null && local != HighlightColor.none) return local;
    for (final s in _sameTxSiblingsFor(ref)) {
      final kStr = '${s.book}|${s.chapter}|${s.verse}';
      final c = _hlPerTx[_translation]?[kStr];
      if (c != null && c != HighlightColor.none) return c;
    }
    return HighlightColor.none;
  }

  String? _noteFor(VerseRef ref) {
    final m = _matcher;
    if (m != null) {
      final selfCid = m.clusterId(_canonicalTx(_translation), _keyOf(ref));
      final sSelf = _notesShared[selfCid];
      if (sSelf != null && sSelf.isNotEmpty) return sSelf;

      final me = _keyOf(ref);
      final bool isPsalms = me.book == 'Psalms';
      List<VerseKey> counterparts;
      if (isPsalms) {
        final ro = m.matchToOtherRuleOnly(
          fromTx: _canonicalTx(_translation),
          key: me,
        );
        final hasCross = ro.any((x) => x.chapter != me.chapter);
        counterparts =
            hasCross
                ? ro.where((x) => x.chapter != me.chapter).toList()
                : const <VerseKey>[];
      } else {
        counterparts = m.matchToOther(
          fromTx: _canonicalTx(_translation),
          key: me,
        );
      }
      for (final other in counterparts) {
        final otherCid = m.clusterId(_otherTx, other);
        final sOther = _notesShared[otherCid];
        if (sOther != null && sOther.isNotEmpty) return sOther;
      }
      for (final sib in _sameTxSiblingsFor(ref)) {
        final sibCid = m.clusterId(_canonicalTx(_translation), sib);
        final sSib = _notesShared[sibCid];
        if (sSib != null && sSib.isNotEmpty) return sSib;
      }
    }
    return _notesPerTx[_translation]?[_k(ref)];
  }

  /// Used for disabling back button when at first chapter
  bool get _isAtFirstChapter {
    if (!_booksReady) return true;
    final i = _bookIndex(_book);
    return _chapter == 1 && i == 0;
  }

  /// Used for disabling forward button when at first chapter
  bool get _isAtLastChapter {
    if (!_booksReady) return true;
    final i = _bookIndex(_book);
    final lastBookIndex = _bookNames.length - 1;
    return _chapter == _chapterCount(_book) && i == lastBookIndex;
  }

  /// Traverses chapters in a book
  /// Wraps around chapters when entering a new book
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

  /// Opens the popup for selecting books/chapters
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
                                  Text(
                                    'Jump to',
                                    style: Theme.of(ctx).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 12),
                                  DropdownButtonFormField<String>(
                                    value: selBook,
                                    isExpanded: true,
                                    decoration: const InputDecoration(
                                      labelText: 'Book',
                                      border: OutlineInputBorder(),
                                    ),
                                    items:
                                        _bookNames
                                            .map(
                                              (b) => DropdownMenuItem(
                                                value: b,
                                                child: Text(b),
                                              ),
                                            )
                                            .toList(),
                                    onChanged: (b) {
                                      if (b == null) return;
                                      setSheet(() {
                                        selBook = b;
                                        selChap = 1;
                                      });
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      'Chapter',
                                      style: Theme.of(ctx).textTheme.labelLarge,
                                    ),
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
                                        onSelected:
                                            (_) => setSheet(() => selChap = c),
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
                                  onPressed:
                                      () => Navigator.pop(ctx, (
                                        selBook,
                                        selChap,
                                      )),
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

  /// Opens the note taking popup and handles interactions
  Future<void> _openActions((VerseRef ref, String text) v) async {
    final res = await showModalBottomSheet<_ActionResult>(
      context: context,
      isScrollControlled: true,
      builder:
          (ctx) => _VerseActionsSheet(
            verseLabel: v.$1.toString(),
            currentHighlight: _colorFor(v.$1),
            existingNote: _noteFor(v.$1),
          ),
    );
    if (res == null) return;

    // ----- Local state updates -----
    setState(() {
      if (res.noteDelete == true) {
        final m = _matcher;
        final hereK = _k(v.$1);

        if (m != null && _existsInOther(v.$1)) {
          final me = _keyOf(v.$1);
          final selfCid = m.clusterId(_canonicalTx(_translation), me);

          final bool isPsalms = me.book == 'Psalms';
          List<VerseKey> counterparts;
          if (isPsalms) {
            final ro = m.matchToOtherRuleOnly(
              fromTx: _canonicalTx(_translation),
              key: me,
            );
            final hasCross = ro.any((x) => x.chapter != me.chapter);
            counterparts =
                hasCross
                    ? ro.where((x) => x.chapter != me.chapter).toList()
                    : const <VerseKey>[];
          } else {
            counterparts = m.matchToOther(
              fromTx: _canonicalTx(_translation),
              key: me,
            );
          }

          final cids = <String>{selfCid};
          for (final o in counterparts) {
            cids.add(m.clusterId(_otherTx, o));
          }
          for (final s in _sameTxSiblingsFor(v.$1)) {
            cids.add(m.clusterId(_canonicalTx(_translation), s));
            _hlPerTx[_translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
          }
          // Clear shared note + highlight for all related clusters
          for (final cid in cids) {
            _notesShared.remove(cid);
            _hlShared.remove(cid);
          }
          // Clear per-tx at the tapped verse
          _notesPerTx[_translation]?.remove(hereK);
          _hlPerTx[_translation]?.remove(hereK);
        } else {
          _notesPerTx[_translation]?.remove(hereK);
          _hlPerTx[_translation]?.remove(hereK);
        }
      } else if (res.noteText != null) {
        final txt = res.noteText!.trim();
        final m = _matcher;

        if (txt.isEmpty) {
          final hereK = _k(v.$1);
          if (m != null && _existsInOther(v.$1)) {
            final me = _keyOf(v.$1);
            final selfCid = m.clusterId(_canonicalTx(_translation), me);

            final bool isPsalms = me.book == 'Psalms';
            List<VerseKey> counterparts;
            if (isPsalms) {
              final ro = m.matchToOtherRuleOnly(
                fromTx: _canonicalTx(_translation),
                key: me,
              );
              final hasCross = ro.any((x) => x.chapter != me.chapter);
              counterparts =
                  hasCross
                      ? ro.where((x) => x.chapter != me.chapter).toList()
                      : const <VerseKey>[];
            } else {
              counterparts = m.matchToOther(
                fromTx: _canonicalTx(_translation),
                key: me,
              );
            }

            final cids = <String>{selfCid};
            for (final o in counterparts) {
              cids.add(m.clusterId(_otherTx, o));
            }
            for (final s in _sameTxSiblingsFor(v.$1)) {
              cids.add(m.clusterId(_canonicalTx(_translation), s));
              _hlPerTx[_translation]?.remove(
                '${s.book}|${s.chapter}|${s.verse}',
              );
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
          if (m != null && _existsInOther(v.$1)) {
            final cid = m.clusterId(_canonicalTx(_translation), _keyOf(v.$1));
            _notesShared[cid] = txt;
            for (final tx in _notesPerTx.keys) {
              _notesPerTx[tx]?.remove(_k(v.$1));
            }
            for (final s in _sameTxSiblingsFor(v.$1)) {
              _notesPerTx[_translation]?.remove(
                '${s.book}|${s.chapter}|${s.verse}',
              );
            }
          } else {
            _notesPerTx[_translation]?[_k(v.$1)] = txt;
          }
        }
      }

      // HIGHLIGHTS
      if (res.highlight != null) {
        final color = res.highlight!;
        final hereK = _k(v.$1);

        final m = _matcher;
        final mapsAcross = m != null && _existsInOther(v.$1);

        if (!mapsAcross) {
          if (color == HighlightColor.none) {
            _hlPerTx[_translation]?.remove(hereK);
          } else {
            _hlPerTx[_translation]?[hereK] = color;
          }
        } else {
          final cid = m.clusterId(_canonicalTx(_translation), _keyOf(v.$1));
          if (color == HighlightColor.none) {
            _hlShared.remove(cid);
          } else {
            _hlShared[cid] = color;
          }
          for (final tx in _hlPerTx.keys) {
            _hlPerTx[tx]?.remove(hereK);
          }
          for (final s in _sameTxSiblingsFor(v.$1)) {
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
      final m = _matcher;
      final cid = m?.clusterId(_canonicalTx(_translation), _keyOf(v.$1));
      String? id =
          (cid != null ? _noteIdByCluster[cid] : null) ??
          _noteIdByKey[_k(v.$1)];

      if (kDebugMode) {
        debugPrint(
          '[WriteThrough] ref=${_k(v.$1)} cid=${cid ?? "-"} id=${id ?? "-"} '
          'noteDelete=${res.noteDelete} noteLen=${(res.noteText ?? "").length} '
          'hl=${res.highlight?.name}',
        );
      }

      if (res.noteDelete == true) {
        if (id != null && id.startsWith('temp_')) {
          await NotesApi.drainOutbox();
          await _syncFetchChapterNotes();
          id =
              (cid != null ? _noteIdByCluster[cid] : null) ??
              _noteIdByKey[_k(v.$1)];
        }

        if (id != null) {
          if (kDebugMode) debugPrint('[WriteThrough] DELETE note id=$id');
          await NotesApi.delete(id);
          if (cid != null) _noteIdByCluster.remove(cid);
          _noteIdByKey.remove(_k(v.$1));
        }
      } else if (res.noteText != null) {
        final txt = (res.noteText ?? '').trim();
        if (txt.isNotEmpty) {
          if (id == null) {
            if (kDebugMode) debugPrint('[WriteThrough] CREATE note');
            final created = await NotesApi.create(
              RemoteNote(
                id: 'new',
                book: v.$1.book,
                chapter: v.$1.chapter,
                verseStart: v.$1.verse,
                verseEnd: null,
                note: txt,
                color: null, // toCreateJson() will default this to yellow.
              ),
            );
            _noteIdByKey[_k(v.$1)] = created.id;
            if (cid != null) _noteIdByCluster[cid] = created.id;
          } else {
            if (kDebugMode) debugPrint('[WriteThrough] UPDATE note id=$id');
            await NotesApi.update(id, note: txt);
          }
        } else {
          if (id != null) {
            if (kDebugMode) {
              debugPrint('[WriteThrough] DELETE note (empty text) id=$id');
            }
            await NotesApi.delete(id);
            if (cid != null) _noteIdByCluster.remove(cid);
            _noteIdByKey.remove(_k(v.$1));
          }
        }
      }

      // Highlight upsert/clear
      if (res.highlight != null) {
        final color = res.highlight!;
        final sc = _serverFromUi(color);
        final cid2 = m?.clusterId(_canonicalTx(_translation), _keyOf(v.$1));
        String? id2 =
            (cid2 != null ? _noteIdByCluster[cid2] : null) ??
            _noteIdByKey[_k(v.$1)];

        if (color != HighlightColor.none) {
          if (id2 == null) {
            if (kDebugMode) debugPrint('[WriteThrough] CREATE highlight');
            final created = await NotesApi.create(
              RemoteNote(
                id: 'new',
                book: v.$1.book,
                chapter: v.$1.chapter,
                verseStart: v.$1.verse,
                verseEnd: null,
                note: '',
                color: sc, // explicit valid color
              ),
            );
            _noteIdByKey[_k(v.$1)] = created.id;
            if (cid2 != null) _noteIdByCluster[cid2] = created.id;
          } else {
            if (kDebugMode) {
              debugPrint(
                '[WriteThrough] UPDATE highlight id=$id2 -> ${sc?.name}',
              );
            }
            await NotesApi.update(id2, color: sc);
          }
        } else {
          final existingTxt =
              (_notesPerTx[_translation]?[_k(v.$1)] ??
                      _notesShared[cid2 ?? ''] ??
                      '')
                  .trim();
          if (existingTxt.isEmpty && id2 != null) {
            if (kDebugMode)
              debugPrint('[WriteThrough] DELETE row (clear highlight) id=$id2');
            await NotesApi.delete(id2);
            if (cid2 != null) _noteIdByCluster.remove(cid2);
            _noteIdByKey.remove(_k(v.$1));
          }
        }
      }
    } catch (e, st) {
      debugPrint('[WriteThrough] failed: $e');
      debugPrint('$st');
    }
  }

  /// Renders the header bar and its elements
  /// Chapter Jump, Navigation, Voice, Search
  @override
  Widget build(BuildContext context) {
    final tLabel = _translation.toUpperCase();

  // Use persistent scrollController
    // Helper for searching chapter names (all books)
    List<String> chapterNames() {
      if (!_booksReady) return [];
      final names = <String>[];
      for (final book in _bookNames) {
        final chapters = _chapterCount(book);
        for (int i = 1; i <= chapters; i++) {
          names.add('$book $i');
        }
      }
      return names;
    }

    void highlightAndScroll(VerseRef ref) {
      setState(() {
        _tempAnimatedHighlight = ref;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final verseIndex = _verses.indexWhere((v) => v.$1 == ref);
        if (verseIndex != -1) {
          final offset = verseIndex * 72.0; // Increased for more accurate scrolling
          scrollController.animateTo(
            offset,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeInOut,
          );
        }
        Future.delayed(const Duration(seconds: 1), () {
          if (mounted) setState(() => _tempAnimatedHighlight = null);
        });
      });
    }

    // Helper for searching user notes (perTx and shared)


    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
          child: IconButtonTheme(
            data: IconButtonThemeData(
              style: ButtonStyle(
                foregroundColor: WidgetStateProperty.resolveWith<Color?>((
                  states,
                ) {
                  final base = Theme.of(context).colorScheme.onSurface;
                  return states.contains(WidgetState.disabled)
                      ? base.withValues(alpha: 0.35)
                      : base.withValues(alpha: 0.7);
                }),
              ),
            ),
            child: IconTheme(
              data: IconThemeData(
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.7),
              ),
              child: Row(
                children: [
                  IconButton(
                    tooltip: 'Previous chapter',
                    onPressed: _isAtFirstChapter ? null : _prevChapter,
                    icon: Icon(
                      Icons.chevron_left,
                      color:
                          _isAtFirstChapter ? Colors.white38 : Colors.white70,
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
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          backgroundColor:
                              Theme.of(
                                context,
                              ).colorScheme.surfaceContainerHigh,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
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
                        if (_booksReady) {
                          Books.instance.setLocaleCode(
                            _localeForTx(_translation),
                          );
                        }
                      });
                      _load();
                    },
                    itemBuilder:
                        (ctx) =>
                            _translations
                                .map(
                                  (t) => PopupMenuItem(
                                    value: t,
                                    child: Text(t.toUpperCase()),
                                  ),
                                )
                                .toList(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color:
                            Theme.of(
                              context,
                            ).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: Theme.of(context).dividerColor,
                          width: 1,
                        ),
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
                    onPressed: () async {
                      String searchText = '';
                      int tabIndex = 0;
                      bool searchAllChapters = false;
                      List<String> filteredChapters = [];
                      List<(VerseRef ref, String text)> filteredVerses = [];
                      List<(VerseRef ref, String text)> filteredNotes = [];
                      List<(VerseRef ref, String text)> allBookVerses = [];
                      List<(VerseRef ref, String text)> allBookNotes = [];
                      // Preload all verses and notes for the current book
                      if (_booksReady) {
                        final chapters = _chapterCount(_book);
                        for (int ch = 1; ch <= chapters; ch++) {
                          final data = await _repo.getChapter(
                            translation: _translation,
                            book: _book,
                            chapter: ch,
                          );
                          allBookVerses.addAll(data);
                        }
                        // Fetch all notes for the current book (all chapters)
                        try {
                          final notes = await NotesApi.getNotesForChapterRangeApi(
                            book: _book,
                            chapterStart: 1,
                            chapterEnd: chapters,
                          );
                          for (final rn in notes) {
                            final ref = VerseRef(rn.book, rn.chapter, rn.verseStart);
                            if (rn.note.trim().isNotEmpty) {
                              allBookNotes.add((ref, rn.note));
                            }
                          }
                        } catch (e) {
                          if (kDebugMode) debugPrint('[SearchDialog] Failed to fetch all notes: $e');
                        }
                      }
                      await showDialog(
                        context: context,
                        builder: (context) {
                          return StatefulBuilder(
                            builder: (context, setState) {
                              return AlertDialog(
                                title: const Text('Search Bible'),
                                content: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    TextField(
                                      autofocus: true,
                                      decoration: const InputDecoration(hintText: 'Enter keyword, verse, or chapter'),
                                      onChanged: (value) {
                                        setState(() {
                                          searchText = value;
                                          if (searchText.trim().isEmpty) {
                                            filteredChapters = [];
                                            filteredVerses = [];
                                            filteredNotes = [];
                                            return;
                                          }
                                          // Chapter names
                                          filteredChapters = chapterNames().where((c) => c.toLowerCase().contains(searchText.toLowerCase())).toList();
                                          // Bible content
                                          final versesSource = searchAllChapters ? allBookVerses : _verses;
                                          filteredVerses = versesSource.where((v) {
                                            final matchesText = v.$2.toLowerCase().contains(searchText.toLowerCase()) ||
                                                v.$1.book.toLowerCase().contains(searchText.toLowerCase()) ||
                                                v.$1.chapter.toString().contains(searchText) ||
                                                v.$1.verse.toString().contains(searchText);
                                            return matchesText;
                                          }).toList();
                                          // User notes (all chapters in current book)
                                          filteredNotes = allBookNotes.where((v) =>
                                            v.$1.book.toLowerCase().contains(searchText.toLowerCase()) ||
                                            v.$1.chapter.toString().contains(searchText) ||
                                            v.$1.verse.toString().contains(searchText) ||
                                            v.$2.toLowerCase().contains(searchText.toLowerCase())
                                          ).toList();
                                        });
                                      },
                                    ),
                                    const SizedBox(height: 12),
                                    DefaultTabController(
                                      length: 3,
                                      initialIndex: tabIndex,
                                      child: Column(
                                        children: [
                                          TabBar(
                                            onTap: (i) => setState(() => tabIndex = i),
                                            tabs: [
                                              Tab(
                                                icon: Stack(
                                                  clipBehavior: Clip.none,
                                                  alignment: Alignment.center,
                                                  children: [
                                                    const Icon(Icons.menu_book),
                                                    if (filteredChapters.isNotEmpty)
                                                      Positioned(
                                                        right: -12,
                                                        top: -10,
                                                        child: Container(
                                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                                          decoration: BoxDecoration(
                                                            color: Colors.red,
                                                            borderRadius: BorderRadius.circular(12),
                                                          ),
                                                          constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                                                          child: Text(
                                                            '${filteredChapters.length}',
                                                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                                            textAlign: TextAlign.center,
                                                          ),
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                                text: 'Chapters',
                                              ),
                                              Tab(
                                                icon: Stack(
                                                  clipBehavior: Clip.none,
                                                  alignment: Alignment.center,
                                                  children: [
                                                    const Icon(Icons.format_align_left),
                                                    if (filteredVerses.isNotEmpty)
                                                      Positioned(
                                                        right: -12,
                                                        top: -10,
                                                        child: Container(
                                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                                          decoration: BoxDecoration(
                                                            color: Colors.red,
                                                            borderRadius: BorderRadius.circular(12),
                                                          ),
                                                          constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                                                          child: Text(
                                                            '${filteredVerses.length}',
                                                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                                            textAlign: TextAlign.center,
                                                          ),
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                                text: 'Verses',
                                              ),
                                              Tab(
                                                icon: Stack(
                                                  clipBehavior: Clip.none,
                                                  alignment: Alignment.center,
                                                  children: [
                                                    const Icon(Icons.sticky_note_2),
                                                    if (filteredNotes.isNotEmpty)
                                                      Positioned(
                                                        right: -12,
                                                        top: -10,
                                                        child: Container(
                                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                                          decoration: BoxDecoration(
                                                            color: Colors.red,
                                                            borderRadius: BorderRadius.circular(12),
                                                          ),
                                                          constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                                                          child: Text(
                                                            '${filteredNotes.length}',
                                                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                                            textAlign: TextAlign.center,
                                                          ),
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                                text: 'Notes',
                                              ),
                                            ],
                                            indicatorColor: Colors.blueAccent,
                                            labelColor: Colors.blueAccent,
                                            unselectedLabelColor: Colors.grey,
                                            labelStyle: const TextStyle(fontWeight: FontWeight.bold),
                                          ),
                                          Divider(height: 1, thickness: 1),
                                          SizedBox(
                                            height: 400,
                                            width: 400,
                                            child: IndexedStack(
                                              index: tabIndex,
                                              children: [
                                                // Chapters
                                                Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Divider(height: 1),
                                                    Expanded(
                                                      child: filteredChapters.isEmpty && searchText.isNotEmpty
                                                        ? const Center(child: Text('No chapters found'))
                                                        : ListView.builder(
                                                            itemCount: filteredChapters.length,
                                                            itemBuilder: (context, idx) {
                                                              final chapter = filteredChapters[idx];
                                                              return Card(
                                                                margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                                                                child: ListTile(
                                                                  title: _highlightText(chapter, searchText),
                                                                  trailing: const Icon(Icons.chevron_right),
                                                                  onTap: () {
                                                                    final parts = chapter.split(' ');
                                                                    if (parts.length == 2) {
                                                                      final bookName = parts[0];
                                                                      final chNum = int.tryParse(parts[1]);
                                                                      if (chNum != null) {
                                                                        setState(() {
                                                                          _book = bookName;
                                                                          _chapter = chNum;
                                                                        });
                                                                        _load();
                                                                      }
                                                                    }
                                                                    Navigator.of(context).pop();
                                                                  },
                                                                ),
                                                              );
                                                            },
                                                          ),
                                                    ),
                                                  ],
                                                ),
                                                // Verses
                                                Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Divider(height: 1),
                                                    Padding(
                                                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          const Text('All Chapters'),
                                                          Switch(
                                                            value: searchAllChapters,
                                                            onChanged: (val) {
                                                              setState(() {
                                                                searchAllChapters = val;
                                                                if (searchText.trim().isEmpty) {
                                                                  filteredVerses = [];
                                                                } else {
                                                                  final versesSource = searchAllChapters ? allBookVerses : _verses;
                                                                  filteredVerses = versesSource.where((v) {
                                                                    final matchesText = v.$2.toLowerCase().contains(searchText.toLowerCase()) ||
                                                                        v.$1.book.toLowerCase().contains(searchText.toLowerCase()) ||
                                                                        v.$1.chapter.toString().contains(searchText) ||
                                                                        v.$1.verse.toString().contains(searchText);
                                                                    return matchesText;
                                                                  }).toList();
                                                                }
                                                              });
                                                            },
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                    Expanded(
                                                      child: filteredVerses.isEmpty && searchText.isNotEmpty
                                                        ? const Center(child: Text('No verses found'))
                                                        : ListView.builder(
                                                            itemCount: filteredVerses.length,
                                                            itemBuilder: (context, idx) {
                                                              final verse = filteredVerses[idx];
                                                              return Card(
                                                                margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                                                                child: ListTile(
                                                                  title: _highlightText(verse.$2, searchText),
                                                                  subtitle: Text('${verse.$1.book} ${verse.$1.chapter}:${verse.$1.verse}', style: const TextStyle(fontSize: 12)),
                                                                  trailing: const Icon(Icons.chevron_right),
                                                                  onTap: () {
                                                                    Navigator.of(context).pop();
                                                                    if (_chapter != verse.$1.chapter || _book != verse.$1.book) {
                                                                      setState(() {
                                                                        _book = verse.$1.book;
                                                                        _chapter = verse.$1.chapter;
                                                                      });
                                                                      _load();
                                                                      Future.microtask(() async {
                                                                        int tries = 0;
                                                                        while (_verses.isEmpty && tries < 20) {
                                                                          await Future.delayed(const Duration(milliseconds: 50));
                                                                          tries++;
                                                                        }
                                                                        highlightAndScroll(verse.$1);
                                                                      });
                                                                    } else {
                                                                      highlightAndScroll(verse.$1);
                                                                    }
                                                                  },
                                                                ),
                                                              );
                                                            },
                                                          ),
                                                    ),
                                                  ],
                                                ),
                                                // Notes
                                                Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Divider(height: 1),
                                                    Expanded(
                                                      child: filteredNotes.isEmpty && searchText.isNotEmpty
                                                        ? const Center(child: Text('No notes found'))
                                                        : ListView.builder(
                                                            itemCount: filteredNotes.length,
                                                            itemBuilder: (context, idx) {
                                                              final note = filteredNotes[idx];
                                                              return Card(
                                                                margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                                                                child: ListTile(
                                                                  title: _highlightText(note.$2, searchText),
                                                                  subtitle: Text('${note.$1.book} ${note.$1.chapter}:${note.$1.verse}', style: const TextStyle(fontSize: 12)),
                                                                  trailing: const Icon(Icons.chevron_right),
                                                                  onTap: () {
                                                                    Navigator.of(context).pop();
                                                                    if (_chapter != note.$1.chapter || _book != note.$1.book) {
                                                                      setState(() {
                                                                        _book = note.$1.book;
                                                                        _chapter = note.$1.chapter;
                                                                      });
                                                                      _load();
                                                                      Future.microtask(() async {
                                                                        int tries = 0;
                                                                        while (_verses.isEmpty && tries < 20) {
                                                                          await Future.delayed(const Duration(milliseconds: 50));
                                                                          tries++;
                                                                        }
                                                                        highlightAndScroll(note.$1);
                                                                      });
                                                                    } else {
                                                                      highlightAndScroll(note.$1);
                                                                    }
                                                                  },
                                                                ),
                                                              );
                                                            },
                                                          ),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.of(context).pop(),
                                    child: const Text('Close'),
                                  ),
                                ],
                              );
                            },
                          );
                        },
                      );
                    },
                    icon: const Icon(Icons.search, color: Colors.white60),
                  ),
                  IconButton(
                    tooltip: 'Read aloud',
                    onPressed: null,
                    icon: const Icon(
                      Icons.volume_up_outlined,
                      color: Colors.white60,
                    ),
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
          child:
              _verses.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                      child: FlowingChapterText(
                        verses: _verses,
                        // highlights: {
                        //   for (final v in _verses) v.$1: _colorFor(v.$1),
                        // },
                        highlights: {
                          for (final v in _verses)
                            v.$1: (_tempAnimatedHighlight != null && v.$1 == _tempAnimatedHighlight)
                              ? HighlightColor.yellow
                              : _colorFor(v.$1),
                        },
                        onTapVerse: (vt) => _openActions(vt),
                        baseStyle: Theme.of(context).textTheme.bodyLarge
                            ?.copyWith(fontSize: 16, height: 1.6),
                        runs: _currentRuns,
                        verseBlocks: _currentBlocks,
                      ),
                    ),
        ),
      ],
    );
  }
}

/// Stores whatever actions the user takes while in the notetaking menu
class _ActionResult {
  final HighlightColor? highlight;
  final String? noteText;
  final bool? noteDelete;
  _ActionResult({this.highlight, this.noteText, this.noteDelete});
}

/// UI Elements for the note taking menu
class _VerseActionsSheet extends StatefulWidget {
  const _VerseActionsSheet({
    required this.verseLabel,
    required this.currentHighlight,
    this.existingNote,
  });
  final String verseLabel;
  final HighlightColor currentHighlight;
  final String? existingNote;

  @override
  State<_VerseActionsSheet> createState() => _VerseActionsSheetState();
}

class _VerseActionsSheetState extends State<_VerseActionsSheet> {
  late HighlightColor _pick = widget.currentHighlight;
  late final _note = TextEditingController(text: widget.existingNote ?? '');
  bool get _canEditNote => _pick != HighlightColor.none;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 12,
          bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.verseLabel,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),

            // ---- Highlight picker ----
            Align(
              alignment: Alignment.centerLeft,
              child: const Text('Highlight'),
            ),
            const SizedBox(height: 8),

            Wrap(
              spacing: 10,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                for (final c in HighlightColor.values.where(
                  (c) => c != HighlightColor.none,
                ))
                  InkWell(
                    onTap: () => setState(() => _pick = c),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: {
                          HighlightColor.blue: Colors.lightBlueAccent,
                          HighlightColor.red: Colors.redAccent,
                          HighlightColor.yellow: Colors.yellow,
                          HighlightColor.green: Colors.lightGreenAccent,
                          HighlightColor.purple: Colors.purpleAccent,
                        }[c]!.withOpacity(.9),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _pick == c ? Colors.black87 : Colors.black26,
                          width: _pick == c ? 2 : 1,
                        ),
                      ),
                    ),
                  ),
              ],
            ),

            const Divider(height: 24),

          // ---- Note field (gated by highlight) ----
          Align(alignment: Alignment.centerLeft, child: const Text('Note')),
          const SizedBox(height: 8),
          TextField(
            controller: _note,
            enabled: _canEditNote, // greyed out until a color is picked
            minLines: 3,
            maxLines: 6,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Write a note for this verse…',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),

            Row(
              children: [
                // Delete All is always visible now
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed:
                        () => Navigator.pop(
                          context,
                          _ActionResult(noteDelete: true),
                        ),
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Delete All'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      // If text editing is disabled, ignore any controller text
                      final String? textToSend =
                          _canEditNote ? _note.text : null;

                      Navigator.pop(
                        context,
                        _ActionResult(highlight: _pick, noteText: textToSend),
                      );
                    },
                    child: const Text('Save'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// Translations selectable
const List<String> _translations = ['kjv', 'asv', 'web', 'rst'];
