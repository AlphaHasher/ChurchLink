import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart'
    show find, expect, findsNothing, findsWidgets;
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;

// Helper: Wait for a finder to become visible
Future<void> expectVisible(PatrolFinder f) async {
  try {
    await f.waitUntilVisible(timeout: const Duration(seconds: 15));
  } catch (_) {
    expect(f.exists, true);
  }
}

// Helper: Boot app and navigate to Bible tab
Future<void> bootToBible(PatrolIntegrationTester $) async {
  app.main();
  await $.pumpAndSettle();
  await $(find.byIcon(Icons.menu_book)).tap();
  await $.pumpAndSettle();
  await $(find.byKey(const ValueKey('screen-bible'))).waitUntilVisible();

  // Give it time to load data
  await Future.delayed(const Duration(seconds: 3));
  await $.pumpAndSettle();

  expect(
    find.byWidgetPredicate(
      (w) => w is Text && (w.data ?? '').contains('Error:'),
    ),
    findsNothing,
  );
}

void main() {
  // Smoke test: Verify clean load
  patrolTest('Bible Reader loads without errors', ($) async {
    app.main();
    await $.pumpAndSettle();

    // Go to Bible tab
    await $(find.byIcon(Icons.menu_book)).tap();
    await $.pumpAndSettle();

    // Screen becomes visible
    await expectVisible($(find.byKey(const ValueKey('screen-bible'))));

    // Wait for initial loading spinner to disappear (if present)
    await Future.delayed(const Duration(seconds: 3));
    await $.pumpAndSettle();

    // Sanity: No inline error text from FutureBuilder
    expect(
      find.byWidgetPredicate(
        (w) => w is Text && (w.data ?? '').contains('Error:'),
      ),
      findsNothing,
    );
  });

  // Integration test: Top bar controls
  patrolTest('Top bar controls: search, translation, jump, navigation', (
    $,
  ) async {
    await bootToBible($);

    // Search toggle
    await $(find.byIcon(Icons.search)).tap();
    await $.pumpAndSettle();
    expect(
      find.byType(DropdownButton<String>),
      findsWidgets,
    ); // search mode dropdown

    // Close search
    await $(find.byIcon(Icons.search)).tap();
    await $.pumpAndSettle();

    // Translation switch (open popup -> pick ASV)
    await $(find.text('KJV')).tap();
    await $.pumpAndSettle();
    await $(find.text('ASV')).tap();
    await $.pumpAndSettle();
    await $(find.text('ASV')).waitUntilVisible();

    // Jump picker: open and cancel
    // Tap the center TextButton with label like "Gen 1" (abbrev + chapter)
    await $(
      find.byWidgetPredicate(
        (w) =>
            w is TextButton &&
            w.child is Text &&
            ((w.child as Text).data ?? '').contains(' '),
      ),
    ).tap();
    await $.pumpAndSettle();
    await $(find.text('Cancel')).tap();
    await $.pumpAndSettle();

    // Next chapter then previous chapter
    await $(find.byIcon(Icons.chevron_right)).tap();
    await $.pumpAndSettle();
    await $(find.byIcon(Icons.chevron_left)).tap();
    await $.pumpAndSettle();

    expect(
      find.byWidgetPredicate(
        (w) => w is Text && (w.data ?? '').contains('Error:'),
      ),
      findsNothing,
    );
  });

  // Integration test: Multi-chapter navigation
  patrolTest('Navigate multiple chapters without errors', ($) async {
    await bootToBible($);

    // Navigate forward through several chapters
    for (int i = 0; i < 3; i++) {
      await $(find.byIcon(Icons.chevron_right)).tap();
      await $.pumpAndSettle();
    }

    // Navigate backward through several chapters
    for (int i = 0; i < 3; i++) {
      await $(find.byIcon(Icons.chevron_left)).tap();
      await $.pumpAndSettle();
    }

    expect(
      find.byWidgetPredicate(
        (w) => w is Text && (w.data ?? '').contains('Error:'),
      ),
      findsNothing,
    );
  });
}
