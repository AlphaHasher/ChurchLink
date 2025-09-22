import 'package:flutter/material.dart';

/// Bottom sheet to pick a book + chapter.
/// Returns `(String selectedBookName, int selectedChapter)` using the names passed in.
Future<(String, int)?> showJumpPicker({
  required BuildContext context,
  required List<String> bookNames,
  required String initialBook,
  required int initialChapter,
  required int Function(String bookName) chapterCountForBook,
}) {
  return showModalBottomSheet<(String, int)?>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) {
      String selBook = initialBook;
      int selChap = initialChapter;

      return StatefulBuilder(
        builder: (ctx, setSheet) {
          final total = chapterCountForBook(selBook);
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
                                  value: selBook,
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Book',
                                    border: OutlineInputBorder(),
                                  ),
                                  items: bookNames
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
}
