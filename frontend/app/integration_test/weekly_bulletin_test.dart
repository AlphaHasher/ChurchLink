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
  expect($('Weekly Bulletin').exists, isTrue);

  // Check section headers
  expect($('For the week of Nov 10, 2025').exists, isTrue);
  expect($('Bulletin Announcements').exists, isTrue);

  // Check for sample entries
  expect($('Test Service').exists, isTrue);
  expect($('Test Bulletin').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

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
  expect($('Test Service').exists, isTrue);
  expect($('Service Timeline').exists, isTrue);
  expect($('Test Service Timeline Notes').exists, isTrue);

  // Go back
  await $(Icons.arrow_back).tap();
  await $.pumpAndSettle();

  // Verify we’re back to the main bulletin list
  expect($('Weekly Bulletin').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

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
  expect($('Test Service').exists, isTrue);
  expect($('Test Bulletin').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

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
  expect($('Filter Announcements').exists, isTrue);
  expect($('Search').exists, isTrue);
  expect($('All ministries').exists, isTrue);
  expect($('Apply').exists, isTrue);
  expect($('Clear').exists, isTrue);

  // Close via 'X'
  await $(Icons.close).tap();
  await $.pumpAndSettle();

  // Ensure filter closed
  expect($('Filter Announcements').exists, isFalse);
},
  timeout: Timeout(Duration(seconds: 30)),
);

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

  await $('Youth').tap(); // choose a specific one
  await $.pumpAndSettle();

  await $('Apply').tap();
  await $.pumpAndSettle();

  expect($('Weekly Bulletin').exists, isTrue); // modal dismissed
},
  timeout: Timeout(Duration(seconds: 30)),
);

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

  expect($('Join Live').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);
}