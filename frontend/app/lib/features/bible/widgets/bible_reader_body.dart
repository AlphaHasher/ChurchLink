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

  @override
  void initState() {
    super.initState();

    _translation = widget.initialTranslation;
    _book = widget.initialBook;
    _chapter = widget.initialChapter;

    _load(); // load the initial chapter

    // Load the verse matcher asynchronously
    Future(() async {
      _matcher = await VerseMatching.load();
      setState(() {}); // refresh UI when matcher is ready
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
    return _hlPerTx[_translation]?[_k(ref)] ?? HighlightColor.none;
  }

  /// Returns the effective note for `ref`.
  /// If the verse maps across, prefer the shared (cluster) note; else per-translation.
  String? _noteFor(VerseRef ref) {
    final m = _matcher;
    if (m != null && _existsInOther(ref)) {
      final cid = m.clusterId(_translation, _keyOf(ref));
      final s = _notesShared[cid];
      if (s != null && s.isNotEmpty) return s;
    }
    return _notesPerTx[_translation]?[_k(ref)];
  }

  // Greys out the back chapter button if on the first chapter of the whole Bible
  bool get _isAtFirstChapter {
    final i = _bookIndex(_book);
    return _chapter == 1 && i == 0;
  }

  // Greys out the forward chapter button if on the last chapter of the whole Bible
  bool get _isAtLastChapter {
    final i = _bookIndex(_book);
    final lastBookIndex = _bookNames.length - 1;
    return _chapter == _chapterCount(_book) && i == lastBookIndex;
  }

  /// Move forward by one chapter, wrapping into the next book when needed.
  void _nextChapter() {
    final i = _bookIndex(_book);
    final count = _chapterCount(_book);
    if (_chapter < count) {
      setState(() => _chapter += 1);
    } else {
      final ni = (i + 1) % _bookNames.length;
      setState(() {
        _book = _bookNames[ni];
        _chapter = 1;
      });
    }
    _load();
  }

  /// Move backward by one chapter, wrapping into the previous book when needed.
  void _prevChapter() {
    final i = _bookIndex(_book);
    if (_chapter > 1) {
      setState(() => _chapter -= 1);
    } else {
      final pi = (i - 1 + _bookNames.length) % _bookNames.length;
      setState(() {
        _book = _bookNames[pi];
        _chapter = _chapterCount(_book);
      });
    }
    _load();
  }

  /// Opens the book and chapter select popup
  Future<void> _openJumpPicker() async {
    final result = await showModalBottomSheet<(String, int)?>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        String selBook = _book;
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
      setState(() {
        _book = result.$1;
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
                    child: Text(
                      '${_bookAbbrev[_book] ?? _book} $_chapter',
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
                  setState(() => _translation = val);
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

// List all book names that should appear in the selector
const List<String> _bookNames = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua',
  'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job',
  'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
  'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai',
  'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John',
  '2 John', '3 John', 'Jude', 'Revelation'
];

// Book abbreviations (UI header)
final Map<String, String> _bookAbbrev = {
  "Genesis": "Gen", "Exodus": "Exod", "Leviticus": "Lev", "Numbers": "Num",
  "Deuteronomy": "Deut", "Joshua": "Josh", "Judges": "Judg", "Ruth": "Ruth",
  "1 Samuel": "1 Sam", "2 Samuel": "2 Sam", "1 Kings": "1 Kgs", "2 Kings": "2 Kgs",
  "1 Chronicles": "1 Chr", "2 Chronicles": "2 Chr", "Ezra": "Ezra", "Nehemiah": "Neh",
  "Esther": "Esth", "Job": "Job", "Psalms": "Ps", "Proverbs": "Prov",
  "Ecclesiastes": "Eccl", "Song of Solomon": "Song", "Isaiah": "Isa",
  "Jeremiah": "Jer", "Lamentations": "Lam", "Ezekiel": "Ezek", "Daniel": "Dan",
  "Hosea": "Hos", "Joel": "Joel", "Amos": "Amos", "Obadiah": "Obad",
  "Jonah": "Jonah", "Micah": "Mic", "Nahum": "Nah", "Habakkuk": "Hab",
  "Zephaniah": "Zeph", "Haggai": "Hag", "Zechariah": "Zech", "Malachi": "Mal",
  "Matthew": "Matt", "Mark": "Mark", "Luke": "Luke", "John": "John",
  "Acts": "Acts", "Romans": "Rom", "1 Corinthians": "1 Cor", "2 Corinthians": "2 Cor",
  "Galatians": "Gal", "Ephesians": "Eph", "Philippians": "Phil", "Colossians": "Col",
  "1 Thessalonians": "1 Thess", "2 Thessalonians": "2 Thess", "1 Timothy": "1 Tim",
  "2 Timothy": "2 Tim", "Titus": "Titus", "Philemon": "Phlm", "Hebrews": "Heb",
  "James": "Jas", "1 Peter": "1 Pet", "2 Peter": "2 Pet", "1 John": "1 Jn",
  "2 John": "2 Jn", "3 John": "3 Jn", "Jude": "Jude", "Revelation": "Rev",
};

// Contains a list of chapter counts per book. Used in the selector.
// In our case, RST and KJV have the same chapter counts. 
const List<int> _chaptersPerBook = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150,
  31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16,
  24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22
];

// Returns the indexing location of a Book
int _bookIndex(String book) =>
    _bookNames.indexWhere((b) => b.toLowerCase() == book.toLowerCase());

// Returns the chapter count of a book
int _chapterCount(String book) {
  final i = _bookIndex(book);
  return i >= 0 ? _chaptersPerBook[i] : 1;
}
