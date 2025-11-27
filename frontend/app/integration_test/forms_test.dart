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
  expect($('Please sign in to view your forms.').exists, isTrue);

  // Check for "Log In" button
  expect($('Log In').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

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
  expect($('Sign in').exists, isTrue);
  expect($('Continue with Email').exists, isTrue);
  expect($('Continue with Google').exists, isTrue);
  expect($('Continue with Apple').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

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
  expect($('Sign in').exists, isFalse);
},
  timeout: Timeout(Duration(seconds: 30)),
);

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
  expect($('Join Live').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);
}