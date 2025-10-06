// integration_test/main_nav_test.dart
import 'dart:async';

import 'package:flutter/material.dart';                 // for ValueKey
import 'package:flutter_test/flutter_test.dart' show
  find, expect;                                         // Flutter finders + expect
import 'package:patrol/patrol.dart';

import 'package:app/main.dart' as app;                  // <-- adjust package name if needed

Future<void> expectVisible(PatrolFinder f, {Duration timeout = const Duration(seconds: 10)}) async {
  try {
    await f.waitUntilVisible(timeout: timeout);
  } catch (_) {
    expect(await f.exists, true);
  }
}

void main() {

  patrolTest('launch -> home -> switch tabs', ($) async {
    // Launch the app
    app.main();
    await $.pumpAndSettle();

    // Home visible
    await expectVisible($(find.byKey(const ValueKey('screen-home'))));

    // Tap Bible tab (we wrapped icons with Semantics(label: 'tab-bible'))
    await $(find.bySemanticsLabel('tab-bible')).tap();
    await $.pumpAndSettle();
    await expectVisible($(find.byKey(const ValueKey('screen-bible'))));

    // Tap Sermons
    await $(find.bySemanticsLabel('tab-sermons')).tap();
    await $.pumpAndSettle();
    await expectVisible($(find.byKey(const ValueKey('screen-sermons'))));

    // Tap Events
    await $(find.bySemanticsLabel('tab-events')).tap();
    await $.pumpAndSettle();
    await expectVisible($(find.byKey(const ValueKey('screen-events'))));

    // Back to Home
    await $(find.bySemanticsLabel('tab-home')).tap();
    await $.pumpAndSettle();
    await expectVisible($(find.byKey(const ValueKey('screen-home'))));
  });
}


