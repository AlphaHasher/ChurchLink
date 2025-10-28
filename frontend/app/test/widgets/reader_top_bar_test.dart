import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/widgets/bible_reader/reader_top_bar.dart';

void main() {
  testWidgets('ReaderTopBar basic interactions', (tester) async {
    var prev = 0, next = 0, jump = 0, picked = '';
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ReaderTopBar(
          displayLabel: 'Gen 1',
          translation: 'kjv',
          translations: const ['kjv', 'asv', 'web', 'rst'],
          isAtFirstChapter: true,
          isAtLastChapter: false,
          onPrevChapter: () => prev++,
          onNextChapter: () => next++,
          onOpenJumpPicker: () => jump++,
          onSelectTranslation: (v) => picked = v,
          onSearchPressed: () {},
        ),
      ),
    ));

    // Prev disabled at first chapter
    final prevBtn = find.widgetWithIcon(IconButton, Icons.chevron_left);
    expect(tester.widget<IconButton>(prevBtn).onPressed, isNull);

    // Next enabled
    await tester.tap(find.widgetWithIcon(IconButton, Icons.chevron_right));
    await tester.pump();
    expect(next, 1);

    // Jump picker button
    await tester.tap(find.text('Gen 1'));
    await tester.pump();
    expect(jump, 1);

    // Translation menu (popup)
    await tester.tap(find.text('KJV'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ASV'));
    await tester.pumpAndSettle();
    expect(picked, 'asv');
  });
}
