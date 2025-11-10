import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;

void main() {
  patrolTest('Weekly Bulletin page shows current data', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Weekly Bulletin').tap();
  await $.pumpAndSettle();

  // Verify page title
  expect(await $('Weekly Bulletin').exists, isTrue);

  // Check section headers
  expect(await $('For the week of Nov 10, 2025').exists, isTrue);
  expect(await $('Bulletin Announcements').exists, isTrue);

  // Check for sample entries
  expect(await $('Test Service').exists, isTrue);
  expect(await $('Test Bulletin').exists, isTrue);
});

 patrolTest('Can open and view service detail page', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Weekly Bulletin').tap();
  await $.pumpAndSettle();

  await $('Test Service').tap();
  await $.pumpAndSettle();

  // Check that we navigated to the Service Detail
  expect(await $('Test Service').exists, isTrue);
  expect(await $('Service Timeline').exists, isTrue);
  expect(await $('Test Service Timeline Notes').exists, isTrue);

  // Go back
  await $(Icons.arrow_back).tap();
  await $.pumpAndSettle();

  // Verify we’re back to the main bulletin list
  expect(await $('Weekly Bulletin').exists, isTrue);
});

 patrolTest('Can open bulletin announcement modal', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Weekly Bulletin').tap();
  await $.pumpAndSettle();

  // Open announcement
  await $('Test Bulletin').tap();
  await $.pumpAndSettle();

  // Check modal content
  expect(await $('UPCOMING').exists, isTrue);
  expect(await $('Test Bulletin').exists, isTrue);
  expect(await $('Test Ministry').exists, isTrue);
  expect(await $('Test Bulletin Desc').exists, isTrue);
});

 patrolTest('Can open and close filter announcements modal', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Weekly Bulletin').tap();
  await $.pumpAndSettle();

  // Open the filter modal (top-right icon)
  await $(Icons.filter_list).tap();
  await $.pumpAndSettle();

  // Verify fields exist
  expect(await $('Filter Announcements').exists, isTrue);
  expect(await $('Search').exists, isTrue);
  expect(await $('All ministries').exists, isTrue);
  expect(await $('Apply').exists, isTrue);
  expect(await $('Clear').exists, isTrue);

  // Close via 'X'
  await $(Icons.close).tap();
  await $.pumpAndSettle();

  // Ensure filter closed
  expect(await $('Filter Announcements').exists, isFalse);
});

 patrolTest('Can select a ministry from filter dropdown', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Weekly Bulletin').tap();
  await $.pumpAndSettle();
  await $(Icons.filter_list).tap();
  await $.pumpAndSettle();

  await $('All ministries').tap();
  await $.pumpAndSettle();

  await $('Test Ministry').tap(); // choose a specific one
  await $.pumpAndSettle();

  await $('Apply').tap();
  await $.pumpAndSettle();

  expect(await $('Weekly Bulletin').exists, isTrue); // modal dismissed
});

 patrolTest('Back arrow returns to home from Weekly Bulletin', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Weekly Bulletin').tap();
  await $.pumpAndSettle();

  await $(Icons.arrow_back).tap();
  await $.pumpAndSettle();

  expect(await $('Join Live').exists, isTrue);
});
}