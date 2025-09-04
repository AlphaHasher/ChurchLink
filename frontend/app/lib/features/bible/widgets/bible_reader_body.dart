// -----------------------------------------------------------------------------
// Main body for the bible reader. Allows users to display a whole chapter,
// highlight/notetake specific verses, jump to specific chapters across
// different books in the bible, and switch translations of the bible. 
// Additionally, translations with different verse numberings will have
// those verses matched accordingly so that highlights transfer
// (or in the case of a verse existing in only one translation, stay exclusive
// to that translation). For this project, this translation is designed around
// RST and KJV mapping specifically. 
// TODO: Notes should transfer as well
// -----------------------------------------------------------------------------

import 'package:flutter/material.dart';
import '../data/bible_repo_elisha.dart';
import 'flowing_chapter_text.dart'; // affects how verses are displayed
import '../data/verse_matching.dart'; // handles RST and KJV verse numbering

/// Establishes the highlighting color choices.
enum HighlightColor { none, yellow, green, blue, pink, purple, teal }

/// The main Bible reader as seen by users.
/// - Opens to a given translation/book/chapter.
/// - Lets users navigate, switch translations, highlight, notetake.
class BibleReaderBody extends StatefulWidget {
  /// Builds the Bible reader.
  const BibleReaderBody({
    super.key,
    // The book opens to this by default
    // At present, this is hardcoded to the start of the bible
    // TODO: The reader should eventually default to whatever was last open. 
    this.initialTranslation = 'kjv',
    this.initialBook = 'Genesis',
    this.initialChapter = 1,
  });

  //
  final String initialTranslation;
  final String initialBook;
  final int initialChapter;

  @override
  State<BibleReaderBody> createState() => _BibleReaderBodyState();
}

class _BibleReaderBodyState extends State<BibleReaderBody> {
  final _repo = ElishaBibleRepo();

  // Values for the current state of the reader (what's being displayed)
  late String _translation;
  late String _book;
  late int _chapter;

  // loaded asynchronously
  VerseMatching? _matcher; 

  List<(VerseRef ref, String text)> _verses = [];

  // Stores highlights in a map:
  // These highlights are shared by both translations
  final Map<String, HighlightColor> _hlShared = {};
  // These highlights are exclusive to a specific translation
  final Map<String, Map<String, HighlightColor>> _hlPerTx = {
    'kjv': <String, HighlightColor>{},
    'rst': <String, HighlightColor>{},
  };
  final Map<VerseRef, String> _notes = {};

  // Stable string keys so lookups survive reloads & translation switches
  String _k(VerseRef r) => '${r.book}|${r.chapter}|${r.verse}';
  String _kFromTriple((String, int, int) t) => '${t.$1}|${t.$2}|${t.$3}';

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
  // Helpers that convert VerseRef to the light-weight `VerseKey` record and
  // consult the VerseMatching engine to see if a verse maps to the other tx.
  VerseKey _keyOf(VerseRef r) => (book: r.book, chapter: r.chapter, verse: r.verse);

  /// Does this verse exist in the other translation? (Used for shared highlights)
  bool _existsInOther(VerseRef ref) {
    final m = _matcher; // local copy for null-safety promotion
    if (m == null) return false;
    return m.existsInOther(fromTx: _translation, key: _keyOf(ref));
  }

  /// Returns the corresponding verses in the other translation.
  List<VerseKey> _matchToOther(VerseRef ref) {
    final m = _matcher;
    if (m == null) return const [];
    return m.matchToOther(fromTx: _translation, key: _keyOf(ref));
  }

  // Compute display color for a verse in the CURRENT translation
  /// Chooses the effective highlight color for `ref`.
  /// Shared highlights override per-translation ones.
  HighlightColor _colorFor(VerseRef ref) {
    final k = _k(ref);
    final shared = _hlShared[k];
    if (shared != null) return shared;
    final per = _hlPerTx[_translation]?[k];
    return per ?? HighlightColor.none;
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

  /// Navigation functionality for the UI elements
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
                // Makes list scrollable for Books with many chapters, keeps confirm buttons visible
                final maxH = constraints.maxHeight * 0.92; // ~92% of screen
                return ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: maxH),
                  child: Padding(
                    padding: EdgeInsets.only(
                      left: 16,
                      right: 16,
                      top: 12,
                      // keep room for keyboard if it appears
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
  /// Opens the notetaking and highlighting menu
  Future<void> _openActions((VerseRef ref, String text) v) async {
    final res = await showModalBottomSheet<_ActionResult>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _VerseActionsSheet(
        verseLabel: v.$1.toString(),
        currentHighlight: _colorFor(v.$1),
        existingNote: _notes[v.$1],
      ),
    );
    if (res == null) return;

    setState(() {
      // Notes
      if (res.noteDelete == true) _notes.remove(v.$1);
      if (res.noteText != null && res.noteText!.trim().isNotEmpty) {
        _notes[v.$1] = res.noteText!.trim();
      }

      // Highlights (shared vs exclusive)
      if (res.highlight != null) {
        final color = res.highlight!;
        final here = _k(v.$1);

        if (!_existsInOther(v.$1)) {
          // Exclusive to this translation
          _hlPerTx[_translation]![here] = color;
          _hlShared.remove(here);
        } else {
          // Shared: mark here + mapped as shared
          _hlShared[here] = color;

          final mapped = _matchToOther(v.$1);
          for (final t in mapped) {
            _hlShared[_kFromTriple((t.book, t.chapter, t.verse))] = color;
          }

          // Clean any per-tx duplicates for these keys
          _hlPerTx['kjv']!.remove(here);
          _hlPerTx['rst']!.remove(here);
          for (final t in mapped) {
            final kk = _kFromTriple((t.book, t.chapter, t.verse));
            _hlPerTx['kjv']!.remove(kk);
            _hlPerTx['rst']!.remove(kk);
          }
        }
      }
    });
  }

  // ----- UI (main layout) -----
  /// Builds the reader UI: top navigation bar, Bible text, and notetaking/highlighting popup.
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

              // Chapter button, widens to fill empty space
              Expanded(
                flex: 6,
                child: SizedBox(
                  height: 36,
                  width: double.infinity,
                  child: TextButton(
                    onPressed: _openJumpPicker,
                    style: TextButton.styleFrom(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      backgroundColor:
                          Theme.of(context).colorScheme.surfaceContainerHigh,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
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

              // Translation single button (popup menu)
              // TODO: Consider other menu styles for the translation list
              PopupMenuButton<String>(
                tooltip: 'Translation',
                initialValue: _translation,
                onSelected: (val) {
                  setState(() => _translation = val);
                  _load();
                },
                itemBuilder: (ctx) => _translations
                    .map((t) =>
                        PopupMenuItem(value: t, child: Text(t.toUpperCase())))
                    .toList(),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest,
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

              const Spacer(flex: 1), // keep book name from being squished

              // Search Button
              // TODO: Implement Search Functionality
              IconButton(
                tooltip: 'Search',
                onPressed: null, // Currently Disabled
                icon: const Icon(Icons.search),
              ),

              // Speaker Placeholder
              // TODO: Implement Voiceover
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
                    // Compute highlight color per verse at render time
                    highlights: {
                      for (final v in _verses) v.$1 : _colorFor(v.$1),
                    },
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

  /// Builds the highlighting and notetaking popout
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
          Text(widget.verseLabel,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),

          Align(alignment: Alignment.centerLeft, child: const Text('Highlight')),
          const SizedBox(height: 8),

          // Adjust alignment of highlighting buttons
          Wrap(
            spacing: 10,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final c
                  in HighlightColor.values.where((c) => c != HighlightColor.none))
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
                      }[c]!
                          .withOpacity(.9),
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
                  onPressed: () =>
                      Navigator.pop(context, _ActionResult(noteDelete: true)),
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

// List which translations should be seleactable
const List<String> _translations = ['kjv', 'rst'];

// List all book names that should appear in the selector
const List<String> _bookNames = [
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Kings',
  '2 Kings',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',
  'Esther',
  'Job',
  'Psalms',
  'Proverbs',
  'Ecclesiastes',
  'Song of Solomon',
  'Isaiah',
  'Jeremiah',
  'Lamentations',
  'Ezekiel',
  'Daniel',
  'Hosea',
  'Joel',
  'Amos',
  'Obadiah',
  'Jonah',
  'Micah',
  'Nahum',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Philemon',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation'
];

// Maps book names to abbreviated versions
// This is used in the UI, where the header cannot fit the entire book title
// Rather than using ellipsis, opt for a generally accepted abbreviation
// TODO: Possibly condense the list of Book names and Book abbreviations into one entry
final Map<String, String> _bookAbbrev = {
  // Old Testament
  "Genesis": "Gen",
  "Exodus": "Exod",
  "Leviticus": "Lev",
  "Numbers": "Num",
  "Deuteronomy": "Deut",
  "Joshua": "Josh",
  "Judges": "Judg",
  "Ruth": "Ruth",
  "1 Samuel": "1 Sam",
  "2 Samuel": "2 Sam",
  "1 Kings": "1 Kgs",
  "2 Kings": "2 Kgs",
  "1 Chronicles": "1 Chr",
  "2 Chronicles": "2 Chr",
  "Ezra": "Ezra",
  "Nehemiah": "Neh",
  "Esther": "Esth",
  "Job": "Job",
  "Psalms": "Ps",
  "Proverbs": "Prov",
  "Ecclesiastes": "Eccl",
  "Song of Solomon": "Song",
  "Isaiah": "Isa",
  "Jeremiah": "Jer",
  "Lamentations": "Lam",
  "Ezekiel": "Ezek",
  "Daniel": "Dan",
  "Hosea": "Hos",
  "Joel": "Joel",
  "Amos": "Amos",
  "Obadiah": "Obad",
  "Jonah": "Jonah",
  "Micah": "Mic",
  "Nahum": "Nah",
  "Habakkuk": "Hab",
  "Zephaniah": "Zeph",
  "Haggai": "Hag",
  "Zechariah": "Zech",
  "Malachi": "Mal",
  // New Testament
  "Matthew": "Matt",
  "Mark": "Mark",
  "Luke": "Luke",
  "John": "John",
  "Acts": "Acts",
  "Romans": "Rom",
  "1 Corinthians": "1 Cor",
  "2 Corinthians": "2 Cor",
  "Galatians": "Gal",
  "Ephesians": "Eph",
  "Philippians": "Phil",
  "Colossians": "Col",
  "1 Thessalonians": "1 Thess",
  "2 Thessalonians": "2 Thess",
  "1 Timothy": "1 Tim",
  "2 Timothy": "2 Tim",
  "Titus": "Titus",
  "Philemon": "Phlm",
  "Hebrews": "Heb",
  "James": "Jas",
  "1 Peter": "1 Pet",
  "2 Peter": "2 Pet",
  "1 John": "1 Jn",
  "2 John": "2 Jn",
  "3 John": "3 Jn",
  "Jude": "Jude",
  "Revelation": "Rev",
};

// Contains a list of chapter counts per book. Used in the selector.
// In our case, RST and KJV have the same chapter counts. 
// TODO: Unsure about this approach. Chapter counts may change across different translations. 
const List<int> _chaptersPerBook = [
  50,
  40,
  27,
  36,
  34,
  24,
  21,
  4,
  31,
  24,
  22,
  25,
  29,
  36,
  10,
  13,
  10,
  42,
  150,
  31,
  12,
  8,
  66,
  52,
  5,
  48,
  12,
  14,
  3,
  9,
  1,
  4,
  7,
  3,
  3,
  3,
  2,
  14,
  4,
  28,
  16,
  24,
  21,
  28,
  16,
  16,
  13,
  6,
  6,
  4,
  4,
  5,
  3,
  6,
  4,
  3,
  1,
  13,
  5,
  5,
  3,
  5,
  1,
  1,
  1,
  22
];

// Returns the indexing location of a Book
int _bookIndex(String book) =>
    _bookNames.indexWhere((b) => b.toLowerCase() == book.toLowerCase());

// Returns the chapter count of a book
int _chapterCount(String book) {
  final i = _bookIndex(book);
  return i >= 0 ? _chaptersPerBook[i] : 1;
}
