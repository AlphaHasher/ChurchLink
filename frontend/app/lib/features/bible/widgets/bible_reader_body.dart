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

// Debug logging (visible in flutter run console)
import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

// Server syncing client
import '../data/notes_api.dart';

/// Server-supported highlight colors (plus 'none' for UI-only).
enum HighlightColor { none, blue, red, yellow, green, purple }

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
  };
  final Map<String, Map<String, String>> _notesPerTx = {
    'kjv': <String, String>{},
    'rst': <String, String>{},
  };

  // Remote ID index (so we can update/delete correct rows)
  final Map<String, String> _noteIdByKey = <String, String>{}; // "Book|C|V" -> id
  final Map<String, String> _noteIdByCluster = <String, String>{}; // clusterId -> id

  String _k(VerseRef r) => '${r.book}|${r.chapter}|${r.verse}';
  String get _otherTx => _translation.toLowerCase() == 'kjv' ? 'rst' : 'kjv';

  bool _booksReady = false;
  String _localeForTx(String tx) => tx.trim().toLowerCase() == 'rst' ? 'ru' : 'en';

  // Catalog wrappers
  List<String> get _bookNames =>
      _booksReady ? Books.instance.names() : const <String>[];
  String _abbr(String book) => _booksReady ? Books.instance.abbrev(book) : book;
  int _chapterCount(String book) =>
      _booksReady ? Books.instance.chapterCount(book) : 1;
  int _bookIndex(String book) =>
      _booksReady ? (Books.instance.orderIndex(book) - 1) : 0;

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

    _load();

    // Verse matcher
    Future(() async {
      _matcher = await VerseMatching.load();
      _promoteLocalToShared();
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    Books.instance.ensureLoaded().then((_) {
      if (!mounted) return;
      _booksReady = true;
      Books.instance.setLocaleCode(_localeForTx(_translation));
      setState(() {});
    });
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

    await _syncFetchChapterNotes();
    if (mounted) setState(() {});
  }

  VerseKey _keyOf(VerseRef r) => (book: r.book, chapter: r.chapter, verse: r.verse);

  bool _existsInOther(VerseRef ref) {
    final m = _matcher;
    if (m == null) return false;
    return m.existsInOther(fromTx: _translation, key: _keyOf(ref));
  }

  List<VerseKey> _matchToOther(VerseRef ref) {
    final m = _matcher;
    if (m == null) return const [];
    return m.matchToOther(fromTx: _translation, key: _keyOf(ref));
  }

  Iterable<VerseKey> _sameTxSiblingsFor(VerseRef ref) {
    final m = _matcher;
    if (m == null) return const <VerseKey>[];

    final me = _keyOf(ref);
    final fromTx = _translation.toLowerCase();
    final otherTx = _otherTx.toLowerCase();

    List<VerseKey> toOther;
    if (me.book == 'Psalms') {
      final ro = m.matchToOtherRuleOnly(fromTx: fromTx, key: me);
      toOther = ro.where((x) => x.chapter != me.chapter).toList();
    } else {
      toOther = m.matchToOther(fromTx: fromTx, key: me);
    }

    final siblings = <String, VerseKey>{};
    for (final t in toOther) {
      final back = (me.book == 'Psalms')
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

    for (final tx in ['kjv', 'rst']) {
      final per = _hlPerTx[tx]!;
      for (final e in per.entries.toList()) {
        final p = e.key.split('|');
        if (p.length != 3) continue;
        final k = (
          book: p[0],
          chapter: int.tryParse(p[1]) ?? 0,
          verse: int.tryParse(p[2]) ?? 0
        );
        if (m.existsInOther(fromTx: tx, key: k)) {
          final cid = m.clusterId(tx, k);
          _hlShared[cid] = e.value;
          per.remove(e.key);
        }
      }
    }

    for (final tx in ['kjv', 'rst']) {
      final per = _notesPerTx[tx]!;
      for (final e in per.entries.toList()) {
        final p = e.key.split('|');
        if (p.length != 3) continue;
        final k = (
          book: p[0],
          chapter: int.tryParse(p[1]) ?? 0,
          verse: int.tryParse(p[2]) ?? 0
        );
        if (m.existsInOther(fromTx: tx, key: k)) {
          final cid = m.clusterId(tx, k);
          _notesShared[cid] = e.value;
          per.remove(e.key);
        }
      }
    }
  }

  // ===== Server sync (read) =====
  Future<void> _syncFetchChapterNotes() async {
    _noteIdByKey.clear();
    _noteIdByCluster.clear();

    final bookCanon = _book;
    final c = _chapter;
    final start = (c - 1) < 1 ? 1 : (c - 1);
    final end = c + 1;

    try {
      if (kDebugMode) {
        debugPrint('[Sync.Read] $bookCanon ch=$c window=[$start..$end] tx=$_translation');
      }

      final items = await NotesApi.getNotesForChapterRange(
        book: bookCanon,
        chapterStart: start,
        chapterEnd: end,
      );

      items.sort((a, b) {
        final ax =
            a.updatedAt ?? a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bx =
            b.updatedAt ?? b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return ax.compareTo(bx);
      });

      final m = _matcher;
      for (final rn in items) {
        final s = rn.verseStart;
        final e = rn.verseEnd ?? rn.verseStart;
        final color = HighlightColorServerCodec.fromApi(rn.color?.name);
        final noteText = rn.note;

        for (int v = s; v <= e; v++) {
          final key = '$bookCanon|${rn.chapter}|$v';
          _noteIdByKey[key] = rn.id;

          if (m != null) {
            final cid =
                m.clusterId(_translation, (book: bookCanon, chapter: rn.chapter, verse: v));
            _noteIdByCluster[cid] = rn.id;
            if (noteText.isNotEmpty) _notesShared[cid] = noteText;
            if (color != HighlightColor.none) _hlShared[cid] = color;
          } else {
            if (noteText.isNotEmpty) _notesPerTx[_translation]![key] = noteText;
            if (color != HighlightColor.none) _hlPerTx[_translation]![key] = color;
          }
        }
      }
    } catch (e, st) {
      debugPrint('[_syncFetchChapterNotes] failed: $e');
      debugPrint('$st');
    }
  }

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
      final selfCid = m.clusterId(_translation, _keyOf(ref));
      final cSelf = _hlShared[selfCid];
      if (cSelf != null) return cSelf;

      final me = _keyOf(ref);
      final bool isPsalms = me.book == 'Psalms';
      List<VerseKey> counterparts;
      if (isPsalms) {
        final ro = m.matchToOtherRuleOnly(fromTx: _translation, key: me);
        final hasCross = ro.any((x) => x.chapter != me.chapter);
        counterparts =
            hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
      } else {
        counterparts = m.matchToOther(fromTx: _translation, key: me);
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
      final selfCid = m.clusterId(_translation, _keyOf(ref));
      final sSelf = _notesShared[selfCid];
      if (sSelf != null && sSelf.isNotEmpty) return sSelf;

      final me = _keyOf(ref);
      final bool isPsalms = me.book == 'Psalms';
      List<VerseKey> counterparts;
      if (isPsalms) {
        final ro = m.matchToOtherRuleOnly(fromTx: _translation, key: me);
        final hasCross = ro.any((x) => x.chapter != me.chapter);
        counterparts =
            hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
      } else {
        counterparts = m.matchToOther(fromTx: _translation, key: me);
      }
      for (final other in counterparts) {
        final otherCid = m.clusterId(_otherTx, other);
        final sOther = _notesShared[otherCid];
        if (sOther != null && sOther.isNotEmpty) return sOther;
      }
      for (final sib in _sameTxSiblingsFor(ref)) {
        final sibCid = m.clusterId(_translation, sib);
        final sSib = _notesShared[sibCid];
        if (sSib != null && sSib.isNotEmpty) return sSib;
      }
    }
    return _notesPerTx[_translation]?[_k(ref)];
  }

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

        return StatefulBuilder(builder: (ctx, setSheet) {
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
                                Text('Jump to',
                                    style: Theme.of(ctx).textTheme.titleMedium),
                                const SizedBox(height: 12),
                                DropdownButtonFormField<String>(
                                  value: selBook,
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Book',
                                    border: OutlineInputBorder(),
                                  ),
                                  items: _bookNames
                                      .map((b) => DropdownMenuItem(
                                            value: b,
                                            child: Text(b),
                                          ))
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
                                  child: Text('Chapter',
                                      style:
                                          Theme.of(ctx).textTheme.labelLarge),
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
                                      onSelected: (_) =>
                                          setSheet(() => selChap = c),
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
                                onPressed: () =>
                                    Navigator.pop(ctx, (selBook, selChap)),
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
        });
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

  Future<void> _openActions((VerseRef ref, String text) v) async {
    final res = await showModalBottomSheet<_ActionResult>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _VerseActionsSheet(
        verseLabel: v.$1.toString(),
        currentHighlight: _colorFor(v.$1),
        existingNote: _noteFor(v.$1),
      ),
    );
    if (res == null) return;

    // ----- Local state updates -----
    setState(() {
      // NOTES (and ensure highlights are also cleared when notes are removed)
      if (res.noteDelete == true) {
        final m = _matcher;
        final hereK = _k(v.$1);

        if (m != null && _existsInOther(v.$1)) {
          final me = _keyOf(v.$1);
          final selfCid = m.clusterId(_translation, me);

          final bool isPsalms = me.book == 'Psalms';
          List<VerseKey> counterparts;
          if (isPsalms) {
            final ro = m.matchToOtherRuleOnly(fromTx: _translation, key: me);
            final hasCross = ro.any((x) => x.chapter != me.chapter);
            counterparts =
                hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
          } else {
            counterparts = m.matchToOther(fromTx: _translation, key: me);
          }

          final cids = <String>{selfCid};
          for (final o in counterparts) {
            cids.add(m.clusterId(_otherTx, o));
          }
          for (final s in _sameTxSiblingsFor(v.$1)) {
            cids.add(m.clusterId(_translation, s));
            _hlPerTx[_translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
          }
          // Clear shared note + highlight for all related clusters
          for (final cid in cids) {
            _notesShared.remove(cid);
            _hlShared.remove(cid); // IMPORTANT: clear highlight locally
          }
          // Clear per-tx at the tapped verse
          _notesPerTx[_translation]?.remove(hereK);
          _hlPerTx[_translation]?.remove(hereK);
        } else {
          // No matcher / no cross-map: just clear local note + highlight for this verse
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
            final selfCid = m.clusterId(_translation, me);

            final bool isPsalms = me.book == 'Psalms';
            List<VerseKey> counterparts;
            if (isPsalms) {
              final ro = m.matchToOtherRuleOnly(fromTx: _translation, key: me);
              final hasCross = ro.any((x) => x.chapter != me.chapter);
              counterparts =
                  hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
            } else {
              counterparts = m.matchToOther(fromTx: _translation, key: me);
            }

            final cids = <String>{selfCid};
            for (final o in counterparts) {
              cids.add(m.clusterId(_otherTx, o));
            }
            for (final s in _sameTxSiblingsFor(v.$1)) {
              cids.add(m.clusterId(_translation, s));
              _hlPerTx[_translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
            }

            for (final cid in cids) {
              _notesShared.remove(cid);
              _hlShared.remove(cid); // IMPORTANT: clear highlight locally
            }
            _notesPerTx[_translation]?.remove(hereK);
            _hlPerTx[_translation]?.remove(hereK);
          } else {
            _notesPerTx[_translation]?.remove(hereK);
            _hlPerTx[_translation]?.remove(hereK);
          }
        } else {
          if (m != null && _existsInOther(v.$1)) {
            final cid = m.clusterId(_translation, _keyOf(v.$1));
            _notesShared[cid] = txt;
            _notesPerTx['kjv']?.remove(_k(v.$1));
            _notesPerTx['rst']?.remove(_k(v.$1));
            for (final s in _sameTxSiblingsFor(v.$1)) {
              _notesPerTx[_translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
            }
          } else {
            _notesPerTx[_translation]?[_k(v.$1)] = txt;
          }
        }
      }

      // HIGHLIGHTS (normal path when a chip is selected)
      if (res.highlight != null) {
        final color = res.highlight!;
        final hereK = _k(v.$1);

        final m = _matcher;
        final mapsAcross = m != null && _existsInOther(v.$1);

        if (!mapsAcross || m == null) {
          if (color == HighlightColor.none) {
            _hlPerTx[_translation]?.remove(hereK);
          } else {
            _hlPerTx[_translation]?[hereK] = color;
          }
        } else {
          final cid = m.clusterId(_translation, _keyOf(v.$1));
          if (color == HighlightColor.none) {
            _hlShared.remove(cid);
          } else {
            _hlShared[cid] = color;
          }
          _hlPerTx['kjv']?.remove(hereK);
          _hlPerTx['rst']?.remove(hereK);
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
      final cid = m?.clusterId(_translation, _keyOf(v.$1));
      final id = (cid != null ? _noteIdByCluster[cid] : null) ?? _noteIdByKey[_k(v.$1)];

      if (kDebugMode) {
        debugPrint('[WriteThrough] ref=${_k(v.$1)} cid=${cid ?? "-"} id=${id ?? "-"} '
            'noteDelete=${res.noteDelete} noteLen=${(res.noteText ?? "").length} '
            'hl=${res.highlight?.name}');
      }

      // Note delete / upsert
      if (res.noteDelete == true) {
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
            final created = await NotesApi.create(RemoteNote(
              id: 'new',
              book: v.$1.book,
              chapter: v.$1.chapter,
              verseStart: v.$1.verse,
              verseEnd: null,
              note: txt,
              color: null, // toCreateJson() will default this to yellow.
            ));
            _noteIdByKey[_k(v.$1)] = created.id;
            if (cid != null) _noteIdByCluster[cid] = created.id;
          } else {
            if (kDebugMode) debugPrint('[WriteThrough] UPDATE note id=$id');
            await NotesApi.update(id, note: txt);
          }
        } else {
          // empty text => remove the note row (this also clears highlight on server)
          if (id != null) {
            if (kDebugMode) debugPrint('[WriteThrough] DELETE note (empty text) id=$id');
            await NotesApi.delete(id);
            if (cid != null) _noteIdByCluster.remove(cid);
            _noteIdByKey.remove(_k(v.$1));
          }
        }
      }

      // Highlight upsert/clear (UI no longer exposes "clear" alone, but keep logic safe)
      if (res.highlight != null) {
        final color = res.highlight!;
        final sc = _serverFromUi(color);
        final cid2 = m?.clusterId(_translation, _keyOf(v.$1));
        String? id2 = (cid2 != null ? _noteIdByCluster[cid2] : null) ?? _noteIdByKey[_k(v.$1)];

        if (color != HighlightColor.none) {
          if (id2 == null) {
            if (kDebugMode) debugPrint('[WriteThrough] CREATE highlight');
            final created = await NotesApi.create(RemoteNote(
              id: 'new',
              book: v.$1.book,
              chapter: v.$1.chapter,
              verseStart: v.$1.verse,
              verseEnd: null,
              note: '',
              color: sc, // explicit valid color
            ));
            _noteIdByKey[_k(v.$1)] = created.id;
            if (cid2 != null) _noteIdByCluster[cid2] = created.id;
          } else {
            if (kDebugMode) {
              debugPrint('[WriteThrough] UPDATE highlight id=$id2 -> ${sc?.name}');
            }
            await NotesApi.update(id2, color: sc);
          }
        } else {
          // If highlight were ever cleared while text exists, we no-op (UI doesn't allow it).
          final existingTxt =
              (_notesPerTx[_translation]?[_k(v.$1)] ?? _notesShared[cid2 ?? ''] ?? '').trim();
          if (existingTxt.isEmpty && id2 != null) {
            if (kDebugMode) debugPrint('[WriteThrough] DELETE row (clear highlight) id=$id2');
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

  @override
  Widget build(BuildContext context) {
    final tLabel = _translation.toUpperCase();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
          child: Row(
            children: [
              IconButton(
                tooltip: 'Previous chapter',
                onPressed: _isAtFirstChapter ? null : _prevChapter,
                icon: const Icon(Icons.chevron_left),
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
                      backgroundColor:
                          Theme.of(context).colorScheme.surfaceContainerHigh,
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
                      Books.instance.setLocaleCode(_localeForTx(_translation));
                    }
                  });
                  _load();
                },
                itemBuilder: (ctx) => _translations
                    .map((t) => PopupMenuItem(value: t, child: Text(t.toUpperCase())))
                    .toList(),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
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
                onPressed: null,
                icon: const Icon(Icons.search),
              ),
              IconButton(
                tooltip: 'Read aloud',
                onPressed: null,
                icon: const Icon(Icons.volume_up_outlined),
              ),
              IconButton(
                tooltip: 'Next chapter',
                onPressed: _isAtLastChapter ? null : _nextChapter,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
        const Divider(height: 12),
        Expanded(
          child: _verses.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                  child: FlowingChapterText(
                    verses: _verses,
                    highlights: {for (final v in _verses) v.$1: _colorFor(v.$1)},
                    onTapVerse: (vt) => _openActions(vt),
                    baseStyle: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontSize: 16,
                          height: 1.6,
                        ),
                  ),
                ),
        ),
      ],
    );
  }
}

// ===== Bottom Sheet =====

class _ActionResult {
  final HighlightColor? highlight;
  final String? noteText;
  final bool? noteDelete;
  _ActionResult({this.highlight, this.noteText, this.noteDelete});
}

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

  bool get _noteHasText => _note.text.trim().isNotEmpty;
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
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(widget.verseLabel, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),

          // ---- Highlight picker ----
          Align(alignment: Alignment.centerLeft, child: const Text('Highlight')),
          const SizedBox(height: 8),

          Wrap(
            spacing: 10,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final c in HighlightColor.values.where((c) => c != HighlightColor.none))
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
            decoration: InputDecoration(
              hintText: _canEditNote
                  ? 'Write a note for this verse…'
                  : 'Pick a highlight to enable notes',
              border: const OutlineInputBorder(),
              helperText: _canEditNote
                  ? 'Notes must be cleared to remove highlight.'
                  : null,
            ),
          ),
          const SizedBox(height: 12),

          Row(children: [
            // Delete All is always visible now
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () =>
                    Navigator.pop(context, _ActionResult(noteDelete: true)),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Delete All'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: () {
                  // If text editing is disabled, ignore any controller text
                  final String? textToSend = _canEditNote ? _note.text : null;

                  Navigator.pop(
                    context,
                    _ActionResult(
                      highlight: _pick,
                      noteText: textToSend,
                    ),
                  );
                },
                child: const Text('Save'),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

// Translations selectable
const List<String> _translations = ['kjv', 'rst'];
