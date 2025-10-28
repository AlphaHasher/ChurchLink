// Bottom sheet to pick a book + chapter.
// Returns (String selectedBookName, int selectedChapter) using the names passed in.

import 'package:flutter/material.dart';

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
      String? openBook = selBook;
      return StatefulBuilder(
        builder: (ctx, setSheet) {
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
                            child: Builder(builder: (ctx) {
                              final cs = Theme.of(ctx).colorScheme;
                              final text = Theme.of(ctx).textTheme;

                              Widget chapterGrid(String book, int total) {
                                return Padding(
                                  padding: const EdgeInsets.only(top: 12, left: 4, right: 4, bottom: 8),
                                  child: GridView.builder(
                                    shrinkWrap: true,
                                    physics: const NeverScrollableScrollPhysics(),
                                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: 7,
                                      mainAxisSpacing: 12,
                                      crossAxisSpacing: 12,
                                      childAspectRatio: 1.2,
                                    ),
                                    itemCount: total,
                                    itemBuilder: (context, i) {
                                      final c = i + 1;
                                      final selected = (book == selBook && c == selChap);
                                      return InkWell(
                                        borderRadius: BorderRadius.circular(12),
                                        onTap: () => setSheet(() {
                                          selBook = book;
                                          selChap = c;
                                        }),
                                        child: Container(
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: selected ? cs.primary : cs.surfaceContainerHighest,
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            '$c',
                                            style: text.bodyMedium?.copyWith(
                                              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                                              color: selected ? cs.onPrimary : cs.onSurfaceVariant,
                                            ),
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                );
                              }

                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  ...List.generate(bookNames.length, (index) {
                                    final book = bookNames[index];
                                    final isOpen = (openBook == book); // use the persistent toggle var

                                    return Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        ListTile(
                                          contentPadding: EdgeInsets.zero,
                                          title: Text(
                                            book,
                                            style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                                          ),
                                          trailing: Icon(isOpen ? Icons.expand_less : Icons.expand_more),
                                          onTap: () => setSheet(() {
                                            openBook = (openBook == book) ? null : book;
                                          }),
                                        ),
                                        if (isOpen) chapterGrid(book, chapterCountForBook(book)),
                                        const SizedBox(height: 8),
                                      ],
                                    );
                                  }),
                                ],
                              );
                            }),
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
