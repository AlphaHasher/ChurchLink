import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;

void main() {
  patrolTest('Forms page shows login prompt when signed out', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  // Navigate to Forms page
  await $('Forms').tap();
  await $.pumpAndSettle();

  // Check for lock icon and message
  expect(await $('Please sign in to view your forms.').exists, isTrue);

  // Check for "Log In" button
  expect(await $('Log In').exists, isTrue);
});

 patrolTest('Log In button opens sign-in modal', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Forms').tap();
  await $.pumpAndSettle();

  // Open the sign-in modal
  await $('Log In').tap();
  await $.pumpAndSettle();

  // Verify modal content
  expect(await $('Sign in').exists, isTrue);
  expect(await $('Continue with Email').exists, isTrue);
  expect(await $('Continue with Google').exists, isTrue);
});

 patrolTest('Clicking Continue with Email triggers flow', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Forms').tap();
  await $.pumpAndSettle();
  await $('Log In').tap();
  await $.pumpAndSettle();

  await $('Continue with Email').tap();
  await $.pumpAndSettle();

  // Verify something changes — for example:
  expect(await $('Sign in').exists, isFalse);
});

 patrolTest('Clicking Continue with Google triggers flow', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Forms').tap();
  await $.pumpAndSettle();
  await $('Log In').tap();
  await $.pumpAndSettle();

  await $('Continue with Google').tap();
  await $.native.waitUntilVisible(Selector(textContains: 'Google'));

  // Verify Google sign-in started (mocked)
  expect(await $('Sign in').exists, isFalse);
});

 patrolTest('Back arrow from Forms returns to Home', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };
  
  app.main();
  await $.pumpAndSettle();

  await $('Forms').tap();
  await $.pumpAndSettle();

  await $(Icons.arrow_back).tap();
  await $.pumpAndSettle();

  // Confirm we’re back on Home screen
  expect(await $('Join Live').exists, isTrue);
});
}