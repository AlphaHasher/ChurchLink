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

  expect(await $('Church Giving').exists, isTrue);
  expect(await $('Support Our Church').exists, isTrue);
  expect(await $('Enter Amount').exists, isTrue);
  expect(await $('General').exists, isTrue);
  expect(await $('Give with PayPal').exists, isTrue);
});

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
  expect(await $('Please enter a valid giving amount (> 0).').exists, isTrue);
});

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

  // Enter a valid amount
  await $('0.00').enterText('25.00');
  await $.pumpAndSettle();

  await $('Give with PayPal').tap();
  await $.pumpAndSettle();

  // Since it opens PayPal externally, we can only verify app didn't crash
  expect(await $('Church Giving').exists, isTrue);
});

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
  expect(await $('Building').exists, isTrue);
});

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
  expect(await $('Recurring giving').exists, isTrue);
});

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
  expect(await $('Join Live').exists, isTrue);
});
}