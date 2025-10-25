import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';

import 'package:app/main.dart' as app;
import 'package:app/theme/theme_controller.dart';

void main() {
  patrolTest('Settings → Theme: Light ↔ Dark + System matches device', ($) async {
    app.main();
    await $.pumpAndSettle();

    // Wait for the app to finish opening, fail if timed out
    Future<void> waitForFirstScaffold({Duration timeout = const Duration(seconds: 30)}) async {
      final end = DateTime.now().add(timeout);
      while (DateTime.now().isBefore(end)) {
        if (find.byType(Scaffold).evaluate().isNotEmpty) return;
        await $.tester.pump(const Duration(milliseconds: 100));
      }
      fail('No Scaffold after ${timeout.inSeconds}s. App did not reach a primary screen.');
    }

    await waitForFirstScaffold();

    // --- Helpers ---
    // Check if the actual theme's visuals adhere to light/dark
    Brightness currentBrightness() {
      final scaffold = find.byType(Scaffold);
      expect(scaffold, findsAtLeastNWidgets(1),
          reason: 'No Scaffold yet. App did not land on a primary screen.');
      final ctx = $.tester.element(scaffold.first);
      return Theme.of(ctx).brightness;
    }

    // Navigate to the Profiles page on the navbar where settings are stored
    Future<void> goToSettings() async {
      final candidates = <Finder>[
        // Finds the profile button by searching for the nav_profile key, person icon, or 'Profile' text
        find.byKey(const ValueKey('nav_profile')),
        find.byIcon(Icons.person),
        find.text('Profile'),
      ];
      final target = candidates.firstWhere(
        (f) => f.evaluate().isNotEmpty,
        orElse: () => throw TestFailure(
          'Could not find Profile entry. '
        ),
      );
      await $.tester.tap(target);
      await $.pumpAndSettle();
    }

    // Finds the Theme button and selects it, opening the selector sheet
    Future<void> openThemeSheet() async {
      final tileKey = find.byKey(const ValueKey('settings_theme_tile'));
      if (tileKey.evaluate().isNotEmpty) {
        await $.tester.ensureVisible(tileKey);
        await $.tester.tap(tileKey);
        await $.tester.pumpAndSettle();
        return;
      }
      final themeText = find.text('Theme');
      
      // If the button isn't immediately visible, try scrolling down
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

    // Selects a specific theme from the sheet
    Future<void> chooseTheme({required Key key, required String fallbackLabel}) async {
      final byKey = find.byKey(key);
      final target = byKey.evaluate().isNotEmpty ? byKey : find.text(fallbackLabel);
      expect(target, findsOneWidget, reason: 'Theme option "$fallbackLabel" not found.');
      await $.tester.tap(target);
      await $.tester.pumpAndSettle();
    }

    // Navigate to settings where the theme button resides
    await goToSettings();

    // Set to System theme first and verify it matches the system's theme visually
    await openThemeSheet();
    final deviceBrightness =
        WidgetsBinding.instance.platformDispatcher.platformBrightness;

    await chooseTheme(
      key: const Key('choose_theme_system'),
      fallbackLabel: 'System',
    );
    final sys = currentBrightness();
    expect(ThemeController.instance.mode, ThemeMode.system);
    expect(
      sys,
      equals(deviceBrightness),
      reason: 'System mode should match device theme (${deviceBrightness.name}).',
    );

    // Set to Dark theme and verify it matches dark styling visually
    await openThemeSheet();
    await chooseTheme(
      key: const Key('choose_theme_dark'),
      fallbackLabel: 'Dark',
    );
    final dark = currentBrightness();
    expect(dark, equals(Brightness.dark), reason: 'Dark theme does not appear dark visually.');
    expect(ThemeController.instance.mode, ThemeMode.dark);

    // Set to Light theme and verify it matches light styling visually
    await openThemeSheet();
    await chooseTheme(
      key: const Key('choose_theme_light'),
      fallbackLabel: 'Light',
    );
    final light = currentBrightness();
    expect(light, equals(Brightness.light), reason: 'Light theme does not appear light visually.');
    expect(ThemeController.instance.mode, ThemeMode.light);
  });
}
