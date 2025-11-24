import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';

import 'package:app/main.dart' as app;
import 'package:app/theme/theme_controller.dart';

/// Shared helpers  
Future<void> waitForFirstScaffold(
  dynamic $, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    if (find.byType(Scaffold).evaluate().isNotEmpty) return;
    await $.tester.pump(const Duration(milliseconds: 100));
  }
  fail('No Scaffold after ${timeout.inSeconds}s. App did not reach a primary screen.');
}

/// Infer the current UI brightness by sampling background colors.
Brightness currentBrightness(dynamic $) {
  final scaffold = find.byType(Scaffold);
  expect(
    scaffold,
    findsAtLeastNWidgets(1),
    reason: 'No Scaffold yet. App did not land on a primary screen.',
  );

  final ctx = $.tester.element(scaffold.first);
  final theme = Theme.of(ctx);

  final candidates = <Color>[
    theme.scaffoldBackgroundColor,
    theme.colorScheme.surface,
    theme.canvasColor,
  ];

  final Color bg = candidates.firstWhere(
    (c) => c.alpha == 0xFF, // prefer opaque
    orElse: () => candidates.first,
  );

  return ThemeData.estimateBrightnessForColor(bg);
}

/// Navigate to Profile/Settings where the Theme control resides.
Future<void> goToSettings(dynamic $) async {
  final candidates = <Finder>[
    find.byKey(const ValueKey('nav_profile')),
    find.byIcon(Icons.person),
    find.text('Profile'),
  ];

  final end = DateTime.now().add(const Duration(seconds: 30));
  while (DateTime.now().isBefore(end)) {
    for (final f in candidates) {
      if (f.evaluate().isNotEmpty) {
        await $.tester.ensureVisible(f);
        await $.tester.tap(f);
        await $.pumpAndSettle();
        return;
      }
    }
    await $.tester.pump(const Duration(milliseconds: 100));
  }

  debugDumpApp();
  fail('Could not find Profile/Settings navigation after 30s.');
}

/// Open the Theme chooser sheet.
Future<void> openThemeSheet(dynamic $) async {
  final tileKey = find.byKey(const ValueKey('settings_theme_tile'));
  if (tileKey.evaluate().isNotEmpty) {
    await $.tester.ensureVisible(tileKey);
    await $.tester.tap(tileKey);
    await $.tester.pumpAndSettle();
    return;
  }

  final themeText = find.text('Theme');
  if (themeText.evaluate().isEmpty) {
    await $.tester.scrollUntilVisible(
      themeText,
      200,
      scrollable: find.byType(Scrollable).first,
    );
  }
  expect(themeText, findsOneWidget, reason: 'Settings row "Theme" not found.');
  await $.tester.tap(themeText);
  await $.tester.pumpAndSettle();
}

/// Select a Theme option, preferring a keyed widget and falling back to label.
Future<void> chooseTheme(
  dynamic $, {
  required Key key,
  required String fallbackLabel,
}) async {
  final byKey = find.byKey(key);
  final target = byKey.evaluate().isNotEmpty ? byKey : find.text(fallbackLabel);
  expect(target, findsOneWidget, reason: 'Theme option "$fallbackLabel" not found.');
  await $.tester.tap(target);
  await $.tester.pumpAndSettle();
}

/// ---------- Tests ----------
void main() {
  patrolTest('Theme: System Theme', ($) async {
    app.main();
    await $.pumpAndSettle();
    await waitForFirstScaffold($);

    await goToSettings($);
    await openThemeSheet($);
    await chooseTheme(
      $,
      key: const Key('choose_theme_system'),
      fallbackLabel: 'System',
    );

    final deviceBrightness =
        WidgetsBinding.instance.platformDispatcher.platformBrightness;
    final sys = currentBrightness($);

    expect(ThemeController.instance.mode, ThemeMode.system);
    expect(sys, equals(deviceBrightness),
        reason: 'System mode should match device theme.');
  });

  patrolTest('Theme: Dark Theme', ($) async {
    app.main();
    await $.pumpAndSettle();
    await waitForFirstScaffold($);

    await goToSettings($);
    await openThemeSheet($);
    await chooseTheme(
      $,
      key: const Key('choose_theme_dark'),
      fallbackLabel: 'Dark',
    );

    final dark = currentBrightness($);
    expect(ThemeController.instance.mode, ThemeMode.dark);
    expect(dark, equals(Brightness.dark),
        reason: 'Dark theme does not appear dark visually.');
  });

  patrolTest('Theme: Light Theme', ($) async {
    app.main();
    await $.pumpAndSettle();
    await waitForFirstScaffold($);

    await goToSettings($);
    await openThemeSheet($);
    await chooseTheme(
      $,
      key: const Key('choose_theme_light'),
      fallbackLabel: 'Light',
    );

    final light = currentBrightness($);
    expect(ThemeController.instance.mode, ThemeMode.light);
    expect(light, equals(Brightness.light),
        reason: 'Light theme does not appear light visually.');
  });
}
