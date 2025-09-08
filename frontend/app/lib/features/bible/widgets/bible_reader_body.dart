// -----------------------------------------------------------------------------
// Main body for the bible reader. Allows users to display a whole chapter,
// highlight/notetake specific verses, jump to specific chapters across
// different books in the bible, and switch translations of the bible. 
// Additionally, translations with different verse numberings will have
// those verses matched accordingly so that highlights transfer
// (or in the case of a verse existing in only one translation, stay exclusive
// to that translation). For this project, this translation is designed around
// RST and KJV mapping specifically. 
// -----------------------------------------------------------------------------

import 'package:flutter/material.dart';
import '../data/bible_repo_elisha.dart';
import 'flowing_chapter_text.dart'; // affects how verses are displayed
import '../data/verse_matching.dart'; // handles RST and KJV verse numbering
import '../data/verse_matching.dart' show VerseMatching, VerseKey;
import '../data/books.dart';

/// Establishes the highlighting color choices.
enum HighlightColor { none, yellow, green, blue, pink, purple, teal }

/// The main Bible reader as seen by users.
/// - Opens to a given translation/book/chapter.
/// - Lets users navigate, switch translations, highlight, notetake.
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

  // loaded asynchronously
  VerseMatching? _matcher; 

  List<(VerseRef ref, String text)> _verses = [];

  // Shared highlights across translations, keyed by clusterId from VerseMatching
  final Map<String, HighlightColor> _hlShared = {};
  // Translation-local highlights (only when a verse has no counterpart)
  final Map<String, Map<String, HighlightColor>> _hlPerTx = {
    'kjv': <String, HighlightColor>{},
    'rst': <String, HighlightColor>{},
  };

  // Notes shared across translations (keyed by clusterId)
  final Map<String, String> _notesShared = {};
  // Translation-local notes (keyed by book|chapter|verse)
  final Map<String, Map<String, String>> _notesPerTx = {
    'kjv': <String, String>{},
    'rst': <String, String>{},
  };

  // Stable string keys so lookups survive reloads & translation switches
  String _k(VerseRef r) => '${r.book}|${r.chapter}|${r.verse}';

  String get _otherTx => _translation.toLowerCase() == 'kjv' ? 'rst' : 'kjv';

  // Prevents a crash if loading occurs out-of-order.
  bool _booksReady = false;

  // Map translation to catalog locale (KJV→en, RST→ru).
  String _localeForTx(String tx) => tx.trim().toLowerCase() == 'rst' ? 'ru' : 'en';

  // ===== Catalog-backed wrappers (guarded) =====
  // These were moved inside the State so they can read `_booksReady`.
  List<String> get _bookNames =>
      _booksReady ? Books.instance.names() : const <String>[];

  // Localized abbreviation for headers.
  // Falls back to raw book name if catalog isn't ready yet.
  String _abbr(String book) =>
      _booksReady ? Books.instance.abbrev(book) : book;

  // Chapter count lookup (catalog-backed).
  int _chapterCount(String book) =>
      _booksReady ? Books.instance.chapterCount(book) : 1;

  // 0-based index for UI ordering (catalog is 1-based).
  int _bookIndex(String book) =>
      _booksReady ? (Books.instance.orderIndex(book) - 1) : 0;

  @override
  void initState() {
    super.initState();

    // Load the books catalog once; set locale based on initial translation and mark ready.
    Books.instance.ensureLoaded().then((_) {
      if (!mounted) return;
      Books.instance.setLocaleCode(_localeForTx(widget.initialTranslation));
      _booksReady = true;
      setState(() {});
    });

    _translation = widget.initialTranslation;
    _book = widget.initialBook;
    _chapter = widget.initialChapter;

    _load(); // load the initial chapter

    // Load the verse matcher asynchronously
    Future(() async {
      _matcher = await VerseMatching.load();
      // promote local marks to shared clusters now that matcher is ready
      _promoteLocalToShared();
      setState(() {}); // refresh UI when matcher is ready
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Only touch Books after it is loaded; keep locale tied to translation, not device.
    Books.instance.ensureLoaded().then((_) {
      if (!mounted) return;
      _booksReady = true;
      Books.instance.setLocaleCode(_localeForTx(_translation));
      setState(() {}); // repaint headers/menus with localized strings
    });
  }

  /// Loads the current chapter using the repo and updates UI state.
  Future<void> _load() async {
    final data = await _repo.getChapter(
      translation: _translation,
      book: _book,
      chapter: _chapter,
    );
    setState(() => _verses = data);
  }

  // === Verse Matching Helpers ===
  VerseKey _keyOf(VerseRef r) => (book: r.book, chapter: r.chapter, verse: r.verse);

  /// Does this verse exist in the other translation? (Used for shared state)
  bool _existsInOther(VerseRef ref) {
    final m = _matcher;
    if (m == null) return false;
    return m.existsInOther(fromTx: _translation, key: _keyOf(ref));
  }

  /// Returns the corresponding verses in the other translation (not used for mirroring).
  List<VerseKey> _matchToOther(VerseRef ref) {
    final m = _matcher;
    if (m == null) return const [];
    return m.matchToOther(fromTx: _translation, key: _keyOf(ref));
  }

  // symmetric same-translation siblings via there-and-back RULE edges
  Iterable<VerseKey> _sameTxSiblingsFor(VerseRef ref) {
    final m = _matcher;
    if (m == null) return const <VerseKey>[];

    final me = _keyOf(ref);
    final fromTx = _translation.toLowerCase();
    final otherTx = _otherTx.toLowerCase();

    // Forward: to the other translation
    List<VerseKey> toOther;
    if (me.book == 'Psalms') {
      // Rule-only + cross-chapter only to keep your Psalms anti-bridge behavior
      final ro = m.matchToOtherRuleOnly(fromTx: fromTx, key: me);
      toOther = ro.where((x) => x.chapter != me.chapter).toList();
    } else {
      toOther = m.matchToOther(fromTx: fromTx, key: me);
    }

    // Back: from each target, bounce back into this translation
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

  // once matcher arrives, lift any existing per-translation marks into shared clusters
  void _promoteLocalToShared() {
    final m = _matcher;
    if (m == null) return;

    // Highlights
    for (final tx in ['kjv', 'rst']) {
      final per = _hlPerTx[tx]!;
      for (final e in per.entries.toList()) {
        final p = e.key.split('|');
        if (p.length != 3) continue;
        final k = (book: p[0], chapter: int.tryParse(p[1]) ?? 0, verse: int.tryParse(p[2]) ?? 0);
        if (m.existsInOther(fromTx: tx, key: k)) {
          final cid = m.clusterId(tx, k);
          _hlShared[cid] = e.value;
          per.remove(e.key); // shared replaces the local copy
        }
      }
    }

    // Notes
    for (final tx in ['kjv', 'rst']) {
      final per = _notesPerTx[tx]!;
      for (final e in per.entries.toList()) {
        final p = e.key.split('|');
        if (p.length != 3) continue;
        final k = (book: p[0], chapter: int.tryParse(p[1]) ?? 0, verse: int.tryParse(p[2]) ?? 0);
        if (m.existsInOther(fromTx: tx, key: k)) {
          final cid = m.clusterId(tx, k);
          _notesShared[cid] = e.value;
          per.remove(e.key);
        }
      }
    }
  }

  /// Chooses the effective highlight color for `ref`.
  /// Shared (cluster) highlights override per-translation ones.
  HighlightColor _colorFor(VerseRef ref) {
    final m = _matcher;

    // 1) Try this verse’s own cluster id.
    if (m != null) {
      final selfCid = m.clusterId(_translation, _keyOf(ref));
      final cSelf = _hlShared[selfCid];
      if (cSelf != null) return cSelf;

      // 2) Also honor highlights keyed by any counterpart’s cluster id.
      //    This makes RST Ps 58:2 show the highlight from KJV Ps 59:1
      //    without merging KJV 59:1 and KJV 58:1 into one cluster.
      final me = _keyOf(ref);
      final bool isPsalms = me.book == 'Psalms';

      List<VerseKey> counterparts;
      if (isPsalms) {
        // Rule-only to avoid identity; then ONLY mirror if it’s a cross-chapter hop.
        final ro = m.matchToOtherRuleOnly(fromTx: _translation, key: me);
        final hasCross = ro.any((x) => x.chapter != me.chapter);
        counterparts = hasCross
            ? ro.where((x) => x.chapter != me.chapter).toList()
            : const <VerseKey>[]; // same-chapter counterparts: don't mirror
      } else {
        // Non-Psalms: normal mapping (identity allowed), so Gen 1:1 still mirrors.
        counterparts = m.matchToOther(fromTx: _translation, key: me);
      }

      for (final other in counterparts) {
        final otherCid = m.clusterId(_otherTx, other);
        final cOther = _hlShared[otherCid];
        if (cOther != null) return cOther;
      }
    }

    // 3) Fall back to translation-local highlight.
    // symmetry glue — mirror any SAME-translation sibling's local color
    final local = _hlPerTx[_translation]?[_k(ref)];
    if (local != null && local != HighlightColor.none) return local;
    for (final s in _sameTxSiblingsFor(ref)) {
      final kStr = '${s.book}|${s.chapter}|${s.verse}';
      final c = _hlPerTx[_translation]?[kStr];
      if (c != null && c != HighlightColor.none) return c;
    }

    return HighlightColor.none;
  }

  /// Returns the effective note for `ref`.
/// Returns the effective note for `ref`.
/// If the verse maps across, prefer the shared (cluster) note; else per-translation.
// TODO: parity with highlights — also check counterpart cluster ids
String? _noteFor(VerseRef ref) {
  final m = _matcher;
  if (m != null) {
    // 1) Try this verse’s own cluster id first (works for merges/splits/range shifts)
    final selfCid = m.clusterId(_translation, _keyOf(ref)); // uses current tx
    final sSelf = _notesShared[selfCid];
    if (sSelf != null && sSelf.isNotEmpty) return sSelf;

    // 2) Also honor notes keyed by any counterpart’s cluster id (same logic as _colorFor)
    final me = _keyOf(ref);
    final bool isPsalms = me.book == 'Psalms';

    List<VerseKey> counterparts;
    if (isPsalms) {
      // Rule-only + cross-chapter only to preserve your Psalms anti-bridge behavior
      final ro = m.matchToOtherRuleOnly(fromTx: _translation, key: me);
      final hasCross = ro.any((x) => x.chapter != me.chapter);
      counterparts = hasCross
          ? ro.where((x) => x.chapter != me.chapter).toList()
          : const <VerseKey>[];
    } else {
      counterparts = m.matchToOther(fromTx: _translation, key: me);
    }

    for (final other in counterparts) {
      final otherCid = m.clusterId(_otherTx, other);
      final sOther = _notesShared[otherCid];
      if (sOther != null && sOther.isNotEmpty) return sOther;
    }
  }

  // 3) Fall back to translation-local note.
  return _notesPerTx[_translation]?[_k(ref)];
}

  // Greys out the back chapter button if on the first chapter of the whole Bible
  bool get _isAtFirstChapter {
    if (!_booksReady) return true;
    final i = _bookIndex(_book);
    return _chapter == 1 && i == 0;
  }

  // Greys out the forward chapter button if on the last chapter of the whole Bible
  bool get _isAtLastChapter {
    if (!_booksReady) return true;
    final i = _bookIndex(_book);
    final lastBookIndex = _bookNames.length - 1;
    return _chapter == _chapterCount(_book) && i == lastBookIndex;
  }

  /// Move forward by one chapter, wrapping into the next book when needed.
  void _nextChapter() {
    if (!_booksReady) return;
    final i = _bookIndex(_book);
    final count = _chapterCount(_book);
    if (_chapter < count) {
      setState(() => _chapter += 1);
    } else {
      final ni = (i + 1) % _bookNames.length;
      // Set canonical English name using catalog rather than localized display name.
      setState(() {
        _book = Books.instance.englishByOrder(ni + 1);
        _chapter = 1;
      });
    }
    _load();
  }

  /// Move backward by one chapter, wrapping into the previous book when needed.
  void _prevChapter() {
    if (!_booksReady) return;
    final i = _bookIndex(_book);
    if (_chapter > 1) {
      setState(() => _chapter -= 1);
    } else {
      final pi = (i - 1 + _bookNames.length) % _bookNames.length;
      // Set canonical English name using catalog rather than localized display name.
      setState(() {
        _book = Books.instance.englishByOrder(pi + 1);
        _chapter = _chapterCount(_book);
      });
    }
    _load();
  }

  /// Opens the book and chapter select popup
  Future<void> _openJumpPicker() async {
    if (!_booksReady) return;

    final result = await showModalBottomSheet<(String, int)?>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        // Start with the *localized* name in the picker; keep canonical in state.
        String selBook = _bookNames[_bookIndex(_book)];
        int selChap = _chapter;

        return StatefulBuilder(builder: (ctx, setSheet) {
          final total = _chapterCount(selBook);

          return SafeArea(
            child: LayoutBuilder(
              builder: (ctx, constraints) {
                final maxH = constraints.maxHeight * 0.92; // ~92% of screen
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
                        // Scrollable chapter list
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

                        // Confirmation buttons are always visible
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
      // Convert localized selection back to canonical English for Repo calls.
      setState(() {
        _book = Books.instance.canonEnglishName(result.$1);
        _chapter = result.$2;
      });
      _load();
    }
  }

  /// ----- Actions -----
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

    setState(() {
      // NOTES
      if (res.noteDelete == true) {
        final m = _matcher;
        if (m != null && _existsInOther(v.$1)) {
          final cid = m.clusterId(_translation, _keyOf(v.$1));
          _notesShared.remove(cid);
        } else {
          final key = _k(v.$1);
          _notesPerTx[_translation]!.remove(key);
        }
      } else if (res.noteText != null) {
        final txt = res.noteText!.trim();
        final m = _matcher;

        if (txt.isEmpty) {
          if (m != null && _existsInOther(v.$1)) {
            final cid = m.clusterId(_translation, _keyOf(v.$1));
            _notesShared.remove(cid);
          } else {
            final key = _k(v.$1);
            _notesPerTx[_translation]!.remove(key);
          }
        } else {
          if (m != null && _existsInOther(v.$1)) {
            final cid = m.clusterId(_translation, _keyOf(v.$1));
            _notesShared[cid] = txt;
          } else {
            final key = _k(v.$1);
            _notesPerTx[_translation]![key] = txt;
          }
        }
      }

      // HIGHLIGHTS
      if (res.highlight != null) {
        final color = res.highlight!;
        final hereK = _k(v.$1);

        final m = _matcher;
        final mapsAcross = m != null && _existsInOther(v.$1);

        if (!mapsAcross || m == null) {
          if (color == HighlightColor.none) {
            _hlPerTx[_translation]!.remove(hereK);
          } else {
            _hlPerTx[_translation]![hereK] = color;
          }
        } else {
          final cid = m.clusterId(_translation, _keyOf(v.$1));
          if (color == HighlightColor.none) {
            _hlShared.remove(cid);
          } else {
            _hlShared[cid] = color;
          }
          _hlPerTx['kjv']!.remove(hereK);
          _hlPerTx['rst']!.remove(hereK);

          // ensure same-translation siblings repaint immediately in this translation
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
  }

  // ----- UI (main layout) -----
  @override
  Widget build(BuildContext context) {
    final tLabel = _translation.toUpperCase();

    final w = MediaQuery.of(context).size.width;
    final double bookBtnMax = (w * 0.38).clamp(110.0, 200.0);

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
                      backgroundColor: Theme.of(context).colorScheme.surfaceContainerHigh,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    // Use localized abbreviation once catalog is ready; fall back to raw while loading.
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
                  // Switch catalog locale when translation changes (KJV↔RST).
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
                onPressed: null, // Currently Disabled
                icon: const Icon(Icons.search),
              ),
              IconButton(
                tooltip: 'Read aloud',
                onPressed: null, // Currently Disabled
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
                    highlights: { for (final v in _verses) v.$1 : _colorFor(v.$1) },
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

// ===== Notetaking and Highlighting Popup =====

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
                        HighlightColor.yellow: Colors.yellow,
                        HighlightColor.green: Colors.lightGreenAccent,
                        HighlightColor.blue: Colors.lightBlueAccent,
                        HighlightColor.pink: Colors.pinkAccent,
                        HighlightColor.purple: Colors.purpleAccent,
                        HighlightColor.teal: Colors.tealAccent,
                      }[c]!.withOpacity(.9),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: _pick == c ? Colors.black87 : Colors.black26,
                        width: _pick == c ? 2 : 1,
                      ),
                    ),
                  ),
                ),
              TextButton.icon(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: const Size(0, 28),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                ),
                onPressed: () => setState(() => _pick = HighlightColor.none),
                icon: const Icon(Icons.format_color_reset, size: 18),
                label: const Text('Clear'),
              ),
            ],
          ),

          const Divider(height: 24),

          Align(alignment: Alignment.centerLeft, child: const Text('Note')),
          const SizedBox(height: 8),
          TextField(
            controller: _note,
            minLines: 3,
            maxLines: 6,
            decoration: const InputDecoration(
              hintText: 'Write a note for this verse…',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),

          Row(children: [
            if (widget.existingNote != null)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.pop(context, _ActionResult(noteDelete: true)),
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Delete note'),
                ),
              ),
            if (widget.existingNote != null) const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                onPressed: () => Navigator.pop(
                  context,
                  _ActionResult(highlight: _pick, noteText: _note.text),
                ),
                child: const Text('Save'),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

// ===== Translation and Book UI Elements =====

// List which translations should be selectable
const List<String> _translations = ['kjv', 'rst'];

//Other info about the bibles has been moved to books.json