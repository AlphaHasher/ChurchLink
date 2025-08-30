import 'package:flutter/material.dart';
import '../data/bible_repo_elisha.dart';
import 'flowing_chapter_text.dart';

enum HighlightColor { none, yellow, green, blue, pink, purple, teal }

class BibleReaderBody extends StatefulWidget {
  const BibleReaderBody({
    super.key,
    this.initialTranslation = 'kjv', // change defaults here if you want
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

  // State
  late String _translation;
  late String _book;
  late int _chapter;

  List<(VerseRef ref, String text)> _verses = [];
  final Map<VerseRef, HighlightColor> _hl = {}; // in-memory MVP
  final Map<VerseRef, String> _notes = {};      // in-memory MVP

  @override
  void initState() {
    super.initState();
    _translation = widget.initialTranslation;
    _book = widget.initialBook;
    _chapter = widget.initialChapter;
    _load();
  }

  Future<void> _load() async {
    final data = await _repo.getChapter(
      translation: _translation,
      book: _book,
      chapter: _chapter,
    );
    setState(() => _verses = data);
  }

  // ----- Navigation -----
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
            child: Padding(
              padding: EdgeInsets.only(
                left: 16, right: 16, top: 12,
                bottom: 16 + MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Jump to', style: Theme.of(ctx).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: selBook,
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
                      setSheet(() {
                        selBook = b;
                        selChap = 1;
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Chapter',
                        style: Theme.of(ctx).textTheme.labelLarge),
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

  // ----- Actions -----
  Future<void> _openActions((VerseRef ref, String text) v) async {
    final res = await showModalBottomSheet<_ActionResult>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _VerseActionsSheet(
        verseLabel: v.$1.toString(),
        currentHighlight: _hl[v.$1] ?? HighlightColor.none,
        existingNote: _notes[v.$1],
      ),
    );
    if (res == null) return;

    setState(() {
      if (res.highlight != null) _hl[v.$1] = res.highlight!;
      if (res.noteDelete == true) _notes.remove(v.$1);
      if (res.noteText != null && res.noteText!.trim().isNotEmpty) {
        _notes[v.$1] = res.noteText!.trim();
      }
    });
  }

  // ----- UI -----
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
                onPressed: _prevChapter,
                icon: const Icon(Icons.chevron_left),
              ),

              // Book + chapter button (opens picker)
              TextButton(
                onPressed: _openJumpPicker,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  backgroundColor: Theme.of(context).colorScheme.surfaceContainerHigh,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text('$_book $_chapter'),
              ),
              const SizedBox(width: 8),

              // Translation single button (popup menu)
              PopupMenuButton<String>(
                tooltip: 'Translation',
                initialValue: _translation,
                onSelected: (val) {
                  setState(() => _translation = val);
                  _load();
                },
                itemBuilder: (ctx) => _translations
                    .map((t) => PopupMenuItem(
                          value: t,
                          child: Text(t.toUpperCase()),
                        ))
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

              const Spacer(),

              // Search (nonfunctional placeholder)
              IconButton(
                tooltip: 'Search',
                onPressed: null, // intentionally disabled
                icon: const Icon(Icons.search),
              ),

              // Speaker (nonfunctional placeholder)
              IconButton(
                tooltip: 'Read aloud',
                onPressed: null, // intentionally disabled
                icon: const Icon(Icons.volume_up_outlined),
              ),

              IconButton(
                tooltip: 'Next chapter',
                onPressed: _nextChapter,
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
                    highlights: _hl,
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

// ===== Bottom sheet result + actions sheet =====
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
          left: 16, right: 16, top: 12,
          bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(widget.verseLabel, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),

          Align(alignment: Alignment.centerLeft, child: const Text('Highlight')),
          const SizedBox(height: 8),

          // Center the row and shrink the Clear button
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
                    width: 26, height: 26,
                    decoration: BoxDecoration(
                      color: {
                        HighlightColor.yellow: Colors.yellow,
                        HighlightColor.green:  Colors.lightGreenAccent,
                        HighlightColor.blue:   Colors.lightBlueAccent,
                        HighlightColor.pink:   Colors.pinkAccent,
                        HighlightColor.purple: Colors.purpleAccent,
                        HighlightColor.teal:   Colors.tealAccent,
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
            minLines: 3, maxLines: 6,
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

// ===== Data for navigation =====
const List<String> _translations = ['kjv', 'rst'];

const List<String> _bookNames = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther',
  'Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations',
  'Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah',
  'Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
  '2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
  '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
];

const List<int> _chaptersPerBook = [
  50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22
];

int _bookIndex(String book) => _bookNames.indexWhere(
      (b) => b.toLowerCase() == book.toLowerCase(),
    );

int _chapterCount(String book) {
  final i = _bookIndex(book);
  return i >= 0 ? _chaptersPerBook[i] : 1;
}
