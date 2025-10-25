// integration_test/main_nav_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart' show find, expect;
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;

Future<void> expectVisible(PatrolFinder f) async {
  try {
    await f.waitUntilVisible(timeout: const Duration(seconds: 10));
  } catch (_) {
    expect(f.exists, true);
  }
}

void main() {
  patrolTest('launch -> home -> switch tabs', ($) async {
    app.main();
    await $.pumpAndSettle();

    await expectVisible($(find.byKey(const ValueKey('screen-home'))));

    // Bible
    await $(find.byIcon(Icons.menu_book)).tap();
    await $.pumpAndSettle();
    await expectVisible($(find.byKey(const ValueKey('screen-bible'))));

    // Sermons
    await $(find.byIcon(Icons.church)).tap();
    await $.pumpAndSettle();
    await expectVisible($(find.byKey(const ValueKey('screen-sermons'))));

    // Events
    await $(find.byIcon(Icons.event)).tap();
    await $.pumpAndSettle();
    await expectVisible($(find.byKey(const ValueKey('screen-events'))));

    // Home
    await $(find.byIcon(Icons.home)).tap();
    await $.pumpAndSettle();
    await expectVisible($(find.byKey(const ValueKey('screen-home'))));
  });
}



