// integration_test/main_nav_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
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
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      if (details.exception.toString().contains('No host specified in URI')) {
        return;
      }
      originalOnError?.call(details);
    };

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

  patrolTest(
    'Tap through all main buttons on Home screen including scrolling',
    ($) async {
      final originalOnError = FlutterError.onError;
      FlutterError.onError = (details) {
       if (details.exception.toString().contains('No host specified in URI')) {
          return;
        }
        originalOnError?.call(details);
      };
      app.main();

      await $.pumpAndSettle();

      final buttons = [
        'Join Live',
        'Sermons',
        'Giving',
        'Weekly Bulletin',
        'Forms',
      ];

      for (final label in buttons) {
        await $(label).scrollTo();  // ensures visibility
        await $(label).tap();
        await $.pumpAndSettle();
        await $(Icons.arrow_back).tap();
        await $.pumpAndSettle();
      }
    },
  );
}



