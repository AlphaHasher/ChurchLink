import 'package:flutter/material.dart';
import '../data/bible_repo_elisha.dart';

enum HighlightColor { none, yellow, green, blue, pink, purple, teal }

class BibleReaderBody extends StatefulWidget {
  const BibleReaderBody({super.key});
  @override
  State<BibleReaderBody> createState() => _BibleReaderBodyState();
}

class _BibleReaderBodyState extends State<BibleReaderBody> {
  final _repo = ElishaBibleRepo();

  // MVP scope
  String _translation = 'kjv';            // switch among 'kjv','asv','bbe','web','ylt'
  String _book = 'John';
  int _chapter = 3;

  List<(VerseRef ref, String text)> _verses = [];
  final Map<VerseRef, HighlightColor> _hl = {}; // in-memory for MVP
  final Map<VerseRef, String> _notes = {};      // single note per verse (MVP)

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await _repo.getChapter(
      translation: _translation, book: _book, chapter: _chapter,
    );
    setState(() => _verses = data);
  }

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

  Color? _bg(HighlightColor c) {
    switch (c) {
      case HighlightColor.yellow: return Colors.yellow.withOpacity(.28);
      case HighlightColor.green:  return Colors.lightGreenAccent.withOpacity(.28);
      case HighlightColor.blue:   return Colors.lightBlueAccent.withOpacity(.28);
      case HighlightColor.pink:   return Colors.pinkAccent.withOpacity(.2);
      case HighlightColor.purple: return Colors.purpleAccent.withOpacity(.2);
      case HighlightColor.teal:   return Colors.tealAccent.withOpacity(.22);
      case HighlightColor.none:   return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header: translation + quick nav (fixed to John 3 for MVP)
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: Row(
            children: [
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'kjv', label: Text('KJV')),
                  ButtonSegment(value: 'asv', label: Text('ASV')),
                  ButtonSegment(value: 'bbe', label: Text('BBE')),
                  ButtonSegment(value: 'web', label: Text('WEB')),
                  ButtonSegment(value: 'ylt', label: Text('YLT')),
                ],
                selected: {_translation},
                onSelectionChanged: (s) { setState(() => _translation = s.first); _load(); },
                showSelectedIcon: false,
              ),
              const Spacer(),
              Text('$_book $_chapter', style: Theme.of(context).textTheme.labelLarge),
            ],
          ),
        ),
        const Divider(height: 12),
        Expanded(
          child: _verses.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                  itemCount: _verses.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, i) {
                    final v = _verses[i];
                    final bg = _bg(_hl[v.$1] ?? HighlightColor.none);
                    final hasNote = _notes.containsKey(v.$1);
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _openActions(v),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: bg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Theme.of(context).dividerColor),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${v.$1.verse} ', style: Theme.of(context).textTheme.labelLarge),
                              Expanded(child: Text(v.$2)),
                              if (hasNote) const Padding(
                                padding: EdgeInsets.only(left: 8, top: 2),
                                child: Icon(Icons.note, size: 16),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

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
  void dispose() { _note.dispose(); super.dispose(); }

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
          Align(alignment: Alignment.centerLeft, child: Text('Highlight')),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
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
                onPressed: () => setState(() => _pick = HighlightColor.none),
                icon: const Icon(Icons.format_color_reset),
                label: const Text('Clear'),
              ),
            ],
          ),
          const Divider(height: 24),
          Align(alignment: Alignment.centerLeft, child: Text('Note')),
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
