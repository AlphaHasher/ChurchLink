import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/widgets/days_pagination_header.dart';

void main() {
  testWidgets('renders label and range and callbacks', (WidgetTester tester) async {
    var prevCalled = false;
    var nextCalled = false;

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: DaysPaginationHeader(
          start: 6,
          end: 10,
          total: 30,
          pageSize: 5,
          onPrev: () => prevCalled = true,
          onNext: () => nextCalled = true,
          label: 'Days',
          color: Colors.red,
        ),
      ),
    ));

  // Prefer checking the visible range text if present
  final rangeText = find.byWidgetPredicate((w) => w is Text && (w.data ?? '').contains('6') && (w.data ?? '').contains('10'));
  expect(rangeText, findsWidgets);

  final prev = find.widgetWithIcon(IconButton, Icons.chevron_left);
  final next = find.widgetWithIcon(IconButton, Icons.chevron_right);
  expect(prev, findsOneWidget);
  expect(next, findsOneWidget);

  await tester.tap(prev);
    await tester.pumpAndSettle();
    expect(prevCalled, isTrue);

    await tester.tap(next);
    await tester.pumpAndSettle();
    expect(nextCalled, isTrue);

  });

  testWidgets('disabled buttons when callbacks null', (WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: DaysPaginationHeader(
          start: 1,
          end: 5,
          total: 5,
          pageSize: 5,
        ),
      ),
    ));

  final prev = find.widgetWithIcon(IconButton, Icons.chevron_left);
  final next = find.widgetWithIcon(IconButton, Icons.chevron_right);
  expect(prev, findsOneWidget);
  expect(next, findsOneWidget);

  final prevButton = tester.widget<IconButton>(prev);
  final nextButton = tester.widget<IconButton>(next);
  expect(prevButton.onPressed, isNull);
  expect(nextButton.onPressed, isNull);
  });
}
