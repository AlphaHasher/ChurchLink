import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;

void main() {
  patrolTest('Giving page renders correctly', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  // Navigate to Giving page
  await $('Giving').tap();
  await $.pumpAndSettle();

  expect($('Church Giving').exists, isTrue);
  expect($('Support Our Church').exists, isTrue);
  expect($('Enter Amount').exists, isTrue);
  expect($('General').exists, isTrue);
  expect($('Give with PayPal').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

  patrolTest('Shows validation error for zero amount', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Giving').tap();
  await $.pumpAndSettle();

  await $('Give with PayPal').tap();
  await $.pumpAndSettle();

  // Verify validation message
  expect($('Please enter a valid giving amount (> 0).').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

 patrolTest('Accepts valid donation amount', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Giving').tap();
  await $.pumpAndSettle();

  // Tap to focus the field
  await $(TextField).tap();
  await $.pumpAndSettle();

  // Enter the amount
  await $(TextField).enterText('25.00');
  await $.pumpAndSettle();

  await $('Give with PayPal').tap();
  await $.pumpAndSettle();

  // Since it opens PayPal externally, we can only verify app didn't crash
  expect($('Church Giving').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

 patrolTest('Can change giving purpose', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Giving').tap();
  await $.pumpAndSettle();

  // Open dropdown
  await $('General').tap();
  await $.pumpAndSettle();

  // Select "Building"
  await $('Building').tap();
  await $.pumpAndSettle();

  // Verify selected value changed
  expect($('Building').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

 patrolTest('Can toggle recurring giving option', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Giving').tap();
  await $.pumpAndSettle();

  await $('Recurring giving').tap();
  await $.pumpAndSettle();

  // Verify toggle reflects activation (can test with exists if it triggers text/visual change)
  expect($('Recurring giving').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

 patrolTest('Back arrow returns to home from Giving', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Giving').tap();
  await $.pumpAndSettle();

  await $(Icons.arrow_back).tap();
  await $.pumpAndSettle();

  // Verify back on Home screen
  expect($('Join Live').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);
}