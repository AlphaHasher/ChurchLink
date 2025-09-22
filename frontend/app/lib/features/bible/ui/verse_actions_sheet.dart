// widgets/verse_actions_sheet.dart
// Bottom sheet for verse actions (UI only).

import 'package:flutter/material.dart';
import 'package:app/features/bible/domain/highlight.dart' show HighlightColor;

class ActionResult {
  final HighlightColor? highlight;
  final String? noteText;
  final bool? noteDelete;
  const ActionResult({this.highlight, this.noteText, this.noteDelete});
}

class VerseActionsSheet extends StatefulWidget {
  const VerseActionsSheet({
    super.key,
    required this.verseLabel,
    required this.currentHighlight,
    this.existingNote,
  });

  final String verseLabel;
  final HighlightColor currentHighlight;
  final String? existingNote;

  @override
  State<VerseActionsSheet> createState() => _VerseActionsSheetState();
}

class _VerseActionsSheetState extends State<VerseActionsSheet> {
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

            Align(alignment: Alignment.centerLeft, child: const Text('Note')),
            const SizedBox(height: 8),
            TextField(
              controller: _note,
              enabled: _canEditNote,
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
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.pop(context, const ActionResult(noteDelete: true)),
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Delete All'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      final String? textToSend = _canEditNote ? _note.text : null;
                      Navigator.pop(
                        context,
                        ActionResult(highlight: _pick, noteText: textToSend),
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
